"use client"

/**
 * Onboarding Step 1 - Connect
 * @description Connect LinkedIn tools, saves progress to database
 * @module app/onboarding/step1/page
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { trackOnboardingStep } from "@/lib/analytics"
import ConnectTools from "@/components/ConnectTools"
import { Button } from "@/components/ui/button"
import { useOnboardingGuard } from "@/hooks/use-onboarding-guard"
import { updateOnboardingStepInDatabase } from "@/services/onboarding"
import { useAuthContext } from "@/lib/auth/auth-provider"

/** Current step number for this page */
const CURRENT_STEP = 1

/**
 * Step 1 component
 * Handles LinkedIn tool connections
 * Saves progress to database when moving to next step
 * @returns Step 1 JSX
 */
export default function Step1() {
  const router = useRouter()
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
   * Handles transition to step 2
   * Validates LinkedIn connection and saves progress to database
   */
  const handleNext = async () => {
    setSaving(true)

    if (!linkedinConnected) {
      toast.error("Connect LinkedIn to continue.")
      setSaving(false)
      return
    }

    try {
      // Update step progress in database
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
              Next
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
