"use client"

/**
 * Full Team Activity Page
 * @description Comprehensive view of all team posts with filtering, search,
 * sorting, and remix capabilities
 * @module app/dashboard/team/activity/page
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconArrowLeft,
  IconSearch,
  IconFilter,
  IconSortDescending,
  IconActivity,
  IconX,
  IconEye,
  IconThumbUp,
  IconMessageCircle,
  IconShare,
  IconSparkles,
  IconPhoto,
  IconVideo,
  IconArticle,
  IconChartPie,
  IconUsers,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

import { Suspense } from "react"
import { ErrorBoundary } from "@/components/error-boundary"
import { type TeamActivityItem } from "@/components/features/team-activity-feed"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { usePageMeta } from "@/lib/dashboard-context"
import { cn, getInitials, formatMetricNumber } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

/** Filter options for post types */
type PostTypeFilter = "all" | "text" | "image" | "video" | "article" | "poll"

/** Sort options */
type SortOption = "recent" | "engagement" | "impressions"

/** Author info for filtering */
interface TeamAuthor {
  id: string
  name: string
  avatar: string | null
}

// ============================================================================
// Hook: All Team Posts (no time limit)
// ============================================================================

/**
 * Hook to fetch ALL team posts without a rolling time window
 * @param limit - Maximum posts to fetch
 * @returns Posts, authors, and loading state
 */
function useAllTeamPosts(limit: number = 100) {
  const { user, isLoading: authLoading } = useAuthContext()
  const [posts, setPosts] = useState<TeamActivityItem[]>([])
  const [authors, setAuthors] = useState<TeamAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPosts = useCallback(async () => {
    if (authLoading) return
    if (!user) {
      setPosts([])
      setAuthors([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get user's team membership
      let teamMemberIds: string[] = [user.id]

      try {
        const { data: teamMembership, error: teamError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!teamError && teamMembership?.team_id) {
          const { data: teamMembersData } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', teamMembership.team_id)

          if (teamMembersData && teamMembersData.length > 0) {
            teamMemberIds = teamMembersData.map(m => m.user_id)
          }
        }
      } catch {
        // Continue with solo user
      }

      // Fetch profile info
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, linkedin_avatar_url')
        .in('id', teamMemberIds)

      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      )

      // Fetch LinkedIn headlines
      const { data: linkedinProfiles } = await supabase
        .from('linkedin_profiles')
        .select('user_id, headline')
        .in('user_id', teamMemberIds)

      const headlineMap = new Map(
        (linkedinProfiles || []).map(p => [p.user_id, p.headline])
      )

      // Build authors list for filter dropdown
      const authorsList: TeamAuthor[] = (profilesData || []).map(p => ({
        id: p.id,
        name: p.full_name || p.email?.split('@')[0] || 'Unknown',
        avatar: p.linkedin_avatar_url || p.avatar_url || null,
      }))
      setAuthors(authorsList)

      // Fetch ALL posts (no date restriction)
      const { data: postsData, error: fetchError } = await supabase
        .from('my_posts')
        .select('*')
        .in('user_id', teamMemberIds)
        .not('content', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(limit)

      if (fetchError) {
        console.warn('Team posts fetch warning:', fetchError.message)
        setPosts([])
        setIsLoading(false)
        return
      }

      if (!postsData || postsData.length === 0) {
        setPosts([])
        setIsLoading(false)
        return
      }

      // Transform to TeamActivityItem format
      const transformedPosts: TeamActivityItem[] = postsData.map((post) => {
        const profile = profileMap.get(post.user_id)
        const headline = headlineMap.get(post.user_id)

        const mediaType = post.media_type?.toLowerCase() || null
        let postType: TeamActivityItem['postType'] = 'text'
        if (mediaType?.includes('image')) postType = 'image'
        else if (mediaType?.includes('video')) postType = 'video'
        else if (mediaType?.includes('article')) postType = 'article'
        else if (mediaType?.includes('poll')) postType = 'poll'

        return {
          id: post.id,
          author: {
            name: profile?.full_name || profile?.email?.split('@')[0] || 'Unknown User',
            headline: headline || profile?.email || '',
            avatar: profile?.linkedin_avatar_url || profile?.avatar_url || null,
          },
          content: post.content || '',
          metrics: {
            impressions: post.impressions || 0,
            reactions: post.reactions || 0,
            comments: post.comments || 0,
            reposts: post.reposts || 0,
          },
          postedAt: post.posted_at || post.created_at || new Date().toISOString(),
          postType,
          mediaUrls: post.media_urls || null,
          // Store user_id for filtering
          ...({ userId: post.user_id } as Record<string, string>),
        }
      })

      setPosts(transformedPosts)
    } catch (err) {
      console.error('Team posts fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch posts')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, limit, user, authLoading])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return {
    posts,
    authors,
    isLoading: authLoading || isLoading,
    error,
    refetch: fetchPosts,
  }
}

// ============================================================================
// Post Type Icon
// ============================================================================

/**
 * Get icon for a post type
 * @param type - The post type
 * @returns Icon component or null
 */
function PostTypeIcon({ type }: { type?: TeamActivityItem['postType'] }) {
  switch (type) {
    case 'image': return <IconPhoto className="size-3" />
    case 'video': return <IconVideo className="size-3" />
    case 'article': return <IconArticle className="size-3" />
    case 'poll': return <IconChartPie className="size-3" />
    default: return null
  }
}

// ============================================================================
// Post Grid Card
// ============================================================================

/**
 * Grid card for a single post with author info, content preview, and metrics
 * @param props.post - The team activity item to display
 * @param props.onClick - Callback when clicked to open detail popup
 * @param props.onRemix - Callback to remix this post
 * @param props.index - Card index for stagger animation
 */
function PostGridCard({
  post,
  onClick,
  onRemix,
  index = 0,
}: {
  post: TeamActivityItem
  onClick: () => void
  onRemix: () => void
  index?: number
}) {
  const relativeTime = formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })
  const snippet = post.content.length > 120
    ? `${post.content.slice(0, 120)}...`
    : post.content
  const imageUrl = post.mediaUrls?.[0] ?? null

  return (
    <motion.div
      className="text-left bg-card rounded-xl border border-border/40 overflow-hidden transition-all hover:shadow-md hover:border-border group"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.4),
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Clickable card body */}
      <button type="button" onClick={onClick} className="w-full text-left focus-visible:outline-none">
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
            {post.postType && post.postType !== 'text' && (
              <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 py-0 gap-1">
                <PostTypeIcon type={post.postType} />
                {post.postType}
              </Badge>
            )}
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
        <div className="px-4 pt-3 pb-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
            {snippet}
          </p>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border/30" />

        {/* Engagement metrics + date */}
        <div className="px-4 py-3 flex items-center justify-between">
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
          </div>
          <span className="text-[11px] text-muted-foreground/70 shrink-0">
            {relativeTime}
          </span>
        </div>
      </button>

      {/* Remix action bar */}
      <div className="border-t border-border/30 px-2 py-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemix() }}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <IconSparkles className="size-3.5" />
          Remix as New Post
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Post Detail Popup
// ============================================================================

/**
 * Full post detail modal with complete content and remix action
 */
function PostDetailPopup({
  post,
  onClose,
  onRemix,
}: {
  post: TeamActivityItem
  onClose: () => void
  onRemix: () => void
}) {
  const relativeTime = formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })
  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative bg-card rounded-xl border border-border/50 shadow-2xl overflow-hidden max-w-lg w-full max-h-[85vh] flex flex-col"
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

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-contain flex-1">
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
        </div>

        {/* Action bar (sticky bottom) */}
        <div className="flex items-center border-t border-border/40 px-2 py-1 shrink-0">
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
          <button
            type="button"
            onClick={onRemix}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <IconSparkles className="size-4" />
            Remix
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// Main Content
// ============================================================================

