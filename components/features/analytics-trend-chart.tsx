"use client"

/**
 * Analytics Trend Chart Component (FE-003 + FE-004 + FE-005)
 * @description Recharts AreaChart displaying the selected metric over time with
 * gradient fill, optional comparison overlay, multi-line "all metrics" mode,
 * responsive layout, and tooltips.
 * @module components/features/analytics-trend-chart
 */

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
} from "recharts"
import { motion } from "framer-motion"
import {
  IconTrendingUp,
} from "@tabler/icons-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { fadeSlideUpVariants } from "@/lib/animations"
import type { AnalyticsDataPoint, MultiMetricData } from "@/hooks/use-analytics-v3"
import { ALL_MODE_METRICS } from "@/hooks/use-analytics-v3"
import { LottieEmptyState } from "@/components/shared/lottie-empty-state"

/** Metric display labels */
const METRIC_LABELS: Record<string, string> = {
  impressions: "Impressions",
  unique_reach: "Unique Reach",
  reactions: "Reactions",
  comments: "Comments",
  reposts: "Reposts",
  saves: "Saves",
  sends: "Sends",
  engagements: "Engagements",
  engagements_rate: "Engagement Rate",
  followers: "Followers",
  profile_views: "Profile Views",
  search_appearances: "Search Appearances",
  connections: "Connections",
  all: "All Metrics",
}

/** Colors for each metric in "all" mode */
const METRIC_COLORS: Record<string, string> = {
  impressions: "oklch(0.55 0.15 230)",
  reactions: "oklch(0.60 0.18 145)",
  comments: "oklch(0.65 0.16 70)",
  reposts: "oklch(0.55 0.18 290)",
  engagements: "oklch(0.60 0.18 15)",
}

/** Primary chart color (CSS custom property) */
const PRIMARY_COLOR = "oklch(0.55 0.15 230)"
/** Comparison series color */
const COMPARISON_COLOR = "oklch(0.65 0.12 330)"

/**
 * Props for the AnalyticsTrendChart component
 */
interface AnalyticsTrendChartProps {
  /** Current period data points */
  data: AnalyticsDataPoint[]
  /** Comparison period data points (optional) */
  comparisonData: AnalyticsDataPoint[] | null
  /** Currently selected metric name */
  metric: string
  /** Whether comparison mode is active */
  compareActive: boolean
  /** Whether data is loading */
  isLoading: boolean
  /** Multi-metric data map (when metric is "all") */
  multiData?: MultiMetricData | null
}

/**
 * Format date for tooltip display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Format date for X-axis tick display
 * @param dateString - ISO date string
 * @returns Short formatted date
 */
function formatAxisDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Format Y-axis values with K/M suffixes
 * @param value - Numeric value
 * @returns Formatted string
 */
function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

/**
 * Loading skeleton for the chart
 */
function ChartSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  )
}

/**
 * Empty state with Lottie animation for when no analytics data is available
 */
function ChartEmptyState() {
  return (
    <div className="py-4">
      <LottieEmptyState
        title="Still getting your data"
        description="Please wait while we calculate your analytics. Data will appear here after your first sync."
      />
    </div>
  )
}

/**
 * Merge multi-metric data by date into a single array for the ComposedChart
 * @param multiData - Map of metric name to data points
 * @returns Array of objects with date + one key per metric
 */
