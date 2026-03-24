/**
 * Analytics V2 API Route
 * @description Serves post-level analytics via Supabase RPC functions
 * with support for metric selection, time periods, content type filtering,
 * source filtering, comparison periods, and granularity controls.
 * @module app/api/analytics/v2
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Valid post-level metric names */
const POST_METRICS = [
  'impressions',
  'unique_reach',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'sends',
  'engagements',
  'engagements_rate',
] as const

type PostMetric = (typeof POST_METRICS)[number]

/** Valid granularity values for timeseries RPCs */
const VALID_GRANULARITIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
type Granularity = (typeof VALID_GRANULARITIES)[number]

/** Row shape returned by timeseries RPC functions */
interface TimeseriesRow {
  bucket_date: string
  value: number
}

/** Row shape returned by the summary RPC function */
interface SummaryRow {
  current_total: number
  current_avg: number
  current_count: number
  comp_total: number
  comp_avg: number
  comp_count: number
  pct_change: number
}

/**
 * Compute start date from a period string relative to a reference date
 * @param period - The period identifier (7d, 30d, 90d, 1y)
 * @param ref - The reference end date
 * @returns Start date for the period
 */
function periodStartDate(period: string, ref: Date): Date {
  const start = new Date(ref)
  switch (period) {
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case '90d':
      start.setDate(start.getDate() - 90)
      break
    case '1y':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      start.setDate(start.getDate() - 30)
  }
  return start
}

