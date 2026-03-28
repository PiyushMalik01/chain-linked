/**
 * Team Header Component
 * @description Floating card-style team header with gradient banner, brand kit logo,
 * centered layout, and polished spacing matching ChainLinked design system.
 * @module components/features/team-header
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  IconUsers,
  IconSettings,
  IconUserPlus,
  IconCalendar,
  IconChevronDown,
  IconDoorExit,
  IconBuilding,
  IconLoader2,
} from '@tabler/icons-react'
import { getLogoUrlsWithFallback } from '@/lib/logo-dev'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InviteTeamDialog } from './invite-team-dialog'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { TeamWithMeta } from '@/hooks/use-team'
import type { TeamMemberRole } from '@/types/database'
import { cn } from '@/lib/utils'

/**
 * Props for TeamHeader component
 */
interface TeamHeaderProps {
  /** Team data */
  team: TeamWithMeta
  /** Current user's role */
  userRole: TeamMemberRole | null
  /** Number of pending invitations */
  pendingInvitationsCount?: number
  /** Company website for logo.dev fallback */
  companyWebsite?: string | null
  /** Brand kit logo URL (highest priority, extracted in onboarding step 3) */
  brandKitLogoUrl?: string | null
  /** Callback when settings clicked */
  onSettingsClick?: () => void
  /** Callback when invitations sent */
  onInvitationsSent?: () => void
}

/**
 * Format date to readable string
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Team Header Component
 *
 * Floating card with gradient banner, centered brand kit logo,
 * team name, metadata pills, and action buttons.
 * Logo overlaps the banner/card boundary for a modern profile-header look.
 *
 * @param props - Component props
 * @returns Team header JSX
 */
export function TeamHeader({
  team,
  userRole,
  pendingInvitationsCount = 0,
  companyWebsite,
  brandKitLogoUrl,
  onSettingsClick,
  onInvitationsSent,
}: TeamHeaderProps) {
  const router = useRouter()
  const { user } = useAuthContext()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const canInvite = userRole === 'owner' || userRole === 'admin'
  const canManage = userRole === 'owner' || userRole === 'admin'
  const [isLeaving, setIsLeaving] = useState(false)

  const handleLeaveTeam = useCallback(async () => {
    const confirmed = await confirm({
      title: userRole === 'owner' ? 'Leave & delete team?' : 'Leave team?',
      description: userRole === 'owner'
        ? `As the owner, leaving will delete "${team.name}" and remove all members. This cannot be undone.`
        : `Are you sure you want to leave "${team.name}"? You'll need a new invitation to rejoin.`,
      confirmText: 'Leave',
      cancelText: 'Stay',
      variant: 'destructive',
    })
    if (!confirmed) return

    setIsLeaving(true)
    try {
      const res = await fetch(`/api/teams/${team.id}/members?userId=${encodeURIComponent(user?.id || '')}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('You have left the team')
        router.push('/dashboard/team')
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'Failed to leave team')
      }
    } catch {
      toast.error('Failed to leave team')
    } finally {
      setIsLeaving(false)
    }
  }, [confirm, team.id, team.name, userRole, router])

  const fallbackUrls = getLogoUrlsWithFallback({
    website: companyWebsite,
    companyName: team.company?.name || team.name,
  })

  const allLogoUrls = [
    brandKitLogoUrl,
    team.logo_url,
    team.company?.logo_url,
    ...fallbackUrls,
  ].filter(Boolean) as string[]

  const [logoIndex, setLogoIndex] = useState(0)
  const currentLogoUrl = allLogoUrls[logoIndex] || null

  const handleLogoError = useCallback(() => {
    setLogoIndex(prev => prev + 1)
  }, [])

  const roleLabel = userRole === 'owner' ? 'Owner' : userRole === 'admin' ? 'Admin' : 'Member'

  return (
    <>
    <div className="px-4 md:px-6 pt-4 md:pt-6">
      <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm max-w-5xl mx-auto">
        {/* Gradient banner */}
        <div className="h-28 sm:h-32 bg-gradient-to-br from-primary via-primary/85 to-secondary/70 relative">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'radial-gradient(circle at 25% 40%, white 1.5px, transparent 1.5px), radial-gradient(circle at 75% 60%, white 1px, transparent 1px)',
              backgroundSize: '48px 48px, 64px 64px',
            }}
          />
        </div>

        {/* Logo - centered, overlapping the banner/content boundary */}
        <div className="flex justify-center -mt-11">
          <div className="relative">
            <div className={cn(
              "h-[84px] w-[84px] rounded-2xl border-4 border-card bg-background shadow-lg overflow-hidden",
            )}>
              {currentLogoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentLogoUrl}
                  alt={team.name}
                  onError={handleLogoError}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                  <span className="text-2xl font-bold text-primary">
                    {team.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-[2.5px] border-card" />
          </div>
        </div>

        {/* Content - centered below the logo, fully on card background */}
        <div className="px-5 sm:px-6 pt-3 pb-5 text-center">
          {/* Team name + role badge */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">
              {team.name}
            </h1>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-2 py-0 font-semibold uppercase tracking-wider",
                userRole === 'owner' && "bg-primary/10 text-primary border-primary/20",
                userRole === 'admin' && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                userRole === 'member' && "bg-muted text-muted-foreground"
              )}
            >
              {roleLabel}
            </Badge>
          </div>

          {/* Meta info row */}
          <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconUsers className="size-3.5" />
              {team.member_count} member{team.member_count !== 1 ? 's' : ''}
            </span>

            {team.company?.name && (
              <>
                <span className="text-border text-xs">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconBuilding className="size-3.5" />
                  {team.company.name}
                </span>
              </>
            )}

            <span className="text-border text-xs">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconCalendar className="size-3.5" />
              {formatDate(team.created_at ?? new Date().toISOString())}
            </span>

            {pendingInvitationsCount > 0 && (
              <>
                <span className="text-border text-xs">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <IconUserPlus className="size-3.5" />
                  {pendingInvitationsCount} pending
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9">
                    <IconSettings className="size-4" />
                    Manage
                    <IconChevronDown className="size-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={onSettingsClick} className="gap-2">
                    <IconSettings className="size-4" />
                    Team Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLeaveTeam}
                    disabled={isLeaving}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <IconDoorExit className="size-4" />
                    Leave Team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canInvite && (
              <InviteTeamDialog
                teamId={team.id}
                teamName={team.name}
                onInvited={onInvitationsSent}
                trigger={
                  <Button size="sm" className="gap-1.5 rounded-xl h-9 shadow-sm">
                    <IconUserPlus className="size-4" />
                    Invite Members
                  </Button>
                }
              />
            )}

            {/* Leave button visible to all members (non-admins don't see the Manage dropdown) */}
            {!canManage && userRole && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl h-9 text-destructive hover:text-destructive hover:bg-destructive/5"
                onClick={handleLeaveTeam}
                disabled={isLeaving}
              >
                {isLeaving ? <IconLoader2 className="size-4 animate-spin" /> : <IconDoorExit className="size-4" />}
                Leave Team
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    <ConfirmDialogComponent />
    </>
  )
}
