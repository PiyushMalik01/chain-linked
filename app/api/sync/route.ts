/**
 * Extension Sync API Route
 * @description Handles data sync from Chrome extension
 * @module app/api/sync
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'

/** Zod schema for validated profile fields in full_backup */
const backupProfileSchema = z.object({
  profile_urn: z.string().optional(),
  public_identifier: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  connections_count: z.number().int().nonnegative().optional(),
  followers_count: z.number().int().nonnegative().optional(),
}).strict()

/** Zod schema for validated analytics fields in full_backup */
const backupAnalyticsSchema = z.object({
  page_type: z.string(),
  impressions: z.number().int().nonnegative().optional(),
  members_reached: z.number().int().nonnegative().optional(),
  engagements: z.number().int().nonnegative().optional(),
  new_followers: z.number().int().nonnegative().optional(),
  profile_views: z.number().int().nonnegative().optional(),
  search_appearances: z.number().int().nonnegative().optional(),
  top_posts: z.array(z.any()).optional(),
}).strict()

/** Zod schema for validated audience fields in full_backup */
const backupAudienceSchema = z.object({
  total_followers: z.number().int().nonnegative().optional(),
  follower_growth: z.number().optional(),
  top_job_titles: z.array(z.any()).optional(),
  top_companies: z.array(z.any()).optional(),
  top_locations: z.array(z.any()).optional(),
  top_industries: z.array(z.any()).optional(),
}).strict()

/** Zod schema for validated settings fields in full_backup */
const backupSettingsSchema = z.object({
  auto_sync: z.boolean().optional(),
  sync_interval_minutes: z.number().int().positive().optional(),
  capture_enabled: z.boolean().optional(),
  notification_enabled: z.boolean().optional(),
}).strict()

