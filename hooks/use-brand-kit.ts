/**
 * Brand Kit Hook
 * @description Hook for extracting, managing, and persisting brand kits
 * @module hooks/use-brand-kit
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  BrandKit,
  BrandKitInsert,
  BrandKitUpdate,
  ExtractBrandKitResponse,
  RawExtractionData,
} from '@/types/brand-kit'

/**
 * State for extracted brand kit before saving
 */
export interface ExtractedBrandKitState {
  /** Website URL */
  websiteUrl: string
  /** Primary brand color (hex) */
  primaryColor: string
  /** Secondary brand color (hex) */
  secondaryColor: string | null
  /** Accent color (hex) */
  accentColor: string | null
  /** Background color (hex) */
  backgroundColor: string | null
  /** Text color (hex) */
  textColor: string | null
  /** Primary font family */
  fontPrimary: string | null
  /** Secondary font family */
  fontSecondary: string | null
  /** Extracted logo URL */
  logoUrl: string | null
  /** Raw extraction data */
  rawExtraction: RawExtractionData | null
}

/**
 * Hook return type for brand kit operations
 */
interface UseBrandKitReturn {
  /** Currently extracted brand kit (not yet saved) */
  extractedKit: ExtractedBrandKitState | null
  /** Saved brand kits from database */
  savedKits: BrandKit[]
  /** Currently active brand kit */
  activeKit: BrandKit | null
  /** Whether an extraction is in progress */
  isExtracting: boolean
  /** Whether brand kits are loading */
  isLoading: boolean
  /** Whether a save operation is in progress */
  isSaving: boolean
  /** Error message if any operation failed */
  error: string | null
  /** Extract brand kit from a URL */
  extractBrandKit: (url: string) => Promise<boolean>
  /** Update the extracted kit before saving */
  updateExtractedKit: (updates: Partial<ExtractedBrandKitState>) => void
  /** Save the extracted kit to database */
  saveBrandKit: (teamId?: string) => Promise<BrandKit | null>
  /** Update an existing brand kit */
  updateBrandKit: (id: string, updates: BrandKitUpdate) => Promise<boolean>
  /** Delete a brand kit */
  deleteBrandKit: (id: string) => Promise<boolean>
  /** Set a brand kit as active */
  setActiveKit: (id: string) => Promise<boolean>
  /** Fetch saved brand kits */
  fetchBrandKits: () => Promise<void>
  /** Clear extracted kit state */
  clearExtractedKit: () => void
  /** Clear error state */
  clearError: () => void
}

/**
 * Hook for extracting and managing brand kits
 * @returns Brand kit state and operations
 * @example
 * const { extractBrandKit, extractedKit, saveBrandKit, isExtracting } = useBrandKit()
 *
 * // Extract from URL
 * await extractBrandKit('https://stripe.com')
 *
 * // Modify if needed
 * updateExtractedKit({ primaryColor: '#000000' })
 *
 * // Save to database
 * await saveBrandKit()
 */
