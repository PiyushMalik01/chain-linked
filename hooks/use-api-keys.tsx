/**
 * API Keys Hook
 * @description Manages user API keys (BYOK) with a shared React context so
 * every consumer shares a single fetch instead of each component hitting the API independently.
 * @module hooks/use-api-keys
 */

'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as React from 'react'

/**
 * API key provider type
 */
export type ApiKeyProvider = 'openai'

/**
 * API key status response from the server
 */
export interface ApiKeyStatus {
  /** Whether the user has an API key configured */
  hasKey: boolean
  /** The API key provider */
  provider: ApiKeyProvider
  /** Masked hint showing last 4 characters */
  keyHint: string | null
  /** Whether the key is valid (last validation result) */
  isValid: boolean
  /** Timestamp of last validation */
  lastValidated: string | null
}

/**
 * Hook return type
 */
export interface UseApiKeysReturn {
  /** Current API key status */
  status: ApiKeyStatus | null
  /** Loading state */
  isLoading: boolean
  /** Saving state */
  isSaving: boolean
  /** Validating state */
  isValidating: boolean
  /** Error message */
  error: string | null
  /** Save or update an API key */
  saveApiKey: (apiKey: string, provider?: ApiKeyProvider) => Promise<boolean>
  /** Delete the API key */
  deleteApiKey: (provider?: ApiKeyProvider) => Promise<boolean>
  /** Re-validate the existing API key */
  validateApiKey: () => Promise<boolean>
  /** Refetch the API key status */
  refetch: () => Promise<void>
  /** Clear the error state */
  clearError: () => void
}

/**
 * Default API key status
 */
const DEFAULT_STATUS: ApiKeyStatus = {
  hasKey: false,
  provider: 'openai',
  keyHint: null,
  isValid: false,
  lastValidated: null,
}

const ApiKeysContext = createContext<UseApiKeysReturn | null>(null)

/**
 * Provider component that fetches API key status once and shares it with all consumers.
 * Mount this high in the component tree (e.g. in providers.tsx).
 * @param props.children - Child components
 */
export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch the current API key status
   */
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/settings/api-keys', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          setStatus(DEFAULT_STATUS)
          return
        }
        throw new Error('Failed to fetch API key status')
      }

      const data: ApiKeyStatus = await response.json()
      setStatus(data)
    } catch (err) {
      console.error('API key fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch API key status')
      setStatus(DEFAULT_STATUS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Save or update an API key
   */
  const saveApiKey = useCallback(async (
    apiKey: string,
    provider: ApiKeyProvider = 'openai'
  ): Promise<boolean> => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to save API key')
        return false
      }

      setStatus({
        hasKey: true,
        provider,
        keyHint: data.keyHint,
        isValid: data.isValid,
        lastValidated: data.lastValidated,
      })

      return true
    } catch (err) {
      console.error('API key save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save API key')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  /**
   * Delete the API key
   */
  const deleteApiKey = useCallback(async (
    provider: ApiKeyProvider = 'openai'
  ): Promise<boolean> => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to delete API key')
        return false
      }

      setStatus({
        ...DEFAULT_STATUS,
        provider,
      })

      return true
    } catch (err) {
      console.error('API key delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  /**
   * Re-validate the existing API key
   */
  const validateApiKey = useCallback(async (): Promise<boolean> => {
    try {
      setIsValidating(true)
      setError(null)

      const response = await fetch('/api/settings/api-keys', {
        method: 'PATCH',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to validate API key')
        return false
      }

      setStatus(prev => prev ? {
        ...prev,
        isValid: data.isValid,
        lastValidated: data.lastValidated,
      } : prev)

      if (!data.isValid && data.error) {
        setError(data.error)
      }

      return data.isValid
    } catch (err) {
      console.error('API key validation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to validate API key')
      return false
    } finally {
      setIsValidating(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Fetch status once on mount
  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: UseApiKeysReturn = {
    status,
    isLoading,
    isSaving,
    isValidating,
    error,
    saveApiKey,
    deleteApiKey,
    validateApiKey,
    refetch: fetchStatus,
    clearError,
  }

  return (
    <ApiKeysContext.Provider value={value}>
      {children}
    </ApiKeysContext.Provider>
  )
}

/**
 * Hook to manage user API keys (BYOK - Bring Your Own Key).
 * Reads from the shared ApiKeysProvider context — all consumers share a single fetch.
 * @returns API key status, loading states, and management functions
 * @example
 * const { status, saveApiKey, deleteApiKey, isLoading, error } = useApiKeys()
 */
export function useApiKeys(): UseApiKeysReturn {
  const context = useContext(ApiKeysContext)
  if (!context) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider')
  }
  return context
}
