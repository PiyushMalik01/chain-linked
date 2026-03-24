/**
 * useRemix Hook
 * @description Hook for AI-powered post remix functionality with user context
 * @module hooks/use-remix
 */

'use client'

import { useState, useCallback } from 'react'

/**
 * Available remix tones
 */
export type RemixTone =
  | 'match-my-style'
  | 'professional'
  | 'casual'
  | 'inspiring'
  | 'educational'
  | 'thought-provoking'

/**
 * Available remix lengths
 */
export type RemixLength = 'short' | 'medium' | 'long'

/**
 * Remix request parameters
 */
export interface RemixParams {
  /** Original post content to remix */
  content: string
  /** Desired tone for the remix */
  tone?: RemixTone
  /** Target length */
  length?: RemixLength
  /** Optional custom instructions */
  instructions?: string
}

/**
 * Remix API response
 */
export interface RemixResult {
  /** Remixed content */
  content: string
  /** Original content (echoed back) */
  originalContent: string
  /** Metadata about the remix */
  metadata: {
    model: string
    tokensUsed: number
    tone: string
    length: string
    userContext: {
      hasProfile: boolean
      postsAnalyzed: number
      nichesDetected: number
      styleMatched: boolean
    }
  }
  /** AI tracking fields for generated_posts persistence */
  aiMetadata?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    model: string
    estimated_cost: number
    prompt_snapshot: Record<string, unknown>
  }
}

/**
 * Remix error response
 */
export interface RemixError {
  /** Error message */
  message: string
  /** Error code for categorization */
  code: string
}

/**
 * Remix hook state
 */
export interface UseRemixState {
  /** Whether a remix is in progress */
  isLoading: boolean
  /** The remix result if successful */
  result: RemixResult | null
  /** Error if remix failed */
  error: RemixError | null
}

/**
 * Remix hook actions
 */
export interface UseRemixActions {
  /** Execute a remix request */
  remix: (params: RemixParams) => Promise<RemixResult | null>
  /** Clear the current result */
  clearResult: () => void
  /** Clear any error */
  clearError: () => void
  /** Reset all state */
  reset: () => void
}

/**
 * Combined remix hook return type
 */
export type UseRemixReturn = UseRemixState & UseRemixActions

/**
 * Hook for AI-powered post remix functionality
 * @returns Remix state and actions
 * @example
 * const { isLoading, result, error, remix, reset } = useRemix()
 *
 * const handleRemix = async () => {
 *   const result = await remix({
 *     content: 'Original post content...',
 *     tone: 'match-my-style',
 *     apiKey: userApiKey,
 *   })
 *   if (result) {
 *     console.log('Remixed:', result.content)
 *   }
 * }
 */
export function useRemix(): UseRemixReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<RemixResult | null>(null)
  const [error, setError] = useState<RemixError | null>(null)

  /**
   * Execute a remix request
   */
  const remix = useCallback(async (params: RemixParams): Promise<RemixResult | null> => {
    const {
      content,
      tone = 'match-my-style',
      length = 'medium',
      instructions,
    } = params

    // Validate inputs
    if (!content?.trim()) {
      setError({ message: 'No content to remix', code: 'invalid_content' })
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          originalContent: content.trim(),
          tone,
          length,
          customInstructions: instructions?.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorResult: RemixError = {
          message: data.error || 'An unexpected error occurred',
          code: data.code || 'unknown',
        }
        setError(errorResult)
        setIsLoading(false)
        return null
      }

      const remixResult: RemixResult = data
      setResult(remixResult)
      setIsLoading(false)
      return remixResult
    } catch (err) {
      const errorResult: RemixError = {
        message: err instanceof Error ? err.message : 'Network error. Please try again.',
        code: 'network_error',
      }
      setError(errorResult)
      setIsLoading(false)
      return null
    }
  }, [])

  /**
   * Clear the current result
   */
  const clearResult = useCallback(() => {
    setResult(null)
  }, [])

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setResult(null)
    setError(null)
  }, [])

  return {
    isLoading,
    result,
    error,
    remix,
    clearResult,
    clearError,
    reset,
  }
}

/**
 * Tone options for UI display
 */
export const REMIX_TONE_OPTIONS: {
  value: RemixTone
  label: string
  description: string
}[] = [
  {
    value: 'match-my-style',
    label: 'Match My Style',
    description: 'Analyze your posts and match your unique voice',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Authoritative and industry-focused',
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Conversational and relatable',
  },
  {
    value: 'inspiring',
    label: 'Inspiring',
    description: 'Motivational and uplifting',
  },
  {
    value: 'educational',
    label: 'Educational',
    description: 'Informative how-to content',
  },
  {
    value: 'thought-provoking',
    label: 'Thought-Provoking',
    description: 'Challenges conventional thinking',
  },
]

/**
 * Length options for UI display
 */
export const REMIX_LENGTH_OPTIONS: {
  value: RemixLength
  label: string
  description: string
  charRange: { min: number; max: number }
}[] = [
  {
    value: 'short',
    label: 'Short',
    description: '400-700 characters',
    charRange: { min: 400, max: 700 },
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '1200-1800 characters',
    charRange: { min: 1200, max: 1800 },
  },
  {
    value: 'long',
    label: 'Long',
    description: '2200-2900 characters',
    charRange: { min: 2200, max: 2900 },
  },
]

/**
 * Checks if the error indicates missing API key
 * @param error - The remix error
 * @returns True if API key is missing
 */
export function isApiKeyMissingError(error: RemixError | null): boolean {
  return error?.code === 'no_api_key'
}

/**
 * Checks if the error indicates invalid API key
 * @param error - The remix error
 * @returns True if API key is invalid
 */
export function isApiKeyInvalidError(error: RemixError | null): boolean {
  return error?.code === 'invalid_api_key'
}

/**
 * Checks if the error indicates rate limiting
 * @param error - The remix error
 * @returns True if rate limited
 */
export function isRateLimitError(error: RemixError | null): boolean {
  return error?.code === 'rate_limit'
}
