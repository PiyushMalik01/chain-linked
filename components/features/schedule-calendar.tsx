/**
 * Schedule Calendar Component
 * @description Interactive monthly calendar view for selecting post scheduling dates
 * and times, with visual indicators for already-scheduled slots.
 * @module components/features/schedule-calendar
 */

"use client"

import * as React from "react"
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCalendarEvent,
  IconClock,
  IconX,
} from "@tabler/icons-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  addMonths,
  subMonths,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
} from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Represents a scheduled post item for the calendar view.
 */
export interface ScheduledPostItem {
  /** Unique identifier for the scheduled post */
  id: string
  /** The content/body text of the post */
  content: string
  /** Date object for when the post is scheduled to be published */
  scheduledFor: Date
  /** Current status of the scheduled post */
  status: "pending" | "posted" | "failed"
  /** Platform for the post (e.g., "linkedin") */
  platform: string
}

/**
 * Props for the ScheduleCalendar component.
 */
export interface ScheduleCalendarProps {
  /** Array of scheduled posts to display on the calendar */
  posts?: ScheduledPostItem[]
  /** The currently displayed month (defaults to current month) */
  currentMonth?: Date
  /** Callback fired when the month is changed via navigation */
  onMonthChange?: (date: Date) => void
  /** Callback fired when a post indicator is clicked */
  onPostClick?: (post: ScheduledPostItem) => void
  /** Callback fired when a date cell is clicked */
  onDateClick?: (date: Date) => void
  /** Callback fired when a post needs to be rescheduled */
  /** Whether the component is in a loading state */
  isLoading?: boolean
  /** Additional CSS classes to apply to the container */
  className?: string
}

/** Day names for the calendar header (desktop) */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Abbreviated day names for mobile */
const DAY_NAMES_MOBILE = ["S", "M", "T", "W", "T", "F", "S"]

/**
 * Returns the CSS class for a post status indicator dot.
 * @param status - The post status
 * @returns Tailwind CSS classes for the dot color
 */
function getStatusDotClass(status: ScheduledPostItem["status"]): string {
  switch (status) {
    case "posted":
      return "bg-blue-500"
    case "failed":
      return "bg-red-500"
    case "pending":
    default:
      return "bg-green-500"
  }
}

/**
 * Returns the icon component for a post status.
 * Provides color-independent status indication for accessibility.
 * @param status - The post status
 * @returns Icon element for the status
 */
function StatusIcon({ status }: { status: ScheduledPostItem["status"] }) {
  switch (status) {
    case "posted":
      return <IconCheck className="size-2" />
    case "failed":
      return <IconX className="size-2" />
    case "pending":
    default:
      return <IconClock className="size-2" />
  }
}

/**
 * Gets posts for a specific date.
 * @param posts - All scheduled posts
 * @param date - The date to filter by
 * @returns Array of posts scheduled for that date
 */
function getPostsForDate(
  posts: ScheduledPostItem[],
  date: Date
): ScheduledPostItem[] {
  return posts.filter((post) => isSameDay(post.scheduledFor, date))
}

/**
 * Truncates content to a specified length with ellipsis.
 * @param content - The content to truncate
 * @param maxLength - Maximum character length
 * @returns Truncated content with ellipsis if needed
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content
  }
  return `${content.slice(0, maxLength).trim()}...`
}

/**
 * Loading skeleton for the calendar component.
 */
function CalendarSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((day) => (
            <Skeleton key={day} className="h-8 w-full" />
          ))}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Empty state component displayed when there are no scheduled posts.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <IconCalendarEvent className="size-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-sm mb-1">No scheduled posts</h3>
      <p className="text-xs text-muted-foreground max-w-[280px]">
        Schedule your LinkedIn posts to see them on the calendar.
      </p>
    </div>
  )
}

/**
 * Renders a single day cell in the calendar.
 */
