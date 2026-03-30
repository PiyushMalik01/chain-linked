/**
 * Influencers API Route
 * @description Handles followed influencer CRUD operations for the Inspiration section.
 * All operations require authentication.
 * @module app/api/influencers
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'

/**
 * Extracts the LinkedIn username from a profile URL.
 * @param url - LinkedIn profile URL
 * @returns Extracted username or null
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * GET /api/influencers
 * @description Returns the authenticated user's followed influencers list.
 * @returns Array of followed influencer records
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: influencers, error } = await (supabase as any)
    .from('followed_influencers')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Influencers fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch influencers' }, { status: 500 })
  }

  return NextResponse.json({ influencers })
}

/**
 * POST /api/influencers
 * @description Follow a new LinkedIn influencer. Validates the URL, extracts username,
 * and upserts the record (prevents duplicates per user).
 * @param request - Body: { linkedin_url, author_name?, author_headline?, author_profile_picture? }
 * @returns Created or updated influencer record
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { linkedin_url, author_name, author_headline, author_profile_picture } = body as {
    linkedin_url?: string
    author_name?: string | null
    author_headline?: string | null
    author_profile_picture?: string | null
  }

  if (!linkedin_url || typeof linkedin_url !== 'string') {
    return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 })
  }

  if (!linkedin_url.includes('linkedin.com/in/')) {
    return NextResponse.json(
      { error: 'Invalid LinkedIn URL. Must contain linkedin.com/in/' },
      { status: 400 }
    )
  }

  // Normalize and strictly validate LinkedIn URL format
  // Strip query params and hash fragments before validation
  const cleanUrl = linkedin_url.trim().split('?')[0].split('#')[0]
  const normalizedUrl = cleanUrl.replace(/\/+$/, '').toLowerCase()
    .replace(/^https?:\/\/(www\.)?linkedin\.com/, 'https://www.linkedin.com')
  const linkedInUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+$/
  if (!linkedInUrlPattern.test(normalizedUrl)) {
    return NextResponse.json(
      { error: 'Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username' },
      { status: 400 }
    )
  }

  const linkedin_username = extractLinkedInUsername(normalizedUrl)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: influencer, error: upsertError } = await (supabase as any)
    .from('followed_influencers')
    .upsert(
      {
        user_id: user.id,
        linkedin_url: normalizedUrl,
        linkedin_username,
        author_name: author_name ?? null,
        author_headline: author_headline ?? null,
        author_profile_picture: author_profile_picture ?? null,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,linkedin_url',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (upsertError) {
    console.error('Influencer upsert error:', upsertError)
    return NextResponse.json({ error: 'Failed to follow influencer' }, { status: 500 })
  }

  // Trigger immediate scrape for the new influencer
  await inngest.send({
    name: 'influencer/follow',
    data: {
      userId: user.id,
      linkedinUrl: normalizedUrl,
      linkedinUsername: linkedin_username,
    },
  }).catch((err) => {
    console.error('Failed to trigger influencer scrape:', err)
  })

  return NextResponse.json({ influencer }, { status: 201 })
}

/**
 * DELETE /api/influencers
 * @description Unfollow an influencer by record ID. Ensures the record belongs
 * to the authenticated user before deletion.
 * @param request - Body: { id }
 * @returns Success response
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id } = body as { id?: string }

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from('followed_influencers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // Ensures ownership

  if (deleteError) {
    console.error('Influencer delete error:', deleteError)
    return NextResponse.json({ error: 'Failed to unfollow influencer' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * PATCH /api/influencers
 * @description Triggers an on-demand scrape for a specific influencer.
 * Verifies the influencer belongs to the authenticated user before triggering.
 * @param request - Body: { influencer_id }
 * @returns Success response with confirmation message
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { influencer_id } = body as { influencer_id?: string }

  if (!influencer_id || typeof influencer_id !== 'string') {
    return NextResponse.json({ error: 'influencer_id is required' }, { status: 400 })
  }

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: influencer, error: fetchError } = await (supabase as any)
    .from('followed_influencers')
    .select('id, linkedin_url, linkedin_username')
    .eq('id', influencer_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !influencer) {
    return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
  }

  // Trigger scrape via Inngest
  await inngest.send({
    name: 'influencer/follow',
    data: {
      userId: user.id,
      linkedinUrl: influencer.linkedin_url,
      linkedinUsername: influencer.linkedin_username,
    },
  }).catch((err) => {
    console.error('Failed to trigger influencer scrape:', err)
  })

  return NextResponse.json({ success: true, message: 'Scrape triggered' })
}
