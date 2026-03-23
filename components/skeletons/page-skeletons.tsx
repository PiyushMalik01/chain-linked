/**
 * Page Skeletons
 * @description Collection of skeleton loading placeholders that mirror the layout
 * of each dashboard page (dashboard, analytics, posts, compose, etc.) for a
 * seamless loading experience.
 * @module components/skeletons/page-skeletons
 */

"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * DashboardSkeleton - Loading placeholder for the dashboard page
 * @description Matches: Greeting + Quick Compose + 4 Stat Cards + Calendar/Upcoming sidebar
 * @returns Skeleton layout matching the dashboard page structure
 * @example
 * <DashboardSkeleton />
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 animate-in fade-in duration-300">
      {/* Greeting */}
      <div className="px-4 lg:px-6 flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-4 w-32 hidden md:block" />
      </div>

      {/* Quick Compose Card */}
      <div className="px-4 lg:px-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full flex-shrink-0" />
              <Skeleton className="h-10 flex-1 rounded-full" />
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-4 w-20 hidden sm:block" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid gap-4 px-4 lg:px-6 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar + Upcoming Posts */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[1fr_360px] lg:px-6">
        {/* Calendar */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Posts Panel */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                <Skeleton className="size-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * ComposeSkeleton - Loading placeholder for the compose page
 * @description Matches: Single-column with draft status + PostComposer + Remix section
 * @returns Skeleton layout matching the compose page structure
 */
export function ComposeSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      {/* Draft status indicator */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Post Composer */}
      <Card className="border-border/50">
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Textarea */}
          <Skeleton className="h-48 w-full rounded-lg" />
          {/* Character counter */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2 w-48 rounded-full" />
          </div>
          {/* Media & action row */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Preview */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 mt-1" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="flex justify-between pt-2 border-t">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-16" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remix from my posts - collapsible section */}
      <Card className="border-border/50">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="size-5" />
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

/**
 * ScheduleSkeleton - Loading placeholder for the schedule page
 * @description Matches: 4 stat cards + full-width calendar + scheduled posts list
 * @returns Skeleton layout matching the schedule page structure
 */
export function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      {/* Header with Schedule Post button */}
      <div className="flex items-center justify-end">
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar - full width */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Posts list */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
              <Skeleton className="size-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="flex gap-1">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * TemplatesSkeleton - Loading placeholder for the templates page
 * @description Matches: Header + search bar + category pill filters + template grid + AI section
 * @returns Skeleton layout matching the templates page structure
 */
export function TemplatesSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56 mt-1" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Template count */}
      <Skeleton className="h-4 w-28" />

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-5 w-14 rounded-full" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-1">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Separator */}
      <Skeleton className="h-px w-full" />

      {/* AI Templates section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50 border-dashed">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * InspirationSkeleton - Loading placeholder for the inspiration page
 * @description Matches: Capsule tab bar + InspirationFeed grid + FollowedInfluencers sidebar
 * @returns Skeleton layout matching the inspiration page structure
 */
export function InspirationSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      {/* Animated capsule tab bar */}
      <div className="flex justify-center">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>

      {/* Main content: Feed + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Inspiration Feed */}
        <div className="space-y-4">
          {/* Search/filter bar */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>

          {/* Post cards - single column feed */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40 mt-1" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-24 w-full" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Followed Influencers Sidebar */}
        <Card className="border-border/50 h-fit">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                <Skeleton className="size-10 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32 mt-1" />
                </div>
                <Skeleton className="size-8 rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-9 w-full rounded-lg mt-2" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * CarouselsSkeleton - Loading placeholder for the carousels page
 * @description Displays: Template selector, slide preview, and editor
 * @returns Skeleton layout matching the carousels page structure
 */
export function CarouselsSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 animate-in fade-in duration-300">
      <div className="px-4 lg:px-6">
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64 mt-1" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Panel - Templates & Slides */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="size-8" />
                  </div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-lg">
                      <Skeleton className="size-6" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="size-6" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* Center - Preview */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center">
                <Skeleton className="w-full max-w-md aspect-square rounded-xl" />
                <div className="flex items-center gap-2 mt-4">
                  <Skeleton className="size-8" />
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="size-2 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="size-8" />
                </div>
              </div>

              {/* Right Panel - Editor */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * AnalyticsSkeleton - Loading placeholder for the analytics page
 * @description Matches: Filter bar + Summary bar + Trend chart + Data table + Recent posts grid
 * @returns Skeleton layout matching the analytics page structure
 */
export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg ml-auto" />
      </div>

      {/* Summary Bar - inline metrics */}
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-12 font-bold" />
            <Skeleton className="h-4 w-10 rounded-full" />
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent>
          {/* Table header */}
          <div className="flex items-center gap-4 p-3 border-b">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 flex-1" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-12 flex-1" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Posts */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * TeamSkeleton - Loading placeholder for the team page
 * @description Matches: TeamHeader + capsule tab bar + Leaderboard + Post grid (3 cols)
 * @returns Skeleton layout matching the team page structure
 */
export function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 animate-in fade-in duration-300">
      {/* Team Header */}
      <div className="px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 mt-1" />
          </div>
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </div>

      {/* Capsule Tab Bar */}
      <div className="flex justify-center px-4 lg:px-6">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="px-4 lg:px-6 max-w-5xl mx-auto w-full">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-16 rounded-lg" />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20 mt-1" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Team Activity */}
      <div className="px-4 lg:px-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* 3-column post grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 flex flex-col">
              <CardContent className="p-4 space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-0.5" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full flex-1" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </CardContent>
              {/* Remix button */}
              <div className="px-4 pb-3">
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * SwipeSkeleton - Loading placeholder for the swipe page
 * @description Matches: Filter bar + card stack + 4 action buttons + keyboard hint + stats card
 * @returns Skeleton layout matching the swipe page structure
 */
export function SwipeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 p-4 md:p-6 animate-in fade-in duration-300">
      {/* Filter Bar */}
      <div className="flex w-full max-w-md items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Card Stack */}
      <div className="relative h-[520px] w-full max-w-lg">
        {/* Background cards */}
        <div className="absolute inset-0 scale-[0.94] translate-y-4">
          <Skeleton className="h-full w-full rounded-xl opacity-30" />
        </div>
        <div className="absolute inset-0 scale-[0.97] translate-y-2">
          <Skeleton className="h-full w-full rounded-xl opacity-50" />
        </div>
        {/* Top card */}
        <Card className="absolute inset-0">
          <CardContent className="flex h-full flex-col p-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            {/* Content */}
            <div className="mt-4 flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            {/* Footer */}
            <div className="mt-4 pt-3 border-t">
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons - 4 buttons */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-11 md:size-10 rounded-full" />
        <Skeleton className="size-11 md:size-10 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>

      {/* Keyboard Hint */}
      <Skeleton className="h-4 w-48" />

      {/* Stats Card */}
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-6 w-8 mx-auto" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * SettingsSkeleton - Loading placeholder for the settings page
 * @description Matches: Left sidebar navigation + right content panel (2-column)
 * @returns Skeleton layout matching the settings page structure
 */
export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Left Sidebar Nav */}
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg">
              <Skeleton className="size-5" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="space-y-6">
          {/* Section title */}
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56 mt-1" />
          </div>

          {/* Avatar section */}
          <div className="flex items-center gap-6">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>

          {/* Save button */}
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
