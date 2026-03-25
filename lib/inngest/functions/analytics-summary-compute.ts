/**
 * Analytics Summary Compute (Inngest Cron)
 * @description Pre-computes analytics summaries for all active users every 5 minutes.
 * Replaces on-the-fly RPC calls with cached results for reliable, fast reads.
 *
 * For each user, computes summary stats (total, avg, pct_change) and timeseries
 * for every metric × period combination. Results are upserted into
 * `analytics_summary_cache` for the API routes to read.
 *
 * Key distinction:
 *   - `current_total` / `accumulative_total` = absolute lifetime total from accumulative tables
 *   - `period_gained` (stored as `current_total` was before) = sum of daily deltas in the period
 *   - `pct_change` = compares period gains, not absolute totals
 *   - `timeseries` = daily gained values for charting
 *
 * Metrics computed:
 *   Post:    impressions, reactions, comments, reposts, saves, sends, engagements, engagements_rate
 *   Profile: followers, profile_views, search_appearances
 *
 * Periods:   7d, 30d, 90d, 1y
 *
 * @module lib/inngest/functions/analytics-summary-compute
 */

import { inngest } from '../client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Log prefix */
const LOG = '[AnalyticsSummaryCompute]'

/** Post-level metrics */
const POST_METRICS = [
  'impressions',
  'unique_reach',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'sends',
  'engagements',
  'engagements_rate',
] as const

/** Profile-level metrics */
const PROFILE_METRICS = [
  'followers',
  'profile_views',
  'search_appearances',
  'connections',
] as const

/** Standard periods to pre-compute */
const PERIODS = ['7d', '30d', '90d', '1y'] as const

/** Minimum comparison data points for a meaningful pct_change */
const MIN_COMP_DAYS = 3

/**
 * Summary result for a single metric + period
 * @property current_total - Absolute lifetime total from accumulative tables
 * @property current_avg - Average daily gain in the current period
 * @property current_count - Number of data points in the current period
 * @property comp_total - Sum of daily gains in the comparison period
 * @property comp_avg - Average daily gain in the comparison period
 * @property comp_count - Number of data points in the comparison period
 * @property pct_change - Percentage change in daily gains between current and comparison periods
 * @property accumulative_total - Same as current_total (absolute lifetime total)
 * @property timeseries - Daily gained values for chart rendering
 */
interface ComputedSummary {
  user_id: string
  metric: string
  period: string
  metric_type: 'post' | 'profile'
  current_total: number
  current_avg: number
  current_count: number
  comp_total: number
  comp_avg: number
  comp_count: number
  pct_change: number
  accumulative_total: number
  timeseries: { date: string; value: number }[]
  computed_at: string
}

/**
 * Creates a Supabase admin client that bypasses RLS
 * @returns Supabase client with service role privileges
 */
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * Compute start date for a period relative to a reference date
 * @param period - Period string (7d, 30d, 90d, 1y)
 * @param ref - Reference end date
 * @returns Start date for the period
 */
function periodStartDate(period: string, ref: Date): Date {
  const start = new Date(ref)
  switch (period) {
    case '7d': start.setDate(start.getDate() - 7); break
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '1y': start.setFullYear(start.getFullYear() - 1); break
    default: start.setDate(start.getDate() - 30)
  }
  return start
}

/**
 * Format a Date object to YYYY-MM-DD string
 * @param d - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Round a number to 2 decimal places
 * @param n - Number to round
 * @returns Rounded number
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Fetch the latest accumulative totals for all posts belonging to a user.
 * Returns a map of metric name to summed absolute total across all posts.
 * @param supabase - Admin Supabase client
 * @param userId - User ID
 * @returns Map of metric name to absolute lifetime total
 */
