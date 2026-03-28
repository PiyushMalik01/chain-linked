/**
 * Invite Team Member Dialog
 * @description Dialog for inviting team members via email with drag-and-drop
 * role assignment between Member and Admin zones.
 * @module components/features/invite-team-dialog
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import {
  IconInfoCircle,
  IconMail,
  IconUserPlus,
  IconLoader2,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconGripVertical,
  IconShield,
  IconUser,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTeamInvitations, type SendInvitationsResult } from '@/hooks/use-team-invitations'
import type { TeamMemberRole } from '@/types/database'

/**
 * Props for InviteTeamDialog
 */
interface InviteTeamDialogProps {
  /** Team ID to invite members to */
  teamId: string | null
  /** Team name for display */
  teamName?: string
  /** Optional trigger element (uses default button if not provided) */
  trigger?: React.ReactNode
  /** Callback when invitations are sent */
  onInvited?: (result: SendInvitationsResult) => void
}

/** A single invite entry with email and assigned role */
interface InviteEntry {
  email: string
  role: TeamMemberRole
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Draggable email badge
 */
function DraggableBadge({
  entry,
  onRemove,
  disabled,
}: {
  entry: InviteEntry
  onRemove: () => void
  disabled: boolean
}) {
  return (
    <Badge
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', entry.email)
        e.dataTransfer.effectAllowed = 'move'
      }}
      variant="secondary"
      className="pl-1 pr-0.5 py-0.5 flex items-center gap-0.5 cursor-grab active:cursor-grabbing select-none max-w-full text-[11px]"
    >
      <IconGripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />
      <span className="truncate min-w-0">{entry.email}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full hover:bg-muted-foreground/20 p-0.5"
        disabled={disabled}
      >
        <IconX className="size-2.5" />
      </button>
    </Badge>
  )
}

/**
 * Drop zone for a role (Member or Admin)
 */
