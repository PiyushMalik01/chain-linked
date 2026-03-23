/**
 * Discover Hook
 * @description Custom hook for managing discover page state, topics, and content
 * with real API integration and infinite scroll support
 * @module hooks/use-discover
 */

import * as React from "react"
import type { DiscoverPost } from "@/types/database"

/**
 * Discover article/content item (kept for backward compatibility with existing card)
 */
export interface DiscoverArticle {
  /** Unique identifier */
  id: string
  /** Source name or publication */
  source: string
  /** Color for source label */
  sourceColor: string
  /** Article/post title or first line */
  title: string
  /** Article description or content excerpt */
  description: string
  /** Optional URL to original content */
  url?: string
  /** Topic slug this article belongs to */
  topic: string
  /** ISO date string of publication */
  publishedAt: string
  /** Author display name */
  authorName?: string
  /** Author headline */
  authorHeadline?: string
  /** Author avatar URL */
  authorAvatarUrl?: string | null
  /** Author profile URL */
  authorProfileUrl?: string | null
  /** Number of likes */
  likesCount?: number
  /** Number of comments */
  commentsCount?: number
  /** Number of reposts */
  repostsCount?: number
  /** Engagement rate percentage */
  engagementRate?: number | null
  /** Whether the post is viral */
  isViral?: boolean
}

/**
 * Topic configuration
 */
export interface Topic {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** URL-safe slug */
  slug: string
  /** Number of posts for this topic */
  postCount?: number
}

/**
 * Sort option for discover feed
 */
export type DiscoverSortOption = "engagement" | "recent" | "viral"

/**
 * Discover state
 */
interface DiscoverState {
  topics: Topic[]
  activeTopic: string
  articles: DiscoverArticle[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  page: number
  hasMore: boolean
  sort: DiscoverSortOption
  searchQuery: string
  /** Whether the user needs to complete first-time topic selection */
  showTopicSelection: boolean
  /** Whether topic preferences are still loading from DB */
  isLoadingTopics: boolean
  /** Counter to force re-fetch without toggling activeTopic */
  fetchKey: number
}

/**
 * Default topics for new users
 */
const DEFAULT_TOPICS: Topic[] = [
  { id: "1", name: "All", slug: "all" },
  { id: "2", name: "AI", slug: "ai" },
  { id: "3", name: "Sales", slug: "sales" },
  { id: "4", name: "Remote Work", slug: "remote-work" },
  { id: "5", name: "SaaS", slug: "saas" },
  { id: "6", name: "Leadership", slug: "leadership" },
]

/**
 * Source colors mapping for visual distinction
 */
const SOURCE_COLORS: Record<string, string> = {
  techcrunch: "#0A9E01",
  quantanite: "#3B82F6",
  "harvard business review": "#C41230",
  saastr: "#6366F1",
  forbes: "#AF0E0E",
  wired: "#000000",
  "mit technology review": "#A31F34",
  "the verge": "#F9405F",
  "fast company": "#000000",
  linkedin: "#0A66C2",
  apify: "#00C7B7",
  manual: "#6B7280",
  import: "#8B5CF6",
}

/**
 * Get color for a source
 * @param source - Source name
 * @returns Hex color code
 */
function getSourceColor(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] || "#6B7280"
}

/**
 * Strip markdown syntax and citation references from a title string.
 * Removes heading prefixes (###), bold markers (**), and citation refs ([1], [Context]).
 * @param text - Raw title text that may contain markdown
 * @returns Plain text suitable for display in a heading element
 */
