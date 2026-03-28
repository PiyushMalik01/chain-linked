/**
 * Generated Suggestions Hook
 * @description Manages AI-generated post suggestions for the swipe feature
 * @module hooks/use-generated-suggestions
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { GeneratedSuggestion, SuggestionStatus } from '@/types/database'

/** Maximum number of active suggestions allowed */
const MAX_ACTIVE_SUGGESTIONS = 10

/** Polling interval for generation status (ms) */
const POLLING_INTERVAL = 2000

/**
 * Generation status response from API
 */
interface GenerationStatusResponse {
  runId: string
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
  progress: number
  suggestionsRequested: number
  suggestionsGenerated: number
  postTypesUsed: string[] | null
  createdAt: string
  completedAt: string | null
  error?: string
}

/**
 * Suggestions API response
 */
interface SuggestionsResponse {
  suggestions: GeneratedSuggestion[]
  total: number
  hasMore: boolean
  canGenerate: boolean
  activeCount: number
  maxActive: number
}

/**
 * Return type for the useGeneratedSuggestions hook
 */
export interface UseGeneratedSuggestionsReturn {
  /** All fetched suggestions */
  suggestions: GeneratedSuggestion[]
  /** Suggestions with status = 'active' */
  remainingSuggestions: GeneratedSuggestion[]

  /** Loading state for initial fetch */
  isLoading: boolean
  /** Whether generation is in progress */
  isGenerating: boolean
  /** Generation progress 0-100 */
  generationProgress: number

  /** Trigger new suggestion generation */
  generateNew: () => Promise<boolean>
  /** Mark a suggestion as used */
  markAsUsed: (id: string) => Promise<boolean>
  /** Dismiss a suggestion (removes from active list) */
  dismissSuggestion: (id: string) => Promise<boolean>
  /** Cancel an in-progress generation */
  cancelGeneration: () => Promise<boolean>
  /** Refetch suggestions from server */
  refetch: () => Promise<void>

  /** Whether user can generate more suggestions */
  canGenerate: boolean
  /** Count of active suggestions */
  activeCount: number
  /** Error from fetch operations */
  error: string | null
  /** Error from generation operations */
  generationError: string | null
}

/**
 * Hook to manage AI-generated post suggestions for the swipe interface.
 * Handles fetching, generating, and updating suggestion statuses.
 *
 * @returns Suggestions data, generation state, and management functions
 *
 * @example
 * ```tsx
 * const {
 *   remainingSuggestions,
 *   isGenerating,
 *   generationProgress,
 *   generateNew,
 *   markAsUsed,
 *   dismissSuggestion
 * } = useGeneratedSuggestions()
 *
 * // Generate new suggestions
 * await generateNew()
 *
 * // When user likes a suggestion
 * await markAsUsed(suggestion.id)
 *
 * // When user dislikes/dismisses
 * await dismissSuggestion(suggestion.id)
 * ```
 */
