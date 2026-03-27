"use client"

/**
 * Analytics Charts
 * @description Data visualization charts for the analytics page including
 * engagement breakdown over time, posting frequency vs performance,
 * content type performance comparison, and best posting days.
 * @module components/features/analytics-charts
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconLayersIntersect,
  IconCalendarStats,
  IconCategory,
  IconClockHour4,
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
import { createClient } from "@/lib/supabase/client"
import { staggerContainerVariants, staggerItemVariants } from "@/lib/animations"
import type { EngagementDataPoint } from "@/hooks/use-analytics-v3"

// ============================================================================
// Types
// ============================================================================

/** Raw post row from Supabase */
interface RawPost {
  impressions: number | null
  reactions: number | null
  comments: number | null
  reposts: number | null
  saves: number | null
  sends: number | null
  media_type: string | null
  posted_at: string | null
  created_at: string | null
}

/** Engagement stacked area data point */
interface EngagementTimePoint {
  date: string
  reactions: number
  comments: number
  reposts: number
  saves: number
}

/** Posting frequency data point */
interface FrequencyPoint {
  label: string
  posts: number
  avgImpressions: number
}

/** Content type performance data point */
interface ContentTypePoint {
  type: string
  avgImpressions: number
  avgEngagementRate: number
  count: number
}

/** Day of week performance data point */
interface DayOfWeekPoint {
  day: string
  avgImpressions: number
  avgEngagement: number
  posts: number
}

// ============================================================================
// Colors
// ============================================================================

const COLORS = {
  reactions: "oklch(0.60 0.18 145)",
  comments: "oklch(0.65 0.16 70)",
  reposts: "oklch(0.55 0.18 290)",
  saves: "oklch(0.55 0.15 230)",
}

