/**
 * Discover News Hook
 * @description Custom hook for managing discover news page state, topics, and
 * Perplexity-sourced news articles with infinite scroll support
 * @module hooks/use-discover-news
 */

import * as React from "react"
import { toast } from "sonner"
import type { DiscoverNewsArticle } from "@/types/database"

/**
 * Frontend news article type (camelCase)
 */
export interface NewsArticle {
  /** Unique identifier */
  id: string
  /** Catchy headline */
  headline: string
  /** 2-3 sentence summary */
  summary: string
  /** URL to original source */
  sourceUrl: string
  /** Publication/source name */
  sourceName: string
  /** When the article was published */
  publishedDate: string | null
  /** Relevance tags */
  relevanceTags: string[]
  /** Topic slug */
  topic: string
  /** Content freshness */
  freshness: string
  /** When ingested */
  createdAt: string
  /** Perplexity citation URLs for this article */
  perplexityCitations: string[]
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
  /** Number of articles for this topic */
  postCount?: number
}

/**
 * Sort option for news feed
 */
export type NewsSortOption = "recent" | "relevance"

/**
 * Discover news state
 */
interface DiscoverNewsState {
  topics: Topic[]
  activeTopic: string
  articles: NewsArticle[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  page: number
  hasMore: boolean
  sort: NewsSortOption
  searchQuery: string
  showTopicSelection: boolean
  isLoadingTopics: boolean
  /** Whether a background seed/ingest is in progress */
  isSeeding: boolean
  /** Whether seeding has already been attempted this session */
  seedAttempted: boolean
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
 * Special display names for topic slugs
 */
const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  ai: "AI",
  saas: "SaaS",
  fintech: "FinTech",
}

/**
 * Convert a topic slug to a display name
 * @param slug - Topic slug
 * @returns Display name
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
 * Local storage key for seed attempt timestamp
 */
const SEED_ATTEMPTED_KEY = "chainlinked_seed_attempted"

/**
 * Cooldown period before allowing another auto-seed (1 hour)
 */
const SEED_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

/**
 * Convert a DB news article to frontend type
 * @param article - Database news article
 * @returns Frontend NewsArticle
 */
function dbToNewsArticle(article: DiscoverNewsArticle): NewsArticle {
  return {
    id: article.id,
    headline: article.headline,
    summary: article.summary,
    sourceUrl: article.source_url,
    sourceName: article.source_name,
    publishedDate: article.published_date,
    relevanceTags: article.relevance_tags,
    topic: article.topic,
    freshness: article.freshness,
    createdAt: article.created_at,
    perplexityCitations: article.perplexity_citations || [],
  }
}

/**
 * Fetch news articles from the API
 * @param topic - Topic slug to filter by
 * @param page - Page number (1-based)
 * @param sort - Sort option
 * @param search - Search query
 * @returns API response with articles and pagination
 */
async function fetchNewsArticles(
  topic: string,
  page: number,
  sort: NewsSortOption,
  search: string
): Promise<{
  articles: DiscoverNewsArticle[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
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

  const response = await fetch(`/api/discover/news?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Custom hook for managing discover news page state
 * @returns Discover news state and actions including infinite scroll support
 */
export function useDiscoverNews() {
  const [state, setState] = React.useState<DiscoverNewsState>({
    topics: [],
    activeTopic: "",
    articles: [],
    isLoading: true,
    isLoadingMore: false,
    error: null,
    page: 1,
    hasMore: false,
    sort: "recent",
    searchQuery: "",
    showTopicSelection: false,
    isLoadingTopics: true,
    isSeeding: false,
    seedAttempted: (() => {
      if (typeof window === 'undefined') return false
      try {
        const last = localStorage.getItem(SEED_ATTEMPTED_KEY)
        if (last) {
          return Date.now() - parseInt(last, 10) < SEED_COOLDOWN_MS
        }
      } catch {}
      return false
    })(),
    fetchKey: 0,
  })

  /**
   * Ref to track whether topics have been modified by user actions
   * (as opposed to being loaded from the DB on mount)
   */
  const topicsDirty = React.useRef(false)

  /**
   * Persist topics to database whenever they are modified by user actions
   */
  React.useEffect(() => {
    if (!topicsDirty.current) return
    if (state.isLoadingTopics) return

    const slugs = state.topics.map((t) => t.slug).filter((s) => s !== "all")
    if (slugs.length < 1) return

    topicsDirty.current = false

    fetch("/api/discover/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: slugs }),
    }).catch((err) => {
      console.warn("[DiscoverNews] Error persisting topics:", err)
    })
  }, [state.topics, state.isLoadingTopics])

  /**
   * Load topics from DB (via API), fallback to localStorage
   */
  React.useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch("/api/discover/topics")
        if (response.ok) {
          const data = await response.json()

          if (!data.selected) {
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

          const dbSlugs: string[] = data.topics || []
          const dbTopics: Topic[] = [
            { id: "all", name: "All", slug: "all" },
            ...dbSlugs.map((slug: string, i: number) => ({
              id: `db-${i}`,
              name: slugToDisplayName(slug),
              slug,
            })),
          ]

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
        const result = await fetchNewsArticles(
          state.activeTopic,
          1,
          state.sort,
          state.searchQuery
        )

        if (cancelled) return

        const articles = result.articles.map(dbToNewsArticle)
        setState((prev) => ({
          ...prev,
          articles,
          isLoading: false,
          page: 1,
          hasMore: result.pagination.hasMore,
        }))
      } catch {
        if (cancelled) return

        setState((prev) => ({
          ...prev,
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
   * Auto-seed: when articles load as empty (not from a search), call the
   * seed endpoint which runs the Perplexity ingest pipeline directly and
   * returns the result. Then re-fetch articles to display them.
   */
  React.useEffect(() => {
    if (
      state.isLoading ||
      state.isLoadingTopics ||
      state.articles.length > 0 ||
      state.searchQuery.length > 0 ||
      state.isSeeding ||
      state.seedAttempted ||
      state.error ||
      state.topics.length === 0
    ) {
      return
    }

    const topicSlugs = state.topics
      .map((t) => t.slug)
      .filter((s) => s !== "all")

    if (topicSlugs.length === 0) return

    let cancelled = false

    const triggerSeed = async () => {
      setState((prev) => ({ ...prev, isSeeding: true, seedAttempted: true }))

      try {
        localStorage.setItem(SEED_ATTEMPTED_KEY, Date.now().toString())
      } catch {}

      try {
        const response = await fetch("/api/discover/news/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: topicSlugs }),
        })

        if (cancelled) return

        if (!response.ok) {
          console.warn("[DiscoverNews] Seed request failed:", response.status)
          setState((prev) => ({ ...prev, isSeeding: false }))
          return
        }

        const data = await response.json()
        console.log("[DiscoverNews] Seed result:", data)

        if (data.reason === "no_api_key") {
          // No Perplexity key configured — stop immediately
          if (!cancelled) {
            setState((prev) => ({ ...prev, isSeeding: false }))
          }
          return
        }

        if (data.reason === "triggered") {
          // Inngest async path — poll for articles every 3s (up to 30s)
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 3000))
            if (cancelled) return

            const result = await fetchNewsArticles(state.activeTopic, 1, state.sort, "")
            if (cancelled) return

            if (result.articles.length > 0) {
              const articles = result.articles.map(dbToNewsArticle)
              setState((prev) => ({
                ...prev,
                articles,
                isSeeding: false,
                page: 1,
                hasMore: result.pagination.hasMore,
              }))
              return
            }
          }
          // Polling timed out — articles may still arrive later
          if (!cancelled) {
            setState((prev) => ({ ...prev, isSeeding: false }))
          }
          return
        }

        if (data.seeded && data.articlesIngested > 0) {
          // Fallback sync path — articles were inserted directly
          const result = await fetchNewsArticles(
            state.activeTopic,
            1,
            state.sort,
            ""
          )

          if (cancelled) return

          const articles = result.articles.map(dbToNewsArticle)
          setState((prev) => ({
            ...prev,
            articles,
            isSeeding: false,
            page: 1,
            hasMore: result.pagination.hasMore,
          }))
        } else {
          if (!cancelled) {
            setState((prev) => ({ ...prev, isSeeding: false }))
          }
        }
      } catch (error) {
        console.error("[DiscoverNews] Auto-seed error:", error)
        if (!cancelled) {
          setState((prev) => ({ ...prev, isSeeding: false }))
        }
      }
    }

    triggerSeed()

    return () => {
      cancelled = true
    }
  }, [
    state.isLoading,
    state.isLoadingTopics,
    state.articles.length,
    state.searchQuery,
    state.isSeeding,
    state.seedAttempted,
    state.error,
    state.topics,
    state.activeTopic,
    state.sort,
  ])

  /**
   * Load more articles for infinite scroll
   */
  const loadMore = React.useCallback(async () => {
    if (state.isLoadingMore || !state.hasMore) return

    setState((prev) => ({ ...prev, isLoadingMore: true }))

    try {
      const nextPage = state.page + 1
      const result = await fetchNewsArticles(
        state.activeTopic,
        nextPage,
        state.sort,
        state.searchQuery
      )

      const newArticles = result.articles.map(dbToNewsArticle)

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
  const setSort = React.useCallback((sort: NewsSortOption) => {
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

    topicsDirty.current = true
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
    topicsDirty.current = true
    setState((prev) => {
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
    topicsDirty.current = true
    setState((prev) => ({ ...prev, topics }))
  }, [])

  /**
   * Complete first-time topic selection
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

    localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(newTopics))
    topicsDirty.current = true

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
   * Fetch new articles from Perplexity on demand (force bypasses duplicate check)
   */
  const fetchNewArticles = React.useCallback(async () => {
    const topicSlugs = state.topics
      .map((t) => t.slug)
      .filter((s) => s !== "all")

    if (topicSlugs.length === 0) return

    setState((prev) => ({ ...prev, isSeeding: true }))

    try {
      const response = await fetch("/api/discover/news/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicSlugs, force: true }),
      })

      if (!response.ok) {
        toast.error("Failed to fetch new articles")
        setState((prev) => ({ ...prev, isSeeding: false }))
        return
      }

      const data = await response.json()

      if (data.reason === "no_api_key") {
        toast.warning("Perplexity API key not configured")
        setState((prev) => ({ ...prev, isSeeding: false }))
        return
      }

      if (data.reason === "triggered") {
        // Inngest async path — poll for new articles every 3s (up to 30s)
        toast.info("Fetching new articles...")
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise((r) => setTimeout(r, 3000))

          const result = await fetchNewsArticles(state.activeTopic, 1, state.sort, "")
          if (result.articles.length > 0) {
            toast.success("New articles loaded")
            const articles = result.articles.map(dbToNewsArticle)
            setState((prev) => ({
              ...prev,
              articles,
              isSeeding: false,
              page: 1,
              hasMore: result.pagination.hasMore,
              searchQuery: "",
            }))
            return
          }
        }
        toast.info("Articles are being fetched. Check back in a moment.")
        setState((prev) => ({ ...prev, isSeeding: false }))
        return
      }

      // Fallback sync path
      if (data.articlesIngested > 0) {
        toast.success(`Fetched ${data.articlesIngested} new articles`)
      } else {
        toast.info("No new articles found for your topics")
      }

      // Re-fetch the feed to show new articles
      const result = await fetchNewsArticles(
        state.activeTopic,
        1,
        state.sort,
        ""
      )
      const articles = result.articles.map(dbToNewsArticle)
      setState((prev) => ({
        ...prev,
        articles,
        isSeeding: false,
        page: 1,
        hasMore: result.pagination.hasMore,
        searchQuery: "",
      }))
    } catch {
      toast.error("Failed to fetch new articles")
      setState((prev) => ({ ...prev, isSeeding: false }))
    }
  }, [state.topics, state.activeTopic, state.sort])

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
    fetchNewArticles,
    loadMore,
  }
}
