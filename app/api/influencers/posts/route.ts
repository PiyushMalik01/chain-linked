/**
 * Influencer Posts API Route
 * @description Returns approved posts from followed influencers for the current user.
 * Used by the Inspiration feed's "Following" filter.
 * @module app/api/influencers/posts
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Default page size */
const DEFAULT_LIMIT = 24

/**
 * GET /api/influencers/posts
 * @description Returns influencer_posts for the authenticated user where quality_status='approved',
 * joined with followed_influencers for author info, ordered by posted_at DESC.
 * @param request - Query params: page (default 0), limit (default 24)
 * @returns { posts: Array, totalCount: number }
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
  const influencerId = searchParams.get('influencer_id') || ''
  const cluster = searchParams.get('cluster') || ''
  const search = searchParams.get('search') || ''
  const offset = page * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('influencer_posts')
    .select(`
      id,
      content,
      post_type,
      likes_count,
      comments_count,
      reposts_count,
      posted_at,
      quality_score,
      linkedin_url,
      influencer_id,
      tags,
      primary_cluster,
      followed_influencers!inner (
        author_name,
        author_headline,
        author_profile_picture,
        linkedin_url,
        linkedin_username
      )
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .eq('quality_status', 'approved')

  // Filter by specific influencer if provided
  if (influencerId) {
    query = query.eq('influencer_id', influencerId)
  }

  // Filter by primary cluster if provided
  if (cluster) {
    query = query.eq('primary_cluster', cluster)
  }

  // Filter by content search if provided
  if (search) {
    const sanitized = search.replace(/[%_\\.,()'"]/g, '').trim().slice(0, 100)
    if (sanitized.length > 0) {
      query = query.ilike('content', `%${sanitized}%`)
    }
  }

  const { data: posts, error, count } = await query
    .order('posted_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    // PGRST116 = no rows found (common for newly followed influencers with no scraped posts yet)
    if (error.code === 'PGRST116' || error.message?.includes('no rows')) {
      return NextResponse.json({ posts: [], totalCount: 0 })
    }
    console.error('Influencer posts fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch influencer posts' }, { status: 500 })
  }

  return NextResponse.json({
    posts: posts || [],
    totalCount: count || 0,
  })
}