function DayCell({
  date,
  posts,
  isCurrentMonth,
  isFocused = false,
  onDateClick,
  onPostClick,
}: {
  date: Date
  posts: ScheduledPostItem[]
  isCurrentMonth: boolean
  isFocused?: boolean
  onDateClick?: (date: Date) => void
  onPostClick?: (post: ScheduledPostItem) => void
}) {
  const dayPosts = getPostsForDate(posts, date)
  const today = isToday(date)
  const past = isPast(date) && !today

  return (
    <div
      className={cn(
        "min-h-16 sm:min-h-20 p-0.5 sm:p-1 border rounded-md transition-colors cursor-pointer",
        "hover:bg-muted/50",
        !isCurrentMonth && "bg-muted/30",
        past && isCurrentMonth && "text-muted-foreground",
        today && "ring-2 ring-primary ring-offset-1 sm:ring-offset-2",
        isFocused && "ring-2 ring-primary ring-offset-1 bg-accent/50"
      )}
      onClick={() => onDateClick?.(date)}
      role="gridcell"
      tabIndex={-1}
      aria-label={`${format(date, "MMMM d, yyyy")}${dayPosts.length > 0 ? `, ${dayPosts.length} scheduled posts` : ""}`}
      aria-selected={isFocused}
    >
      {/* Date number */}
      <div
        className={cn(
          "text-sm font-medium mb-1",
          today && "text-primary font-bold",
          !isCurrentMonth && "text-muted-foreground/50"
        )}
      >
        {format(date, "d")}
      </div>

      {/* Post indicators */}
      {dayPosts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dayPosts.slice(0, 4).map((post) => (
            <Tooltip key={post.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "size-4 rounded-full transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary flex items-center justify-center text-white",
                    getStatusDotClass(post.status)
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPostClick?.(post)
                  }}
                  aria-label={`${post.status} post: ${truncateContent(post.content, 30)}`}
                >
                  <StatusIcon status={post.status} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] bg-popover text-popover-foreground border shadow-lg p-2.5">
                <p className="text-xs font-semibold capitalize mb-1 text-foreground">
                  {post.status === 'pending' ? 'Scheduled' : post.status}
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {truncateContent(post.content, 60)}
                </p>
                <p className="text-[11px] text-foreground/60 mt-1.5 font-medium">
                  {format(post.scheduledFor, "h:mm a")}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
          {dayPosts.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{dayPosts.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ScheduleCalendar displays a monthly calendar view of scheduled posts,
 * allowing users to visualize their content schedule and interact with posts.
 *
 * Posts are displayed as colored dots on their scheduled dates:
 * - Green: Pending posts waiting to be published
 * - Blue: Successfully posted content
 * - Red: Failed posts that need attention
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ScheduleCalendar
 *   posts={scheduledPosts}
 *   onDateClick={(date) => console.log("Date clicked:", date)}
 *   onPostClick={(post) => console.log("Post clicked:", post)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // With controlled month and navigation
 * const [currentMonth, setCurrentMonth] = useState(new Date())
 *
 * <ScheduleCalendar
 *   posts={posts}
 *   currentMonth={currentMonth}
 *   onMonthChange={setCurrentMonth}
 *   onPostClick={(post) => openEditModal(post)}
 *   onDateClick={(date) => openScheduleModal(date)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // With loading state
 * <ScheduleCalendar isLoading />
 * ```
 */
export function ScheduleCalendar({
  posts = [],
  currentMonth: controlledMonth,
  onMonthChange,
  onPostClick,
  onDateClick,
  isLoading = false,
  className,
}: ScheduleCalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(new Date())
  const [focusedDate, setFocusedDate] = React.useState<Date | null>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const touchStartRef = React.useRef<number | null>(null)

  // Use controlled or internal month state
  const currentMonth = controlledMonth ?? internalMonth

  /**
   * Handles touch start for swipe detection.
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }

  /**
   * Handles touch end to detect swipe direction and navigate months.
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStartRef.current - touchEnd
    const threshold = 50 // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe left - next month
        handleMonthChange("next")
      } else {
        // Swipe right - previous month
        handleMonthChange("prev")
      }
    }

    touchStartRef.current = null
  }

  /**
   * Handles month navigation.
   * @param direction - Direction to navigate ("prev" or "next")
   */
  const handleMonthChange = (direction: "prev" | "next") => {
    const newMonth = direction === "prev"
      ? subMonths(currentMonth, 1)
      : addMonths(currentMonth, 1)

    if (onMonthChange) {
      onMonthChange(newMonth)
    } else {
      setInternalMonth(newMonth)
    }
  }

  /**
   * Navigates to the current month (today).
   */
  const handleTodayClick = () => {
    const today = new Date()
    if (onMonthChange) {
      onMonthChange(today)
    } else {
      setInternalMonth(today)
    }
  }

  /**
   * Handles keyboard navigation within the calendar grid.
   * Supports arrow keys for date navigation and Enter/Space for selection.
   */
  const handleGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentFocus = focusedDate || new Date()

      let newDate: Date | null = null

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault()
          newDate = addDays(currentFocus, 1)
          break
        case "ArrowLeft":
          e.preventDefault()
          newDate = subDays(currentFocus, 1)
          break
        case "ArrowDown":
          e.preventDefault()
          newDate = addWeeks(currentFocus, 1)
          break
        case "ArrowUp":
          e.preventDefault()
          newDate = subWeeks(currentFocus, 1)
          break
        case "Enter":
        case " ":
          e.preventDefault()
          if (focusedDate) {
            onDateClick?.(focusedDate)
          }
          return
        case "Escape":
          e.preventDefault()
          setFocusedDate(null)
          return
        default:
          return
      }

      if (newDate) {
        setFocusedDate(newDate)
        // Auto-navigate to new month if needed
        if (!isSameMonth(newDate, currentMonth)) {
          if (onMonthChange) {
            onMonthChange(newDate)
          } else {
            setInternalMonth(newDate)
          }
        }
      }
    },
    [focusedDate, currentMonth, onMonthChange, onDateClick]
  )

  // Calculate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  if (isLoading) {
    return (
      <div className={className}>
        <CalendarSkeleton />
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconCalendarEvent className="size-5" />
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTodayClick}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handleMonthChange("prev")}
              aria-label="Previous month"
            >
              <IconChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handleMonthChange("next")}
              aria-label="Next month"
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {posts.length === 0 ? (
          <EmptyState />
        ) : (
          <TooltipProvider>
            {/* Legend - includes icons for color-independent status */}
            <div className="flex items-center gap-2 sm:gap-4 mb-4 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="size-4 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <IconClock className="size-2" />
                </span>
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-4 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <IconCheck className="size-2" />
                </span>
                <span>Posted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-4 rounded-full bg-red-500 flex items-center justify-center text-white">
                  <IconX className="size-2" />
                </span>
                <span>Failed</span>
              </div>
            </div>

            {/* Day headers - abbreviated on mobile */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map((day, index) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                  aria-label={day}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{DAY_NAMES_MOBILE[index]}</span>
                </div>
              ))}
            </div>

            {/* Calendar grid with keyboard navigation */}
            <div
              ref={gridRef}
              className="grid grid-cols-7 gap-1"
              role="grid"
              aria-label="Calendar"
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
              onFocus={() => {
                if (!focusedDate) {
                  setFocusedDate(new Date())
                }
              }}
            >
              {calendarDays.map((date) => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  posts={posts}
                  isCurrentMonth={isSameMonth(date, currentMonth)}
                  isFocused={focusedDate ? isSameDay(date, focusedDate) : false}
                  onDateClick={(d) => {
                    onDateClick?.(d)
                    setFocusedDate(d)
                  }}
                  onPostClick={onPostClick}
                />
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}
