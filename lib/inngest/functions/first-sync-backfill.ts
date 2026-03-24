/**
 * First Sync Backfill Function (Inngest Event-Triggered)
 * @description Triggered when the extension syncs data for a user for the very first time.
 * Seeds post and profile analytics tables immediately so the dashboard shows data
 * without waiting for the 5-minute cron backfill.
 *
 * This is a targeted, single-user version of analytics-backfill.ts.
 *
 * @module lib/inngest/functions/first-sync-backfill
 */

import { inngest } from '../client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Log prefix */
const LOG = '[FirstSyncBackfill]'

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
 * First sync backfill — event-triggered, single-user scope
 * Seeds analytics tables so the dashboard has data immediately after extension install
 */
export const firstSyncBackfill = inngest.createFunction(
  {
    id: 'first-sync-backfill',
    name: 'First Sync Backfill (instant)',
    retries: 2,
    concurrency: [{ limit: 5 }],
  },
  { event: 'sync/first-data' },
  async ({ event, step }) => {
    const { userId } = event.data
    const db = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    console.log(`${LOG} Starting first-sync backfill for user ${userId}`)

    // ─── Step 1: Backfill Post Analytics for this user ─────────────────
    const postResult = await step.run('backfill-user-post-analytics', async () => {
      const { data: posts, error: postsErr } = await db
        .from('my_posts')
        .select('id, user_id, activity_urn, posted_at, created_at, impressions, reactions, comments, reposts, saves, sends')
        .eq('user_id', userId)

      if (postsErr || !posts?.length) {
        console.log(`${LOG} No posts found for user`)
        return { rowsInserted: 0 }
      }

      // Check which posts already have accumulative rows
      const postIds = posts.map(p => p.id)
      const { data: existingAccum } = await db
        .from('post_analytics_accumulative')
        .select('post_id')
        .in('post_id', postIds)

      const existingPostIds = new Set((existingAccum || []).map(r => r.post_id))
      const newPosts = posts.filter(p => !existingPostIds.has(p.id))

      if (newPosts.length === 0) {
        console.log(`${LOG} All posts already have accumulative data`)
        return { rowsInserted: 0 }
      }

      // Get post_analytics for richer metrics
      const activityUrns = newPosts.map(p => p.activity_urn).filter(Boolean)
      let postAnalytics: Array<{
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
      }> = []

      if (activityUrns.length > 0) {
        const { data } = await db
          .from('post_analytics')
          .select('activity_urn, impressions, unique_views, members_reached, reactions, comments, reposts, saves, sends, engagement_rate')
          .in('activity_urn', activityUrns)
          .order('captured_at', { ascending: false })
        postAnalytics = data || []
      }

      // Build map of latest post_analytics per activity_urn
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

      let rowsInserted = 0

      for (const post of newPosts) {
        const pa = paMap.get(post.activity_urn)
        const impressions = pa?.impressions ?? post.impressions ?? 0
        const uniqueReach = pa?.uniqueReach ?? 0
        const reactions = pa?.reactions ?? post.reactions ?? 0
        const comments = pa?.comments ?? post.comments ?? 0
        const reposts = pa?.reposts ?? post.reposts ?? 0
        const saves = pa?.saves ?? post.saves ?? 0
        const sends = pa?.sends ?? post.sends ?? 0

        if (impressions === 0 && reactions === 0 && comments === 0) continue

        const engagements = reactions + comments + reposts + saves + sends
        let engagementsRate: number | null = null
        if (pa?.engagementRate != null && pa.engagementRate > 0) {
          engagementsRate = pa.engagementRate
        } else if (impressions > 0) {
          engagementsRate = (engagements / impressions) * 100
        }

        // Use TODAY as analysis date — when tracking starts, not when post was created.
        const analysisDate = today
        const postCreatedAt = post.posted_at
          ? new Date(post.posted_at).toISOString().split('T')[0]
          : post.created_at
            ? new Date(post.created_at).toISOString().split('T')[0]
            : today

        // Seed daily row with actual totals as "gained" on day 1.
        // For new users, their existing metrics ARE their baseline.
        await db.from('post_analytics_daily').upsert({
          user_id: userId,
          post_id: post.id,
          analysis_date: analysisDate,
          impressions_gained: impressions,
          unique_reach_gained: uniqueReach,
          reactions_gained: reactions,
          comments_gained: comments,
          reposts_gained: reposts,
          saves_gained: saves,
          sends_gained: sends,
          engagements_gained: engagements,
          engagements_rate: engagementsRate,
          analytics_tracking_status_id: 1,
        }, { onConflict: 'user_id,post_id,analysis_date' })

        // Seed accumulative row
        await db.from('post_analytics_accumulative').upsert({
          user_id: userId,
          post_id: post.id,
          analysis_date: analysisDate,
          post_created_at: postCreatedAt,
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
        }, { onConflict: 'user_id,post_id' })

        rowsInserted++
      }

      console.log(`${LOG} Backfilled ${rowsInserted} post analytics rows`)
      return { rowsInserted }
    })

    // ─── Step 2: Backfill Profile Analytics for this user ──────────────
    const profileResult = await step.run('backfill-user-profile-analytics', async () => {
      // Check if user already has accumulative data
      const { data: existingAccum } = await db
        .from('profile_analytics_accumulative')
        .select('user_id')
        .eq('user_id', userId)
        .limit(1)

      if (existingAccum && existingAccum.length > 0) {
        console.log(`${LOG} Profile already has accumulative data`)
        return { rowsInserted: 0 }
      }

      const { data: profile } = await db
        .from('linkedin_profiles')
        .select('followers_count, connections_count')
        .eq('user_id', userId)
        .single()

      if (!profile) {
        console.log(`${LOG} No LinkedIn profile found for user`)
        return { rowsInserted: 0 }
      }

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

      if (followers === 0 && profileViews === 0 && connections === 0) {
        console.log(`${LOG} No profile metrics to backfill`)
        return { rowsInserted: 0 }
      }

      await db.from('profile_analytics_daily').upsert({
        user_id: userId,
        analysis_date: today,
        followers_gained: 0,
        connections_gained: 0,
        profile_views_gained: 0,
        search_appearances_gained: 0,
      }, { onConflict: 'user_id,analysis_date' })

      await db.from('profile_analytics_accumulative').upsert({
        user_id: userId,
        analysis_date: today,
        followers_total: followers,
        connections_total: connections,
        profile_views_total: profileViews,
        search_appearances_total: searchAppearances,
      }, { onConflict: 'user_id,analysis_date' })

      console.log(`${LOG} Backfilled profile analytics`)
      return { rowsInserted: 1 }
    })

    // ─── Step 3: Backfill analytics_history for this user ──────────────
    const historyResult = await step.run('backfill-user-analytics-history', async () => {
      const { data: analyticsRows } = await db
        .from('linkedin_analytics')
        .select('captured_at, impressions, members_reached, engagements, new_followers, profile_views')
        .eq('user_id', userId)

      if (!analyticsRows?.length) {
        return { rowsUpserted: 0 }
      }

      // Group by date, taking MAX
      const grouped = new Map<string, {
        impressions: number
        members_reached: number
        engagements: number
        followers: number
        profile_views: number
      }>()

      for (const row of analyticsRows) {
        const date = (row.captured_at ?? '').split('T')[0]
        if (!date) continue
        const existing = grouped.get(date)
        if (existing) {
          existing.impressions = Math.max(existing.impressions, row.impressions ?? 0)
          existing.members_reached = Math.max(existing.members_reached, row.members_reached ?? 0)
          existing.engagements = Math.max(existing.engagements, row.engagements ?? 0)
          existing.followers = Math.max(existing.followers, row.new_followers ?? 0)
          existing.profile_views = Math.max(existing.profile_views, row.profile_views ?? 0)
        } else {
          grouped.set(date, {
            impressions: row.impressions ?? 0,
            members_reached: row.members_reached ?? 0,
            engagements: row.engagements ?? 0,
            followers: row.new_followers ?? 0,
            profile_views: row.profile_views ?? 0,
          })
        }
      }

      const rows = Array.from(grouped.entries()).map(([date, data]) => ({
        user_id: userId,
        date,
        ...data,
      }))

      const { error } = await db
        .from('analytics_history')
        .upsert(rows, { onConflict: 'user_id,date' })

      if (error) {
        console.error(`${LOG} analytics_history upsert error:`, error.message)
        return { rowsUpserted: 0 }
      }

      console.log(`${LOG} Backfilled ${rows.length} analytics_history rows`)
      return { rowsUpserted: rows.length }
    })

    const totalSeeded = (postResult?.rowsInserted ?? 0) + (profileResult?.rowsInserted ?? 0)
    console.log(`${LOG} Completed first-sync backfill for user ${userId}: ${totalSeeded} analytics rows, ${historyResult?.rowsUpserted ?? 0} history rows`)

    return { postResult, profileResult, historyResult, totalSeeded }
  }
)
