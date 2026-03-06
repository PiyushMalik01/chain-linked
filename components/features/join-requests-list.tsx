/**
 * Join Requests List Component
 * @description Admin view of pending team join requests with approve/reject actions.
 * @module components/features/join-requests-list
 */

'use client'

import { useState } from 'react'
import {
  IconUserPlus,
  IconCheck,
  IconX,
  IconLoader2,
  IconClock,
} from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn, getInitials } from '@/lib/utils'
import { useJoinRequests } from '@/hooks/use-join-requests'
import type { JoinRequest } from '@/hooks/use-join-requests'

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the JoinRequestsList component
 */
export interface JoinRequestsListProps {
  /** Team ID whose join requests to show */
  teamId: string
  /** Additional CSS class */
  className?: string
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * A single join request row
 * @param props.request - The join request to display
 * @param props.onApprove - Callback when approve is clicked
 * @param props.onReject - Callback when reject is clicked
 */
function JoinRequestRow({
  request,
  onApprove,
  onReject,
}: {
  request: JoinRequest
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const handleApprove = async () => {
    setLoading('approve')
    await onApprove()
    setLoading(null)
  }

  const handleReject = async () => {
    setLoading('reject')
    await onReject()
    setLoading(null)
  }

  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true })
  const displayName = request.user?.full_name || request.user?.email || 'Unknown user'

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-card">
      <Avatar className="size-10 shrink-0">
        {request.user?.avatar_url && (
          <AvatarImage src={request.user.avatar_url} alt={displayName} />
        )}
        <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            <IconClock className="size-3 mr-1" />
            {timeAgo}
          </Badge>
        </div>
        {request.user?.email && request.user.full_name && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{request.user.email}</p>
        )}
        {request.message && (
          <p className="text-xs text-muted-foreground mt-1.5 italic bg-muted/40 rounded-md px-2 py-1.5">
            &ldquo;{request.message}&rdquo;
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
          onClick={handleReject}
          disabled={loading !== null}
        >
          {loading === 'reject' ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconX className="size-4" />
          )}
          <span className="hidden sm:inline ml-1.5">Decline</span>
        </Button>
        <Button
          size="sm"
          className="rounded-lg"
          onClick={handleApprove}
          disabled={loading !== null}
        >
          {loading === 'approve' ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconCheck className="size-4" />
          )}
          <span className="hidden sm:inline ml-1.5">Approve</span>
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Join Requests List
 *
 * Shows pending join requests for a team. Available to team admins and owners.
 * Provides approve and reject actions per request.
 *
 * @param props - Component props
 * @returns Join requests list UI JSX
 * @example
 * <JoinRequestsList teamId={currentTeam.id} />
 */
export function JoinRequestsList({ teamId, className }: JoinRequestsListProps) {
  const { pendingRequests, isLoading, approveRequest, rejectRequest } = useJoinRequests({ teamId })

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-6', className)}>
        <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (pendingRequests.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="rounded-full bg-muted/60 p-3 mx-auto w-fit mb-3">
          <IconUserPlus className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No pending requests</p>
        <p className="text-xs text-muted-foreground mt-1">
          Join requests will appear here when people request to join your team
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {pendingRequests.map(request => (
        <JoinRequestRow
          key={request.id}
          request={request}
          onApprove={async () => { await approveRequest(request.id) }}
          onReject={async () => { await rejectRequest(request.id) }}
        />
      ))}
    </div>
  )
}
