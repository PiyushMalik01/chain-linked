/**
 * Smart Inspiration Search API
 * @description AI-powered search that understands intent, maps to clusters/tags,
 * and returns ranked results from discover_posts and influencer_posts.
 * @module app/api/inspiration/search
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { createOpenAIClient, chatCompletion } from "@/lib/ai/openai-client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/** The 8 fixed clusters used for content categorization */
const CLUSTERS = [
  "AI",
  "Marketing",
  "Sales",
  "Leadership",
  "Startup",
  "Product",
  "Growth",
  "Engineering",
] as const

/**
 * Parsed search intent from the LLM analysis
 */
interface SearchIntent {
  /** Alternative search phrases/keywords derived from the query */
  searchTerms: string[]
  /** Matching cluster categories from the fixed set */
  clusters: string[]
  /** Lowercase-hyphenated tags that match post topics */
  tags: string[]
  /** One-sentence description of the user's search intent */
  intent: string
}

/**
 * Normalized search result post format
 */
interface SearchResultPost {
  /** Unique post identifier */
  id: string
  /** Author information */
  author: {
    name: string
    headline: string | null
    avatar: string | null
  }
  /** Post text content */
  content: string
  /** Category derived from primary_cluster or topics */
  category: string | null
  /** Post tags */
  tags: string[]
  /** Primary cluster classification */
  primaryCluster: string | null
  /** Engagement metrics */
  metrics: {
    likes: number
    comments: number
    reposts: number
    impressions: number | null
    engagementRate: number | null
  }
  /** When the post was published */
  postedAt: string | null
  /** Origin table: 'discover' or 'following' */
  source: "discover" | "following"
  /** Computed relevance score for ranking */
  relevanceScore: number
  /** LinkedIn URL if available */
  linkedinUrl: string | null
}

/**
 * Query result with posts and total count
 */
interface QueryResult {
  /** Matched posts */
  posts: SearchResultPost[]
  /** Total number of matching rows (before pagination) */
  totalCount: number
}

/**
 * Uses LLM to understand search intent and generate search parameters
 * @param query - The raw user search query
 * @returns Parsed search intent with terms, clusters, tags, and intent description
 */
async function analyzeSearchIntent(query: string): Promise<SearchIntent> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Fallback: simple keyword extraction when no API key is available
    return {
      searchTerms: [query],
      clusters: [],
      tags: [],
      intent: query,
    }
  }

  const client = createOpenAIClient({ apiKey, timeout: 15000 })

  try {
    const response = await chatCompletion(client, {
      systemPrompt: `You are a search intent analyzer for a LinkedIn content platform. Given a user's search query, extract:
1. searchTerms: 2-5 alternative search phrases/keywords to find relevant posts (include the original query and variations)
2. clusters: Which of these 8 clusters are most relevant: ${CLUSTERS.join(", ")} (pick 1-3, or empty if none match)
3. tags: 2-5 lowercase-hyphenated tags that would match posts about this topic (e.g. "machine-learning", "cold-outreach", "content-strategy")
4. intent: A one-sentence description of what the user is looking for

Return ONLY valid JSON, no markdown fences.`,
      userMessage: `Search query: "${query}"`,
      temperature: 0.1,
      maxTokens: 300,
      model: "openai/gpt-5.4-mini",
    })

    const cleaned = response.content
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim()
    const parsed = JSON.parse(cleaned)

    return {
      searchTerms: Array.isArray(parsed.searchTerms)
        ? parsed.searchTerms.slice(0, 5)
        : [query],
      clusters: Array.isArray(parsed.clusters)
        ? parsed.clusters.filter((c: string) =>
            CLUSTERS.includes(c as (typeof CLUSTERS)[number])
          )
        : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      intent: typeof parsed.intent === "string" ? parsed.intent : query,
    }
  } catch (error) {
    console.error("[SmartSearch] Intent analysis failed:", error)
    return {
      searchTerms: [query],
      clusters: [],
      tags: [],
      intent: query,
    }
  }
}

/**
 * Computes a relevance score for a post based on search match quality and engagement
 * @param post - Raw post data to score
 * @param searchTerms - Terms from the LLM intent analysis
 * @param clusters - Matched clusters from the intent analysis
 * @param tags - Matched tags from the intent analysis
 * @param source - Whether the post is from discover or following
 * @returns Numeric relevance score (higher is better)
 */
