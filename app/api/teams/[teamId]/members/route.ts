/**
 * Team Members API Route
 * @description Handles team member management operations
 * @module app/api/teams/[teamId]/members
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
 * GET team members
 * @description Fetch all members of a team with profile information
 * @param request - HTTP request
 * @param context - Route context with teamId
 * @returns Team members with user profiles
 */
export async function GET(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of the team
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })
  }

  try {
    // Get all team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, user_id, role, joined_at')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true })

    if (membersError) {
      console.error('Members fetch error:', membersError)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    // Get user profiles for all members
    const userIds = members?.map(m => m.user_id) || []

    // Fetch from profiles table
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, linkedin_avatar_url, email')
      .in('id', userIds)

    // Fetch LinkedIn profile data for richer member info
    const { data: linkedinProfiles } = await supabase
      .from('linkedin_profiles')
      .select('user_id, headline, profile_picture_url, followers_count, connections_count')
      .in('user_id', userIds)

    // Build LinkedIn profile map
    const linkedinMap = new Map(
      (linkedinProfiles || []).map(lp => [lp.user_id, lp])
    )

    // Build profile map - prefer LinkedIn avatar over default avatar
    const profileMap = new Map(
      (profiles || []).map(p => {
        const linkedin = linkedinMap.get(p.id)
        return [p.id, {
          email: p.email || '',
          full_name: p.full_name,
          avatar_url: linkedin?.profile_picture_url || p.linkedin_avatar_url || p.avatar_url,
          headline: linkedin?.headline || null,
          followers_count: linkedin?.followers_count || 0,
          connections_count: linkedin?.connections_count || 0,
        }]
      })
    )

    // Enrich members with user data
    const enrichedMembers = (members || []).map(member => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      user: profileMap.get(member.user_id) || {
        email: 'Unknown',
        full_name: null,
        avatar_url: null,
        headline: null,
        followers_count: 0,
        connections_count: 0,
      },
    }))

    return NextResponse.json({
      members: enrichedMembers,
      current_user_role: membership.role,
    })
  } catch (err) {
    console.error('Members fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

/**
 * PATCH update member role
 * @description Update a team member's role (owner only)
 * @param request - HTTP request with role update
 * @param context - Route context with teamId
 * @returns Updated member
 */
export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { user_id, role } = body

    if (!user_id || !role) {
      return NextResponse.json({ error: 'User ID and role are required' }, { status: 400 })
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "admin" or "member"' }, { status: 400 })
    }

    // Check requester is owner
    const { data: requesterMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!requesterMembership || requesterMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only team owner can change roles' }, { status: 403 })
    }

    // Cannot change owner's role
    const { data: targetMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single()

    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member of this team' }, { status: 404 })
    }

    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change the owner role' }, { status: 400 })
    }

    // Update role
    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .select()
      .single()

    if (updateError) {
      console.error('Role update error:', updateError)
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    return NextResponse.json({ member: updatedMember })
  } catch (err) {
    console.error('Role update error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE remove team member
 * @description Remove a member from the team (owner/admin or self)
 * @param request - HTTP request with userId query param
 * @param context - Route context with teamId
 * @returns Success message
 */
export async function DELETE(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId')

  if (!targetUserId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Check requester's role
  const { data: requesterMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!requesterMembership) {
    return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })
  }

  // Get target member info
  const { data: targetMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)
    .single()

  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member of this team' }, { status: 404 })
  }

  // Permission checks
  const isSelf = targetUserId === user.id
  const isOwnerOrAdmin = ['owner', 'admin'].includes(requesterMembership.role)

  // Cannot remove yourself if you're the owner
  if (isSelf && targetMembership.role === 'owner') {
    return NextResponse.json({ error: 'Owner cannot leave the team. Transfer ownership first.' }, { status: 400 })
  }

  // Only owner/admin can remove others
  if (!isSelf && !isOwnerOrAdmin) {
    return NextResponse.json({ error: 'Not authorized to remove members' }, { status: 403 })
  }

  // Admin cannot remove owner
  if (targetMembership.role === 'owner' && requesterMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 403 })
  }

  // Admins cannot remove other admins - only owners can
  if (requesterMembership.role === 'admin' && targetMembership.role === 'admin') {
    return NextResponse.json(
      { error: 'Only team owners can remove admins' },
      { status: 403 }
    )
  }

  // Remove member
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)

  if (deleteError) {
    console.error('Member removal error:', deleteError)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }

  // Clean up old accepted invitations for this user so they can be re-invited
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .single()

  if (targetProfile?.email) {
    await supabase
      .from('team_invitations')
      .delete()
      .eq('team_id', teamId)
      .eq('email', targetProfile.email.toLowerCase())
      .in('status', ['accepted', 'cancelled', 'expired'])
  }

  return NextResponse.json({ success: true })
}
