"use client"

/**
 * Team Activity Page
 * @description Team hub with animated tab navigation, top influencers leaderboard,
 * and grid-based post feed with popup detail view
 * @module app/dashboard/team/page
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconActivity,
  IconX,
  IconEye,
  IconThumbUp,
  IconMessageCircle,
  IconShare,
  IconChevronRight,
  IconFilter,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

import { ErrorBoundary } from "@/components/error-boundary"
import { type TeamActivityItem } from "@/components/features/team-activity-feed"
import { RemixPostButton } from "@/components/features/remix-post-button"
import { TeamLeaderboard } from "@/components/features/team-leaderboard"
import { TeamHeader } from "@/components/features/team-header"
import { NoTeamState } from "@/components/features/no-team-state"
import { TeamSkeleton } from "@/components/skeletons/page-skeletons"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTeamPosts } from "@/hooks/use-team-posts"
import { useTeamLeaderboard } from "@/hooks/use-team-leaderboard"
import { useTeam } from "@/hooks/use-team"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import { cn, getInitials, formatMetricNumber } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

// ============================================================================
// Types
// ============================================================================

/** Tab type for team page */
type TeamTab = "overview"

// ============================================================================
// Post Grid with Popup
// ============================================================================

/**
 * Grid card for a single post - professional card with author info,
 * content preview, engagement metrics, and posted date
 * @param props.post - The team activity item to display
 * @param props.onClick - Callback when the card is clicked to open detail popup
 * @param props.index - Card index used for stagger animation delay
 * @param props.isOwnPost - Whether the post belongs to the current user (shows Remix)
 */
