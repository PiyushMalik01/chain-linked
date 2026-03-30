"use client"

/**
 * Dashboard Page
 * @description Main dashboard for ChainLinked - LinkedIn content management platform.
 * Shows Getting Started checklist, metrics cards, a full-size schedule calendar,
 * and an upcoming scheduled posts panel.
 * @module app/dashboard/page
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import {
  ExtensionInstallBanner,
  ExtensionInstallPrompt,
  useExtensionPrompt,
} from "@/components/features/extension-install-prompt"
import { isPromptDismissed } from "@/lib/extension/detect"
import { ScheduleCalendar } from "@/components/features/schedule-calendar"
import type { ScheduledPostItem } from "@/components/features/schedule-calendar"
import { DashboardSkeleton } from "@/components/skeletons/page-skeletons"
import { useScheduledPosts } from "@/hooks/use-scheduled-posts"
import { useAnalytics } from "@/hooks/use-analytics"
import { MyRecentPostsSection, useMyRecentPosts } from "@/components/features/my-recent-posts"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  IconPencil,
  IconCalendarEvent,
  IconSparkles,
  IconEye,
  IconUserPlus,
  IconThumbUp,
  IconUser,
  IconTrendingUp,
  IconTrendingDown,
  IconCheck,
  IconX,
  IconClock,
  IconChevronRight,
  IconAlertTriangle,
  IconPlugConnected,
  IconFileText,
  IconTemplate,
  IconCarouselHorizontal,
  IconCloudDownload,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations"
import { AnimatedNumber } from "@/components/shared/animated-number"

// ============================================================================
// Metric Card
// ============================================================================

/**
 * Quick stat card for dashboard overview
 * @param props.title - Metric label
 * @param props.value - Numeric value
 * @param props.change - Percentage change from last period
 * @param props.icon - Tabler icon component
 * @param props.accent - Color accent theme
 * @param props.isLoading - Show skeleton
 */
