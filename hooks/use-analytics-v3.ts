/**
 * Analytics V3 Hook
 * @description Fetches analytics data from the /api/analytics/v3 endpoint
 * with support for metric selection, time periods, content type filtering,
 * comparison periods, multi-metric "all" mode, and engagement breakdown.
 * @module hooks/use-analytics-v3
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/** The five post metrics fetched in "all" mode */
export const ALL_MODE_METRICS = ['impressions', 'reactions', 'comments', 'reposts', 'engagements'] as const

/** Profile-level metrics (as opposed to post-level) */
export const PROFILE_METRICS = ['followers', 'profile_views', 'search_appearances', 'connections'] as const

/**
 * Check if a metric is a profile-level metric
 * @param metric - The metric name to check
 * @returns Whether this is a profile metric
 */
export function isProfileMetric(metric: string): boolean {
  return (PROFILE_METRICS as readonly string[]).includes(metric)
}

/**
 * Filter configuration for the analytics V3 endpoint
 */
export interface AnalyticsV3Filters {
  /** The metric to query (e.g., impressions, reactions, comments, all, followers) */
  metric: string
  /** Time period (7d, 30d, 90d, 1y, custom) */
  period: string
  /** Start date for custom period (YYYY-MM-DD) */
  startDate?: string
  /** End date for custom period (YYYY-MM-DD) */
  endDate?: string
  /** Content type filter (all, text, image, video, carousel, document) */
  contentType: string
  /** Whether to include comparison period data */
  compare: boolean
  /** Data granularity — kept for filter bar compatibility, not used by the v3 API */
  granularity: string
}

/**
 * Single data point in the analytics time series
 */
export interface AnalyticsDataPoint {
  /** Date string (YYYY-MM-DD) */
  date: string
  /** Metric value */
  value: number
}

/**
 * Summary statistics for the analytics data
 */
export interface AnalyticsSummary {
  /** Total value across the period */
  total: number
  /** Average value per data point */
  average: number
  /** Percentage change vs previous period (based on daily averages) */
  change: number
  /** Accumulative total for profile metrics */
  accumulativeTotal?: number
  /** Number of data points in the comparison period (0 = no prior data) */
  compCount?: number
}

/**
 * Engagement breakdown data point with per-metric values
 */
export interface EngagementDataPoint {
  /** Date string (YYYY-MM-DD) */
  date: string
  /** Impression count */
  impressions: number
  /** Reaction count */
  reactions: number
  /** Comment count */
  comments: number
  /** Repost count */
  reposts: number
  /** Save count */
  saves: number
  /** Send count */
  sends: number
  /** Total engagements */
  engagements: number
  /** Delta (change) value */
  delta: number
}

/**
 * Multi-metric data map keyed by metric name (used in "all" mode)
 */
export type MultiMetricData = Record<string, AnalyticsDataPoint[]>

/**
 * Return type for the useAnalyticsV3 hook
 */
