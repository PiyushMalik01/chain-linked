/**
 * Analytics Backfill Function (Inngest Cron)
 * @description Runs every 5 minutes to check for users who have raw snapshot data
 * (my_posts, post_analytics, linkedin_profiles, linkedin_analytics) but no
 * corresponding processed daily data. Seeds the daily and accumulative tables
 * so analytics are immediately visible without waiting for the midnight pipeline.
 *
 * Steps:
 *   1. Find posts in my_posts that have NO rows in post_analytics_accumulative
 *      → seed post_analytics_daily (_gained = 0) + post_analytics_accumulative (absolute values)
 *   2. Find users with linkedin_profiles that have NO rows in profile_analytics_accumulative
 *      → seed profile_analytics_daily (_gained = 0) + profile_analytics_accumulative (absolute values)
 *   3. Backfill analytics_history from linkedin_analytics data
 *
 * @module lib/inngest/functions/analytics-backfill
 */

import { inngest } from '../client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Log prefix for all backfill output */
const LOG = '[AnalyticsBackfill]'

/** Max IDs per .in() query to stay under Supabase URL length limits (~8KB) */
const BATCH_SIZE = 100

/**
 * Executes a Supabase .in() query in batches to avoid URL length limits.
 * Chunks the values array into groups of BATCH_SIZE, runs each query,
 * and merges the results.
 * @param db - Supabase client
 * @param table - Table name to query
 * @param column - Column name for the .in() filter
 * @param values - Array of values to filter by
 * @param select - Columns to select
 * @param orderBy - Optional ordering config
 * @returns Merged array of all results
 */
async function batchIn<T = Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  select: string,
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  if (values.length === 0) return []
  const results: T[] = []
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const chunk = values.slice(i, i + BATCH_SIZE)
    let query = db.from(table).select(select).in(column, chunk)
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending })
    }
    const { data, error } = await query
    if (error) {
      console.error(`${LOG} batchIn error on ${table}.${column}:`, error.message)
    }
    if (data) results.push(...(data as T[]))
  }
  return results
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
 * Analytics backfill cron function
 * Runs every 5 minutes to seed daily/accumulative tables for users with raw data
 */
