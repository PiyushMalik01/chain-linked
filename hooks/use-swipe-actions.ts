/**
 * Swipe Actions Hook
 * @description Handles swipe action recording and statistics for AI learning
 * @module hooks/use-swipe-actions
 */

'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

/** Swipe action type */
export type SwipeAction = 'like' | 'dislike'

/**
 * Represents a recorded swipe action
 */
export interface SwipeRecord {
  /** Unique identifier */
  id: string
  /** ID of the swiped post/suggestion */
  postId: string | null
  /** Content of the suggestion (for learning) */
  content: string | null
  /** The swipe action taken */
  action: SwipeAction
  /** Timestamp of the swipe */
  createdAt: string
}

/**
 * Statistics about swipe activity
 */
export interface SwipeStats {
  /** Total likes (right swipes) */
  likes: number
  /** Total dislikes (left swipes) */
  dislikes: number
  /** Total swipes */
  total: number
  /** Like rate percentage */
  likeRate: number
}

/**
 * Return type for the useSwipeActions hook
 */
export interface UseSwipeActionsReturn {
  /** Record a swipe action to the database */
  recordSwipe: (
    suggestionId: string,
    action: SwipeAction,
    content?: string
  ) => Promise<boolean>
  /** Current session swipe statistics */
  sessionStats: SwipeStats
  /** All-time swipe statistics for the user */
  allTimeStats: SwipeStats
  /** Capture rate (percentage of suggestions with recorded swipes) */
  captureRate: number
  /** Recent swipe records */
  recentSwipes: SwipeRecord[]
  /** Whether a swipe is currently being recorded */
  isRecording: boolean
  /** Error message if recording failed */
  error: string | null
  /** Number of suggestions shown in this session */
  suggestionsShown: number
  /** Increment suggestions shown counter */
  incrementShown: () => void
  /** Reset session statistics */
  resetSession: () => void
  /** Fetch user's swipe history */
  fetchHistory: (limit?: number) => Promise<void>
  /** Check if a specific post has been swiped */
  hasBeenSwiped: (postId: string) => boolean
}

/**
 * Transform database row to SwipeRecord
 */
function transformToSwipeRecord(row: Tables<'swipe_preferences'>): SwipeRecord {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.suggestion_content,
    action: row.action as SwipeAction,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/**
 * Calculate stats from swipe records
 */
function calculateStats(swipes: SwipeRecord[]): SwipeStats {
  const likes = swipes.filter(s => s.action === 'like').length
  const dislikes = swipes.filter(s => s.action === 'dislike').length
  const total = likes + dislikes
  const likeRate = total > 0 ? Math.round((likes / total) * 100) : 0

  return { likes, dislikes, total, likeRate }
}

/**
 * Hook to handle swipe action recording and statistics.
 * Records swipes to the database for AI learning and provides stats.
 *
 * @returns Swipe action functions and statistics
 *
 * @example
 * ```tsx
 * const {
 *   recordSwipe,
 *   sessionStats,
 *   captureRate,
 *   incrementShown
 * } = useSwipeActions()
 *
 * // When showing a new suggestion
 * incrementShown()
 *
 * // When user swipes
 * const success = await recordSwipe(suggestion.id, 'like', suggestion.content)
 *
 * // Display stats
 * <p>Capture rate: {captureRate}%</p>
 * ```
 */
export function useSwipeActions(): UseSwipeActionsReturn {
  // Session state
  const [sessionSwipes, setSessionSwipes] = useState<SwipeRecord[]>([])
  const [suggestionsShown, setSuggestionsShown] = useState(0)

  // History state
  const [recentSwipes, setRecentSwipes] = useState<SwipeRecord[]>([])
  const [allTimeSwipes, setAllTimeSwipes] = useState<SwipeRecord[]>([])
  const [swipedPostIds, setSwipedPostIds] = useState<Set<string>>(new Set())

  // Loading/error state
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Record a swipe action to the database
   */
  const recordSwipe = useCallback(async (
    suggestionId: string,
    action: SwipeAction,
    content?: string
  ): Promise<boolean> => {
    try {
      setIsRecording(true)
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('User not authenticated, cannot record swipe')
        setError('Not authenticated')
        return false
      }

      // Insert swipe preference
      // Note: post_id is set to null for AI suggestions since they don't exist in posts tables
      // The content is stored in suggestion_content for AI learning purposes
      const { data, error: insertError } = await supabase
        .from('swipe_preferences')
        .insert({
          user_id: user.id,
          post_id: null, // AI suggestions don't have real post IDs
          suggestion_content: content || null,
          action: action,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error recording swipe:', insertError)
        setError(insertError.message)
        return false
      }

      // Add to session swipes
      if (data) {
        const record = transformToSwipeRecord(data)
        setSessionSwipes(prev => [...prev, record])
        setRecentSwipes(prev => [record, ...prev.slice(0, 9)])
        setSwipedPostIds(prev => new Set([...prev, suggestionId]))
      }

      return true
    } catch (err) {
      console.error('Swipe recording error:', err)
      setError(err instanceof Error ? err.message : 'Failed to record swipe')
      return false
    } finally {
      setIsRecording(false)
    }
  }, [supabase])

  /**
   * Fetch user's swipe history
   */
  const fetchHistory = useCallback(async (limit = 50) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('swipe_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) {
        console.error('Error fetching swipe history:', fetchError)
        return
      }

      if (data) {
        const records = data.map(transformToSwipeRecord)
        setRecentSwipes(records.slice(0, 10))
        setAllTimeSwipes(records)
        setSwipedPostIds(new Set(
          records
            .map(r => r.postId)
            .filter((id): id is string => id !== null)
        ))
      }
    } catch (err) {
      console.error('Fetch history error:', err)
    }
  }, [supabase])

  /**
   * Increment suggestions shown counter
   */
  const incrementShown = useCallback(() => {
    setSuggestionsShown(prev => prev + 1)
  }, [])

  /**
   * Reset session statistics
   */
  const resetSession = useCallback(() => {
    setSessionSwipes([])
    setSuggestionsShown(0)
  }, [])

  /**
   * Check if a specific post has been swiped
   */
  const hasBeenSwiped = useCallback((postId: string): boolean => {
    return swipedPostIds.has(postId)
  }, [swipedPostIds])

  // Calculate session statistics
  const sessionStats = useMemo(() => calculateStats(sessionSwipes), [sessionSwipes])

  // Calculate all-time statistics
  const allTimeStats = useMemo(() => calculateStats(allTimeSwipes), [allTimeSwipes])

  // Calculate capture rate (swipes / suggestions shown)
  const captureRate = useMemo(() => {
    if (suggestionsShown === 0) return 0
    return Math.round((sessionStats.total / suggestionsShown) * 100)
  }, [sessionStats.total, suggestionsShown])

  // Fetch history on mount
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    recordSwipe,
    sessionStats,
    allTimeStats,
    captureRate,
    recentSwipes,
    isRecording,
    error,
    suggestionsShown,
    incrementShown,
    resetSession,
    fetchHistory,
    hasBeenSwiped,
  }
}
