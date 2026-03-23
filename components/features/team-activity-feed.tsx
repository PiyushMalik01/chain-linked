/**
 * Team Activity Feed Component
 * @description Displays a filterable, sortable feed of team members' recent LinkedIn
 * posts with engagement metrics, author info, and remix actions.
 * @module components/features/team-activity-feed
 */

"use client"

import * as React from "react"
import Image from "next/image"
import {
  IconEye,
  IconThumbUp,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconFilter,
  IconSortDescending,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, getInitials, formatMetricNumber } from "@/lib/utils"

/**
 * Represents a team member's post activity item with engagement metrics.
 */
export interface TeamActivityItem {
  /** Unique identifier for the post */
  id: string
  /** Author information */
  author: {
    /** Display name of the author */
    name: string
    /** Professional headline or title */
    headline: string
    /** Avatar image URL, or null for fallback */
    avatar: string | null
  }
  /** Post content text */
  content: string
  /** Engagement metrics for the post */
  metrics: {
    /** Number of times the post was viewed */
    impressions: number
    /** Number of reactions (likes) received */
    reactions: number
    /** Number of comments on the post */
    comments: number
    /** Number of times the post was reposted/shared */
    reposts: number
  }
  /** ISO 8601 timestamp of when the post was published */
  postedAt: string
  /** Optional post type for badge display */
  postType?: "text" | "article" | "image" | "video" | "poll"
  /** Media URLs attached to the post */
  mediaUrls?: string[] | null
}

/**
 * Props for the TeamActivityFeed component.
 */
export interface TeamActivityFeedProps {
  /** Array of team activity posts to display */
  posts?: TeamActivityItem[]
  /** Callback fired when user clicks "Remix" on a post */
  onRemix?: (postId: string) => void
  /** Whether the feed is in a loading state */
  isLoading?: boolean
  /** Additional CSS classes to apply to the container */
  className?: string
  /** Compact mode - hides filters and shows fewer posts */
  compact?: boolean
  /** Number of columns for grid layout (default 1 = vertical stack) */
  columns?: 1 | 2
}

/** Maximum character count before content is truncated in full mode */
const CONTENT_TRUNCATE_LENGTH = 200
/** Maximum character count before content is truncated in compact mode */
const COMPACT_CONTENT_TRUNCATE_LENGTH = 150

/**
 * Returns the badge variant and label for a post type.
 * @param postType - The type of post
 * @returns Object with variant and label for the badge
 */
function getPostTypeBadge(postType?: TeamActivityItem["postType"]): {
  variant: "default" | "secondary" | "outline"
  label: string
} | null {
  switch (postType) {
    case "article":
      return { variant: "default", label: "Article" }
    case "image":
      return { variant: "secondary", label: "Image" }
    case "video":
      return { variant: "secondary", label: "Video" }
    case "poll":
      return { variant: "outline", label: "Poll" }
    default:
      return null
  }
}

/**
 * Renders a media grid in LinkedIn style — edge-to-edge, no border/rounding.
 * @param mediaUrls - Array of media URLs to display
 */
