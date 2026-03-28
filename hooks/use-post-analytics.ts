/**
 * Post Analytics Hook
 * @description Fetches post performance analytics from Supabase
 * @module hooks/use-post-analytics
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { Tables } from '@/types/database'
import type {
  PostPerformanceData,
  PostMetrics,
} from '@/components/features/post-performance'

/**
 * Hook return type for post analytics data
 */
interface UsePostAnalyticsReturn {
  /** Top performing posts with analytics */
  posts: PostPerformanceData[]
  /** Currently selected post for detailed view */
  selectedPost: PostPerformanceData | null
  /** Raw data from database */
  rawPosts: Tables<'post_analytics'>[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Select a post for detailed view */
  selectPost: (postId: string | null) => void
  /** Refetch posts */
  refetch: () => Promise<void>
}

/**
 * Generate simulated daily metrics from total values
 * @param totalImpressions - Total impressions
 * @param totalEngagements - Total engagements (reactions + comments + reposts)
 * @param reactions - Total reactions (likes)
 * @param comments - Total comments
 * @param reposts - Total shares/reposts
 * @param postedAt - Post date
 * @returns Array of daily metrics for the past 7 days
 */
function generateDailyMetrics(
  totalImpressions: number,
  totalEngagements: number,
  reactions: number,
  comments: number,
  reposts: number,
  postedAt: string
): PostMetrics[] {
  const metrics: PostMetrics[] = []
  const postDate = new Date(postedAt)
  const today = new Date()

  // Calculate days since post
  const daysSincePost = Math.min(
    7,
    Math.max(1, Math.floor((today.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24)))
  )

  // Distribution weights (day 1 gets most engagement, then decreasing)
  const weights = [0.35, 0.25, 0.15, 0.10, 0.07, 0.05, 0.03]
  const activeWeights = weights.slice(0, daysSincePost)
  const totalWeight = activeWeights.reduce((a, b) => a + b, 0)
  const normalizedWeights = activeWeights.map(w => w / totalWeight)

  // Generate daily metrics
  for (let i = 0; i < daysSincePost; i++) {
    const date = new Date(postDate)
    date.setDate(date.getDate() + i)

    const weight = normalizedWeights[i]
    const dayImpressions = Math.round(totalImpressions * weight)
    const dayEngagements = Math.round(totalEngagements * weight)
    const dayReactions = Math.round(reactions * weight)
    const dayComments = Math.round(comments * weight)
    const dayReposts = Math.round(reposts * weight)
    // Estimate clicks as ~20% of engagements
    const dayClicks = Math.round(dayEngagements * 0.2)

    metrics.push({
      date: date.toISOString().split('T')[0],
      impressions: dayImpressions,
      engagements: dayEngagements,
      likes: dayReactions,
      comments: dayComments,
      shares: dayReposts,
      clicks: dayClicks,
    })
  }

  return metrics
}


/**
 * Hook to fetch post analytics from Supabase
 * @param userId - User ID to fetch analytics for (optional, uses current user if not provided)
 * @param limit - Maximum number of posts to fetch (default: 10)
 * @returns Post analytics data, loading state, and management functions
 * @example
 * const { posts, selectedPost, selectPost, isLoading } = usePostAnalytics()
 */
export function usePostAnalytics(userId?: string, limit = 10): UsePostAnalyticsReturn {
  // Get auth state from context
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization
  const [posts, setPosts] = useState<PostPerformanceData[]>([])
  const [selectedPost, setSelectedPost] = useState<PostPerformanceData | null>(null)
  const [rawPosts, setRawPosts] = useState<Tables<'post_analytics'>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  /**
   * Fetch post analytics from database
   */
  const fetchAnalytics = useCallback(async () => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      return
    }

    // Determine target user ID
    const targetUserId = userId || user?.id

    // If no user (not authenticated), return empty state
    if (!targetUserId) {
      setPosts([])
      setSelectedPost(null)
      setRawPosts([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch post analytics ordered by impressions
      const { data: analyticsData, error: analyticsError } = await supabaseRef.current
        .from('post_analytics')
        .select('*')
        .eq('user_id', targetUserId)
        .order('impressions', { ascending: false })
        .limit(limit)

      if (analyticsError) {
        console.warn('Post analytics fetch warning:', analyticsError.message)
        setPosts([])
        setSelectedPost(null)
        setRawPosts([])
        setIsLoading(false)
        return
      }

      // Fetch user's profile for author info
      const { data: profileData } = await supabaseRef.current
        .from('linkedin_profiles')
        .select('first_name, last_name, profile_picture_url')
        .eq('user_id', targetUserId)
        .single()

      const authorName = profileData
        ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown'
      const authorAvatar = profileData?.profile_picture_url || undefined

      // If post_analytics is empty, fall back to my_posts table
      // (extension background sync writes here, not to post_analytics)
      if (!analyticsData || analyticsData.length === 0) {
        console.info('No post_analytics found, checking my_posts...')

        const { data: myPostsData, error: myPostsError } = await supabaseRef.current
          .from('my_posts')
          .select('*')
          .eq('user_id', targetUserId)
          .order('impressions', { ascending: false })
          .limit(limit)

        if (myPostsError || !myPostsData || myPostsData.length === 0) {
          // No post data at all - return empty state
          setPosts([])
          setSelectedPost(null)
          setRawPosts([])
          setIsLoading(false)
          return
        }

        // Transform my_posts to PostPerformanceData format
        const myPostsTransformed: PostPerformanceData[] = myPostsData.map((post) => {
          const totalEngagements = (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0)
          const impressions = post.impressions || 0
          const engagementRate = impressions > 0
            ? (totalEngagements / impressions) * 100
            : 0

          return {
            id: post.id,
            content: post.content || '',
            publishedAt: post.posted_at || post.created_at || new Date().toISOString(),
            author: {
              name: authorName,
              avatarUrl: authorAvatar,
            },
            totalImpressions: impressions,
            totalEngagements,
            engagementRate: Math.round(engagementRate * 10) / 10,
            metrics: generateDailyMetrics(
              impressions,
              totalEngagements,
              post.reactions || 0,
              post.comments || 0,
              post.reposts || 0,
              post.posted_at || post.created_at || new Date().toISOString()
            ),
          }
        })

        setPosts(myPostsTransformed)
        if (myPostsTransformed.length > 0 && !selectedPost) {
          setSelectedPost(myPostsTransformed[0])
        }
        setIsLoading(false)
        return
      }

      // Transform post_analytics to PostPerformanceData format
      const transformedPosts: PostPerformanceData[] = analyticsData.map((post) => {
        const totalEngagements = (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0)
        const impressions = post.impressions || 0
        const engagementRate = post.engagement_rate != null
          ? post.engagement_rate
          : impressions > 0
            ? (totalEngagements / impressions) * 100
            : 0

        return {
          id: post.id,
          content: post.post_content || '',
          publishedAt: post.posted_at || post.captured_at || new Date().toISOString(),
          author: {
            name: authorName,
            avatarUrl: authorAvatar,
          },
          totalImpressions: impressions,
          totalEngagements,
          engagementRate: Math.round(engagementRate * 10) / 10,
          metrics: generateDailyMetrics(
            impressions,
            totalEngagements,
            post.reactions || 0,
            post.comments || 0,
            post.reposts || 0,
            post.posted_at || post.captured_at || new Date().toISOString()
          ),
          // Demographics could be added here if available
          audienceBreakdown: post.demographics && Array.isArray(post.demographics) && post.demographics.length > 0
            ? (post.demographics as Array<{ label: string; percentage: number }>)
            : undefined,
        }
      })

      setPosts(transformedPosts)
      setRawPosts(analyticsData)

      // Auto-select the top performing post
      if (transformedPosts.length > 0 && !selectedPost) {
        setSelectedPost(transformedPosts[0])
      }
    } catch (err) {
      console.error('Post analytics fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch post analytics')
    } finally {
      setIsLoading(false)
    }
  }, [userId, user?.id, limit, authLoading])

  /**
   * Select a post for detailed view
   */
  const selectPost = useCallback((postId: string | null) => {
    if (!postId) {
      setSelectedPost(null)
      return
    }
    const post = posts.find(p => p.id === postId)
    setSelectedPost(post || null)
  }, [posts])

  // Fetch when auth state changes or on mount
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Real-time subscriptions: auto-refetch when extension writes new post data
  useEffect(() => {
    const targetUserId = userId || user?.id
    if (!targetUserId || authLoading) return

    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`post-analytics-realtime-${targetUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_analytics',
        filter: `user_id=eq.${targetUserId}`,
      }, () => {
        fetchAnalytics()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'my_posts',
        filter: `user_id=eq.${targetUserId}`,
      }, () => {
        fetchAnalytics()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, user?.id, authLoading, fetchAnalytics])

  // Combined loading state
  const combinedLoading = authLoading || isLoading

  return {
    posts,
    selectedPost,
    rawPosts,
    isLoading: combinedLoading,
    error,
    selectPost,
    refetch: fetchAnalytics,
  }
}
