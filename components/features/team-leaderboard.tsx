"use client"

import * as React from "react"
import {
  IconTrophy,
  IconChartBar,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, formatMetricNumber, getInitials } from "@/lib/utils"

/**
 * Statistics for a team member on the leaderboard
 */
export interface TeamMemberStats {
  /** Unique identifier for the team member */
  id: string
  /** Display name of the team member */
  name: string
  /** Avatar image URL, or undefined for fallback */
  avatarUrl?: string
  /** Job title or role */
  role: string
  /** Number of posts published this week */
  postsThisWeek: number
  /** Number of posts published this month */
  postsThisMonth: number
  /** Total posts published all time */
  postsAllTime: number
  /** Total engagement count (likes, comments, shares) */
  totalEngagement: number
  /** Engagement rate as a percentage */
  engagementRate: number
  /** Current rank position */
  rank: number
  /** Change in rank from previous period (positive = moved up, negative = moved down, 0 = no change) */
  rankChange: number
  /** Total reactions (likes, celebrates, etc.) */
  totalReactions: number
  /** Total comments received */
  totalComments: number
  /** Total impressions / views */
  totalImpressions: number
}

/**
 * Time range options for the leaderboard
 */
export type LeaderboardTimeRange = "week" | "month" | "all-time"

/**
 * Props for the TeamLeaderboard component
 */
export interface TeamLeaderboardProps {
  /** Array of team member statistics to display */
  members?: TeamMemberStats[]
  /** Currently selected time range */
  timeRange?: LeaderboardTimeRange
  /** Callback fired when time range selection changes */
  onTimeRangeChange?: (range: LeaderboardTimeRange) => void
  /** Callback fired when a member row is clicked */
  onMemberClick?: (memberId: string) => void
  /** Whether the component is in a loading state */
  isLoading?: boolean
  /** ID of the current user to highlight their row */
  currentUserId?: string
  /** Additional CSS classes to apply to the container */
  className?: string
}


/**
 * Returns the styling for rank position badges.
 * @param rank - The rank position (1, 2, 3, or other)
 * @returns Object with background and text color classes
 */
function getRankStyle(rank: number): { bg: string; text: string } {
  switch (rank) {
    case 1:
      return { bg: "bg-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400" }
    case 2:
      return { bg: "bg-slate-300/30", text: "text-slate-600 dark:text-slate-300" }
    case 3:
      return { bg: "bg-amber-600/20", text: "text-amber-700 dark:text-amber-500" }
    default:
      return { bg: "bg-muted", text: "text-muted-foreground" }
  }
}

/**
 * Returns medal emoji for top 3 ranks.
 * @param rank - The rank position
 * @returns Medal emoji string or empty string
 */
function getMedalEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return "\u{1F947}"
    case 2:
      return "\u{1F948}"
    case 3:
      return "\u{1F949}"
    default:
      return ""
  }
}

/**
 * Loading skeleton for a single leaderboard row.
 */
function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-6" />
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the entire leaderboard.
 */
function LeaderboardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-56" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <LeaderboardRowSkeleton key={index} />
        ))}
      </CardContent>
    </Card>
  )
}

/** CSS grid template for leaderboard columns */
const GRID_COLS = "grid-cols-[2rem_2.5rem_minmax(6rem,1fr)_4.5rem_4.5rem_4.5rem_5rem]"
const GRID_COLS_MOBILE = "grid-cols-[2rem_2.5rem_1fr_4rem]"

/**
 * Renders a single leaderboard row for a team member.
 * Uses CSS Grid for pixel-perfect column alignment with headers.
 * Shows Posts, Reactions, Comments, Impressions.
 */
