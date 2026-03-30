/**
 * Schedule Modal Component
 * @description Dialog for picking a date and time to schedule a LinkedIn post,
 * with AI-suggested optimal posting times and timezone display.
 * @module components/features/schedule-modal
 */

"use client"

import * as React from "react"
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLoader2,
  IconSparkles,
  IconWorld,
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
  addMonths,
  subMonths,
  setHours,
  setMinutes,
  isBefore,
  startOfDay,
} from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Post preview data for the schedule modal.
 */
export interface PostPreview {
  /** The content/body text of the post */
  content: string
  /** Optional number of media attachments */
  mediaCount?: number
  /** Optional user profile for LinkedIn-style preview */
  userProfile?: {
    name: string
    headline: string
    avatarUrl?: string
  }
}

/**
 * Props for the ScheduleModal component.
 */
export interface ScheduleModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback fired when the modal should be closed */
  onClose: () => void
  /** Callback fired when schedule is confirmed */
  onSchedule: (scheduledFor: Date, timezone: string) => void
  /** Optional post preview data */
  postPreview?: PostPreview
  /** Default date for the date picker */
  defaultDate?: Date
  /** Default timezone selection */
  defaultTimezone?: string
  /** Whether the schedule action is in progress */
  isSubmitting?: boolean
}

/** Day names for the calendar header (short form) */
const DAY_NAMES_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

/** Common timezones */
const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)", offset: "UTC-5" },
  { value: "America/Chicago", label: "Central Time (CT)", offset: "UTC-6" },
  { value: "America/Denver", label: "Mountain Time (MT)", offset: "UTC-7" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", offset: "UTC-8" },
  { value: "Europe/London", label: "London (GMT)", offset: "UTC+0" },
  { value: "Europe/Paris", label: "Paris (CET)", offset: "UTC+1" },
  { value: "Europe/Berlin", label: "Berlin (CET)", offset: "UTC+1" },
  { value: "Asia/Kolkata", label: "India (IST)", offset: "UTC+5:30" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", offset: "UTC+9" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", offset: "UTC+8" },
  { value: "Asia/Dubai", label: "Dubai (GST)", offset: "UTC+4" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)", offset: "UTC+11" },
]

/** Hour options for the time picker (12-hour format) */
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Minute options for the time picker (in 15-minute intervals) */
const MINUTE_OPTIONS = [0, 15, 30, 45]

/**
 * Optimal time suggestions for LinkedIn posting.
 * Based on typical engagement patterns.
 */
const OPTIMAL_TIMES = [
  { hour: 8, minute: 0, period: "AM", label: "Morning Commute", description: "High engagement as people check LinkedIn" },
  { hour: 12, minute: 0, period: "PM", label: "Lunch Break", description: "Professionals browse during break" },
  { hour: 5, minute: 30, period: "PM", label: "Evening Wind-down", description: "After-work browsing peak" },
]

/**
 * Cleans raw post content for preview display.
 * Strips mention tokens, normalizes whitespace.
 * @param content - Raw post content
 * @returns Cleaned content string
 */
