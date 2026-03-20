/**
 * Viral Post Ingest Cron Job
 * @description Inngest cron function that runs daily at 5 AM UTC (1 hour before
 * the influencer scrape at 6 AM) to scrape trending posts from curated viral
 * LinkedIn creators via Apify (harvestapi~linkedin-profile-posts), filter with
 * LLM quality assessment, classify tags/clusters, and store up to 20 approved
 * posts per day in the discover_posts table.
 * @module lib/inngest/functions/viral-post-ingest
 */

import { inngest } from '../client'
import { filterPostQualityBatch, type PostForQualityCheck } from '@/lib/ai/post-quality-filter'
import { createClient } from '@supabase/supabase-js'

/** Apify actor for scraping LinkedIn profile posts (no cookies needed) */
const APIFY_ACTOR_ID = 'harvestapi~linkedin-profile-posts'

/** Max posts to fetch per profile for viral ingest */
const LIMIT_PER_PROFILE = 10

/** Maximum number of approved posts to save per daily run */
const MAX_POSTS_PER_DAY = 20

/**
 * Supabase admin client for background jobs
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * Author data from Apify harvestapi~linkedin-profile-posts
 */
interface ApifyAuthor {
  publicIdentifier?: string
  name?: string
  info?: string
  linkedinUrl?: string
  avatar?: {
    url?: string
  }
}

/**
 * Raw post data from Apify harvestapi~linkedin-profile-posts
 */
interface ApifyLinkedInPost {
  type?: string
  id?: string
  linkedinUrl?: string
  content?: string
  author?: ApifyAuthor
  postedAt?: {
    timestamp?: number
    date?: string
  }
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
  [key: string]: unknown
}

/**
 * Topic keyword mapping for auto-classification
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'artificial-intelligence': [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
    'neural network', 'llm', 'chatgpt', 'openai', 'gpt', 'generative ai',
    'nlp', 'natural language', 'computer vision', 'automation',
  ],
  'sales-enablement': [
    'sales', 'selling', 'revenue', 'crm', 'pipeline', 'leads', 'prospecting',
    'quota', 'deal', 'close', 'buyer', 'b2b sales', 'outbound', 'inbound',
  ],
  'remote-work': [
    'remote work', 'work from home', 'wfh', 'hybrid work', 'distributed team',
    'async', 'asynchronous', 'digital nomad', 'coworking', 'remote first',
  ],
  'saas-growth': [
    'saas', 'software as a service', 'mrr', 'arr', 'churn', 'retention',
    'plg', 'product-led', 'subscription', 'pricing', 'freemium',
  ],
  'leadership': [
    'leadership', 'management', 'ceo', 'cto', 'founder', 'executive',
    'team building', 'culture', 'hiring', 'mentorship', 'coaching',
  ],
  'marketing': [
    'marketing', 'content marketing', 'seo', 'social media', 'brand',
    'demand gen', 'growth marketing', 'copywriting', 'funnel', 'conversion',
  ],
  'startup': [
    'startup', 'venture capital', 'vc', 'fundraising', 'series a', 'seed round',
    'bootstrapping', 'founder', 'entrepreneurship', 'pitch deck', 'investor',
  ],
  'product-management': [
    'product management', 'product manager', 'pm', 'roadmap', 'user research',
    'feature', 'sprint', 'agile', 'scrum', 'product strategy',
  ],
}

/** Pre-compiled regex map for topic classification */
const TOPIC_REGEX_MAP: Map<string, RegExp> = new Map(
  Object.entries(TOPIC_KEYWORDS).map(([topic, keywords]) => {
    const pattern = keywords
      .map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    return [topic, new RegExp(pattern, 'i')]
  })
)

/**
 * Auto-classify topics based on content keywords
 * @param content - Post content text
 * @returns Array of matched topic slugs
 */
