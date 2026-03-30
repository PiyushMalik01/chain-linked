"use client"

/**
 * Inspiration Page (Unified)
 * @description Unified content discovery page merging Viral Posts (Inspiration),
 * Discover Topics, and Swipe into a single tabbed interface with animated capsule
 * tab bar powered by Framer Motion.
 * @module app/dashboard/inspiration/page
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useInView } from "react-intersection-observer"

// --- Shared ---
import { PageContent } from "@/components/shared/page-content"
import { ErrorBoundary } from "@/components/error-boundary"
import { RemixDialog, type RemixSettings } from "@/components/features/remix-dialog"
import { InspirationSkeleton, SwipeSkeleton } from "@/components/skeletons/page-skeletons"
import { useApiKeys } from "@/hooks/use-api-keys"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import { useDraft } from "@/lib/store/draft-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// --- Inspiration tab ---
import { InspirationFeed } from "@/components/features/inspiration-feed"
import { FollowedInfluencersPanel } from "@/components/features/followed-influencers-panel"
import { useInspiration } from "@/hooks/use-inspiration"
import { useFollowedInfluencers } from "@/hooks/use-followed-influencers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  IconAlertCircle,
  IconRefresh,
  IconThumbUp,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconBookmark,
  IconBookmarkFilled,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { inspirationToast } from "@/lib/toast-utils"
import { getInitials, formatMetricNumber } from "@/lib/utils"
import type { InspirationPost } from "@/components/features/inspiration-feed"

// --- Discover tab ---
import { ArticleDetailDialog } from "@/components/features/article-detail-dialog"
import { DiscoverNewsCard } from "@/components/features/discover-news-card"
import { DiscoverTrendingSidebar } from "@/components/features/discover-trending-sidebar"
import { TopicSelectionOverlay } from "@/components/features/topic-selection-overlay"
import { ManageTopicsModal } from "@/components/features/manage-topics-modal"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  useDiscoverNews,
  type NewsArticle,
} from "@/hooks/use-discover-news"
import {
  IconAdjustmentsHorizontal,
  IconInbox,
  IconLoader2,
  IconSearch,
} from "@tabler/icons-react"

// --- Swipe tab ---
import {
  SwipeCardStack,
  type SwipeCardData,
} from "@/components/features/swipe-card"
import { GenerationProgress } from "@/components/features/generation-progress"
import { useGeneratedSuggestions } from "@/hooks/use-generated-suggestions"
import { useSwipeActions } from "@/hooks/use-swipe-actions"
import { swipeToast } from "@/lib/toast-utils"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconX,
  IconHeart,
  IconPencil,
  IconMoodEmpty,
  IconFilter,
  IconWand,
} from "@tabler/icons-react"
import {
  fadeSlideUpVariants,
} from "@/lib/animations"
import type { GeneratedSuggestion } from "@/types/database"

/* =============================================================================
   TAB DEFINITIONS
   ============================================================================= */

/** Tab identifiers */
type TabId = "viral" | "discover" | "swipe"

/**
 * Tab definition for the capsule tab bar
 */
interface TabDef {
  id: TabId
  label: string
}

const TABS: TabDef[] = [
  { id: "viral", label: "Viral Posts" },
  { id: "discover", label: "Discover Topics" },
  { id: "swipe", label: "Swipe" },
]

/* =============================================================================
   CAPSULE TAB BAR
   ============================================================================= */

/**
 * Animated capsule tab bar with a sliding background indicator
 * @param props - Tab bar props
 * @param props.activeTab - Currently active tab ID
 * @param props.onTabChange - Callback when a tab is selected
 * @returns Animated tab bar with sliding capsule indicator
 */
function CapsuleTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<Map<TabId, HTMLButtonElement>>(new Map())

  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    left: number
    width: number
  }>({ left: 0, width: 0 })

  /** Measure the active tab button and position the sliding indicator */
  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current
    const activeButton = tabRefs.current.get(activeTab)
    if (!container || !activeButton) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()

    setIndicatorStyle({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    })
  }, [activeTab])

  React.useEffect(() => {
    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [updateIndicator])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center rounded-full bg-muted/60 p-1 border border-border/40"
    >
      {/* Sliding capsule indicator */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-full bg-background shadow-sm border border-border/50"
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      />

      {/* Tab buttons */}
      {TABS.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) tabRefs.current.set(tab.id, el)
          }}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
            activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/* =============================================================================
   INSPIRATION (VIRAL POSTS) TAB
   ============================================================================= */

