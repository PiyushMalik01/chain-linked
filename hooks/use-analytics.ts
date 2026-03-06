/**
 * Analytics Hook
 * @description Fetches LinkedIn analytics data from Supabase
 * @module hooks/use-analytics
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { Tables } from '@/types/database'

/**
 * Metric data with value and change percentage
 */
interface MetricData {
  value: number
  change: number
}

/**
 * Aggregated analytics metrics
 */
interface AnalyticsMetrics {
  impressions: MetricData
  engagementRate: MetricData
  followers: MetricData
  profileViews: MetricData
  searchAppearances: MetricData
  connections: MetricData
  membersReached: MetricData
}

/**
 * Analytics metadata
 */
interface AnalyticsMetadata {
  lastUpdated: string | null
  captureMethod: string | null
}

/**
 * Chart data point for time series
 */
interface ChartDataPoint {
  date: string
  impressions: number
  engagements: number
  profileViews: number
}

/**
 * Analytics hook return type
 */
interface UseAnalyticsReturn {
  /** Aggregated analytics metrics */
  metrics: AnalyticsMetrics | null
  /** Chart data for time series */
  chartData: ChartDataPoint[]
  /** Raw analytics records */
  rawData: Tables<'linkedin_analytics'>[]
  /** Analytics metadata (last updated, capture method) */
  metadata: AnalyticsMetadata | null
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Refetch analytics data */
  refetch: () => Promise<void>
}

/**
 * Default metrics when no data is available
 */
const DEFAULT_METRICS: AnalyticsMetrics = {
  impressions: { value: 0, change: 0 },
  engagementRate: { value: 0, change: 0 },
  followers: { value: 0, change: 0 },
  profileViews: { value: 0, change: 0 },
  searchAppearances: { value: 0, change: 0 },
  connections: { value: 0, change: 0 },
  membersReached: { value: 0, change: 0 },
}

/**
 * Empty chart data - no data to display yet
 */
const EMPTY_CHART_DATA: ChartDataPoint[] = []

/**
 * Hook to fetch and manage LinkedIn analytics data
 * @param userId - User ID to fetch analytics for (optional, uses current user if not provided)
 * @returns Analytics data, loading state, and refetch function
 * @example
 * const { metrics, chartData, isLoading, error } = useAnalytics()
 */
