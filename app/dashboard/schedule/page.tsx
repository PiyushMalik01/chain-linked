"use client"

/**
 * Schedule Page
 * @description View and manage scheduled LinkedIn posts with calendar and list views
 * @module app/dashboard/schedule/page
 */

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  IconPencil,
  IconCalendarEvent,
  IconClock,
  IconSend,
  IconCalendarStats,
  IconBulb,
  IconEdit,
  IconX,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageContent } from "@/components/shared/page-content"
import { usePostingConfig } from "@/hooks/use-posting-config"
import { ScheduleCalendar } from "@/components/features/schedule-calendar"
import { ScheduledPosts, type ScheduledPost } from "@/components/features/scheduled-posts"
import { ScheduleSkeleton } from "@/components/skeletons/page-skeletons"
import { useScheduledPosts } from "@/hooks/use-scheduled-posts"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import { staggerContainerVariants, staggerItemVariants } from "@/lib/animations"

/**
 * Schedule page content component with real data
 */
function ScheduleContent() {
  const router = useRouter()
  const { isPostingEnabled, disabledMessage } = usePostingConfig()
  const { posts: scheduledPosts, rawPosts, isLoading, deletePost, updatePost } = useScheduledPosts(60)

  // Transform scheduled posts for the list view - use real data only
  // Filter out already-posted and cancelled posts so only actionable items appear
  const listPosts: ScheduledPost[] = useMemo(() => rawPosts
    .filter((post) => {
      const s = post.status.toLowerCase()
      return s !== 'posted' && s !== 'completed' && s !== 'cancelled'
    })
    .map((post) => ({
      id: post.id,
      content: post.content,
      scheduledFor: post.scheduled_for,
      status: mapListStatus(post.status),
      mediaUrls: post.media_urls as string[] | undefined,
    })), [rawPosts])

  // Compute stats
  const stats = useMemo(() => {
    const pending = rawPosts.filter(p => p.status === 'pending' || p.status === 'scheduled').length
    const posted = rawPosts.filter(p => p.status === 'posted').length
    const failed = rawPosts.filter(p => p.status === 'failed').length
    return { pending, posted, failed, total: rawPosts.length }
  }, [rawPosts])

  // State for date posts dialog
  const [selectedDate, setSelectedDate] = useState<{ date: Date; posts: typeof listPosts } | null>(null)

  // Navigate to compose page for scheduling new posts
  const handleScheduleNew = useCallback(() => {
    router.push("/dashboard/compose")
  }, [router])

  // Handle edit - navigate to compose page with post ID
  const handleEdit = useCallback((postId: string) => {
    const post = rawPosts.find(p => p.id === postId)
    if (post) {
      sessionStorage.setItem('editScheduledPost', JSON.stringify({
        id: post.id,
        content: post.content,
        scheduledFor: post.scheduled_for,
      }))
      router.push("/dashboard/compose?edit=" + postId)
    }
  }, [rawPosts, router])

  /** Handle calendar date click — show posts for that date */
  const handleDateClick = useCallback((date: Date) => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const postsOnDate = listPosts.filter(p => {
      const postDate = new Date(p.scheduledFor)
      return postDate >= dayStart && postDate <= dayEnd
    })

    if (postsOnDate.length === 0) {
      router.push(`/dashboard/compose?scheduleDate=${date.toISOString()}`)
    } else if (postsOnDate.length === 1) {
      handleEdit(postsOnDate[0].id)
    } else {
      setSelectedDate({ date, posts: postsOnDate })
    }
  }, [listPosts, router, handleEdit])

  /** Handle calendar post indicator click — edit that post directly */
  const handlePostClick = useCallback((post: { id: string }) => {
    handleEdit(post.id)
  }, [handleEdit])

  // Handle delete
  const handleDelete = useCallback(async (postId: string) => {
    const success = await deletePost(postId)
    if (success) {
      toast.success("Post deleted", {
        description: "The scheduled post has been removed.",
      })
    } else {
      toast.error("Failed to delete post", {
        description: "Please try again.",
      })
    }
  }, [deletePost])

  // Handle post now - update status to trigger immediate posting
  const handlePostNow = useCallback(async (postId: string) => {
    if (!isPostingEnabled) {
      toast.warning("Posting disabled", {
        description: disabledMessage,
      })
      return
    }

    const success = await updatePost(postId, {
      scheduled_for: new Date().toISOString(),
      status: 'pending',
    })
    if (success) {
      toast.success("Post queued", {
        description: "Your post will be published shortly.",
      })
    } else {
      toast.error("Failed to queue post", {
        description: "Please try again.",
      })
    }
  }, [updatePost, isPostingEnabled, disabledMessage])

  return (
    <PageContent>
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Plan and schedule your LinkedIn posts for maximum reach.
          </p>
        </div>
        <Button onClick={handleScheduleNew} className="gap-1.5 shrink-0">
          <IconPencil className="size-4" />
          Schedule Post
        </Button>
      </div>

      {/* Quick Stats Row */}
      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        variants={staggerContainerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItemVariants}>
          <ScheduleStatCard
            label="Scheduled"
            value={stats.pending}
            icon={IconClock}
            iconColor="text-primary"
            iconBg="from-primary/15 to-primary/5"
            isLoading={isLoading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <ScheduleStatCard
            label="Published"
            value={stats.posted}
            icon={IconSend}
            iconColor="text-emerald-500"
            iconBg="from-emerald-500/15 to-emerald-500/5"
            isLoading={isLoading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <ScheduleStatCard
            label="This Month"
            value={stats.total}
            icon={IconCalendarStats}
            iconColor="text-blue-500"
            iconBg="from-blue-500/15 to-blue-500/5"
            isLoading={isLoading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <QuickTipCard />
        </motion.div>
      </motion.div>

      {/* Calendar (full width) */}
      <ScheduleCalendar
        posts={scheduledPosts}
        isLoading={isLoading}
        onDateClick={handleDateClick}
        onPostClick={handlePostClick}
      />

      {/* Date Posts Picker Dialog */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedDate(null)}
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
                    {format(selectedDate.date, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedDate(null)}>
                  <IconX className="size-4" />
                </Button>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {selectedDate.posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => {
                      setSelectedDate(null)
                      handleEdit(post.id)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(post.scheduledFor), 'h:mm a')}
                        </p>
                      </div>
                      <IconEdit className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
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
                    setSelectedDate(null)
                    router.push(`/dashboard/compose?scheduleDate=${selectedDate.date.toISOString()}`)
                  }}
                >
                  <IconPencil className="size-3.5" />
                  Schedule New Post for This Date
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduled Posts List (full width below calendar) */}
      <ScheduledPosts
        posts={listPosts}
        isLoading={isLoading}
        onScheduleNew={handleScheduleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPostNow={handlePostNow}
        isPostingEnabled={isPostingEnabled}
      />
    </PageContent>
  )
}

/**
 * Stat card for schedule overview
 */
function ScheduleStatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  isLoading,
}: {
  label: string
  value: number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-xl bg-gradient-to-br ${iconBg} p-2.5 shrink-0`}>
          <Icon className={`size-4 ${iconColor}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Quick tip card for scheduling best practices
 */
function QuickTipCard() {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/30 transition-colors">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 p-2.5 shrink-0">
          <IconBulb className="size-4 text-amber-500" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Best Times</p>
          <p className="text-xs font-medium leading-tight mt-0.5">Tue-Thu, 8-10 AM</p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Map database status to list component status
 * @param status - Raw status string from the database
 * @returns Normalized status for the ScheduledPost component
 */
function mapListStatus(status: string): ScheduledPost["status"] {
  switch (status.toLowerCase()) {
    case "posting":
    case "processing":
      return "posting"
    case "failed":
    case "error":
      return "failed"
    case "pending":
    case "scheduled":
    default:
      return "pending"
  }
}

/**
 * Schedule page component
 * @returns Schedule page with calendar view and list of upcoming scheduled posts
 */
export default function SchedulePage() {
  usePageMeta({
    title: "Schedule",
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

  return authLoading ? <ScheduleSkeleton /> : <ScheduleContent />
}
