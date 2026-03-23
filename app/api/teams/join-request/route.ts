// TODO: Add rate limiting (e.g., Upstash Redis or next-rate-limit)

/**
 * Team Join Request API Route
 * @description Create, get, and cancel join requests for teams
 * @module app/api/teams/join-request
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'

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
        .eq('status', 'rejected') // Only update if still rejected (idempotent)
        .select()
        .single()

      if (updateError) throw updateError

      // Send email notification to team owner(s)
      await notifyTeamOwners(supabase, team_id, team.name, user)

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

    // Send email notification to team owner(s)
    await notifyTeamOwners(supabase, team_id, team.name, user)

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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape HTML special characters to prevent injection in email templates
 * @param s - Raw user-provided string
 * @returns HTML-safe escaped string
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Notify team owners/admins via email about a new join request
 * @param supabase - Supabase client instance
 * @param teamId - Team that received the request
 * @param teamName - Team name for email content
 * @param requester - The user who submitted the join request
 */
async function notifyTeamOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
  teamName: string,
  requester: { id: string; email?: string }
) {
  try {
    // Get team owners and admins
    const { data: admins } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .in('role', ['owner', 'admin'])

    if (!admins || admins.length === 0) return

    // Get admin profiles for emails
    const adminIds = admins.map(a => a.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', adminIds)

    if (!profiles || profiles.length === 0) return

    // Get requester profile
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', requester.id)
      .single()

    const requesterName = requesterProfile?.full_name || requesterProfile?.email || requester.email || 'Someone'
    const safeRequesterName = escapeHtml(requesterName)
    const safeTeamName = escapeHtml(teamName)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai'

    // Send email to each admin/owner
    for (const profile of profiles) {
      if (!profile.email) continue

      await sendEmail({
        to: profile.email,
        subject: `${requesterName} wants to join ${teamName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">New Join Request</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              <strong>${safeRequesterName}</strong> has requested to join <strong>${safeTeamName}</strong>.
            </p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              You can review and approve or decline this request from the Team Activity page.
            </p>
            <a href="${appUrl}/dashboard/team/activity"
               style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
              Review Request
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">
              — ChainLinked
            </p>
          </div>
        `,
      })
    }

    console.log(`[join-request] Notified ${profiles.length} admin(s) about join request from ${requesterName}`)
  } catch (err) {
    // Don't fail the request if email fails
    console.error('[join-request] Failed to send owner notification:', err)
  }
}