function classifyTopics(content: string): string[] {
  const matched: string[] = []
  for (const [topic, regex] of TOPIC_REGEX_MAP) {
    if (regex.test(content)) {
      matched.push(topic)
    }
  }
  return matched.length > 0 ? matched : ['general']
}

/**
 * Calculate engagement rate from metrics
 * @param likes - Number of likes
 * @param comments - Number of comments
 * @param reposts - Number of reposts
 * @returns Estimated engagement rate percentage
 */
function calculateEngagementRate(likes: number, comments: number, reposts: number): number {
  const totalEngagement = likes + comments + reposts
  if (totalEngagement > 500) return 5.0
  if (totalEngagement > 200) return 3.0
  if (totalEngagement > 50) return 1.5
  return 0.5
}

/**
 * Viral Post Ingest Cron Function
 * Runs daily at 5 AM UTC (1 hour before influencer scrape). Ingests up to
 * {@link MAX_POSTS_PER_DAY} top-engagement viral posts per run.
 */
export const viralPostIngest = inngest.createFunction(
  {
    id: 'viral-post-ingest',
    name: 'Viral Post Ingest',
    retries: 2,
  },
  { cron: '0 5 * * *' },
  async ({ step }) => {
    const supabase = getSupabaseAdmin()

    console.log('[ViralIngest] Starting daily viral post ingest')

    // Step 1: Fetch source profiles
    const sourceProfiles = await step.run('fetch-source-profiles', async () => {
      const { data, error } = await supabase
        .from('viral_source_profiles')
        .select('*')
        .eq('status', 'active')

      if (error) {
        console.error('[ViralIngest] Failed to fetch source profiles:', error)
        return []
      }

      console.log(`[ViralIngest] Found ${data?.length || 0} active source profiles`)
      return data || []
    })

    if (sourceProfiles.length === 0) {
      return { success: true, message: 'No active source profiles', postsIngested: 0 }
    }

    // Step 2a: Start Apify runs for all profile batches (fast — async start)
    const batches: Array<Array<{ linkedin_url: string }>> = []
    for (let i = 0; i < sourceProfiles.length; i += 5) {
      batches.push(sourceProfiles.slice(i, i + 5))
    }

    const apifyRunIds = await step.run('start-apify-runs', async () => {
      const token = process.env.APIFY_API_TOKEN
      if (!token) throw new Error('APIFY_API_TOKEN not set')

      const runIds: string[] = []
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const urls = batches[batchIdx].map((p) =>
          p.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com/, 'https://www.linkedin.com')
        )

        console.log(`[ViralIngest] Starting Apify batch ${batchIdx} for ${urls.length} profiles`)

        const res = await fetch(
          `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrls: urls, maxPosts: LIMIT_PER_PROFILE }),
          }
        )

        if (res.ok) {
          const data = await res.json() as { data?: { id?: string } }
          if (data?.data?.id) {
            runIds.push(data.data.id)
            console.log(`[ViralIngest] Apify run started: ${data.data.id}`)
          }
        } else {
          console.error(`[ViralIngest] Apify start failed: ${res.status}`)
        }
      }

      return runIds
    })

    // Step 2b: Wait for Apify to finish
    await step.sleep('wait-for-apify', '60s')

    // Step 2c: Fetch results from all Apify runs
    const allScrapedPosts: ApifyLinkedInPost[] = []

    for (let runIdx = 0; runIdx < apifyRunIds.length; runIdx++) {
      const runId = apifyRunIds[runIdx]
      const batchPosts = await step.run(`fetch-apify-results-${runIdx}`, async () => {
        const token = process.env.APIFY_API_TOKEN!

        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
        const statusData = await statusRes.json() as { data?: { status?: string } }
        const status = statusData?.data?.status

        console.log(`[ViralIngest] Apify run ${runId} status: ${status}`)

        if (status !== 'SUCCEEDED') {
          console.error(`[ViralIngest] Apify run ${runId} not succeeded: ${status}`)
          return [] as ApifyLinkedInPost[]
        }

        const datasetRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
        )

        let items: ApifyLinkedInPost[] = []
        if (datasetRes.ok) {
          try {
            items = await datasetRes.json() as ApifyLinkedInPost[]
          } catch {
            console.error(`[ViralIngest] Failed to parse dataset for run ${runId}`)
          }
        }

        if (!Array.isArray(items)) items = []

        console.log(`[ViralIngest] Apify returned ${items.length} raw items`)

        // Filter to posts from last 3 days
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
        const recentItems = items.filter(item => {
          if (!item.postedAt?.timestamp && !item.postedAt?.date) return true
          const postedTime = item.postedAt.timestamp || new Date(item.postedAt.date!).getTime()
          return postedTime >= threeDaysAgo
        })

        console.log(`[ViralIngest] ${recentItems.length}/${items.length} passed 3-day date filter`)
        return recentItems
      })

      allScrapedPosts.push(...batchPosts)
    }

    console.log(`[ViralIngest] Total scraped posts after date filter: ${allScrapedPosts.length}`)

    // Step 3: LLM quality filter
    const qualityResults = await step.run('llm-quality-filter', async () => {
      const postsWithContent = allScrapedPosts.filter(p => p.content && p.content.length > 0)

      if (postsWithContent.length === 0) return []

      const results: Array<{
        post: ApifyLinkedInPost
        approved: boolean
        score: number
        reason: string | null
        topics: string[]
        tags: string[]
        primaryCluster: string
      }> = []

      // Process in batches of 10
      for (let i = 0; i < postsWithContent.length; i += 10) {
        const chunk = postsWithContent.slice(i, i + 10)
        const postsForFilter: PostForQualityCheck[] = chunk.map(post => ({
          content: post.content || '',
          author_name: post.author?.name || 'Unknown',
          metrics: {
            likes: post.engagement?.likes || 0,
            comments: post.engagement?.comments || 0,
            reposts: post.engagement?.shares || 0,
          },
        }))

        const filterResults = await filterPostQualityBatch(postsForFilter)

        for (let j = 0; j < chunk.length; j++) {
          // Merge LLM topics and tags with keyword-based classification
          const keywordTopics = classifyTopics(chunk[j].content || '')
          const llmTags = filterResults[j].tags || []
          const allTopics = [...new Set([...filterResults[j].topics, ...keywordTopics, ...llmTags])]

          results.push({
            post: chunk[j],
            approved: filterResults[j].approved,
            score: filterResults[j].score,
            reason: filterResults[j].reason,
            topics: allTopics,
            tags: filterResults[j].tags,
            primaryCluster: filterResults[j].primaryCluster,
          })
        }
      }

      const approvedCount = results.filter(r => r.approved).length
      const rejectedCount = results.length - approvedCount
      console.log(`[ViralIngest] Quality filter: ${approvedCount} approved, ${rejectedCount} rejected out of ${results.length} total`)
      return results
    })

    // Step 3b: Classify tags and resolve clusters
    await step.run('classify-tags', async () => {
      const { data: mappings } = await supabase
        .from('tag_cluster_mappings')
        .select('tag, cluster')

      const tagClusterMap = new Map<string, string>()
      if (mappings) {
        for (const m of mappings) {
          tagClusterMap.set(m.tag, m.cluster)
        }
      }

      for (const result of qualityResults) {
        if (!result.approved) continue

        // Resolve cluster from existing mappings, fallback to LLM-provided cluster
        let resolvedCluster = result.primaryCluster || 'AI'
        for (const tag of result.tags) {
          const cluster = tagClusterMap.get(tag)
          if (cluster) {
            resolvedCluster = cluster
            break
          }
        }
        result.primaryCluster = resolvedCluster

        // Insert any new tags
        for (const tag of result.tags) {
          if (!tagClusterMap.has(tag)) {
            await supabase
              .from('tag_cluster_mappings')
              .upsert({ tag, cluster: resolvedCluster }, { onConflict: 'tag', ignoreDuplicates: true })
            tagClusterMap.set(tag, resolvedCluster)
          }
        }
      }

      console.log('[ViralIngest] Tag classification complete')
    })

    // Apply daily cap - keep top 20 by engagement
    const approvedPosts = qualityResults
      .filter(r => r.approved)
      .sort((a, b) => {
        const engA = (a.post.engagement?.likes || 0) + (a.post.engagement?.comments || 0) * 2 + (a.post.engagement?.shares || 0) * 3
        const engB = (b.post.engagement?.likes || 0) + (b.post.engagement?.comments || 0) * 2 + (b.post.engagement?.shares || 0) * 3
        return engB - engA
      })
      .slice(0, MAX_POSTS_PER_DAY)

    console.log(`[ViralIngest] Daily cap applied: ${approvedPosts.length} posts (max ${MAX_POSTS_PER_DAY})`)

    // Step 4: Save to discover_posts
    const savedCount = await step.run('save-to-discover-posts', async () => {
      if (approvedPosts.length === 0) return 0

      let saved = 0
      for (const result of approvedPosts) {
        const post = result.post
        const likes = post.engagement?.likes || 0
        const comments = post.engagement?.comments || 0
        const reposts = post.engagement?.shares || 0
        const engagementRate = calculateEngagementRate(likes, comments, reposts)
        const isViral = engagementRate >= 2.0

        const postedAtDate = post.postedAt?.date
          || (post.postedAt?.timestamp
            ? new Date(post.postedAt.timestamp).toISOString()
            : new Date().toISOString())

        const row = {
          linkedin_url: post.linkedinUrl || `apify-viral-${crypto.randomUUID()}`,
          linkedin_post_id: post.id || null,
          author_name: post.author?.name || 'Unknown',
          author_headline: post.author?.info || '',
          author_avatar_url: post.author?.avatar?.url || null,
          author_profile_url: post.author?.linkedinUrl || null,
          content: post.content || '',
          post_type: post.type || null,
          likes_count: likes,
          comments_count: comments,
          reposts_count: reposts,
          posted_at: postedAtDate,
          scraped_at: new Date().toISOString(),
          topics: result.topics,
          tags: result.tags,
          primary_cluster: result.primaryCluster,
          is_viral: isViral,
          engagement_rate: engagementRate,
          source: 'apify_viral',
        }

        const { error } = await supabase
          .from('discover_posts')
          .upsert(row, { onConflict: 'linkedin_url', ignoreDuplicates: true })

        if (error) {
          console.error('[ViralIngest] Failed to upsert post:', error.message)
        } else {
          saved++
        }
      }

      console.log(`[ViralIngest] Saved ${saved} viral posts to discover_posts`)
      return saved
    })

    // Step 5: Cleanup stale viral posts
    const staleRemoved = await step.run('cleanup-stale', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('discover_posts')
        .delete()
        .eq('source', 'apify_viral')
        .lt('scraped_at', thirtyDaysAgo)
        .select('id')

      if (error) {
        console.error('[ViralIngest] Stale cleanup failed:', error)
        return 0
      }

      const removed = data?.length || 0
      console.log(`[ViralIngest] Removed ${removed} stale viral posts`)
      return removed
    })

    // Step 6: Emit completion
    await step.sendEvent('viral-ingest-completed', {
      name: 'viral/ingest.completed',
      data: {
        profilesScraped: sourceProfiles.length,
        postsFound: qualityResults.length,
        postsApproved: approvedPosts.length,
        postsSaved: savedCount,
        staleRemoved,
      },
    })

    return {
      success: true,
      profilesScraped: sourceProfiles.length,
      postsFound: qualityResults.length,
      postsApproved: approvedPosts.length,
      postsSaved: savedCount,
      staleRemoved,
    }
  }
)
