/**
 * Team Join Request API Route
 * @description Create, get, and cancel join requests for teams
 * @module app/api/teams/join-request
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/teams/join-request
 * @description Get the current user's pending join request (if any)
 * @returns The user's latest pending join request or null
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: request, error } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[join-request GET] error:', error)
      return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 })
    }

    if (!request) {
      return NextResponse.json({ request: null })
    }

    // Fetch team name separately to avoid join type issues
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', request.team_id)
      .single()

    return NextResponse.json({ request: { ...request, team_name: team?.name ?? null } })
  } catch (err) {
    console.error('[join-request GET] error:', err)
    return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 })
  }
}

/**
 * POST /api/teams/join-request
 * @description Submit a join request to a team
 * @param request - Request body with team_id and optional message
 * @returns Created join request
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as { team_id: string; message?: string }
    const { team_id, message } = body

    if (!team_id) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    // Verify team exists and is discoverable
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, discoverable')
      .eq('id', team_id)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    if (!team.discoverable) {
      return NextResponse.json({ error: 'Team is not open to join requests' }, { status: 403 })
    }

    // Check user is not already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this team' }, { status: 409 })
    }

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('team_join_requests')
      .select('id, status')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'pending') {
        return NextResponse.json({ error: 'You already have a pending request for this team' }, { status: 409 })
      }
      // Re-open a rejected request by updating status
      const { data: updated, error: updateError } = await supabase
        .from('team_join_requests')
        .update({
          status: 'pending',
          message: message ?? null,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      return NextResponse.json({ request: { ...updated, team_name: team.name } })
    }

    // Create new join request
    const { data: joinRequest, error: insertError } = await supabase
      .from('team_join_requests')
      .insert({
        user_id: user.id,
        team_id,
        message: message ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[join-request POST] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 })
    }

    return NextResponse.json({ request: { ...joinRequest, team_name: team.name } }, { status: 201 })
  } catch (err) {
    console.error('[join-request POST] error:', err)
    return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/join-request?id=requestId
 * @description Cancel a pending join request (by the requesting user)
 * @returns Success status
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('id')

  if (!requestId) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
  }

  try {
    // Verify the request belongs to this user
    const { data: joinRequest } = await supabase
      .from('team_join_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .single()

    if (!joinRequest || joinRequest.user_id !== user.id) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 })
    }

    if (joinRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('team_join_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[join-request DELETE] error:', err)
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 })
  }
}
