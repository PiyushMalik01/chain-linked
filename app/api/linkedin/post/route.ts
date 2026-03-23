/**
 * LinkedIn Post API Route Handler
 * @description Handles creating posts on LinkedIn
 * @module app/api/linkedin/post
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  createLinkedInClient,
  createPost,
  uploadImageFromBuffer,
  type LinkedInTokenData,
  type CreatePostRequest,
  type LinkedInVisibility,
} from '@/lib/linkedin'
import { isPostingEnabled, POSTING_DISABLED_MESSAGE, DISABLED_DRAFT_STATUS } from '@/lib/linkedin/posting-config'
import { safeDecrypt, encrypt } from '@/lib/crypto'

/**
 * Base64-encoded media item from client-side file upload
 */
interface MediaBase64Item {
  /** Base64-encoded image data */
  data: string
  /** MIME type (e.g., 'image/jpeg', 'image/png') */
  contentType: string
}

/**
 * Request body for posting to LinkedIn
 */
interface PostRequestBody {
  content: string
  visibility?: LinkedInVisibility
  mediaUrls?: string[]
  /** Base64-encoded images from client-side file uploads */
  mediaBase64?: MediaBase64Item[]
  scheduledPostId?: string
}

/**
 * POST - Create a new LinkedIn post
 * @param request - Post content and options
 * @returns Post result with LinkedIn post URN
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please log in to post to LinkedIn' },
      { status: 401 }
    )
  }

  // Parse request body
  let body: PostRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { content, visibility = 'PUBLIC', mediaUrls, mediaBase64, scheduledPostId } = body

  // Validate content
  if (!content || content.trim().length === 0) {
    return NextResponse.json(
      { error: 'Content is required' },
      { status: 400 }
    )
  }

  if (content.length > 3000) {
    return NextResponse.json(
      { error: 'Content exceeds maximum length of 3000 characters' },
      { status: 400 }
    )
  }

  // Safety gate: if posting is disabled, save as draft instead
  if (!isPostingEnabled()) {
    // Save to scheduled_posts as a draft
    await supabase
      .from('scheduled_posts')
      .insert({
        user_id: user.id,
        content,
        status: DISABLED_DRAFT_STATUS,
        visibility: visibility || 'PUBLIC',
        scheduled_for: new Date().toISOString(),
      })

    return NextResponse.json({
      success: false,
      draft: true,
      message: POSTING_DISABLED_MESSAGE,
    })
  }

  // Get LinkedIn tokens for user
  const { data: tokenData, error: tokenError } = await supabase
    .from('linkedin_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenData) {
    return NextResponse.json(
      {
        error: 'LinkedIn not connected',
        message: 'Please connect your LinkedIn account in settings',
      },
      { status: 403 }
    )
  }

  // Decrypt tokens before creating API client (safeDecrypt falls back to
  // plaintext for tokens stored before encryption was added)
  const decryptedTokenData: LinkedInTokenData = {
    ...(tokenData as LinkedInTokenData),
    access_token: safeDecrypt(tokenData.access_token),
    refresh_token: tokenData.refresh_token ? safeDecrypt(tokenData.refresh_token) : null,
  } as LinkedInTokenData

  // Create LinkedIn API client with token refresh callback
  const client = createLinkedInClient(
    decryptedTokenData,
    async (newTokenData) => {
      // Re-encrypt tokens before storing back to DB
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
        .eq('user_id', user.id)
    }
  )

  // If base64 images are provided, upload them to LinkedIn and collect asset URNs
  let uploadedAssets: string[] = []

  if (mediaBase64 && mediaBase64.length > 0) {
    try {
      uploadedAssets = await Promise.all(
        mediaBase64.map(async (item) => {
          const buffer = Buffer.from(item.data, 'base64')
          return uploadImageFromBuffer(
            client,
            buffer,
            item.contentType || 'image/jpeg'
          )
        })
      )
    } catch (uploadError) {
      console.error('Failed to upload images to LinkedIn:', uploadError)
      return NextResponse.json(
        { error: uploadError instanceof Error ? uploadError.message : 'Failed to upload images' },
        { status: 500 }
      )
    }
  }

  // Create the post request
  const postRequest: CreatePostRequest = {
    content,
    visibility,
    mediaUrls,
    mediaAssets: uploadedAssets.length > 0 ? uploadedAssets : undefined,
  }

  // Post to LinkedIn
  const result = await createPost(client, postRequest)

  if (!result.success) {
    // If posting fails, update scheduled post status if applicable
    if (scheduledPostId) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduledPostId)
        .eq('user_id', user.id)
    }

    return NextResponse.json(
      { error: result.error || 'Failed to post to LinkedIn' },
      { status: 500 }
    )
  }

  // Update scheduled post if this was a scheduled post
  if (scheduledPostId) {
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'posted',
        linkedin_post_id: result.linkedinPostUrn,
        activity_urn: result.linkedinPostUrn,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledPostId)
      .eq('user_id', user.id)
  }

  // Log the post in my_posts table for tracking
  if (result.linkedinPostUrn) {
    await supabase
      .from('my_posts')
      .insert({
        user_id: user.id,
        activity_urn: result.linkedinPostUrn,
        content,
        posted_at: new Date().toISOString(),
        source: 'platform',
      })
  }

  return NextResponse.json({
    success: true,
    postId: result.postId,
    linkedinPostUrn: result.linkedinPostUrn,
    message: 'Post published successfully',
  })
}
