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
        // Latest 14 daily_account_snapshots for week-over-week comparison
        supabase
          .from('daily_account_snapshots')
          .select('date, total_impressions, total_reactions, total_comments, total_reposts, total_saves, total_sends, total_engagements, followers, connections, profile_views, search_appearances, post_count')
          .eq('user_id', targetUserId)
          .order('date', { ascending: false })
          .limit(14),
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
        // Latest sync timestamp — use sync_metadata (written by the extension
        // via /api/sync) instead of daily_account_snapshots.updated_at which is
        // updated every 5 min by the Inngest pipeline regardless of extension activity.
        // Exclude 'analytics_pipeline' entries which are written by the Inngest cron.
        supabase
          .from('sync_metadata')
          .select('last_synced_at')
          .eq('user_id', targetUserId)
          .neq('table_name', 'analytics_pipeline')
          .order('last_synced_at', { ascending: false })
          .limit(1),
      ])

      // Build today's capture info — lastSynced comes from sync_metadata
      // (only written by extension sync), not the Inngest pipeline
      const capturedTodayCount = capturedTodayResult.count ?? 0
      const lastSyncRow = syncResult.data?.[0]
      const lastSyncedAt = lastSyncRow?.last_synced_at ?? null
      setTodayCapture({
        apiCalls: capturedTodayCount,
        feedPosts: 0,
        lastSynced: lastSyncedAt,
        hasData: capturedTodayCount > 0,
      })

      // Use daily_account_snapshots as the single source of truth
      const snapshots = snapshotsResult.data ?? []
      const profile = profileResult.data

      if (snapshots.length === 0) {
        // No snapshots yet — only reset to zeros if we don't already have data.
        // This prevents the "glitch to 0" during real-time refetch race conditions
        // where the query runs while a snapshot write is still being committed.
        if (!metrics || metrics.followers.value === 0) {
          setMetrics(DEFAULT_METRICS)
          setChartData(EMPTY_CHART_DATA)
          setMetadata({ lastUpdated: new Date().toISOString(), captureMethod: null })
          setPeriodLabel('no syncs yet')
          setRawData([])
        }
        setIsLoading(false)
        return
      }

      const latest = snapshots[0] // most recent snapshot (ordered desc)
      const totalDays = snapshots.length

      // ── Week-over-Week comparison ──
      // Split snapshots into current week (last 7 days) and previous week (days 8-14).
      // Sum daily deltas within each week, then compute % change.
      const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date)) // oldest first

      /**
       * Sum the daily deltas (difference between consecutive days) for a slice of sorted snapshots.
       * Returns gains for impressions, engagements, followers, profile_views.
       */
      const sumDeltas = (slice: typeof sorted) => {
        let imp = 0, eng = 0, foll = 0, pv = 0
        for (let i = 1; i < slice.length; i++) {
          imp += Math.max(0, slice[i].total_impressions - slice[i - 1].total_impressions)
          eng += Math.max(0, slice[i].total_engagements - slice[i - 1].total_engagements)
          foll += slice[i].followers - slice[i - 1].followers
          pv += slice[i].profile_views - slice[i - 1].profile_views
        }
        return { imp, eng, foll, pv }
      }

      // Split: current week = last 7 entries, previous week = entries 8-14
      const thisWeekSlice = sorted.slice(Math.max(0, sorted.length - 7))
      const prevWeekSlice = sorted.length > 7 ? sorted.slice(0, sorted.length - 7 + 1) : [] // +1 for overlap day to compute first delta

      const thisWeek = sumDeltas(thisWeekSlice)
      const prevWeek = prevWeekSlice.length >= 2 ? sumDeltas(prevWeekSlice) : null

      // Compute % change: (thisWeek - prevWeek) / prevWeek * 100
      const computeWoW = (curr: number, prev: number | null): number => {
        if (prev === null || prev === 0) return 0 // No prior week data → show 0 (not misleading %)
        return Math.round(((curr - prev) / Math.abs(prev)) * 10000) / 100
      }

      // Absolute values from latest snapshot
      const impressions = latest.total_impressions
      const engagements = latest.total_engagements
      const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0

      let impChange = 0, engChange = 0, follChange = 0, pvChange = 0

      if (totalDays >= 14 && prevWeek) {
        // ── 14+ days: Week-over-Week comparison ──
        impChange = computeWoW(thisWeek.imp, prevWeek.imp)
        engChange = computeWoW(thisWeek.eng, prevWeek.eng)
        follChange = computeWoW(thisWeek.foll, prevWeek.foll)
        pvChange = computeWoW(thisWeek.pv, prevWeek.pv)
        setPeriodLabel('vs last week')
      } else if (totalDays >= 2) {
        // ── 2-13 days: Show total period growth ──
        // Compare latest snapshot vs earliest snapshot: "how much did you grow
        // over all available data?" — simple, stable, never misleading.
        const earliest = sorted[0]
        const computeGrowth = (latest_val: number, earliest_val: number): number => {
          if (earliest_val === 0 && latest_val === 0) return 0
          if (earliest_val === 0) return 0 // Can't compute % from zero base
          return Math.round(((latest_val - earliest_val) / earliest_val) * 10000) / 100
        }

        impChange = computeGrowth(latest.total_impressions, earliest.total_impressions)
        engChange = computeGrowth(latest.total_engagements, earliest.total_engagements)
        follChange = computeGrowth(latest.followers, earliest.followers)
        pvChange = computeGrowth(latest.profile_views, earliest.profile_views)

        setPeriodLabel(`last ${totalDays} days`)
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sync_metadata',
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
