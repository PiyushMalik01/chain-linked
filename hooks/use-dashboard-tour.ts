/**
 * useDashboardTour Hook
 * @description Manages tour state, step navigation, target rect tracking, and Supabase persistence.
 * Calls refreshProfile() after completion so downstream consumers (e.g. extension prompt)
 * immediately see the updated dashboard_tour_completed flag.
 * @module hooks/use-dashboard-tour
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthContext } from '@/lib/auth/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { TOUR_STEPS } from '@/components/features/dashboard-tour/tour-steps'
import type { TargetRect } from '@/components/features/dashboard-tour/tour-overlay'

/** Delay before showing the tour (ms) — lets the page render first */
const ACTIVATION_DELAY = 1500
/** Max retries to find a target element */
const MAX_RETRIES = 5
/** Delay between retries (ms) */
const RETRY_DELAY = 500

/**
 * Return type for the useDashboardTour hook
 */
export interface DashboardTourState {
  /** Whether the tour is currently active and visible */
  isActive: boolean
  /** Index of the current tour step */
  currentStepIndex: number
  /** Bounding rect of the current target element */
  targetRect: TargetRect | null
  /** Advance to the next step or finish the tour */
  nextStep: () => void
  /** Skip the tour entirely */
  skipTour: () => void
  /** Close the tour (same as skip) */
  closeTour: () => void
}

/**
 * Resolve a target element and return its bounding rect
 * Retries up to MAX_RETRIES times if the element isn't found
 */
async function resolveTargetRect(selector: string): Promise<TargetRect | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const el = document.querySelector(selector)
    if (el) {
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    }
  }
  return null
}

/**
 * Hook to manage the dashboard walkthrough tour
 * Only activates on /dashboard for users who haven't completed the tour
 * @returns Tour state and navigation controls
 */
export function useDashboardTour(): DashboardTourState {
  const pathname = usePathname()
  const { profile, user, refreshProfile } = useAuthContext()

  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  const isCompletingRef = useRef(false)
  const supabaseRef = useRef(createClient())

  /**
   * Mark the tour as completed in Supabase, then refresh the profile
   * so downstream consumers immediately see dashboard_tour_completed = true
   */
  const completeTour = useCallback(async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    setIsActive(false)
    setTargetRect(null)

    if (!user?.id) return

    try {
      await supabaseRef.current
        .from('profiles')
        .update({ dashboard_tour_completed: true })
        .eq('id', user.id)

      // Re-fetch profile so the page sees the updated flag immediately
      await refreshProfile()
    } catch (err) {
      console.error('[DashboardTour] Failed to persist tour completion:', err)
    }
  }, [user?.id, refreshProfile])

  /**
   * Resolve and set the target rect for a given step index
   */
  const resolveStep = useCallback(async (stepIndex: number, skipRetries?: boolean) => {
    const step = TOUR_STEPS[stepIndex]
    if (!step) return

    // Scroll the target into view if needed
    const el = document.querySelector(step.targetSelector)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      // Wait for scroll to settle
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // When skipping to next step due to missing target, don't retry
    const rect = skipRetries
      ? (el ? (() => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height } })() : null)
      : await resolveTargetRect(step.targetSelector)
    if (rect) {
      setTargetRect(rect)
    } else {
      // Element not found — skip this step without retries
      if (stepIndex < TOUR_STEPS.length - 1) {
        setCurrentStepIndex(stepIndex + 1)
        resolveStep(stepIndex + 1, true)
      } else {
        completeTour()
      }
    }
  }, [completeTour])

  /**
   * Advance to the next step or finish the tour
   */
  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex >= TOUR_STEPS.length) {
      completeTour()
    } else {
      setCurrentStepIndex(nextIndex)
      resolveStep(nextIndex)
    }
  }, [currentStepIndex, completeTour, resolveStep])

  /**
   * Skip the tour entirely
   */
  const skipTour = useCallback(() => {
    completeTour()
  }, [completeTour])

  /**
   * Close the tour (alias for skip)
   */
  const closeTour = useCallback(() => {
    completeTour()
  }, [completeTour])

  // Activate the tour on /dashboard for users who haven't completed it
  useEffect(() => {
    // Only show on exactly /dashboard
    if (pathname !== '/dashboard') return
    // Only for authenticated users with profile data
    if (!profile || !user) return
    // Don't show if already completed
    if (profile.dashboard_tour_completed) return

    const timer = setTimeout(() => {
      setIsActive(true)
      setCurrentStepIndex(0)
      resolveStep(0)
    }, ACTIVATION_DELAY)

    return () => clearTimeout(timer)
  }, [pathname, profile, user, resolveStep])

  // Recompute target rect on window resize
  useEffect(() => {
    if (!isActive) return

    const handleResize = () => {
      const step = TOUR_STEPS[currentStepIndex]
      if (!step) return
      const el = document.querySelector(step.targetSelector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isActive, currentStepIndex])

  return {
    isActive,
    currentStepIndex,
    targetRect,
    nextStep,
    skipTour,
    closeTour,
  }
}