function MediaGrid({ mediaUrls }: { mediaUrls: string[] }) {
  const count = mediaUrls.length

  if (count === 1) {
    return (
      <div className="relative w-full" style={{ maxHeight: 512 }}>
        <Image
          src={mediaUrls[0]}
          alt="Post media"
          width={600}
          height={512}
          className="w-full max-h-[512px] object-cover"
          unoptimized
        />
      </div>
    )
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-[2px]">
        {mediaUrls.slice(0, 2).map((url, i) => (
          <div key={i} className="relative h-52">
            <Image
              src={url}
              alt={`Post media ${i + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-[2px]">
        <div className="relative row-span-2" style={{ gridRow: "1 / 3" }}>
          <Image
            src={mediaUrls[0]}
            alt="Post media 1"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="relative h-[130px]">
          <Image
            src={mediaUrls[1]}
            alt="Post media 2"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="relative h-[130px]">
          <Image
            src={mediaUrls[2]}
            alt="Post media 3"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </div>
    )
  }

  // 4+ images: 2x2 grid with overlay on 4th
  return (
    <div className="grid grid-cols-2 gap-[2px]">
      {mediaUrls.slice(0, 3).map((url, i) => (
        <div key={i} className="relative h-40">
          <Image
            src={url}
            alt={`Post media ${i + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
      <div className="relative h-40">
        <Image
          src={mediaUrls[3]}
          alt="Post media 4"
          fill
          className="object-cover"
          unoptimized
        />
        {count > 4 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white text-xl font-semibold">+{count - 4}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for a single post card.
 */
function PostCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-0">
        <Skeleton className="size-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="px-4 pt-3 pb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mx-4 border-t border-border/40" />
      <div className="flex items-center gap-1 px-2 py-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Renders a single post card in pixel-perfect LinkedIn-native style.
 * Edge-to-edge media, proper engagement layout, equal-width action buttons.
 */
function PostCard({
  post,
  onRemix,
}: {
  post: TeamActivityItem
  onRemix?: (postId: string) => void
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const shouldTruncate = post.content.length > CONTENT_TRUNCATE_LENGTH
  const displayContent =
    shouldTruncate && !isExpanded
      ? post.content.slice(0, CONTENT_TRUNCATE_LENGTH)
      : post.content

  const postTypeBadge = getPostTypeBadge(post.postType)
  const relativeTime = formatDistanceToNow(new Date(post.postedAt), {
    addSuffix: false,
  })

  const hasEngagement =
    post.metrics.reactions > 0 ||
    post.metrics.comments > 0 ||
    post.metrics.reposts > 0

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Author header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <Avatar className="size-12 shrink-0">
          {post.author.avatar && (
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
          )}
          <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
            {getInitials(post.author.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] leading-tight truncate">
              {post.author.name}
            </span>
            {postTypeBadge && (
              <Badge variant={postTypeBadge.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                {postTypeBadge.label}
              </Badge>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate leading-snug mt-0.5">
            {post.author.headline}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {relativeTime}
          </p>
        </div>
      </div>

      {/* Post content */}
      <div className="px-4 pt-3 pb-3">
        <div className="text-[14px] leading-[1.45] whitespace-pre-wrap">
          {displayContent}
          {shouldTruncate && !isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-muted-foreground hover:text-primary hover:underline font-semibold ml-0.5"
            >
              ...see more
            </button>
          )}
        </div>
        {shouldTruncate && isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-[14px] text-muted-foreground hover:text-primary hover:underline font-semibold mt-1 block"
          >
            ...show less
          </button>
        )}
      </div>

      {/* Media — edge-to-edge, no padding */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <MediaGrid mediaUrls={post.mediaUrls} />
      )}

      {/* Engagement summary — reactions left, comments/reposts right */}
      {hasEngagement && (
        <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {post.metrics.reactions > 0 && (
              <>
                <span className="flex items-center -space-x-1">
                  <span className="inline-flex items-center justify-center size-[18px] rounded-full bg-[#378FE9] text-[10px] ring-[1.5px] ring-card relative z-[2]">👍</span>
                  {post.metrics.reactions > 3 && (
                    <span className="inline-flex items-center justify-center size-[18px] rounded-full bg-[#DF704D] text-[10px] ring-[1.5px] ring-card relative z-[1]">❤️</span>
                  )}
                </span>
                <span>{formatMetricNumber(post.metrics.reactions)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {post.metrics.comments > 0 && (
              <span className="hover:text-primary hover:underline cursor-pointer">
                {formatMetricNumber(post.metrics.comments)} comment{post.metrics.comments !== 1 ? 's' : ''}
              </span>
            )}
            {post.metrics.comments > 0 && post.metrics.reposts > 0 && (
              <span className="text-muted-foreground/40 mx-0.5">&middot;</span>
            )}
            {post.metrics.reposts > 0 && (
              <span className="hover:text-primary hover:underline cursor-pointer">
                {formatMetricNumber(post.metrics.reposts)} repost{post.metrics.reposts !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-border/40" />

      {/* Action bar — 4 equal buttons, no dividers */}
      <div className="flex items-center px-2 py-1">
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
          <IconThumbUp className="size-[18px]" />
          <span>Like</span>
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
          <IconMessageCircle className="size-[18px]" />
          <span>Comment</span>
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
          <IconShare className="size-[18px]" />
          <span>Repost</span>
        </button>
        <button
          type="button"
          onClick={() => onRemix?.(post.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <IconSparkles className="size-[18px]" />
          <span>Remix</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Compact post card for dashboard feed - mini LinkedIn-style.
 */
function CompactPostCard({ post }: { post: TeamActivityItem }) {
  const shouldTruncate = post.content.length > COMPACT_CONTENT_TRUNCATE_LENGTH
  const displayContent = shouldTruncate
    ? `${post.content.slice(0, COMPACT_CONTENT_TRUNCATE_LENGTH)}...`
    : post.content

  const relativeTime = formatDistanceToNow(new Date(post.postedAt), {
    addSuffix: false,
  })

  return (
    <div className="p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
      {/* Author header */}
      <div className="flex items-start gap-3 mb-2">
        <Avatar className="size-9 flex-shrink-0">
          {post.author.avatar && (
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
          )}
          <AvatarFallback className="text-xs">
            {getInitials(post.author.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{post.author.name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{relativeTime}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{post.author.headline}</p>
        </div>
      </div>

      {/* Content */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-2">
        {displayContent}
      </p>

      {/* First image thumbnail if available */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-2 rounded-lg overflow-hidden border border-border/50">
          <div className="relative w-full h-32">
            <Image
              src={post.mediaUrls[0]}
              alt="Post media"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          {post.mediaUrls.length > 1 && (
            <div className="text-[10px] text-muted-foreground text-center py-0.5 bg-muted/50">
              +{post.mediaUrls.length - 1} more
            </div>
          )}
        </div>
      )}

      {/* Metric summary */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {post.metrics.impressions > 0 && (
          <span className="flex items-center gap-1">
            <IconEye className="size-3" />
            {formatMetricNumber(post.metrics.impressions)}
          </span>
        )}
        {post.metrics.reactions > 0 && (
          <span className="flex items-center gap-1">
            <IconThumbUp className="size-3" />
            {formatMetricNumber(post.metrics.reactions)}
          </span>
        )}
        {post.metrics.comments > 0 && (
          <span className="flex items-center gap-1">
            <IconMessageCircle className="size-3" />
            {formatMetricNumber(post.metrics.comments)}
          </span>
        )}
        {post.metrics.reposts > 0 && (
          <span className="flex items-center gap-1">
            <IconShare className="size-3" />
            {formatMetricNumber(post.metrics.reposts)}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Empty state component displayed when there are no posts.
 */
function EmptyState() {
  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-3 mb-4">
          <IconMessageCircle className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-sm mb-1">No team activity yet</h3>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          When your team members post content, their activity will appear here.
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * TeamActivityFeed displays a real-time feed of posts from team members
 * with their engagement metrics, filtering, sorting, and the ability to remix post ideas.
 *
 * @example
 * ```tsx
 * <TeamActivityFeed
 *   posts={teamPosts}
 *   onRemix={(postId) => console.log("Remix post:", postId)}
 * />
 * ```
 */
export function TeamActivityFeed({
  posts,
  onRemix,
  isLoading = false,
  className,
  compact = false,
  columns = 1,
}: TeamActivityFeedProps) {
  const [filterType, setFilterType] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<string>("recent")

  // Filter and sort posts
  const filteredAndSortedPosts = React.useMemo(() => {
    if (!posts) return []

    let filtered = posts
    if (filterType !== "all") {
      filtered = posts.filter(post => post.postType === filterType)
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "engagement": {
          const engagementA = a.metrics.reactions + a.metrics.comments + a.metrics.reposts
          const engagementB = b.metrics.reactions + b.metrics.comments + b.metrics.reposts
          return engagementB - engagementA
        }
        case "impressions":
          return b.metrics.impressions - a.metrics.impressions
        case "recent":
        default:
          return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      }
    })

    return sorted
  }, [posts, filterType, sortBy])

  // --- Loading states ---
  if (isLoading) {
    if (compact) {
      return (
        <div className={cn("space-y-3", className)}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="p-3 rounded-xl border border-border/50">
              <div className="flex items-start gap-3 mb-2">
                <Skeleton className="size-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="space-y-1.5 mb-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (columns === 2) {
      return (
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4 items-start", className)}>
          {Array.from({ length: 4 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      )
    }
    return (
      <div className={cn("space-y-4", className)}>
        <Card hover>
          <CardHeader className="pb-4">
            <CardTitle>Team Activity</CardTitle>
          </CardHeader>
        </Card>
        {Array.from({ length: 3 }).map((_, index) => (
          <PostCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  // --- Empty states ---
  if (!posts || posts.length === 0) {
    if (compact) {
      return (
        <div className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
          No recent activity from team members
        </div>
      )
    }
    if (columns === 2) {
      return (
        <div className={cn("text-center py-16", className)}>
          <div className="rounded-full bg-muted/60 p-4 mx-auto w-fit mb-3">
            <IconMessageCircle className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-sm mb-1">No activity yet</h3>
          <p className="text-xs text-muted-foreground">Posts will appear here when your team is active</p>
        </div>
      )
    }
    return (
      <div className={className}>
        <Card hover>
          <CardHeader className="pb-4">
            <CardTitle>Team Activity</CardTitle>
          </CardHeader>
        </Card>
        <EmptyState />
      </div>
    )
  }

  // --- Compact mode ---
  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        {filteredAndSortedPosts.map((post) => (
          <CompactPostCard key={post.id} post={post} />
        ))}
      </div>
    )
  }

  // --- Grid mode (2-column, no filter header) ---
  if (columns === 2) {
    return (
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4 items-start", className)}>
        {filteredAndSortedPosts.map((post) => (
          <PostCard key={post.id} post={post} onRemix={onRemix} />
        ))}
      </div>
    )
  }

  // --- Full mode with filters (single column) ---
  return (
    <div className={cn("space-y-4", className)}>
      <Card hover>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Team Activity</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <IconFilter className="size-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text">Text Posts</SelectItem>
                  <SelectItem value="article">Articles</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="poll">Polls</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <IconSortDescending className="size-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="engagement">Most Engaging</SelectItem>
                  <SelectItem value="impressions">Most Views</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {filteredAndSortedPosts.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-3 mb-4">
              <IconFilter className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">No posts match your filters</h3>
            <p className="text-xs text-muted-foreground max-w-[240px] mb-3">
              Try adjusting your filter settings to see more activity.
            </p>
            <Button variant="outline" size="sm" onClick={() => {
              setFilterType("all")
              setSortBy("recent")
            }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        filteredAndSortedPosts.map((post) => (
          <PostCard key={post.id} post={post} onRemix={onRemix} />
        ))
      )}
    </div>
  )
}
