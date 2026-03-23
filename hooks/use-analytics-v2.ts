/**
 * Analytics V2 Hook
 * @description Fetches analytics data from the /api/analytics/v2 endpoint
 * with support for metric selection, time periods, content type filtering,
 * comparison periods, granularity controls, multi-metric "all" mode,
 * and profile metric routing.
 * @module hooks/use-analytics-v2
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/** Profile-level metrics that route to /api/analytics/v2/profile */
export const PROFILE_METRICS = ['followers', 'profile_views', 'search_appearances', 'connections'] as const

/** The five post metrics fetched in "all" mode */
export const ALL_MODE_METRICS = ['impressions', 'reactions', 'comments', 'reposts', 'engagements'] as const

/**
 * Filter configuration for the analytics V2 endpoint
 */
export interface AnalyticsV2Filters {
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
  /** Data granularity (daily, weekly, monthly, quarterly, yearly) */
  granularity: string
  /** Post source filter (all, extension, platform) */
  source?: 'all' | 'extension' | 'platform'
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
 * Multi-metric data map keyed by metric name (used in "all" mode)
 */
export type MultiMetricData = Record<string, AnalyticsDataPoint[]>

/**
 * Return type for the useAnalyticsV2 hook
 */
interface UseAnalyticsV2Return {
  /** Current period data points */
  data: AnalyticsDataPoint[]
  /** Summary statistics */
  summary: AnalyticsSummary | null
  /** Comparison period data points (when compare is enabled) */
  comparisonData: AnalyticsDataPoint[] | null
  /** Multi-metric data map (when metric is "all") */
  multiData: MultiMetricData | null
  /** Whether data is currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
}

/**
 * Check if a metric is a profile-level metric
 * @param metric - The metric name
 * @returns Whether this is a profile metric
 */
export function isProfileMetric(metric: string): boolean {
  return (PROFILE_METRICS as readonly string[]).includes(metric)
}

/**
 * Build URL params for analytics API calls
 * @param filters - Filter configuration
 * @param metricOverride - Optional metric override for parallel fetches
 * @returns URLSearchParams
 */
function buildParams(filters: AnalyticsV2Filters, metricOverride?: string): URLSearchParams {
  const metric = metricOverride || filters.metric
  const isProfile = isProfileMetric(metric)

  const params = new URLSearchParams({
    metric,
    period: filters.period,
    compare: String(filters.compare),
    granularity: filters.granularity,
  })

  // Source and contentType are only relevant for post metrics, not profile metrics
  if (!isProfile) {
    if (filters.contentType) params.append('contentType', filters.contentType)
    if (filters.source) params.append('source', filters.source)
  }

  if (filters.period === 'custom' && filters.startDate && filters.endDate) {
    params.set('startDate', filters.startDate)
    params.set('endDate', filters.endDate)
  }

  return params
}

/**
 * Hook to fetch and manage analytics V2 data
 * @param filters - Analytics filter configuration
 * @returns Analytics data, summary, comparison data, multi-metric data, loading, and error states
 * @example
 * const { data, summary, multiData, isLoading } = useAnalyticsV2({
 *   metric: 'all',
 *   period: '30d',
 *   contentType: 'all',
 *   compare: false,
 *   granularity: 'daily',
 * })
 */
export function useAnalyticsV2(filters: AnalyticsV2Filters): UseAnalyticsV2Return {
  const [data, setData] = useState<AnalyticsDataPoint[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [comparisonData, setComparisonData] = useState<AnalyticsDataPoint[] | null>(null)
  const [multiData, setMultiData] = useState<MultiMetricData | null>(null)
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
      const isProfile = isProfileMetric(filters.metric)
      const baseUrl = isProfile ? '/api/analytics/v2/profile' : '/api/analytics/v2'

      if (isAll) {
        // Parallel fetch for all five post metrics
        const results = await Promise.all(
          ALL_MODE_METRICS.map(async (m) => {
            const params = buildParams(filters, m)
            const response = await fetch(`/api/analytics/v2?${params.toString()}`, {
              signal: controller.signal,
            })
            if (!response.ok) {
              const body = await response.json().catch(() => ({ error: 'Request failed' }))
              throw new Error(body.error || `HTTP ${response.status}`)
            }
            return { metric: m, json: await response.json() }
          })
        )

        if (!controller.signal.aborted) {
          const multiMap: MultiMetricData = {}
          let totalSum = 0
          let avgSum = 0
          let count = 0

          for (const { metric: m, json } of results) {
            multiMap[m] = json.current ?? []
            if (json.summary) {
              totalSum += json.summary.total ?? 0
              avgSum += json.summary.average ?? 0
              count++
            }
          }

          // Use impressions as the "primary" data for single-metric consumers
          setData(multiMap.impressions ?? [])
          setMultiData(multiMap)
          setSummary({
            total: totalSum,
            average: count > 0 ? Math.round((avgSum / count) * 100) / 100 : 0,
            change: 0,
          })
          setComparisonData(null)
        }
      } else {
        // Single metric fetch (post or profile)
        const params = buildParams(filters)
        const response = await fetch(`${baseUrl}?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `HTTP ${response.status}`)
        }

        const json = await response.json()

        if (!controller.signal.aborted) {
          setData(json.current ?? [])
          setSummary(json.summary ?? null)
          setComparisonData(json.comparison ?? null)
          setMultiData(null)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Analytics V2 fetch error:', err)
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
        setData([])
        setSummary(null)
        setComparisonData(null)
        setMultiData(null)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [filters.metric, filters.period, filters.startDate, filters.endDate, filters.contentType, filters.compare, filters.granularity, filters.source])

  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, summary, comparisonData, multiData, isLoading, error }
}
