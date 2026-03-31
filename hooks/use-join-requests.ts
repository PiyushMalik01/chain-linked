"use client"

/**
 * Join Requests Hook
 * @description React hook for managing team join requests - submitting, polling,
 * and approving/rejecting requests as an admin
 * @module hooks/use-join-requests
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

/**
 * A team join request
 */
export interface JoinRequest {
  /** Request ID */
  id: string
  /** User who made the request */
  user_id: string
  /** Team being requested */
  team_id: string
  /** Request status */
  status: 'pending' | 'approved' | 'rejected'
  /** Optional message from the requester */
  message: string | null
  /** Admin who reviewed the request */
  reviewed_by: string | null
  /** When the request was reviewed */
  reviewed_at: string | null
  /** Note from the reviewer */
  review_note: string | null
  /** When created */
  created_at: string
  /** User profile info (populated by API) */
  user?: {
    full_name: string | null
    email: string
    avatar_url: string | null
    headline: string | null
  }
  /** Team name (populated by API) */
  team_name?: string
}

/**
 * Return type of the useJoinRequests hook
 */
export interface UseJoinRequestsReturn {
  /** Current user's pending join request (if any) */
  myPendingRequest: JoinRequest | null
  /** Team's pending join requests (admin view) */
  pendingRequests: JoinRequest[]
  /** Whether requests are loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /**
   * Submit a join request for a team
   * @param teamId - Team to join
   * @param message - Optional message
   * @returns Created request or null on error
   */
  submitRequest: (teamId: string, message?: string) => Promise<JoinRequest | null>
  /**
   * Cancel the current user's pending request
   * @returns Whether cancellation was successful
   */
  cancelRequest: () => Promise<boolean>
  /**
   * Approve a join request (admin only)
   * @param requestId - Request ID to approve
   * @returns Whether approval was successful
   */
  approveRequest: (requestId: string) => Promise<boolean>
  /**
   * Reject a join request (admin only)
   * @param requestId - Request ID to reject
   * @param note - Optional rejection note
   * @returns Whether rejection was successful
   */
  rejectRequest: (requestId: string, note?: string) => Promise<boolean>
  /** Refetch requests */
  refetch: () => Promise<void>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to manage team join requests
 *
 * When `teamId` is provided, fetches that team's pending requests (admin view).
 * Always fetches the current user's own pending request for polling.
 *
 * @param teamId - Optional team ID for admin view of team requests
 * @returns Join request state and operations
 * @example
 * // Member: poll own request status
 * const { myPendingRequest, cancelRequest } = useJoinRequests()
 *
 * // Admin: view team's requests
 * const { pendingRequests, approveRequest, rejectRequest } = useJoinRequests({ teamId })
 */
export function useJoinRequests(params?: { teamId?: string }): UseJoinRequestsReturn {
  const teamId = params?.teamId
  const [myPendingRequest, setMyPendingRequest] = useState<JoinRequest | null>(null)
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  /**
   * Fetch the current user's pending request and team's requests
   */
  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch current user's own pending request
      const myRes = await fetch('/api/teams/join-request')
      if (myRes.ok) {
        const myData = await myRes.json() as { request: JoinRequest | null }
        setMyPendingRequest(myData.request)
      }

      // If teamId given, fetch that team's pending requests (admin view)
      if (teamId) {
        const teamRes = await fetch(`/api/teams/${teamId}/join-requests`)
        if (teamRes.ok) {
          const teamData = await teamRes.json() as { requests: JoinRequest[] }
          setPendingRequests(teamData.requests || [])
        }
      }
    } catch (err) {
      console.error('[useJoinRequests] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load join requests')
    } finally {
      setIsLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Real-time subscription: auto-refetch when team_join_requests change
  useEffect(() => {
    if (!teamId) return

    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`join-requests-rt-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_join_requests',
        filter: `team_id=eq.${teamId}`,
      }, () => {
        fetchRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, fetchRequests])

  /**
   * Submit a join request
   */
  const submitRequest = useCallback(async (
    targetTeamId: string,
    message?: string
  ): Promise<JoinRequest | null> => {
    try {
      const res = await fetch('/api/teams/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: targetTeamId, message }),
      })

      const data = await res.json() as { request?: JoinRequest; error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit join request')
      }

      const request = data.request!
      setMyPendingRequest(request)
      return request
    } catch (err) {
      console.error('[useJoinRequests] submitRequest error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to submit request'
      toast.error(msg)
      return null
    }
  }, [])

  /**
   * Cancel the current user's pending join request
   */
  const cancelRequest = useCallback(async (): Promise<boolean> => {
    if (!myPendingRequest) return false

    try {
      const res = await fetch(`/api/teams/join-request?id=${myPendingRequest.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to cancel request')
      }

      setMyPendingRequest(null)
      toast.success('Join request cancelled')
      return true
    } catch (err) {
      console.error('[useJoinRequests] cancelRequest error:', err)
      toast.error('Failed to cancel request')
      return false
    }
  }, [myPendingRequest])

  /**
   * Approve a join request (admin)
   */
  const approveRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!teamId) return false

    try {
      const res = await fetch(`/api/teams/${teamId}/join-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action: 'approve' }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to approve request')
      }

      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
      toast.success('Join request approved')
      return true
    } catch (err) {
      console.error('[useJoinRequests] approveRequest error:', err)
      toast.error('Failed to approve request')
      return false
    }
  }, [teamId])

  /**
   * Reject a join request (admin)
   */
  const rejectRequest = useCallback(async (requestId: string, note?: string): Promise<boolean> => {
    if (!teamId) return false

    try {
      const res = await fetch(`/api/teams/${teamId}/join-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action: 'reject', review_note: note }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to reject request')
      }

      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
      toast.success('Join request rejected')
      return true
    } catch (err) {
      console.error('[useJoinRequests] rejectRequest error:', err)
      toast.error('Failed to reject request')
      return false
    }
  }, [teamId])

  return {
    myPendingRequest,
    pendingRequests,
    isLoading,
    error,
    submitRequest,
    cancelRequest,
    approveRequest,
    rejectRequest,
    refetch: fetchRequests,
  }
}
