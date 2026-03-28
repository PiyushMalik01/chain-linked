/**
 * Team Invitations Hook
 * @description React hook for managing team invitations
 * @module hooks/use-team-invitations
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TeamMemberRole } from '@/types/database'

/**
 * Invitation with enriched data
 */
export interface TeamInvitationEnriched {
  /** Invitation ID */
  id: string
  /** Team ID */
  team_id: string
  /** Invitee email */
  email: string
  /** Role to be assigned */
  role: TeamMemberRole
  /** Invitation token */
  token: string
  /** User who sent the invitation */
  invited_by: string
  /** Current status */
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  /** Expiration date */
  expires_at: string
  /** Creation date */
  created_at: string
  /** Acceptance date (if accepted) */
  accepted_at: string | null
  /** Whether invitation is expired */
  is_expired: boolean
  /** Inviter info */
  inviter: {
    name: string | null
    email: string
    avatar_url: string | null
  } | null
}

/**
 * Send invitations result
 */
export interface SendInvitationsResult {
  /** Whether all invitations were sent successfully */
  success: boolean
  /** Successfully sent email addresses */
  sent: string[]
  /** Failed invitations with reasons */
  failed: { email: string; reason: string }[]
}

/**
 * Hook return type
 */
interface UseTeamInvitationsReturn {
  /** List of invitations */
  invitations: TeamInvitationEnriched[]
  /** Loading state */
  isLoading: boolean
  /** Sending invitations state */
  isSending: boolean
  /** Error message if any */
  error: string | null
  /** Send invitations to emails */
  sendInvitations: (emails: string[], role?: TeamMemberRole) => Promise<SendInvitationsResult>
  /** Cancel a pending invitation */
  cancelInvitation: (invitationId: string) => Promise<boolean>
  /** Resend an invitation */
  resendInvitation: (invitationId: string) => Promise<boolean>
  /** Refetch invitations */
  refetch: () => Promise<void>
}

/**
 * Options for the hook
 */
interface UseTeamInvitationsOptions {
  /** Team ID to manage invitations for */
  teamId: string | null
  /** Only fetch pending invitations */
  pendingOnly?: boolean
}

/**
 * Hook to manage team invitations
 * @param options - Hook options
 * @returns Invitation data and operations
 * @example
 * const { invitations, sendInvitations, cancelInvitation } = useTeamInvitations({ teamId })
 *
 * // Send invitations
 * const result = await sendInvitations(['user@example.com'], 'member')
 *
 * // Cancel invitation
 * await cancelInvitation(invitationId)
 */
export function useTeamInvitations(options: UseTeamInvitationsOptions): UseTeamInvitationsReturn {
  const { teamId, pendingOnly = true } = options

  const [invitations, setInvitations] = useState<TeamInvitationEnriched[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch invitations for the team
   */
  const fetchInvitations = useCallback(async () => {
    if (!teamId) {
      setInvitations([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const status = pendingOnly ? 'pending' : 'all'
      const response = await fetch(`/api/teams/${teamId}/invite?status=${status}`)
      const data = await response.json()

      if (!response.ok) {
        // 403 = not admin/owner — silently return empty, not an error
        if (response.status === 403) {
          setInvitations([])
          return
        }
        throw new Error(data.error || 'Failed to fetch invitations')
      }

      setInvitations(data.invitations || [])
    } catch (err) {
      console.error('Invitations fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations')
    } finally {
      setIsLoading(false)
    }
  }, [teamId, pendingOnly])

  /**
   * Send invitations to multiple email addresses
   * @param emails - List of email addresses
   * @param role - Role to assign (default: member)
   * @returns Result of invitation sending
   */
  const sendInvitations = useCallback(async (
    emails: string[],
    role: TeamMemberRole = 'member'
  ): Promise<SendInvitationsResult> => {
    if (!teamId) {
      return {
        success: false,
        sent: [],
        failed: emails.map(email => ({ email, reason: 'No team selected' })),
      }
    }

    try {
      setIsSending(true)
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, role }),
      })

      let data: Record<string, unknown>
      try {
        data = await response.json()
      } catch {
        throw new Error(`Server error (${response.status}). Please try again.`)
      }

      if (!response.ok) {
        throw new Error((data.error as string) || 'Failed to send invitations')
      }

      // Refetch invitations after successful send
      const sentEmails = (data.sent as string[]) || []
      if (sentEmails.length > 0) {
        await fetchInvitations()
      }

      return {
        success: (data.success as boolean) ?? false,
        sent: sentEmails,
        failed: (data.failed as { email: string; reason: string }[]) || [],
      }
    } catch (err) {
      console.error('Send invitations error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitations'
      setError(errorMessage)
      return {
        success: false,
        sent: [],
        failed: emails.map(email => ({ email, reason: errorMessage })),
      }
    } finally {
      setIsSending(false)
    }
  }, [teamId, fetchInvitations])

  /**
   * Cancel a pending invitation
   * @param invitationId - Invitation ID to cancel
   * @returns Whether cancellation was successful
   */
  const cancelInvitation = useCallback(async (invitationId: string): Promise<boolean> => {
    if (!teamId) return false

    try {
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/invite?invitationId=${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      // Update local state optimistically
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === invitationId
            ? { ...inv, status: 'cancelled' as const }
            : inv
        ).filter(inv => pendingOnly ? inv.status === 'pending' : true)
      )

      return true
    } catch (err) {
      console.error('Cancel invitation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation')
      return false
    }
  }, [teamId, pendingOnly])

  /**
   * Resend an invitation with new token and expiration
   * @param invitationId - Invitation ID to resend
   * @returns Whether resend was successful
   */
  const resendInvitation = useCallback(async (invitationId: string): Promise<boolean> => {
    if (!teamId) return false

    try {
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      // Refetch to get updated data
      await fetchInvitations()

      return true
    } catch (err) {
      console.error('Resend invitation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to resend invitation')
      return false
    }
  }, [teamId, fetchInvitations])

  // Fetch invitations when teamId changes
  useEffect(() => {
    fetchInvitations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // Refetch when window regains focus (catches accepted invitations)
  useEffect(() => {
    if (!teamId) return
    const handleFocus = () => { fetchInvitations() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [teamId, fetchInvitations])

  // Poll every 30 seconds to catch status changes
  useEffect(() => {
    if (!teamId) return
    const interval = setInterval(fetchInvitations, 30000)
    return () => clearInterval(interval)
  }, [teamId, fetchInvitations])

  return {
    invitations,
    isLoading,
    isSending,
    error,
    sendInvitations,
    cancelInvitation,
    resendInvitation,
    refetch: fetchInvitations,
  }
}