function computeRelevanceScore(
  post: {
    content: string
    primaryCluster: string | null
    tags: string[]
    metrics: { likes: number; comments: number; reposts: number }
  },
  searchTerms: string[],
  clusters: string[],
  tags: string[],
  source: "discover" | "following"
): number {
  let score = 0
  const contentLower = post.content.toLowerCase()

  // Exact match in content (high weight)
  for (const term of searchTerms) {
    const termLower = term.toLowerCase()
    if (contentLower.includes(termLower)) {
      score += 50
      // Bonus for appearing early in the post
      const idx = contentLower.indexOf(termLower)
      if (idx < 200) {
        score += 10
      }
    }
  }

  // Cluster match (medium weight)
  if (
    post.primaryCluster &&
    clusters.some((c) => c.toLowerCase() === post.primaryCluster?.toLowerCase())
  ) {
    score += 30
  }

  // Tag overlap (medium weight)
  const postTagsLower = post.tags.map((t) => t.toLowerCase())
  for (const tag of tags) {
    if (postTagsLower.includes(tag.toLowerCase())) {
      score += 20
    }
  }

  // Engagement metrics (low weight, logarithmic to avoid domination by viral posts)
  const totalEngagement =
    post.metrics.likes + post.metrics.comments * 2 + post.metrics.reposts * 3
  score += Math.min(20, Math.log10(Math.max(1, totalEngagement)) * 5)

  // Slight boost for following source (personalized content)
  if (source === "following") {
    score += 5
  }

  return Math.round(score * 100) / 100
}

/**
 * Queries the discover_posts table with intelligent filtering
 * @param supabase - Supabase client instance
 * @param searchConditions - Sanitized search terms for ilike matching
 * @param searchMeta - Parsed search intent with clusters and tags
 * @param page - Zero-based page number
 * @param limit - Maximum number of results
 * @returns Query result with normalized posts and total count
 */
async function queryDiscoverPosts(
  supabase: SupabaseClient<Database>,
  searchConditions: string[],
  searchMeta: SearchIntent,
  page: number,
  limit: number
): Promise<QueryResult> {
  try {
    // Build the OR filter for content matching across all search terms
    const orFilters = searchConditions
      .map(
        (term) =>
          `content.ilike.%${term}%,author_name.ilike.%${term}%`
      )
      .join(",")

    let query = supabase
      .from("discover_posts")
      .select("*", { count: "exact" })
      .or(orFilters)

    // If clusters are identified, also filter by topics overlap
    if (searchMeta.clusters.length > 0) {
      // Use overlaps to find posts whose topics array shares at least one cluster
      query = query.overlaps("topics", searchMeta.clusters)
    }

    query = query
      .order("engagement_rate", { ascending: false, nullsFirst: false })
      .range(page * limit, page * limit + limit - 1)

    const { data: posts, error, count } = await query

    if (error) {
      // Handle table-not-exists gracefully
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        return { posts: [], totalCount: 0 }
      }
      throw error
    }

    const normalized: SearchResultPost[] = (posts || []).map((post) => {
      const result: SearchResultPost = {
        id: post.id,
        author: {
          name: post.author_name,
          headline: post.author_headline || null,
          avatar: post.author_avatar_url || null,
        },
        content: post.content,
        category: post.topics?.[0] || null,
        tags: post.topics || [],
        primaryCluster: post.topics?.[0] || null,
        metrics: {
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          reposts: post.reposts_count || 0,
          impressions: post.impressions_count || null,
          engagementRate: post.engagement_rate || null,
        },
        postedAt: post.posted_at,
        source: "discover",
        relevanceScore: 0,
        linkedinUrl: post.linkedin_url || null,
      }

      result.relevanceScore = computeRelevanceScore(
        {
          content: result.content,
          primaryCluster: result.primaryCluster,
          tags: result.tags,
          metrics: result.metrics,
        },
        searchMeta.searchTerms,
        searchMeta.clusters,
        searchMeta.tags,
        "discover"
      )

      return result
    })

    return { posts: normalized, totalCount: count ?? 0 }
  } catch (error) {
    console.error("[SmartSearch] Discover posts query failed:", error)
    return { posts: [], totalCount: 0 }
  }
}

/**
 * Queries the influencer_posts table with intelligent filtering
 * Joins with followed_influencers for author info and filters by user ownership
 * @param supabase - Supabase client instance
 * @param userId - Current authenticated user ID
 * @param searchConditions - Sanitized search terms for ilike matching
 * @param searchMeta - Parsed search intent with clusters and tags
 * @param page - Zero-based page number
 * @param limit - Maximum number of results
 * @returns Query result with normalized posts and total count
 */
