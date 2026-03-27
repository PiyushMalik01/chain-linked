"use client"

/**
 * Analytics Summary Bar Component (FE-002)
 * @description Displays summary statistics for the selected analytics metric
 * including total, average, and percentage change with animated number transitions.
 * Supports profile metrics with accumulative total display.
 * @module components/features/analytics-summary-bar
 */

import { motion } from "framer-motion"
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from "@tabler/icons-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { AnalyticsSummary } from "@/hooks/use-analytics-v3"
import { isProfileMetric } from "@/hooks/use-analytics-v2"
import { LottieEmptyState } from "@/components/shared/lottie-empty-state"
import { AnimatedNumber } from "@/components/shared/animated-number"

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

/**
 * Props for the AnalyticsSummaryBar component
 */
interface AnalyticsSummaryBarProps {
  /** Summary statistics from the API */
  summary: AnalyticsSummary | null
  /** Currently selected metric */
  metric: string
  /** Whether data is loading */
  isLoading: boolean
}

/**
 * Analytics Summary Bar showing total, average, and change for the selected metric
 * @param props - Component props
 * @param props.summary - Summary stats (total, average, change, accumulativeTotal)
 * @param props.metric - Current metric name
 * @param props.isLoading - Whether data is loading
 * @returns Summary bar card with animated numbers
 */
export function AnalyticsSummaryBar({ summary, metric, isLoading }: AnalyticsSummaryBarProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 pr-10">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) return null

  const label = METRIC_LABELS[metric] || metric
  const isRate = metric === "engagements_rate"
  const isProfile = isProfileMetric(metric)
  const isAll = metric === "all"
  const change = summary.change
  const hasComparison = (summary.compCount ?? 0) >= 3
  const isPositive = change > 0
  const isNeutral = change === 0

  const TrendIcon = isNeutral ? IconMinus : isPositive ? IconTrendingUp : IconTrendingDown

  // Show accumulative total as the main figure when available (absolute lifetime total)
  const totalValue = summary.accumulativeTotal != null && !isRate
    ? summary.accumulativeTotal
    : summary.total
  const totalLabel = isRate
    ? "Avg Rate"
    : `Total ${label}`

  // "All" mode: don't show a combined total — it's meaningless to sum different metrics.
  // Instead show a high-level overview.
  if (isAll) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Viewing all post metrics. Select a specific metric for detailed summary statistics.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="border-border/50">
        <CardContent className="py-4 pr-10">
          <div className="grid grid-cols-3 gap-4">
            {/* Total */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {totalLabel}
              </p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                <AnimatedNumber
                  value={totalValue}
                  decimals={isRate ? 2 : 0}
                  suffix={isRate ? "%" : ""}
                />
              </p>
            </div>

            {/* Average */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {isRate ? "Avg Rate (Period)" : "Daily Average"}
              </p>
              <p className="text-2xl font-bold tabular-nums">
                <AnimatedNumber
                  value={summary.average}
                  decimals={isRate ? 2 : (summary.average < 10 ? 1 : 0)}
                  suffix={isRate ? "%" : ""}
                />
              </p>
            </div>

            {/* Change */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                vs Previous Period
              </p>
              {hasComparison ? (
                <div className="flex items-center gap-1.5">
                  <p
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      isNeutral && "text-muted-foreground",
                      isPositive && "text-emerald-600 dark:text-emerald-400",
                      !isPositive && !isNeutral && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {isPositive && "+"}
                    <AnimatedNumber value={change} decimals={1} suffix="%" />
                  </p>
                  <TrendIcon
                    className={cn(
                      "size-5",
                      isNeutral && "text-muted-foreground",
                      isPositive && "text-emerald-600 dark:text-emerald-400",
                      !isPositive && !isNeutral && "text-red-600 dark:text-red-400"
                    )}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-1">
                  Not enough prior data
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
