"use client"

/**
 * Onboarding Step 1 - Connect
 * @description Connect LinkedIn tools, saves progress to database
 * @module app/onboarding/step1/page
 */

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { trackOnboardingStep } from "@/lib/analytics"
import ConnectTools from "@/components/ConnectTools"
import { Button } from "@/components/ui/button"
import { useOnboardingGuard } from "@/hooks/use-onboarding-guard"
import { updateOnboardingStepInDatabase, completeOnboardingInDatabase } from "@/services/onboarding"
import { useAuthContext } from "@/lib/auth/auth-provider"

/** Current step number for this page */
const CURRENT_STEP = 1

/**
 * Step 1 component
 * Handles LinkedIn tool connections
 * Saves progress to database when moving to next step
 * @returns Step 1 JSX
 */
function Step1Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { checking } = useOnboardingGuard()
  const { refreshProfile } = useAuthContext()
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [saving, setSaving] = useState(false)

  /**
   * Updates the current step in the database on mount
   */
  useEffect(() => {
    if (checking) return
    // Ensure database reflects we're on step 1
    updateOnboardingStepInDatabase(CURRENT_STEP)
  }, [checking])

  /**
   * Handles transition to step 2, or accepts invite and completes onboarding
   * if an invite token is present.
   * Validates LinkedIn connection and saves progress to database.
   */
  const handleNext = async () => {
    setSaving(true)

    if (!linkedinConnected) {
      toast.error("Connect LinkedIn to continue.")
      setSaving(false)
      return
    }

    try {
      // If invite token is present, accept the invite and complete onboarding
      if (inviteToken) {
        try {
          const response = await fetch('/api/teams/accept-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inviteToken }),
          })

          const result = await response.json()

          if (response.ok && result.success) {
            toast.success(`Welcome to ${result.team?.name || 'the team'}!`)
          } else {
            toast.error(result.error || 'Failed to accept invitation. You can try again from your dashboard.')
          }
        } catch (err) {
          console.error('Error accepting invite:', err)
          toast.error('Failed to accept invitation. You can try again from your dashboard.')
        }

        // Complete onboarding regardless of invite acceptance result
        await completeOnboardingInDatabase()
        await refreshProfile()
        trackOnboardingStep(CURRENT_STEP, true)
        router.push('/dashboard')
        return
      }

      // Standard flow: update step progress and go to step 2
      await updateOnboardingStepInDatabase(2)

      // Refresh profile to sync auth context with database
      await refreshProfile()

      // Track analytics
      trackOnboardingStep(CURRENT_STEP, true)

      // Navigate to next step
      router.push("/onboarding/step2")
    } catch (err) {
      console.error("Error saving step 1:", err)
      toast.error("Failed to save progress. Please try again.")
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <ConnectTools
        onLinkedInStatusChange={setLinkedinConnected}
        onSavingChange={setSaving}
      />

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push('/onboarding')}
        >
          Back
        </Button>
        <Button
          disabled={!linkedinConnected || saving}
          onClick={handleNext}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {inviteToken ? 'Connect & Join Team' : 'Next'}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Step 1 page wrapped in Suspense for useSearchParams compatibility
 * @returns Suspense-wrapped Step 1 page
 */
export default function Step1() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Step1Content />
    </Suspense>
  )
}
