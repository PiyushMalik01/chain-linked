/**
 * Invitations Hook
 * @description React hook for team invitation management
 * @module hooks/use-invitations
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  TeamInvitation,
  TeamInvitationInsert,
  TeamInvitationWithInviter,
  InvitationStatus,
  TeamMemberRole,
} from '@/types/database'

/**
 * Hook return type for invitation operations
 */
interface UseInvitationsReturn {
  /** List of team invitations */
  invitations: TeamInvitationWithInviter[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Send invitations to multiple emails */
  sendInvitations: (teamId: string, emails: string[], role?: TeamMemberRole) => Promise<SendInvitationsResult>
  /** Get invitation by token */
  getInvitationByToken: (token: string) => Promise<TeamInvitationWithInviter | null>
  /** Accept an invitation */
  acceptInvitation: (token: string) => Promise<AcceptInvitationResult>
  /** Cancel an invitation */
  cancelInvitation: (id: string) => Promise<boolean>
  /** Resend an invitation */
  resendInvitation: (id: string) => Promise<boolean>
  /** Refetch invitations */
  refetch: () => Promise<void>
}

/**
 * Result type for sending invitations
 */
export interface SendInvitationsResult {
  /** Whether all invitations were sent successfully */
  success: boolean
  /** Successfully sent invitations */
  sent: string[]
  /** Failed invitations with reasons */
  failed: { email: string; reason: string }[]
}

/**
 * Result type for accepting invitation
 */
export interface AcceptInvitationResult {
  /** Whether the invitation was accepted successfully */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Team ID if successful */
  teamId?: string
}

/**
 * Input for fetching invitations
 */
interface UseInvitationsOptions {
  /** Team ID to fetch invitations for */
  teamId?: string
  /** Only fetch pending invitations */
  pendingOnly?: boolean
}

/**
 * Generate cryptographically secure random token
 * @returns Secure random token string
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
 * Hook to manage team invitations
 * @param options - Options for fetching invitations
 * @returns Invitation data and operations
 * @example
 * const { invitations, sendInvitations, acceptInvitation } = useInvitations({ teamId: '...' })
 *
 * // Send invitations
 * const result = await sendInvitations(teamId, ['user@example.com'], 'member')
 */
export function useInvitations(options: UseInvitationsOptions = {}): UseInvitationsReturn {
  const { teamId, pendingOnly = false } = options
  const [invitations, setInvitations] = useState<TeamInvitationWithInviter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch invitations for the team
   */
  const fetchInvitations = useCallback(async () => {
    if (!teamId) {
      setInvitations([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      let query = supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      if (pendingOnly) {
        query = query.eq('status', 'pending')
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      // Fetch inviter info and team/company info for each invitation
      const enrichedInvitations: TeamInvitationWithInviter[] = await Promise.all(
        (data || []).map(async (invitation) => {
          // Get inviter info
          const { data: inviter } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', invitation.invited_by ?? '')
            .single()

          // Get team and company info
          const { data: team } = await supabase
            .from('teams')
            .select('name, company_id')
            .eq('id', invitation.team_id)
            .single()

          let companyInfo = null
          if (team?.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('name, logo_url')
              .eq('id', team.company_id)
              .single()
            companyInfo = company
          }

          return {
            ...invitation,
            inviter: inviter ? {
              name: inviter.full_name,
              email: inviter.email || '',
              avatar_url: inviter.avatar_url,
            } : undefined,
            team: team ? {
              name: team.name,
              company: companyInfo || undefined,
            } : undefined,
          }
        })
      )

      setInvitations(enrichedInvitations)
    } catch (err) {
      console.error('Invitations fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations')
      setInvitations([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase, teamId, pendingOnly])

  /**
   * Send invitations to multiple email addresses via API
   * This sends emails using Resend through the server-side API route
   * @param teamId - Team to invite users to
   * @param emails - List of email addresses
   * @param role - Role to assign (default: member)
   * @returns Result of invitation sending
   */
  const sendInvitations = useCallback(async (
    teamId: string,
    emails: string[],
    role: TeamMemberRole = 'member'
  ): Promise<SendInvitationsResult> => {
    try {
      // Call the API endpoint which handles validation, record creation, and email sending
      const response = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, role }),
      })

      let result: Record<string, unknown>
      try {
        result = await response.json()
      } catch {
        return {
          success: false,
          sent: [],
          failed: emails.map(email => ({
            email,
            reason: `Server error (${response.status}). Please try again.`,
          })),
        }
      }

      if (!response.ok) {
        return {
          success: false,
          sent: [],
          failed: emails.map(email => ({
            email,
            reason: (result.error as string) || 'Failed to send invitation',
          })),
        }
      }

      // Refetch invitations to update the list
      const sentEmails = (result.sent as string[]) || []
      if (sentEmails.length > 0) {
        await fetchInvitations()
      }

      return {
        success: (result.success as boolean) ?? false,
        sent: sentEmails,
        failed: (result.failed as { email: string; reason: string }[]) || [],
      }
    } catch (err) {
      console.error('Send invitations error:', err)
      return {
        success: false,
        sent: [],
        failed: emails.map(email => ({
          email,
          reason: err instanceof Error ? err.message : 'Unknown error',
        })),
      }
    }
  }, [fetchInvitations])

  /**
   * Get invitation by token (for acceptance flow)
   * @param token - Invitation token
   * @returns Invitation details or null
   */
  const getInvitationByToken = useCallback(async (token: string): Promise<TeamInvitationWithInviter | null> => {
    try {
      const { data: invitation, error: fetchError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (fetchError || !invitation) {
        return null
      }

      // Get inviter info
      const { data: inviter } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', invitation.invited_by ?? '')
        .single()

      // Get team and company info
      const { data: team } = await supabase
        .from('teams')
        .select('name, company_id')
        .eq('id', invitation.team_id)
        .single()

      let companyInfo = null
      if (team?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url')
          .eq('id', team.company_id)
          .single()
        companyInfo = company
      }

      return {
        ...invitation,
        inviter: inviter ? {
          name: inviter.full_name,
          email: inviter.email || '',
          avatar_url: inviter.avatar_url,
        } : undefined,
        team: team ? {
          name: team.name,
          company: companyInfo || undefined,
        } : undefined,
      }
    } catch (err) {
      console.error('Get invitation error:', err)
      return null
    }
  }, [supabase])

  /**
   * Accept an invitation via API
   * This handles adding user to team and sends welcome email
   * @param token - Invitation token
   * @returns Result of acceptance
   */
  const acceptInvitation = useCallback(async (token: string): Promise<AcceptInvitationResult> => {
    try {
      const response = await fetch('/api/teams/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to accept invitation',
        }
      }

      return {
        success: true,
        teamId: result.team_id,
      }
    } catch (err) {
      console.error('Accept invitation error:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to accept invitation',
      }
    }
  }, [])

  /**
   * Cancel a pending invitation
   * @param id - Invitation ID
   * @returns Whether cancellation was successful
   */
  const cancelInvitation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (updateError) {
        console.error('Cancel invitation error:', updateError)
        return false
      }

      // Update local state
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === id ? { ...inv, status: 'cancelled' } : inv
        )
      )

      return true
    } catch (err) {
      console.error('Cancel invitation error:', err)
      return false
    }
  }, [supabase])

  /**
   * Resend an invitation (generates new token and expiry)
   * @param id - Invitation ID
   * @returns Whether resend was successful
   */
  const resendInvitation = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Generate new token
      const newToken = generateSecureToken()

      // Calculate new expiration
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({
          token: newToken,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .eq('id', id)

      if (updateError) {
        console.error('Resend invitation error:', updateError)
        return false
      }

      // TODO: Send email with new invitation link

      // Refetch invitations
      await fetchInvitations()

      return true
    } catch (err) {
      console.error('Resend invitation error:', err)
      return false
    }
  }, [supabase, fetchInvitations])

  // Fetch invitations on mount and when teamId changes
  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  return {
    invitations,
    isLoading,
    error,
    sendInvitations,
    getInvitationByToken,
    acceptInvitation,
    cancelInvitation,
    resendInvitation,
    refetch: fetchInvitations,
  }
}
