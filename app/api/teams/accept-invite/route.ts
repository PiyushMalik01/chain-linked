/**
 * Accept Invitation API Route
 * @description Handles team invitation acceptance with welcome email
 * @module app/api/teams/accept-invite
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { WelcomeToTeamEmail } from '@/components/emails/welcome-to-team'

/**
 * POST accept invitation
 * @description Accept a team invitation by token
 * @param request - HTTP request with token
 * @returns Result of acceptance with team info
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 })
    }

    // Get invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Verify email matches
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({
        error: 'This invitation was sent to a different email address',
        expected_email: invitation.email,
      }, { status: 403 })
    }

    // Check invitation status
    if (invitation.status === 'accepted') {
      // Already accepted - just return success
      return NextResponse.json({
        success: true,
        team_id: invitation.team_id,
        message: 'Already a team member',
      })
    }

    if (invitation.status === 'cancelled') {
      return NextResponse.json({ error: 'This invitation has been cancelled' }, { status: 400 })
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 })
    }

    // Check if user is already a member of THIS team
    const { data: existingMembership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', user.id)
      .single()

    if (existingMembership) {
      await supabase
        .from('team_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        team_id: invitation.team_id,
        message: 'Already a team member',
      })
    }

    // Enforce single-team-per-member: remove user from all other teams before joining
    const { data: currentMemberships } = await supabase
      .from('team_members')
      .select('id, team_id, role')
      .eq('user_id', user.id)

    if (currentMemberships && currentMemberships.length > 0) {
      for (const membership of currentMemberships) {
        // If user is the owner of a team, delete that team (it becomes orphaned)
        if (membership.role === 'owner') {
          // Delete all members of that team first
          await supabase
            .from('team_members')
            .delete()
            .eq('team_id', membership.team_id)

          // Delete the team itself
          await supabase
            .from('teams')
            .delete()
            .eq('id', membership.team_id)
        } else {
          // Just remove the membership
          await supabase
            .from('team_members')
            .delete()
            .eq('id', membership.id)
        }
      }
    }

    // Add user to the new team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError) {
      console.error('Add team member error:', memberError)
      return NextResponse.json({ error: 'Failed to join team' }, { status: 500 })
    }

    // Update invitation status
    await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    // Get team and company info for welcome email
    const { data: team } = await supabase
      .from('teams')
      .select('name, logo_url, company_id')
      .eq('id', invitation.team_id)
      .single()

    let company = null
    if (team?.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', team.company_id)
        .single()
      company = companyData
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Send welcome email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const dashboardUrl = `${appUrl}/dashboard`

    await sendEmail({
      to: user.email!,
      subject: `Welcome to ${team?.name}!`,
      react: WelcomeToTeamEmail({
        memberName: userProfile?.full_name || '',
        memberEmail: user.email || '',
        teamName: team?.name || 'the team',
        companyName: company?.name,
        companyLogoUrl: company?.logo_url || team?.logo_url || undefined,
        role: invitation.role as 'admin' | 'member',
        dashboardUrl,
      }),
    })

    return NextResponse.json({
      success: true,
      team_id: invitation.team_id,
      team_name: team?.name,
      role: invitation.role,
    })
  } catch (err) {
    console.error('Accept invitation error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * GET invitation details by token
 * @description Get invitation details for display on accept page
 * @param request - HTTP request with token query param
 * @returns Invitation details with team info
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  try {
    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('name, logo_url, company_id')
      .eq('id', invitation.team_id)
      .single()

    let company = null
    if (team?.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', team.company_id)
        .single()
      company = companyData
    }

    // Get inviter info
    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', invitation.invited_by ?? '')
      .single()

    // Check status
    const isExpired = new Date(invitation.expires_at) < new Date()
    const status = isExpired && invitation.status === 'pending' ? 'expired' : invitation.status

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      },
      team: team ? {
        name: team.name,
        logo_url: team.logo_url,
      } : null,
      company: company ? {
        name: company.name,
        logo_url: company.logo_url,
      } : null,
      inviter: inviter ? {
        name: inviter.full_name,
        email: inviter.email,
        avatar_url: inviter.avatar_url,
      } : null,
    })
  } catch (err) {
    console.error('Get invitation error:', err)
    return NextResponse.json({ error: 'Failed to get invitation' }, { status: 500 })
  }
}
