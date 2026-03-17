/**
 * Post Quality Filter
 * @description Shared LLM-powered quality filter for LinkedIn posts.
 * Used by both influencer-post-scrape and viral-post-ingest cron jobs
 * to filter out low-quality, political, job announcement, and engagement bait posts.
 * @module lib/ai/post-quality-filter
 */

import { createOpenAIClient, chatCompletion } from '@/lib/ai/openai-client'

/**
 * Result of post quality assessment
 */
export interface PostQualityResult {
  /** Whether the post passed quality filters */
  approved: boolean
  /** Quality score from 0 (worst) to 1 (best) */
  score: number
  /** Rejection reason if not approved */
  reason: string | null
  /** Auto-classified topics */
  topics: string[]
  /** Lowercase-hyphenated sub-tags (e.g. "content-marketing", "ai-tools") */
  tags: string[]
  /** Primary cluster category */
  primaryCluster: string
}

/**
 * Input post data for quality assessment
 */
export interface PostForQualityCheck {
  /** Post content text */
  content: string
  /** Author display name */
  author_name: string
  /** Engagement metrics */
  metrics: {
    likes: number
    comments: number
    reposts: number
  }
}

/** System prompt for the quality filter LLM */
const QUALITY_FILTER_SYSTEM_PROMPT = `You are a content quality filter for a LinkedIn content platform called ChainLinked. Your job is to evaluate LinkedIn posts and determine if they are high-quality, valuable content worth showing to users.

Evaluate each post and return a JSON response.

REJECTION CRITERIA (reject if ANY apply):
1. SHORT/LOW-SUBSTANCE: Post is under 50 characters, or only 1-2 sentences with no real insight or value
2. POLITICAL/PARTISAN: Contains ANY political content including: political opinions, partisan commentary, controversial political takes, policy advocacy, political figures/parties (Trump, Biden, Democrats, Republicans, etc.), election commentary, immigration debates, culture war topics (DEI, woke, CRT), gun control, abortion, government policy criticism/praise, geopolitical takes, or any content that would be divisive along political lines. When in doubt about whether content is political, REJECT it.
3. JOB ANNOUNCEMENTS: Job postings, internship announcements, "excited to join/start" posts, "we're hiring" posts, work anniversary celebrations
4. ENGAGEMENT BAIT: "Like if you agree", "Comment YES", "Repost this", repost chains, follow-for-follow, empty motivational one-liners designed purely for engagement

APPROVAL CRITERIA:
- Provides genuine insight, advice, or valuable perspective
- Shares useful experience or lessons learned
- Contains actionable information professionals can use
- Tells a compelling story with a takeaway
- Offers data-driven analysis or unique observations

For TOPICS, classify into 1-3 of these categories: marketing, sales, leadership, technology, entrepreneurship, product-management, remote-work, saas, content-creation, personal-branding, hiring, finance, general

For TAGS, provide 2-5 lowercase-hyphenated sub-tags that describe the post's specific themes (e.g. "content-marketing", "ai-tools", "founder-lessons", "cold-outreach", "team-building").

For PRIMARY_CLUSTER, classify each post into exactly ONE of these 8 clusters: AI, Marketing, Sales, Leadership, Startup, Product, Growth, Engineering

Return ONLY valid JSON, no markdown fences.`

/**
 * Builds the user prompt for a batch of posts
 * @param posts - Array of posts to evaluate
 * @returns Formatted user prompt string
 */
function buildBatchPrompt(posts: PostForQualityCheck[]): string {
  const postEntries = posts.map((post, i) => {
    return `--- Post ${i + 1} ---
Author: ${post.author_name}
Engagement: ${post.metrics.likes} likes, ${post.metrics.comments} comments, ${post.metrics.reposts} reposts
Content: ${post.content.slice(0, 1000)}`
  }).join('\n\n')

  return `Evaluate the following ${posts.length} LinkedIn post(s). For each post, return a JSON object with: approved (boolean), score (0.0-1.0), reason (string or null if approved), topics (string array), tags (string array of 2-5 lowercase-hyphenated sub-tags), primary_cluster (string, one of: AI, Marketing, Sales, Leadership, Startup, Product, Growth, Engineering).

Return a JSON array with exactly ${posts.length} objects in the same order as the posts.

${postEntries}`
}

/**
 * Strips markdown code fences from LLM response
 * @param text - Raw response text
 * @returns Cleaned JSON string
 */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/**
 * Filters a batch of posts through the LLM quality filter
 * @param posts - Array of posts to evaluate (max 10 per call for cost efficiency)
 * @returns Array of quality results in the same order as input posts
 * @example
 * const results = await filterPostQualityBatch([
 *   { content: "Great leadership insight...", author_name: "John", metrics: { likes: 500, comments: 30, reposts: 10 } }
 * ])
 */
export async function filterPostQualityBatch(
  posts: PostForQualityCheck[]
): Promise<PostQualityResult[]> {
  if (posts.length === 0) return []

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('[QualityFilter] OPENROUTER_API_KEY not set, approving all posts by default')
    return posts.map(() => ({
      approved: true,
      score: 0.5,
      reason: null,
      topics: ['general'],
      tags: [],
      primaryCluster: 'AI',
    }))
  }

  const client = createOpenAIClient({ apiKey, timeout: 60000 })

  try {
    const response = await chatCompletion(client, {
      systemPrompt: QUALITY_FILTER_SYSTEM_PROMPT,
      userMessage: buildBatchPrompt(posts),
      temperature: 0.1,
      maxTokens: 2048,
    })

    const cleaned = stripMarkdownFences(response.content)
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) {
      console.error('[QualityFilter] Expected array, got:', typeof parsed)
      return posts.map(() => ({
        approved: true,
        score: 0.5,
        reason: null,
        topics: ['general'],
        tags: [],
        primaryCluster: 'AI',
      }))
    }

    // Map and validate each result
    return parsed.map((result: Record<string, unknown>) => ({
      approved: typeof result.approved === 'boolean' ? result.approved : true,
      score: typeof result.score === 'number' ? Math.max(0, Math.min(1, result.score)) : 0.5,
      reason: typeof result.reason === 'string' ? result.reason : null,
      topics: Array.isArray(result.topics) ? result.topics.filter((t: unknown) => typeof t === 'string') : ['general'],
      tags: Array.isArray(result.tags) ? result.tags.filter((t: unknown) => typeof t === 'string') : [],
      primaryCluster: typeof result.primary_cluster === 'string' ? result.primary_cluster : 'AI',
    }))
  } catch (error) {
    console.error('[QualityFilter] LLM filter failed:', error instanceof Error ? error.message : error)
    // On failure, approve all with low confidence
    return posts.map(() => ({
      approved: true,
      score: 0.3,
      reason: null,
      topics: ['general'],
      tags: [],
      primaryCluster: 'AI',
    }))
  }
}

/**
 * Filters a single post through the LLM quality filter
 * @param post - Post to evaluate
 * @returns Quality assessment result
 * @example
 * const result = await filterPostQuality({
 *   content: "Here's what I learned about leadership...",
 *   author_name: "Jane Doe",
 *   metrics: { likes: 200, comments: 15, reposts: 5 }
 * })
 */
export async function filterPostQuality(
  post: PostForQualityCheck
): Promise<PostQualityResult> {
  const results = await filterPostQualityBatch([post])
  return results[0]
}
