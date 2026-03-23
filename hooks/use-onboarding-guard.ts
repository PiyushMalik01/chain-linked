"use client"

/**
 * Onboarding Guard Hook
 * @description Redirects users based on onboarding step with multi-layer
 * localStorage fallback for step-skipping prevention. Progress persists
 * across page refreshes via localStorage and is reconciled with the
 * remote service on mount. Also handles company onboarding redirect guard.
 * @module hooks/use-onboarding-guard
 */

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthContext } from "@/lib/auth/auth-provider"
import {
  updateOnboardingStepInDatabase,
  markCompanyOnboardingStarted,
} from "@/services/onboarding"

/**
 * Map of onboarding steps to routes
 * Step 4 is the final step (Review & Complete)
 */
const STEP_PATHS: Record<number, string> = {
  1: "/onboarding/step1",
  2: "/onboarding/step2",
  3: "/onboarding/step3",
  4: "/onboarding/step4",
}

/**
 * Reverse path-to-step mapping
 */
const PATH_TO_STEP: Record<string, number> = {
  "/onboarding/step1": 1,
  "/onboarding/step2": 2,
  "/onboarding/step3": 3,
  "/onboarding/step4": 4,
}

/** The first valid onboarding step */
const MIN_STEP = 1

/** The last valid onboarding step (Review & Complete) */
const MAX_STEP = 4

/** localStorage key used to persist the highest completed step */
const STORAGE_KEY = "chainlinked_onboarding_step"

/**
 * Reads the highest completed onboarding step from localStorage.
 * @returns The stored step number, or null if nothing is persisted or the
 *          value is invalid.
 */
function getLocalStep(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = Number(raw)
    if (Number.isNaN(parsed) || parsed < MIN_STEP || parsed > MAX_STEP) {
      return null
    }
    return parsed
  } catch {
    // localStorage may be unavailable (SSR, private browsing quota, etc.)
    return null
  }
}

/**
 * Persists the highest completed onboarding step to localStorage.
 * @param step - The step number to persist
 */
function setLocalStep(step: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(step))
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Removes the persisted onboarding step from localStorage.
 * Should be called when onboarding is complete.
 */
function clearLocalStep(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently ignore removal failures
  }
}

/**
 * Onboarding guard return type
 */
interface UseOnboardingGuardReturn {
  /** True while the guard is validating */
  checking: boolean
}

/**
 * Guards onboarding routes based on stored progress with multi-layer
 * localStorage fallback for step-skipping prevention.
 *
 * On mount the hook:
 * 1. Immediately reads the highest completed step from localStorage for
 *    fast, synchronous validation.
 * 2. Fetches the authoritative step from the remote service.
 * 3. Reconciles the two sources, keeping whichever is higher, and
 *    persists the reconciled value back to localStorage.
 * 4. Redirects the user if they attempt to access a step beyond their
 *    highest completed step + 1.
 *
 * @returns An object containing `checking` (true while the guard is
 *          validating) so consuming components can show a loading state.
 * @example
 * const { checking } = useOnboardingGuard()
 * if (checking) return <LoadingSkeleton />
 */
export function useOnboardingGuard(): UseOnboardingGuardReturn {
  const router = useRouter()
  const pathname = usePathname()
  const {
    user,
    isLoading,
    hasCompletedOnboarding,
    hasCompletedCompanyOnboarding,
    currentOnboardingStep,
  } = useAuthContext()
  const [checking, setChecking] = useState(true)

  // Use refs for values that should not trigger re-runs of the effect
  const routerRef = useRef(router)
  routerRef.current = router
  const onboardingStepRef = useRef(currentOnboardingStep)
  onboardingStepRef.current = currentOnboardingStep

  useEffect(() => {
    if (isLoading) return

    const verify = async () => {
      try {
        if (!user) {
          routerRef.current.replace("/login")
          return
        }

        // Mark that company onboarding has started to prevent redirect loops
        // Only for owner/step paths, not for the member join path
        const isStepPath = pathname.startsWith('/onboarding/step')
        if (isStepPath) {
          markCompanyOnboardingStarted()
        }

        // If full onboarding is completed, redirect to dashboard
        if (hasCompletedOnboarding) {
          clearLocalStep()
          routerRef.current.replace("/dashboard")
          return
        }

        // Check if this is a company onboarding page
        const isCompanyOnboardingPath = pathname.startsWith("/onboarding/company")

        // If company onboarding is completed and user is on company onboarding page,
        // redirect to dashboard
        if (isCompanyOnboardingPath && hasCompletedCompanyOnboarding) {
          routerRef.current.replace("/dashboard")
          return
        }

        const currentPathStep = PATH_TO_STEP[pathname]

        // Use database-backed step from auth context as the authoritative source
        // instead of localStorage (which can become stale and cause redirect loops)
        const dbStep = onboardingStepRef.current
        const localStep = getLocalStep()

        // Reconcile: take the higher of DB vs local to avoid regressing
        const highestStep = Math.max(dbStep, localStep ?? MIN_STEP)

        // Persist the reconciled value locally
        setLocalStep(highestStep)

        // Validate step access
        if (currentPathStep) {
          const maxAllowed = highestStep + 1
          if (currentPathStep > maxAllowed) {
            routerRef.current.replace(STEP_PATHS[Math.min(maxAllowed, MAX_STEP)])
            return
          }

          // If the user is on a valid step at or beyond the recorded
          // progress, update both remote and local to reflect advancement.
          if (currentPathStep >= highestStep) {
            await updateOnboardingStepInDatabase(currentPathStep)
            setLocalStep(currentPathStep)
          }
        }

        setChecking(false)
      } catch (err) {
        // On error, allow access rather than blocking the user with an infinite loader
        console.error("[useOnboardingGuard] Error in verify:", err)
        setChecking(false)
      }
    }

    verify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, pathname, hasCompletedOnboarding, hasCompletedCompanyOnboarding])

  return { checking }
}

/**
 * Hook specifically for company onboarding guard
 * Used on /onboarding/company and related pages
 *
 * @returns Object containing checking state
 * @example
 * const { checking } = useCompanyOnboardingGuard()
 * if (checking) return <LoadingSkeleton />
 */
export function useCompanyOnboardingGuard(): UseOnboardingGuardReturn {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, isLoading, hasCompletedCompanyOnboarding } = useAuthContext()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isLoading) return

    const verify = async () => {
      // Not authenticated - redirect to login
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
        return
      }

      // Profile still loading - wait
      if (profile === null) {
        // Give a bit of time for profile to load
        const timeout = setTimeout(() => {
          setChecking(false)
        }, 2000)
        return () => clearTimeout(timeout)
      }

      // Company onboarding already completed - redirect to dashboard
      if (hasCompletedCompanyOnboarding) {
        console.log('[useCompanyOnboardingGuard] Company onboarding completed, redirecting to dashboard')
        router.replace("/dashboard")
        return
      }

      // Mark that we've started the company onboarding process
      markCompanyOnboardingStarted()

      // All checks passed - allow access
      setChecking(false)
    }

    verify()
  }, [isLoading, user, profile, pathname, router, hasCompletedCompanyOnboarding])

  return { checking }
}
