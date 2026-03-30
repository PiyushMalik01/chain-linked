/**
 * Analytics V3 API Route
 * @description Serves account-level analytics from `daily_account_snapshots`.
 * Returns timeseries data with day-over-day deltas (or absolute values) and
 * summary statistics, with optional comparison period support.
 * @module app/api/analytics/v3
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Valid account-level metric names */
const ACCOUNT_METRICS = [
  'impressions',
  'reactions',
  'comments',
  'reposts',
  'saves',
  'sends',
  'engagements',
  'followers',
  'connections',
  'profile_views',
  'search_appearances',
] as const

type AccountMetric = (typeof ACCOUNT_METRICS)[number]

/** Maps public metric names to their corresponding database column */
const METRIC_COLUMN_MAP: Record<AccountMetric, string> = {
  impressions: 'total_impressions',
  reactions: 'total_reactions',
  comments: 'total_comments',
  reposts: 'total_reposts',
  saves: 'total_saves',
  sends: 'total_sends',
  engagements: 'total_engagements',
  followers: 'followers',
  connections: 'connections',
  profile_views: 'profile_views',
  search_appearances: 'search_appearances',
}

/** Valid period identifiers */
const VALID_PERIODS = ['7d', '30d', '90d', '1y', 'custom'] as const

/** Valid mode identifiers */
const VALID_MODES = ['absolute', 'delta'] as const
type Mode = (typeof VALID_MODES)[number]

/** Shape of a single daily_account_snapshots row (partial) */
interface SnapshotRow {
  date: string
  [key: string]: unknown
}