function stripTitleMarkdown(text: string): string {
  return text
    .replace(/\[(?:\d+|Context)\]/g, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Strip citation references from description text.
 * Removes [1], [2], [Context] etc. that are Perplexity API artifacts.
 * @param text - Raw description text
 * @returns Cleaned description without citation references
 */
function stripDescriptionCitations(text: string): string {
  return text
    .replace(/\[(?:\d+|Context)\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Convert a DiscoverPost from the API to a DiscoverArticle for display
 * @param post - Database discover post
 * @returns DiscoverArticle for rendering
 */
function postToArticle(post: DiscoverPost): DiscoverArticle {
  const firstLine = post.content.split("\n")[0]?.trim() || ""
  const cleanedFirstLine = stripTitleMarkdown(firstLine)
  const title =
    cleanedFirstLine.length > 120
      ? cleanedFirstLine.slice(0, 120) + "..."
      : cleanedFirstLine
  const rawDescription =
    post.content.length > firstLine.length
      ? post.content.slice(firstLine.length).trim()
      : post.content
  const description = stripDescriptionCitations(rawDescription)

  return {
    id: post.id,
    source: post.source,
    sourceColor: getSourceColor(post.source),
    title,
    description,
    url: post.linkedin_url,
    topic: post.topics[0] || "general",
    publishedAt: post.posted_at,
    authorName: post.author_name,
    authorHeadline: post.author_headline,
    authorAvatarUrl: post.author_avatar_url,
    authorProfileUrl: post.author_profile_url,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    repostsCount: post.reposts_count,
    engagementRate: post.engagement_rate,
    isViral: post.is_viral,
  }
}


/**
 * Special display names for topic slugs that are acronyms or have non-standard casing
 */
const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  ai: "AI",
  saas: "SaaS",
  fintech: "FinTech",
}

/**
 * Convert a topic slug to a display name, handling acronyms correctly
 * @param slug - Topic slug (e.g. "ai", "remote-work")
 * @returns Display name (e.g. "AI", "Remote Work")
 */
function slugToDisplayName(slug: string): string {
  if (TOPIC_DISPLAY_NAMES[slug]) return TOPIC_DISPLAY_NAMES[slug]
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Items per page for pagination
 */
const PAGE_SIZE = 12

/**
 * Local storage key for user topics
 */
const TOPICS_STORAGE_KEY = "chainlinked_discover_topics"

/**
 * Fetch discover posts from the API
 * @param topic - Topic slug to filter by
 * @param page - Page number (1-based)
 * @param sort - Sort option
 * @param search - Search query
 * @returns API response with posts and pagination
 */
async function fetchDiscoverPosts(
  topic: string,
  page: number,
  sort: DiscoverSortOption,
  search: string
): Promise<{
  posts: DiscoverPost[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
  fallback: boolean
}> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: PAGE_SIZE.toString(),
    sort,
  })

  if (topic && topic !== "all") {
    params.set("topic", topic)
  }

  if (search) {
    params.set("search", search)
  }

  const response = await fetch(`/api/discover/posts?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Custom hook for managing discover page state with real API integration
 * @returns Discover state and actions including infinite scroll support
 */
export function useDiscover() {
  const [state, setState] = React.useState<DiscoverState>({
    topics: [],
    activeTopic: "",
    articles: [],
    isLoading: true,
    isLoadingMore: false,
    error: null,
    page: 1,
    hasMore: false,
    sort: "engagement",
    searchQuery: "",
    showTopicSelection: false,
    isLoadingTopics: true,
    fetchKey: 0,
  })

  /**
   * Load topics from DB (via API), fallback to localStorage
   */
  React.useEffect(() => {
    const loadTopics = async () => {
      try {
        // Try loading from DB first
        const response = await fetch("/api/discover/topics")
        if (response.ok) {
          const data = await response.json()

          if (!data.selected) {
            // User hasn't selected topics yet - show overlay
            setState((prev) => ({
              ...prev,
              topics: DEFAULT_TOPICS,
              activeTopic: DEFAULT_TOPICS[0].slug,
              showTopicSelection: true,
              isLoadingTopics: false,
              isLoading: true,
            }))
            return
          }

          // Build topics from DB selection
          const dbSlugs: string[] = data.topics || []
          const dbTopics: Topic[] = [
            { id: "all", name: "All", slug: "all" },
            ...dbSlugs.map((slug: string, i: number) => ({
              id: `db-${i}`,
              name: slugToDisplayName(slug),
              slug,
            })),
          ]

          // Cache in localStorage
          localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(dbTopics))

          setState((prev) => ({
            ...prev,
            topics: dbTopics,
            activeTopic: dbTopics[0]?.slug || "all",
            showTopicSelection: false,
            isLoadingTopics: false,
            isLoading: true,
          }))
          return
        }
      } catch {
        // API failed, fallback to localStorage
      }

      // Fallback: load from localStorage
      try {
        const stored = localStorage.getItem(TOPICS_STORAGE_KEY)
        const storedTopics: Topic[] = stored ? JSON.parse(stored) : []

        const hasAll = storedTopics.some((t) => t.slug === "all")
        const topics = hasAll
          ? storedTopics
          : storedTopics.length > 0
            ? [{ id: "all", name: "All", slug: "all" }, ...storedTopics]
            : DEFAULT_TOPICS

        const activeTopic = topics[0]?.slug || "all"

        setState((prev) => ({
          ...prev,
          topics,
          activeTopic,
          isLoadingTopics: false,
          isLoading: true,
        }))
      } catch {
        setState((prev) => ({
          ...prev,
          topics: DEFAULT_TOPICS,
          activeTopic: DEFAULT_TOPICS[0].slug,
          isLoadingTopics: false,
          isLoading: true,
        }))
      }
    }

    loadTopics()
  }, [])

  /**
   * Load articles when active topic, sort, or search changes
   */
  React.useEffect(() => {
    if (!state.activeTopic) return

    let cancelled = false

    const loadArticles = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        page: 1,
        articles: [],
      }))

      try {
        const result = await fetchDiscoverPosts(
          state.activeTopic,
          1,
          state.sort,
          state.searchQuery
        )

        if (cancelled) return

        if (result.fallback || result.posts.length === 0) {
          // No data available - show empty state
          setState((prev) => ({
            ...prev,
            articles: [],
            isLoading: false,
            page: 1,
            hasMore: false,
          }))
        } else {
          const articles = result.posts.map(postToArticle)
          setState((prev) => ({
            ...prev,
            articles,
            isLoading: false,
            page: 1,
            hasMore: result.pagination.hasMore,
          }))
        }
      } catch {
        if (cancelled) return

        setState((prev) => ({
          ...prev,
          articles: [],
          error: "Failed to load articles. Please try again.",
          isLoading: false,
        }))
      }
    }

    loadArticles()

    return () => {
      cancelled = true
    }
  }, [state.activeTopic, state.sort, state.searchQuery, state.fetchKey])

  /**
   * Load more articles for infinite scroll
   */
  const loadMore = React.useCallback(async () => {
    if (state.isLoadingMore || !state.hasMore) return

    setState((prev) => ({ ...prev, isLoadingMore: true }))

    try {
      const nextPage = state.page + 1
      const result = await fetchDiscoverPosts(
        state.activeTopic,
        nextPage,
        state.sort,
        state.searchQuery
      )

      const newArticles = result.posts.map(postToArticle)

      setState((prev) => ({
        ...prev,
        articles: [...prev.articles, ...newArticles],
        isLoadingMore: false,
        page: nextPage,
        hasMore: result.pagination.hasMore,
      }))
    } catch {
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
      }))
    }
  }, [state.isLoadingMore, state.hasMore, state.page, state.activeTopic, state.sort, state.searchQuery])

  /**
   * Set the active topic
   * @param topicSlug - Topic slug to activate
   */
  const setActiveTopic = React.useCallback((topicSlug: string) => {
    setState((prev) => ({
      ...prev,
      activeTopic: topicSlug,
      page: 1,
      hasMore: false,
    }))
  }, [])

  /**
   * Set the sort option
   * @param sort - Sort option to apply
   */
  const setSort = React.useCallback((sort: DiscoverSortOption) => {
    setState((prev) => ({
      ...prev,
      sort,
      page: 1,
      hasMore: false,
    }))
  }, [])

  /**
   * Set the search query
   * @param query - Search query string
   */
  const setSearchQuery = React.useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      searchQuery: query,
      page: 1,
      hasMore: false,
    }))
  }, [])

  /**
   * Add a new topic
   * @param name - Topic name
   */
  const addTopic = React.useCallback((name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    const id = `topic-${Date.now()}`

    setState((prev) => {
      if (prev.topics.some((t) => t.slug === slug)) {
        return prev
      }

      const newTopics = [...prev.topics, { id, name, slug }]
      localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(newTopics))
      return { ...prev, topics: newTopics }
    })
  }, [])

  /**
   * Remove a topic
   * @param topicId - Topic ID to remove
   */
  const removeTopic = React.useCallback((topicId: string) => {
    setState((prev) => {
      // Don't allow removing the "All" topic
      const topicToRemove = prev.topics.find((t) => t.id === topicId)
      if (topicToRemove?.slug === "all") return prev

      const newTopics = prev.topics.filter((t) => t.id !== topicId)
      if (newTopics.length === 0) return prev

      localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(newTopics))

      const newActiveTopic =
        topicToRemove?.slug === prev.activeTopic
          ? newTopics[0].slug
          : prev.activeTopic

      return { ...prev, topics: newTopics, activeTopic: newActiveTopic }
    })
  }, [])

  /**
   * Update topics order/list
   * @param topics - New topics array
   */
  const updateTopics = React.useCallback((topics: Topic[]) => {
    localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(topics))
    setState((prev) => ({ ...prev, topics }))
  }, [])

  /**
   * Complete first-time topic selection
   * Updates local state with new topics, hides overlay, and triggers feed load
   * @param slugs - Selected topic slugs from the overlay
   */
  const completeTopicSelection = React.useCallback((slugs: string[]) => {
    const newTopics: Topic[] = [
      { id: "all", name: "All", slug: "all" },
      ...slugs.map((slug, i) => ({
        id: `db-${i}`,
        name: slugToDisplayName(slug),
        slug,
      })),
    ]

    // Cache in localStorage
    localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(newTopics))

    setState((prev) => ({
      ...prev,
      topics: newTopics,
      activeTopic: newTopics[0]?.slug || "all",
      showTopicSelection: false,
      isLoadingTopics: false,
      isLoading: true,
    }))
  }, [])

  /**
   * Retry loading articles by incrementing fetchKey
   */
  const retry = React.useCallback(() => {
    setState((prev) => ({ ...prev, error: null, fetchKey: prev.fetchKey + 1 }))
  }, [])

  /**
   * Refresh the current feed by incrementing fetchKey
   */
  const refresh = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      page: 1,
      hasMore: false,
      error: null,
      fetchKey: prev.fetchKey + 1,
    }))
  }, [])

  return {
    ...state,
    setActiveTopic,
    setSort,
    setSearchQuery,
    addTopic,
    removeTopic,
    updateTopics,
    completeTopicSelection,
    retry,
    refresh,
    loadMore,
  }
}