/**
 * Team Activity content with filters, search, and grid
 */
function TeamActivityContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthContext()
  const { posts, authors, isLoading, error } = useAllTeamPosts(200)

  // Brand kit logo + team name
  const [brandKitLogoUrl, setBrandKitLogoUrl] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [teamMemberCount, setTeamMemberCount] = useState<number>(0)

  // Fetch brand kit logo and team info
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    // Fetch brand kit logo
    supabase
      .from('brand_kits')
      .select('logo_url')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setBrandKitLogoUrl(data.logo_url)
      })

    // Fetch team info
    supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data: membership }) => {
        if (!membership?.team_id) return
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', membership.team_id)
          .single()
        if (team?.name) setTeamName(team.name)
        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', membership.team_id)
        setTeamMemberCount(count || 0)
      })
  }, [user])

  // Pre-populate author filter from URL query param
  const initialMember = searchParams.get("member") || "all"

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("")
  const [authorFilter, setAuthorFilter] = useState<string>(initialMember)
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [selectedPost, setSelectedPost] = useState<TeamActivityItem | null>(null)

  /** Navigate to compose with remixed content */
  const handleRemix = useCallback((post: TeamActivityItem) => {
    const remixContent = post.content
    router.push(`/dashboard/compose?remix=${encodeURIComponent(remixContent)}`)
  }, [router])

  /** Filter and sort posts */
  const filteredPosts = useMemo(() => {
    let result = posts

    // Filter by author
    if (authorFilter !== "all") {
      result = result.filter(p =>
        (p as TeamActivityItem & { userId?: string }).userId === authorFilter
        || p.author.name === authorFilter
      )
    }

    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter(p => p.postType === typeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "engagement": {
          const engA = a.metrics.reactions + a.metrics.comments + a.metrics.reposts
          const engB = b.metrics.reactions + b.metrics.comments + b.metrics.reposts
          return engB - engA
        }
        case "impressions":
          return b.metrics.impressions - a.metrics.impressions
        case "recent":
        default:
          return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      }
    })

    return result
  }, [posts, authorFilter, typeFilter, searchQuery, sortBy])

  /** Count posts by type for filter badges */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length }
    posts.forEach(p => {
      const type = p.postType || 'text'
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [posts])

  /** Clear all filters */
  const clearFilters = useCallback(() => {
    setSearchQuery("")
    setAuthorFilter("all")
    setTypeFilter("all")
    setSortBy("recent")
  }, [])

  const hasActiveFilters = searchQuery || authorFilter !== "all" || typeFilter !== "all"

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm max-w-5xl mx-auto overflow-hidden">
          {/* Gradient strip + content row */}
          <div className="flex items-stretch">
            {/* Left gradient accent strip */}
            <div className="w-1.5 shrink-0 bg-gradient-to-b from-primary via-primary/80 to-secondary/60" />

            {/* Content */}
            <div className="flex-1 flex items-center gap-4 px-5 py-4">
              {/* Back button */}
              <Button variant="outline" size="icon" asChild className="shrink-0 rounded-xl h-9 w-9">
                <Link href="/dashboard/team">
                  <IconArrowLeft className="size-4" />
                </Link>
              </Button>

              {/* Logo */}
              {brandKitLogoUrl ? (
                <div className="h-12 w-12 rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandKitLogoUrl}
                    alt={teamName || "Team"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm overflow-hidden shrink-0 flex items-center justify-center">
                  <IconActivity className="size-5 text-primary" />
                </div>
              )}

              {/* Text */}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold tracking-tight truncate">
                  {teamName ? `${teamName} Activity` : "All Team Activity"}
                </h1>
                <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <IconActivity className="size-3" />
                    {posts.length} post{posts.length !== 1 ? 's' : ''}
                  </span>
                  {teamMemberCount > 0 && (
                    <>
                      <span className="text-border text-xs">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <IconUsers className="size-3" />
                        {teamMemberCount} member{teamMemberCount !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {authors.length > 0 && (
                    <>
                      <span className="text-border text-xs">·</span>
                      <span className="text-xs text-muted-foreground">
                        {authors.length} contributor{authors.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar - floating card */}
      <div className="px-4 md:px-6 pt-4 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
          {/* Search + Sort row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search posts by content or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Author filter */}
              <Select value={authorFilter} onValueChange={setAuthorFilter}>
                <SelectTrigger className="w-[160px] h-9 rounded-lg">
                  <IconFilter className="size-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {authors.map(author => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[150px] h-9 rounded-lg">
                  <IconSortDescending className="size-3.5 mr-1.5 shrink-0" />
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

          {/* Post type filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "text", "image", "video", "article", "poll"] as const).map(type => {
              const count = typeCounts[type] || 0
              if (type !== "all" && count === 0) return null
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    typeFilter === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                  )}
                >
                  {type === "all" ? "All" : (
                    <>
                      <PostTypeIcon type={type as TeamActivityItem['postType']} />
                      <span className="capitalize">{type}</span>
                    </>
                  )}
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              )
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <IconX className="size-3" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/40 overflow-hidden">
                <Skeleton className="aspect-[16/9] w-full" />
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
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <div className="rounded-full bg-muted/60 p-3 mx-auto w-fit mb-3">
              <IconActivity className="size-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">
              {hasActiveFilters ? "No posts match your filters" : "No team posts yet"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {hasActiveFilters
                ? "Try adjusting your filters to see more posts"
                : "Posts from team members will appear here"
              }
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post, index) => (
              <PostGridCard
                key={post.id}
                post={post}
                index={index}
                onClick={() => setSelectedPost(post)}
                onRemix={() => handleRemix(post)}
              />
            ))}
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredPosts.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            Showing {filteredPosts.length} of {posts.length} post{posts.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Post detail popup */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailPopup
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onRemix={() => {
              handleRemix(selectedPost)
              setSelectedPost(null)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// Page Export
// ============================================================================

/**
 * Full team activity page
 * @returns Team activity page with search, filters, and post grid
 */
export default function TeamActivityPage() {
  usePageMeta({ title: "All Team Activity" })

  return (
    <ErrorBoundary>
      <Suspense>
        <TeamActivityContent />
      </Suspense>
    </ErrorBoundary>
  )
}