/** A single timeseries data point */
interface TimeseriesPoint {
  date: string
  value: number
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
 * @returns ISO date string (YYYY-MM-DD)
 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Build timeseries from snapshot rows
 * @param rows - Ordered snapshot rows (ascending by date)
 * @param column - The database column name to extract
 * @param mode - "delta" for day-over-day change, "absolute" for raw values
 * @returns Array of timeseries data points
 */
function buildTimeseries(
  rows: SnapshotRow[],
  column: string,
  mode: Mode
): TimeseriesPoint[] {
  if (rows.length === 0) return []

  if (mode === 'absolute') {
    return rows.map((row) => ({
      date: row.date,
      value: Math.round(Number(row[column] ?? 0) * 100) / 100,
    }))
  }

  // Delta mode: value = today - yesterday
  const points: TimeseriesPoint[] = []
  for (let i = 1; i < rows.length; i++) {
    const current = Number(rows[i][column] ?? 0)
    const previous = Number(rows[i - 1][column] ?? 0)
    const delta = Math.round((current - previous) * 100) / 100
    points.push({
      date: rows[i].date,
      value: delta,
    })
  }
  return points
}

/**
 * GET /api/analytics/v3
 * @description Fetches account-level analytics from daily_account_snapshots.
 * Supports metric selection, time periods, comparison periods, and
 * absolute/delta display modes.
 *
 * @param request - Incoming HTTP request
 * @returns JSON response with current timeseries, optional comparison, and summary stats
 *
 * @example
 * // Fetch 30-day impressions with deltas
 * GET /api/analytics/v3?metric=impressions&period=30d&mode=delta
 *
 * @example
 * // Fetch 7-day followers with comparison period
 * GET /api/analytics/v3?metric=followers&period=7d&compare=true&mode=absolute
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate parameters
  const { searchParams } = new URL(request.url)
  const metric = (searchParams.get('metric') || 'impressions') as AccountMetric
  const period = searchParams.get('period') || '30d'
  const compare = searchParams.get('compare') === 'true'
  const mode = (searchParams.get('mode') || 'delta') as Mode

  if (!ACCOUNT_METRICS.includes(metric)) {
    return NextResponse.json(
      { error: `Invalid metric: ${metric}` },
      { status: 400 }
    )
  }

  if (!VALID_PERIODS.includes(period as (typeof VALID_PERIODS)[number])) {
    return NextResponse.json(
      { error: `Invalid period: ${period}` },
      { status: 400 }
    )
  }

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `Invalid mode: ${mode}` },
      { status: 400 }
    )
  }

  // 3. Compute date range
  const now = new Date()
  let endDate: Date
  let startDate: Date

  if (period === 'custom') {
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')
    if (!customStart || !customEnd) {
      return NextResponse.json(
        { error: 'startDate and endDate required for custom period' },
        { status: 400 }
      )
    }
    startDate = new Date(customStart)
    endDate = new Date(customEnd)
  } else {
    endDate = now
    startDate = periodStartDate(period, now)
  }

  const column = METRIC_COLUMN_MAP[metric]

  // For delta mode, fetch one extra day before startDate so we can compute
  // the delta for the first day in the range.
  const fetchStart = new Date(startDate)
  if (mode === 'delta') {
    fetchStart.setDate(fetchStart.getDate() - 1)
  }

  const startStr = toDateStr(fetchStart)
  const endStr = toDateStr(endDate)

  // Compute comparison date range (same length, immediately preceding)
  const periodLengthMs = endDate.getTime() - startDate.getTime()
  const compStartDate = new Date(startDate.getTime() - periodLengthMs)
  const compFetchStart = new Date(compStartDate)
  if (mode === 'delta') {
    compFetchStart.setDate(compFetchStart.getDate() - 1)
  }
  const compEndDate = new Date(startDate.getTime() - 1)

  try {
    // 4. Fetch current period snapshots
    // Use `as never` to bypass generated types — daily_account_snapshots
    // may not yet be in the Database type definitions.
    const { data: currentRows, error: currentError } = await supabase
      .from('daily_account_snapshots' as never)
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    if (currentError) {
      console.error('Analytics V3 current period query error:', currentError)
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      )
    }

    const snapshots = (currentRows ?? []) as unknown as SnapshotRow[]

    // If only 1 day of data, delta mode returns empty — fall back to absolute
    // so the user sees their current values instead of "still getting your data"
    const effectiveMode: Mode = (mode === 'delta' && snapshots.length < 2) ? 'absolute' : mode
    const current = buildTimeseries(snapshots, column, effectiveMode)

    // 5. Fetch comparison period snapshots if requested
    let comparison: TimeseriesPoint[] | null = null
    let compSnapshots: SnapshotRow[] = []

    if (compare) {
      const compStartStr = toDateStr(compFetchStart)
      const compEndStr = toDateStr(compEndDate)

      const { data: compRows, error: compError } = await supabase
        .from('daily_account_snapshots' as never)
        .select('*')
        .eq('user_id', user.id)
        .gte('date', compStartStr)
        .lte('date', compEndStr)
        .order('date', { ascending: true })

      if (compError) {
        console.error('Analytics V3 comparison period query error:', compError)
      } else {
        compSnapshots = (compRows ?? []) as unknown as SnapshotRow[]
        comparison = buildTimeseries(compSnapshots, column, effectiveMode)
      }
    }

    // 6. Compute summary statistics
    // Use absolute values for total and average since delta-based calculations
    // show misleading zeros when data arrives in batches rather than incrementally.
    const absolute = buildTimeseries(snapshots, column, 'absolute')
    let total: number
    let average: number

    // Latest absolute value = the real total
    const latestAbsolute = snapshots.length > 0
      ? Math.round(Number(snapshots[snapshots.length - 1][column] ?? 0) * 100) / 100
      : 0

    total = latestAbsolute

    // Average based on absolute values across the period
    if (absolute.length > 0) {
      const absSum = absolute.reduce((sum, p) => sum + p.value, 0)
      average = Math.round((absSum / absolute.length) * 100) / 100
    } else {
      average = 0
    }

    // % change vs comparison period
    let change = 0
    let compCount = 0

    if (compare && compSnapshots.length > 1) {
      const compDeltas = buildTimeseries(compSnapshots, column, 'delta')
      compCount = compDeltas.length
      const compTotal = compDeltas.reduce((sum, p) => sum + p.value, 0)
      if (compTotal !== 0) {
        change = Math.round(((total - compTotal) / Math.abs(compTotal)) * 10000) / 100
      }
    }

    const summary = {
      total: Math.round(total * 100) / 100,
      average,
      change,
      compCount,
      accumulativeTotal: latestAbsolute,
    }

    return NextResponse.json({ current, absolute, comparison, summary })
  } catch (err) {
    console.error('Analytics V3 error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
