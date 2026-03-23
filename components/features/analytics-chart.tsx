"use client"

/**
 * Analytics Chart Component
 * @description Performance Trend chart with single-metric selection and time range filters
 * @module components/features/analytics-chart
 */

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { motion } from "framer-motion"
import { IconChartLine, IconTrendingUp } from "@tabler/icons-react"

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
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import { fadeSlideUpVariants } from '@/lib/animations'

/**
 * Data point for LinkedIn analytics chart
 */
interface AnalyticsDataPoint {
  date: string
  impressions: number
  engagements: number
}

/**
 * Props for the AnalyticsChart component
 */
export interface AnalyticsChartProps {
  data?: AnalyticsDataPoint[]
  isLoading?: boolean
}

type TimeRange = "7d" | "30d" | "90d"

/** Available metrics the user can select for the chart */
type MetricKey = "impressions" | "engagements"

/** Metric option for the selector dropdown */
interface MetricOption {
  value: MetricKey
  label: string
  color: string
}

const METRIC_OPTIONS: MetricOption[] = [
  { value: "impressions", label: "Impressions", color: "oklch(0.55 0.15 230)" },
  { value: "engagements", label: "Engagements", color: "oklch(0.65 0.18 250)" },
]

/**
 * Build chart config for the currently selected metric
 * @param metric - The selected metric key
 * @returns ChartConfig for the recharts container
 */
function buildChartConfig(metric: MetricKey): ChartConfig {
  const opt = METRIC_OPTIONS.find(o => o.value === metric)!
  return {
    [metric]: {
      label: opt.label,
      color: opt.color,
    },
  } satisfies ChartConfig
}

/**
 * Loading skeleton for chart
 */
function ChartSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-[250px] w-full rounded-lg" />
    </div>
  )
}

/**
 * Empty state with animation
 */
function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-12 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 p-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <IconChartLine className="size-8 text-primary" />
      </motion.div>
      <motion.h3
        className="text-lg font-medium"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        No analytics data yet
      </motion.h3>
      <motion.p
        className="mt-1 max-w-sm text-sm text-muted-foreground"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        Analytics will appear here once your LinkedIn activity is captured via the extension.
      </motion.p>
    </motion.div>
  )
}

/**
 * Summary stats displayed above the chart showing the selected metric total and average
 * @param props.data - Filtered chart data points
 * @param props.metric - Currently selected metric key
 */
function ChartSummary({ data, metric }: { data: AnalyticsDataPoint[], metric: MetricKey }) {
  const metricLabel = METRIC_OPTIONS.find(o => o.value === metric)!.label
  const total = data.reduce((sum, d) => sum + (d[metric] ?? 0), 0)
  const average = data.length > 0 ? total / data.length : 0

  return (
    <motion.div
      className="grid grid-cols-2 gap-4 border-b border-border/50 px-6 py-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
    >
      <div>
        <p className="text-xs font-medium text-muted-foreground">{metricLabel}</p>
        <p className="text-lg font-bold tabular-nums text-primary">
          {total.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Average</p>
        <p className="text-lg font-bold tabular-nums">
          {average.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </p>
      </div>
    </motion.div>
  )
}

function filterDataByTimeRange(
  data: AnalyticsDataPoint[],
  timeRange: TimeRange
): AnalyticsDataPoint[] {
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
  return data.filter(d => d.date >= cutoffStr)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatAxisDate(dateString: string, timeRange: TimeRange): string {
  const date = new Date(dateString)
  if (timeRange === "7d") {
    return date.toLocaleDateString("en-US", { weekday: "short" })
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * LinkedIn Analytics Chart Component - Performance Trend
 * @description Displays a single LinkedIn metric over time with metric and time range selectors
 */
export function AnalyticsChart({ data, isLoading = false }: AnalyticsChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("30d")
  const [selectedMetric, setSelectedMetric] = React.useState<MetricKey>("impressions")

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return []
    return filterDataByTimeRange(data, timeRange)
  }, [data, timeRange])

  const hasData = data && data.length > 0

  const currentChartConfig = React.useMemo(
    () => buildChartConfig(selectedMetric),
    [selectedMetric]
  )

  const currentColor = METRIC_OPTIONS.find(o => o.value === selectedMetric)!.color

  const tickInterval = React.useMemo(() => {
    switch (timeRange) {
      case "7d":
        return 1
      case "30d":
        return 4
      case "90d":
        return 13
      default:
        return 4
    }
  }, [timeRange])

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
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <CardHeader className="relative flex flex-col items-stretch space-y-0 border-b border-border/50 p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <IconTrendingUp className="size-4 text-primary" />
              </div>
              Performance Trend
            </CardTitle>
            <CardDescription>
              Track your metrics over time. Choose metric on the right.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 px-6 py-4">
            {/* Metric Selector */}
            <Select
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as MetricKey)}
            >
              <SelectTrigger className="w-[140px]" aria-label="Select metric">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Desktop: Toggle Group */}
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value as TimeRange)
              }}
              variant="outline"
              className="hidden sm:flex"
            >
              <ToggleGroupItem
                value="7d"
                aria-label="Last 7 days"
                className="transition-all data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                7D
              </ToggleGroupItem>
              <ToggleGroupItem
                value="30d"
                aria-label="Last 30 days"
                className="transition-all data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                30D
              </ToggleGroupItem>
              <ToggleGroupItem
                value="90d"
                aria-label="Last 90 days"
                className="transition-all data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                90D
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Mobile: Select Dropdown for time range */}
            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger className="sm:hidden" aria-label="Select time range">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* Summary Stats - shows selected metric total + average */}
        {hasData && <ChartSummary data={chartData} metric={selectedMetric} />}

        <CardContent className="relative px-2 pt-4 sm:px-6 sm:pt-6">
          {!hasData ? (
            <EmptyState />
          ) : (
            <motion.div
              key={selectedMetric}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <ChartContainer
                config={currentChartConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <AreaChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient id={`fill-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={currentColor}
                        stopOpacity={0.5}
                      />
                      <stop
                        offset="50%"
                        stopColor={currentColor}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor={currentColor}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
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
                    tickFormatter={(value) => formatAxisDate(value, timeRange)}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
                    }
                    width={48}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={{
                      stroke: 'var(--primary)',
                      strokeWidth: 1,
                      strokeDasharray: '4 4',
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
                    dataKey={selectedMetric}
                    type="monotone"
                    fill={`url(#fill-${selectedMetric})`}
                    stroke={currentColor}
                    strokeWidth={2.5}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ChartContainer>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default AnalyticsChart
