/**
 * LinkedIn Document Post API Route Handler
 * @description Handles uploading documents (PDFs) and creating document posts on LinkedIn
 * @module app/api/linkedin/post-document
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  createLinkedInClient,
  postDocument,
  type LinkedInTokenData,
  type LinkedInVisibility,
} from '@/lib/linkedin'
import { isPostingEnabled, POSTING_DISABLED_MESSAGE, DISABLED_DRAFT_STATUS } from '@/lib/linkedin/posting-config'
import { safeDecrypt, encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

/**
 * Maximum request body size for document uploads (30MB to account for base64 overhead)
 */
export const maxDuration = 60

/**
 * Request body for document posting
 */
interface DocumentPostRequestBody {
  /** Post caption text */
  content: string
  /** Post visibility */
  visibility?: LinkedInVisibility
  /** Base64-encoded PDF data */
  pdfBase64: string
  /** Display title for the document */
  documentTitle?: string
}

/**
 * POST - Create a new LinkedIn document post
 * @param request - Document post content and PDF data
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
  let body: DocumentPostRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { content, visibility = 'PUBLIC', pdfBase64, documentTitle } = body

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

  // Validate PDF data
  if (!pdfBase64 || pdfBase64.length === 0) {
    return NextResponse.json(
      { error: 'PDF data is required' },
      { status: 400 }
    )
  }

  // Decode base64 to Buffer
  let pdfBuffer: Buffer
  try {
    pdfBuffer = Buffer.from(pdfBase64, 'base64')
  } catch {
    return NextResponse.json(
      { error: 'Invalid PDF data encoding' },
      { status: 400 }
    )
  }

  // Validate decoded binary size.
  // LinkedIn's official limit is 100MB, but we cap at 25MB to keep uploads
  // fast and prevent timeouts on the serverless function (maxDuration = 60s).
  const MAX_SIZE = 25 * 1024 * 1024
  if (pdfBuffer.length > MAX_SIZE) {
    return NextResponse.json(
      { error: `Document size (${(pdfBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum of 25MB` },
      { status: 400 }
    )
  }

  // Safety gate: if posting is disabled, save as draft instead
  if (!isPostingEnabled()) {
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

  // Post document to LinkedIn
  console.log(`[PostDocument] Posting document (${(pdfBuffer.length / 1024).toFixed(0)}KB) for user ${user.id}`)
  let result
  try {
    result = await postDocument(client, {
      content,
      visibility,
      pdfBuffer,
      documentTitle,
    })
  } catch (err) {
    console.error('[PostDocument] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error posting document' },
      { status: 500 }
    )
  }

  if (!result.success) {
    console.error('[PostDocument] Failed:', result.error)
    return NextResponse.json(
      { error: result.error || 'Failed to post document to LinkedIn' },
      { status: 500 }
    )
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
    message: 'Document post published successfully',
  })
}
