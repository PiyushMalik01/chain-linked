/**
 * Team Invitations API Route
 * @description Handles team invitation operations with Resend email integration
 * @module app/api/teams/[teamId]/invite
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { TeamInvitationEmail } from '@/components/emails/team-invitation'
import { format } from 'date-fns'

/**
 * Route context type
 */
interface RouteContext {
  params: Promise<{ teamId: string }>
}

/**
 * Generate cryptographically secure random token
 * @returns Secure random token string (64 hex characters)
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns Whether email is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * GET pending invitations
 * @description Fetch all pending invitations for a team
 * @param request - HTTP request
 * @param context - Route context with teamId
 * @returns List of pending invitations
 */
export async function GET(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user has permission (owner or admin)
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Not authorized to view invitations' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let query = supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: invitations, error: fetchError } = await query

    if (fetchError) {
      console.error('Invitations fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    // Get inviter info for each invitation
    const inviterIds = [...new Set((invitations || []).map(i => i.invited_by).filter((id): id is string => id !== null))]
    const { data: inviters } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', inviterIds)

    const inviterMap = new Map(
      (inviters || []).map(p => [p.id, {
        name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
      }])
    )

    const enrichedInvitations = (invitations || []).map(inv => ({
      ...inv,
      inviter: inv.invited_by ? inviterMap.get(inv.invited_by) || null : null,
      is_expired: new Date(inv.expires_at) < new Date(),
    }))

    return NextResponse.json({ invitations: enrichedInvitations })
  } catch (err) {
    console.error('Invitations fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}

/**
 * POST send invitations
 * @description Send team invitations via email using Resend
 * @param request - HTTP request with emails and role
 * @param context - Route context with teamId
 * @returns Result of invitation sending
 */
export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { teamId } = await context.params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { emails, role = 'member' } = body

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Emails array is required' }, { status: 400 })
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "admin" or "member"' }, { status: 400 })
    }

    // Verify user has permission (owner or admin)
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized to send invitations' }, { status: 403 })
    }

    // Get team and company info for the email
    const { data: team } = await supabase
      .from('teams')
      .select('name, logo_url, company_id')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    let company = null
    if (team.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', team.company_id)
        .single()
      company = companyData
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const inviterName = inviterProfile?.full_name || ''
    const inviterEmail = inviterProfile?.email || user.email || ''

    console.log(`[TeamInvite] Sending invitations from ${inviterEmail} for team ${team.name} (${teamId})`)

    // Get existing team members' emails
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    const memberUserIds = existingMembers?.map(m => m.user_id) || []
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', memberUserIds)

    const existingEmails = new Set(
      (memberProfiles || []).map(p => p.email?.toLowerCase()).filter(Boolean)
    )

    // Get pending invitations
    const { data: pendingInvitations } = await supabase
      .from('team_invitations')
      .select('email')
      .eq('team_id', teamId)
      .eq('status', 'pending')

    const pendingEmails = new Set(
      (pendingInvitations || []).map(i => i.email.toLowerCase())
    )

    // Process each email
    const result = {
      success: true,
      sent: [] as string[],
      failed: [] as { email: string; reason: string }[],
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai'

    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase()

      // Validate email format
      if (!isValidEmail(normalizedEmail)) {
        result.failed.push({ email: normalizedEmail, reason: 'Invalid email format' })
        continue
      }

      // Check if already a member
      if (existingEmails.has(normalizedEmail)) {
        result.failed.push({ email: normalizedEmail, reason: 'Already a team member' })
        continue
      }

      // Check if already has pending invitation
      if (pendingEmails.has(normalizedEmail)) {
        result.failed.push({ email: normalizedEmail, reason: 'Invitation already pending' })
        continue
      }

      // Clean up old accepted/cancelled/expired invitations for this email
      // so re-inviting a removed member works without constraint conflicts
      await supabase
        .from('team_invitations')
        .delete()
        .eq('team_id', teamId)
        .eq('email', normalizedEmail)
        .in('status', ['accepted', 'cancelled', 'expired'])

      // Generate token and calculate expiration
      const token = generateSecureToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      // Create invitation record
      const { error: insertError } = await supabase
        .from('team_invitations')
        .insert({
          team_id: teamId,
          email: normalizedEmail,
          role,
          token,
          invited_by: user.id,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })

      if (insertError) {
        console.error('Invitation insert error:', insertError)
        result.failed.push({ email: normalizedEmail, reason: 'Failed to create invitation' })
        continue
      }

      // Send invitation email via Resend
      const inviteLink = `${appUrl}/invite/${token}`
      try {
        const emailResult = await sendEmail({
          to: normalizedEmail,
          subject: `You're invited to join ${team.name} on ChainLinked`,
          react: TeamInvitationEmail({
            inviterName,
            inviterEmail,
            teamName: team.name,
            companyName: company?.name,
            companyLogoUrl: company?.logo_url || team.logo_url || undefined,
            role: role as 'admin' | 'member',
            inviteLink,
            expiresAt: format(expiresAt, 'MMMM d, yyyy'),
          }),
        })

        if (!emailResult.success) {
          console.error('Email send error:', emailResult.error)
          // Invitation was created successfully - still count as sent
          // The invitation link works even if email delivery fails
          // User can share the link manually or resend later
        }
      } catch (emailErr) {
        console.error('Email send exception:', emailErr)
        // Invitation record exists, email failed - still count as sent
        // The invitation is valid and can be resent later
      }

      result.sent.push(normalizedEmail)
      pendingEmails.add(normalizedEmail) // Prevent duplicates in same batch
    }

    result.success = result.failed.length === 0

    return NextResponse.json(result)
  } catch (err) {
    console.error('Send invitations error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE cancel invitation
 * @description Cancel a pending invitation
 * @param request - HTTP request with invitationId query param
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
  const invitationId = searchParams.get('invitationId')

  if (!invitationId) {
    return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
  }

  // Verify user has permission
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Not authorized to cancel invitations' }, { status: 403 })
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('team_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('Cancel invitation error:', updateError)
    return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * PATCH resend invitation
 * @description Resend an invitation with new token and expiration
 * @param request - HTTP request with invitation ID
 * @param context - Route context with teamId
 * @returns Success message
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
    const { invitation_id } = body

    if (!invitation_id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
    }

    // Verify user has permission
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized to resend invitations' }, { status: 403 })
    }

    // Get existing invitation
    const { data: invitation } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitation_id)
      .eq('team_id', teamId)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    // Get team and company info
    const { data: team } = await supabase
      .from('teams')
      .select('name, logo_url, company_id')
      .eq('id', teamId)
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

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Generate new token and expiration
    const newToken = generateSecureToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Update invitation
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .eq('id', invitation_id)

    if (updateError) {
      console.error('Resend invitation error:', updateError)
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 })
    }

    // Send new invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai'
    const inviteLink = `${appUrl}/invite/${newToken}`

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: `Reminder: You're invited to join ${team?.name} on ChainLinked`,
      react: TeamInvitationEmail({
        inviterName: inviterProfile?.full_name || '',
        inviterEmail: inviterProfile?.email || user.email || '',
        teamName: team?.name || 'the team',
        companyName: company?.name,
        companyLogoUrl: company?.logo_url || team?.logo_url || undefined,
        role: invitation.role as 'admin' | 'member',
        inviteLink,
        expiresAt: format(expiresAt, 'MMMM d, yyyy'),
      }),
    })

    if (!emailResult.success) {
      console.error('Email send error:', emailResult.error)
      return NextResponse.json({
        success: true,
        warning: 'Invitation updated but email failed to send',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Resend invitation error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
