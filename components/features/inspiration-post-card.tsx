"use client"

/**
 * Inspiration Post Card Component
 * @description Enhanced card for displaying viral posts with metrics overlay and animations
 * @module components/features/inspiration-post-card
 */

import * as React from "react"
import { motion } from "framer-motion"
import {
  IconThumbUp,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconBookmark,
  IconBookmarkFilled,
  IconMaximize,
  IconFlame,
  IconUserPlus,
  IconUserCheck,
  IconLoader2,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, getInitials, formatMetricNumber } from "@/lib/utils"
import { cardHoverProps } from "@/lib/animations"
import type { InspirationPost } from "@/components/features/inspiration-feed"

/**
 * Props for the InspirationPostCard component
 */
export interface InspirationPostCardProps {
  post: InspirationPost
  isSaved?: boolean
  /** Whether the post's author is currently followed */
  isFollowingAuthor?: boolean
  onRemix?: (post: InspirationPost) => void
  onSave?: (postId: string) => void
  onUnsave?: (postId: string) => void
  onExpand?: (post: InspirationPost) => void
  /**
   * Callback to follow the post's author
   * @param url - LinkedIn profile URL
   * @param authorName - Display name
   * @param headline - Professional headline
   * @param avatar - Avatar URL
   */
  onFollow?: (url: string, authorName?: string, headline?: string, avatar?: string) => Promise<void>
  /**
   * Callback to unfollow the post's author (not used on card, handled via panel)
   * @param id - Record ID
   */
  onUnfollow?: (id: string) => Promise<void>
  className?: string
  compact?: boolean
}

/**
 * Category badge variants mapping - matches inferred categories
 */
const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  "marketing": "default",
  "technology": "secondary",
  "leadership": "default",
  "sales": "secondary",
  "entrepreneurship": "outline",
  "product-management": "default",
  "growth": "secondary",
  "design": "outline",
  "general": "outline",
  "ai": "secondary",
  "engineering": "secondary",
  "startup": "outline",
  "product": "default",
}

/**
 * Category labels mapping - matches inferred categories
 */
const CATEGORY_LABELS: Record<string, string> = {
  "marketing": "Marketing",
  "technology": "Technology",
  "leadership": "Leadership",
  "sales": "Sales",
  "entrepreneurship": "Startup",
  "product-management": "Product",
  "growth": "Growth",
  "design": "Design",
  "general": "General",
  "ai": "AI",
  "engineering": "Engineering",
  "startup": "Startup",
  "product": "Product",
}

/**
 * Calculate engagement score for virality indicator
 */
function calculateEngagementScore(metrics: InspirationPost["metrics"]): number {
  const total = metrics.reactions + metrics.comments * 2 + metrics.reposts * 3
  if (total >= 10000) return 5
  if (total >= 5000) return 4
  if (total >= 1000) return 3
  if (total >= 500) return 2
  return 1
}

/**
 * Renders a single metric with icon and value
 */
function MetricItem({
  icon: Icon,
  value,
  label,
  color = "text-muted-foreground",
}: {
  icon: React.ElementType
  value: number
  label: string
  color?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1", color)}>
          <Icon className="size-3.5" />
          <span className="text-xs font-medium tabular-nums">
            {formatMetricNumber(value)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{value.toLocaleString()} {label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Virality indicator badge
 */
function ViralityBadge({ score }: { score: number }) {
  if (score < 3) return null

  return (
    <motion.div
      className="absolute -top-1 -right-1 z-10"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 500 }}
    >
      <div className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
        score >= 5 ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" :
        score >= 4 ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white" :
        "bg-secondary/20 text-secondary"
      )}>
        <IconFlame className="size-3" />
        {score >= 5 ? "Viral" : score >= 4 ? "Hot" : "Trending"}
      </div>
    </motion.div>
  )
}

/**
 * Enhanced inspiration post card with animations and metrics overlay
 */