function cleanContentForPreview(content: string): string {
  return content
    // Strip mention tokens: @[Name](urn:li:...) → Name
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Truncates content to a specified length with ellipsis.
 * @param content - The content to truncate
 * @param maxLength - Maximum character length
 * @returns Truncated content with ellipsis if needed
 */
function truncateContent(content: string, maxLength: number): string {
  const cleaned = cleanContentForPreview(content)
  if (cleaned.length <= maxLength) {
    return cleaned
  }
  return `${cleaned.slice(0, maxLength).trim()}...`
}

/**
 * Converts 12-hour format to 24-hour format.
 * @param hour - Hour in 12-hour format (1-12)
 * @param period - "AM" or "PM"
 * @returns Hour in 24-hour format (0-23)
 */
function to24Hour(hour: number, period: "AM" | "PM"): number {
  if (period === "AM") {
    return hour === 12 ? 0 : hour
  }
  return hour === 12 ? 12 : hour + 12
}

/**
 * Converts 24-hour format to 12-hour format.
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Object with hour (1-12) and period ("AM" or "PM")
 */
function to12Hour(hour: number): { hour: number; period: "AM" | "PM" } {
  if (hour === 0) return { hour: 12, period: "AM" }
  if (hour === 12) return { hour: 12, period: "PM" }
  if (hour > 12) return { hour: hour - 12, period: "PM" }
  return { hour, period: "AM" }
}

/**
 * Mini LinkedIn card post preview.
 */
function CollapsiblePostPreview({ postPreview }: { postPreview: PostPreview }) {
  const profile = postPreview.userProfile

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-700/60 shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Author row */}
        {profile && (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 ring-1 ring-border/50">
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
              <AvatarFallback className="text-[10px] font-semibold bg-[#0A66C2]/10 text-[#0A66C2]">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-tight truncate">{profile.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">{profile.headline}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <IconClock className="size-2.5" />
                Scheduled
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words line-clamp-5">
          {truncateContent(postPreview.content, 250)}
        </div>

        {/* Attachments */}
        {postPreview.mediaCount != null && postPreview.mediaCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
            <IconCalendar className="size-3" />
            <span>{postPreview.mediaCount} attachment{postPreview.mediaCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Mini calendar component for date selection.
 */
function MiniCalendar({
  selectedDate,
  onDateSelect,
  displayMonth,
  onMonthChange,
}: {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  displayMonth: Date
  onMonthChange: (date: Date) => void
}) {
  const monthStart = startOfMonth(displayMonth)
  const monthEnd = endOfMonth(displayMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const today = startOfDay(new Date())

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonthChange(subMonths(displayMonth, 1))}
          aria-label="Previous month"
        >
          <IconChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(displayMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonthChange(addMonths(displayMonth, 1))}
          aria-label="Next month"
        >
          <IconChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES_SHORT.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const isSelected = isSameDay(date, selectedDate)
          const isCurrentMonth = isSameMonth(date, displayMonth)
          const isPastDate = isBefore(date, today)
          const isTodayDate = isToday(date)

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={isPastDate}
              onClick={() => onDateSelect(date)}
              className={cn(
                "size-8 rounded-md text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                !isCurrentMonth && "text-muted-foreground/50",
                isPastDate && "opacity-50 cursor-not-allowed hover:bg-transparent",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                isTodayDate && !isSelected && "ring-1 ring-primary"
              )}
              aria-label={format(date, "MMMM d, yyyy")}
              aria-pressed={isSelected}
            >
              {format(date, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * ScheduleModal provides a dialog for scheduling posts with date, time, and timezone selection.
 *
 * Features:
 * - Post content preview (truncated)
 * - Built-in mini calendar for date selection (no external library)
 * - Hour and minute selects for time picking
 * - Timezone dropdown with top 10 common timezones
 * - "Optimal Times" suggestions based on LinkedIn engagement patterns
 * - Schedule and Cancel buttons with loading states
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <ScheduleModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSchedule={(date, timezone) => {
 *     console.log("Scheduled for:", date, timezone)
 *     setIsOpen(false)
 *   }}
 *   postPreview={{
 *     content: "Check out our latest product launch!",
 *     mediaCount: 2
 *   }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // With default date and timezone
 * <ScheduleModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSchedule={handleSchedule}
 *   defaultDate={addDays(new Date(), 1)}
 *   defaultTimezone="America/New_York"
 *   isSubmitting={isLoading}
 * />
 * ```
 */
export function ScheduleModal({
  isOpen,
  onClose,
  onSchedule,
  postPreview,
  defaultDate,
  defaultTimezone = "America/New_York",
  isSubmitting = false,
}: ScheduleModalProps) {
  // Initialize with default or current date/time
  const getInitialDate = React.useCallback(() => {
    if (defaultDate) return defaultDate
    const now = new Date()
    // Default to tomorrow if no date provided
    now.setDate(now.getDate() + 1)
    now.setHours(9, 0, 0, 0)
    return now
  }, [defaultDate])

  const [selectedDate, setSelectedDate] = React.useState<Date>(() => getInitialDate())
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => getInitialDate())
  const [timezone, setTimezone] = React.useState(defaultTimezone)

  // Time state (12-hour format)
  const initialTime = to12Hour(getInitialDate().getHours())
  const [hour, setHour] = React.useState(initialTime.hour)
  const [minute, setMinute] = React.useState(
    Math.floor(getInitialDate().getMinutes() / 15) * 15
  )
  const [period, setPeriod] = React.useState<"AM" | "PM">(initialTime.period)

  // Reset state when modal opens with new defaults
  React.useEffect(() => {
    if (isOpen) {
      const initialDate = getInitialDate()
      setSelectedDate(initialDate)
      setDisplayMonth(initialDate)
      setTimezone(defaultTimezone)
      const time = to12Hour(initialDate.getHours())
      setHour(time.hour)
      setMinute(Math.floor(initialDate.getMinutes() / 15) * 15)
      setPeriod(time.period)
    }
  }, [isOpen, defaultTimezone, getInitialDate])

  /**
   * Applies an optimal time suggestion.
   */
  const applyOptimalTime = (optimalTime: typeof OPTIMAL_TIMES[0]) => {
    setHour(optimalTime.hour)
    setMinute(optimalTime.minute)
    setPeriod(optimalTime.period as "AM" | "PM")
  }

  /**
   * Handles the schedule action.
   */
  const handleSchedule = () => {
    const hour24 = to24Hour(hour, period)
    let scheduledDate = setHours(selectedDate, hour24)
    scheduledDate = setMinutes(scheduledDate, minute)

    // Apply timezone correction so the past-time check compares against the
    // selected timezone rather than the browser's local time.
    const browserOffset = scheduledDate.getTimezoneOffset()
    const targetDate = new Date(
      scheduledDate.toLocaleString('en-US', { timeZone: timezone })
    )
    const targetOffset = targetDate.getTimezoneOffset()
    const offsetDiff = (browserOffset - targetOffset) * 60 * 1000
    const correctedDate = new Date(scheduledDate.getTime() + offsetDiff)

    if (correctedDate <= new Date()) {
      toast.error('Please select a time in the future')
      return
    }

    onSchedule(scheduledDate, timezone)
  }

  /**
   * Formats the selected date and time for display.
   */
  const getFormattedDateTime = (): string => {
    const hour24 = to24Hour(hour, period)
    let dateTime = setHours(selectedDate, hour24)
    dateTime = setMinutes(dateTime, minute)
    return format(dateTime, "MMM d, yyyy 'at' h:mm a")
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconCalendar className="size-5" />
            Schedule Post
          </DialogTitle>
          <DialogDescription>
            Choose when you want your post to be published.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 pr-2">
          {/* Post Preview — collapsible mini LinkedIn card */}
          {postPreview && <CollapsiblePostPreview postPreview={postPreview} />}

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Date</label>
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              displayMonth={displayMonth}
              onMonthChange={setDisplayMonth}
            />
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <IconClock className="size-4" />
              Select Time
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={hour.toString()}
                onValueChange={(val) => setHour(parseInt(val))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-muted-foreground">:</span>

              <Select
                value={minute.toString()}
                onValueChange={(val) => setMinute(parseInt(val))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={period} onValueChange={(val) => setPeriod(val as "AM" | "PM")}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <IconWorld className="size-4" />
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    <span className="flex items-center gap-2">
                      <span>{tz.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {tz.offset}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optimal Times Suggestions */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <IconSparkles className="size-4 text-amber-500" />
              Optimal Times
            </label>
            <div className="grid grid-cols-1 gap-2">
              {OPTIMAL_TIMES.map((optimal, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyOptimalTime(optimal)}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  )}
                >
                  <div className="rounded-full bg-amber-500/10 p-2">
                    <IconClock className="size-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {optimal.hour}:{optimal.minute.toString().padStart(2, "0")} {optimal.period}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {optimal.label} - {optimal.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Scheduling for: </span>
              <span className="font-medium">{getFormattedDateTime()}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {COMMON_TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <IconCalendar className="size-4" />
                Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
