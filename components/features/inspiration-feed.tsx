"use client"

/**
 * Inspiration Feed Component
 * @description Enhanced curated grid of viral posts with animations, filtering, and pagination
 * @module components/features/inspiration-feed
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconSearch,
  IconBulb,
  IconFilter,
  IconBookmark,
  IconBookmarkFilled,
  IconLoader2,
  IconChevronDown,
  IconSparkles,
  IconUsers,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trackDiscoverAction } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { inspirationToast } from "@/lib/toast-utils"
import {
  InspirationPostCard,
  InspirationPostCardSkeleton,
} from "@/components/features/inspiration-post-card"
import {
  staggerContainerVariants,
  staggerItemVariants,
  fadeSlideUpVariants,
} from "@/lib/animations"
import type { InspirationFilters, PaginationState, InspirationNiche } from "@/hooks/use-inspiration"
import { AVAILABLE_NICHES } from "@/hooks/use-inspiration"

/**
 * Represents an author of an inspiration post.
 */
export interface InspirationPostAuthor {
  /** Display name of the author */
  name: string
  /** Professional headline or title */
  headline: string
  /** Avatar image URL, optional */
  avatar?: string
}

/**
 * Engagement metrics for an inspiration post.
 */
export interface InspirationPostMetrics {
  /** Number of reactions (likes) received */
  reactions: number
  /** Number of comments on the post */
  comments: number
  /** Number of times the post was reposted/shared */
  reposts: number
}

/**
 * Represents a curated viral post for inspiration.
 */
export interface InspirationPost {
  /** Unique identifier for the post */
  id: string
  /** Author information */
  author: InspirationPostAuthor
  /** LinkedIn profile URL of the author, used for follow/unfollow matching */
  authorUrl?: string
  /** Post content text */
  content: string
  /** Category classification */
  category: string
  /** Engagement metrics for the post */
  metrics: InspirationPostMetrics
  /** ISO 8601 timestamp of when the post was published */
  postedAt: string
}

/**
 * Props for the InspirationFeed component.
 */
export interface InspirationFeedProps {
  /** Array of inspiration posts to display */
  posts?: InspirationPost[]
  /** Set of saved post IDs */
  savedPostIds?: Set<string>
  /** Current filter state */
  filters?: InspirationFilters
  /** Pagination state */
  pagination?: PaginationState
  /** Callback fired when user clicks "Remix" on a post */
  onRemix?: (post: InspirationPost) => void
  /** Callback fired when filters change */
  onFiltersChange?: (filters: Partial<InspirationFilters>) => void
  /** Callback fired to load more posts */
  onLoadMore?: () => Promise<void>
  /** Callback fired when save button is clicked */
  onSave?: (postId: string) => void
  /** Callback fired when unsave button is clicked */
  onUnsave?: (postId: string) => void
  /** Callback fired when expand button is clicked */
  onExpand?: (post: InspirationPost) => void
  /** Whether the feed is in a loading state */
  isLoading?: boolean
  /** Error message if any */
  error?: string | null
  /** Additional CSS classes to apply to the container */
  className?: string
  /**
   * Callback to check if an author URL is followed
   * @param authorUrl - The LinkedIn profile URL
   */
  isFollowing?: (authorUrl: string) => boolean
  /**
   * Callback to follow an influencer
   * @param url - LinkedIn profile URL
   * @param authorName - Optional display name
   * @param headline - Optional headline
   * @param avatar - Optional avatar URL
   */
  onFollow?: (url: string, authorName?: string, headline?: string, avatar?: string) => Promise<void>
  /**
   * Callback to unfollow an influencer by record ID
   * @param id - Record ID
   */
  onUnfollow?: (id: string) => Promise<void>
}

/** Available category options for filtering - matches inferred categories from posts */
export const INSPIRATION_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "marketing", label: "Marketing" },
  { id: "technology", label: "Technology" },
  { id: "leadership", label: "Leadership" },
  { id: "sales", label: "Sales" },
  { id: "entrepreneurship", label: "Startup" },
  { id: "product-management", label: "Product" },
  { id: "growth", label: "Growth" },
  { id: "design", label: "Design" },
] as const

/** Category type derived from the constants */
export type InspirationCategory = (typeof INSPIRATION_CATEGORIES)[number]["id"]