/**
 * Category badge variants mapping
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
 * Category labels mapping
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
 * Post detail modal component
 * @param props - Modal props
 * @param props.post - The post to display
 * @param props.open - Whether the modal is open
 * @param props.onOpenChange - Open state change handler
 * @param props.isSaved - Whether post is saved
 * @param props.onSave - Save handler
 * @param props.onUnsave - Unsave handler
 * @param props.onRemix - Remix handler
 * @returns Post detail dialog
 */
function PostDetailModal({
  post,
  open,
  onOpenChange,
  isSaved,
  onSave,
  onUnsave,
  onRemix,
}: {
  post: InspirationPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaved: boolean
  onSave?: (postId: string) => void
  onUnsave?: (postId: string) => void
  onRemix?: (post: InspirationPost) => void
}) {
  if (!post) return null

  const relativeTime = formatDistanceToNow(new Date(post.postedAt), {
    addSuffix: true,
  })

  const categoryLabel = CATEGORY_LABELS[post.category] || post.category
  const categoryVariant = CATEGORY_VARIANTS[post.category] || "outline"

  const handleSaveToggle = () => {
    if (isSaved) {
      onUnsave?.(post.id)
    } else {
      onSave?.(post.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Avatar className="size-12 shrink-0">
              {post.author.avatar && (
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
              )}
              <AvatarFallback className="text-sm font-medium bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                {getInitials(post.author.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span className="truncate">{post.author.name}</span>
                <Badge variant={categoryVariant} className="text-xs shrink-0">
                  {categoryLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm">
                {post.author.headline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 py-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>

            <div className="flex items-center gap-6 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <IconThumbUp className="size-4" />
                <span className="text-sm">{formatMetricNumber(post.metrics.reactions)} reactions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconMessageCircle className="size-4" />
                <span className="text-sm">{formatMetricNumber(post.metrics.comments)} comments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconShare className="size-4" />
                <span className="text-sm">{formatMetricNumber(post.metrics.reposts)} reposts</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Posted {relativeTime}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border/50">
          <Button
            variant="default"
            onClick={() => {
              onRemix?.(post)
              onOpenChange(false)
            }}
            className="flex-1 gap-2"
          >
            <IconSparkles className="size-4" />
            Remix This Post
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveToggle}
            className="gap-2"
          >
            {isSaved ? (
              <>
                <IconBookmarkFilled className="size-4 text-primary" />
                Saved
              </>
            ) : (
              <>
                <IconBookmark className="size-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Viral Posts tab content (formerly the standalone Inspiration page)
 * @returns Inspiration feed with filtering, pagination, remix, and follow support
 */
function ViralPostsTab() {
  const router = useRouter()
  const { loadForRemix } = useDraft()

  const [selectedInfluencerId, setSelectedInfluencerId] = React.useState<string | null>(null)

  const {
    posts,
    savedPostIds,
    filters,
    pagination,
    isLoading,
    error,
    refetch,
    setFilters,
    loadMore,
    savePost,
    unsavePost,
    isPostSaved,
    searchMeta,
  } = useInspiration(undefined, selectedInfluencerId || undefined)

  const {
    influencers,
    isLoading: isInfluencersLoading,
    followInfluencer,
    unfollowInfluencer,
    isFollowing,
    markAsSeen,
    fetchLatestPosts,
  } = useFollowedInfluencers()

  const [selectedPost, setSelectedPost] = React.useState<InspirationPost | null>(null)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [isRemixOpen, setIsRemixOpen] = React.useState(false)
  const [postToRemix, setPostToRemix] = React.useState<InspirationPost | null>(null)

  // Auto-enable followingOnly when an influencer is selected
  React.useEffect(() => {
    if (selectedInfluencerId) {
      setFilters({ followingOnly: true })
    }
  }, [selectedInfluencerId, setFilters])

  const { status: apiKeyStatus } = useApiKeys()
  const hasApiKey = apiKeyStatus?.hasKey ?? false

  const handleExpand = React.useCallback((post: InspirationPost) => {
    setSelectedPost(post)
    setIsDetailOpen(true)
  }, [])

  const handleRemix = React.useCallback((post: InspirationPost) => {
    setPostToRemix(post)
    setIsRemixOpen(true)
  }, [])

  const handleRemixComplete = React.useCallback((remixedContent: string, settings: RemixSettings) => {
    if (postToRemix) {
      loadForRemix(postToRemix.id, remixedContent, undefined, undefined, {
        tone: settings.tone,
        length: settings.length,
        customInstructions: settings.customInstructions,
        originalContent: postToRemix.content,
        aiMetadata: settings.aiMetadata,
      })
      inspirationToast.remixed()
      router.push("/dashboard/compose")
    }
    setIsRemixOpen(false)
    setPostToRemix(null)
  }, [postToRemix, loadForRemix, router])

  const handleSave = React.useCallback((postId: string) => {
    savePost(postId)
  }, [savePost])

  if (error && posts.length === 0) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 text-destructive">
            <IconAlertCircle className="h-5 w-5" />
            <span>Failed to load inspiration: {error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <IconRefresh className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading && posts.length === 0) {
    return <InspirationSkeleton />
  }

  return (
    <>
      {/* Followed Influencers Panel - shown above the feed */}
      <FollowedInfluencersPanel
        influencers={influencers}
        isLoading={isInfluencersLoading}
        onFollow={followInfluencer}
        onUnfollow={unfollowInfluencer}
        onSelectInfluencer={setSelectedInfluencerId}
        selectedInfluencerId={selectedInfluencerId}
        onMarkAsSeen={markAsSeen}
        onFetchLatest={fetchLatestPosts}
      />

      {/* Influencer filter bar */}
      {selectedInfluencerId && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing posts from {influencers.find(i => i.id === selectedInfluencerId)?.author_name || 'selected influencer'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={() => fetchLatestPosts(selectedInfluencerId)}
            >
              <IconRefresh className="size-3" />
              Fetch latest
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setSelectedInfluencerId(null)}
            >
              Clear filter
            </Button>
          </div>
        </div>
      )}

      <ErrorBoundary>
        <InspirationFeed
          posts={posts}
          savedPostIds={savedPostIds}
          filters={filters}
          pagination={pagination}
          isLoading={isLoading}
          error={error}
          onFiltersChange={setFilters}
          onLoadMore={loadMore}
          onSave={handleSave}
          onUnsave={unsavePost}
          onExpand={handleExpand}
          onRemix={handleRemix}
          isFollowing={isFollowing}
          onFollow={followInfluencer}
          onUnfollow={async (urlOrId: string) => {
            // If it's a URL, find the matching influencer record
            const inf = influencers.find(
              i => i.linkedin_url.split('?')[0].toLowerCase() === urlOrId.split('?')[0].toLowerCase()
                || i.id === urlOrId
            )
            if (inf) await unfollowInfluencer(inf.id)
          }}
          searchMeta={searchMeta}
        />
      </ErrorBoundary>

      <PostDetailModal
        post={selectedPost}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        isSaved={selectedPost ? isPostSaved(selectedPost.id) : false}
        onSave={handleSave}
        onUnsave={unsavePost}
        onRemix={handleRemix}
      />

      <RemixDialog
        isOpen={isRemixOpen}
        onClose={() => {
          setIsRemixOpen(false)
          setPostToRemix(null)
        }}
        originalContent={postToRemix?.content || ""}
        originalAuthor={postToRemix?.author.name}
        onRemixed={handleRemixComplete}
        hasApiKey={hasApiKey}
      />
    </>
  )
}

/* =============================================================================
   DISCOVER TOPICS TAB
   ============================================================================= */

/**
 * Topic pill filter button
 * @param props - Pill props
 * @param props.name - Topic name
 * @param props.isActive - Whether selected
 * @param props.onClick - Click handler
 * @param props.postCount - Optional article count
 * @returns Styled topic pill badge
 */
function TopicPill({
  name,
  isActive,
  onClick,
  postCount,
}: {
  name: string
  isActive: boolean
  onClick: () => void
  postCount?: number
}) {
  return (
    <button onClick={onClick}>
      <Badge
        variant={isActive ? "default" : "outline"}
        className={cn(
          "cursor-pointer transition-colors text-xs px-3 py-1 whitespace-nowrap",
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        )}
      >
        {name}
        {postCount != null && postCount > 0 && (
          <span className="ml-1 opacity-70">{postCount}</span>
        )}
      </Badge>
    </button>
  )
}

/**
 * Empty state for discover when no articles match
 * @param props - Empty state props
 * @param props.topic - Current topic name
 * @param props.isSearch - Whether from search
 * @returns Empty state card
 */
function DiscoverEmptyState({ topic, isSearch }: { topic: string; isSearch?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            className="rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 p-5 mb-4"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 18 }}
          >
            {isSearch ? (
              <IconSearch className="size-9 text-primary/70" />
            ) : (
              <IconInbox className="size-9 text-primary/70" />
            )}
          </motion.div>
          <motion.h3
            className="font-semibold text-lg mb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4 }}
          >
            {isSearch ? "No matching articles found" : "No news articles yet for this topic"}
          </motion.h3>
          <motion.p
            className="text-muted-foreground text-sm max-w-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }}
          >
            {isSearch
              ? "Try adjusting your search terms or browse a different topic."
              : `We're still gathering news about "${topic}". Check back soon or try another topic.`}
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Error state card for discover
 * @param props - Props with message and retry handler
 * @returns Error card with retry button
 */
function DiscoverErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2 text-destructive">
          <IconAlertCircle className="size-5" />
          <span>{message}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <IconRefresh className="mr-2 size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Seeding banner shown while Perplexity ingest is running
 * @returns Slim animated banner
 */
function SeedingBanner() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-center gap-3 py-3">
        <IconLoader2 className="size-4 text-primary animate-spin shrink-0" />
        <p className="text-sm text-muted-foreground">
          Gathering fresh news for your topics via Perplexity AI. This may take up to a minute.
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for the discover two-column layout
 * @returns Skeleton with featured cards and sidebar
 */
/** Rotating tips shown during discover loading */
const DISCOVER_LOADING_TIPS = [
  "Curating the latest industry insights for you...",
  "Finding trending topics in your areas of interest...",
  "Analyzing top-performing content from your network...",
  "Discovering fresh content ideas tailored to your niche...",
  "Scanning for viral posts you can remix into your own...",
]

function DiscoverLoadingTip() {
  const [tipIndex, setTipIndex] = React.useState(0)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % DISCOVER_LOADING_TIPS.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])
  return (
    <p className="text-sm text-muted-foreground text-center animate-pulse">
      {DISCOVER_LOADING_TIPS[tipIndex]}
    </p>
  )
}

function DiscoverContentSkeleton() {
  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="py-2">
          <DiscoverLoadingTip />
        </div>
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-full bg-muted animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
              <div className="flex gap-1.5">
                <div className="h-4 w-12 bg-muted animate-pulse rounded-full" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t my-4" />
        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        <div className="rounded-lg border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-full bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-80 shrink-0 space-y-6 hidden lg:block">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Discover Topics tab content (formerly the standalone Discover page)
 * @returns Two-column news layout with topic pills, search, and infinite scroll
 */
function DiscoverTopicsTab() {
  const router = useRouter()
  const { loadForRemix } = useDraft()
  const {
    topics,
    activeTopic,
    articles,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    searchQuery,
    showTopicSelection,
    isLoadingTopics,
    isSeeding,
    setActiveTopic,
    setSearchQuery,
    addTopic,
    removeTopic,
    updateTopics,
    completeTopicSelection,
    retry,
    refresh,
    fetchNewArticles,
    loadMore,
  } = useDiscoverNews()

  const [isManageTopicsOpen, setIsManageTopicsOpen] = React.useState(false)
  const [isRemixOpen, setIsRemixOpen] = React.useState(false)
  const [articleToRemix, setArticleToRemix] = React.useState<NewsArticle | null>(null)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [articleToView, setArticleToView] = React.useState<NewsArticle | null>(null)

  const [searchInput, setSearchInput] = React.useState("")
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const { status: apiKeyStatus } = useApiKeys()
  const hasApiKey = apiKeyStatus?.hasKey ?? false

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  })

  const mountedRef = React.useRef(true)
  React.useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  React.useEffect(() => {
    if (inView && hasMore && !isLoading && !isLoadingMore && mountedRef.current) {
      loadMore()
    }
  }, [inView, hasMore, isLoading, isLoadingMore, loadMore])

  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 400)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchInput, setSearchQuery])

  const handleArticleClick = React.useCallback((article: NewsArticle) => {
    setArticleToView(article)
    setIsDetailOpen(true)
  }, [])

  const handleRemix = React.useCallback((article: NewsArticle) => {
    setArticleToRemix(article)
    setIsRemixOpen(true)
  }, [])

  const handleRemixComplete = React.useCallback(
    (remixedContent: string, settings: RemixSettings) => {
      if (articleToRemix) {
        loadForRemix(articleToRemix.id, remixedContent, articleToRemix.sourceName, undefined, {
          tone: settings.tone,
          length: settings.length,
          customInstructions: settings.customInstructions,
          originalContent: `${articleToRemix.headline}\n\n${articleToRemix.summary}`,
          aiMetadata: settings.aiMetadata,
        })
        router.push("/dashboard/compose")
      }
      setIsRemixOpen(false)
      setArticleToRemix(null)
    },
    [articleToRemix, loadForRemix, router]
  )

  const activeTopicName = React.useMemo(() => {
    return topics.find((t) => t.slug === activeTopic)?.name || activeTopic
  }, [topics, activeTopic])

  const originalContentForRemix = React.useMemo(() => {
    if (!articleToRemix) return ""
    return `${articleToRemix.headline}\n\n${articleToRemix.summary}`
  }, [articleToRemix])

  return (
    <>
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Discover</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Stay informed with the latest industry news and find inspiration for your next post.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNewArticles}
            disabled={isSeeding}
            className="gap-2"
            title="Fetch fresh articles from Perplexity AI"
          >
            {isSeeding ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconSparkles className="size-4" />
            )}
            <span className="hidden sm:inline">
              {isSeeding ? "Fetching..." : "Fetch New"}
            </span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsManageTopicsOpen(true)}
            className="gap-2"
          >
            <IconAdjustmentsHorizontal className="size-4" />
            <span className="hidden sm:inline">Manage Topics</span>
          </Button>
        </div>
      </div>

      {/* Topic Pills */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-1">
          {topics.map((topic) => (
            <TopicPill
              key={topic.id}
              name={topic.name}
              isActive={topic.slug === activeTopic}
              onClick={() => setActiveTopic(topic.slug)}
              postCount={topic.postCount}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content Section */}
      {error ? (
        <DiscoverErrorState message={error} onRetry={retry} />
      ) : isLoading ? (
        <DiscoverContentSkeleton />
      ) : (
        <>
          {isSeeding && <SeedingBanner />}
          {articles.length === 0 ? (
            <DiscoverEmptyState topic={activeTopicName} isSearch={searchQuery.length > 0} />
          ) : (
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                {articles.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Stories</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {articles.slice(0, 3).map((article) => (
                        <DiscoverNewsCard key={article.id} article={article} onRemix={handleRemix} onClick={handleArticleClick} variant="featured" />
                      ))}
                    </div>
                  </div>
                )}

                {articles.length > 3 && <div className="border-t my-4" />}

                {articles.length > 3 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Latest</h3>
                    <div className="rounded-lg border bg-card overflow-hidden">
                      {articles.slice(3).map((article) => (
                        <DiscoverNewsCard key={article.id} article={article} onRemix={handleRemix} onClick={handleArticleClick} variant="compact" />
                      ))}
                    </div>
                  </div>
                )}

                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-6">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IconLoader2 className="size-5 animate-spin" />
                        <span className="text-sm">Loading more articles...</span>
                      </div>
                    ) : (
                      <Button variant="ghost" onClick={loadMore} className="gap-2">
                        <IconRefresh className="size-4" />
                        Load more
                      </Button>
                    )}
                  </div>
                )}

                {!hasMore && articles.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    You have seen all articles for this topic.
                  </p>
                )}
              </div>

              <DiscoverTrendingSidebar
                articles={articles}
                topics={topics}
                activeTopic={activeTopic}
                onTopicClick={setActiveTopic}
                onArticleClick={handleArticleClick}
              />
            </div>
          )}
        </>
      )}

      <TopicSelectionOverlay
        isOpen={showTopicSelection}
        onComplete={completeTopicSelection}
      />

      <ManageTopicsModal
        isOpen={isManageTopicsOpen}
        onClose={() => setIsManageTopicsOpen(false)}
        topics={topics}
        onAddTopic={addTopic}
        onRemoveTopic={removeTopic}
        onUpdateTopics={updateTopics}
      />

      <ArticleDetailDialog
        article={articleToView}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setArticleToView(null)
        }}
        onRemix={(article) => {
          setIsDetailOpen(false)
          setArticleToView(null)
          handleRemix(article)
        }}
      />

      <RemixDialog
        isOpen={isRemixOpen}
        onClose={() => {
          setIsRemixOpen(false)
          setArticleToRemix(null)
        }}
        originalContent={originalContentForRemix}
        originalAuthor={articleToRemix?.sourceName}
        onRemixed={handleRemixComplete}
        hasApiKey={hasApiKey}
      />
    </>
  )
}