export function useAnalytics(userId?: string): UseAnalyticsReturn {
  // Get auth state from context - this is the key fix
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization - start with null, will be set based on auth state
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [rawData, setRawData] = useState<Tables<'linkedin_analytics'>[]>([])
  const [metadata, setMetadata] = useState<AnalyticsMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start true while waiting for auth
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = React.useRef(createClient())

  /**
   * Fetch analytics data from Supabase
   * All independent queries run in parallel via Promise.all for faster loading.
   */
  const fetchAnalytics = useCallback(async () => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      return
    }

    // Determine target user ID
    const targetUserId = userId || user?.id

    // If no user (not authenticated), show demo data
    if (!targetUserId) {
      setMetrics(DEFAULT_METRICS)
      setChartData(EMPTY_CHART_DATA)
      setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
      setIsLoading(false)
      return
    }

    const supabase = supabaseRef.current

    try {
      setIsLoading(true)
      setError(null)

      // Run ALL independent queries in parallel
      const [cacheResult, analyticsResult, profileResult, myPostsResult] = await Promise.all([
        supabase
          .from('analytics_summary_cache')
          .select('metric, pct_change')
          .eq('user_id', targetUserId)
          .eq('period', '30d'),
        supabase
          .from('linkedin_analytics')
          .select('*')
          .eq('user_id', targetUserId)
          .order('captured_at', { ascending: false }),
        supabase
          .from('linkedin_profiles')
          .select('followers_count, connections_count')
          .eq('user_id', targetUserId)
          .single(),
        supabase
          .from('my_posts')
          .select('impressions, reactions, comments, reposts, posted_at, created_at')
          .eq('user_id', targetUserId),
      ])

      /** Lookup map from metric name to its cached percentage change */
      const changeMap = new Map<string, number>(
        cacheResult.data?.map((c) => [c.metric, c.pct_change]) ?? []
      )

      const analytics = analyticsResult.data
      const profile = profileResult.data
      const myPosts = myPostsResult.data

      if (profileResult.error && profileResult.error.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', profileResult.error)
      }

      // If analytics table error, use demo data
      if (analyticsResult.error) {
        console.warn('Analytics fetch warning (showing zeros):', analyticsResult.error.message)
        setMetrics(DEFAULT_METRICS)
        setChartData(EMPTY_CHART_DATA)
        setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
        setIsLoading(false)
        return
      }

      if (!analytics || analytics.length === 0) {
        // No linkedin_analytics data — try deriving metrics from my_posts + profile
        if (myPosts && myPosts.length > 0) {
          const totalImpressions = myPosts.reduce((sum, p) => sum + (p.impressions || 0), 0)
          const totalReactions = myPosts.reduce((sum, p) => sum + (p.reactions || 0), 0)
          const totalComments = myPosts.reduce((sum, p) => sum + (p.comments || 0), 0)
          const totalReposts = myPosts.reduce((sum, p) => sum + (p.reposts || 0), 0)
          const totalEngagements = totalReactions + totalComments + totalReposts
          const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0
          const totalFollowers = profile?.followers_count || 0
          const totalConnections = profile?.connections_count || 0

          setMetrics({
            impressions: { value: totalImpressions, change: changeMap.get('impressions') ?? 0 },
            engagementRate: { value: engagementRate, change: changeMap.get('engagement_rate') ?? 0 },
            followers: { value: totalFollowers, change: changeMap.get('followers') ?? 0 },
            profileViews: { value: 0, change: changeMap.get('profile_views') ?? 0 },
            searchAppearances: { value: 0, change: 0 },
            connections: { value: totalConnections, change: 0 },
            membersReached: { value: 0, change: 0 },
          })

          // Build simple chart data from posts
          const postChartMap = new Map<string, ChartDataPoint>()
          myPosts.forEach((post) => {
            const date = (post.posted_at || post.created_at || '').split('T')[0]
            if (!date) return
            const existing = postChartMap.get(date) || { date, impressions: 0, engagements: 0, profileViews: 0 }
            existing.impressions += post.impressions || 0
            existing.engagements += (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0)
            postChartMap.set(date, existing)
          })
          setChartData(Array.from(postChartMap.values()).sort((a, b) => a.date.localeCompare(b.date)))
          setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: 'extension' })
          setRawData([])
          setIsLoading(false)
          return
        }

        // No posts either — show zeros
        setMetrics(DEFAULT_METRICS)
        setChartData(EMPTY_CHART_DATA)
        setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
        setRawData([])
        setIsLoading(false)
        return
      }

      setRawData(analytics)

      // Use the LATEST analytics record for current metrics (first one since ordered desc)
      const latestAnalytics = analytics[0]

      // Extract data from raw_data if available
      const rawDataObj = latestAnalytics.raw_data as {
        impressionGrowth?: number
        captureMethod?: string
        last_updated?: string
        extractedAt?: string
      } | null
      const impressionGrowth = rawDataObj?.impressionGrowth ?? 0

      // Start with analytics record values for impressions/engagements
      let impressions = latestAnalytics.impressions || 0
      let engagements = latestAnalytics.engagements || 0

      // If analytics records lack impressions data, derive from my_posts (already fetched)
      if (impressions === 0 && myPosts && myPosts.length > 0) {
        impressions = myPosts.reduce((sum, p) => sum + (p.impressions || 0), 0)
        const totalReactions = myPosts.reduce((sum, p) => sum + (p.reactions || 0), 0)
        const totalComments = myPosts.reduce((sum, p) => sum + (p.comments || 0), 0)
        const totalReposts = myPosts.reduce((sum, p) => sum + (p.reposts || 0), 0)
        engagements = totalReactions + totalComments + totalReposts
      }

      const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0

      // Use profile followers_count for accurate total followers
      const totalFollowers = profile?.followers_count || latestAnalytics.new_followers || 0
      const totalConnections = profile?.connections_count || 0

      const aggregatedMetrics: AnalyticsMetrics = {
        impressions: {
          value: impressions,
          change: changeMap.get('impressions') ?? impressionGrowth,
        },
        engagementRate: {
          value: engagementRate,
          change: changeMap.get('engagement_rate') ?? 0,
        },
        followers: {
          value: totalFollowers,
          change: changeMap.get('followers') ?? 0,
        },
        profileViews: {
          value: latestAnalytics.profile_views || 0,
          change: changeMap.get('profile_views') ?? 0,
        },
        searchAppearances: {
          value: latestAnalytics.search_appearances || 0,
          change: 0,
        },
        connections: {
          value: totalConnections,
          change: 0,
        },
        membersReached: {
          value: latestAnalytics.members_reached || 0,
          change: 0,
        },
      }

      setMetrics(aggregatedMetrics)

      // Set metadata
      setMetadata({
        lastUpdated: rawDataObj?.last_updated || rawDataObj?.extractedAt || latestAnalytics.captured_at,
        captureMethod: rawDataObj?.captureMethod || 'extension',
      })

      // Build chart data from analytics records and my_posts
      const chartDataMap = new Map<string, ChartDataPoint>()
      const sortedAnalytics = [...analytics].reverse()

      sortedAnalytics.forEach((record) => {
        const date = (record.captured_at ?? '').split('T')[0]
        const existing = chartDataMap.get(date) || { date, impressions: 0, engagements: 0, profileViews: 0 }
        existing.profileViews = Math.max(existing.profileViews, record.profile_views || 0)
        existing.impressions = Math.max(existing.impressions, record.impressions || 0)
        existing.engagements = Math.max(existing.engagements, record.engagements || 0)
        chartDataMap.set(date, existing)
      })

      // Build a set of dates that already have analytics-sourced impressions
      const datesWithAnalyticsImpressions = new Set<string>()
      sortedAnalytics.forEach((record) => {
        if ((record.impressions || 0) > 0) {
          const date = (record.captured_at ?? '').split('T')[0]
          if (date) datesWithAnalyticsImpressions.add(date)
        }
      })

      // Merge my_posts data (already fetched) for dates without analytics impressions
      if (myPosts && myPosts.length > 0) {
        myPosts.forEach((post) => {
          const date = (post.posted_at || '').split('T')[0]
          if (!date) return
          if (datesWithAnalyticsImpressions.has(date)) return
          const existing = chartDataMap.get(date) || { date, impressions: 0, engagements: 0, profileViews: 0 }
          existing.impressions += post.impressions || 0
          existing.engagements += (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0)
          chartDataMap.set(date, existing)
        })
      }

      const sortedChartData = Array.from(chartDataMap.values()).sort(
        (a, b) => a.date.localeCompare(b.date)
      )

      setChartData(sortedChartData)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      setMetrics(DEFAULT_METRICS)
      setChartData(EMPTY_CHART_DATA)
      setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
    } finally {
      setIsLoading(false)
    }
  }, [userId, user?.id, authLoading])

  // Fetch when auth state changes or on mount
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Combined loading state - loading if auth is loading OR data is loading
  const combinedLoading = authLoading || isLoading

  return {
    metrics,
    chartData,
    rawData,
    metadata,
    isLoading: combinedLoading,
    error,
    refetch: fetchAnalytics,
  }
}