/** Niche labels for display */
const NICHE_LABELS: Record<InspirationNiche, string> = {
  'technology': 'Technology',
  'marketing': 'Marketing',
  'sales': 'Sales',
  'leadership': 'Leadership',
  'entrepreneurship': 'Entrepreneurship',
  'finance': 'Finance',
  'healthcare': 'Healthcare',
  'education': 'Education',
  'real-estate': 'Real Estate',
  'consulting': 'Consulting',
  'hr': 'HR & People',
  'product-management': 'Product Management',
  'engineering': 'Engineering',
  'design': 'Design',
  'general': 'General',
}

/**
 * Loading skeleton grid for the inspiration feed with stagger animation.
 * @param count - Number of skeleton cards to display
 * @returns JSX element with animated skeleton cards
 */
function LoadingSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
    >
      {Array.from({ length: count }).map((_, index) => (
        <motion.div key={`skeleton-${index}`} variants={staggerItemVariants}>
          <InspirationPostCardSkeleton />
        </motion.div>
      ))}
    </motion.div>
  )
}

/**
 * Empty state component displayed when there are no matching posts.
 * @param searchQuery - Current search query for message customization
 * @param savedOnly - Whether saved filter is active
 * @returns JSX element with animated empty state message
 */
function EmptyState({
  searchQuery,
  savedOnly,
}: {
  searchQuery?: string
  savedOnly?: boolean
}) {
  return (
    <motion.div
      variants={fadeSlideUpVariants}
      initial="initial"
      animate="animate"
    >
      <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            className="rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 p-4 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {savedOnly ? (
              <IconBookmark className="size-8 text-primary" />
            ) : (
              <IconBulb className="size-8 text-primary" />
            )}
          </motion.div>
          <motion.h3
            className="font-medium text-base mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {savedOnly ? "No saved posts" : "No inspiration found"}
          </motion.h3>
          <motion.p
            className="text-sm text-muted-foreground max-w-[300px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {savedOnly
              ? "You haven't saved any posts yet. Browse the feed and click the bookmark icon to save posts for later."
              : searchQuery
                ? `No posts match "${searchQuery}". Try adjusting your search or filter.`
                : "No posts available in this category. Try selecting a different filter."}
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Error state component displayed when fetching fails.
 * @param message - Error message to display
 * @param onRetry - Callback to retry fetching
 * @returns JSX element with animated error message and retry button
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-destructive/30 bg-gradient-to-br from-card via-card to-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            className="rounded-full bg-destructive/10 p-4 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <IconBulb className="size-8 text-destructive" />
          </motion.div>
          <motion.h3
            className="font-medium text-base mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            Failed to load posts
          </motion.h3>
          <motion.p
            className="text-sm text-muted-foreground max-w-[300px] mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {message}
          </motion.p>
          {onRetry && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * InspirationFeed displays a curated grid of viral posts categorized by niche
 * for content inspiration, with filtering, search, pagination, save functionality,
 * and remix capabilities.
 *
 * @example
 * ```tsx
 * // Basic usage with useInspiration hook
 * const {
 *   posts,
 *   savedPostIds,
 *   filters,
 *   pagination,
 *   isLoading,
 *   error,
 *   setFilters,
 *   loadMore,
 *   savePost,
 *   unsavePost,
 * } = useInspiration()
 *
 * <InspirationFeed
 *   posts={posts}
 *   savedPostIds={savedPostIds}
 *   filters={filters}
 *   pagination={pagination}
 *   isLoading={isLoading}
 *   error={error}
 *   onFiltersChange={setFilters}
 *   onLoadMore={loadMore}
 *   onSave={savePost}
 *   onUnsave={unsavePost}
 * />
 * ```
 */
export function InspirationFeed({
  posts,
  savedPostIds = new Set(),
  filters,
  pagination,
  onRemix,
  onFiltersChange,
  onLoadMore,
  onSave,
  onUnsave,
  onExpand,
  isLoading = false,
  error,
  className,
  isFollowing,
  onFollow,
  onUnfollow,
}: InspirationFeedProps) {
  // Local state for internal filtering when props not provided
  const [localCategory, setLocalCategory] = React.useState<InspirationCategory>("all")
  const [localSearchQuery, setLocalSearchQuery] = React.useState("")
  const [localNiche, setLocalNiche] = React.useState<InspirationNiche | "all">("all")
  const [localSavedOnly, setLocalSavedOnly] = React.useState(false)
  const [localFollowingOnly, setLocalFollowingOnly] = React.useState(false)

  // Use prop values if provided, otherwise use local state
  const activeCategory = filters?.category ?? localCategory
  const searchQuery = filters?.searchQuery ?? localSearchQuery
  const activeNiche = filters?.niche ?? localNiche
  const savedOnly = filters?.savedOnly ?? localSavedOnly
  const followingOnly = filters?.followingOnly ?? localFollowingOnly

  /**
   * Handles category tab change.
   * @param category - New category value
   */
  const handleCategoryChange = React.useCallback(
    (category: string) => {
      if (onFiltersChange) {
        onFiltersChange({ category: category as InspirationCategory | "all" })
      } else {
        setLocalCategory(category as InspirationCategory)
      }
    },
    [onFiltersChange]
  )

  /**
   * Handles search input change.
   * @param value - New search query
   */
  const handleSearchChange = React.useCallback(
    (value: string) => {
      if (onFiltersChange) {
        onFiltersChange({ searchQuery: value })
      } else {
        setLocalSearchQuery(value)
      }
    },
    [onFiltersChange]
  )

  /**
   * Handles niche filter change.
   * @param niche - New niche value
   */
  const handleNicheChange = React.useCallback(
    (niche: string) => {
      trackDiscoverAction("topic_changed", niche)
      if (onFiltersChange) {
        onFiltersChange({ niche: niche as InspirationNiche | "all" })
      } else {
        setLocalNiche(niche as InspirationNiche | "all")
      }
    },
    [onFiltersChange]
  )

  /**
   * Handles saved only toggle.
   * @param value - New saved only value
   */
  const handleSavedOnlyChange = React.useCallback(
    (value: boolean) => {
      if (onFiltersChange) {
        onFiltersChange({ savedOnly: value })
      } else {
        setLocalSavedOnly(value)
      }
    },
    [onFiltersChange]
  )

  /**
   * Handles following only toggle.
   * @param value - New following only value
   */
  const handleFollowingOnlyChange = React.useCallback(
    (value: boolean) => {
      if (onFiltersChange) {
        onFiltersChange({ followingOnly: value })
      } else {
        setLocalFollowingOnly(value)
      }
    },
    [onFiltersChange]
  )

  /**
   * Handles remixing a post - calls the onRemix callback to let parent handle the flow
   * @param post - The post to remix
   */
  const handleRemix = React.useCallback(
    (post: InspirationPost) => {
      trackDiscoverAction("remixed")
      // Call the callback - parent handles dialog/navigation
      onRemix?.(post)
    },
    [onRemix]
  )

  /**
   * Handles save toggle for a post
   * @param postId - ID of the post
   */
  const handleSave = React.useCallback(
    (postId: string) => {
      trackDiscoverAction("viewed")
      onSave?.(postId)
      inspirationToast.saved()
    },
    [onSave]
  )

  /**
   * Handles unsave for a post
   * @param postId - ID of the post
   */
  const handleUnsave = React.useCallback(
    (postId: string) => {
      onUnsave?.(postId)
    },
    [onUnsave]
  )

  /**
   * Filters posts based on local state when hook is not controlling filters
   */
  const displayPosts = React.useMemo(() => {
    if (!posts) return []

    // If filters are controlled externally, only apply following filter locally
    // (since followingOnly requires client-side isFollowing check)
    if (filters) {
      if (followingOnly && isFollowing) {
        return posts.filter(post => post.authorUrl ? isFollowing(post.authorUrl) : false)
      }
      return posts
    }

    return posts.filter((post) => {
      // Category filter
      const matchesCategory =
        activeCategory === "all" || post.category === activeCategory

      // Search filter (searches content, author name, and headline)
      const matchesSearch =
        searchQuery === "" ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.headline.toLowerCase().includes(searchQuery.toLowerCase())

      // Saved filter
      const matchesSaved = !savedOnly || savedPostIds.has(post.id)

      // Following filter
      const matchesFollowing = !followingOnly || (
        !!post.authorUrl && !!isFollowing && isFollowing(post.authorUrl)
      )

      return matchesCategory && matchesSearch && matchesSaved && matchesFollowing
    })
  }, [posts, filters, activeCategory, searchQuery, savedOnly, savedPostIds, followingOnly, isFollowing])

  return (
    <motion.div
      variants={fadeSlideUpVariants}
      initial="initial"
      animate="animate"
    >
      <Card className={cn(
        "group relative overflow-hidden border-border/50",
        "bg-gradient-to-br from-card via-card to-primary/5",
        "transition-all duration-300 hover:border-primary/30 hover:shadow-lg",
        "dark:from-card dark:via-card dark:to-primary/10",
        "card-glow",
        className
      )}>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

        <CardHeader className="relative space-y-4">
          {/* Title and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <motion.div
                className="rounded-lg bg-primary/10 p-1.5"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <IconBulb className="size-4 text-primary" />
              </motion.div>
              <CardTitle className="text-lg">Inspiration Feed</CardTitle>
            </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <div className="relative flex-1 sm:w-64">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search inspiration..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <IconFilter className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={savedOnly}
                  onCheckedChange={handleSavedOnlyChange}
                >
                  {savedOnly ? (
                    <IconBookmarkFilled className="mr-2 size-4 text-primary" />
                  ) : (
                    <IconBookmark className="mr-2 size-4" />
                  )}
                  Saved posts only
                </DropdownMenuCheckboxItem>
                {onFollow && (
                  <DropdownMenuCheckboxItem
                    checked={followingOnly}
                    onCheckedChange={handleFollowingOnlyChange}
                  >
                    <IconUsers className="mr-2 size-4" />
                    Following only
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Category Tabs and Niche Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Category Tabs */}
          <div className="overflow-x-auto flex-1 -mx-6 px-6 sm:mx-0 sm:px-0 pb-1">
            <Tabs
              value={activeCategory}
              onValueChange={handleCategoryChange}
              className="w-full"
            >
              <TabsList className="inline-flex w-auto">
                {INSPIRATION_CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="text-xs whitespace-nowrap"
                  >
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Niche Filter */}
          <Select value={activeNiche} onValueChange={handleNicheChange}>
            <SelectTrigger className="w-full sm:w-[180px] shrink-0">
              <SelectValue placeholder="All Niches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Niches</SelectItem>
              {AVAILABLE_NICHES.filter(niche => niche !== 'general').map((niche) => (
                <SelectItem key={niche} value={niche}>
                  {NICHE_LABELS[niche]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </CardHeader>

        <CardContent className="relative">
          {/* Error State */}
          {error ? (
          <ErrorState
            message={error}
            onRetry={onLoadMore ? () => onLoadMore() : undefined}
          />
        ) : isLoading && displayPosts.length === 0 ? (
          /* Initial Loading State */
          <LoadingSkeletonGrid count={6} />
        ) : displayPosts.length === 0 ? (
          /* Empty State */
          <EmptyState searchQuery={searchQuery || undefined} savedOnly={savedOnly} />
        ) : (
          /* Posts Grid with Stagger Animation */
          <>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              <AnimatePresence mode="popLayout">
                {displayPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    variants={staggerItemVariants}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <InspirationPostCard
                      post={post}
                      isSaved={savedPostIds.has(post.id)}
                      isFollowingAuthor={post.authorUrl ? (isFollowing?.(post.authorUrl) ?? false) : false}
                      onRemix={handleRemix}
                      onSave={handleSave}
                      onUnsave={handleUnsave}
                      onExpand={onExpand}
                      onFollow={onFollow}
                      onUnfollow={onUnfollow}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination / Load More */}
            <motion.div
              className="flex flex-col items-center gap-4 pt-6 mt-6 border-t border-border/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {/* Post Count */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconSparkles className="size-4 text-primary" />
                <span>
                  Showing {displayPosts.length}
                  {pagination?.totalCount
                    ? ` of ${pagination.totalCount}`
                    : posts?.length
                      ? ` of ${posts.length}`
                      : ""}{" "}
                  posts
                </span>
              </div>

              {/* Load More Button */}
              {pagination?.hasMore && onLoadMore && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={onLoadMore}
                    disabled={pagination.isLoadingMore}
                    className="gap-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                  >
                    {pagination.isLoadingMore ? (
                      <>
                        <IconLoader2 className="size-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <IconChevronDown className="size-4" />
                        Load More
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