/**
 * Format a Date to YYYY-MM-DD string
 * @param d - Date object
 * @returns ISO date string
 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * GET /api/analytics/v2
 * @description Fetches post-level analytics using Supabase RPC functions
 * for summary, timeseries, and comparison data. Supports filtering by
 * content type and source.
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const metric = (searchParams.get('metric') || 'impressions') as PostMetric
  const period = searchParams.get('period') || '30d'
  const contentType = searchParams.get('contentType') || 'all'
  const compare = searchParams.get('compare') === 'true'
  const granularity = (searchParams.get('granularity') || 'daily') as Granularity
  const source = searchParams.get('source') || 'all'

  if (!POST_METRICS.includes(metric)) {
    return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 })
  }

  if (!VALID_GRANULARITIES.includes(granularity)) {
    return NextResponse.json({ error: `Invalid granularity: ${granularity}` }, { status: 400 })
  }

  // Determine date range
  const now = new Date()
  let endDate: Date
  let startDate: Date

  if (period === 'custom') {
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')
    if (!customStart || !customEnd) {
      return NextResponse.json({ error: 'startDate and endDate required for custom period' }, { status: 400 })
    }
    startDate = new Date(customStart)
    endDate = new Date(customEnd)
  } else {
    endDate = now
    startDate = periodStartDate(period, now)
  }

  const startStr = toDateStr(startDate)
  const endStr = toDateStr(endDate)

  // Compute comparison date range (same length, immediately preceding)
  const periodLengthMs = endDate.getTime() - startDate.getTime()
  const compStartDate = new Date(startDate.getTime() - periodLengthMs)
  const compEndDate = new Date(startDate.getTime() - 1)
  const compStartStr = toDateStr(compStartDate)
  const compEndStr = toDateStr(compEndDate)

  try {
    // Filter post IDs if contentType or source filter is active
    let postIds: string[] | null = null
    if (contentType !== 'all' || source !== 'all') {
      let query = supabase.from('my_posts').select('id').eq('user_id', user.id)
      if (contentType !== 'all') query = query.eq('media_type', contentType)
      if (source !== 'all') query = query.eq('source', source)
      const { data: filteredPosts } = await query

      postIds = filteredPosts?.map(p => p.id) ?? []
      if (postIds.length === 0) {
        return NextResponse.json({
          current: [],
          comparison: null,
          summary: { total: 0, average: 0, change: 0 },
        })
      }
    }

    // Try pre-computed cache first (no content/source filters — cache is user-wide)
    if (!postIds && period !== 'custom') {
      const { data: cached } = await supabase
        .from('analytics_summary_cache')
        .select('*')
        .eq('user_id', user.id)
        .eq('metric', metric)
        .eq('period', period)
        .eq('metric_type', 'post')
        .maybeSingle()

      if (cached && cached.computed_at) {
        const cacheAge = Date.now() - new Date(cached.computed_at).getTime()
        const FOUR_HOURS = 4 * 60 * 60 * 1000
        if (cacheAge < FOUR_HOURS) {
          const cachedTimeseries = (cached.timeseries as { date: string; value: number }[]) ?? []
          const summary = {
            total: metric === 'engagements_rate'
              ? Number(cached.current_avg)
              : Number(cached.current_total),
            average: Number(cached.current_avg),
            change: Number(cached.pct_change),
            compCount: Number(cached.comp_count),
            accumulativeTotal: Number(cached.accumulative_total) || null,
          }
          return NextResponse.json({
            current: cachedTimeseries,
            comparison: null,
            summary,
          })
        }
      }
    }

    // Fall back to RPC if cache miss or stale

    // Call summary RPC
    const { data: summaryData, error: summaryError } = await supabase.rpc('get_analytics_summary' as never, {
      p_user_id: user.id,
      p_metric: metric,
      p_start_date: startStr,
      p_end_date: endStr,
      p_comp_start_date: compStartStr,
      p_comp_end_date: compEndStr,
      p_post_ids: postIds,
    } as never)

    if (summaryError) {
      console.error('Analytics V2 summary RPC error:', summaryError)
      return NextResponse.json({ error: 'Failed to fetch analytics summary' }, { status: 500 })
    }

    // Call timeseries RPC based on granularity
    const rpcName = `get_analytics_timeseries_${granularity}`
    const { data: timeseriesData, error: tsError } = await supabase.rpc(rpcName as never, {
      p_user_id: user.id,
      p_metric: metric,
      p_start_date: startStr,
      p_end_date: endStr,
      p_post_ids: postIds,
    } as never)

    if (tsError) {
      console.error('Analytics V2 timeseries RPC error:', tsError)
      return NextResponse.json({ error: 'Failed to fetch timeseries data' }, { status: 500 })
    }

    // If compare, call daily timeseries for comparison period (FE-004)
    let comparisonData: { date: string; value: number }[] | null = null
    if (compare) {
      const { data: compData } = await supabase.rpc('get_analytics_timeseries_daily' as never, {
        p_user_id: user.id,
        p_metric: metric,
        p_start_date: compStartStr,
        p_end_date: compEndStr,
        p_post_ids: postIds,
      } as never)
      const compRows = (compData ?? []) as TimeseriesRow[]
      comparisonData = compRows.map(r => ({
        date: r.bucket_date,
        value: Math.round(Number(r.value) * 100) / 100,
      }))
    }

    // Format current timeseries
    const tsRows = (timeseriesData ?? []) as TimeseriesRow[]
    const current = tsRows.map(r => ({
      date: r.bucket_date,
      value: Math.round(Number(r.value) * 100) / 100,
    }))

    // Format summary from RPC result
    const summaryRows = (Array.isArray(summaryData) ? summaryData : [summaryData]) as SummaryRow[]
    const row = summaryRows[0]
    const summary = row
      ? {
          total:
            metric === 'engagements_rate'
              ? Math.round(Number(row.current_avg) * 100) / 100
              : Math.round(Number(row.current_total) * 100) / 100,
          average: Math.round(Number(row.current_avg) * 100) / 100,
          change: Math.round(Number(row.pct_change) * 100) / 100,
          compCount: Number(row.comp_count),
        }
      : { total: 0, average: 0, change: 0, compCount: 0 }

    return NextResponse.json({ current, comparison: comparisonData, summary })
  } catch (err) {
    console.error('Analytics V2 error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
