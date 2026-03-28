/**
 * Swipe Suggestions Hook
 * @description Fetches and manages AI-generated post suggestions for the swipe interface
 * @module hooks/use-swipe-suggestions
 */

'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'
import type { PostSuggestion } from '@/components/features/swipe-interface'

/** Default number of suggestions to fetch */
const DEFAULT_LIMIT = 20

/** Batch size for loading more suggestions */
const BATCH_SIZE = 10

/**
 * Filter options for suggestion categories
 */
export interface SuggestionFilters {
  /** Filter by category (e.g., "Leadership", "Tech Trends") */
  category?: string
  /** Minimum engagement score (0-100) */
  minEngagement?: number
}

/**
 * Return type for the useSwipeSuggestions hook
 */
export interface UseSwipeSuggestionsReturn {
  /** Array of post suggestions to display */
  suggestions: PostSuggestion[]
  /** Loading state for initial fetch */
  isLoading: boolean
  /** Loading state for pagination */
  isLoadingMore: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Refetch suggestions from database */
  refetch: () => Promise<void>
  /** Whether more suggestions are available */
  hasMore: boolean
  /** Load more suggestions (pagination) */
  loadMore: () => Promise<void>
  /** Set of IDs that have been seen/swiped */
  seenIds: Set<string>
  /** Mark a suggestion as seen */
  markAsSeen: (id: string) => void
  /** Get remaining (unseen) suggestions */
  remainingSuggestions: PostSuggestion[]
  /** Total suggestions fetched */
  totalFetched: number
  /** Apply filters to suggestions */
  setFilters: (filters: SuggestionFilters) => void
  /** Current active filters */
  filters: SuggestionFilters
  /** Available categories */
  categories: string[]
}

/**
 * Transform database row to PostSuggestion format
 * @param post - Raw database row from inspiration_posts
 * @returns Formatted PostSuggestion object
 */
function transformToSuggestion(post: Tables<'inspiration_posts'>): PostSuggestion {
  // Capitalize first letter of category
  const category = post.category
    ? post.category.charAt(0).toUpperCase() + post.category.slice(1).replace(/-/g, ' ')
    : 'General'

  return {
    id: post.id,
    content: post.content,
    category,
    estimatedEngagement: post.engagement_score ?? undefined,
  }
}

/**
 * Hook to fetch and manage AI-generated post suggestions for swipe interface.
 * Handles pagination, filtering, and tracking seen suggestions.
 *
 * @param initialLimit - Initial number of suggestions to fetch (default: 20)
 * @returns Suggestions data, loading states, and management functions
 *
 * @example
 * ```tsx
 * const {
 *   suggestions,
 *   isLoading,
 *   remainingSuggestions,
 *   markAsSeen,
 *   refetch
 * } = useSwipeSuggestions()
 *
 * // When user swipes a card
 * markAsSeen(suggestion.id)
 *
 * // Filter by category
 * setFilters({ category: 'thought-leadership' })
 * ```
 */
export function useSwipeSuggestions(initialLimit = DEFAULT_LIMIT): UseSwipeSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState<SuggestionFilters>({})
  const [categories, setCategories] = useState<string[]>([])

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch suggestions from database with filters
   */
  const fetchSuggestions = useCallback(async (
    limit: number,
    currentOffset: number,
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)

      // Build query
      let query = supabase
        .from('inspiration_posts')
        .select('*')
        .order('engagement_score', { ascending: false, nullsFirst: false })
        .order('reactions', { ascending: false, nullsFirst: false })

      // Apply category filter
      if (filters.category) {
        query = query.eq('category', filters.category)
      }

      // Apply minimum engagement filter
      if (filters.minEngagement !== undefined) {
        query = query.gte('engagement_score', filters.minEngagement)
      }

      // Apply pagination
      query = query.range(currentOffset, currentOffset + limit - 1)

      const { data: postsData, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      if (!postsData || postsData.length === 0) {
        if (isRefresh) {
          setSuggestions([])
        }
        setHasMore(false)
        return
      }

      // Transform to PostSuggestion format
      const newSuggestions = postsData.map(transformToSuggestion)

      // Check if there are more results
      setHasMore(postsData.length === limit)

      if (isRefresh) {
        setSuggestions(newSuggestions)
        setOffset(limit)
        setSeenIds(new Set())
      } else {
        setSuggestions(prev => [...prev, ...newSuggestions])
        setOffset(currentOffset + postsData.length)
      }
    } catch (err) {
      console.error('Swipe suggestions fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.minEngagement])

  /**
   * Fetch available categories
   */
  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('inspiration_posts')
        .select('category')

      if (fetchError) {
        console.error('Failed to fetch categories:', fetchError)
        return
      }

      // Extract unique categories
      const uniqueCategories = [...new Set(
        data
          ?.map(p => p.category)
          .filter((c): c is string => c !== null)
      )]

      setCategories(uniqueCategories.sort())
    } catch (err) {
      console.error('Categories fetch error:', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Refetch suggestions (reset to beginning)
   */
  const refetch = useCallback(async () => {
    await fetchSuggestions(initialLimit, 0, true)
  }, [fetchSuggestions, initialLimit])

  /**
   * Load more suggestions (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    await fetchSuggestions(BATCH_SIZE, offset, false)
  }, [fetchSuggestions, offset, isLoadingMore, hasMore])

  /**
   * Mark a suggestion as seen
   */
  const markAsSeen = useCallback((id: string) => {
    setSeenIds(prev => new Set([...prev, id]))
  }, [])

  /**
   * Apply new filters and refetch
   */
  const handleSetFilters = useCallback((newFilters: SuggestionFilters) => {
    setFilters(newFilters)
  }, [])

  // Calculate remaining (unseen) suggestions
  const remainingSuggestions = useMemo(() => {
    return suggestions.filter(s => !seenIds.has(s.id))
  }, [suggestions, seenIds])

  // Initial fetch
  useEffect(() => {
    fetchSuggestions(initialLimit, 0, true)
    fetchCategories()
  }, []) // Only run on mount

  // Refetch when filters change
  useEffect(() => {
    if (filters.category !== undefined || filters.minEngagement !== undefined) {
      refetch()
    }
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load more when running low on unseen suggestions
  useEffect(() => {
    if (remainingSuggestions.length < 5 && hasMore && !isLoading && !isLoadingMore) {
      loadMore()
    }
  }, [remainingSuggestions.length, hasMore, isLoading, isLoadingMore, loadMore])

  return {
    suggestions,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    hasMore,
    loadMore,
    seenIds,
    markAsSeen,
    remainingSuggestions,
    totalFetched: suggestions.length,
    setFilters: handleSetFilters,
    filters,
    categories,
  }
}
