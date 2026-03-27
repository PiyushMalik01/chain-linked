/**
 * Daily Snapshot Pipeline (Inngest Cron — every 5 minutes)
 * @description Reads latest absolute values from LinkedIn source tables and upserts
 * today's rows into daily_account_snapshots and daily_post_snapshots.
 * Same-day runs UPDATE the existing row via UNIQUE(user_id, date) constraint.
 * New day = new row inserted automatically.
 *
 * Pipeline steps:
 *   1. Fetch all users with LinkedIn data
 *   2. Upsert daily_account_snapshots (aggregated across all posts + profile data)
 *   3. Upsert daily_post_snapshots (per post)
 *
 * @module lib/inngest/functions/daily-snapshot-pipeline
 */

import { inngest } from '../client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Log prefix for all pipeline output */
const LOG_PREFIX = '[DailySnapshotPipeline]'

/** Max IDs per .in() query to stay under Supabase URL length limits */
const BATCH_SIZE = 100

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
 * Represents a row from the my_posts source table
 */
interface MyPost {
  user_id: string
  activity_urn: string
  impressions: number | null
  reactions: number | null
  comments: number | null
  reposts: number | null
  saves: number | null
  sends: number | null
  media_type: string | null
  posted_at: string | null
}

/**
 * Represents a row from the linkedin_profiles source table
 */
interface LinkedInProfile {
  user_id: string
  followers_count: number | null
  connections_count: number | null
}

/**
 * Represents a row from the linkedin_analytics source table
 */
interface LinkedInAnalytics {
  user_id: string
  profile_views: number | null
  search_appearances: number | null
  updated_at: string
}

/**
 * Daily Snapshot Pipeline — runs every 5 minutes.
 * Reads absolute values from source tables and upserts today's snapshot rows.
 *
 * @example
 * // Triggered automatically by Inngest cron schedule
 * // Can also be triggered manually via Inngest dashboard
 */
