/**
 * Team Member List Component
 * @description Displays list of team members with role management
 * @module components/features/team-member-list
 */

'use client'

import * as React from 'react'
import {
  IconCheck,
  IconCrown,
  IconDotsVertical,
  IconLoader2,
  IconShield,
  IconTrash,
  IconUser,
  IconUserCog,
  IconUserPlus,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'

import { cn, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { TeamMemberWithUser } from '@/hooks/use-team'
import type { TeamMemberRole } from '@/types/database'
import type { JoinRequest } from '@/hooks/use-join-requests'

/**
 * Props for the TeamMemberList component
 */
export interface TeamMemberListProps {
  /** List of team members */
  members: TeamMemberWithUser[]
  /** Loading state */
  isLoading: boolean
  /** Current user's role in the team */
  currentUserRole: TeamMemberRole | null
  /** Callback to remove a member */
  onRemoveMember: (userId: string) => Promise<void>
  /** Callback to change a member's role */
  onRoleChange: (userId: string, role: 'admin' | 'member') => Promise<void>
  /** Pending join requests to display inline (admin/owner only) */
  joinRequests?: JoinRequest[]
  /** Callback to approve a join request */
  onApproveRequest?: (requestId: string) => Promise<boolean>
  /** Callback to reject a join request */
  onRejectRequest?: (requestId: string) => Promise<boolean>
  /** Custom class name */
  className?: string
}


/**
 * Get display name from user info
 * @param user - User object
 * @returns Display name
 */
function getDisplayName(user: { full_name: string | null; email: string }): string {
  return user.full_name || user.email.split('@')[0]
}

/**
 * Get role badge variant and icon
 * @param role - Team member role
 * @returns Badge props
 */
function getRoleBadgeProps(role: TeamMemberRole) {
  switch (role) {
    case 'owner':
      return {
        variant: 'default' as const,
        icon: IconCrown,
        label: 'Owner',
      }
    case 'admin':
      return {
        variant: 'secondary' as const,
        icon: IconShield,
        label: 'Admin',
      }
    default:
      return {
        variant: 'outline' as const,
        icon: IconUser,
        label: 'Member',
      }
  }
}

/**
 * Inline join request row matching the member row layout
 * @param props.request - The join request to display
 * @param props.onApprove - Callback when approve is clicked
 * @param props.onReject - Callback when reject is clicked
 */
function InlineJoinRequestRow({
  request,
  onApprove,
  onReject,
}: {
  request: JoinRequest
  onApprove: () => Promise<boolean>
  onReject: () => Promise<boolean>
}) {
  const [loading, setLoading] = React.useState<'approve' | 'reject' | null>(null)

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

  const displayName = request.user?.full_name || request.user?.email || 'Unknown user'
  const subtitle = request.user?.headline || request.user?.email || ''

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 -mx-1">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar className="size-11 ring-2 ring-amber-500/20">
          {request.user?.avatar_url ? (
            <AvatarImage src={request.user.avatar_url} alt={displayName} />
          ) : null}
          <AvatarFallback className="text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{displayName}</p>
            <Badge
              variant="outline"
              className="gap-1 shrink-0 border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 text-[10px] px-1.5 py-0"
            >
              <IconUserPlus className="size-2.5" />
              Join Request
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Accept / Reject buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
            onClick={handleReject}
            disabled={loading !== null}
          >
            {loading === 'reject' ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconX className="size-3.5" />
            )}
            Decline
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={handleApprove}
            disabled={loading !== null}
          title="Approve request"
        >
          {loading === 'approve' ? (
            <IconLoader2 className="size-3.5 animate-spin" />
          ) : (
            <IconCheck className="size-3.5" />
          )}
          Accept
        </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Team Member List Component
 *
 * Displays a list of team members with their roles.
 * Allows owners to manage member roles and remove members.
 * Pending join requests are shown inline as the first rows.
 *
 * Features:
 * - Avatar and name display
 * - Role badges
 * - Inline join request rows with accept/reject actions
 * - Role management dropdown (for owners)
 * - Member removal with confirmation
 * - Loading state
 *
 * @param props - Component props
 * @returns Team member list JSX
 * @example
 * <TeamMemberList
 *   members={members}
 *   isLoading={false}
 *   currentUserRole="owner"
 *   onRemoveMember={handleRemove}
 *   onRoleChange={handleRoleChange}
 *   joinRequests={pendingRequests}
 *   onApproveRequest={approveRequest}
 *   onRejectRequest={rejectRequest}
 * />
 */
export function TeamMemberList({
  members,
  isLoading,
  currentUserRole,
  onRemoveMember,
  onRoleChange,
  joinRequests = [],
  onApproveRequest,
  onRejectRequest,
  className,
}: TeamMemberListProps) {
  const [memberToRemove, setMemberToRemove] = React.useState<TeamMemberWithUser | null>(null)
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [changingRoleFor, setChangingRoleFor] = React.useState<string | null>(null)

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canChangeRoles = currentUserRole === 'owner'

  /**
   * Handle role change
   */
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    setChangingRoleFor(userId)
    try {
      await onRoleChange(userId, newRole)
    } finally {
      setChangingRoleFor(null)
    }
  }

  /**
   * Handle member removal confirmation
   */
  const handleConfirmRemove = async () => {
    if (!memberToRemove) return

    setIsRemoving(true)
    try {
      await onRemoveMember(memberToRemove.user_id)
    } finally {
      setIsRemoving(false)
      setMemberToRemove(null)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state
  if (members.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <IconUsers className="size-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">No team members yet</p>
      </div>
    )
  }

  return (
    <>
      <div className={cn('divide-y', className)}>
        {/* Inline join request rows (shown first) */}
        {joinRequests.length > 0 && onApproveRequest && onRejectRequest && (
          joinRequests.map((request) => (
            <InlineJoinRequestRow
              key={`jr-${request.id}`}
              request={request}
              onApprove={() => onApproveRequest(request.id)}
              onReject={() => onRejectRequest(request.id)}
            />
          ))
        )}

        {members.map((member) => {
          const roleProps = getRoleBadgeProps(member.role)
          const RoleIcon = roleProps.icon
          const isChangingRole = changingRoleFor === member.user_id
          const canManageThisMember =
            canManageMembers &&
            member.role !== 'owner' &&
            (currentUserRole === 'owner' || member.role === 'member')

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              {/* Avatar */}
              <Avatar className="size-10">
                {member.user.avatar_url ? (
                  <AvatarImage
                    src={member.user.avatar_url}
                    alt={getDisplayName(member.user)}
                  />
                ) : null}
                <AvatarFallback className="text-sm">
                  {getInitials(member.user.full_name || member.user.email)}
                </AvatarFallback>
              </Avatar>

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {getDisplayName(member.user)}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {member.user.headline || member.user.email}
                </p>
              </div>

              {/* Role Badge */}
              <Badge variant={roleProps.variant} className="gap-1 shrink-0">
                <RoleIcon className="size-3" />
                {roleProps.label}
              </Badge>

              {/* Joined Date */}
              <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
                {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
              </span>

              {/* Actions Menu */}
              {canManageThisMember && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      disabled={isChangingRole}
                    >
                      {isChangingRole ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconDotsVertical className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canChangeRoles && (
                      <>
                        <DropdownMenuItem
                          onClick={() =>
                            handleRoleChange(
                              member.user_id,
                              member.role === 'admin' ? 'member' : 'admin'
                            )
                          }
                        >
                          <IconUserCog className="size-4 mr-2" />
                          {member.role === 'admin'
                            ? 'Demote to Member'
                            : 'Promote to Admin'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setMemberToRemove(member)}
                    >
                      <IconTrash className="size-4 mr-2" />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        })}
      </div>

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {memberToRemove
                  ? getDisplayName(memberToRemove.user)
                  : 'this member'}
              </strong>{' '}
              from the team? They will lose access to all team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
