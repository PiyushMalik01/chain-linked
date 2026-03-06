/**
 * Pending Approval Screen Component
 * @description Animated waiting screen shown while a join request is pending.
 * Polls the join request status every 10 seconds and auto-redirects on approval.
 * @module components/features/pending-approval-screen
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  IconClock,
  IconUsers,
  IconX,
  IconLoader2,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { JoinRequest } from '@/hooks/use-join-requests'

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the PendingApprovalScreen component
 */
export interface PendingApprovalScreenProps {
  /** The current join request */
  request: JoinRequest
  /** Callback when the user cancels their request */
  onCancel: () => Promise<boolean>
  /** Additional CSS class */
  className?: string
}

// ============================================================================
// Pulsing Ring Animation
// ============================================================================

/**
 * Animated pulsing ring indicator for the waiting state
 */
function PulsingRing() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      <motion.div
        className="absolute size-28 rounded-full border-2 border-primary/20"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute size-20 rounded-full border-2 border-primary/30"
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
      {/* Icon container */}
      <div className="relative size-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <IconClock className="size-6 text-primary" />
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Pending Approval Screen
 *
 * Shows a waiting state while the join request is pending admin review.
 * Polls `/api/teams/join-request` every 10 seconds and auto-redirects
 * to `/dashboard` when the request is approved.
 *
 * @param props - Component props
 * @returns Pending approval UI JSX
 * @example
 * <PendingApprovalScreen
 *   request={myPendingRequest}
 *   onCancel={cancelRequest}
 * />
 */
export function PendingApprovalScreen({
  request,
  onCancel,
  className,
}: PendingApprovalScreenProps) {
  const router = useRouter()

  /**
   * Poll the request status - auto-redirect if approved
   */
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/teams/join-request')
      if (!res.ok) return

      const data = await res.json() as { request: JoinRequest | null }
      const latest = data.request

      if (!latest || latest.status === 'approved') {
        toast.success('Your request was approved! Welcome to the team.')
        router.replace('/dashboard')
        return
      }

      if (latest.status === 'rejected') {
        toast.error('Your join request was declined.')
        router.replace('/onboarding/join')
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [router])

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(pollStatus, 10_000)
    // Also check immediately
    pollStatus()
    return () => clearInterval(interval)
  }, [pollStatus])

  const handleCancel = async () => {
    const success = await onCancel()
    if (success) {
      router.replace('/onboarding/join')
    }
  }

  const teamName = request.team_name ?? 'the organization'

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 space-y-8', className)}>
      {/* Animated waiting indicator */}
      <PulsingRing />

      {/* Status text */}
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold">Request Sent</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your request to join <span className="font-medium text-foreground">{teamName}</span> is
          waiting for admin approval. We&apos;ll redirect you automatically when it&apos;s approved.
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm font-medium">
        <IconLoader2 className="size-4 animate-spin" />
        Pending review
      </div>

      {/* Info bullets */}
      <div className="text-left space-y-2 max-w-xs">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconUsers className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
          <span>An admin will review your request and approve or decline it</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconClock className="size-4 shrink-0 mt-0.5 text-muted-foreground/70" />
          <span>This page checks for updates every 10 seconds</span>
        </div>
      </div>

      {/* Cancel button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        className="text-muted-foreground hover:text-destructive"
      >
        <IconX className="size-4 mr-1.5" />
        Cancel Request
      </Button>
    </div>
  )
}