export const dailySnapshotPipeline = inngest.createFunction(
  {
    id: 'daily-snapshot-pipeline',
    name: 'Daily Snapshot Pipeline (5min)',
    retries: 2,
    concurrency: [{ limit: 1 }],
  },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const supabase = getSupabaseAdmin()

    /** Today's date string for the snapshot row */
    const today = new Date().toISOString().split('T')[0]

    console.log(`${LOG_PREFIX} Starting snapshot pipeline for date=${today}`)

    // ── Step 1: Fetch all users that have LinkedIn post data ──────────
    const userIds = await step.run('fetch-users-with-data', async () => {
      const { data, error } = await supabase
        .from('my_posts')
        .select('user_id')

      if (error) {
        console.error(`${LOG_PREFIX} Error fetching users from my_posts:`, error.message)
        return []
      }

      // Deduplicate user IDs
      const uniqueIds = [...new Set((data ?? []).map((row: { user_id: string }) => row.user_id))]
      console.log(`${LOG_PREFIX} Found ${uniqueIds.length} users with LinkedIn data`)
      return uniqueIds
    })

    if (userIds.length === 0) {
      console.log(`${LOG_PREFIX} No users with data — skipping`)
      return { accountSnapshots: 0, postSnapshots: 0 }
    }

    // ── Step 2: Upsert daily_account_snapshots ───────────────────────
    const accountSnapshots = await step.run('upsert-account-snapshots', async () => {
      let processed = 0

      // Fetch all posts for all users (batched)
      const allPosts = await batchSelect<MyPost>(
        supabase,
        'my_posts',
        'user_id',
        userIds,
        'user_id, activity_urn, impressions, reactions, comments, reposts, saves, sends'
      )

      // Fetch profile data for all users (batched)
      const allProfiles = await batchSelect<LinkedInProfile>(
        supabase,
        'linkedin_profiles',
        'user_id',
        userIds,
        'user_id, followers_count, connections_count'
      )

      // Fetch latest analytics row per user
      // We need the most recent row per user, so fetch all and deduplicate
      const allAnalytics = await batchSelect<LinkedInAnalytics>(
        supabase,
        'linkedin_analytics',
        'user_id',
        userIds,
        'user_id, profile_views, search_appearances, updated_at',
        { column: 'updated_at', ascending: false }
      )

      // Group data by user_id
      const postsByUser = groupBy(allPosts, 'user_id')
      const profileByUser = new Map<string, LinkedInProfile>()
      for (const profile of allProfiles) {
        profileByUser.set(profile.user_id, profile)
      }
      // Keep only the latest analytics row per user (already sorted desc by updated_at)
      const analyticsByUser = new Map<string, LinkedInAnalytics>()
      for (const row of allAnalytics) {
        if (!analyticsByUser.has(row.user_id)) {
          analyticsByUser.set(row.user_id, row)
        }
      }

      // Build upsert rows
      const rows = userIds.map((userId) => {
        const posts = postsByUser.get(userId) ?? []
        const profile = profileByUser.get(userId)
        const analytics = analyticsByUser.get(userId)

        const totalImpressions = sumField(posts, 'impressions')
        const totalReactions = sumField(posts, 'reactions')
        const totalComments = sumField(posts, 'comments')
        const totalReposts = sumField(posts, 'reposts')
        const totalSaves = sumField(posts, 'saves')
        const totalSends = sumField(posts, 'sends')
        const totalEngagements =
          totalReactions + totalComments + totalReposts + totalSaves + totalSends

        return {
          user_id: userId,
          date: today,
          total_impressions: totalImpressions,
          total_reactions: totalReactions,
          total_comments: totalComments,
          total_reposts: totalReposts,
          total_saves: totalSaves,
          total_sends: totalSends,
          total_engagements: totalEngagements,
          followers: profile?.followers_count ?? 0,
          connections: profile?.connections_count ?? 0,
          profile_views: analytics?.profile_views ?? 0,
          search_appearances: analytics?.search_appearances ?? 0,
          post_count: posts.length,
          updated_at: new Date().toISOString(),
        }
      })

      // Upsert in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('daily_account_snapshots')
          .upsert(batch, { onConflict: 'user_id,date' })

        if (error) {
          console.error(
            `${LOG_PREFIX} Error upserting daily_account_snapshots batch ${i}:`,
            error.message
          )
        } else {
          processed += batch.length
        }
      }

      console.log(`${LOG_PREFIX} Upserted ${processed} account snapshot rows`)
      return processed
    })

    // ── Step 3: Upsert daily_post_snapshots ──────────────────────────
    const postSnapshots = await step.run('upsert-post-snapshots', async () => {
      let processed = 0

      // Fetch all posts with full detail
      const allPosts = await batchSelect<MyPost>(
        supabase,
        'my_posts',
        'user_id',
        userIds,
        'user_id, activity_urn, impressions, reactions, comments, reposts, saves, sends, media_type, posted_at'
      )

      if (allPosts.length === 0) {
        console.log(`${LOG_PREFIX} No posts found — skipping post snapshots`)
        return 0
      }

      // Build upsert rows
      const rows = allPosts.map((post) => {
        const impressions = post.impressions ?? 0
        const reactions = post.reactions ?? 0
        const comments = post.comments ?? 0
        const reposts = post.reposts ?? 0
        const saves = post.saves ?? 0
        const sends = post.sends ?? 0
        const engagements = reactions + comments + reposts + saves + sends

        return {
          user_id: post.user_id,
          activity_urn: post.activity_urn,
          date: today,
          impressions,
          reactions,
          comments,
          reposts,
          saves,
          sends,
          engagements,
          media_type: post.media_type,
          posted_at: post.posted_at,
          updated_at: new Date().toISOString(),
        }
      })

      // Upsert in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('daily_post_snapshots')
          .upsert(batch, { onConflict: 'user_id,activity_urn,date' })

        if (error) {
          console.error(
            `${LOG_PREFIX} Error upserting daily_post_snapshots batch ${i}:`,
            error.message
          )
        } else {
          processed += batch.length
        }
      }

      console.log(`${LOG_PREFIX} Upserted ${processed} post snapshot rows`)
      return processed
    })

    console.log(
      `${LOG_PREFIX} Pipeline complete: ${accountSnapshots} account snapshots, ${postSnapshots} post snapshots`
    )

    return { accountSnapshots, postSnapshots }
  }
)

// ── Helper Functions ─────────────────────────────────────────────────────

/**
 * Executes a Supabase select query in batches using .in() to avoid URL length limits.
 * @param db - Supabase client
 * @param table - Table name to query
 * @param column - Column name for the .in() filter
 * @param values - Array of values to filter by
 * @param select - Columns to select
 * @param orderBy - Optional ordering config
 * @returns Merged array of all results
 */
async function batchSelect<T = Record<string, unknown>>(
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
      console.error(`${LOG_PREFIX} batchSelect error on ${table}.${column}:`, error.message)
    }
    if (data) results.push(...(data as T[]))
  }
  return results
}

/**
 * Groups an array of objects by a string key field
 * @param items - Array of objects
 * @param key - Key to group by
 * @returns Map of key to array of items
 */
function groupBy<T>(
  items: T[],
  key: keyof T & string
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = String(item[key])
    const arr = map.get(k) ?? []
    arr.push(item)
    map.set(k, arr)
  }
  return map
}

/**
 * Sums a numeric field across an array of objects, treating null/undefined as 0
 * @param items - Array of objects
 * @param field - Field name to sum
 * @returns Sum of the field values
 */
function sumField<T>(items: T[], field: keyof T & string): number {
  return items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0)
}