export function useGeneratedSuggestions(): UseGeneratedSuggestionsReturn {
  // Suggestions state
  const [suggestions, setSuggestions] = useState<GeneratedSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canGenerate, setCanGenerate] = useState(true)
  const [activeCount, setActiveCount] = useState(0)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  // Polling interval ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Clear polling interval
   */
  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  /**
   * Fetch suggestions from API
   */
  const fetchSuggestions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/swipe/suggestions?status=active&limit=${MAX_ACTIVE_SUGGESTIONS}`)

      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated')
          return
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch suggestions')
      }

      const data: SuggestionsResponse = await response.json()

      setSuggestions(data.suggestions)
      setCanGenerate(data.canGenerate)
      setActiveCount(data.activeCount)
    } catch (err) {
      console.error('Fetch suggestions error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Poll generation status
   */
  const pollGenerationStatus = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/swipe/generation-status?runId=${runId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get generation status')
      }

      const data: GenerationStatusResponse = await response.json()

      setGenerationProgress(data.progress)

      // Check for completion or failure
      if (data.status === 'completed') {
        clearPolling()
        setIsGenerating(false)
        setCurrentRunId(null)
        setGenerationProgress(100)
        toast.success(`Generated ${data.suggestionsGenerated} new suggestions!`)

        // Refetch suggestions to get the new ones
        await fetchSuggestions()
      } else if (data.status === 'failed') {
        clearPolling()
        setIsGenerating(false)
        setCurrentRunId(null)
        setGenerationProgress(0)
        setGenerationError(data.error || 'Generation failed')
        toast.error(data.error || 'Failed to generate suggestions')
      }
    } catch (err) {
      console.error('Poll generation status error:', err)
      // Don't stop polling on transient errors
    }
  }, [clearPolling, fetchSuggestions])

  /**
   * Start polling for generation status
   */
  const startPolling = useCallback((runId: string) => {
    clearPolling()

    // Immediate first check
    pollGenerationStatus(runId)

    // Set up interval
    pollingRef.current = setInterval(() => {
      pollGenerationStatus(runId)
    }, POLLING_INTERVAL)
  }, [clearPolling, pollGenerationStatus])

  /**
   * Generate new suggestions
   */
  const generateNew = useCallback(async (): Promise<boolean> => {
    try {
      setIsGenerating(true)
      setGenerationProgress(0)
      setGenerationError(null)

      const response = await fetch('/api/swipe/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400 && data.error === 'Maximum suggestions reached') {
          toast.warning(data.message || 'You have too many active suggestions. Review them first.')
          setCanGenerate(false)
        } else if (response.status === 400 && (
          data.error === 'Onboarding not completed' ||
          data.error === 'Company context required'
        )) {
          toast.warning(data.message || 'Please complete company onboarding first. Go to Settings > Company to add your company details.')
        } else if (response.status === 409 && data.error === 'Generation in progress') {
          toast.info('Generation already in progress')
          // Resume polling for existing run
          if (data.runId) {
            setCurrentRunId(data.runId)
            startPolling(data.runId)
          }
          return false
        } else {
          throw new Error(data.error || 'Failed to start generation')
        }
        setIsGenerating(false)
        return false
      }

      // Generation started successfully
      setCurrentRunId(data.runId)
      toast.info(`Generating ${data.suggestionsRequested} suggestions...`)

      // Start polling for status
      startPolling(data.runId)

      return true
    } catch (err) {
      console.error('Generate suggestions error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions'
      setGenerationError(errorMessage)
      setIsGenerating(false)
      toast.error(errorMessage)
      return false
    }
  }, [startPolling])

  /**
   * Cancel an in-progress generation
   */
  const cancelGeneration = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/swipe/generate', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Failed to cancel generation')
        return false
      }
      clearPolling()
      setIsGenerating(false)
      setCurrentRunId(null)
      setGenerationProgress(0)
      setGenerationError(null)
      toast.info('Generation cancelled')
      return true
    } catch (err) {
      console.error('Cancel generation error:', err)
      toast.error('Failed to cancel generation')
      return false
    }
  }, [clearPolling])

  /**
   * Update suggestion status
   */
  const updateSuggestionStatus = useCallback(async (
    suggestionId: string,
    status: SuggestionStatus
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/swipe/suggestions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          suggestionId,
          status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update suggestion')
      }

      // Optimistically update local state
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId ? { ...s, status } : s
        )
      )

      // Update active count
      if (status !== 'active') {
        setActiveCount(prev => Math.max(0, prev - 1))
        setCanGenerate(true) // May now have room for more
      }

      return true
    } catch (err) {
      console.error('Update suggestion status error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update suggestion')
      return false
    }
  }, [])

  /**
   * Mark a suggestion as used
   */
  const markAsUsed = useCallback(async (id: string): Promise<boolean> => {
    return updateSuggestionStatus(id, 'used')
  }, [updateSuggestionStatus])

  /**
   * Dismiss a suggestion
   */
  const dismissSuggestion = useCallback(async (id: string): Promise<boolean> => {
    const success = await updateSuggestionStatus(id, 'dismissed')
    if (success) {
      toast.info('Suggestion dismissed')
    }
    return success
  }, [updateSuggestionStatus])

  /**
   * Refetch suggestions
   */
  const refetch = useCallback(async () => {
    await fetchSuggestions()
  }, [fetchSuggestions])

  // Calculate remaining suggestions (active only)
  const remainingSuggestions = useMemo(() => {
    return suggestions.filter(s => s.status === 'active')
  }, [suggestions])

  // Initial fetch
  useEffect(() => {
    fetchSuggestions()
  }, []) // Only run on mount

  // Check for existing generation on mount
  useEffect(() => {
    const checkExistingGeneration = async () => {
      try {
        const response = await fetch('/api/swipe/generation-status')
        if (response.ok) {
          const data = await response.json()

          // Skip if no generation runs exist
          if (data.hasRuns === false || data.status === 'none') return

          const statusData = data as GenerationStatusResponse
          // If there's an in-progress generation, resume polling
          if (statusData.status === 'pending' || statusData.status === 'generating') {
            setIsGenerating(true)
            setCurrentRunId(statusData.runId)
            setGenerationProgress(statusData.progress)
            startPolling(statusData.runId)
          }
        }
      } catch (err) {
        // Ignore errors - no existing generation
      }
    }

    checkExistingGeneration()
  }, [startPolling])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [clearPolling])

  return {
    suggestions,
    remainingSuggestions,
    isLoading,
    isGenerating,
    generationProgress,
    generateNew,
    cancelGeneration,
    markAsUsed,
    dismissSuggestion,
    refetch,
    canGenerate,
    activeCount,
    error,
    generationError
  }
}
