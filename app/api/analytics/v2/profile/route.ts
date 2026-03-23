/**
 * Profile Analytics V2 API Route
 * @description Serves profile-level analytics via Supabase RPC functions
 * from profile_analytics_daily and profile_analytics_accumulative tables.
 * @module app/api/analytics/v2/profile
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Valid profile-level metric names */
const PROFILE_METRICS = ['followers', 'profile_views', 'search_appearances', 'connections'] as const
type ProfileMetric = (typeof PROFILE_METRICS)[number]

/** Valid granularity values for profile timeseries RPCs */
const VALID_GRANULARITIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
type Granularity = (typeof VALID_GRANULARITIES)[number]

/** Granularities that have corresponding RPC functions */
const SUPPORTED_RPC_GRANULARITIES = ['daily', 'weekly', 'monthly'] as const

/** Row shape returned by profile timeseries RPC functions */
interface TimeseriesRow {
  bucket_date: string
  value: number
}

/** Row shape returned by the profile summary RPC function */
interface SummaryRow {
  current_total: number
  current_avg: number
  current_count: number
  comp_total: number
  comp_avg: number
  comp_count: number
  pct_change: number
}

/**
 * Known column mappings from metric name to the accumulative table column.
 * If a metric doesn't have a dedicated `_total` column in the
 * `profile_analytics_accumulative` table, it is mapped to a fallback or
 * excluded from accumulative lookups.
 */
const ACCUMULATIVE_COLUMN_MAP: Record<ProfileMetric, string | null> = {
  followers: 'followers_total',
  profile_views: 'profile_views_total',
  search_appearances: 'search_appearances_total',
  connections: 'connections_total',
}

/**
 * Maps a profile metric to its _total column name in the accumulative table.
 * Returns null if the metric has no corresponding column.
 * @param metric - The profile metric
 * @returns The total column name for the metric, or null
 */
function totalColumn(metric: ProfileMetric): string | null {
  return ACCUMULATIVE_COLUMN_MAP[metric] ?? null
}

/**
 * Compute start date from a period string relative to a reference date
 * @param period - The period identifier (7d, 30d, 90d, 1y)
 * @param ref - The reference end date
 * @returns Start date for the period
 */
function periodStartDate(period: string, ref: Date): Date {
  const start = new Date(ref)
  switch (period) {
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case '90d':
      start.setDate(start.getDate() - 90)
      break
    case '1y':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      start.setDate(start.getDate() - 30)
  }
  return start
}