/**
 * POST sync data from extension
 * @param request - Data from extension to sync
 * @returns Sync result
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'Type and data are required' }, { status: 400 })
    }

    const results: Record<string, unknown> = {}

    switch (type) {
      case 'profile': {
        const { error } = await supabase
          .from('linkedin_profiles')
          .upsert({
            user_id: user.id,
            profile_urn: data.profile_urn || data.memberUrn,
            public_identifier: data.public_identifier || data.publicIdentifier,
            first_name: data.first_name || data.firstName,
            last_name: data.last_name || data.lastName,
            headline: data.headline,
            location: data.location,
            profile_picture_url: data.profile_picture_url || data.profilePhoto,
            connections_count: data.connections_count || data.connectionCount,
            followers_count: data.followers_count || data.followerCount,
            raw_data: data,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          })

        results.profile = { success: !error, error: error?.message }
        break
      }

      case 'analytics': {
        const { error } = await supabase
          .from('linkedin_analytics')
          .insert({
            user_id: user.id,
            page_type: data.page_type || 'creator_analytics',
            impressions: data.impressions || 0,
            members_reached: data.members_reached || data.membersReached || 0,
            engagements: data.engagements || 0,
            new_followers: data.new_followers || 0,
            profile_views: data.profile_views || 0,
            search_appearances: data.search_appearances || 0,
            top_posts: data.top_posts || data.topPosts || [],
            raw_data: data,
          })

        results.analytics = { success: !error, error: error?.message }

        // Also update history
        const today = new Date().toISOString().split('T')[0]
        await supabase
          .from('analytics_history')
          .upsert({
            user_id: user.id,
            date: today,
            impressions: data.impressions || 0,
            members_reached: data.members_reached || data.membersReached || 0,
            engagements: data.engagements || 0,
            followers: data.followers_count || data.followerCount || 0,
            profile_views: data.profile_views || 0,
          }, {
            onConflict: 'user_id,date',
          })
        break
      }

      case 'audience': {
        const { error } = await supabase
          .from('audience_data')
          .upsert({
            user_id: user.id,
            total_followers: data.total_followers || data.totalFollowers || 0,
            follower_growth: data.follower_growth || data.growthRate || 0,
            top_job_titles: data.top_job_titles || data.demographics?.titles || [],
            top_companies: data.top_companies || data.demographics?.companies || [],
            top_locations: data.top_locations || data.demographics?.locations || [],
            top_industries: data.top_industries || data.demographics?.industries || [],
            raw_data: data,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          })

        results.audience = { success: !error, error: error?.message }
        break
      }

      case 'posts': {
        if (Array.isArray(data)) {
          const postsToInsert = data.map(post => ({
            user_id: user.id,
            activity_urn: post.activity_urn || post.postUrn,
            content: post.content,
            media_type: post.media_type,
            reactions: post.reactions || 0,
            comments: post.comments || 0,
            reposts: post.reposts || post.shares || 0,
            impressions: post.impressions || 0,
            saves: post.saves || post.saveCount || 0,
            sends: post.sends || post.shareCount || 0,
            unique_views: post.unique_views || post.uniqueViews || 0,
            posted_at: post.posted_at || post.postedAt,
            raw_data: post,
          }))

          const { error } = await supabase
            .from('my_posts')
            .upsert(postsToInsert, {
              onConflict: 'user_id,activity_urn',
            })

          results.posts = { success: !error, count: postsToInsert.length, error: error?.message }
        }
        break
      }

      case 'full_backup': {
        // Handle full backup with multiple data types, collecting errors
        // Validate each sub-object with Zod to prevent spreading raw user input
        const { profile, analytics, audience, settings } = data
        const backupErrors: string[] = []

        if (profile) {
          const parsed = backupProfileSchema.safeParse(profile)
          if (!parsed.success) {
            backupErrors.push(`profile: invalid data - ${parsed.error.message}`)
          } else {
            const { error } = await supabase
              .from('linkedin_profiles')
              .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            if (error) backupErrors.push(`profile: ${error.message}`)
          }
        }

        if (analytics) {
          const parsed = backupAnalyticsSchema.safeParse(analytics)
          if (!parsed.success) {
            backupErrors.push(`analytics: invalid data - ${parsed.error.message}`)
          } else {
            const { error } = await supabase.from('linkedin_analytics').insert({ user_id: user.id, ...parsed.data })
            if (error) backupErrors.push(`analytics: ${error.message}`)
          }
        }

        if (audience) {
          const parsed = backupAudienceSchema.safeParse(audience)
          if (!parsed.success) {
            backupErrors.push(`audience: invalid data - ${parsed.error.message}`)
          } else {
            const { error } = await supabase
              .from('audience_data')
              .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            if (error) backupErrors.push(`audience: ${error.message}`)
          }
        }

        if (settings) {
          const parsed = backupSettingsSchema.safeParse(settings)
          if (!parsed.success) {
            backupErrors.push(`settings: invalid data - ${parsed.error.message}`)
          } else {
            const { error } = await supabase
              .from('extension_settings')
              .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            if (error) backupErrors.push(`settings: ${error.message}`)
          }
        }

        results.backup = {
          success: backupErrors.length === 0,
          errors: backupErrors.length > 0 ? backupErrors : undefined,
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown sync type: ${type}` }, { status: 400 })
    }

    // Check if this is the user's very first sync (no prior sync_metadata records)
    // If so, trigger immediate analytics backfill via inngest
    const { data: existingMetadata } = await supabase
      .from('sync_metadata')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const isFirstSync = !existingMetadata || existingMetadata.length === 0

    // Update sync metadata
    await supabase
      .from('sync_metadata')
      .upsert({
        user_id: user.id,
        table_name: type,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        pending_changes: 0,
      }, {
        onConflict: 'user_id,table_name',
      })

    // Trigger immediate backfill for first-time users so dashboard shows data instantly
    if (isFirstSync) {
      try {
        await inngest.send({
          name: 'sync/first-data',
          data: {
            userId: user.id,
            dataType: type,
          },
        })
        console.log(`[Sync] First sync detected for user ${user.id} — triggered immediate backfill`)
      } catch (err) {
        // Non-fatal: backfill cron will catch up within 5 minutes
        console.error('[Sync] Failed to send first-sync inngest event:', err)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

/**
 * GET sync status
 * @returns Last sync timestamps for each data type
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: metadata, error } = await supabase
    .from('sync_metadata')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error('Sync status error:', error)
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
  }

  return NextResponse.json({ metadata })
}
