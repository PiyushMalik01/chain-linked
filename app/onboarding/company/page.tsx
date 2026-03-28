/**
 * Company Setup Page
 * @description Onboarding page for creating a new company.
 * Part of the company onboarding flow that users must complete
 * before accessing the dashboard.
 * @module app/onboarding/company
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'

import { CompanySetupForm } from '@/components/features/company-setup-form'
import { useCompany } from '@/hooks/use-company'
import { useAuthContext } from '@/lib/auth/auth-provider'
import { markCompanyOnboardingComplete, completeOnboardingInDatabase } from '@/services/onboarding'
import type { CompanyWithTeam } from '@/types/database'

/**
 * Company Setup Page Component
 *
 * Onboarding step 1: Create a company.
 * Redirects to invite page after successful company creation.
 * If user already has a company and completed onboarding, redirects to dashboard.
 *
 * Flow:
 * 1. Check if user has completed company onboarding
 * 2. If yes, redirect to dashboard
 * 3. If no, show company setup form
 * 4. On form completion, mark onboarding complete and redirect
 *
 * @returns Company setup page JSX
 * @example
 * // Route: /onboarding/company
 * <CompanySetupPage />
 */
export default function CompanySetupPage() {
  const router = useRouter()
  const { company, isLoading: isCompanyLoading, hasCompany } = useCompany()
  const { isLoading: isAuthLoading, hasCompletedCompanyOnboarding, refreshProfile } = useAuthContext()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Combine loading states
  const isLoading = isCompanyLoading || isAuthLoading

  // If user already completed company onboarding, redirect to dashboard
  useEffect(() => {
    if (!isLoading && hasCompletedCompanyOnboarding) {
      router.replace('/dashboard')
    }
  }, [isLoading, hasCompletedCompanyOnboarding, router])

  // If user already has a company but hasn't completed onboarding,
  // mark onboarding complete and redirect to dashboard
  useEffect(() => {
    if (!isLoading && hasCompany && !hasCompletedCompanyOnboarding && !isSaving) {
      const completeAndRedirect = async () => {
        setIsSaving(true)
        await markCompanyOnboardingComplete({
          companyName: company?.name ?? undefined,
        })
        await refreshProfile()
        router.replace('/dashboard')
      }
      completeAndRedirect()
    }
  }, [isLoading, hasCompany, hasCompletedCompanyOnboarding, company, isSaving, refreshProfile, router])

  /**
   * Handle successful company creation
   * Marks both company_onboarding_completed and onboarding_completed as true
   * and navigates to invite page or dashboard
   * @param createdCompany - Newly created company data
   */
  const handleComplete = async (createdCompany: CompanyWithTeam) => {
    setIsRedirecting(true)

    // Mark company onboarding as complete in the database
    const companySuccess = await markCompanyOnboardingComplete({
      companyName: createdCompany.name,
    })

    // Also mark full onboarding as complete
    await completeOnboardingInDatabase()

    if (companySuccess) {
      // Refresh the profile to update the context
      await refreshProfile()
    }

    // Navigate to invite page with team ID
    const teamId = createdCompany.team?.id
    if (teamId) {
      router.push(`/onboarding/invite?teamId=${teamId}&company=${encodeURIComponent(createdCompany.name)}`)
    } else {
      router.push('/dashboard')
    }
  }

  /**
   * Handle skip action - mark both onboarding flags complete and go to dashboard
   */
  const handleSkip = async () => {
    setIsRedirecting(true)
    // Mark company onboarding as complete
    await markCompanyOnboardingComplete()
    // Mark full onboarding as complete
    await completeOnboardingInDatabase()
    await refreshProfile()
    router.push('/dashboard')
  }

  // Show loading state while checking company status
  if (isLoading || isRedirecting || isSaving) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {isRedirecting ? 'Setting up your company...' :
             isSaving ? 'Saving your progress...' :
             'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  // If user has already completed onboarding, show loading while redirect happens
  if (hasCompletedCompanyOnboarding) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  /**
   * Handle join request sent — mark onboarding complete and let user proceed
   */
  const handleJoinRequestSent = async () => {
    // Mark onboarding as complete so the user can access the dashboard
    await completeOnboardingInDatabase()
    await refreshProfile()
  }

  return (
    <div className="flex flex-col items-center justify-start pt-8 pb-12">
      <CompanySetupForm
        onComplete={handleComplete}
        onJoinRequestSent={handleJoinRequestSent}
        onSkip={handleSkip}
        showSkip={true}
      />
    </div>
  )
}