function QuickStatCard({
  title,
  value,
  change,
  icon: Icon,
  suffix = "",
  decimals = 0,
  isLoading = false,
  accent = "primary",
  tooltip,
  periodLabel = "vs last period",
}: {
  title: string
  value: number
  change: number
  icon: React.ElementType
  suffix?: string
  decimals?: number
  isLoading?: boolean
  accent?: "primary" | "blue" | "emerald" | "amber"
  tooltip?: string
  periodLabel?: string
}) {
  const isPositive = change >= 0
  const TrendIcon = isPositive ? IconTrendingUp : IconTrendingDown

  const accentStyles = {
    primary: {
      card: "hover:border-primary/30 bg-gradient-to-br from-primary/8 via-transparent to-transparent",
      icon: "from-primary/15 to-primary/5 ring-primary/10",
      iconColor: "text-primary",
    },
    blue: {
      card: "hover:border-blue-500/30 bg-gradient-to-br from-blue-500/8 via-transparent to-transparent",
      icon: "from-blue-500/15 to-blue-500/5 ring-blue-500/10",
      iconColor: "text-blue-500",
    },
    emerald: {
      card: "hover:border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent",
      icon: "from-emerald-500/15 to-emerald-500/5 ring-emerald-500/10",
      iconColor: "text-emerald-500",
    },
    amber: {
      card: "hover:border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent",
      icon: "from-amber-500/15 to-amber-500/5 ring-amber-500/10",
      iconColor: "text-amber-500",
    },
  }

  const styles = accentStyles[accent]

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-16 mt-2" />
        </CardContent>
      </Card>
    )
  }

  const cardContent = (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card
        className={`border-border/50 ${styles.card} transition-all duration-300`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {title}
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                <AnimatedNumber
                  value={value}
                  decimals={decimals}
                  suffix={suffix}
                />
              </p>
            </div>
            <div
              className={`rounded-xl bg-gradient-to-br ${styles.icon} p-2.5 shadow-sm ring-1`}
            >
              <Icon className={`size-5 ${styles.iconColor}`} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/40">
            <TrendIcon
              className={`size-3.5 ${isPositive ? "text-emerald-500" : "text-red-500"}`}
            />
            <span
              className={`text-xs font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  if (!tooltip) return cardContent

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// Getting Started Checklist
// ============================================================================

/**
 * Getting Started checklist shown to new users until all steps are complete
 * or manually dismissed. Persists dismissal in localStorage.
 */
function GettingStartedChecklist({
  linkedInConnected,
  extensionInstalled,
  hasCreatedPost,
  hasScheduledPosts,
  onDismiss,
}: {
  linkedInConnected: boolean
  extensionInstalled: boolean
  hasCreatedPost: boolean
  hasScheduledPosts: boolean
  onDismiss: () => void
}) {
  const steps = [
    { label: "Connect LinkedIn", done: linkedInConnected, href: "/dashboard/settings" },
    { label: "Install extension", done: extensionInstalled, href: "/dashboard/settings" },
    { label: "Create first post", done: hasCreatedPost, href: "/dashboard/compose" },
    { label: "Schedule content", done: hasScheduledPosts, href: "/dashboard/schedule" },
  ]
  const completed = steps.filter((s) => s.done).length
  const progressPercent = (completed / steps.length) * 100

  if (completed === steps.length) return null

  return (
    <motion.div
      className="px-4 lg:px-6"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">Getting Started</h3>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {completed}/{steps.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={onDismiss}
            >
              <IconX className="size-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>

          <div className="h-1.5 bg-muted/50 rounded-full mb-3 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
              >
                {step.done ? (
                  <div className="size-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <IconCheck className="size-3 text-emerald-500" />
                  </div>
                ) : (
                  <div className="size-5 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {step.label}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// Upcoming Posts Sidebar
// ============================================================================

/**
 * Upcoming scheduled posts panel.
 * Shows up to 6 pending posts sorted by date, with content preview.
 */
function UpcomingPostsPanel({
  posts,
  isLoading,
  className,
}: {
  posts: ScheduledPostItem[]
  isLoading: boolean
  className?: string
}) {
  const upcomingPosts = useMemo(() => {
    const now = new Date()
    return posts
      .filter((p) => p.status === "pending" && p.scheduledFor > now)
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
      .slice(0, 6)
  }, [posts])

  if (isLoading) {
    return (
      <Card className={cn("border-border/50", className)}>
        <CardContent className="p-5">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="h-5 w-32 bg-muted rounded" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-border/50 h-full", className)}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <IconClock className="size-4 text-primary" />
            Upcoming Posts
          </h4>
          {posts.length > 0 && (
            <Link
              href="/dashboard/schedule"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View all
              <IconChevronRight className="size-3" />
            </Link>
          )}
        </div>

        {upcomingPosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="rounded-full bg-muted/50 p-3 mb-3">
              <IconCalendarEvent className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No upcoming posts</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[220px]">
              Schedule content to keep your LinkedIn consistently active.
            </p>
            <Button variant="default" size="sm" asChild>
              <Link href="/dashboard/compose" className="gap-1.5">
                <IconPencil className="size-3.5" />
                Create a post
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 flex-1">
            {upcomingPosts.map((post, idx) => (
              <div
                key={post.id}
                className={cn(
                  "group p-3 rounded-lg border border-border/40 hover:border-primary/30 bg-muted/20 hover:bg-muted/40 transition-all",
                  idx === 0 && "border-primary/20 bg-primary/5 hover:bg-primary/10"
                )}
              >
                <p className="text-sm leading-relaxed line-clamp-2 text-foreground/90">
                  {post.content.length > 100
                    ? post.content.slice(0, 100).trimEnd() + "..."
                    : post.content}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <IconCalendarEvent className="size-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {format(post.scheduledFor, "EEE, MMM d")} at{" "}
                    {format(post.scheduledFor, "h:mm a")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {formatDistanceToNow(post.scheduledFor, { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}

            {/* Quick compose CTA at bottom */}
            <div className="pt-2 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                asChild
              >
                <Link href="/dashboard/compose">
                  <IconPencil className="size-3.5" />
                  Schedule new post
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Dashboard Content
// ============================================================================

/**
 * Dashboard content with real data.
 * Layout: Getting Started → Welcome + Metrics → Calendar + Upcoming Posts
 */
function DashboardContent() {
  const { user, profile, extensionInstalled, extensionStatus } = useAuthContext()


  const router = useRouter()
  const supabaseRef = React.useRef(createClient())
  const supabase = supabaseRef.current
  const { posts: scheduledPosts, rawPosts: rawScheduledPosts, isLoading: scheduleLoading } =
    useScheduledPosts(30)

  // State for date posts picker dialog
  const [selectedDatePosts, setSelectedDatePosts] = useState<{ date: Date; posts: Array<{ id: string; content: string; scheduled_for: string }> } | null>(null)
  const { metrics, isLoading: analyticsLoading, periodLabel, todayCapture } = useAnalytics(user?.id)
  const { posts: recentPosts, isLoading: postsLoading } = useMyRecentPosts(user?.id, 9)

  /** Derive display name and avatar for the recent posts section */
  const userInfo = useMemo(() => {
    const linkedinProfile = profile?.linkedin_profile
    const rawData = linkedinProfile?.raw_data as Record<string, unknown> | null
    const linkedInName = rawData?.name as string | undefined
    const name = linkedInName || profile?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "You"
    const linkedInAvatar = (rawData?.profilePhotoUrl as string | undefined) || linkedinProfile?.profile_picture_url || profile?.linkedin_avatar_url
    const avatarUrl = linkedInAvatar || profile?.avatar_url || user?.user_metadata?.avatar_url || undefined
    return { name: name as string, avatarUrl: avatarUrl as string | undefined }
  }, [user, profile])

  /**
   * Check Getting Started completion state from Supabase.
   * Uses head-only count queries (no data transfer) run in parallel.
   */
  const [hasCreatedPost, setHasCreatedPost] = useState(false)
  const [hasScheduledContent, setHasScheduledContent] = useState(false)
  useEffect(() => {
    if (!user?.id) return
    const sb = supabase
    Promise.all([
      sb.from('my_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      sb.from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([myPostsRes, scheduledRes]) => {
      const myPostsCount = myPostsRes.count ?? 0
      const scheduledCount = scheduledRes.count ?? 0
      setHasCreatedPost((myPostsCount + scheduledCount) > 0)
      setHasScheduledContent(scheduledCount > 0)
    })
  }, [user?.id])

  const tourCompleted = profile?.dashboard_tour_completed !== false

  const { showPrompt, setShowPrompt } = useExtensionPrompt({
    delay: 2000,
    autoCheck: extensionInstalled === false && tourCompleted,
  })

  const [bannerDismissed, setBannerDismissed] = React.useState(false)
  const showExtensionBanner =
    tourCompleted &&
    extensionInstalled === false &&
    !isPromptDismissed() &&
    !bannerDismissed

  const [checklistDismissed, setChecklistDismissed] = React.useState(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem("chainlinked_checklist_dismissed") === "true"
    } catch {
      return false
    }
  })
  const dismissChecklist = React.useCallback(() => {
    setChecklistDismissed(true)
    try {
      localStorage.setItem("chainlinked_checklist_dismissed", "true")
    } catch {
      // noop
    }
  }, [])

  const displayName =
    profile?.full_name?.split(" ")[0] ||
    profile?.name?.split(" ")[0] ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there"

  /**
   * When a date is clicked in the calendar, navigate to compose with the date pre-filled
   */
  /** Navigate to compose in edit mode for a scheduled post */
  const handleEditScheduledPost = React.useCallback(
    (post: { id: string; content: string; scheduled_for: string }) => {
      sessionStorage.setItem('editScheduledPost', JSON.stringify({
        id: post.id,
        content: post.content,
        scheduledFor: post.scheduled_for,
      }))
      router.push(`/dashboard/compose?edit=${post.id}`)
    },
    [router]
  )

  const handleDateClick = React.useCallback(
    (date: Date) => {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      const postsOnDate = rawScheduledPosts.filter(p => {
        const s = p.status.toLowerCase()
        if (s === 'posted' || s === 'completed' || s === 'cancelled') return false
        const postDate = new Date(p.scheduled_for)
        return postDate >= dayStart && postDate <= dayEnd
      })

      if (postsOnDate.length === 0) {
        const scheduleDate = new Date(date)
        scheduleDate.setHours(9, 0, 0, 0)
        router.push(`/dashboard/compose?scheduleDate=${encodeURIComponent(scheduleDate.toISOString())}`)
      } else if (postsOnDate.length === 1) {
        handleEditScheduledPost(postsOnDate[0])
      } else {
        setSelectedDatePosts({ date, posts: postsOnDate })
      }
    },
    [rawScheduledPosts, router, handleEditScheduledPost]
  )

  return (
    <div
      className="flex flex-col gap-4 py-4 md:gap-6 md:py-6"
    >
      {/* Extension Install Banner */}
      <ExtensionInstallBanner
        visible={showExtensionBanner}
        onDismiss={() => setBannerDismissed(true)}
      />

      <ExtensionInstallPrompt
        open={showPrompt && tourCompleted}
        onOpenChange={setShowPrompt}
        onDismiss={(permanent) => {
          setShowPrompt(false)
          if (permanent) setBannerDismissed(true)
        }}
      />

      {/* Extension Login Warning — shown when extension is installed but not logged into LinkedIn */}
      {extensionInstalled === true && extensionStatus && !extensionStatus.linkedInLoggedIn && (
        <div className="mx-4 lg:mx-6 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <IconAlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Extension not logged into LinkedIn
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
              Open LinkedIn in your browser and sign in so the extension can sync your data.
            </p>
          </div>
          <a
            href="https://www.linkedin.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10">
              <IconPlugConnected className="size-4 mr-1.5" />
              Open LinkedIn
            </Button>
          </a>
        </div>
      )}

      {/* Extension Platform Login Warning — installed + LinkedIn logged in but not logged into ChainLinked in extension */}
      {extensionInstalled === true && extensionStatus && extensionStatus.linkedInLoggedIn && !extensionStatus.platformLoggedIn && (
        <div className="mx-4 lg:mx-6 flex items-center gap-3 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
          <IconAlertTriangle className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Extension not signed into ChainLinked
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
              Sign in to ChainLinked in the extension popup to start syncing your LinkedIn data.
            </p>
          </div>
        </div>
      )}

      {/* Today's Data Capture Banner */}
      {!analyticsLoading && todayCapture && (
        <div className="mx-4 lg:mx-6">
          <div className={cn(
            "flex items-center gap-3 rounded-lg border p-3",
            extensionStatus?.platformLoggedIn === false
              ? "border-amber-500/50 bg-amber-500/10"
              : todayCapture.hasData
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-muted-foreground/20 bg-muted/30"
          )}>
            <IconCloudDownload className={cn(
              "size-5 shrink-0",
              todayCapture.hasData
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )} />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                todayCapture.hasData
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground"
              )}>
                {todayCapture.hasData
                  ? `Synced today: ${todayCapture.apiCalls} data point${todayCapture.apiCalls !== 1 ? 's' : ''}`
                  : 'No data synced today'}
              </p>
              <p className={cn(
                "text-xs",
                todayCapture.hasData
                  ? "text-emerald-600/80 dark:text-emerald-400/80"
                  : "text-muted-foreground/70"
              )}>
                {todayCapture.lastSynced
                  ? `Last sync: ${formatDistanceToNow(new Date(todayCapture.lastSynced), { addSuffix: true })}`
                  : 'Open LinkedIn with the extension to start syncing'}
              </p>
            </div>
            {/* Extension login status badge — only trust live PING status */}
            <div className={cn(
              "shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              extensionStatus?.platformLoggedIn
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            )}>
              <span className={cn(
                "size-1.5 rounded-full",
                extensionStatus?.platformLoggedIn ? "bg-emerald-500" : "bg-amber-500"
              )} />
              {extensionStatus?.platformLoggedIn ? "Extension active" : "Extension offline"}
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Checklist */}
      {!checklistDismissed && (
        <GettingStartedChecklist
          linkedInConnected={!!profile?.linkedin_profile || !!profile?.linkedin_connected_at}
          extensionInstalled={extensionInstalled === true}
          hasCreatedPost={hasCreatedPost}
          hasScheduledPosts={hasScheduledContent}
          onDismiss={dismissChecklist}
        />
      )}

      {/* Welcome + Metrics */}
      <div className="px-4 lg:px-6" data-tour="welcome-section">
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                >
                  <IconSparkles className="size-6 text-primary" />
                </motion.div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {new Date().getHours() < 12
                    ? "Good morning"
                    : new Date().getHours() < 18
                      ? "Good afternoon"
                      : "Good evening"}
                  , {displayName}!
                </h2>
              </div>
              <p className="text-muted-foreground">
                Here&apos;s your LinkedIn content overview for today.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <IconCalendarEvent className="size-4" />
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </motion.div>

        {/* Start a post — LinkedIn-style quick compose card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-5"
        >
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5">
                <Avatar className="size-12 shrink-0 ring-2 ring-border/20 shadow-sm">
                  {(profile?.linkedin_avatar_url || profile?.avatar_url) && (
                    <AvatarImage
                      src={profile.linkedin_avatar_url || profile.avatar_url || undefined}
                      alt={displayName}
                    />
                  )}
                  <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Link
                  href="/dashboard/compose"
                  className="flex-1 rounded-full border border-border/50 bg-muted/30 px-5 py-3 text-sm text-muted-foreground/70 hover:bg-muted/60 hover:border-border/70 transition-all"
                >
                  Start a post
                </Link>
              </div>
              <div className="flex items-center mt-4 pt-3 border-t border-border/30">
                <Link
                  href="/dashboard/drafts"
                  className="flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <IconFileText className="size-4 text-primary" />
                  </div>
                  Saved Drafts
                </Link>
                <Link
                  href="/dashboard/templates"
                  className="flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <div className="size-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <IconTemplate className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  Templates
                </Link>
                <Link
                  href="/dashboard/carousels"
                  className="flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <div className="size-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <IconCarouselHorizontal className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Create Carousel
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4 Metric Cards */}
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          data-tour="quick-stats"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={staggerItemVariants}>
            <QuickStatCard
              title="Impressions"
              value={metrics?.impressions.value || 0}
              change={metrics?.impressions.change || 0}
              icon={IconEye}
              accent="primary"
              isLoading={analyticsLoading}
              tooltip="Total times your posts appeared in someone's feed"
              periodLabel={periodLabel}
            />
          </motion.div>
          <motion.div variants={staggerItemVariants}>
            <QuickStatCard
              title="Followers"
              value={metrics?.followers.value || 0}
              change={metrics?.followers.change || 0}
              icon={IconUserPlus}
              accent="blue"
              isLoading={analyticsLoading}
              tooltip="Your current LinkedIn follower count"
              periodLabel={periodLabel}
            />
          </motion.div>
          <motion.div variants={staggerItemVariants}>
            <QuickStatCard
              title="Engagement"
              value={metrics?.engagementRate.value || 0}
              change={metrics?.engagementRate.change || 0}
              icon={IconThumbUp}
              suffix="%"
              decimals={1}
              accent="emerald"
              isLoading={analyticsLoading}
              tooltip="Percentage of viewers who liked, commented, or shared your posts"
              periodLabel={periodLabel}
            />
          </motion.div>
          <motion.div variants={staggerItemVariants}>
            <QuickStatCard
              title="Profile Views"
              value={metrics?.profileViews.value || 0}
              change={metrics?.profileViews.change || 0}
              icon={IconUser}
              accent="amber"
              isLoading={analyticsLoading}
              tooltip="Number of people who visited your LinkedIn profile"
              periodLabel={periodLabel}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Calendar (2/3) + Upcoming Posts (1/3) */}
      <motion.div
        className="px-4 lg:px-6"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        data-tour="schedule-section"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <ScheduleCalendar
            posts={scheduledPosts}
            isLoading={scheduleLoading}
            onDateClick={handleDateClick}
            className="border-border/50"
          />
          <UpcomingPostsPanel
            posts={scheduledPosts}
            isLoading={scheduleLoading}
          />
        </div>
      </motion.div>

      {/* My Recent Posts */}
      <motion.div
        className="px-4 lg:px-6"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <MyRecentPostsSection
          posts={recentPosts}
          isLoading={postsLoading}
          authorName={userInfo.name}
          authorAvatar={userInfo.avatarUrl}
        />
      </motion.div>

      {/* Date posts picker dialog */}
      <AnimatePresence>
        {selectedDatePosts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedDatePosts(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-xl border shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <h3 className="text-sm font-semibold">Scheduled Posts</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(selectedDatePosts.date, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedDatePosts(null)}>
                  <IconX className="size-4" />
                </Button>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {selectedDatePosts.posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => {
                      setSelectedDatePosts(null)
                      handleEditScheduledPost(post)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(post.scheduled_for), 'h:mm a')}
                        </p>
                      </div>
                      <IconPencil className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => {
                    const d = selectedDatePosts.date
                    setSelectedDatePosts(null)
                    const scheduleDate = new Date(d)
                    scheduleDate.setHours(9, 0, 0, 0)
                    router.push(`/dashboard/compose?scheduleDate=${encodeURIComponent(scheduleDate.toISOString())}`)
                  }}
                >
                  <IconPencil className="size-3.5" />
                  Schedule New Post
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Page Export
// ============================================================================

/**
 * Dashboard page component
 * @returns Dashboard with Getting Started, metrics, calendar, and scheduled posts
 */
export default function DashboardPage() {
  usePageMeta({
    title: "Dashboard",
    headerActions: (
      <Button asChild size="sm">
        <Link href="/dashboard/compose">
          <IconPencil className="size-4 mr-1" />
          New Post
        </Link>
      </Button>
    ),
  })
  const { isLoading: authLoading } = useAuthContext()

  // Use a ref to track whether DashboardContent has ever been shown.
  // This prevents re-mounting (and re-triggering initial animations at opacity:0)
  // when authLoading briefly flickers during client-side navigation.
  const hasRenderedContent = React.useRef(false)
  if (!authLoading) {
    hasRenderedContent.current = true
  }

  if (!hasRenderedContent.current && authLoading) {
    return <DashboardSkeleton />
  }

  return <DashboardContent />
}
