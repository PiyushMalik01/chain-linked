"use client"

/**
 * Analytics Filter Bar Component (FE-001)
 * @description Top-level filter controls for the analytics dashboard including
 * metric selector with "All Metrics" and profile metrics, time period toggle,
 * content type filter, and compare toggle.
 * @module components/features/analytics-filter-bar
 */

import { useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  IconCalendar,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { AnalyticsV3Filters } from "@/hooks/use-analytics-v3"

/** Content type options for filtering posts */
const CONTENT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "carousel", label: "Carousel" },
  { value: "document", label: "Document" },
  { value: "article", label: "Article" },
  { value: "poll", label: "Poll" },
] as const

/** Preset time periods */
const PERIOD_OPTIONS = ["7d", "30d", "90d", "1y"] as const

/**
 * Props for the AnalyticsFilterBar component
 */
/** Maps period codes to their required number of days of data */
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

interface AnalyticsFilterBarProps {
  /** Current filter values */
  filters: AnalyticsV3Filters
  /** Callback when any filter changes */
  onFiltersChange: (filters: AnalyticsV3Filters) => void
  /** Earliest date with data (YYYY-MM-DD) — used to grey out periods without enough data */
  dataStartDate?: string
}

/**
 * Analytics Filter Bar with URL-synced filter controls
 * @param props - Component props
 * @param props.filters - Current filter state
 * @param props.onFiltersChange - Handler for filter state changes
 * @returns Filter bar with metric selector, period toggle, content type, and compare controls
 */
export function AnalyticsFilterBar({ filters, onFiltersChange, dataStartDate }: AnalyticsFilterBarProps) {
  // Calculate how many days of data we have
  const daysOfData = dataStartDate
    ? Math.floor((Date.now() - new Date(dataStartDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /**
   * Update filters and sync to URL search params
   */
  const updateFilters = useCallback(
    (updates: Partial<AnalyticsV3Filters>) => {
      const newFilters = { ...filters, ...updates }
      onFiltersChange(newFilters)

      // Sync to URL
      const params = new URLSearchParams(searchParams.toString())
      params.set("metric", newFilters.metric)
      params.set("period", newFilters.period)
      params.set("contentType", newFilters.contentType)
      params.set("compare", String(newFilters.compare))
      params.set("granularity", newFilters.granularity)

      if (newFilters.period === "custom" && newFilters.startDate && newFilters.endDate) {
        params.set("startDate", newFilters.startDate)
        params.set("endDate", newFilters.endDate)
      } else {
        params.delete("startDate")
        params.delete("endDate")
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [filters, onFiltersChange, router, pathname, searchParams]
  )

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {/* Metric Selector with grouped options */}
        <Select
          value={filters.metric}
          onValueChange={(value) => updateFilters({ metric: value })}
        >
          <SelectTrigger className="w-[170px]" aria-label="Select metric">
            <SelectValue placeholder="Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Metrics</SelectItem>
            <SelectGroup>
              <SelectLabel>Post Metrics</SelectLabel>
              <SelectItem value="impressions">Impressions</SelectItem>
              <SelectItem value="reactions">Reactions</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
              <SelectItem value="reposts">Reposts</SelectItem>
              <SelectItem value="engagements">Engagements</SelectItem>
              <SelectItem value="engagements_rate">Engagement Rate</SelectItem>
              <SelectItem value="saves">Saves</SelectItem>
              <SelectItem value="sends">Sends</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Profile Metrics</SelectLabel>
              <SelectItem value="followers">Followers</SelectItem>
              <SelectItem value="profile_views">Profile Views</SelectItem>
              <SelectItem value="search_appearances">Search Appearances</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Time Period Toggle (desktop) */}
        <ToggleGroup
          type="single"
          value={filters.period === "custom" ? "" : filters.period}
          onValueChange={(value) => {
            if (value) updateFilters({ period: value })
          }}
          variant="outline"
          className="hidden sm:flex"
        >
          {PERIOD_OPTIONS.map((p) => {
            const requiredDays = PERIOD_DAYS[p] || 0
            const hasEnoughData = daysOfData > 0 && daysOfData >= requiredDays
            return (
              <ToggleGroupItem
                key={p}
                value={p}
                aria-label={`Last ${p}`}
                disabled={!hasEnoughData}
                className={cn(
                  "transition-all data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
                  !hasEnoughData && "opacity-40 cursor-not-allowed"
                )}
                title={!hasEnoughData ? `Need ${requiredDays} days of data (have ${daysOfData})` : undefined}
              >
                {p.toUpperCase()}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>

        {/* Time Period Select (mobile) */}
        <Select
          value={filters.period === "custom" ? "custom" : filters.period}
          onValueChange={(value) => {
            if (value !== "custom") {
              updateFilters({ period: value })
            }
          }}
        >
          <SelectTrigger className="w-[120px] sm:hidden" aria-label="Select time range">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => {
              const requiredDays = PERIOD_DAYS[p] || 0
              const hasEnoughData = daysOfData > 0 && daysOfData >= requiredDays
              return (
                <SelectItem key={p} value={p} disabled={!hasEnoughData}>
                  Last {p.toUpperCase()}{!hasEnoughData ? ' (not enough data)' : ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Custom Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.period === "custom" ? "default" : "outline"}
              size="sm"
              className={cn("gap-1.5", daysOfData === 0 && "opacity-40 cursor-not-allowed")}
              disabled={daysOfData === 0}
              title={daysOfData === 0 ? "No data available yet" : undefined}
            >
              <IconCalendar className="size-3.5" />
              <span className="hidden sm:inline">Custom</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="grid gap-3">
              <p className="text-sm font-medium">Custom Date Range</p>
              <div className="grid gap-2">
                <Label htmlFor="analytics-start-date">Start Date</Label>
                <Input
                  id="analytics-start-date"
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) =>
                    updateFilters({
                      period: "custom",
                      startDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="analytics-end-date">End Date</Label>
                <Input
                  id="analytics-end-date"
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) =>
                    updateFilters({
                      period: "custom",
                      endDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Content Type Filter */}
        <Select
          value={filters.contentType}
          onValueChange={(value) => updateFilters({ contentType: value })}
        >
          <SelectTrigger className="w-[130px]" aria-label="Filter by content type">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>
    </div>
  )
}
