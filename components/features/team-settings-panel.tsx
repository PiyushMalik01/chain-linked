/**
 * Team Settings Panel Component
 * @description Settings panel for team configuration including general info, company info,
 * quick actions, and danger zone. Supports inline team name editing for admins/owners.
 * @module components/features/team-settings-panel
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconSettings,
  IconUsers,
  IconBuildingSkyscraper,
  IconSparkles,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconPencil,
  IconLoader2,
  IconTrash,
  IconTransfer,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TeamWithMeta } from '@/hooks/use-team'

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the TeamSettingsPanel component
 */
export interface TeamSettingsPanelProps {
  /** The current team data */
  team: TeamWithMeta
  /** Current user's role in the team */
  currentUserRole: string | null
  /** Whether the current user can manage team settings */
  canManage: boolean
  /** Callback to update the team name */
  onUpdateTeamName: (name: string) => Promise<void>
  /** Callback to delete the team */
  onDeleteTeam: () => Promise<void>
}

// ============================================================================
// Inline Edit Field
// ============================================================================

/**
 * Inline editable text field with save/cancel controls
 * @param props.value - Current value to display/edit
 * @param props.onSave - Async callback with new value when saved
 * @param props.disabled - Whether editing is disabled
 * @param props.placeholder - Placeholder for the input
 */
function InlineEditField({
  value,
  onSave,
  disabled = false,
  placeholder = 'Enter value...',
}: {
  value: string
  onSave: (newValue: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = useCallback(() => {
    setEditValue(value)
    setIsEditing(true)
  }, [value])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
  }, [value])

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === value) {
      setIsEditing(false)
      return
    }

    try {
      setIsSaving(true)
      await onSave(trimmed)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }, [handleSave, handleCancel])

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-sm w-48"
          autoFocus
          disabled={isSaving}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleSave}
          disabled={isSaving}
          aria-label="Save"
        >
          {isSaving ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconCheck className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
          disabled={isSaving}
          aria-label="Cancel"
        >
          <IconX className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
        {value}
      </span>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={handleEdit}
          aria-label="Edit team name"
        >
          <IconPencil className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// Delete Confirmation
// ============================================================================

/**
 * Inline delete confirmation widget
 * @param props.teamName - Team name to confirm deletion
 * @param props.onConfirm - Async callback when deletion is confirmed
 * @param props.onCancel - Callback when deletion is cancelled
 */
function DeleteConfirmation({
  teamName,
  onConfirm,
  onCancel,
}: {
  teamName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const isMatch = confirmText === teamName

  const handleDelete = async () => {
    if (!isMatch) return
    try {
      setIsDeleting(true)
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
      <p className="text-xs text-muted-foreground">
        Type <span className="font-semibold text-foreground">{teamName}</span> to confirm deletion:
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={teamName}
        className="h-8 text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="rounded-lg"
          onClick={handleDelete}
          disabled={!isMatch || isDeleting}
        >
          {isDeleting ? (
            <IconLoader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <IconTrash className="size-4 mr-1.5" />
          )}
          Permanently Delete
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Team Settings Panel
 *
 * Displays and manages team configuration settings including:
 * - General info (team name with inline edit, role, member count)
 * - Company info (linked organization)
 * - Quick actions (manage members)
 * - Danger zone (transfer ownership, delete team - owner only)
 *
 * @param props - Component props
 * @returns Team settings panel JSX
 * @example
 * <TeamSettingsPanel
 *   team={currentTeam}
 *   currentUserRole="owner"
 *   canManage={true}
 *   onUpdateTeamName={handleUpdate}
 *   onDeleteTeam={handleDelete}
 * />
 */
export function TeamSettingsPanel({
  team,
  currentUserRole,
  canManage,
  onUpdateTeamName,
  onDeleteTeam,
}: TeamSettingsPanelProps) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isOwner = currentUserRole === 'owner'

  const handleUpdateTeamName = useCallback(async (name: string) => {
    try {
      await onUpdateTeamName(name)
      toast.success('Team name updated')
    } catch {
      toast.error('Failed to update team name')
    }
  }, [onUpdateTeamName])

  const handleDeleteTeam = useCallback(async () => {
    try {
      await onDeleteTeam()
      toast.success('Team deleted')
      router.push('/dashboard/team')
    } catch {
      toast.error('Failed to delete team')
    }
  }, [onDeleteTeam, router])

  const handleManageMembers = useCallback(() => {
    router.push('/dashboard/team/settings')
  }, [router])

  return (
    <div className="space-y-5">
      {/* General Settings Card */}
      <Card className="border-border/50 rounded-xl shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <IconSettings className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">General</CardTitle>
              <CardDescription className="text-xs">
                Basic team information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Team Name */}
          <div className="flex items-center justify-between py-3 border-b border-border/30">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Team Name</p>
              <p className="text-xs text-muted-foreground">The display name for your team</p>
            </div>
            <InlineEditField
              value={team.name}
              onSave={handleUpdateTeamName}
              disabled={!canManage}
            />
          </div>

          {/* Role */}
          <div className="flex items-center justify-between py-3 border-b border-border/30">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Your Role</p>
              <p className="text-xs text-muted-foreground">Your permission level in this team</p>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-sm font-medium px-3 py-1.5 rounded-lg capitalize",
                currentUserRole === 'owner'
                  ? "bg-primary/10 text-primary hover:bg-primary/10"
                  : currentUserRole === 'admin'
                    ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/10"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted/50"
              )}
            >
              {currentUserRole ?? 'Member'}
            </Badge>
          </div>

          {/* Team Size */}
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Team Size</p>
              <p className="text-xs text-muted-foreground">Total number of team members</p>
            </div>
            <div className="flex items-center gap-2">
              <IconUsers className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {team.member_count} member{team.member_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info Card */}
      {team.company && (
        <Card className="border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <IconBuildingSkyscraper className="size-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Company</CardTitle>
                <CardDescription className="text-xs">
                  Associated organization details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Company Name</p>
                <p className="text-xs text-muted-foreground">Linked organization</p>
              </div>
              <span className="text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-lg">
                {team.company.name}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Card */}
      {canManage && (
        <Card className="border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <IconSparkles className="size-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-base">Quick Actions</CardTitle>
                <CardDescription className="text-xs">
                  Manage your team settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={handleManageMembers}
              >
                <IconUsers className="size-4 mr-1.5" />
                Manage Members
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive/30 bg-destructive/[0.02] rounded-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-destructive/10 p-2">
                <IconAlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                <CardDescription className="text-xs">
                  Irreversible actions that affect your team
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Transfer Ownership */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background">
              <div>
                <p className="text-sm font-medium">Transfer Ownership</p>
                <p className="text-xs text-muted-foreground">
                  Transfer team ownership to another member
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled
              >
                <IconTransfer className="size-4 mr-1.5" />
                Transfer
              </Button>
            </div>

            {/* Delete Team */}
            <div className="p-3 rounded-xl border border-destructive/20 bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">Delete Team</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this team and all its data
                  </p>
                </div>
                {!showDeleteConfirm && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <IconTrash className="size-4 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>

              {showDeleteConfirm && (
                <DeleteConfirmation
                  teamName={team.name}
                  onConfirm={handleDeleteTeam}
                  onCancel={() => setShowDeleteConfirm(false)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
