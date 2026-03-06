"use client"

/**
 * Onboarding Join Page
 * @description Member onboarding path: search for organization, submit join request,
 * optionally connect LinkedIn, then redirect to pending approval screen.
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
} from '@tabler/icons-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TeamSearch } from '@/components/features/team-search'
import ConnectTools from '@/components/ConnectTools'
import { useJoinRequests } from '@/hooks/use-join-requests'
import { useOnboardingGuard } from '@/hooks/use-onboarding-guard'
import type { TeamSearchResult } from '@/components/features/team-search'

// ============================================================================
// Types
// ============================================================================

/** Step in the join flow */
type JoinStep = 'search' | 'request' | 'connect'

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

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Join onboarding page component
 * @returns Join flow JSX with multi-step UI
 */
export default function JoinPage() {
  const router = useRouter()
  const { checking } = useOnboardingGuard()
  const { submitRequest } = useJoinRequests()

  const [step, setStep] = useState<JoinStep>('search')
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchResult | null>(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)

  const stepIndex: Record<JoinStep, number> = { search: 0, request: 1, connect: 2 }

  const handleSelectTeam = useCallback((team: TeamSearchResult) => {
    setSelectedTeam(team)
    setStep('request')
  }, [])

  const handleSubmitRequest = useCallback(async () => {
    if (!selectedTeam) return

    setIsSubmitting(true)
    const request = await submitRequest(selectedTeam.id, message.trim() || undefined)
    setIsSubmitting(false)

    if (request) {
      toast.success('Request sent! Connecting LinkedIn next.')
      setStep('connect')
    }
  }, [selectedTeam, message, submitRequest])

  const handleContinueToPending = useCallback(() => {
    router.replace('/onboarding/join/pending')
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <StepDots current={stepIndex[step]} total={3} />

      <AnimatePresence mode="wait">
        {/* Step 1: Search */}
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
                <h1 className="text-2xl font-bold">Find your organization</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Search for the organization you want to join. Only discoverable organizations appear here.
              </p>
            </div>

            <TeamSearch onSelectTeam={handleSelectTeam} />

            <div className="flex justify-start">
              <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding')}>
                <IconArrowLeft className="size-4 mr-1.5" />
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Send request */}
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
                onClick={() => setStep('search')}
              >
                <IconArrowLeft className="size-4 mr-1.5" />
                Back
              </Button>
              <Button
                onClick={handleSubmitRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <IconLoader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <IconSend className="size-4 mr-1.5" />
                )}
                Send Request
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Connect LinkedIn */}
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
              <h1 className="text-2xl font-bold">Connect LinkedIn</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Connect your LinkedIn while waiting for approval. This helps us personalize your experience.
              </p>
            </div>

            <ConnectTools
              onLinkedInStatusChange={setLinkedinConnected}
            />

            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleContinueToPending}
              >
                Skip for now
                <IconArrowRight className="size-4 ml-1.5" />
              </Button>
              <Button onClick={handleContinueToPending}>
                {linkedinConnected ? (
                  <IconCheck className="size-4 mr-1.5" />
                ) : (
                  <IconArrowRight className="size-4 mr-1.5" />
                )}
                Continue
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