function PostGridCard({
  post,
  onClick,
  index = 0,
  isOwnPost = false,
}: {
  post: TeamActivityItem
  onClick: () => void
  index?: number
  isOwnPost?: boolean
}) {
  const relativeTime = formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })
  const snippet = post.content.length > 120
    ? `${post.content.slice(0, 120)}...`
    : post.content
  const imageUrl = post.mediaUrls?.[0] ?? null

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="text-left bg-card rounded-xl border border-border/40 overflow-hidden transition-all hover:shadow-md hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group cursor-pointer flex flex-col h-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -3 }}
    >
      {/* Post image */}
      {imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Post media"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        </div>
      )}

      {/* Author section */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <Avatar className="size-10 shrink-0 ring-1 ring-border/30">
          {post.author.avatar && (
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
          )}
          <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
            {getInitials(post.author.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold leading-tight truncate block">
            {post.author.name}
          </span>
          <p className="text-xs text-muted-foreground truncate leading-snug mt-0.5">
            {post.author.headline}
          </p>
        </div>
      </div>

      {/* Content preview */}
      <div className="px-4 pt-3 pb-3 flex-1">
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
          {snippet}
        </p>
      </div>

      {/* Engagement metrics + date */}
      <div className="px-4 pt-1 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {post.metrics.impressions > 0 && (
            <span className="flex items-center gap-1" title="Impressions">
              <IconEye className="size-3.5" />
              {formatMetricNumber(post.metrics.impressions)}
            </span>
          )}
          {post.metrics.reactions > 0 && (
            <span className="flex items-center gap-1" title="Reactions">
              <IconThumbUp className="size-3.5" />
              {formatMetricNumber(post.metrics.reactions)}
            </span>
          )}
          {post.metrics.comments > 0 && (
            <span className="flex items-center gap-1" title="Comments">
              <IconMessageCircle className="size-3.5" />
              {formatMetricNumber(post.metrics.comments)}
            </span>
          )}
          {post.metrics.reposts > 0 && (
            <span className="flex items-center gap-1" title="Reposts">
              <IconShare className="size-3.5" />
              {formatMetricNumber(post.metrics.reposts)}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/70 shrink-0">
          {relativeTime}
        </span>
      </div>

      {/* Full-width Remix button */}
      <div className="px-4 pb-3">
        <RemixPostButton
          postId={post.id}
          content={post.content}
          authorName={post.author.name}
          className="w-full justify-center h-9 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 text-sm font-medium"
        />
      </div>
    </motion.div>
  )
}

/**
 * Full post detail popup/modal
 * Shows the complete post with all content and metrics
 * @param props.post - The post to display in detail
 * @param props.onClose - Callback to close the popup
 * @param props.isOwnPost - Whether the post belongs to the current user (shows Remix)
 */
function PostDetailPopup({
  post,
  onClose,
  isOwnPost = false,
}: {
  post: TeamActivityItem
  onClose: () => void
  isOwnPost?: boolean
}) {
  const relativeTime = formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })
  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative bg-card rounded-xl border border-border/50 shadow-2xl overflow-hidden max-w-lg w-full max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-background/80 backdrop-blur-sm p-1.5 hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <IconX className="size-4" />
        </button>

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
            <span className="font-semibold text-sm">{post.author.name}</span>
            <p className="text-xs text-muted-foreground truncate">{post.author.headline}</p>
            <p className="text-xs text-muted-foreground">{relativeTime}</p>
          </div>
        </div>

        {/* Full post content */}
        <div className="px-4 pt-3 pb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* Media */}
        {hasMedia && (
          <div>
            {post.mediaUrls!.map((url, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={url}
                alt={`Post media ${i + 1}`}
                className="w-full object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Metrics bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <IconEye className="size-3.5" />
              {formatMetricNumber(post.metrics.impressions)} impressions
            </span>
          </div>
          <div className="flex items-center gap-2">
            {post.metrics.reactions > 0 && (
              <span>{formatMetricNumber(post.metrics.reactions)} reactions</span>
            )}
            {post.metrics.comments > 0 && (
              <span>{formatMetricNumber(post.metrics.comments)} comments</span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center border-t border-border/40 px-2 py-1">
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
            <IconThumbUp className="size-4" />
            React
          </button>
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
            <IconMessageCircle className="size-4" />
            Comment
          </button>
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors">
            <IconShare className="size-4" />
            Repost
          </button>
          <div className="flex-1 flex items-center justify-center">
            <RemixPostButton
              postId={post.id}
              content={post.content}
              authorName={post.author.name}
              className="w-full justify-center py-2.5 rounded-lg text-primary hover:bg-primary/5"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Post grid with popup detail view
 * Displays posts in a responsive 3-column card grid with stagger animations
 * @param props.posts - Array of team activity items to render
 * @param props.isLoading - Whether the data is still loading
 * @param props.className - Additional CSS classes for the container
 * @param props.currentUserId - ID of the logged-in user (to show Remix on own posts)
 * @param props.postUserIds - Map from post ID to the owning user ID
 */
function PostGrid({
  posts,
  isLoading,
  className,
  currentUserId,
  postUserIds,
}: {
  posts: TeamActivityItem[]
  isLoading: boolean
  className?: string
  currentUserId?: string
  postUserIds?: Map<string, string>
}) {
  const [selectedPost, setSelectedPost] = useState<TeamActivityItem | null>(null)

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="flex items-start gap-3 p-4 pb-0">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="px-4 pt-3 pb-3 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="mx-4 border-t border-border/30" />
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex gap-3">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="rounded-full bg-muted/60 p-3 mx-auto w-fit mb-3">
          <IconActivity className="size-5 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-sm mb-1">No recent posts</h3>
        <p className="text-xs text-muted-foreground">
          Posts from team members will appear here
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {posts.map((post, index) => (
          <PostGridCard
            key={post.id}
            post={post}
            index={index}
            onClick={() => setSelectedPost(post)}
            isOwnPost={!!currentUserId && postUserIds?.get(post.id) === currentUserId}
          />
        ))}
      </div>

      {/* Post detail popup */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailPopup
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            isOwnPost={!!currentUserId && postUserIds?.get(selectedPost.id) === currentUserId}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ============================================================================
// Main Team Content
// ============================================================================

/**
 * Team page content component
 * @description Fetches team data and renders appropriate content based on team existence
 */
function TeamContent() {
  const router = useRouter()
  const { user, profile } = useAuthContext()
  const activeTab: TeamTab = "overview"
  const [brandKitLogoUrl, setBrandKitLogoUrl] = useState<string | null>(null)

  const {
    currentTeam,
    currentUserRole,
    isLoadingTeams,
    createTeam,
    refetchTeams,
  } = useTeam()

  const { posts, rawPosts, isLoading: postsLoading } = useTeamPosts(10, currentTeam?.id)

  /** Map from post ID to the owning user ID, for showing Remix on own posts */
  const postUserIds = useMemo(
    () => new Map(rawPosts.map((p) => [p.id, p.user_id])),
    [rawPosts]
  )

  /** Member filter for Recent Team Activity */
  const [activityMemberFilter, setActivityMemberFilter] = useState<string>("all")

  /** Unique authors from posts for the filter dropdown */
  const postAuthors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const post of posts) {
      if (!seen.has(post.author.name)) {
        seen.set(post.author.name, post.author.name)
      }
    }
    return Array.from(seen.values())
  }, [posts])

  /** Posts filtered by selected member */
  const filteredPosts = useMemo(() => {
    if (activityMemberFilter === "all") return posts
    return posts.filter(p => p.author.name === activityMemberFilter)
  }, [posts, activityMemberFilter])
  const {
    members: leaderboardMembers,
    isLoading: leaderboardLoading,
    timeRange,
    setTimeRange,
    currentUserId,
  } = useTeamLeaderboard(currentTeam?.id)

  // Fetch brand kit logo from the active brand kit (saved in onboarding Step 3)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('brand_kits')
      .select('logo_url')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) {
          setBrandKitLogoUrl(data.logo_url)
        }
      })
  }, [user])

  // Handle team creation
  const handleCreateTeam = useCallback(async (name: string) => {
    const result = await createTeam({ name })
    if (result) {
      await refetchTeams()
      return true
    }
    return false
  }, [createTeam, refetchTeams])

  // Handle settings click - navigate to main settings page, team section
  const handleSettingsClick = useCallback(() => {
    router.push(`/dashboard/settings?section=team`)
  }, [router])

  // Loading state
  if (isLoadingTeams) {
    return <TeamSkeleton />
  }

  // No team state
  if (!currentTeam) {
    return (
      <NoTeamState
        onCreateTeam={handleCreateTeam}
        onboardingType={profile?.onboarding_type}
      />
    )
  }

  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Team Header with brand kit logo */}
      <TeamHeader
        team={currentTeam}
        userRole={currentUserRole}
        pendingInvitationsCount={0}
        companyWebsite={profile?.company_website}
        brandKitLogoUrl={brandKitLogoUrl}
        onSettingsClick={handleSettingsClick}
        onInvitationsSent={() => {}}
      />

      {/* Team Overview Content */}
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Top Influencers */}
        <TeamLeaderboard
          members={leaderboardMembers}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          currentUserId={currentUserId || undefined}
          isLoading={leaderboardLoading}
          onMemberClick={(memberId) => {
            router.push(`/dashboard/team/activity?member=${memberId}`)
          }}
        />

        {/* Recent Team Posts Grid */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-base font-semibold">Recent Team Activity</h3>
            {!postsLoading && posts.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={activityMemberFilter} onValueChange={setActivityMemberFilter}>
                  <SelectTrigger className="w-[160px] h-8 rounded-lg text-xs">
                    <IconFilter className="size-3.5 mr-1.5 shrink-0" />
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {postAuthors.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/team/activity" className="gap-1.5">
                    View All Activity
                    <IconChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
          <PostGrid
            posts={filteredPosts}
            isLoading={postsLoading}
            currentUserId={user?.id}
            postUserIds={postUserIds}
          />
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Team page component
 * @returns Team page with animated tabs for overview, members, activity, and settings
 */
export default function TeamPage() {
  usePageMeta({ title: "Team Activity" })

  return (
    <ErrorBoundary>
      <TeamContent />
    </ErrorBoundary>
  )
}
