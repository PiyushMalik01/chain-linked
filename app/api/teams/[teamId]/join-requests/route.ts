/**
 * Team Join Requests Management API Route
 * @description Admin endpoint to list and approve/reject join requests for a team
 * @module app/api/teams/[teamId]/join-requests
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Route context type
 */
interface RouteContext {
  params: Promise<{ teamId: string }>
}

/**
 * GET /api/teams/[teamId]/join-requests
 * @description List pending join requests for a team (admin/owner only)
 * @returns List of pending join requests with user profiles
 */
export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester is admin or owner
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['admin', 'owner'].includes(membership.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    // Get pending requests
    const { data: requests, error: reqError } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (reqError) {
      console.error('[join-requests GET] error:', reqError)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Enrich with user profile data
    const userIds = requests.map(r => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    const enriched = requests.map(req => ({
      ...req,
      user: {
        full_name: profileMap.get(req.user_id)?.full_name ?? null,
        email: profileMap.get(req.user_id)?.email ?? '',
        avatar_url: profileMap.get(req.user_id)?.avatar_url ?? null,
        headline: null,
      },
    }))

    return NextResponse.json({ requests: enriched })
  } catch (err) {
    console.error('[join-requests GET] error:', err)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}

/**
 * PATCH /api/teams/[teamId]/join-requests
 * @description Approve or reject a join request (admin/owner only)
 * @param request - Body: { request_id, action: 'approve'|'reject', review_note? }
 * @returns Updated request
 */
export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester is admin or owner
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['admin', 'owner'].includes(membership.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    const body = await request.json() as {
      request_id: string
      action: 'approve' | 'reject'
      review_note?: string
    }
    const { request_id, action, review_note } = body

    if (!request_id || !action) {
      return NextResponse.json({ error: 'request_id and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    // Verify the request exists and belongs to this team
    const { data: joinRequest } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('id', request_id)
      .eq('team_id', teamId)
      .single()

    if (!joinRequest) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 })
    }

    if (joinRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 })
    }

    // Update request status
    const { data: updated, error: updateError } = await supabase
      .from('team_join_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request_id)
      .select()
      .single()

    if (updateError) throw updateError

    // If approved: create team member record
    if (action === 'approve') {
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: joinRequest.user_id,
          role: 'member',
        })

      if (memberError) {
        // Rollback status update
        await supabase
          .from('team_join_requests')
          .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
          .eq('id', request_id)

        console.error('[join-requests PATCH] member insert error:', memberError)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }
    }

    return NextResponse.json({ request: updated })
  } catch (err) {
    console.error('[join-requests PATCH] error:', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