/**
 * Format a Date to YYYY-MM-DD string
 * @param d - Date object
 * @returns ISO date string
 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * GET /api/analytics/v2/profile
 * @description Fetches profile-level analytics using Supabase RPC functions
 * for summary and timeseries data, plus accumulative totals.
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const metric = (searchParams.get('metric') || 'followers') as ProfileMetric
  const period = searchParams.get('period') || '30d'
  const compare = searchParams.get('compare') === 'true'
  const granularity = (searchParams.get('granularity') || 'daily') as Granularity

  if (!PROFILE_METRICS.includes(metric)) {
    return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 })
  }

  if (!VALID_GRANULARITIES.includes(granularity)) {
    return NextResponse.json({ error: `Invalid granularity: ${granularity}` }, { status: 400 })
  }

  // Determine date range
  const now = new Date()
  let endDate: Date
  let startDate: Date

  if (period === 'custom') {
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')
    if (!customStart || !customEnd) {
      return NextResponse.json({ error: 'startDate and endDate required for custom period' }, { status: 400 })
    }
    startDate = new Date(customStart)
    endDate = new Date(customEnd)
  } else {
    endDate = now
    startDate = periodStartDate(period, now)
  }

  const startStr = toDateStr(startDate)
  const endStr = toDateStr(endDate)

  // Compute comparison date range (same length, immediately preceding)
  const periodLengthMs = endDate.getTime() - startDate.getTime()
  const compStartDate = new Date(startDate.getTime() - periodLengthMs)
  const compEndDate = new Date(startDate.getTime() - 1)
  const compStartStr = toDateStr(compStartDate)
  const compEndStr = toDateStr(compEndDate)

  try {
    // Try pre-computed cache first (standard periods only)
    if (period !== 'custom') {
      const { data: cached } = await supabase
        .from('analytics_summary_cache')
        .select('*')
        .eq('user_id', user.id)
        .eq('metric', metric)
        .eq('period', period)
        .eq('metric_type', 'profile')
        .maybeSingle()

      if (cached && cached.computed_at) {
        const cacheAge = Date.now() - new Date(cached.computed_at).getTime()
        const FOUR_HOURS = 4 * 60 * 60 * 1000
        if (cacheAge < FOUR_HOURS) {
          const cachedTimeseries = (cached.timeseries as { date: string; value: number }[]) ?? []
          const summary = {
            total: Number(cached.current_total),
            average: Number(cached.current_avg),
            change: Number(cached.pct_change),
            accumulativeTotal: cached.accumulative_total != null ? Number(cached.accumulative_total) : 0,
            compCount: Number(cached.comp_count),
          }
          return NextResponse.json({
            current: cachedTimeseries,
            comparison: null,
            summary,
          })
        }
      }
    }

    // Fall back to RPC if cache miss or stale

    // Fall back to monthly for quarterly/yearly since those RPCs don't exist
    const effectiveGranularity = (SUPPORTED_RPC_GRANULARITIES as readonly string[]).includes(granularity)
      ? granularity
      : 'monthly'

    // Call profile timeseries RPC based on granularity
    const rpcName = `get_profile_analytics_timeseries_${effectiveGranularity}`
    const { data: timeseriesData, error: tsError } = await supabase.rpc(rpcName as never, {
      p_user_id: user.id,
      p_metric: metric,
      p_start_date: startStr,
      p_end_date: endStr,
    } as never)

    if (tsError) {
      console.error('Profile analytics timeseries RPC error:', tsError)
      return NextResponse.json({ error: 'Failed to fetch profile analytics' }, { status: 500 })
    }

    const tsRows = (timeseriesData ?? []) as TimeseriesRow[]
    const current = tsRows.map(r => ({
      date: r.bucket_date,
      value: Math.round(Number(r.value) * 100) / 100,
    }))

    // Call profile summary RPC (includes comparison)
    const { data: summaryData, error: summaryError } = await supabase.rpc('get_profile_analytics_summary' as never, {
      p_user_id: user.id,
      p_metric: metric,
      p_start_date: startStr,
      p_end_date: endStr,
      p_comp_start_date: compStartStr,
      p_comp_end_date: compEndStr,
    } as never)

    if (summaryError) {
      console.error('Profile analytics summary RPC error:', summaryError)
      return NextResponse.json({ error: 'Failed to fetch profile analytics summary' }, { status: 500 })
    }

    const summaryRows = (Array.isArray(summaryData) ? summaryData : [summaryData]) as SummaryRow[]
    const row = summaryRows[0]

    // Get accumulative total from most recent record
    const accumColumn = totalColumn(metric)
    let accumulativeTotal = 0

    if (accumColumn) {
      const { data: accumData } = await supabase
        .from('profile_analytics_accumulative')
        .select(accumColumn)
        .eq('user_id', user.id)
        .order('analysis_date', { ascending: false })
        .limit(1)
        .single()

      accumulativeTotal = accumData
        ? (accumData[accumColumn as keyof typeof accumData] as number) ?? 0
        : 0
    }

    // Comparison timeseries (only when explicitly requested)
    let comparison: { date: string; value: number }[] | null = null
    if (compare) {
      const { data: compData } = await supabase.rpc('get_profile_analytics_timeseries_daily' as never, {
        p_user_id: user.id,
        p_metric: metric,
        p_start_date: compStartStr,
        p_end_date: compEndStr,
      } as never)

      const compRows = (compData ?? []) as TimeseriesRow[]
      comparison = compRows.map(r => ({
        date: r.bucket_date,
        value: Math.round(Number(r.value) * 100) / 100,
      }))
    }

    const summary = row
      ? {
          total: Math.round(Number(row.current_total) * 100) / 100,
          average: Math.round(Number(row.current_avg) * 100) / 100,
          change: Math.round(Number(row.pct_change) * 100) / 100,
          accumulativeTotal,
          compCount: Number(row.comp_count),
        }
      : { total: 0, average: 0, change: 0, accumulativeTotal, compCount: 0 }

    const response: Record<string, unknown> = { current, comparison, summary }
    if (granularity !== effectiveGranularity) {
      response.granularityFallback = effectiveGranularity
      response.note = `Granularity '${granularity}' is not supported for profile metrics; fell back to '${effectiveGranularity}'.`
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Profile analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
