/**
 * Scheduled Posts Hook
 * @description Fetches scheduled posts from Supabase
 * @module hooks/use-scheduled-posts
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { Tables } from '@/types/database'
import type { ScheduledPostItem } from '@/components/features/schedule-calendar'


/**
 * Hook return type for scheduled posts
 */
interface UseScheduledPostsReturn {
  /** Formatted posts for the calendar */
  posts: ScheduledPostItem[]
  /** Raw scheduled post data from database */
  rawPosts: Tables<'scheduled_posts'>[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Refetch posts */
  refetch: () => Promise<void>
  /** Delete a scheduled post */
  deletePost: (postId: string) => Promise<boolean>
  /** Update a scheduled post */
  updatePost: (postId: string, data: Partial<Tables<'scheduled_posts'>>) => Promise<boolean>
}

/**
 * Map status string to ScheduledPostItem status
 */
function mapStatus(status: string): ScheduledPostItem['status'] {
  switch (status.toLowerCase()) {
    case 'pending':
    case 'scheduled':
      return 'pending'
    case 'posted':
    case 'completed':
      return 'posted'
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Hook to fetch scheduled posts
 * @param daysRange - Number of days to fetch (past and future)
 * @returns Scheduled posts data and loading state
 * @example
 * const { posts, isLoading, error } = useScheduledPosts(30)
 */
export function useScheduledPosts(daysRange: number = 30): UseScheduledPostsReturn {
  // Get auth state from context
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization
  const [posts, setPosts] = useState<ScheduledPostItem[]>([])
  const [rawPosts, setRawPosts] = useState<Tables<'scheduled_posts'>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = React.useRef(createClient())

  /**
   * Fetch scheduled posts from database
   */
  const fetchPosts = useCallback(async () => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      return
    }

    // If no user (not authenticated), return empty state
    if (!user) {
      setPosts([])
      setRawPosts([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Calculate date range
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysRange)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + daysRange)

      // Fetch scheduled posts for the user
      const { data: postsData, error: fetchError } = await supabaseRef.current
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', user!.id)
        .gte('scheduled_for', startDate.toISOString())
        .lte('scheduled_for', endDate.toISOString())
        .order('scheduled_for', { ascending: true })

      // If table doesn't exist or error, return empty state
      if (fetchError) {
        console.warn('Scheduled posts fetch warning:', fetchError.message)
        setPosts([])
        setRawPosts([])
        setIsLoading(false)
        return
      }

      if (!postsData || postsData.length === 0) {
        // No scheduled posts - return empty state
        setPosts([])
        setRawPosts([])
        setIsLoading(false)
        return
      }

      // Transform to ScheduledPostItem format
      const transformedPosts: ScheduledPostItem[] = postsData.map((post) => ({
        id: post.id,
        content: post.content,
        scheduledFor: new Date(post.scheduled_for),
        status: mapStatus(post.status),
        platform: 'linkedin',
      }))

      setPosts(transformedPosts)
      setRawPosts(postsData)
    } catch (err) {
      console.error('Scheduled posts fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled posts')
    } finally {
      setIsLoading(false)
    }
  }, [daysRange, user, authLoading])

  // Fetch when auth state changes or on mount
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  /**
   * Delete a scheduled post
   * @param postId - ID of the post to delete
   * @returns Whether deletion was successful
   */
  const deletePost = useCallback(async (postId: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error: deleteError } = await supabaseRef.current
        .from('scheduled_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Delete scheduled post error:', deleteError)
        setError(deleteError.message)
        return false
      }

      // Update local state optimistically
      setPosts(prev => prev.filter(p => p.id !== postId))
      setRawPosts(prev => prev.filter(p => p.id !== postId))
      return true
    } catch (err) {
      console.error('Delete scheduled post error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete post')
      return false
    }
  }, [user])

  /**
   * Update a scheduled post
   * @param postId - ID of the post to update
   * @param data - Partial data to update
   * @returns Whether update was successful
   */
  const updatePost = useCallback(async (
    postId: string,
    data: Partial<Tables<'scheduled_posts'>>
  ): Promise<boolean> => {
    if (!user) return false

    try {
      const { error: updateError } = await supabaseRef.current
        .from('scheduled_posts')
        .update(data)
        .eq('id', postId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Update scheduled post error:', updateError)
        setError(updateError.message)
        return false
      }

      // Refetch to get updated data
      await fetchPosts()
      return true
    } catch (err) {
      console.error('Update scheduled post error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update post')
      return false
    }
  }, [user, fetchPosts])

  // Combined loading state
  const combinedLoading = authLoading || isLoading

  return {
    posts,
    rawPosts,
    isLoading: combinedLoading,
    error,
    refetch: fetchPosts,
    deletePost,
    updatePost,
  }
}