async function queryInfluencerPosts(
  supabase: SupabaseClient<Database>,
  userId: string,
  searchConditions: string[],
  searchMeta: SearchIntent,
  page: number,
  limit: number
): Promise<QueryResult> {
  try {
    // Build the OR filter for content matching
    const orFilters = searchConditions
      .map((term) => `content.ilike.%${term}%`)
      .join(",")

    let query = supabase
      .from("influencer_posts")
      .select(
        "*, followed_influencers!inner(author_name, author_headline, author_profile_picture)",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("quality_status", "approved")
      .or(orFilters)

    // Filter by primary_cluster if clusters are identified
    if (searchMeta.clusters.length > 0) {
      query = query.in("primary_cluster", searchMeta.clusters)
    }

    // Filter by tag overlap if tags are identified
    if (searchMeta.tags.length > 0) {
      query = query.overlaps("tags", searchMeta.tags)
    }

    query = query
      .order("posted_at", { ascending: false, nullsFirst: false })
      .range(page * limit, page * limit + limit - 1)

    const { data: posts, error, count } = await query

    if (error) {
      // Handle table-not-exists gracefully
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        return { posts: [], totalCount: 0 }
      }
      throw error
    }

    const normalized: SearchResultPost[] = (posts || []).map((post) => {
      const influencer = post.followed_influencers as unknown as {
        author_name: string | null
        author_headline: string | null
        author_profile_picture: string | null
      }

      const result: SearchResultPost = {
        id: post.id,
        author: {
          name: influencer?.author_name || "Unknown",
          headline: influencer?.author_headline || null,
          avatar: influencer?.author_profile_picture || null,
        },
        content: post.content,
        category: post.primary_cluster || null,
        tags: post.tags || [],
        primaryCluster: post.primary_cluster || null,
        metrics: {
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          reposts: post.reposts_count || 0,
          impressions: null,
          engagementRate: null,
        },
        postedAt: post.posted_at,
        source: "following",
        relevanceScore: 0,
        linkedinUrl: post.linkedin_url || null,
      }

      result.relevanceScore = computeRelevanceScore(
        {
          content: result.content,
          primaryCluster: result.primaryCluster,
          tags: result.tags,
          metrics: result.metrics,
        },
        searchMeta.searchTerms,
        searchMeta.clusters,
        searchMeta.tags,
        "following"
      )

      return result
    })

    return { posts: normalized, totalCount: count ?? 0 }
  } catch (error) {
    console.error("[SmartSearch] Influencer posts query failed:", error)
    return { posts: [], totalCount: 0 }
  }
}

/**
 * GET /api/inspiration/search
 * @description AI-powered search endpoint that uses LLM to understand search intent,
 * maps to relevant clusters and search terms, then queries both discover_posts and
 * influencer_posts tables with intelligent filtering and returns ranked, deduplicated results.
 * @param request - Incoming request with query params: q (search query), page (0-based), limit
 * @returns Ranked and deduplicated search results with search metadata
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() || ""
  const page = Math.max(
    0,
    parseInt(searchParams.get("page") || "0", 10)
  )
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "24", 10))
  )

  if (!query) {
    return NextResponse.json({ posts: [], totalCount: 0, searchMeta: null })
  }

  // Step 1: Analyze search intent with LLM
  const searchMeta = await analyzeSearchIntent(query)

  // Step 2: Build sanitized search conditions from all search terms
  const searchConditions = searchMeta.searchTerms
    .map((term) => {
      const sanitized = term
        .replace(/[%_\\.,()'"]/g, "")
        .trim()
        .slice(0, 100)
      return sanitized
    })
    .filter((t) => t.length > 0)

  if (searchConditions.length === 0) {
    return NextResponse.json({ posts: [], totalCount: 0, searchMeta })
  }

  try {
    // Step 3: Query both tables in parallel
    const [discoverResults, influencerResults] = await Promise.all([
      queryDiscoverPosts(supabase, searchConditions, searchMeta, page, limit),
      queryInfluencerPosts(
        supabase,
        user.id,
        searchConditions,
        searchMeta,
        page,
        limit
      ),
    ])

    // Step 4: Merge and deduplicate by content similarity (first 100 chars)
    const allPosts = [...discoverResults.posts, ...influencerResults.posts]
    const seen = new Set<string>()
    const deduped = allPosts.filter((post) => {
      const key = post.content.slice(0, 100).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Step 5: Sort by relevance score (highest first)
    deduped.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Apply final page limit
    const paged = deduped.slice(0, limit)
    const totalCount =
      discoverResults.totalCount + influencerResults.totalCount

    return NextResponse.json({
      posts: paged,
      totalCount,
      searchMeta: {
        ...searchMeta,
        discoverCount: discoverResults.totalCount,
        influencerCount: influencerResults.totalCount,
      },
    })
  } catch (error) {
    console.error("[SmartSearch] Search failed:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