export interface UseAnalyticsV3Return {
  /** Current period data points (deltas for charts) */
  data: AnalyticsDataPoint[]
  /** Absolute values per day (for data table display) */
  absoluteData: AnalyticsDataPoint[]
  /** Summary statistics */
  summary: AnalyticsSummary | null
  /** Comparison period data points (when compare is enabled) */
  comparisonData: AnalyticsDataPoint[] | null
  /** Multi-metric data map (when metric is "all") — deltas */
  multiData: MultiMetricData | null
  /** Multi-metric absolute data map (when metric is "all") — for data table */
  multiAbsoluteData: MultiMetricData | null
  /** Engagement breakdown data from the posts endpoint */
  engagementBreakdown: EngagementDataPoint[]
  /** Whether data is currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
}

/**
 * Build URL search params for the v3 analytics API
 * @param filters - Filter configuration
 * @param metricOverride - Optional metric override for parallel fetches
 * @returns URLSearchParams instance
 */
function buildParams(filters: AnalyticsV3Filters, metricOverride?: string): URLSearchParams {
  const metric = metricOverride ?? filters.metric

  const params = new URLSearchParams({
    metric,
    period: filters.period,
    compare: String(filters.compare),
  })

  if (filters.contentType && filters.contentType !== 'all') {
    params.append('contentType', filters.contentType)
  }

  if (filters.period === 'custom' && filters.startDate && filters.endDate) {
    params.set('startDate', filters.startDate)
    params.set('endDate', filters.endDate)
  }

  return params
}

/**
 * Hook to fetch and manage analytics V3 data
 *
 * Handles three fetch flows:
 * - **"all" mode**: parallel fetches for impressions, reactions, comments, reposts,
 *   and engagements, returned as `multiData`
 * - **Single metric mode**: fetches a single metric and returns `data`, `summary`,
 *   and optional `comparisonData`
 * - **Engagement breakdown**: always fetched from the posts endpoint and returned
 *   as `engagementBreakdown`
 *
 * Uses AbortController to cancel in-flight requests when filters change.
 *
 * @param filters - Analytics filter configuration
 * @returns Analytics data, summary, comparison, multi-metric data, engagement breakdown, loading, and error states
 * @example
 * const { data, summary, multiData, engagementBreakdown, isLoading } = useAnalyticsV3({
 *   metric: 'all',
 *   period: '30d',
 *   contentType: 'all',
 *   compare: false,
 *   granularity: 'daily',
 * })
 */
export function useAnalyticsV3(filters: AnalyticsV3Filters): UseAnalyticsV3Return {
  const [data, setData] = useState<AnalyticsDataPoint[]>([])
  const [absoluteData, setAbsoluteData] = useState<AnalyticsDataPoint[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [comparisonData, setComparisonData] = useState<AnalyticsDataPoint[] | null>(null)
  const [multiData, setMultiData] = useState<MultiMetricData | null>(null)
  const [multiAbsoluteData, setMultiAbsoluteData] = useState<MultiMetricData | null>(null)
  const [engagementBreakdown, setEngagementBreakdown] = useState<EngagementDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const isAll = filters.metric === 'all'

      // Build engagement breakdown params
      const engagementParams = new URLSearchParams({
        metric: 'engagements',
        period: filters.period,
      })
      if (filters.contentType && filters.contentType !== 'all') {
        engagementParams.append('contentType', filters.contentType)
      }
      if (filters.period === 'custom' && filters.startDate && filters.endDate) {
        engagementParams.set('startDate', filters.startDate)
        engagementParams.set('endDate', filters.endDate)
      }

      // Engagement breakdown fetch (always runs)
      const engagementPromise = fetch(
        `/api/analytics/v3/posts?${engagementParams.toString()}`,
        { signal: controller.signal }
      ).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        return res.json()
      })

      if (isAll) {
        // Parallel fetch for all five post metrics + engagement breakdown
        const [metricsResults, engagementJson] = await Promise.all([
          Promise.all(
            ALL_MODE_METRICS.map(async (m) => {
              const params = buildParams(filters, m)
              const response = await fetch(`/api/analytics/v3?${params.toString()}`, {
                signal: controller.signal,
              })
              if (!response.ok) {
                const body = await response.json().catch(() => ({ error: 'Request failed' }))
                throw new Error(body.error || `HTTP ${response.status}`)
              }
              return { metric: m, json: await response.json() }
            })
          ),
          engagementPromise,
        ])

        if (!controller.signal.aborted) {
          const multiMap: MultiMetricData = {}
          const multiAbsMap: MultiMetricData = {}
          let totalSum = 0
          let avgSum = 0
          let count = 0

          for (const { metric: m, json } of metricsResults) {
            multiMap[m] = json.current ?? []
            multiAbsMap[m] = json.absolute ?? []
            if (json.summary) {
              totalSum += json.summary.total ?? 0
              avgSum += json.summary.average ?? 0
              count++
            }
          }

          // Use impressions as the "primary" data for single-metric consumers
          setData(multiMap.impressions ?? [])
          setAbsoluteData(multiAbsMap.impressions ?? [])
          setMultiData(multiMap)
          setMultiAbsoluteData(multiAbsMap)
          setSummary({
            total: totalSum,
            average: count > 0 ? Math.round((avgSum / count) * 100) / 100 : 0,
            change: 0,
          })
          setComparisonData(null)
          setEngagementBreakdown(engagementJson.posts ?? engagementJson.data ?? [])
        }
      } else {
        // Single metric fetch + engagement breakdown in parallel
        const params = buildParams(filters)
        const [response, engagementJson] = await Promise.all([
          fetch(`/api/analytics/v3?${params.toString()}`, {
            signal: controller.signal,
          }),
          engagementPromise,
        ])

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `HTTP ${response.status}`)
        }

        const json = await response.json()

        if (!controller.signal.aborted) {
          setData(json.current ?? [])
          setAbsoluteData(json.absolute ?? [])
          setSummary(json.summary ?? null)
          setComparisonData(json.comparison ?? null)
          setMultiData(null)
          setMultiAbsoluteData(null)
          setEngagementBreakdown(engagementJson.posts ?? engagementJson.data ?? [])
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Analytics V3 fetch error:', err)
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
        setData([])
        setAbsoluteData([])
        setSummary(null)
        setComparisonData(null)
        setMultiData(null)
        setMultiAbsoluteData(null)
        setEngagementBreakdown([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [filters.metric, filters.period, filters.startDate, filters.endDate, filters.contentType, filters.compare])

  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, absoluteData, summary, comparisonData, multiData, multiAbsoluteData, engagementBreakdown, isLoading, error }
}