export function InspirationPostCard({
  post,
  isSaved = false,
  isFollowingAuthor = false,
  onRemix,
  onSave,
  onUnsave,
  onExpand,
  onFollow,
  onUnfollow,
  className,
  compact = false,
}: InspirationPostCardProps) {
  const [isFollowPending, setIsFollowPending] = React.useState(false)

  const relativeTime = React.useMemo(() => {
    const date = new Date(post.postedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 1) return 'today'
    if (diffDays === 1) return '1d ago'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    const years = Math.floor(diffDays / 365)
    return `${years}y ago`
  }, [post.postedAt])

  const categoryLabel = CATEGORY_LABELS[post.category] || post.category
  const categoryVariant = CATEGORY_VARIANTS[post.category] || "outline"
  const engagementScore = calculateEngagementScore(post.metrics)

  const handleSaveToggle = React.useCallback(() => {
    if (isSaved) {
      onUnsave?.(post.id)
    } else {
      onSave?.(post.id)
    }
  }, [isSaved, onSave, onUnsave, post.id])

  const handleRemix = React.useCallback(() => {
    onRemix?.(post)
  }, [onRemix, post])

  const handleExpand = React.useCallback(() => {
    onExpand?.(post)
  }, [onExpand, post])

  /** Toggle follow/unfollow the author */
  const handleFollowToggle = React.useCallback(async () => {
    setIsFollowPending(true)
    try {
      if (isFollowingAuthor && onUnfollow && post.authorUrl) {
        // Unfollow — pass the URL, the parent resolves the record ID
        await onUnfollow(post.authorUrl)
      } else if (onFollow) {
        if (post.authorUrl) {
          await onFollow(post.authorUrl, post.author.name, post.author.headline, post.author.avatar)
        } else {
          // No LinkedIn URL — open search
          window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(post.author.name)}`, '_blank')
        }
      }
    } finally {
      setIsFollowPending(false)
    }
  }, [isFollowingAuthor, post.authorUrl, post.author.name, post.author.headline, post.author.avatar, onFollow, onUnfollow])

  return (
    <motion.div
      className="relative"
      {...cardHoverProps}
    >
      <ViralityBadge score={engagementScore} />
      <Card className={cn(
        "h-full flex flex-col group relative overflow-hidden border-border/50",
        "bg-gradient-to-br from-card via-card to-primary/5",
        "transition-all duration-300 hover:border-primary/30 hover:shadow-lg",
        "dark:from-card dark:via-card dark:to-primary/10",
        className
      )}>
        {/* Subtle glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

        <CardContent className={cn(
          "flex flex-col flex-1 gap-3 relative",
          compact ? "pt-3" : "pt-4"
        )}>
          {/* Author Section */}
          <div className="flex items-start gap-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <Avatar className={cn(
                "shrink-0 ring-2 ring-background shadow-sm",
                compact ? "size-8" : "size-10"
              )}>
                {post.author.avatar && (
                  <AvatarImage src={post.author.avatar} alt={post.author.name} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-xs font-medium">
                  {getInitials(post.author.name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "font-semibold truncate",
                  compact ? "text-xs" : "text-sm"
                )}>
                  {post.author.name}
                </span>
                <Badge
                  variant={categoryVariant}
                  className="text-[10px] shrink-0"
                >
                  {categoryLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {post.author.headline}
              </p>
              {/* Tag badges */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 overflow-hidden max-h-[20px]">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-[100px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Primary cluster badge */}
              {post.primaryCluster && post.primaryCluster !== post.category && (
                <Badge
                  variant={CATEGORY_VARIANTS[post.primaryCluster] || "outline"}
                  className="text-[10px] mt-1 w-fit"
                >
                  {CATEGORY_LABELS[post.primaryCluster] || post.primaryCluster}
                </Badge>
              )}
            </div>

            {/* Save/Bookmark Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ scale: 1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 shrink-0 transition-all duration-200",
                      isSaved
                        ? "opacity-100 text-primary"
                        : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={handleSaveToggle}
                  >
                    {isSaved ? (
                      <IconBookmarkFilled className="size-4" />
                    ) : (
                      <IconBookmark className="size-4" />
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSaved ? "Remove from saved" : "Save for later"}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Content Section - Fixed height for consistent cards */}
          <div
            className={cn(
              "cursor-pointer hover:opacity-80 transition-opacity",
              compact ? "h-16" : "h-24"
            )}
            onClick={handleExpand}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
          >
            <p className={cn(
              "leading-relaxed text-foreground/90 overflow-hidden",
              compact ? "text-xs line-clamp-4" : "text-sm line-clamp-5"
            )}>
              {post.content}
            </p>
          </div>

          {/* Metrics and Actions Section */}
          <div className="pt-3 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <MetricItem
                  icon={IconThumbUp}
                  value={post.metrics.reactions}
                  label="reactions"
                  color="text-primary"
                />
                <MetricItem
                  icon={IconMessageCircle}
                  value={post.metrics.comments}
                  label="comments"
                  color="text-secondary"
                />
                <MetricItem
                  icon={IconShare}
                  value={post.metrics.reposts}
                  label="reposts"
                  color="text-muted-foreground"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {relativeTime}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRemix}
                  className="w-full gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm"
                >
                  <IconSparkles className="size-3.5" />
                  Remix
                </Button>
              </motion.div>

              {/* Follow author button */}
              {onFollow && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        variant={isFollowingAuthor ? "secondary" : "outline"}
                        size="sm"
                        onClick={handleFollowToggle}
                        disabled={isFollowPending}
                        className={cn(
                          "shrink-0 border-border/50",
                          isFollowingAuthor ? "hover:border-destructive/30 hover:bg-destructive/5" : "hover:border-primary/30",
                        )}
                        aria-label={isFollowingAuthor ? "Unfollow author" : "Follow author"}
                      >
                        {isFollowPending ? (
                          <IconLoader2 className="size-3.5 animate-spin" />
                        ) : isFollowingAuthor ? (
                          <IconUserCheck className="size-3.5 text-primary" />
                        ) : (
                          <IconUserPlus className="size-3.5" />
                        )}
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isFollowingAuthor ? `Unfollow ${post.author.name}` : `Follow ${post.author.name}`}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onExpand && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExpand}
                        className="shrink-0 border-border/50 hover:border-primary/30"
                      >
                        <IconMaximize className="size-3.5" />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View full post</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Enhanced skeleton loading state for InspirationPostCard
 */
export function InspirationPostCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="h-full overflow-hidden border-border/50">
      <CardContent className={cn("space-y-3", compact ? "pt-3" : "pt-4")}>
        <div className="flex items-start gap-3">
          <Skeleton className={cn("rounded-full shrink-0", compact ? "size-8" : "size-10")} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