const CONTENT_COLORS = [
  "oklch(0.55 0.15 230)",
  "oklch(0.60 0.18 145)",
  "oklch(0.65 0.16 70)",
  "oklch(0.55 0.18 290)",
  "oklch(0.60 0.18 15)",
  "oklch(0.50 0.14 180)",
  "oklch(0.65 0.12 330)",
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ============================================================================
// Data Hook
// ============================================================================

/**
 * Hook to fetch raw post data for chart calculations
 * @param userId - The user ID to fetch posts for
 * @returns Raw post data and loading state
 */
function useChartData(userId: string | undefined) {
  const [posts, setPosts] = useState<RawPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  const fetchPosts = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    try {
      const { data, error } = await supabaseRef.current
        .from("my_posts")
        .select("impressions, reactions, comments, reposts, saves, sends, media_type, posted_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })

      if (error || !data) {
        setPosts([])
      } else {
        setPosts(data)
      }
    } catch (err) {
      console.error("Chart data fetch error:", err)
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return { posts, isLoading }
}

// ============================================================================
// Data Transforms
// ============================================================================

/**
 * Aggregate engagement by week for stacked area chart
 */
function computeEngagementTimeline(posts: RawPost[]): EngagementTimePoint[] {
  const weekMap = new Map<string, EngagementTimePoint>()

  for (const p of posts) {
    if (!p.posted_at) continue
    const d = new Date(p.posted_at)
    // Get Monday of that week
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d)
    monday.setDate(diff)
    const key = monday.toISOString().slice(0, 10)

    if (!weekMap.has(key)) {
      weekMap.set(key, { date: key, reactions: 0, comments: 0, reposts: 0, saves: 0 })
    }
    const entry = weekMap.get(key)!
    entry.reactions += p.reactions ?? 0
    entry.comments += p.comments ?? 0
    entry.reposts += p.reposts ?? 0
    entry.saves += (p.saves ?? 0) + (p.sends ?? 0)
  }

  return Array.from(weekMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compute posting frequency and avg performance by month
 */
function computeFrequencyData(posts: RawPost[]): FrequencyPoint[] {
  const monthMap = new Map<string, { posts: number; totalImpressions: number }>()

  for (const p of posts) {
    // Use created_at (when captured by ChainLinked) so new users see current months
    const dateStr = p.created_at || p.posted_at
    if (!dateStr) continue
    const d = new Date(dateStr)
    const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })

    if (!monthMap.has(key)) {
      monthMap.set(key, { posts: 0, totalImpressions: 0 })
    }
    const entry = monthMap.get(key)!
    entry.posts++
    entry.totalImpressions += p.impressions ?? 0
  }

  return Array.from(monthMap.entries()).map(([label, val]) => ({
    label,
    posts: val.posts,
    avgImpressions: val.posts > 0 ? Math.round(val.totalImpressions / val.posts) : 0,
  }))
}

/**
 * Compute average metrics by content type
 */
function computeContentTypeData(posts: RawPost[]): ContentTypePoint[] {
  const typeMap = new Map<string, { impressions: number; engagement: number; engagementCount: number; count: number }>()

  for (const p of posts) {
    const type = p.media_type || "text"
    if (!typeMap.has(type)) {
      typeMap.set(type, { impressions: 0, engagement: 0, engagementCount: 0, count: 0 })
    }
    const entry = typeMap.get(type)!
    const imp = p.impressions ?? 0
    const eng = (p.reactions ?? 0) + (p.comments ?? 0) + (p.reposts ?? 0) + (p.saves ?? 0) + (p.sends ?? 0)
    entry.impressions += imp
    if (imp > 0) {
      entry.engagement += (eng / imp) * 100
      entry.engagementCount++
    }
    entry.count++
  }

  return Array.from(typeMap.entries())
    .map(([type, val]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      avgImpressions: Math.round(val.impressions / val.count),
      avgEngagementRate: val.engagementCount > 0
        ? Math.round((val.engagement / val.engagementCount) * 10) / 10
        : 0,
      count: val.count,
    }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
}

/**
 * Compute average performance by day of week
 */
function computeDayOfWeekData(posts: RawPost[]): DayOfWeekPoint[] {
  const dayMap = new Map<number, { impressions: number; engagement: number; count: number }>()

  for (let i = 0; i < 7; i++) {
    dayMap.set(i, { impressions: 0, engagement: 0, count: 0 })
  }

  for (const p of posts) {
    const dateStr = p.created_at || p.posted_at
    if (!dateStr) continue
    const dayIndex = new Date(dateStr).getDay()
    const entry = dayMap.get(dayIndex)!
    const imp = p.impressions ?? 0
    const eng = (p.reactions ?? 0) + (p.comments ?? 0) + (p.reposts ?? 0) + (p.saves ?? 0) + (p.sends ?? 0)
    entry.impressions += imp
    entry.engagement += eng
    entry.count++
  }

  return Array.from(dayMap.entries()).map(([dayIndex, val]) => ({
    day: DAY_NAMES[dayIndex],
    avgImpressions: val.count > 0 ? Math.round(val.impressions / val.count) : 0,
    avgEngagement: val.count > 0 ? Math.round(val.engagement / val.count) : 0,
    posts: val.count,
  }))
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format number with K/M suffix
 */
function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

/**
 * Format week date as "Mar 5"
 */
function fmtWeek(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ============================================================================
// Chart Components
// ============================================================================

/**
 * Loading skeleton for chart cards
 */
function ChartCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

/**
 * Empty state for chart cards
 */
function ChartCardEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Not enough data yet
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Chart 1: Engagement Breakdown Stacked Area ----

const engagementConfig: ChartConfig = {
  reactions: { label: "Reactions", color: COLORS.reactions },
  comments: { label: "Comments", color: COLORS.comments },
  reposts: { label: "Reposts", color: COLORS.reposts },
  saves: { label: "Saves & Sends", color: COLORS.saves },
}

/**
 * Stacked area chart showing engagement breakdown over time (weekly)
 * @param props.data - Engagement timeline data
 */
function EngagementBreakdownChart({ data }: { data: EngagementTimePoint[] }) {
  if (data.length < 2) {
    return <ChartCardEmpty title="Engagement Breakdown" description="Shows engagement composition over time" />
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <IconLayersIntersect className="size-4 text-primary" />
          </div>
          Engagement Breakdown
        </CardTitle>
        <CardDescription>
          Weekly engagement composition by type
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={engagementConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {Object.entries(COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={fmtWeek}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmtNum}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => fmtWeek(v as string)}
                  indicator="dot"
                  className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="saves" type="monotone" fill="url(#fill-saves)" stroke={COLORS.saves} strokeWidth={1.5} stackId="1" />
            <Area dataKey="reposts" type="monotone" fill="url(#fill-reposts)" stroke={COLORS.reposts} strokeWidth={1.5} stackId="1" />
            <Area dataKey="comments" type="monotone" fill="url(#fill-comments)" stroke={COLORS.comments} strokeWidth={1.5} stackId="1" />
            <Area dataKey="reactions" type="monotone" fill="url(#fill-reactions)" stroke={COLORS.reactions} strokeWidth={1.5} stackId="1" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---- Chart 2: Posting Frequency & Performance (Dual Axis) ----

const frequencyConfig: ChartConfig = {
  posts: { label: "Posts", color: "oklch(0.55 0.15 230)" },
  avgImpressions: { label: "Avg Impressions", color: "oklch(0.60 0.18 15)" },
}

/**
 * Dual-axis chart: bars for post count, line for avg impressions per month
 * @param props.data - Frequency data points
 */
function PostingFrequencyChart({ data }: { data: FrequencyPoint[] }) {
  if (data.length < 2) {
    return <ChartCardEmpty title="Posting Frequency" description="Shows posting cadence vs performance" />
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <IconCalendarStats className="size-4 text-primary" />
          </div>
          Posting Frequency
        </CardTitle>
        <CardDescription>
          Monthly post count vs average impressions per post
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={frequencyConfig} className="aspect-auto h-[280px] w-full">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={36}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              label={{ value: "Posts", angle: -90, position: "insideLeft", style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmtNum}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              label={{ value: "Avg Impressions", angle: 90, position: "insideRight", style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                  formatter={(value, name) => {
                    if (name === "avgImpressions") return [fmtNum(value as number), "Avg Impressions"]
                    return [value, "Posts"]
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              yAxisId="left"
              dataKey="posts"
              fill="oklch(0.55 0.15 230)"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
              barSize={28}
            />
            <Line
              yAxisId="right"
              dataKey="avgImpressions"
              type="monotone"
              stroke="oklch(0.60 0.18 15)"
              strokeWidth={2.5}
              dot={{ fill: "oklch(0.60 0.18 15)", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--background)" }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---- Chart 3: Content Type Performance ----

const contentTypeConfig: ChartConfig = {
  avgImpressions: { label: "Avg Impressions", color: "oklch(0.55 0.15 230)" },
  avgEngagementRate: { label: "Avg Engagement Rate %", color: "oklch(0.60 0.18 145)" },
}

/**
 * Horizontal bar chart comparing avg impressions and engagement rate by content type
 * @param props.data - Content type data points
 */
function ContentTypeChart({ data }: { data: ContentTypePoint[] }) {
  if (data.length === 0) {
    return <ChartCardEmpty title="Content Performance" description="Shows how different content types perform" />
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <IconCategory className="size-4 text-primary" />
          </div>
          Content Performance
        </CardTitle>
        <CardDescription>
          Average impressions by content type ({data.reduce((s, d) => s + d.count, 0)} posts)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={contentTypeConfig} className="aspect-auto h-[280px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmtNum}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="type"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                  formatter={(value, name) => {
                    if (name === "avgEngagementRate") return [`${value}%`, "Engagement Rate"]
                    return [fmtNum(value as number), "Avg Impressions"]
                  }}
                />
              }
            />
            <Bar
              dataKey="avgImpressions"
              radius={[0, 4, 4, 0]}
              barSize={20}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={CONTENT_COLORS[index % CONTENT_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---- Chart 4: Best Posting Days ----

const dayOfWeekConfig: ChartConfig = {
  avgImpressions: { label: "Avg Impressions", color: "oklch(0.55 0.15 230)" },
  avgEngagement: { label: "Avg Engagements", color: "oklch(0.60 0.18 145)" },
}

/**
 * Bar chart showing average performance by day of week
 * @param props.data - Day of week data points
 */
function BestPostingDaysChart({ data }: { data: DayOfWeekPoint[] }) {
  const hasData = data.some((d) => d.posts > 0)
  if (!hasData) {
    return <ChartCardEmpty title="Best Posting Days" description="Shows which days perform best" />
  }

  const maxImpressions = Math.max(...data.map((d) => d.avgImpressions))

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <IconClockHour4 className="size-4 text-primary" />
          </div>
          Best Posting Days
        </CardTitle>
        <CardDescription>
          Average impressions by day of the week
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={dayOfWeekConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmtNum}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="rounded-xl border-border/50 bg-card/95 backdrop-blur-sm"
                  formatter={(value, name) => {
                    return [fmtNum(value as number), name === "avgImpressions" ? "Avg Impressions" : "Avg Engagements"]
                  }}
                />
              }
            />
            <Bar dataKey="avgImpressions" radius={[6, 6, 0, 0]} barSize={32}>
              {data.map((entry, index) => {
                const intensity = maxImpressions > 0 ? 0.3 + (entry.avgImpressions / maxImpressions) * 0.7 : 0.5
                return (
                  <Cell
                    key={index}
                    fill="oklch(0.55 0.15 230)"
                    fillOpacity={intensity}
                  />
                )
              })}
            </Bar>
            <Bar
              dataKey="avgEngagement"
              radius={[6, 6, 0, 0]}
              barSize={32}
              fill="oklch(0.60 0.18 145)"
              opacity={0.7}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analytics Charts Section - 2x2 grid of data visualization charts
 * @param props.userId - User ID to fetch posts for
 * @param props.isLoading - Whether parent analytics data is loading
 */
export function AnalyticsChartsSection({
  userId,
  isLoading: parentLoading,
  engagementBreakdown,
}: {
  userId: string | undefined
  isLoading: boolean
  engagementBreakdown?: EngagementDataPoint[]
}) {
  const { posts, isLoading: dataLoading } = useChartData(userId)
  const loading = parentLoading || dataLoading

  const engagementByWeek = useMemo(() => {
    if (!engagementBreakdown || engagementBreakdown.length === 0) return []

    const weekMap = new Map<string, { weekStart: string; reactions: number; comments: number; reposts: number; saves: number }>()

    for (const day of engagementBreakdown) {
      const d = new Date(day.date)
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      const weekKey = monday.toISOString().split('T')[0]

      const existing = weekMap.get(weekKey) || { weekStart: weekKey, reactions: 0, comments: 0, reposts: 0, saves: 0 }
      existing.reactions += day.reactions
      existing.comments += day.comments
      existing.reposts += day.reposts
      existing.saves += day.saves + day.sends
      weekMap.set(weekKey, existing)
    }

    return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  }, [engagementBreakdown])

  /** Map weekly engagement data to the chart's expected format */
  const engagementData = useMemo(() =>
    engagementByWeek.map((w) => ({
      date: w.weekStart,
      reactions: w.reactions,
      comments: w.comments,
      reposts: w.reposts,
      saves: w.saves,
    })),
    [engagementByWeek]
  )
  const frequencyData = useMemo(() => computeFrequencyData(posts), [posts])
  const contentTypeData = useMemo(() => computeContentTypeData(posts), [posts])
  const dayOfWeekData = useMemo(() => computeDayOfWeekData(posts), [posts])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2"
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItemVariants}>
        <EngagementBreakdownChart data={engagementData} />
      </motion.div>
      <motion.div variants={staggerItemVariants}>
        <PostingFrequencyChart data={frequencyData} />
      </motion.div>
      <motion.div variants={staggerItemVariants}>
        <ContentTypeChart data={contentTypeData} />
      </motion.div>
      <motion.div variants={staggerItemVariants}>
        <BestPostingDaysChart data={dayOfWeekData} />
      </motion.div>
    </motion.div>
  )
}
