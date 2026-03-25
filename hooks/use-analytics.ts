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

      // Run ALL independent queries in parallel
      const [historyResult, analyticsResult, profileResult, myPostsResult, capturedTodayResult, syncResult, summaryResult, profileViewsHistoryResult] = await Promise.all([
        // Latest 2 analytics_history records for daily comparison
        supabase
          .from('analytics_history')
          .select('date, impressions, members_reached, engagements, followers, profile_views')
          .eq('user_id', targetUserId)
          .order('date', { ascending: false })
          .limit(2),
        supabase
          .from('linkedin_analytics')
          .select('*')
          .eq('user_id', targetUserId)
          .order('captured_at', { ascending: false })
          .limit(365),
        supabase
          .from('linkedin_profiles')
          .select('followers_count, connections_count')
          .eq('user_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('my_posts')
          .select('impressions, reactions, comments, reposts, posted_at, created_at')
          .eq('user_id', targetUserId),
        // Count all data synced today across all tables
        Promise.all([
          supabase.from('captured_apis').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('linkedin_analytics').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('post_analytics').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('captured_at', todayStart),
          supabase.from('my_posts').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId).gte('created_at', todayStart),
        ]).then(results => ({
          count: results.reduce((sum, r) => sum + (r.count ?? 0), 0),
        })),
        // Latest sync timestamp - check both sync_metadata and actual data tables
        Promise.all([
          supabase
            .from('sync_metadata')
            .select('last_synced_at')
            .eq('user_id', targetUserId)
            .order('last_synced_at', { ascending: false })
            .limit(1),
          supabase
            .from('linkedin_analytics')
            .select('captured_at')
            .eq('user_id', targetUserId)
            .order('captured_at', { ascending: false })
            .limit(1),
          supabase
            .from('post_analytics')
            .select('captured_at')
            .eq('user_id', targetUserId)
            .order('captured_at', { ascending: false })
            .limit(1),
        ]).then(([syncMeta, analyticsCapture, postCapture]) => {
          // Return the most recent timestamp across all sources
          const timestamps = [
            syncMeta.data?.[0]?.last_synced_at,
            analyticsCapture.data?.[0]?.captured_at,
            postCapture.data?.[0]?.captured_at,
          ].filter(Boolean) as string[]
          const mostRecent = timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          return { data: [{ last_synced_at: mostRecent || null }] }
        }),
        // Pre-computed summary metrics from Inngest pipeline (fetch both 7d and 30d, post + profile)
        supabase
          .from('analytics_summary_cache')
          .select('metric, current_total, current_avg, pct_change, period, timeseries, accumulative_total, metric_type')
          .eq('user_id', targetUserId)
          .in('period', ['7d', '30d']),
        // Latest analytics_history row with non-null profile_views
        supabase
          .from('analytics_history')
          .select('profile_views')
          .eq('user_id', targetUserId)
          .not('profile_views', 'is', null)
          .gt('profile_views', 0)
          .order('date', { ascending: false })
          .limit(1),
      ])

      // Build today's capture info
      const capturedTodayCount = capturedTodayResult.count ?? 0
      const lastSyncRow = syncResult.data?.[0]
      const lastSyncedAt = lastSyncRow?.last_synced_at ?? null
      // Consider data captured if we have API calls today OR if last sync was today
      const hasTodaySync = lastSyncedAt ? new Date(lastSyncedAt).toISOString().startsWith(todayStr) : false
      setTodayCapture({
        apiCalls: capturedTodayCount,
        feedPosts: 0,
        lastSynced: lastSyncedAt,
        hasData: capturedTodayCount > 0 || hasTodaySync,
      })

      // Build daily change map from analytics_history (latest vs previous)
      const historyRows = historyResult.data ?? []
      const changeMap = new Map<string, number>()

      if (historyRows.length >= 2) {
        const latest = historyRows[0]
        const previous = historyRows[1]

        // Compute percentage change for each metric
        const computeChange = (curr: number, prev: number): number => {
          if (prev === 0 && curr === 0) return 0
          if (prev === 0) return curr > 0 ? 100 : 0
          return Math.round(((curr - prev) / prev) * 10000) / 100
        }

        changeMap.set('impressions', computeChange(latest.impressions ?? 0, previous.impressions ?? 0))
        changeMap.set('profile_views', computeChange(latest.profile_views ?? 0, previous.profile_views ?? 0))
        changeMap.set('followers', computeChange(latest.followers ?? 0, previous.followers ?? 0))
        changeMap.set('engagements', computeChange(latest.engagements ?? 0, previous.engagements ?? 0))

        // Compute engagement rate change
        const latestRate = (latest.impressions ?? 0) > 0 ? ((latest.engagements ?? 0) / (latest.impressions ?? 0)) * 100 : 0
        const prevRate = (previous.impressions ?? 0) > 0 ? ((previous.engagements ?? 0) / (previous.impressions ?? 0)) * 100 : 0
        changeMap.set('engagement_rate', computeChange(latestRate, prevRate))

        // Format period label with the previous sync date
        const prevDate = new Date(previous.date + 'T00:00:00')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        setPeriodLabel(`vs last sync (${monthNames[prevDate.getMonth()]} ${prevDate.getDate()})`)
      } else if (historyRows.length === 1) {
        setPeriodLabel('first sync')
      } else {
        setPeriodLabel('no syncs yet')
      }

      const analytics = analyticsResult.data
      const profile = profileResult.data
      const myPosts = myPostsResult.data

      // Compute total impressions/engagements from individual posts as fallback
      const postImpressions = (myPosts ?? []).reduce((sum, p) => sum + (p.impressions || 0), 0)
      const postReactions = (myPosts ?? []).reduce((sum, p) => sum + (p.reactions || 0), 0)
      const postComments = (myPosts ?? []).reduce((sum, p) => sum + (p.comments || 0), 0)
      const postReposts = (myPosts ?? []).reduce((sum, p) => sum + (p.reposts || 0), 0)
      const postEngagements = postReactions + postComments + postReposts

      // Summary cache from Inngest pipeline - split by period
      const summaryCache = summaryResult.data ?? []
      const cache7d = summaryCache.filter(s => s.period === '7d')
      const cache30d = summaryCache.filter(s => s.period === '30d')
      const cachedImpressions7d = cache7d.find(s => s.metric === 'impressions')
      const cachedImpressions30d = cache30d.find(s => s.metric === 'impressions')
      const cachedEngagements7d = cache7d.find(s => s.metric === 'engagements')

      // Profile metrics from summary cache (accumulated totals from pipeline)
      const cachedFollowers30d = cache30d.find(s => s.metric === 'followers')
      const cachedFollowers7d = cache7d.find(s => s.metric === 'followers')
      const cachedProfileViews30d = cache30d.find(s => s.metric === 'profile_views')
      const cachedProfileViews7d = cache7d.find(s => s.metric === 'profile_views')
      const cachedConnections30d = cache30d.find(s => s.metric === 'connections')
      const cachedSearchAppearances30d = cache30d.find(s => s.metric === 'search_appearances')

      // REAL impressions value = sum of all individual post impressions from my_posts
      // This is what users care about: their total lifetime impressions across all posts
      const bestImpressions = postImpressions > 0 ? postImpressions : 0

      // REAL engagements value = sum from individual posts
      const bestEngagements = postEngagements > 0 ? postEngagements : 0

      // REAL engagement rate computed from actual post data
      const bestEngagementRate = bestImpressions > 0
        ? (bestEngagements / bestImpressions) * 100
        : 0

      // Change percentages: compute from timeseries (latest vs previous datapoint)
      // This gives a "since last sync" comparison rather than aggregate period comparison
      const computeTimeseriesChange = (cached: { timeseries?: unknown } | undefined): number => {
        const ts = cached?.timeseries as Array<{ date: string; value: number }> | undefined
        if (!ts || ts.length < 2) return 0
        const latest = ts[ts.length - 1].value
        const previous = ts[ts.length - 2].value
        if (previous === 0 && latest === 0) return 0
        if (previous === 0) return latest > 0 ? 100 : 0
        return Math.round(((latest - previous) / previous) * 10000) / 100
      }

      const bestImpressionsChange = computeTimeseriesChange(cachedImpressions30d) || computeTimeseriesChange(cachedImpressions7d) || changeMap.get('impressions') || 0
      const cachedEngagements30d = cache30d.find(s => s.metric === 'engagements')
      const bestEngagementsChange = computeTimeseriesChange(cachedEngagements30d) || computeTimeseriesChange(cachedEngagements7d) || changeMap.get('engagements') || 0

      // Latest non-null profile views from analytics_history
      const latestProfileViews = profileViewsHistoryResult.data?.[0]?.profile_views ?? 0

      // Build period label from last two timeseries datapoints
      const impressionTs = (cachedImpressions30d?.timeseries ?? cachedImpressions7d?.timeseries) as Array<{ date: string; value: number }> | undefined
      if (impressionTs && impressionTs.length >= 2) {
        const prevPoint = impressionTs[impressionTs.length - 2]
        const prevDate = new Date(prevPoint.date + 'T00:00:00')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        setPeriodLabel(`vs last sync (${monthNames[prevDate.getMonth()]} ${prevDate.getDate()})`)
      }

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
        // No linkedin_analytics data — use best available sources
        if (bestImpressions > 0 || (myPosts && myPosts.length > 0)) {
          // Followers: prefer summary cache accumulative_total > linkedin_profiles > analytics_history
          const totalFollowers = Number(cachedFollowers30d?.accumulative_total ?? cachedFollowers7d?.accumulative_total) || profile?.followers_count || historyRows[0]?.followers || 0
          const totalConnections = Number(cachedConnections30d?.accumulative_total) || profile?.connections_count || 0
          const bestProfileViews = Number(cachedProfileViews30d?.accumulative_total ?? cachedProfileViews7d?.accumulative_total) || latestProfileViews
          const bestSearchAppearances = Number(cachedSearchAppearances30d?.accumulative_total) || 0

          setMetrics({
            impressions: { value: bestImpressions, change: bestImpressionsChange },
            engagementRate: { value: bestEngagementRate, change: bestEngagementsChange },
            followers: { value: totalFollowers, change: computeTimeseriesChange(cachedFollowers30d) || changeMap.get('followers') || 0 },
            profileViews: { value: bestProfileViews, change: computeTimeseriesChange(cachedProfileViews30d) || changeMap.get('profile_views') || 0 },
            searchAppearances: { value: bestSearchAppearances, change: 0 },
            connections: { value: totalConnections, change: 0 },
            membersReached: { value: 0, change: 0 },
          })

          // Build simple chart data from posts
          const postChartMap = new Map<string, ChartDataPoint>()
          ;(myPosts ?? []).forEach((post) => {
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
        captureMethod?: string
        last_updated?: string
        extractedAt?: string
      } | null

      // Use REAL values from my_posts (sum of individual post impressions/engagements)
      // Fall back to analytics record only if my_posts has nothing
      const impressions = bestImpressions > 0
        ? bestImpressions
        : latestAnalytics.impressions || 0

      const engagements = bestEngagements > 0
        ? bestEngagements
        : latestAnalytics.engagements || 0

      const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0

      // Followers: prefer summary cache accumulative_total > linkedin_profiles > analytics_history > analytics record
      // NEVER use new_followers as total — it's daily gained, not total count
      const totalFollowers = Number(cachedFollowers30d?.accumulative_total ?? cachedFollowers7d?.accumulative_total)
        || profile?.followers_count
        || historyRows[0]?.followers
        || 0
      const totalConnections = Number(cachedConnections30d?.accumulative_total) || profile?.connections_count || 0

      // Profile views: prefer summary cache > history row > analytics record
      const profileViewsValue = Number(cachedProfileViews30d?.accumulative_total ?? cachedProfileViews7d?.accumulative_total)
        || latestProfileViews
        || latestAnalytics.profile_views
        || 0

      const aggregatedMetrics: AnalyticsMetrics = {
        impressions: {
          value: impressions,
          change: bestImpressionsChange,
        },
        engagementRate: {
          value: engagementRate,
          change: bestEngagementsChange,
        },
        followers: {
          value: totalFollowers,
          change: computeTimeseriesChange(cachedFollowers30d) || changeMap.get('followers') || 0,
        },
        profileViews: {
          value: profileViewsValue,
          change: computeTimeseriesChange(cachedProfileViews30d) || changeMap.get('profile_views') || 0,
        },
        searchAppearances: {
          value: Number(cachedSearchAppearances30d?.accumulative_total) || latestAnalytics.search_appearances || 0,
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
    periodLabel,
    todayCapture,
    isLoading: combinedLoading,
    error,
    refetch: fetchAnalytics,
  }
}