/* =============================================================================
   SWIPE TAB
   ============================================================================= */

/** Swipe threshold in pixels */
const SWIPE_THRESHOLD = 100

/**
 * Empty state when no more swipe suggestions exist
 * @param props - Empty state props
 * @param props.onRefresh - Refresh handler
 * @param props.onGenerate - Generate handler
 * @param props.canGenerate - Whether generation is available
 * @param props.isGenerating - Whether currently generating
 * @returns Empty state card with action buttons
 */
function SwipeEmptyState({
  onRefresh,
  onGenerate,
  canGenerate,
  isGenerating,
}: {
  onRefresh: () => void
  onGenerate: () => void
  canGenerate: boolean
  isGenerating: boolean
}) {
  return (
    <motion.div
      className="flex h-[520px] w-full max-w-lg flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-gradient-to-br from-muted/30 via-muted/20 to-primary/5 p-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 p-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
      >
        <IconMoodEmpty className="size-12 text-muted-foreground/70" />
      </motion.div>
      <motion.h3
        className="mb-2 text-lg font-semibold"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        No suggestions available
      </motion.h3>
      <motion.p
        className="mb-4 text-sm text-muted-foreground max-w-[280px]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {canGenerate
          ? "Generate personalized AI suggestions tailored to your company and audience."
          : "You've reviewed all available suggestions. Check back later for fresh AI-generated post ideas."}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex gap-2"
      >
        {canGenerate && (
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {isGenerating ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <IconSparkles className="size-4" />
                  Generate Ideas
                </>
              )}
            </Button>
          </motion.div>
        )}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onRefresh}
            variant="outline"
            className="gap-2 border-primary/30 hover:border-primary/50"
          >
            <IconRefresh className="size-4" />
            Refresh
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Extract unique categories from suggestions
 * @param suggestions - Array of generated suggestions
 * @returns Sorted array of unique category strings
 */
