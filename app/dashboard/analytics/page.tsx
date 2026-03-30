"use client"

/**
 * Analytics Page
 * @description Analytics page with filter bar, summary metrics,
 * trend chart with comparison overlay, and data table.
 * @module app/dashboard/analytics/page
 */

import { useState, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { AnalyticsSkeleton } from "@/components/skeletons/page-skeletons"
import { PageContent } from "@/components/shared/page-content"
import { AnalyticsFilterBar } from "@/components/features/analytics-filter-bar"
import { AnalyticsSummaryBar } from "@/components/features/analytics-summary-bar"
import { AnalyticsTrendChart } from "@/components/features/analytics-trend-chart"
import { AnalyticsDataTable } from "@/components/features/analytics-data-table"
import { AnalyticsChartsSection } from "@/components/features/analytics-charts"
import { useAnalyticsV3, type AnalyticsV3Filters } from "@/hooks/use-analytics-v3"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations"

/**
 * Default filter values, optionally hydrated from URL search params
 * @param searchParams - URL search params
 * @returns Default filter configuration
 */
function getDefaultFilters(searchParams: URLSearchParams): AnalyticsV3Filters {
  return {
    metric: searchParams.get("metric") || "impressions",
    period: searchParams.get("period") || "30d",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    contentType: searchParams.get("contentType") || "all",
    compare: searchParams.get("compare") === "true",
    granularity: searchParams.get("granularity") || "daily",
  }
}

/**
 * Analytics page content component with V2 dashboard
 */
function AnalyticsContent() {
  const { user, profile, isLoading: authLoading } = useAuthContext()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<AnalyticsV3Filters>(() => getDefaultFilters(searchParams))
  const { data, absoluteData, summary, comparisonData, multiData, multiAbsoluteData, engagementBreakdown, isLoading, error } = useAnalyticsV3(filters)

  /**
   * Handle granularity changes from the data table
   */
  const handleGranularityChange = useCallback((granularity: string) => {
    setFilters((prev) => ({ ...prev, granularity }))
  }, [])

  if (authLoading) {
    return <AnalyticsSkeleton />
  }

  return (
    <PageContent>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Track your LinkedIn post performance and engagement metrics.
        </p>
      </div>

      {/* FE-001: Filter Bar */}
      <AnalyticsFilterBar filters={filters} onFiltersChange={setFilters} dataStartDate={absoluteData?.[0]?.date} />

      {/* FE-002: Summary Bar */}
      <AnalyticsSummaryBar
        summary={summary}
        metric={filters.metric}
        isLoading={isLoading}
      />

      {/* FE-003/004/005: Trend Chart with comparison overlay */}
      <motion.div
        variants={staggerContainerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItemVariants}>
          <AnalyticsTrendChart
            data={absoluteData}
            comparisonData={comparisonData}
            metric={filters.metric}
            compareActive={filters.compare}
            isLoading={isLoading}
            multiData={multiAbsoluteData}
          />
        </motion.div>
      </motion.div>

      {/* Analytics Charts Grid */}
      <AnalyticsChartsSection userId={user?.id} isLoading={isLoading} engagementBreakdown={engagementBreakdown} />

      {/* Data Table */}
      <motion.div
        variants={staggerContainerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItemVariants}>
          <AnalyticsDataTable
            data={absoluteData}
            metric={filters.metric}
            granularity={filters.granularity}
            onGranularityChange={handleGranularityChange}
            isLoading={isLoading}
            multiData={multiAbsoluteData}
          />
        </motion.div>
      </motion.div>
    </PageContent>
  )
}

/**
 * Analytics page component
 * @returns Analytics page with filter bar, summary, trend chart, and data table
 */
export default function AnalyticsPage() {
  usePageMeta({ title: "Analytics" })

  return <AnalyticsContent />
}
