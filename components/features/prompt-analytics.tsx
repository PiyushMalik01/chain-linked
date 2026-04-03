/**
 * Prompt Analytics Component
 * @description Dashboard for prompt usage statistics and metrics
 * @module components/features/prompt-analytics
 */

"use client"

import * as React from "react"
import {
  usePromptAnalytics,
  usePromptAnalyticsWithRange,
  getDateRangeForPreset,
  type AnalyticsTimeRange,
} from "@/hooks/use-prompt-analytics"
import type { PromptType, PromptFeature, UsageAnalytics } from "@/lib/prompts/prompt-types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  IconChartBar,
  IconCoins,
  IconClock,
  IconCheck,
  IconX,
  IconTrendingUp,
  IconActivity,
  IconAlertCircle,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

/**
 * Props for PromptAnalytics component
 */
interface PromptAnalyticsProps {
  /** Filter by specific prompt ID */
  promptId?: string
  /** Filter by prompt type */
  promptType?: PromptType
  /** Optional additional class name */
  className?: string
  /** Whether to show in compact mode */
  compact?: boolean
}

/**
 * Time range labels for display
 */
const TIME_RANGE_LABELS: Record<AnalyticsTimeRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7days: "Last 7 days",
  last30days: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisQuarter: "This quarter",
  thisYear: "This year",
  custom: "Custom",
}

/**
 * Feature labels for display
 */
const FEATURE_LABELS: Record<PromptFeature, string> = {
  remix: "Remix",
  compose: "Compose",
  carousel: "Carousel",
  playground: "Playground",
  "edit-selection": "Edit Selection",
  "carousel-caption": "Carousel Caption",
  "analyze-company": "Analyze Company",
  "compose-series": "Compose Series",
  pipeline: "Pipeline",
}

/**
 * Feature colors for visualization
 */
const FEATURE_COLORS: Record<PromptFeature, string> = {
  remix: "bg-blue-500",
  compose: "bg-green-500",
  carousel: "bg-purple-500",
  playground: "bg-orange-500",
  "edit-selection": "bg-cyan-500",
  "carousel-caption": "bg-violet-500",
  "analyze-company": "bg-amber-500",
  "compose-series": "bg-emerald-500",
  pipeline: "bg-rose-500",
}

/**
 * Stat Card Component
 * @description Displays a single statistic with icon and optional trend
 */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  className,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  className?: string
}) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trendValue) && (
          <p className="text-xs text-muted-foreground mt-1">
            {trendValue && trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 mr-1",
                  trend === "up" && "text-green-600",
                  trend === "down" && "text-red-600"
                )}
              >
                {trend === "up" ? "+" : trend === "down" ? "-" : ""}
                {trendValue}
              </span>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for analytics
 */
function AnalyticsSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

/**
 * Empty state when no analytics data
 */
function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center py-12">
      <IconChartBar className="size-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground font-medium">No analytics data</p>
      <p className="text-sm text-muted-foreground mt-1">
        Usage data will appear here once prompts are used.
      </p>
    </Card>
  )
}

/**
 * Error state display
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center py-12">
      <IconAlertCircle className="size-12 text-destructive/50 mb-4" />
      <p className="text-destructive font-medium">Failed to load analytics</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <IconRefresh className="size-4" />
        Try Again
      </Button>
    </Card>
  )
}

/**
 * Feature usage breakdown component
 */
