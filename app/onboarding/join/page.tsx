"use client"

/**
 * Onboarding Join Page (Individual Path)
 * @description Individual onboarding path: connect LinkedIn (required),
 * optionally search for a company to join, then complete onboarding.
 * @module app/onboarding/join/page
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconSearch,
  IconSend,
  IconBrandLinkedin,
} from '@tabler/icons-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TeamSearch } from '@/components/features/team-search'
import ConnectTools from '@/components/ConnectTools'
import { useJoinRequests } from '@/hooks/use-join-requests'
import { useOnboardingGuard } from '@/hooks/use-onboarding-guard'
import { completeOnboardingInDatabase } from '@/services/onboarding'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { TeamSearchResult } from '@/components/features/team-search'

// ============================================================================
// Types
// ============================================================================

/** Step in the individual join flow */
type JoinStep = 'connect' | 'search' | 'request'

// ============================================================================
// Step indicator
// ============================================================================

/**
 * Simple step dots indicator
 * @param props.current - Current step index (0-based)
 * @param props.total - Total step count
 */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === current
              ? 'w-6 bg-primary'
              : i < current
                ? 'w-1.5 bg-primary/50'
                : 'w-1.5 bg-muted'
          )}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Individual onboarding page component
 * Flow: Connect LinkedIn (required) → Search company (skippable) → Enter platform
 * @returns Join flow JSX with multi-step UI
 */
export default function JoinPage() {
  const router = useRouter()
  const { checking } = useOnboardingGuard()
  const { submitRequest } = useJoinRequests()
  const { refreshProfile } = useAuthContext()

  const [step, setStep] = useState<JoinStep>('connect')
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchResult | null>(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)

  const stepIndex: Record<JoinStep, number> = { connect: 0, search: 1, request: 1 }

  /**
   * Handles proceeding from LinkedIn connect to company search step
   */
  const handleLinkedInNext = useCallback(() => {
    if (!linkedinConnected) {
      toast.error('Please connect your LinkedIn to continue.')
      return
    }
    setStep('search')
  }, [linkedinConnected])

  /**
   * Handles selecting a team from search results
   */
  const handleSelectTeam = useCallback((team: TeamSearchResult) => {
    setSelectedTeam(team)
    setStep('request')
  }, [])

  /**
   * Completes onboarding and navigates to the dashboard
   */
  const handleCompleteOnboarding = useCallback(async () => {
    setIsCompleting(true)
    try {
      const success = await completeOnboardingInDatabase()
      if (success) {
        await refreshProfile()
        router.replace('/dashboard')
      } else {
        toast.error('Failed to complete setup. Please try again.')
        setIsCompleting(false)
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
      setIsCompleting(false)
    }
  }, [refreshProfile, router])

  /**
   * Handles submitting a join request to the selected team
   */
  const handleSubmitRequest = useCallback(async () => {
    if (!selectedTeam) return

    setIsSubmitting(true)
    const request = await submitRequest(selectedTeam.id, message.trim() || undefined)
    setIsSubmitting(false)

    if (request) {
      toast.success('Request sent! You can now enter the platform.')
      await handleCompleteOnboarding()
    }
  }, [selectedTeam, message, submitRequest, handleCompleteOnboarding])

  /**
   * Skips company search and completes onboarding
   */
  const handleSkipCompanySearch = useCallback(async () => {
    await handleCompleteOnboarding()
  }, [handleCompleteOnboarding])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <StepDots current={stepIndex[step]} total={2} />

      <AnimatePresence mode="wait">
        {/* Step 1: Connect LinkedIn */}
        {step === 'connect' && (
          <motion.div
            key="connect"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconBrandLinkedin className="size-4 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Connect your LinkedIn</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Link your LinkedIn profile to get started. This is required to personalize your experience.
              </p>
            </div>

            <ConnectTools
              onLinkedInStatusChange={setLinkedinConnected}
              compact
            />

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding')}>
                <IconArrowLeft className="size-4 mr-1.5" />
                Back
              </Button>
              <Button
                onClick={handleLinkedInNext}
                disabled={!linkedinConnected}
              >
                Next
                <IconArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Search for company */}
        {step === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconSearch className="size-4 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Find your company</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Search for your company to join their team, or skip this step to get started right away.
              </p>
            </div>

            <TeamSearch onSelectTeam={handleSelectTeam} />

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep('connect')}>
                <IconArrowLeft className="size-4 mr-1.5" />
                Back
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipCompanySearch}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <IconLoader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <IconArrowRight className="size-4 mr-1.5" />
                )}
                Skip &amp; Enter Platform
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2b: Send join request (shown after selecting a team) */}
        {step === 'request' && selectedTeam && (
          <motion.div
            key="request"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <IconSend className="size-4 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Request to join</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Send a join request to{' '}
                <span className="font-medium text-foreground">{selectedTeam.name}</span>.
                An admin will review and approve it.
              </p>
            </div>

            {/* Selected team card */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-sm font-semibold">{selectedTeam.name}</p>
              {selectedTeam.company_name && (
                <p className="text-xs text-muted-foreground">{selectedTeam.company_name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedTeam.member_count} member{selectedTeam.member_count !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Optional message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium">
                Message <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Introduce yourself or explain why you want to join..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTeam(null)
                  setStep('search')
                }}
              >
                <IconArrowLeft className="size-4 mr-1.5" />
                Back
              </Button>
              <Button
                onClick={handleSubmitRequest}
                disabled={isSubmitting || isCompleting}
              >
                {isSubmitting || isCompleting ? (
                  <IconLoader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <IconSend className="size-4 mr-1.5" />
                )}
                Send Request &amp; Enter Platform
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