function extractCategories(suggestions: GeneratedSuggestion[]): string[] {
  const categories = new Set<string>()
  suggestions.forEach((s) => {
    if (s.category) {
      categories.add(s.category)
    }
  })
  return Array.from(categories).sort()
}

/**
 * Swipe tab content (formerly the standalone Swipe page)
 * Includes the swipe card stack, action buttons, and generation controls.
 * Session Progress card and Wishlist link are removed per design spec.
 * @returns Swipe interface with card stack and action buttons
 */
function SwipeTab() {
  const router = useRouter()
  const { loadForRemix } = useDraft()

  const {
    suggestions,
    remainingSuggestions,
    isLoading: suggestionsLoading,
    error: suggestionsError,
    refetch,
    markAsUsed,
    dismissSuggestion,
    generateNew,
    cancelGeneration,
    canGenerate,
    activeCount,
    isGenerating,
    generationProgress,
    generationError,
  } = useGeneratedSuggestions()

  const {
    recordSwipe,
    incrementShown,
  } = useSwipeActions()

  const { status: apiKeyStatus } = useApiKeys()

  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [showRemixDialog, setShowRemixDialog] = React.useState(false)
  const [remixContent, setRemixContent] = React.useState("")
  const [swipeOffset, setSwipeOffset] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [exitingCardId, setExitingCardId] = React.useState<string | null>(null)
  const [exitDirection, setExitDirection] = React.useState<"left" | "right" | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const startXRef = React.useRef(0)
  const swipeInProgress = React.useRef(false)

  const categories = React.useMemo(() => extractCategories(suggestions), [suggestions])

  const filteredSuggestions = React.useMemo(() => {
    if (categoryFilter === "all") {
      return remainingSuggestions
    }
    return remainingSuggestions.filter((s) => s.category === categoryFilter)
  }, [remainingSuggestions, categoryFilter])

  const currentCard = filteredSuggestions.length > 0 ? filteredSuggestions[0] : null

  React.useEffect(() => {
    if (currentCard && !exitingCardId) {
      incrementShown()
    }
  }, [currentCard?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwipe = React.useCallback(
    async (direction: "left" | "right") => {
      if (!currentCard || exitingCardId || swipeInProgress.current) return
      swipeInProgress.current = true

      const swipedCard = currentCard

      setExitingCardId(swipedCard.id)
      setExitDirection(direction)

      const action = direction === "right" ? "like" : "dislike"
      recordSwipe(swipedCard.id, action, swipedCard.content)

      if (direction === "right") {
        fetch("/api/drafts/auto-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: swipedCard.content,
            postType: swipedCard.post_type || "general",
            source: "swipe",
          }),
        })
          .then((res) => {
            if (res.ok) {
              toast.success("Saved as draft!", {
                description: "Find it in your Saved Drafts",
              })
            } else {
              toast.error("Failed to save draft")
            }
          })
          .catch(() => toast.error("Failed to save draft"))
      }

      setTimeout(async () => {
        if (direction === "right") {
          await markAsUsed(swipedCard.id)
        } else {
          await dismissSuggestion(swipedCard.id)
          swipeToast.skipped()
        }

        setSwipeOffset(0)
        setExitingCardId(null)
        setExitDirection(null)
        swipeInProgress.current = false
      }, 350)
    },
    [currentCard, exitingCardId, recordSwipe, dismissSuggestion, markAsUsed]
  )

  const handleEditAndPost = React.useCallback(() => {
    if (!currentCard) return
    recordSwipe(currentCard.id, "like", currentCard.content)
    markAsUsed(currentCard.id)
    loadForRemix(currentCard.id, currentCard.content, "AI Suggestion")
    swipeToast.editAndPost()
    router.push("/dashboard/compose")
  }, [currentCard, recordSwipe, markAsUsed, loadForRemix, router])

  const handleOpenRemix = React.useCallback(() => {
    if (!currentCard) return
    setRemixContent(currentCard.content)
    setShowRemixDialog(true)
  }, [currentCard])

  const handleRemixComplete = React.useCallback((remixedContent: string, settings: RemixSettings) => {
    if (!currentCard) return
    recordSwipe(currentCard.id, "like", currentCard.content)
    markAsUsed(currentCard.id)
    loadForRemix(currentCard.id, remixedContent, undefined, undefined, {
      tone: settings.tone,
      length: settings.length,
      customInstructions: settings.customInstructions,
      originalContent: currentCard.content,
      aiMetadata: settings.aiMetadata,
    })
    setShowRemixDialog(false)
    swipeToast.editAndPost()
    router.push("/dashboard/compose")
  }, [currentCard, recordSwipe, markAsUsed, loadForRemix, router])

  // Drag handlers
  const handleDragStart = React.useCallback(
    (clientX: number) => {
      if (exitingCardId) return
      setIsDragging(true)
      startXRef.current = clientX
    },
    [exitingCardId]
  )

  const handleDragMove = React.useCallback(
    (clientX: number) => {
      if (!isDragging) return
      const deltaX = clientX - startXRef.current
      setSwipeOffset(deltaX)
    },
    [isDragging]
  )

  const handleDragEnd = React.useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      handleSwipe(swipeOffset > 0 ? "right" : "left")
    } else {
      setSwipeOffset(0)
    }
  }, [isDragging, swipeOffset, handleSwipe])

  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX)
  const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX)
  const onMouseUp = () => handleDragEnd()
  const onMouseLeave = () => {
    if (isDragging) handleDragEnd()
  }

  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX)
  const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX)
  const onTouchEnd = () => handleDragEnd()

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handleSwipe("left")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleSwipe("right")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSwipe])

  const cardData: SwipeCardData[] = filteredSuggestions.map((s) => ({
    id: s.id,
    content: s.content,
    category: s.category || "General",
    estimatedEngagement: s.estimated_engagement ?? undefined,
    postType: s.post_type ?? undefined,
    isPersonalized: true,
  }))

  if (suggestionsError) {
    return (
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full max-w-md border-destructive/50 bg-gradient-to-br from-destructive/5 to-destructive/10">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
            >
              <IconAlertCircle className="size-12 text-destructive" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="font-semibold">Failed to Load Suggestions</h3>
              <p className="text-sm text-muted-foreground">{suggestionsError}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button variant="outline" onClick={refetch} className="gap-2 border-destructive/30 hover:border-destructive/50">
                <IconRefresh className="size-4" />
                Try Again
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (suggestionsLoading) {
    return <SwipeSkeleton />
  }

  return (
    <div
      className="flex flex-col items-center gap-6"
    >
      {/* Generation Progress */}
      <GenerationProgress
        progress={generationProgress}
        isGenerating={isGenerating}
        error={generationError}
        onCancel={cancelGeneration}
        className="w-full max-w-md"
      />

      {/* Header Controls */}
      <motion.div
        className="flex w-full max-w-md items-center justify-between gap-4 flex-wrap"
        variants={fadeSlideUpVariants}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center gap-2">
          <IconFilter className="size-4 text-muted-foreground" />
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 border-primary/30">
            <IconSparkles className="size-3 mr-1 text-primary" />
            {activeCount}/10 suggestions
          </Badge>

          {canGenerate && !isGenerating && (
            <Button
              onClick={generateNew}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <IconRefresh className="size-4" />
              Generate
            </Button>
          )}

          {isGenerating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" />
                <span className="hidden sm:inline">{Math.round(generationProgress)}%</span>
              </div>
              <Button
                onClick={cancelGeneration}
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <IconX className="size-3.5" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Card Stack */}
      {currentCard ? (
        <div
          ref={containerRef}
          className="relative h-[520px] w-full max-w-lg select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <SwipeCardStack
            cards={cardData}
            topCardOffset={swipeOffset}
            isDragging={isDragging}
            exitingCardId={exitingCardId}
            exitDirection={exitDirection}
          />
        </div>
      ) : (
        <SwipeEmptyState
          onRefresh={refetch}
          onGenerate={generateNew}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
        />
      )}

      {/* Action Buttons */}
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:border-red-700 dark:hover:bg-red-950 shadow-sm transition-all duration-200"
            onClick={() => handleSwipe("left")}
            disabled={!!exitingCardId || !currentCard}
            aria-label="Skip suggestion"
          >
            <IconX className="size-6" />
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full border-green-200 text-green-500 hover:border-green-300 hover:bg-green-50 hover:text-green-600 dark:border-green-800 dark:hover:border-green-700 dark:hover:bg-green-950 shadow-sm transition-all duration-200"
            onClick={() => handleSwipe("right")}
            disabled={!!exitingCardId || !currentCard}
            aria-label="Save as draft"
          >
            <IconHeart className="size-6" />
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="outline"
            className="rounded-full gap-2 border-primary/30 text-primary hover:border-primary hover:bg-primary/10 shadow-sm"
            onClick={handleOpenRemix}
            disabled={!!exitingCardId || !currentCard}
            aria-label="Remix with AI"
          >
            <IconWand className="size-4" />
            Remix
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="default"
            className="rounded-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
            onClick={handleEditAndPost}
            disabled={!!exitingCardId || !currentCard}
          >
            <IconPencil className="size-4" />
            Edit & Post
          </Button>
        </motion.div>
      </motion.div>

      {/* Keyboard Hint */}
      <motion.p
        className="text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Use <kbd className="rounded border border-primary/20 bg-muted px-1.5 py-0.5 font-mono text-[10px]">{'<-'}</kbd>{" "}
        <kbd className="rounded border border-primary/20 bg-muted px-1.5 py-0.5 font-mono text-[10px]">{'->'}</kbd> arrow
        keys to swipe
      </motion.p>

      {/* Remix Dialog */}
      <RemixDialog
        isOpen={showRemixDialog}
        onClose={() => setShowRemixDialog(false)}
        originalContent={remixContent}
        originalAuthor="AI Suggestion"
        onRemixed={handleRemixComplete}
        hasApiKey={apiKeyStatus?.hasKey ?? false}
      />

    </div>
  )
}

/* =============================================================================
   UNIFIED PAGE
   ============================================================================= */

/**
 * Main unified content component that combines all three tabs
 * @returns Tabbed interface with capsule tab bar and animated tab content
 */
function UnifiedInspirationContent() {
  const [activeTab, setActiveTab] = React.useState<TabId>("viral")

  return (
    <PageContent>
      {/* Tab Header */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Switch between tabs to discover content to remix into your next post
        </p>
        <CapsuleTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 md:gap-6"
        >
          <ErrorBoundary>
            {activeTab === "viral" && <ViralPostsTab />}
            {activeTab === "discover" && <DiscoverTopicsTab />}
            {activeTab === "swipe" && <SwipeTab />}
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </PageContent>
  )
}

/**
 * Inspiration page component (unified)
 * @description Merges Viral Posts, Discover Topics, and Swipe into a single
 * tabbed interface with animated capsule navigation
 * @returns Unified inspiration page with three content tabs
 */
export default function InspirationPage() {
  usePageMeta({ title: "Inspiration" })
  const { isLoading: authLoading } = useAuthContext()

  return authLoading ? <InspirationSkeleton /> : <UnifiedInspirationContent />
}