function FeatureBreakdown({
  byFeature,
  totalUsages,
}: {
  byFeature: Record<PromptFeature, number>
  totalUsages: number
}) {
  // Convert to array and sort by count
  const features = (Object.entries(byFeature) as [PromptFeature, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  if (features.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No feature data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {features.map(([feature, count]) => {
        const percentage = totalUsages > 0 ? (count / totalUsages) * 100 : 0
        return (
          <div key={feature} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-3 rounded", FEATURE_COLORS[feature])}
                />
                <span className="font-medium">{FEATURE_LABELS[feature]}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{count.toLocaleString()} uses</span>
                <Badge variant="secondary" className="text-xs">
                  {percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Model usage breakdown component
 */
function ModelBreakdown({
  byModel,
  totalUsages,
}: {
  byModel: Record<string, number>
  totalUsages: number
}) {
  const models = Object.entries(byModel)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  if (models.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No model data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {models.map(([model, count]) => {
        const percentage = totalUsages > 0 ? (count / totalUsages) * 100 : 0
        return (
          <div
            key={model}
            className="flex items-center justify-between p-2 bg-muted/30 rounded-md"
          >
            <div className="flex items-center gap-2">
              <IconSparkles className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium font-mono">{model}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {count.toLocaleString()}
              </span>
              <Badge variant="outline" className="text-xs">
                {percentage.toFixed(1)}%
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Format token count for display
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`
  }
  return tokens.toLocaleString()
}

/**
 * Estimate cost from tokens (rough estimate based on GPT-4 pricing)
 * @param tokens - Total tokens used
 * @returns Estimated cost string
 */
function estimateCost(tokens: number): string {
  // Rough estimate: ~$0.01 per 1K tokens (mix of input/output)
  const costPer1k = 0.01
  const cost = (tokens / 1000) * costPer1k
  if (cost < 0.01) return "<$0.01"
  return `$${cost.toFixed(2)}`
}

/**
 * Format milliseconds to readable string
 */
function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${Math.round(ms)}ms`
}

/**
 * Prompt Analytics Component
 * @description Dashboard displaying prompt usage statistics and metrics
 * @param props - Component props
 * @param props.promptId - Optional filter by specific prompt ID
 * @param props.promptType - Optional filter by prompt type
 * @param props.className - Optional additional class name
 * @param props.compact - Whether to show in compact mode
 * @returns Analytics dashboard component
 * @example
 * ```tsx
 * // Show all analytics
 * <PromptAnalytics />
 *
 * // Filter by prompt type
 * <PromptAnalytics promptType={PromptType.REMIX_PROFESSIONAL} />
 *
 * // Filter by specific prompt
 * <PromptAnalytics promptId="550e8400-e29b-41d4-a716-446655440000" />
 *
 * // Compact mode
 * <PromptAnalytics compact />
 * ```
 */
export function PromptAnalytics({
  promptId,
  promptType,
  className,
  compact = false,
}: PromptAnalyticsProps) {
  const [timeRange, setTimeRange] = React.useState<AnalyticsTimeRange>("last30days")
  const [featureFilter, setFeatureFilter] = React.useState<PromptFeature | "all">("all")

  // Calculate date range from time range
  const dateRange = React.useMemo(() => getDateRangeForPreset(timeRange), [timeRange])

  // Fetch analytics
  const { analytics, isLoading, error, refetch } = usePromptAnalytics({
    promptId,
    promptType,
    feature: featureFilter === "all" ? undefined : featureFilter,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  })

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("", className)}>
        <AnalyticsSkeleton compact={compact} />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("", className)}>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }

  // Show empty state
  if (!analytics || analytics.totalUsages === 0) {
    return (
      <div className={cn("", className)}>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconChartBar className="size-5 text-muted-foreground" />
          <h3 className="font-semibold">Usage Analytics</h3>
          {promptType && <Badge variant="outline">{promptType}</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as AnalyticsTimeRange)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7days">Last 7 days</SelectItem>
              <SelectItem value="last30days">Last 30 days</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
              <SelectItem value="thisQuarter">This quarter</SelectItem>
              <SelectItem value="thisYear">This year</SelectItem>
            </SelectContent>
          </Select>

          {!compact && (
            <Select
              value={featureFilter}
              onValueChange={(v) =>
                setFeatureFilter(v as PromptFeature | "all")
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All features</SelectItem>
                <SelectItem value="remix">Remix</SelectItem>
                <SelectItem value="compose">Compose</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
                <SelectItem value="playground">Playground</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button variant="ghost" size="icon" onClick={refetch}>
            <IconRefresh className="size-4" />
          </Button>
        </div>
      </div>

      {/* Date range indicator */}
      <div className="text-sm text-muted-foreground">
        Showing data from{" "}
        <span className="font-medium">
          {format(dateRange.startDate, "MMM d, yyyy")}
        </span>{" "}
        to{" "}
        <span className="font-medium">
          {format(dateRange.endDate, "MMM d, yyyy")}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Usage"
          value={analytics.totalUsages.toLocaleString()}
          description="API calls"
          icon={IconActivity}
        />
        <StatCard
          title="Success Rate"
          value={`${analytics.successRate.toFixed(1)}%`}
          description={`${analytics.errorCount} failed`}
          icon={analytics.successRate >= 95 ? IconCheck : IconX}
          trend={
            analytics.successRate >= 95
              ? "up"
              : analytics.successRate >= 80
                ? "neutral"
                : "down"
          }
        />
        <StatCard
          title="Tokens Used"
          value={formatTokens(analytics.totalTokens)}
          description={`~${estimateCost(analytics.totalTokens)} estimated`}
          icon={IconCoins}
        />
        <StatCard
          title="Avg Response Time"
          value={formatMs(analytics.avgResponseTimeMs)}
          description={`${formatTokens(analytics.avgTokens)} tokens/req`}
          icon={IconClock}
        />
      </div>

      {/* Detailed breakdowns (only in full mode) */}
      {!compact && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Feature breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage by Feature</CardTitle>
              <CardDescription>
                Distribution of prompt usage across features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureBreakdown
                byFeature={analytics.byFeature}
                totalUsages={analytics.totalUsages}
              />
            </CardContent>
          </Card>

          {/* Model breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage by Model</CardTitle>
              <CardDescription>
                AI models used for generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelBreakdown
                byModel={analytics.byModel}
                totalUsages={analytics.totalUsages}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily usage (only in full mode) */}
      {!compact && analytics.dailyUsage && analytics.dailyUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Usage</CardTitle>
            <CardDescription>Usage trends over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {analytics.dailyUsage.map((day, index) => {
                const maxCount = Math.max(
                  ...analytics.dailyUsage.map((d) => d.count)
                )
                const heightPercent =
                  maxCount > 0 ? (day.count / maxCount) * 100 : 0
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      title={`${day.date}: ${day.count} uses, ${formatTokens(day.tokens)} tokens`}
                    />
                    {index % 7 === 0 && (
                      <span className="text-xs text-muted-foreground truncate w-full text-center">
                        {format(new Date(day.date), "MMM d")}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