export function useBrandKit(): UseBrandKitReturn {
  const [extractedKit, setExtractedKit] = useState<ExtractedBrandKitState | null>(null)
  const [savedKits, setSavedKits] = useState<BrandKit[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetches saved brand kits from the database
   */
  const fetchBrandKits = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/brand-kit')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch brand kits')
      }

      setSavedKits(data.brandKits || [])
    } catch (err) {
      console.error('Failed to fetch brand kits:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch brand kits')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Extracts brand kit from a URL using the API
   */
  const extractBrandKit = useCallback(async (url: string): Promise<boolean> => {
    try {
      setIsExtracting(true)
      setError(null)
      setExtractedKit(null)

      const response = await fetch('/api/brand-kit/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data: ExtractBrandKitResponse = await response.json()

      if (!data.success || !data.brandKit) {
        throw new Error(data.error || 'Failed to extract brand kit')
      }

      setExtractedKit({
        websiteUrl: data.brandKit.websiteUrl,
        primaryColor: data.brandKit.primaryColor,
        secondaryColor: data.brandKit.secondaryColor,
        accentColor: data.brandKit.accentColor,
        backgroundColor: data.brandKit.backgroundColor,
        textColor: data.brandKit.textColor,
        fontPrimary: data.brandKit.fontPrimary,
        fontSecondary: data.brandKit.fontSecondary,
        logoUrl: data.brandKit.logoUrl,
        rawExtraction: data.brandKit.rawExtraction,
      })

      return true
    } catch (err) {
      console.error('Brand kit extraction error:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract brand kit')
      return false
    } finally {
      setIsExtracting(false)
    }
  }, [])

  /**
   * Updates the extracted kit state before saving
   */
  const updateExtractedKit = useCallback((updates: Partial<ExtractedBrandKitState>) => {
    setExtractedKit((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }, [])

  /**
   * Saves the extracted kit to the database
   */
  const saveBrandKit = useCallback(async (teamId?: string): Promise<BrandKit | null> => {
    if (!extractedKit) {
      setError('No brand kit to save')
      return null
    }

    try {
      setIsSaving(true)
      setError(null)

      const payload: BrandKitInsert = {
        userId: '', // Will be set by API from auth
        teamId: teamId || null,
        websiteUrl: extractedKit.websiteUrl,
        primaryColor: extractedKit.primaryColor,
        secondaryColor: extractedKit.secondaryColor,
        accentColor: extractedKit.accentColor,
        backgroundColor: extractedKit.backgroundColor,
        textColor: extractedKit.textColor,
        fontPrimary: extractedKit.fontPrimary,
        fontSecondary: extractedKit.fontSecondary,
        logoUrl: extractedKit.logoUrl,
        rawExtraction: extractedKit.rawExtraction,
        isActive: true,
      }

      const response = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save brand kit')
      }

      // Update local state
      setSavedKits((prev) => [data.brandKit, ...prev.map((k) => ({ ...k, isActive: false }))])
      setExtractedKit(null)

      return data.brandKit
    } catch (err) {
      console.error('Failed to save brand kit:', err)
      setError(err instanceof Error ? err.message : 'Failed to save brand kit')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [extractedKit])

  /**
   * Updates an existing brand kit
   */
  const updateBrandKit = useCallback(async (id: string, updates: BrandKitUpdate): Promise<boolean> => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/brand-kit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update brand kit')
      }

      // Update local state
      setSavedKits((prev) =>
        prev.map((kit) => (kit.id === id ? data.brandKit : kit))
      )

      return true
    } catch (err) {
      console.error('Failed to update brand kit:', err)
      setError(err instanceof Error ? err.message : 'Failed to update brand kit')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  /**
   * Deletes a brand kit
   */
  const deleteBrandKit = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null)

      const response = await fetch(`/api/brand-kit?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete brand kit')
      }

      // Update local state
      setSavedKits((prev) => prev.filter((kit) => kit.id !== id))

      return true
    } catch (err) {
      console.error('Failed to delete brand kit:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete brand kit')
      return false
    }
  }, [])

  /**
   * Sets a brand kit as active
   */
  const setActiveKit = useCallback(async (id: string): Promise<boolean> => {
    return updateBrandKit(id, { isActive: true })
  }, [updateBrandKit])

  /**
   * Clears the extracted kit state
   */
  const clearExtractedKit = useCallback(() => {
    setExtractedKit(null)
  }, [])

  /**
   * Clears the error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Compute active kit from saved kits
  const activeKit = savedKits.find((kit) => kit.isActive) || null

  return {
    extractedKit,
    savedKits,
    activeKit,
    isExtracting,
    isLoading,
    isSaving,
    error,
    extractBrandKit,
    updateExtractedKit,
    saveBrandKit,
    updateBrandKit,
    deleteBrandKit,
    setActiveKit,
    fetchBrandKits,
    clearExtractedKit,
    clearError,
  }
}
