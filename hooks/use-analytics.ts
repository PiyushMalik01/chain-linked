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
 * Today's data capture summary
 */
interface TodayCaptureInfo {
  /** Number of API calls captured today */
  apiCalls: number
  /** Number of feed posts captured today */
  feedPosts: number
  /** Last sync timestamp (ISO string) */
  lastSynced: string | null
  /** Whether any data was captured today */
  hasData: boolean
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
  /** Label for the comparison period (e.g. "vs yesterday", "vs Mar 13") */
  periodLabel: string
  /** Today's capture info for the banner */
  todayCapture: TodayCaptureInfo | null
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
  const [periodLabel, setPeriodLabel] = useState<string>('vs yesterday')
  const [todayCapture, setTodayCapture] = useState<TodayCaptureInfo | null>(null)
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

      // Today's date in YYYY-MM-DD for capture queries
      const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
      const todayStart = `${todayStr}T00:00:00.000Z`

      // Run queries in parallel — use daily_account_snapshots as primary source
      const [snapshotsResult, profileResult, capturedTodayResult, syncResult] = await Promise.all([
        // Latest 2 daily_account_snapshots for day-over-day comparison
        supabase
          .from('daily_account_snapshots')
          .select('date, total_impressions, total_reactions, total_comments, total_reposts, total_saves, total_sends, total_engagements, followers, connections, profile_views, search_appearances, post_count')
          .eq('user_id', targetUserId)
          .order('date', { ascending: false })
          .limit(2),
        supabase
          .from('linkedin_profiles')
          .select('followers_count, connections_count')
          .eq('user_id', targetUserId)
          .maybeSingle(),
        // Count all data synced today
        Promise.all([
          supabase.from('captured_apis').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('linkedin_analytics').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('post_analytics').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('my_posts').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('created_at', todayStart),
        ]).then(results => ({
          count: results.reduce((sum, r) => sum + (r.count ?? 0), 0),
        })),
        // Latest sync timestamp
        supabase
          .from('daily_account_snapshots')
          .select('updated_at')
          .eq('user_id', targetUserId)
          .order('date', { ascending: false })
          .limit(1),
      ])

      // Build today's capture info
      const capturedTodayCount = capturedTodayResult.count ?? 0
      const lastSyncRow = syncResult.data?.[0]
      const lastSyncedAt = lastSyncRow?.updated_at ?? null
      const hasTodaySync = lastSyncedAt ? new Date(lastSyncedAt).toISOString().startsWith(todayStr) : false
      setTodayCapture({
        apiCalls: capturedTodayCount,
        feedPosts: 0,
        lastSynced: lastSyncedAt,
        hasData: capturedTodayCount > 0 || hasTodaySync,
      })

      // Use daily_account_snapshots as the single source of truth
      const snapshots = snapshotsResult.data ?? []
      const profile = profileResult.data

      if (snapshots.length === 0) {
        // No snapshots yet — show zeros
        setMetrics(DEFAULT_METRICS)
        setChartData(EMPTY_CHART_DATA)
        setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
        setPeriodLabel('no syncs yet')
        setRawData([])
        setIsLoading(false)
        return
      }

      const latest = snapshots[0] // most recent snapshot (ordered desc)
      const previous = snapshots.length >= 2 ? snapshots[1] : null

      // Compute % change between latest and previous snapshot
      const computeChange = (curr: number, prev: number): number => {
        if (prev === 0 && curr === 0) return 0
        if (prev === 0) return curr > 0 ? 100 : 0
        return Math.round(((curr - prev) / prev) * 10000) / 100
      }

      const impressions = latest.total_impressions
      const engagements = latest.total_engagements
      const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0

      // Change values: compare latest vs previous snapshot day
      const impChange = previous ? computeChange(latest.total_impressions, previous.total_impressions) : 0
      const engChange = previous ? computeChange(latest.total_engagements, previous.total_engagements) : 0
      const follChange = previous ? computeChange(latest.followers, previous.followers) : 0
      const pvChange = previous ? computeChange(latest.profile_views, previous.profile_views) : 0

      // Period label
      if (previous) {
        const prevDate = new Date(previous.date + 'T00:00:00')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        setPeriodLabel(`vs ${monthNames[prevDate.getMonth()]} ${prevDate.getDate()}`)
      } else {
        setPeriodLabel('first sync')
      }

      setMetrics({
        impressions: { value: impressions, change: impChange },
        engagementRate: { value: engagementRate, change: engChange },
        followers: { value: latest.followers || profile?.followers_count || 0, change: follChange },
        profileViews: { value: latest.profile_views, change: pvChange },
        searchAppearances: { value: latest.search_appearances, change: 0 },
        connections: { value: latest.connections || profile?.connections_count || 0, change: 0 },
        membersReached: { value: 0, change: 0 },
      })

      setMetadata({
        lastUpdated: lastSyncedAt || new Date().toISOString(),
        captureMethod: 'extension',
      })

      // Build chart data from snapshots (one point per day)
      const chartDataPoints: ChartDataPoint[] = [...snapshots].reverse().map(s => ({
        date: s.date,
        impressions: s.total_impressions,
        engagements: s.total_engagements,
        profileViews: s.profile_views,
      }))

      setChartData(chartDataPoints)
      setRawData([])
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

  // Real-time subscriptions: auto-refetch when extension writes new data
  useEffect(() => {
    const targetUserId = userId || user?.id
    if (!targetUserId || authLoading) return

    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`analytics-realtime-${targetUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_account_snapshots',
        filter: `user_id=eq.${targetUserId}`,
      }, () => {
        fetchAnalytics()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'linkedin_analytics',
        filter: `user_id=eq.${targetUserId}`,
      }, () => {
        fetchAnalytics()
      })
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'linkedin_profiles',
        filter: `user_id=eq.${targetUserId}`,
      }, () => {
        fetchAnalytics()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, user?.id, authLoading, fetchAnalytics])

  // Combined loading state - loading if auth is loading OR data is loading
  const combinedLoading = authLoading || isLoading

  return {
    metrics,
    chartData,
    rawData,
    metadata,
    periodLabel,
    todayCapture,
    isLoading: combinedLoading,
    error,
    refetch: fetchAnalytics,
  }
}