function LeaderboardRow({
  member,
  timeRange,
  isCurrentUser,
  onClick,
}: {
  member: TeamMemberStats
  timeRange: LeaderboardTimeRange
  isCurrentUser: boolean
  onClick?: () => void
}) {
  const rankStyle = getRankStyle(member.rank)
  const medal = getMedalEmoji(member.rank)
  const postsCount = timeRange === "week"
    ? member.postsThisWeek
    : timeRange === "month"
      ? member.postsThisMonth
      : member.postsAllTime

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left transition-colors border-b last:border-b-0",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isCurrentUser && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      {/* Desktop layout */}
      <div className={cn("hidden sm:grid items-center gap-3 px-3 py-3", GRID_COLS)}>
        {/* Rank Badge */}
        <div
          className={cn(
            "flex items-center justify-center size-8 rounded-full font-bold text-sm",
            rankStyle.bg,
            rankStyle.text
          )}
          title={`Rank ${member.rank}`}
        >
          {medal || member.rank}
        </div>

        {/* Avatar */}
        <Avatar className="size-10">
          {member.avatarUrl && (
            <AvatarImage src={member.avatarUrl} alt={member.name} />
          )}
          <AvatarFallback className="text-sm font-medium">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>

        {/* Name and Role */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{member.name}</span>
            {isCurrentUser && (
              <Badge variant="secondary" className="text-[10px]">You</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
        </div>

        {/* Posts */}
        <span className="text-sm font-medium tabular-nums text-center">{formatMetricNumber(postsCount)}</span>
        {/* Reactions */}
        <span className="text-sm font-medium tabular-nums text-center">{formatMetricNumber(member.totalReactions)}</span>
        {/* Comments */}
        <span className="text-sm font-medium tabular-nums text-center">{formatMetricNumber(member.totalComments)}</span>
        {/* Impressions */}
        <span className="text-sm font-medium tabular-nums text-center">{formatMetricNumber(member.totalImpressions)}</span>
      </div>

      {/* Mobile layout */}
      <div className={cn("sm:hidden grid items-center gap-3 px-3 py-3", GRID_COLS_MOBILE)}>
        <div
          className={cn(
            "flex items-center justify-center size-8 rounded-full font-bold text-sm",
            rankStyle.bg,
            rankStyle.text
          )}
        >
          {medal || member.rank}
        </div>
        <Avatar className="size-10">
          {member.avatarUrl && (
            <AvatarImage src={member.avatarUrl} alt={member.name} />
          )}
          <AvatarFallback className="text-sm font-medium">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <span className="font-medium text-sm truncate block">{member.name}</span>
          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
        </div>
        <div className="text-right">
          <span className="font-medium tabular-nums text-sm">{formatMetricNumber(member.totalImpressions)}</span>
          <span className="text-[10px] text-muted-foreground block">views</span>
        </div>
      </div>
    </button>
  )
}

/**
 * Empty state component displayed when there are no members.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <IconChartBar className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-sm mb-1">No team members yet</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-4">
        Add team members to start tracking their LinkedIn performance.
      </p>
      <a
        href="/dashboard/team"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Set Up Team
      </a>
    </div>
  )
}

/**
 * TeamLeaderboard displays a ranked list of team members (Top Influencers)
 * with their LinkedIn posting and engagement metrics.
 *
 * Features:
 * - Time range tabs (This Week / This Month)
 * - Ranked list with medal emojis for top 3 (gold, silver, bronze)
 * - Avatar, name, and role for each member
 * - Metrics columns: Posts, Reactions, Comments, Impressions
 * - Ranking based on total impressions
 * - Highlight current user row
 * - Loading skeleton state
 *
 * @example
 * ```tsx
 * <TeamLeaderboard
 *   members={teamMembers}
 *   timeRange="week"
 *   onTimeRangeChange={(range) => console.log("Range:", range)}
 *   onMemberClick={(id) => console.log("Member:", id)}
 *   currentUserId="member-3"
 * />
 * ```
 */
export function TeamLeaderboard({
  members,
  timeRange = "week",
  onTimeRangeChange,
  onMemberClick,
  isLoading = false,
  currentUserId,
  className,
}: TeamLeaderboardProps) {
  // Sort members by rank (based on impressions) - must be called before any early returns
  const sortedMembers = React.useMemo(() => {
    if (!members) return []
    return [...members].sort((a, b) => a.rank - b.rank)
  }, [members])

  const handleTimeRangeChange = React.useCallback(
    (value: string) => {
      if (value && onTimeRangeChange) {
        onTimeRangeChange(value as LeaderboardTimeRange)
      }
    },
    [onTimeRangeChange]
  )

  if (isLoading) {
    return (
      <div className={className}>
        <LeaderboardSkeleton />
      </div>
    )
  }

  return (
    <div className={className}>
      <Card className="border-border/50">
        <Tabs value={timeRange} onValueChange={handleTimeRangeChange}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <IconTrophy className="size-5 text-yellow-500" />
                Top Influencers
              </CardTitle>
              <TabsList>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="all-time">All Time</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Column Headers - Desktop (same grid as rows) */}
            <div className={cn(
              "hidden sm:grid items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30",
              GRID_COLS
            )}>
              <div /> {/* Rank column */}
              <div /> {/* Avatar column */}
              <div>Member</div>
              <div className="text-center">Posts</div>
              <div className="text-center">Reactions</div>
              <div className="text-center">Comments</div>
              <div className="text-center">Impress.</div>
            </div>
            {/* Column Headers - Mobile */}
            <div className={cn(
              "sm:hidden grid items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30",
              GRID_COLS_MOBILE
            )}>
              <div /> {/* Rank */}
              <div /> {/* Avatar */}
              <div>Member</div>
              <div className="text-right">Views</div>
            </div>

            {(["week", "month", "all-time"] as const).map(tab => (
              <TabsContent key={tab} value={tab} className="mt-0">
                {sortedMembers.length === 0 ? (
                  <EmptyState />
                ) : (
                  sortedMembers.map((member) => (
                    <LeaderboardRow
                      key={member.id}
                      member={member}
                      timeRange={tab}
                      isCurrentUser={member.id === currentUserId}
                      onClick={onMemberClick ? () => onMemberClick(member.id) : undefined}
                    />
                  ))
                )}
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
