/**
 * Team Management Component
 * @description Main team management UI with members, invitations, and settings
 * @module components/features/team-management
 */

'use client'

import * as React from 'react'
import {
  IconLoader2,
  IconPlus,
  IconSettings,
  IconUsers,
  IconUserPlus,
} from '@tabler/icons-react'

import Link from 'next/link'
import { cn, getInitials } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { InviteTeamDialog } from '@/components/features/invite-team-dialog'
import { TeamMemberList } from '@/components/features/team-member-list'
import { PendingInvitations } from '@/components/features/pending-invitations'
import { JoinRequestsList } from '@/components/features/join-requests-list'
import { useTeam, type TeamWithMeta } from '@/hooks/use-team'
import { useTeamInvitations } from '@/hooks/use-team-invitations'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * Props for the TeamManagement component
 */
export interface TeamManagementProps {
  /** Custom class name */
  className?: string
  /** Pre-selected team ID (optional) */
  teamId?: string
}

/**
 * Team Management Component
 *
 * Main UI for managing team members and invitations.
 * Features:
 * - Team selection (if user has multiple teams)
 * - Member list with roles
 * - Pending invitations
 * - Invite modal
 * - Role management (for owners)
 *
 * @param props - Component props
 * @returns Team management UI JSX
 * @example
 * <TeamManagement />
 */
export function TeamManagement({ className, teamId: preselectedTeamId }: TeamManagementProps) {
  const {
    teams,
    currentTeam,
    members,
    isLoadingTeams,
    isLoadingMembers,
    error: teamError,
    currentUserRole,
    setCurrentTeam,
    removeMember,
    updateMemberRole,
    refetchTeams,
    fetchMembers,
  } = useTeam()

  const {
    invitations,
    isLoading: isLoadingInvitations,
    cancelInvitation,
    resendInvitation,
    refetch: refetchInvitations,
  } = useTeamInvitations({ teamId: currentTeam?.id || null })

  const [activeTab, setActiveTab] = React.useState('members')

  // Set preselected team when teams load
  React.useEffect(() => {
    if (preselectedTeamId && teams.length > 0 && !currentTeam) {
      const team = teams.find(t => t.id === preselectedTeamId)
      if (team) {
        setCurrentTeam(team)
      }
    }
  }, [preselectedTeamId, teams, currentTeam, setCurrentTeam])

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canChangeRoles = currentUserRole === 'owner'
  const pendingInvitationsCount = invitations.filter(i => i.status === 'pending' && !i.is_expired).length

  /**
   * Handle member removal
   */
  const handleRemoveMember = async (userId: string) => {
    if (!currentTeam) return
    const success = await removeMember(currentTeam.id, userId)
    if (success) {
      refetchTeams()
    }
  }

  /**
   * Handle role change
   */
  const handleRoleChange = async (userId: string, role: 'admin' | 'member') => {
    if (!currentTeam) return
    await updateMemberRole(currentTeam.id, userId, role)
  }

  /**
   * Handle invitation success - refresh both members and invitations
   */
  const handleInviteSuccess = () => {
    refetchInvitations()
    // Switch to invitations tab to show pending
    setActiveTab('invitations')
  }

  // Loading state
  if (isLoadingTeams) {
    return (
      <div className={cn('flex items-center justify-center p-12', className)}>
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // No teams state
  if (teams.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <IconUsers className="size-8 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-lg font-semibold">No Team Found</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              You are not part of any team yet. Create a company to get started.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/team">
              <IconPlus className="size-4 mr-2" />
              Create Team
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Team Header */}
      {currentTeam && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="size-14">
              {currentTeam.logo_url ? (
                <AvatarImage src={currentTeam.logo_url} alt={currentTeam.name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {getInitials(currentTeam.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{currentTeam.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'admin' ? 'Admin' : 'Member'}
                </Badge>
              </div>
              <CardDescription>
                {currentTeam.member_count} member{currentTeam.member_count !== 1 ? 's' : ''}
                {currentTeam.company && ` - ${currentTeam.company.name}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {canManageTeam && (
                <InviteTeamDialog
                  teamId={currentTeam.id}
                  teamName={currentTeam.name}
                  onInvited={() => handleInviteSuccess()}
                  trigger={
                    <Button>
                      <IconUserPlus className="size-4 mr-2" />
                      Invite
                    </Button>
                  }
                />
              )}
              {canChangeRoles && (
                <Button variant="outline" size="icon">
                  <IconSettings className="size-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Team selector for multiple teams */}
      {teams.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <Button
                key={team.id}
                variant={currentTeam?.id === team.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentTeam(team)}
                className="gap-2"
              >
                <Avatar className="size-5">
                  {team.logo_url ? (
                    <AvatarImage src={team.logo_url} alt={team.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
                {team.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {teamError && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {teamError}
        </div>
      )}

      {/* Members and Invitations Tabs */}
      {currentTeam && (
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="members" className="gap-2">
                  <IconUsers className="size-4" />
                  Members
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {members.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="invitations" className="gap-2">
                  Invitations
                  {pendingInvitationsCount > 0 && (
                    <Badge className="ml-1 text-xs">
                      {pendingInvitationsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="requests" className="gap-2">
                  Requests
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="members" className="mt-0">
                <TeamMemberList
                  members={members}
                  isLoading={isLoadingMembers}
                  currentUserRole={currentUserRole}
                  onRemoveMember={handleRemoveMember}
                  onRoleChange={handleRoleChange}
                />
              </TabsContent>

              <TabsContent value="invitations" className="mt-0">
                <PendingInvitations
                  invitations={invitations}
                  isLoading={isLoadingInvitations}
                  canManage={canManageTeam}
                  onCancel={cancelInvitation}
                  onResend={resendInvitation}
                />
              </TabsContent>

              <TabsContent value="requests" className="mt-0">
                {currentTeam && (
                  <JoinRequestsList teamId={currentTeam.id} />
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}
    </div>
  )
}
