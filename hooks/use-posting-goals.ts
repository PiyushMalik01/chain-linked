/**
 * Posting Goals Hook
 * @description Fetches and manages posting goals from Supabase
 * @module hooks/use-posting-goals
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { Tables } from '@/types/database'
import type { Goal } from '@/components/features/goals-tracker'


/**
 * Computes the start and end ISO date strings for a given goal period
 * @param period - The goal period (daily, weekly, monthly)
 * @returns Object with start and end ISO date strings
 */
export function getGoalPeriodDates(period: 'daily' | 'weekly' | 'monthly'): { start: string; end: string } {
  const now = new Date()
  let start: Date
  let end: Date

  switch (period) {
    case 'daily': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(start)
      end.setDate(end.getDate() + 1)
      end.setMilliseconds(end.getMilliseconds() - 1)
      break
    }
    case 'weekly': {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday = start of week
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
      end = new Date(start)
      end.setDate(end.getDate() + 7)
      end.setMilliseconds(end.getMilliseconds() - 1)
      break
    }
    case 'monthly': {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      break
    }
  }

  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Hook return type for posting goals data
 */
interface UsePostingGoalsReturn {
  /** Formatted goals for the GoalsTracker component */
  goals: Goal[]
  /** Raw data from database */
  rawGoals: Tables<'posting_goals'>[]
  /** Current posting streak in days */
  currentStreak: number
  /** Best posting streak achieved */
  bestStreak: number
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Refetch goals */
  refetch: () => Promise<void>
  /** Update a goal's target */
  updateGoalTarget: (goalId: string, target: number) => Promise<void>
  /** Create a new goal */
  createGoal: (period: 'daily' | 'weekly' | 'monthly', target: number) => Promise<void>
  /** Remove a goal */
  removeGoal: (goalId: string) => Promise<void>
}

/**
 * Calculate posting streak from posts
 * @param posts - Array of posts with posted_at dates
 * @returns Current streak and best streak
 */
function calculateStreaks(posts: { posted_at: string | null }[]): { current: number; best: number } {
  if (!posts || posts.length === 0) {
    return { current: 0, best: 0 }
  }

  // Sort posts by date descending (most recent first)
  const sortedPosts = posts
    .filter(p => p.posted_at)
    .sort((a, b) => new Date(b.posted_at!).getTime() - new Date(a.posted_at!).getTime())

  if (sortedPosts.length === 0) {
    return { current: 0, best: 0 }
  }

  // Get unique posting dates
  const postingDates = new Set<string>()
  sortedPosts.forEach(post => {
    const date = new Date(post.posted_at!)
    postingDates.add(date.toISOString().split('T')[0])
  })

  const uniqueDates = Array.from(postingDates).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  )

  // Calculate current streak
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if the most recent post is today or yesterday
  const mostRecentDate = new Date(uniqueDates[0])
  mostRecentDate.setHours(0, 0, 0, 0)

  if (mostRecentDate.getTime() === today.getTime() || mostRecentDate.getTime() === yesterday.getTime()) {
    currentStreak = 1
    let checkDate = new Date(mostRecentDate)
    checkDate.setDate(checkDate.getDate() - 1)

    for (let i = 1; i < uniqueDates.length; i++) {
      const postDate = new Date(uniqueDates[i])
      postDate.setHours(0, 0, 0, 0)

      if (postDate.getTime() === checkDate.getTime()) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Calculate best streak
  let bestStreak = currentStreak
  let tempStreak = 1

  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i - 1])
    const prevDate = new Date(uniqueDates[i])
    currentDate.setHours(0, 0, 0, 0)
    prevDate.setHours(0, 0, 0, 0)

    const daysDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 1) {
      tempStreak++
    } else {
      bestStreak = Math.max(bestStreak, tempStreak)
      tempStreak = 1
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak)

  return { current: currentStreak, best: bestStreak }
}

/**
 * Hook to fetch posting goals from Supabase
 * @param userId - User ID to fetch goals for (optional, uses current user if not provided)
 * @returns Posting goals data, streaks, loading state, and management functions
 * @example
 * const { goals, currentStreak, bestStreak, isLoading, updateGoalTarget } = usePostingGoals()
 */