function mergeMultiData(multiData: MultiMetricData): Record<string, unknown>[] {
  const dateMap = new Map<string, Record<string, unknown>>()

  for (const metric of ALL_MODE_METRICS) {
    const points = multiData[metric] ?? []
    for (const p of points) {
      if (!dateMap.has(p.date)) {
        dateMap.set(p.date, { date: p.date })
      }
      dateMap.get(p.date)![metric] = p.value
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => (a.date as string).localeCompare(b.date as string)
  )
}

/**
 * Analytics Trend Chart with optional comparison overlay and multi-line "all" mode
 * @param props - Component props
 * @returns AreaChart card with gradient fills, comparison line overlay, or multi-line chart
 */
export function AnalyticsTrendChart({
  data,
  comparisonData,
  metric,
  compareActive,
  isLoading,
  multiData,
}: AnalyticsTrendChartProps) {
  const metricLabel = METRIC_LABELS[metric] || metric
  const isAllMode = metric === "all" && multiData
  const hasData = isAllMode
    ? Object.values(multiData).some((arr) => arr.length > 0)
    : data.length > 0
  const showComparison = !isAllMode && compareActive && comparisonData && comparisonData.length > 0

  // Chart config for "all" mode
  const allModeConfig: ChartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {}
    for (const m of ALL_MODE_METRICS) {
      cfg[m] = {
        label: METRIC_LABELS[m] || m,
        color: METRIC_COLORS[m] || PRIMARY_COLOR,
      }
    }
    return cfg
  }, [])

  // Chart config for single metric
  const singleConfig: ChartConfig = React.useMemo(() => ({
    value: {
      label: metricLabel,
      color: PRIMARY_COLOR,
    },
    ...(showComparison
      ? {
          compValue: {
            label: `Previous ${metricLabel}`,
            color: COMPARISON_COLOR,
          },
        }
      : {}),
  }), [metricLabel, showComparison])

  // Merge multi-metric data for "all" mode
  const allChartData = React.useMemo(() => {
    if (!isAllMode) return []
    return mergeMultiData(multiData)
  }, [isAllMode, multiData])

  // Merge current and comparison data for the composed chart
  const chartData = React.useMemo(() => {
    if (isAllMode) return allChartData
    if (!showComparison) {
      return data.map((d) => ({ date: d.date, value: d.value }))
    }

    // Align comparison data by relative day offset within the period
    const maxLen = Math.max(data.length, comparisonData.length)
    return Array.from({ length: maxLen }, (_, i) => ({
      date: data[i]?.date ?? `offset-${i}`,
      value: data[i]?.value ?? null,
      compValue: comparisonData[i]?.value ?? null,
    }))
  }, [data, comparisonData, showComparison, isAllMode, allChartData])

  // Calculate tick interval based on data length
  const tickInterval = React.useMemo(() => {
    const length = isAllMode ? allChartData.length : data.length
    if (length <= 7) return 0
    if (length <= 14) return 1
    if (length <= 31) return 4
    if (length <= 90) return 13
    return Math.floor(length / 8)
  }, [data.length, isAllMode, allChartData.length])

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <ChartSkeleton />
      </Card>
    )
  }

  return (
    <motion.div
      variants={fadeSlideUpVariants}
      initial="initial"
      animate="animate"
    >
      <Card className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg dark:from-card dark:via-card dark:to-primary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <IconTrendingUp className="size-4 text-primary" />
            </div>
            {isAllMode ? "All Metrics Trend" : `${metricLabel} Trend`}
          </CardTitle>
          <CardDescription>
            {isAllMode
              ? "Comparing all post metrics over the selected time period"
              : showComparison
                ? `Comparing current and previous period ${metricLabel.toLowerCase()}`
                : `Your ${metricLabel.toLowerCase()} over the selected time period`}
          </CardDescription>
        </CardHeader>

        <CardContent className="relative px-2 pt-0 sm:px-6">
          {!hasData ? (
            <ChartEmptyState />
          ) : isAllMode ? (
            /* Multi-line chart for "all" mode */
            <motion.div
              key="all-metrics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <ChartContainer
                config={allModeConfig}
                className="aspect-auto h-[320px] w-full"
              >
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    interval={tickInterval}
                    tickFormatter={formatAxisDate}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={formatYAxis}
                    width={48}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={{
                      stroke: "var(--primary)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatDate(value as string)}
                        indicator="dot"
                        className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {ALL_MODE_METRICS.map((m) => (
                    <Line
                      key={m}
                      dataKey={m}
                      type="monotone"
                      stroke={METRIC_COLORS[m]}
                      strokeWidth={2}
                      dot={false}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      connectNulls={false}
                    />
                  ))}
                </ComposedChart>
              </ChartContainer>
            </motion.div>
          ) : (
            /* Single metric chart */
            <motion.div
              key={`${metric}-${compareActive}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <ChartContainer
                config={singleConfig}
                className="aspect-auto h-[280px] w-full"
              >
                {showComparison ? (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fill-trend-current" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PRIMARY_COLOR} stopOpacity={0.5} />
                        <stop offset="50%" stopColor={PRIMARY_COLOR} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={PRIMARY_COLOR} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      interval={tickInterval}
                      tickFormatter={formatAxisDate}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={formatYAxis}
                      width={48}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={{
                        stroke: "var(--primary)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => formatDate(value as string)}
                          indicator="dot"
                          className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                        />
                      }
                    />
                    <Area
                      dataKey="value"
                      type="monotone"
                      fill="url(#fill-trend-current)"
                      stroke={PRIMARY_COLOR}
                      strokeWidth={2.5}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                    <Line
                      dataKey="compValue"
                      type="monotone"
                      stroke={COMPARISON_COLOR}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      connectNulls={false}
                    />
                  </ComposedChart>
                ) : (
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fill-trend-main" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PRIMARY_COLOR} stopOpacity={0.5} />
                        <stop offset="50%" stopColor={PRIMARY_COLOR} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={PRIMARY_COLOR} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      interval={tickInterval}
                      tickFormatter={formatAxisDate}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={formatYAxis}
                      width={48}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={{
                        stroke: "var(--primary)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => formatDate(value as string)}
                          indicator="dot"
                          className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                        />
                      }
                    />
                    <Area
                      dataKey="value"
                      type="monotone"
                      fill="url(#fill-trend-main)"
                      stroke={PRIMARY_COLOR}
                      strokeWidth={2.5}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                )}
              </ChartContainer>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
