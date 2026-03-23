/**
 * Post Detail Modal Component
 * @description Full-screen dialog displaying an inspiration post with author info,
 * engagement metrics, category badges, and actions to remix, save, or share.
 * @module components/features/post-detail-modal
 */

"use client"

import * as React from "react"
import {
  IconBookmark,
  IconCalendar,
  IconEye,
  IconLoader2,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconTag,
  IconThumbUp,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"

import { cn, getInitials, formatMetricNumber } from "@/lib/utils"
import { getCategoryBadgeVariant } from "@/lib/category-utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Represents an author of an inspiration post.
 */
export interface InspirationPostAuthor {
  /** Display name of the author */
  name: string
  /** Professional headline or title */
  headline: string
  /** Avatar image URL, optional */
  avatarUrl?: string
  /** Number of followers the author has */
  followerCount: number
}

/**
 * Engagement metrics for an inspiration post.
 */
export interface InspirationPostMetrics {
  /** Number of likes/reactions received */
  likes: number
  /** Number of comments on the post */
  comments: number
  /** Number of times the post was shared/reposted */
  shares: number
  /** Number of impressions (views), optional */
  impressions?: number
}

/**
 * Represents a curated viral post for inspiration with full details.
 */
export interface InspirationPost {
  /** Unique identifier for the post */
  id: string
  /** Author information */
  author: InspirationPostAuthor
  /** Full post content text */
  content: string
  /** ISO 8601 timestamp of when the post was published */
  publishedAt: string
  /** Engagement metrics for the post */
  metrics: InspirationPostMetrics
  /** Category classification */
  category: string
  /** Tags associated with the post, optional */
  tags?: string[]
}

/**
 * Props for the PostDetailModal component.
 */
export interface PostDetailModalProps {
  /** The post to display, or null if no post is selected */
  post: InspirationPost | null
  /** Whether the modal is currently open */
  isOpen: boolean
  /** Callback fired when the modal should be closed */
  onClose: () => void
  /** Callback fired when user clicks "Remix" on a post */
  onRemix: (postId: string) => void
  /** Callback fired when user clicks "Save" on a post, optional */
  onSave?: (postId: string) => void
  /** Whether the remix action is currently loading */
  isRemixing?: boolean
  /** Whether the save action is currently loading */
  isSaving?: boolean
  /** Additional CSS classes to apply to the dialog content */
  className?: string
}

/**
 * Loading skeleton for the post detail modal.
 */
function PostDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Author Header Skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {/* Content Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      {/* Metrics Skeleton */}
      <div className="flex gap-6 pt-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  )
}

/**
 * Renders a single metric item with icon and value.
 */
function MetricItem({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: number
  label: string
}) {
  return (
    <div
      className="flex items-center gap-1.5 text-muted-foreground"
      title={`${value.toLocaleString()} ${label}`}
    >
      <Icon className="size-4" />
      <span className="text-sm font-medium">{formatMetricNumber(value)}</span>
      <span className="text-xs hidden sm:inline">{label}</span>
    </div>
  )
}

/**
 * PostDetailModal displays a full-screen modal with complete details of an
 * inspiration post, including author info, content, metrics, and action buttons.
 *
 * @example
 * ```tsx
 * const [selectedPost, setSelectedPost] = useState<InspirationPost | null>(null)
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <PostDetailModal
 *   post={selectedPost}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onRemix={(postId) => console.log("Remix:", postId)}
 *   onSave={(postId) => console.log("Save:", postId)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // With loading states
 * <PostDetailModal
 *   post={inspirationPost}
 *   isOpen={true}
 *   onClose={handleClose}
 *   onRemix={handleRemix}
 *   isRemixing={isRemixLoading}
 *   isSaving={isSaveLoading}
 * />
 * ```
 */
export function PostDetailModal({
  post,
  isOpen,
  onClose,
  onRemix,
  onSave,
  isRemixing = false,
  isSaving = false,
  className,
}: PostDetailModalProps) {
  /**
   * Handles the remix button click.
   */
  const handleRemix = React.useCallback(() => {
    if (post && !isRemixing) {
      onRemix(post.id)
    }
  }, [post, isRemixing, onRemix])

  /**
   * Handles the save button click.
   */
  const handleSave = React.useCallback(() => {
    if (post && onSave && !isSaving) {
      onSave(post.id)
    }
  }, [post, onSave, isSaving])

  /**
   * Calculates the relative time from the published date.
   */
  const relativeTime = React.useMemo(() => {
    if (!post) return ""
    return formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })
  }, [post])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden",
          className
        )}
      >
        {/* Hidden title for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>
            {post ? `Post by ${post.author.name}` : "Post Details"}
          </DialogTitle>
          <DialogDescription>
            View the full details of this inspiration post
          </DialogDescription>
        </DialogHeader>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {!post ? (
            <PostDetailSkeleton />
          ) : (
            <div className="space-y-5">
              {/* Author Header */}
              <div className="flex items-start gap-4">
                <Avatar className="size-14 shrink-0">
                  {post.author.avatarUrl && (
                    <AvatarImage
                      src={post.author.avatarUrl}
                      alt={post.author.name}
                    />
                  )}
                  <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                    {getInitials(post.author.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">
                    {post.author.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                    {post.author.headline}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <IconUsers className="size-3.5" />
                      {formatMetricNumber(post.author.followerCount)} followers
                    </span>
                    <span className="flex items-center gap-1">
                      <IconCalendar className="size-3.5" />
                      {relativeTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Badge and Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getCategoryBadgeVariant(post.category)}>
                  {post.category}
                </Badge>
                {post.tags && post.tags.length > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <div className="flex items-center gap-1">
                      <IconTag className="size-3.5 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Post Content */}
              <div className="py-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>

              {/* Metrics Bar */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-3 border-t border-b">
                <MetricItem
                  icon={IconThumbUp}
                  value={post.metrics.likes}
                  label="likes"
                />
                <MetricItem
                  icon={IconMessageCircle}
                  value={post.metrics.comments}
                  label="comments"
                />
                <MetricItem
                  icon={IconShare}
                  value={post.metrics.shares}
                  label="shares"
                />
                {typeof post.metrics.impressions === 'number' && (
                  <MetricItem
                    icon={IconEye}
                    value={post.metrics.impressions}
                    label="impressions"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <DialogFooter className="flex-row gap-2 pt-4 border-t sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <IconX className="size-4" />
              Close
            </Button>
          </DialogClose>

          <div className="flex items-center gap-2">
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!post || isSaving}
              >
                {isSaving ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconBookmark className="size-4" />
                )}
                Save
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleRemix}
              disabled={!post || isRemixing}
            >
              {isRemixing ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconSparkles className="size-4" />
              )}
              Remix
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
