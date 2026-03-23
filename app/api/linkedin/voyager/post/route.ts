/**
 * Voyager Post API Route
 * @description Handle post creation via LinkedIn's Voyager API as fallback
 * @module app/api/linkedin/voyager/post
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createVoyagerPostService, type CreatePostOptions } from '@/lib/linkedin/voyager-post'
import { z } from 'zod'
import { isPostingEnabled, POSTING_DISABLED_MESSAGE, DISABLED_DRAFT_STATUS } from '@/lib/linkedin/posting-config'

/**
 * Request body validation schema
 */
const postRequestSchema = z.object({
  content: z.string().min(1, 'Content is required').refine(
    (val) => val.length <= 3000,
    { message: 'Content too long' }
  ),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).optional().default('PUBLIC'),
  mediaUrls: z.array(z.string()).optional(),
  articleUrl: z.string().url().optional(),
  originalPostUrn: z.string().optional(),
})

/**
 * POST - Create a new LinkedIn post via Voyager API
 * @param request - Request with post content and options
 * @returns Created post details or error
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = postRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const postData = validationResult.data

    // Safety gate: if posting is disabled, save as draft instead
    if (!isPostingEnabled()) {
      const dbVisibility = (postData.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC') as 'PUBLIC' | 'CONNECTIONS'
      await supabase
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          content: postData.content,
          status: DISABLED_DRAFT_STATUS,
          visibility: dbVisibility,
          scheduled_for: new Date().toISOString(),
        })

      return NextResponse.json({
        success: false,
        draft: true,
        message: POSTING_DISABLED_MESSAGE,
      })
    }

    // Create Voyager post service
    const postService = await createVoyagerPostService(user.id)

    // Create post options
    const options: CreatePostOptions = {
      content: postData.content,
      visibility: postData.visibility,
      mediaUrls: postData.mediaUrls,
      articleUrl: postData.articleUrl,
      originalPostUrn: postData.originalPostUrn,
    }

    // Create the post
    const result = await postService.create(options)

    if (!result.success) {
      console.error('Voyager post creation failed:', result.error)

      // Map specific errors to appropriate status codes
      const statusCode = result.error?.status || 500
      const errorMessage = result.error?.message || 'Failed to create post'

      return NextResponse.json(
        {
          error: errorMessage,
          code: result.error?.code,
          retryable: result.error?.retryable,
        },
        { status: statusCode === 0 ? 500 : statusCode }
      )
    }

    // Log successful post to my_posts table
    try {
      await supabase.from('my_posts').insert({
        user_id: user.id,
        activity_urn: result.activityUrn || result.postId || '',
        content: postData.content,
        media_type: postData.mediaUrls?.length
          ? 'IMAGE'
          : postData.articleUrl
            ? 'ARTICLE'
            : 'TEXT',
        posted_at: new Date().toISOString(),
        source: 'platform',
        raw_data: {
          voyager_response: {
            postId: result.postId,
            activityUrn: result.activityUrn,
            shareUrn: result.shareUrn,
          },
          source: 'voyager_api',
        },
      })
    } catch (dbError) {
      // Log but don't fail the request if DB insert fails
      console.error('Failed to log post to database:', dbError)
    }

    return NextResponse.json({
      success: true,
      post: {
        id: result.postId,
        activityUrn: result.activityUrn,
        shareUrn: result.shareUrn,
        content: postData.content,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('Voyager post route error:', err)

    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Delete a LinkedIn post via Voyager API
 * @param request - Request with post activity URN
 * @returns Success status or error
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const activityUrn = searchParams.get('activityUrn')

  if (!activityUrn) {
    return NextResponse.json({ error: 'Activity URN is required' }, { status: 400 })
  }

  try {
    const postService = await createVoyagerPostService(user.id)
    const result = await postService.delete(activityUrn)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error?.message || 'Failed to delete post',
          code: result.error?.code,
        },
        { status: result.error?.status || 500 }
      )
    }

    // Also delete from our database
    await supabase.from('my_posts').delete().eq('activity_urn', activityUrn).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Voyager delete route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH - Edit a LinkedIn post via Voyager API
 * @param request - Request with post activity URN and new content
 * @returns Success status or error
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { activityUrn, content } = body

    if (!activityUrn || !content) {
      return NextResponse.json({ error: 'Activity URN and content are required' }, { status: 400 })
    }

    const postService = await createVoyagerPostService(user.id)
    const result = await postService.edit(activityUrn, content)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error?.message || 'Failed to edit post',
          code: result.error?.code,
        },
        { status: result.error?.status || 500 }
      )
    }

    // Update in our database
    await supabase
      .from('my_posts')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('activity_urn', activityUrn)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Voyager edit route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
