"use client"

/**
 * Onboarding Entry Page
 * @description Shows role selection (org owner vs joining member) for new users.
 * Returns to redirect flow if user has already selected a path.
 * @module app/onboarding/page
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  IconBuilding,
  IconUsers,
  IconArrowRight,
  IconLoader2,
} from "@tabler/icons-react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"

// ============================================================================
// Types
// ============================================================================

/** Onboarding path selection */
type OnboardingType = 'owner' | 'member'

// ============================================================================
// Role card
// ============================================================================

/**
 * Selectable role card
 * @param props.type - Role type identifier
 * @param props.title - Card title
 * @param props.description - Card description
 * @param props.icon - Icon component
 * @param props.isSelected - Whether this card is currently selected
 * @param props.onSelect - Callback when card is selected
 */
function RoleCard({
  title,
  description,
  icon: Icon,
  isSelected,
  onSelect,
}: {
  title: string
  description: string
  icon: React.ElementType
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left p-6 rounded-2xl border-2 transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border/60 bg-card hover:border-border hover:shadow-sm'
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          'rounded-xl p-3 shrink-0 transition-colors',
          isSelected ? 'bg-primary/10' : 'bg-muted/60'
        )}>
          <Icon className={cn('size-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
        {isSelected && (
          <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
            <svg className="size-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    </motion.button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Onboarding entry component
 * Shows a role selection screen for new users. If the user already has an
 * onboarding_type set in their profile, redirect to the appropriate path.
 * @returns Role selection screen or loading state
 */
export default function OnboardingPage() {
  const router = useRouter()
  const {
    isLoading,
    isAuthenticated,
    hasCompletedOnboarding,
    currentOnboardingStep,
    user,
  } = useAuthContext()

  const [selected, setSelected] = useState<OnboardingType | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingType, setCheckingType] = useState(true)

  // Check if user already has an onboarding type set
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return

    const checkOnboardingType = async () => {
      try {
        const supabase = createClient()
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_type, onboarding_completed')
          .eq('id', user.id)
          .single()

        if (!profile) {
          setCheckingType(false)
          return
        }

        // If already completed, go to dashboard
        if (hasCompletedOnboarding) {
          router.replace('/dashboard')
          return
        }

        // If they've already chosen 'member' path, send to join
        if (profile.onboarding_type === 'member') {
          router.replace('/onboarding/join')
          return
        }

        // If they've already chosen 'owner' path, resume steps
        if (profile.onboarding_type === 'owner') {
          const step = currentOnboardingStep || 1
          router.replace(`/onboarding/step${step}`)
          return
        }

        setCheckingType(false)
      } catch {
        setCheckingType(false)
      }
    }

    checkOnboardingType()
  }, [isLoading, isAuthenticated, hasCompletedOnboarding, currentOnboardingStep, user, router])

  const handleContinue = async () => {
    if (!selected || !user) return

    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ onboarding_type: selected })
        .eq('id', user.id)

      if (selected === 'owner') {
        router.push('/onboarding/step1')
      } else {
        router.push('/onboarding/join')
      }
    } catch {
      setSaving(false)
    }
  }

  // Show loading while auth or type check is running
  if (isLoading || checkingType || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your progress...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        className="w-full max-w-lg space-y-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to ChainLinked</h1>
          <p className="text-muted-foreground">
            How would you like to get started?
          </p>
        </div>

        {/* Role cards */}
        <div className="space-y-4">
          <RoleCard
            title="I'm setting up my organization"
            description="Create your company profile, brand kit, and invite your team members. Perfect for founders and marketing leads."
            icon={IconBuilding}
            isSelected={selected === 'owner'}
            onSelect={() => setSelected('owner')}
          />
          <RoleCard
            title="I'm joining an existing organization"
            description="Search for your company and request to join. An admin will approve your request."
            icon={IconUsers}
            isSelected={selected === 'member'}
            onSelect={() => setSelected('member')}
          />
        </div>

        {/* Continue button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!selected || saving}
          onClick={handleContinue}
        >
          {saving ? (
            <IconLoader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <IconArrowRight className="size-4 mr-2" />
          )}
          Continue
        </Button>
      </motion.div>
    </div>
  )
}