async function fetchPostAccumulativeTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, number>> {
  const { data: rows, error } = await supabase
    .from('post_analytics_accumulative')
    .select(
      'post_id, impressions_total, unique_reach_total, reactions_total, comments_total, reposts_total, saves_total, sends_total, engagements_total, engagements_rate'
    )
    .eq('user_id', userId) as { data: Record<string, unknown>[] | null; error: unknown }

  if (error) {
    console.error(`${LOG} Error fetching post accumulative totals for ${userId}:`, error)
  }

  const totals: Record<string, number> = {
    impressions: 0,
    unique_reach: 0,
    reactions: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
    sends: 0,
    engagements: 0,
  }

  for (const row of rows ?? []) {
    totals.impressions += Number(row.impressions_total) || 0
    totals.unique_reach += Number(row.unique_reach_total) || 0
    totals.reactions += Number(row.reactions_total) || 0
    totals.comments += Number(row.comments_total) || 0
    totals.reposts += Number(row.reposts_total) || 0
    totals.saves += Number(row.saves_total) || 0
    totals.sends += Number(row.sends_total) || 0
    totals.engagements += Number(row.engagements_total) || 0
  }

  // Engagement rate = (reactions + comments + reposts) / impressions * 100
  const engagementNumerator = totals.reactions + totals.comments + totals.reposts
  totals.engagements_rate = totals.impressions > 0
    ? (engagementNumerator / totals.impressions) * 100
    : 0

  return totals
}

/**
 * Fetch the latest accumulative totals for a user's profile.
 * @param supabase - Admin Supabase client
 * @param userId - User ID
 * @returns Map of metric name to absolute lifetime total, or null if no data
 */
async function fetchProfileAccumulativeTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, number> | null> {
  const { data: row, error } = await supabase
    .from('profile_analytics_accumulative')
    .select('followers_total, profile_views_total, search_appearances_total, connections_total')
    .eq('user_id', userId)
    .order('analysis_date', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: Record<string, unknown> | null; error: unknown }

  if (error) {
    console.error(`${LOG} Error fetching profile accumulative totals for ${userId}:`, error)
  }

  if (!row) return null

  return {
    followers: Number(row.followers_total) || 0,
    profile_views: Number(row.profile_views_total) || 0,
    search_appearances: Number(row.search_appearances_total) || 0,
    connections: Number(row.connections_total) || 0,
  }
}

/**
 * Compute post-level summaries for a user across all periods and metrics.
 *
 * - `current_total` = absolute lifetime total from post_analytics_accumulative
 * - `period_gained` (stored in cache fields) = sum of daily deltas from post_analytics_daily
 * - `pct_change` = comparison of period gains between current and previous period
 * - `timeseries` = daily gained values grouped by date
 *
 * @param supabase - Admin Supabase client
 * @param userId - User ID
 * @param now - Reference date for period calculations
 * @returns Array of computed summaries for all post metrics and periods
 */