export const analyticsBackfill = inngest.createFunction(
  {
    id: 'analytics-backfill',
    name: 'Analytics Backfill (5min)',
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const db = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    // ─── Step 1: Backfill Post Analytics ──────────────────────────────────
    const postResult = await step.run('backfill-post-analytics', async () => {
      console.log(`${LOG} [Step 1] Checking for posts missing accumulative analytics`)

      // Get all posts
      const { data: posts, error: postsErr } = await db
        .from('my_posts')
        .select('id, user_id, activity_urn, posted_at, created_at, impressions, reactions, comments, reposts, saves, sends')
        .not('user_id', 'is', null)

      if (postsErr || !posts?.length) {
        console.log(`${LOG} [Step 1] No posts found`)
        return { usersProcessed: 0, rowsInserted: 0 }
      }

      // Get all post IDs that already have accumulative rows (per-post skip guard)
      const postIds = posts.map(p => p.id)
      const existingAccum = await batchIn<{ post_id: string }>(
        db, 'post_analytics_accumulative', 'post_id', postIds, 'post_id'
      )

      const existingPostIds = new Set(existingAccum.map(r => r.post_id))

      // Filter to posts that DON'T have accumulative rows yet
      const newPosts = posts.filter(p => !existingPostIds.has(p.id))

      if (newPosts.length === 0) {
        console.log(`${LOG} [Step 1] All posts already have accumulative data`)
        return { usersProcessed: 0, rowsInserted: 0 }
      }

      console.log(`${LOG} [Step 1] Found ${newPosts.length} posts missing accumulative data`)

      // Get post_analytics data for richer metrics
      const activityUrns = newPosts.map(p => p.activity_urn).filter(Boolean)
      const postAnalytics = activityUrns.length > 0
        ? await batchIn<{
            activity_urn: string
            impressions: number | null
            unique_views: number | null
            members_reached: number | null
            reactions: number | null
            comments: number | null
            reposts: number | null
            saves: number | null
            sends: number | null
            engagement_rate: number | null
          }>(
            db, 'post_analytics', 'activity_urn', activityUrns,
            'activity_urn, impressions, unique_views, members_reached, reactions, comments, reposts, saves, sends, engagement_rate',
            { column: 'captured_at', ascending: false }
          )
        : []

      // Build map of latest post_analytics per activity_urn (first seen = latest due to order)
      const paMap = new Map<string, {
        impressions: number
        uniqueReach: number
        reactions: number
        comments: number
        reposts: number
        saves: number
        sends: number
        engagementRate: number | null
      }>()
      for (const row of postAnalytics) {
        if (row.activity_urn && !paMap.has(row.activity_urn)) {
          paMap.set(row.activity_urn, {
            impressions: row.impressions ?? 0,
            uniqueReach: row.unique_views ?? row.members_reached ?? 0,
            reactions: row.reactions ?? 0,
            comments: row.comments ?? 0,
            reposts: row.reposts ?? 0,
            saves: row.saves ?? 0,
            sends: row.sends ?? 0,
            engagementRate: row.engagement_rate ?? null,
          })
        }
      }

      let totalRowsInserted = 0
      const processedUserIds = new Set<string>()

      for (const post of newPosts) {
        const pa = paMap.get(post.activity_urn)
        const impressions = pa?.impressions ?? post.impressions ?? 0
        const uniqueReach = pa?.uniqueReach ?? 0
        const reactions = pa?.reactions ?? post.reactions ?? 0
        const comments = pa?.comments ?? post.comments ?? 0
        const reposts = pa?.reposts ?? post.reposts ?? 0
        const saves = pa?.saves ?? post.saves ?? 0
        const sends = pa?.sends ?? post.sends ?? 0

        // Only backfill if there are actual metrics
        if (impressions === 0 && reactions === 0 && comments === 0) continue

        const engagements = reactions + comments + reposts + saves + sends
        let engagementsRate: number | null = null
        if (pa?.engagementRate != null && pa.engagementRate > 0) {
          engagementsRate = pa.engagementRate
        } else if (impressions > 0) {
          engagementsRate = (engagements / impressions) * 100
        }

        // Use posted_at with created_at fallback
        const analysisDate = post.posted_at
          ? new Date(post.posted_at).toISOString().split('T')[0]
          : post.created_at
            ? new Date(post.created_at).toISOString().split('T')[0]
            : today

        // Upsert into post_analytics_daily with _gained = 0 (seed row, not actual daily gain)
        const { error: dailyErr } = await db
          .from('post_analytics_daily')
          .upsert({
            user_id: post.user_id,
            post_id: post.id,
            analysis_date: analysisDate,
            impressions_gained: 0,
            unique_reach_gained: 0,
            reactions_gained: 0,
            comments_gained: 0,
            reposts_gained: 0,
            saves_gained: 0,
            sends_gained: 0,
            engagements_gained: 0,
            engagements_rate: engagementsRate,
            analytics_tracking_status_id: 1, // DAILY
          }, {
            onConflict: 'user_id,post_id,analysis_date',
          })

        if (dailyErr) {
          console.error(`${LOG} [Step 1] Daily upsert error for post ${post.id}:`, dailyErr.message)
          continue
        }

        // Upsert into post_analytics_accumulative with absolute lifetime values
        const { error: accumErr } = await db
          .from('post_analytics_accumulative')
          .upsert({
            user_id: post.user_id,
            post_id: post.id,
            analysis_date: analysisDate,
            post_created_at: analysisDate,
            impressions_total: impressions,
            unique_reach_total: uniqueReach,
            reactions_total: reactions,
            comments_total: comments,
            reposts_total: reposts,
            saves_total: saves,
            sends_total: sends,
            engagements_total: engagements,
            engagements_rate: engagementsRate,
            analytics_tracking_status_id: 1,
          }, {
            onConflict: 'user_id,post_id',
          })

        if (accumErr) {
          console.error(`${LOG} [Step 1] Accumulative upsert error for post ${post.id}:`, accumErr.message)
        }

        totalRowsInserted++
        processedUserIds.add(post.user_id)
      }

      console.log(`${LOG} [Step 1] Done: ${processedUserIds.size} users, ${totalRowsInserted} rows`)
      return { usersProcessed: processedUserIds.size, rowsInserted: totalRowsInserted }
    })

    // ─── Step 2: Backfill Profile Analytics ───────────────────────────────
    const profileResult = await step.run('backfill-profile-analytics', async () => {
      console.log(`${LOG} [Step 2] Checking for profiles missing accumulative analytics`)

      const { data: profiles, error: profileErr } = await db
        .from('linkedin_profiles')
        .select('user_id, followers_count, connections_count')
        .not('user_id', 'is', null)

      if (profileErr || !profiles?.length) {
        console.log(`${LOG} [Step 2] No profiles found`)
        return { usersProcessed: 0, rowsInserted: 0 }
      }

      // Per-user skip: check which users already have accumulative rows
      const userIds = profiles.map(p => p.user_id)
      const existingAccum = await batchIn<{ user_id: string }>(
        db, 'profile_analytics_accumulative', 'user_id', userIds, 'user_id'
      )

      const existingUserIds = new Set(existingAccum.map(r => r.user_id))

      let totalRowsInserted = 0
      let usersProcessed = 0

      for (const profile of profiles) {
        const userId = profile.user_id

        // Skip users that already have accumulative data
        if (existingUserIds.has(userId)) continue

        // Get linkedin_analytics for profile_views and search_appearances
        const { data: analytics } = await db
          .from('linkedin_analytics')
          .select('profile_views, search_appearances')
          .eq('user_id', userId)
          .order('captured_at', { ascending: false })
          .limit(1)

        const profileViews = analytics?.[0]?.profile_views ?? 0
        const searchAppearances = analytics?.[0]?.search_appearances ?? 0
        const followers = profile.followers_count ?? 0
        const connections = profile.connections_count ?? 0

        // Only backfill if there are actual metrics
        if (followers === 0 && profileViews === 0 && connections === 0) continue

        // Upsert into profile_analytics_daily with _gained = 0 (seed row)
        const { error: dailyErr } = await db
          .from('profile_analytics_daily')
          .upsert({
            user_id: userId,
            analysis_date: today,
            followers_gained: 0,
            connections_gained: 0,
            profile_views_gained: 0,
            search_appearances_gained: 0,
          }, {
            onConflict: 'user_id,analysis_date',
          })

        if (dailyErr) {
          console.error(`${LOG} [Step 2] Profile daily upsert error for ${userId}:`, dailyErr.message)
          continue
        }

        // Upsert into profile_analytics_accumulative with absolute values
        const { error: accumErr } = await db
          .from('profile_analytics_accumulative')
          .upsert({
            user_id: userId,
            analysis_date: today,
            followers_total: followers,
            connections_total: connections,
            profile_views_total: profileViews,
            search_appearances_total: searchAppearances,
          }, {
            onConflict: 'user_id,analysis_date',
          })

        if (accumErr) {
          console.error(`${LOG} [Step 2] Profile accumulative upsert error for ${userId}:`, accumErr.message)
        }

        totalRowsInserted++
        usersProcessed++
        console.log(`${LOG} [Step 2] Backfilled profile analytics for user ${userId}`)
      }

      console.log(`${LOG} [Step 2] Done: ${usersProcessed} users, ${totalRowsInserted} rows`)
      return { usersProcessed, rowsInserted: totalRowsInserted }
    })

    // ─── Step 3: Backfill analytics_history ───────────────────────────────
    const historyResult = await step.run('backfill-analytics-history', async () => {
      console.log(`${LOG} [Step 3] Backfilling analytics_history from linkedin_analytics`)

      // Fetch all linkedin_analytics rows
      const { data: analyticsRows, error: fetchErr } = await db
        .from('linkedin_analytics')
        .select('user_id, captured_at, impressions, members_reached, engagements, new_followers, profile_views')
        .not('user_id', 'is', null)

      if (fetchErr || !analyticsRows?.length) {
        console.log(`${LOG} [Step 3] No linkedin_analytics data found`)
        return { rowsUpserted: 0 }
      }

      // Group by user_id + date, taking MAX across page_types
      const grouped = new Map<string, {
        user_id: string
        date: string
        impressions: number
        members_reached: number
        engagements: number
        followers: number
        profile_views: number
      }>()

      for (const row of analyticsRows) {
        const date = (row.captured_at ?? '').split('T')[0]
        if (!date) continue
        const key = `${row.user_id}:${date}`
        const existing = grouped.get(key)
        if (existing) {
          existing.impressions = Math.max(existing.impressions, row.impressions ?? 0)
          existing.members_reached = Math.max(existing.members_reached, row.members_reached ?? 0)
          existing.engagements = Math.max(existing.engagements, row.engagements ?? 0)
          existing.followers = Math.max(existing.followers, row.new_followers ?? 0)
          existing.profile_views = Math.max(existing.profile_views, row.profile_views ?? 0)
        } else {
          grouped.set(key, {
            user_id: row.user_id,
            date,
            impressions: row.impressions ?? 0,
            members_reached: row.members_reached ?? 0,
            engagements: row.engagements ?? 0,
            followers: row.new_followers ?? 0,
            profile_views: row.profile_views ?? 0,
          })
        }
      }

      // Batch upsert into analytics_history
      const rows = Array.from(grouped.values())
      let upserted = 0

      // Process in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        const { error: upsertErr } = await db
          .from('analytics_history')
          .upsert(
            batch.map(r => ({
              user_id: r.user_id,
              date: r.date,
              impressions: r.impressions,
              members_reached: r.members_reached,
              engagements: r.engagements,
              followers: r.followers,
              profile_views: r.profile_views,
            })),
            { onConflict: 'user_id,date' }
          )

        if (upsertErr) {
          console.error(`${LOG} [Step 3] analytics_history batch upsert error:`, upsertErr.message)
        } else {
          upserted += batch.length
        }
      }

      console.log(`${LOG} [Step 3] Done: ${upserted} analytics_history rows upserted`)
      return { rowsUpserted: upserted }
    })

    const totalSeeded = (postResult?.rowsInserted ?? 0) + (profileResult?.rowsInserted ?? 0)

    if (totalSeeded > 0) {
      console.log(
        `${LOG} Backfilled ${totalSeeded} rows — data is now available via RPC queries. ` +
        `Summary cache will refresh on next analytics-summary-compute cron (every 4h).`
      )
    } else {
      console.log(`${LOG} No backfill needed — all users have daily analytics data`)
    }

    return { postResult, profileResult, historyResult, totalSeeded }
  }
)