function RoleDropZone({
  role,
  entries,
  onDrop,
  onRemove,
  disabled,
}: {
  role: TeamMemberRole
  entries: InviteEntry[]
  onDrop: (email: string, targetRole: TeamMemberRole) => void
  onRemove: (email: string) => void
  disabled: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isAdmin = role === 'admin'
  const Icon = isAdmin ? IconShield : IconUser
  const roleEntries = entries.filter((e) => e.role === role)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const email = e.dataTransfer.getData('text/plain')
        if (email) onDrop(email, role)
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-2.5 min-h-[68px] transition-colors overflow-hidden",
        isDragOver
          ? isAdmin
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/40 bg-muted/50"
          : "border-border/50 bg-background",
      )}
    >
      {/* Zone header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("size-3", isAdmin ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", isAdmin ? "text-primary" : "text-muted-foreground")}>
          {isAdmin ? 'Admin' : 'Members'}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <IconInfoCircle className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            {isAdmin ? (
              <ul className="space-y-0.5">
                <li>Manage team members</li>
                <li>Edit team settings</li>
                <li>Send &amp; cancel invitations</li>
                <li>View all analytics</li>
              </ul>
            ) : (
              <ul className="space-y-0.5">
                <li>Create &amp; schedule posts</li>
                <li>View team activity</li>
                <li>Access shared templates</li>
                <li>View own analytics</li>
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
        {roleEntries.length > 0 && (
          <span className="text-[10px] text-muted-foreground/60 ml-auto">{roleEntries.length}</span>
        )}
      </div>

      {/* Badges or empty hint */}
      {roleEntries.length > 0 ? (
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {roleEntries.map((entry) => (
            <DraggableBadge
              key={entry.email}
              entry={entry}
              onRemove={() => onRemove(entry.email)}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/40 text-center py-1.5">
          {isDragOver ? 'Drop here' : `Drag here for ${isAdmin ? 'admin' : 'member'}`}
        </p>
      )}
    </div>
  )
}

/**
 * Invite Team Member Dialog
 *
 * Allows team admins/owners to invite new members by email.
 * Emails are added as badges and land in the Members zone by default.
 * Drag badges between Members and Admin zones to assign roles.
 */
export function InviteTeamDialog({
  teamId,
  teamName,
  trigger,
  onInvited,
}: InviteTeamDialogProps) {
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [entries, setEntries] = useState<InviteEntry[]>([])
  const [inputError, setInputError] = useState<string | null>(null)

  const { sendInvitations, isSending } = useTeamInvitations({ teamId })

  /**
   * Add email to the list as member by default
   */
  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return

    if (!isValidEmail(email)) {
      setInputError('Please enter a valid email address')
      return
    }

    if (entries.some((e) => e.email === email)) {
      setInputError('This email is already added')
      return
    }

    setEntries((prev) => [...prev, { email, role: 'member' }])
    setEmailInput('')
    setInputError(null)
  }, [emailInput, entries])

  /**
   * Handle key press in email input
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddEmail()
    }
  }, [handleAddEmail])

  /**
   * Remove entry
   */
  const handleRemove = useCallback((email: string) => {
    setEntries((prev) => prev.filter((e) => e.email !== email))
  }, [])

  /**
   * Move email to a target role (drag-and-drop handler)
   */
  const handleDrop = useCallback((email: string, targetRole: TeamMemberRole) => {
    setEntries((prev) =>
      prev.map((e) => (e.email === email ? { ...e, role: targetRole } : e))
    )
  }, [])

  /**
   * Send invitations grouped by role
   */
  const handleSendInvitations = useCallback(async () => {
    const allEntries = [...entries]
    if (emailInput.trim()) {
      const email = emailInput.trim().toLowerCase()
      if (isValidEmail(email) && !allEntries.some((e) => e.email === email)) {
        allEntries.push({ email, role: 'member' })
      }
    }

    if (allEntries.length === 0) {
      setInputError('Please add at least one email address')
      return
    }

    try {
      const byRole = allEntries.reduce<Record<string, string[]>>((acc, entry) => {
        if (!acc[entry.role]) acc[entry.role] = []
        acc[entry.role].push(entry.email)
        return acc
      }, {})

      let totalSent = 0
      let totalFailed = 0
      let lastResult: SendInvitationsResult | null = null

      for (const [role, emails] of Object.entries(byRole)) {
        const result = await sendInvitations(emails, role as TeamMemberRole)
        totalSent += result.sent.length
        totalFailed += result.failed.length
        lastResult = result

        if (result.failed.length > 0) {
          toast.error(`Failed: ${result.failed.map((f) => f.email).join(', ')}`, {
            description: result.failed.map((f) => f.reason).join(', '),
          })
        }
      }

      if (totalSent > 0) {
        toast.success(`Invitations sent to ${totalSent} recipient${totalSent > 1 ? 's' : ''}`)
      }

      if (lastResult) onInvited?.(lastResult)

      if (totalSent > 0) {
        setOpen(false)
        setEntries([])
        setEmailInput('')
      } else if (totalFailed === 0) {
        setInputError('Failed to send invitations. Please try again.')
      }
    } catch (err) {
      console.error('Send invitations error:', err)
      toast.error('Failed to send invitations', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    }
  }, [entries, emailInput, sendInvitations, onInvited])

  /**
   * Reset state when dialog closes
   */
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEntries([])
      setEmailInput('')
      setInputError(null)
    }
  }, [])

  const totalCount = entries.length + (emailInput.trim() && isValidEmail(emailInput.trim()) ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <IconUserPlus className="w-4 h-4 mr-2" />
            Invite Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconMail className="w-5 h-5" />
            Invite Team Members
          </DialogTitle>
          <DialogDescription>
            {teamName
              ? `Invite people to join ${teamName}. They'll receive an email with a link to join.`
              : 'Send email invitations to join your team.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email-input">Email addresses</Label>
            <div className="flex gap-2">
              <Input
                id="email-input"
                type="email"
                placeholder="colleague@company.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value)
                  setInputError(null)
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleAddEmail}
                disabled={isSending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddEmail}
                disabled={isSending || !emailInput.trim()}
              >
                Add
              </Button>
            </div>
            {inputError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <IconAlertCircle className="w-4 h-4" />
                {inputError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Press Enter or comma to add multiple emails
            </p>
          </div>

          {/* Drag-and-drop role zones */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Drag emails between zones to assign roles
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RoleDropZone
                  role="member"
                  entries={entries}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                  disabled={isSending}
                />
                <RoleDropZone
                  role="admin"
                  entries={entries}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                  disabled={isSending}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendInvitations}
            disabled={isSending || totalCount === 0}
          >
            {isSending ? (
              <>
                <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <IconCheck className="w-4 h-4 mr-2" />
                Send {totalCount > 0 ? `${totalCount} ` : ''}Invitation{totalCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