async function computePostSummaries(
  supabase: SupabaseClient,
  userId: string,
  now: Date
): Promise<ComputedSummary[]> {
  const results: ComputedSummary[] = []

  // Fetch absolute totals once (shared across all periods)
  const accumTotals = await fetchPostAccumulativeTotals(supabase, userId)

  for (const period of PERIODS) {
    const endDate = now
    const startDate = periodStartDate(period, now)
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)

    // Comparison period: same length, immediately preceding
    const periodLengthMs = endDate.getTime() - startDate.getTime()
    const compStartDate = new Date(startDate.getTime() - periodLengthMs)
    const compEndDate = new Date(startDate.getTime() - 1)
    const compStartStr = toDateStr(compStartDate)
    const compEndStr = toDateStr(compEndDate)

    // Fetch daily rows for current and comparison periods in parallel
    const [{ data: curRows }, { data: compRows }] = await Promise.all([
      supabase
        .from('post_analytics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('analysis_date', startStr)
        .lte('analysis_date', endStr) as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
      supabase
        .from('post_analytics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('analysis_date', compStartStr)
        .lte('analysis_date', compEndStr) as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
    ])

    for (const metric of POST_METRICS) {
      try {
        const col = metric === 'engagements_rate' ? 'engagements_rate' : `${metric}_gained`

        // Absolute lifetime total from accumulative table
        const accumulativeTotal = round2(accumTotals[metric] ?? 0)

        if (metric === 'engagements_rate') {
          // Engagement rate is a percentage, not a summable metric
          // current_total = current engagement rate from accumulative totals
          // For timeseries, show daily engagement rate values
          // For pct_change, compare average engagement rate across periods

          const curRateValues = (curRows ?? []).map((r) => Number(r[col]) || 0).filter((v) => v > 0)
          const curDates = new Set((curRows ?? []).map((r) => r.analysis_date as string))
          const curAvgRate = curRateValues.length > 0
            ? curRateValues.reduce((a, b) => a + b, 0) / curRateValues.length
            : 0

          const compRateValues = (compRows ?? []).map((r) => Number(r[col]) || 0).filter((v) => v > 0)
          const compDates = new Set((compRows ?? []).map((r) => r.analysis_date as string))
          const compAvgRate = compRateValues.length > 0
            ? compRateValues.reduce((a, b) => a + b, 0) / compRateValues.length
            : 0

          let pctChange = 0
          if (compDates.size >= MIN_COMP_DAYS && compAvgRate > 0) {
            pctChange = round2(((curAvgRate - compAvgRate) / compAvgRate) * 100)
          }

          // Timeseries: average engagement rate per date
          const dateMap = new Map<string, { sum: number; count: number }>()
          for (const r of curRows ?? []) {
            const d = r.analysis_date as string
            const v = Number(r[col]) || 0
            if (v > 0) {
              const entry = dateMap.get(d) ?? { sum: 0, count: 0 }
              entry.sum += v
              entry.count += 1
              dateMap.set(d, entry)
            }
          }
          const timeseries = Array.from(dateMap.entries())
            .map(([date, { sum, count }]) => ({ date, value: round2(sum / count) }))
            .sort((a, b) => a.date.localeCompare(b.date))

          results.push({
            user_id: userId,
            metric,
            period,
            metric_type: 'post',
            current_total: accumulativeTotal,
            current_avg: round2(curAvgRate),
            current_count: curDates.size,
            comp_total: round2(compAvgRate),
            comp_avg: round2(compAvgRate),
            comp_count: compDates.size,
            pct_change: pctChange,
            accumulative_total: accumulativeTotal,
            timeseries,
            computed_at: new Date().toISOString(),
          })
          continue
        }

        // --- Standard summable post metrics ---

        // Current period: sum of daily gains
        const curValues = (curRows ?? []).map((r) => Number(r[col]) || 0)
        const curDates = new Set((curRows ?? []).map((r) => r.analysis_date as string))
        const periodGained = curValues.reduce((a, b) => a + b, 0)
        const currentAvg = curValues.length > 0 ? periodGained / curValues.length : 0
        const currentCount = curDates.size

        // Comparison period: sum of daily gains
        const compValues = (compRows ?? []).map((r) => Number(r[col]) || 0)
        const compDates = new Set((compRows ?? []).map((r) => r.analysis_date as string))
        const compGained = compValues.reduce((a, b) => a + b, 0)
        const compAvg = compValues.length > 0 ? compGained / compValues.length : 0
        const compCount = compDates.size

        // Percentage change based on period gains (not absolute totals)
        let pctChange = 0
        if (compCount >= MIN_COMP_DAYS && compGained > 0) {
          pctChange = round2(((periodGained - compGained) / compGained) * 100)
        }

        // Timeseries: daily gained values grouped by date
        const dateMap = new Map<string, number>()
        for (const r of curRows ?? []) {
          const d = r.analysis_date as string
          const v = Number(r[col]) || 0
          dateMap.set(d, (dateMap.get(d) || 0) + v)
        }
        const timeseries = Array.from(dateMap.entries())
          .map(([date, value]) => ({ date, value: round2(value) }))
          .sort((a, b) => a.date.localeCompare(b.date))

        results.push({
          user_id: userId,
          metric,
          period,
          metric_type: 'post',
          current_total: accumulativeTotal,
          current_avg: round2(currentAvg),
          current_count: currentCount,
          comp_total: round2(compGained),
          comp_avg: round2(compAvg),
          comp_count: compCount,
          pct_change: pctChange,
          accumulative_total: accumulativeTotal,
          timeseries,
          computed_at: new Date().toISOString(),
        })
      } catch (err) {
        console.error(`${LOG} Error computing ${metric}/${period} for user ${userId}:`, err)
      }
    }
  }

  return results
}

/**
 * Compute profile-level summaries for a user across all periods and metrics.
 *
 * - `current_total` = absolute lifetime total from profile_analytics_accumulative
 * - `period_gained` = sum of daily deltas from profile_analytics_daily
 * - `pct_change` = comparison of period gains
 * - `timeseries` = daily gained values for chart rendering
 *
 * @param supabase - Admin Supabase client
 * @param userId - User ID
 * @param now - Reference date for period calculations
 * @returns Array of computed summaries for all profile metrics and periods
 */
async function computeProfileSummaries(
  supabase: SupabaseClient,
  userId: string,
  now: Date
): Promise<ComputedSummary[]> {
  const results: ComputedSummary[] = []

  // Fetch absolute totals once (shared across all periods)
  const accumTotals = await fetchProfileAccumulativeTotals(supabase, userId)

  for (const period of PERIODS) {
    const endDate = now
    const startDate = periodStartDate(period, now)
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)

    const periodLengthMs = endDate.getTime() - startDate.getTime()
    const compStartDate = new Date(startDate.getTime() - periodLengthMs)
    const compEndDate = new Date(startDate.getTime() - 1)
    const compStartStr = toDateStr(compStartDate)
    const compEndStr = toDateStr(compEndDate)

    // Fetch daily rows for current and comparison periods in parallel
    const [{ data: curRows }, { data: compRows }] = await Promise.all([
      supabase
        .from('profile_analytics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('analysis_date', startStr)
        .lte('analysis_date', endStr) as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
      supabase
        .from('profile_analytics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('analysis_date', compStartStr)
        .lte('analysis_date', compEndStr) as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
    ])

    for (const metric of PROFILE_METRICS) {
      const col = `${metric}_gained`

      try {
        // Absolute lifetime total from accumulative table
        const accumulativeTotal = accumTotals ? round2(accumTotals[metric] ?? 0) : 0

        // Current period: sum of daily gains
        const curValues = (curRows ?? []).map((r) => Number(r[col]) || 0)
        const curDates = new Set((curRows ?? []).map((r) => r.analysis_date as string))
        const periodGained = curValues.reduce((a, b) => a + b, 0)
        const currentAvg = curValues.length > 0 ? periodGained / curValues.length : 0
        const currentCount = curDates.size

        // Comparison period: sum of daily gains
        const compValues = (compRows ?? []).map((r) => Number(r[col]) || 0)
        const compDates = new Set((compRows ?? []).map((r) => r.analysis_date as string))
        const compGained = compValues.reduce((a, b) => a + b, 0)
        const compAvg = compValues.length > 0 ? compGained / compValues.length : 0
        const compCount = compDates.size

        // Percentage change based on period gains
        let pctChange = 0
        if (compCount >= MIN_COMP_DAYS && compGained > 0) {
          pctChange = round2(((periodGained - compGained) / compGained) * 100)
        }

        // Timeseries: daily gained values
        const timeseries = (curRows ?? [])
          .map((r) => ({
            date: r.analysis_date as string,
            value: round2(Number(r[col]) || 0),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))

        results.push({
          user_id: userId,
          metric,
          period,
          metric_type: 'profile',
          current_total: accumulativeTotal,
          current_avg: round2(currentAvg),
          current_count: currentCount,
          comp_total: round2(compGained),
          comp_avg: round2(compAvg),
          comp_count: compCount,
          pct_change: pctChange,
          accumulative_total: accumulativeTotal,
          timeseries,
          computed_at: new Date().toISOString(),
        })
      } catch (err) {
        console.error(`${LOG} Error computing ${metric}/${period} for user ${userId}:`, err)
      }
    }
  }

  return results
}

/**
 * Analytics Summary Compute Cron
 * Runs every 5 minutes to pre-compute analytics summaries for all active users.
 * Results are upserted into analytics_summary_cache.
 *
 * Uses accumulative tables for absolute totals and daily tables for period gains,
 * ensuring current_total reflects the real lifetime metric values (e.g., 9,486
 * impressions) rather than just the daily deltas gained in the period.
 */
export const analyticsSummaryCompute = inngest.createFunction(
  {
    id: 'analytics-summary-compute',
    name: 'Analytics Summary Compute',
    retries: 2,
    concurrency: [{ limit: 1 }],
  },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const supabase = getSupabaseAdmin()
    const now = new Date()

    console.log(`${LOG} Starting summary computation at ${now.toISOString()}`)

    // Step 1: Get all active users (users with analytics data)
    const userIds = await step.run('fetch-active-users', async () => {
      // Get users from both daily and accumulative tables for completeness
      const [
        { data: postDailyUsers },
        { data: postAccumUsers },
        { data: profileDailyUsers },
        { data: profileAccumUsers },
      ] = await Promise.all([
        supabase
          .from('post_analytics_daily')
          .select('user_id')
          .limit(1000) as unknown as Promise<{ data: { user_id: string }[] | null }>,
        supabase
          .from('post_analytics_accumulative')
          .select('user_id')
          .limit(1000) as unknown as Promise<{ data: { user_id: string }[] | null }>,
        supabase
          .from('profile_analytics_daily')
          .select('user_id')
          .limit(1000) as unknown as Promise<{ data: { user_id: string }[] | null }>,
        supabase
          .from('profile_analytics_accumulative')
          .select('user_id')
          .limit(1000) as unknown as Promise<{ data: { user_id: string }[] | null }>,
      ])

      const ids = new Set<string>()
      for (const row of postDailyUsers ?? []) ids.add(row.user_id)
      for (const row of postAccumUsers ?? []) ids.add(row.user_id)
      for (const row of profileDailyUsers ?? []) ids.add(row.user_id)
      for (const row of profileAccumUsers ?? []) ids.add(row.user_id)

      const uniqueIds = Array.from(ids)
      console.log(`${LOG} Found ${uniqueIds.length} active user(s)`)
      return uniqueIds
    })

    if (userIds.length === 0) {
      console.log(`${LOG} No active users, skipping`)
      return { success: true, usersProcessed: 0, summariesUpserted: 0 }
    }

    // Step 2: Compute summaries for all users
    const totalUpserted = await step.run('compute-and-upsert-summaries', async () => {
      let totalRows = 0

      for (const userId of userIds) {
        try {
          console.log(`${LOG} Computing summaries for user ${userId}`)

          const [postSummaries, profileSummaries] = await Promise.all([
            computePostSummaries(supabase, userId, now),
            computeProfileSummaries(supabase, userId, now),
          ])

          const allSummaries = [...postSummaries, ...profileSummaries]

          if (allSummaries.length === 0) {
            console.log(`${LOG} No data for user ${userId}, skipping`)
            continue
          }

          // Upsert in batches of 50
          for (let i = 0; i < allSummaries.length; i += 50) {
            const batch = allSummaries.slice(i, i + 50)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
              .from('analytics_summary_cache')
              .upsert(
                batch.map((s) => ({
                  user_id: s.user_id,
                  metric: s.metric,
                  period: s.period,
                  metric_type: s.metric_type,
                  current_total: s.current_total,
                  current_avg: s.current_avg,
                  current_count: s.current_count,
                  comp_total: s.comp_total,
                  comp_avg: s.comp_avg,
                  comp_count: s.comp_count,
                  pct_change: s.pct_change,
                  accumulative_total: s.accumulative_total,
                  timeseries: s.timeseries,
                  computed_at: s.computed_at,
                })),
                { onConflict: 'user_id,metric,period' }
              )

            if (error) {
              console.error(`${LOG} Upsert error for user ${userId}:`, error)
            } else {
              totalRows += batch.length
            }
          }

          console.log(`${LOG} User ${userId}: ${allSummaries.length} summaries upserted`)
        } catch (err) {
          console.error(`${LOG} Failed to compute summaries for user ${userId}:`, err)
        }
      }

      return totalRows
    })

    // Step 3: Clean up stale entries (users that no longer exist)
    await step.run('cleanup-stale-entries', async () => {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('analytics_summary_cache')
        .delete()
        .lt('computed_at', sevenDaysAgo)

      if (error) {
        console.error(`${LOG} Cleanup error:`, error)
      } else {
        console.log(`${LOG} Cleaned up entries older than 7 days`)
      }
    })

    console.log(`${LOG} Completed: ${userIds.length} users, ${totalUpserted} summaries`)

    return {
      success: true,
      usersProcessed: userIds.length,
      summariesUpserted: totalUpserted,
    }
  }
)