export function usePostingGoals(userId?: string): UsePostingGoalsReturn {
  // Get auth state from context
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization
  const [goals, setGoals] = useState<Goal[]>([])
  const [rawGoals, setRawGoals] = useState<Tables<'posting_goals'>[]>([])
  const [currentStreak, setCurrentStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch posting goals from database
   */
  const fetchGoals = useCallback(async () => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      return
    }

    // Determine target user ID
    const targetUserId = userId || user?.id

    // If no user (not authenticated), return empty state
    if (!targetUserId) {
      setGoals([])
      setRawGoals([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch posting goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('posting_goals')
        .select('*')
        .eq('user_id', targetUserId)
        .order('period', { ascending: true })

      // If table doesn't exist or error, return empty state
      if (goalsError) {
        console.warn('Posting goals fetch warning:', goalsError.message)
        setGoals([])
        setRawGoals([])
        setIsLoading(false)
        return
      }

      // Fetch posts for streak calculation
      const { data: postsData, error: postsError } = await supabase
        .from('my_posts')
        .select('posted_at')
        .eq('user_id', targetUserId)
        .not('posted_at', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(365) // Last year of posts for streak calculation

      if (postsError) {
        console.warn('Error fetching posts for streak calculation:', postsError)
      }

      // Calculate streaks
      const streaks = calculateStreaks(postsData || [])
      setCurrentStreak(streaks.current)
      setBestStreak(streaks.best)

      if (!goalsData || goalsData.length === 0) {
        // No goals - return empty state
        setGoals([])
        setRawGoals([])
        setIsLoading(false)
        return
      }

      // Dynamically count posts from my_posts for each goal's current period
      const goalCounts = await Promise.all(
        goalsData.map(async (goal) => {
          const period = goal.period as 'daily' | 'weekly' | 'monthly'
          const { start, end } = getGoalPeriodDates(period)
          const { count } = await supabase
            .from('my_posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', targetUserId)
            .gte('posted_at', start)
            .lte('posted_at', end)
          return count ?? 0
        })
      )

      // Transform to Goal format using live post counts
      const transformedGoals: Goal[] = goalsData.map((goal, idx) => ({
        id: goal.id,
        period: goal.period as 'daily' | 'weekly' | 'monthly',
        target: goal.target_posts,
        current: goalCounts[idx],
        startDate: goal.start_date,
        endDate: goal.end_date,
      }))

      setGoals(transformedGoals)
      setRawGoals(goalsData)
    } catch (err) {
      console.error('Posting goals fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch posting goals')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, userId, user?.id, authLoading])

  /**
   * Update a goal's target posts
   */
  const updateGoalTarget = useCallback(async (goalId: string, target: number) => {
    try {
      const { error: updateError } = await supabase
        .from('posting_goals')
        .update({ target_posts: target, updated_at: new Date().toISOString() })
        .eq('id', goalId)

      if (updateError) {
        throw updateError
      }

      // Update local state
      setGoals(prev => prev.map(g =>
        g.id === goalId ? { ...g, target } : g
      ))
      setRawGoals(prev => prev.map(g =>
        g.id === goalId ? { ...g, target_posts: target } : g
      ))
    } catch (err) {
      console.error('Goal update error:', err)
      throw err
    }
  }, [supabase])

  /**
   * Create a new posting goal
   * @param period - Goal period (daily, weekly, monthly)
   * @param target - Target number of posts
   */
  const createGoal = useCallback(async (period: 'daily' | 'weekly' | 'monthly', target: number) => {
    const targetUserId = userId || user?.id
    if (!targetUserId) throw new Error('No user ID available')

    try {
      const { start, end } = getGoalPeriodDates(period)

      const { data, error: insertError } = await supabase
        .from('posting_goals')
        .insert({
          user_id: targetUserId,
          period,
          target_posts: target,
          current_posts: 0,
          start_date: start,
          end_date: end,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Update local state
      const newGoal: Goal = {
        id: data.id,
        period: data.period as 'daily' | 'weekly' | 'monthly',
        target: data.target_posts,
        current: data.current_posts ?? 0,
        startDate: data.start_date,
        endDate: data.end_date,
      }
      setGoals(prev => [...prev, newGoal])
      setRawGoals(prev => [...prev, data])
    } catch (err) {
      console.error('Goal create error:', err)
      throw err
    }
  }, [supabase, userId, user?.id])

  /**
   * Remove a posting goal
   * @param goalId - ID of the goal to remove
   */
  const removeGoal = useCallback(async (goalId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('posting_goals')
        .delete()
        .eq('id', goalId)

      if (deleteError) throw deleteError

      // Update local state
      setGoals(prev => prev.filter(g => g.id !== goalId))
      setRawGoals(prev => prev.filter(g => g.id !== goalId))
    } catch (err) {
      console.error('Goal remove error:', err)
      throw err
    }
  }, [supabase])

  // Fetch when auth state changes or on mount
  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // Combined loading state
  const combinedLoading = authLoading || isLoading

  return {
    goals,
    rawGoals,
    currentStreak,
    bestStreak,
    isLoading: combinedLoading,
    error,
    refetch: fetchGoals,
    updateGoalTarget,
    createGoal,
    removeGoal,
  }
}
