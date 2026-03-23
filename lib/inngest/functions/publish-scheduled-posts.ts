/**
 * Publish Scheduled Posts Cron Job
 * @description Inngest cron function that runs every 2 minutes to publish
 * scheduled posts whose scheduled_for time has arrived. Fetches the user's
 * LinkedIn access token, calls the LinkedIn post API, and updates the row
 * with the result (posted / failed).
 * @module lib/inngest/functions/publish-scheduled-posts
 */

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import {
  createLinkedInClient,
  createPost,
  type LinkedInTokenData,
  type CreatePostRequest,
  type LinkedInVisibility,
} from '@/lib/linkedin'
import { isPostingEnabled } from '@/lib/linkedin/posting-config'
import { safeDecrypt, encrypt } from '@/lib/crypto'

/**
 * Supabase admin client for background jobs (bypasses RLS)
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * Shape of a scheduled_posts row relevant to publishing
 */
interface ScheduledPost {
  id: string
  user_id: string
  content: string
  visibility: LinkedInVisibility | null
  scheduled_for: string
}

/**
 * Publish Scheduled Posts Cron Function
 * Runs every 2 minutes to find and publish pending scheduled posts
 */
export const publishScheduledPosts = inngest.createFunction(
  {
    id: 'publish-scheduled-posts',
    name: 'Publish Scheduled Posts',
    retries: 1,
  },
  { cron: '*/2 * * * *' },
  async ({ step }) => {
    const supabase = getSupabaseAdmin()

    // Step 1: Fetch all pending posts whose scheduled_for has passed
    const pendingPosts = await step.run('fetch-pending-posts', async () => {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('id, user_id, content, visibility, scheduled_for')
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(50)

      if (error) {
        console.error('[PublishScheduled] Failed to fetch pending posts:', error)
        return []
      }

      console.log(`[PublishScheduled] Found ${data?.length ?? 0} posts ready to publish`)
      return (data ?? []) as ScheduledPost[]
    })

    if (pendingPosts.length === 0) {
      return { success: true, published: 0, failed: 0 }
    }

    // Check if posting is enabled globally
    const postingEnabled = isPostingEnabled()

    if (!postingEnabled) {
      console.log('[PublishScheduled] Posting is disabled globally, skipping all posts')
      return { success: true, published: 0, failed: 0, skipped: pendingPosts.length }
    }

    // Step 2: Process each post, collecting results from each step
    const results: Array<'published' | 'failed'> = []

    for (const post of pendingPosts) {
      const result = await step.run(`publish-post-${post.id}`, async () => {
        const now = () => new Date().toISOString()

        // Mark as posting
        await supabase
          .from('scheduled_posts')
          .update({ status: 'posting', updated_at: now() })
          .eq('id', post.id)

        try {
          // Fetch LinkedIn tokens for this user
          const { data: tokenData, error: tokenError } = await supabase
            .from('linkedin_tokens')
            .select('*')
            .eq('user_id', post.user_id)
            .single()

          if (tokenError || !tokenData) {
            throw new Error('LinkedIn not connected - no tokens found')
          }

          // Decrypt tokens
          const decryptedTokenData: LinkedInTokenData = {
            ...(tokenData as LinkedInTokenData),
            access_token: safeDecrypt(tokenData.access_token),
            refresh_token: tokenData.refresh_token
              ? safeDecrypt(tokenData.refresh_token)
              : null,
          } as LinkedInTokenData

          // Create LinkedIn API client with token refresh callback
          const client = createLinkedInClient(
            decryptedTokenData,
            async (newTokenData) => {
              const encryptedUpdate: Partial<LinkedInTokenData> = { ...newTokenData }
              if (newTokenData.access_token) {
                encryptedUpdate.access_token = encrypt(newTokenData.access_token)
              }
              if (newTokenData.refresh_token) {
                encryptedUpdate.refresh_token = encrypt(newTokenData.refresh_token)
              }
              await supabase
                .from('linkedin_tokens')
                .update(encryptedUpdate)
                .eq('user_id', post.user_id)
            }
          )

          // Create the post request
          const postRequest: CreatePostRequest = {
            content: post.content,
            visibility: post.visibility || 'PUBLIC',
          }

          // Post to LinkedIn
          const apiResult = await createPost(client, postRequest)

          if (!apiResult.success) {
            throw new Error(apiResult.error || 'LinkedIn API returned failure')
          }

          // Success: update status to posted
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'posted',
              linkedin_post_id: apiResult.linkedinPostUrn || null,
              activity_urn: apiResult.linkedinPostUrn || null,
              posted_at: now(),
              updated_at: now(),
            })
            .eq('id', post.id)

          // Log the post in my_posts table for tracking
          if (apiResult.linkedinPostUrn) {
            await supabase
              .from('my_posts')
              .insert({
                user_id: post.user_id,
                activity_urn: apiResult.linkedinPostUrn,
                content: post.content,
                posted_at: now(),
                source: 'scheduled',
              })
          }

          console.log(`[PublishScheduled] Post ${post.id} published successfully`)
          return 'published' as const
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error(`[PublishScheduled] Post ${post.id} failed:`, errorMessage)

          // Mark as failed with error message
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error_message: errorMessage,
              updated_at: now(),
            })
            .eq('id', post.id)

          return 'failed' as const
        }
      })
      results.push(result)
    }

    const published = results.filter(r => r === 'published').length
    const failed = results.filter(r => r === 'failed').length
    console.log(`[PublishScheduled] Done. Published: ${published}, Failed: ${failed}`)
    return { success: true, published, failed }
  }
)
