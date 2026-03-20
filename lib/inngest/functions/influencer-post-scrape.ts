/**
 * Influencer Post Scrape Cron Job
 * @description Inngest cron function that runs daily at 06:00 UTC to scrape recent posts
 * from followed influencers via Apify (harvestapi~linkedin-profile-posts),
 * filter them with LLM quality assessment, update influencer profile data,
 * and store approved posts in the influencer_posts table.
 * @module lib/inngest/functions/influencer-post-scrape
 */

import { inngest } from '../client'
import { filterPostQualityBatch, type PostForQualityCheck } from '@/lib/ai/post-quality-filter'
import { createClient } from '@supabase/supabase-js'

/** Apify actor for scraping LinkedIn profile posts (no cookies needed) */
const APIFY_ACTOR_ID = 'harvestapi~linkedin-profile-posts'

/** Max posts to fetch per profile */
const LIMIT_PER_PROFILE = 10

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
    width?: number
    height?: number
  }
}

/**
 * Engagement data from Apify
 */
interface ApifyEngagement {
  likes?: number
  comments?: number
  shares?: number
  reactions?: Array<{ type: string; count: number }>
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
    postedAgoShort?: string
    postedAgoText?: string
  }
  engagement?: ApifyEngagement
  postImages?: Array<{ url?: string }>
  query?: string
  [key: string]: unknown
}

/**
 * Grouped influencer data for batch processing
 */
interface InfluencerGroup {
  linkedin_url: string
  linkedin_username: string | null
  influencer_ids: string[]
  user_ids: string[]
}

/**
 * Influencer Post Scrape Cron Function
 * Runs daily at 06:00 UTC or on-demand when a user follows an influencer
 */
export const influencerPostScrape = inngest.createFunction(
  {
    id: 'influencer-post-scrape',
    name: 'Influencer Post Scrape',
    retries: 2,
  },
  [
    { cron: '0 6 * * *' },
    { event: 'influencer/follow' },
  ],
  async ({ step, event }) => {
    const supabase = getSupabaseAdmin()

    console.log('[InfluencerScrape] Starting influencer post scrape')

    // Step 1: Fetch active influencers, grouped by username to deduplicate
    const influencerGroups = await step.run('fetch-active-influencers', async () => {
      // Check if triggered by influencer/follow event (not cron)
      const isEventTriggered = event?.name === 'influencer/follow'
      const eventData = isEventTriggered ? event?.data as { userId?: string; linkedinUrl?: string; linkedinUsername?: string } : undefined

      console.log(`[InfluencerScrape] Trigger: ${isEventTriggered ? 'event' : 'cron'}, eventName=${event?.name || 'none'}, userId=${eventData?.userId?.substring(0, 8) || 'all'}`)

      let query = supabase
        .from('followed_influencers')
        .select('id, user_id, linkedin_url, linkedin_username')
        .eq('status', 'active')

      // When event-triggered, scrape ALL influencers for the triggering user
      // (not just the specific one — user expects all their followed influencers to be refreshed)
      if (eventData?.userId) {
        query = query.eq('user_id', eventData.userId)
        console.log(`[InfluencerScrape] Event-triggered: scraping all influencers for user ${eventData.userId.substring(0, 8)}...`)
      }

      const { data: influencers, error } = await query

      if (error) {
        console.error('[InfluencerScrape] Failed to fetch influencers:', error)
        return []
      }

      if (!influencers || influencers.length === 0) {
        console.log('[InfluencerScrape] No active influencers found')
        return []
      }

      // Group by linkedin_url to deduplicate across users
      const grouped = new Map<string, InfluencerGroup>()
      for (const inf of influencers) {
        const key = inf.linkedin_url
        if (!grouped.has(key)) {
          grouped.set(key, {
            linkedin_url: inf.linkedin_url,
            linkedin_username: inf.linkedin_username,
            influencer_ids: [],
            user_ids: [],
          })
        }
        const group = grouped.get(key)!
        group.influencer_ids.push(inf.id)
        group.user_ids.push(inf.user_id)
      }

      const groups = Array.from(grouped.values())
      console.log(`[InfluencerScrape] Found ${groups.length} unique influencers from ${influencers.length} follow records`)
      return groups
    })

    if (influencerGroups.length === 0) {
      return { success: true, message: 'No active influencers', postsScraped: 0 }
    }

    // Step 2a: Start Apify runs for all influencers (fast — just kicks off the actor)
    const apifyRunIds = await step.run('start-apify-runs', async () => {
      const token = process.env.APIFY_API_TOKEN
      if (!token) throw new Error('APIFY_API_TOKEN not set')

      const runIds: Array<{ runId: string; groupIndices: number[] }> = []

      // Batch into groups of 5 profiles per Apify run
      for (let i = 0; i < influencerGroups.length; i += 5) {
        const batch = influencerGroups.slice(i, i + 5)
        const groupIndices = batch.map((_, idx) => i + idx)
        const normalizedUrls = batch.map(g =>
          g.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com/, 'https://www.linkedin.com')
        )

        const input = { targetUrls: normalizedUrls, maxPosts: LIMIT_PER_PROFILE }
        console.log(`[InfluencerScrape] Starting Apify for ${normalizedUrls.length} profiles: ${normalizedUrls.join(', ')}`)

        const startRes = await fetch(
          `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        )

        if (!startRes.ok) {
          console.error(`[InfluencerScrape] Apify start failed: ${startRes.status}`)
          continue
        }

        const data = await startRes.json() as { data?: { id?: string } }
        if (data?.data?.id) {
          runIds.push({ runId: data.data.id, groupIndices })
          console.log(`[InfluencerScrape] Apify run started: ${data.data.id}`)
        }
      }

      return runIds
    })

    // Step 2b: Wait for Apify runs to complete (60 seconds should be enough)
    await step.sleep('wait-for-apify', '60s')

    // Step 2c: Fetch results from all Apify runs
    const allScrapedPosts: Array<{ influencerGroup: InfluencerGroup; posts: ApifyLinkedInPost[] }> = []

    for (let runIdx = 0; runIdx < apifyRunIds.length; runIdx++) {
      const { runId, groupIndices } = apifyRunIds[runIdx]
      const batch = groupIndices.map(i => influencerGroups[i])

      const batchResults = await step.run(`fetch-apify-results-${runIdx}`, async () => {
        const token = process.env.APIFY_API_TOKEN!

        // Check run status
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
        const statusData = await statusRes.json() as { data?: { status?: string } }
        const status = statusData?.data?.status

        console.log(`[InfluencerScrape] Apify run ${runId} status: ${status}`)

        if (status !== 'SUCCEEDED') {
          console.error(`[InfluencerScrape] Apify run ${runId} not succeeded: ${status}`)
          return batch.map(g => ({ influencerGroup: g, posts: [] as ApifyLinkedInPost[] }))
        }

        // Fetch dataset items
        const datasetRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
        )

        let items: ApifyLinkedInPost[] = []
        if (datasetRes.ok) {
          try {
            items = await datasetRes.json() as ApifyLinkedInPost[]
          } catch {
            console.error(`[InfluencerScrape] Failed to parse dataset for run ${runId}`)
          }
        }

        if (!Array.isArray(items)) items = []

        console.log(`[InfluencerScrape] Apify returned ${items.length} raw items`)

          // Log first item's structure for debugging
          if (items.length > 0) {
            const first = items[0]
            console.log(`[InfluencerScrape] First item: author=${first.author?.publicIdentifier}, query=${String(first.query || '').slice(0, 80)}, postedAt=${JSON.stringify(first.postedAt)}`)
          }

        // Filter to posts from last 14 days
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
        const recentItems = items.filter(item => {
          if (!item.postedAt?.timestamp && !item.postedAt?.date) return true
          const postedTime = item.postedAt.timestamp || new Date(item.postedAt.date!).getTime()
          return postedTime >= fourteenDaysAgo
        })

        console.log(`[InfluencerScrape] Date filter: ${recentItems.length}/${items.length} passed (14-day window)`)

        // Match posts to influencers
        const result = batch.map(group => {
          const username = (group.linkedin_username || '').toLowerCase()
          const profileUrlNorm = group.linkedin_url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

          const groupPosts = recentItems.filter(item => {
            const authorId = (item.author?.publicIdentifier || '').toLowerCase()
            const authorUrl = (item.author?.linkedinUrl || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
            const queryUrl = String(item.query || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

            if (username && authorId === username) return true
            if (username && (authorUrl.includes(`/in/${username}`) || queryUrl.includes(`/in/${username}`))) return true
            if (queryUrl.includes(profileUrlNorm) || authorUrl.includes(profileUrlNorm)) return true
            return false
          })

          console.log(`[InfluencerScrape] Match ${group.linkedin_username}: ${groupPosts.length}/${recentItems.length} posts`)
          return { influencerGroup: group, posts: groupPosts }
        })

        // Fallback for single-profile batches
        if (result.length === 1 && result[0].posts.length === 0 && recentItems.length > 0) {
          console.log(`[InfluencerScrape] Fallback: assigning all ${recentItems.length} posts to sole influencer`)
          result[0].posts = recentItems
        }

        return result
      })

      allScrapedPosts.push(...batchResults)
    }

    // Step 3: Update influencer profiles with scraped author data (name, avatar, headline)
    await step.run('update-influencer-profiles', async () => {
      for (const scraped of allScrapedPosts) {
        if (scraped.posts.length === 0) continue
        const firstPost = scraped.posts[0]
        const author = firstPost.author
        if (!author) continue

        const updates: Record<string, unknown> = {}
        if (author.name) updates.author_name = author.name
        if (author.info) updates.author_headline = author.info
        if (author.avatar?.url) updates.author_profile_picture = author.avatar.url

        if (Object.keys(updates).length === 0) continue

        for (const influencerId of scraped.influencerGroup.influencer_ids) {
          await supabase
            .from('followed_influencers')
            .update(updates)
            .eq('id', influencerId)
        }
      }
      console.log('[InfluencerScrape] Updated influencer profile data (name, avatar, headline)')
    })

    // Step 4: LLM quality filter
    const qualityResults = await step.run('llm-quality-filter', async () => {
      const allPosts: Array<{ post: ApifyLinkedInPost; groupIdx: number }> = []
      for (let i = 0; i < allScrapedPosts.length; i++) {
        for (const post of allScrapedPosts[i].posts) {
          if (post.content && post.content.length > 0) {
            allPosts.push({ post, groupIdx: i })
          }
        }
      }

      if (allPosts.length === 0) return []

      // Process in batches of 10 for LLM
      const results: Array<{
        post: ApifyLinkedInPost
        groupIdx: number
        approved: boolean
        score: number
        reason: string | null
        topics: string[]
        tags: string[]
        primaryCluster: string
      }> = []

      for (let i = 0; i < allPosts.length; i += 10) {
        const chunk = allPosts.slice(i, i + 10)
        const postsForFilter: PostForQualityCheck[] = chunk.map(({ post }) => ({
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
          results.push({
            ...chunk[j],
            approved: filterResults[j].approved,
            score: filterResults[j].score,
            reason: filterResults[j].reason,
            topics: filterResults[j].topics,
            tags: filterResults[j].tags,
            primaryCluster: filterResults[j].primaryCluster,
          })
        }
      }

      console.log(`[InfluencerScrape] Quality filter: ${results.filter(r => r.approved).length}/${results.length} approved`)
      return results
    })

    // Step 5: Classify tags and resolve clusters
    await step.run('classify-tags', async () => {
      // Fetch existing tag->cluster mappings
      const { data: mappings } = await supabase
        .from('tag_cluster_mappings')
        .select('tag, cluster')

      const tagClusterMap = new Map<string, string>()
      if (mappings) {
        for (const m of mappings) {
          tagClusterMap.set(m.tag, m.cluster)
        }
      }

      // For each quality result, resolve cluster from tags
      for (const result of qualityResults) {
        if (!result.approved) continue

        // Try to find cluster from existing mappings
        let resolvedCluster = 'AI' // default
        for (const tag of result.tags) {
          const cluster = tagClusterMap.get(tag)
          if (cluster) {
            resolvedCluster = cluster
            break
          }
        }
        result.primaryCluster = resolvedCluster

        // Insert any new tags into tag_cluster_mappings
        for (const tag of result.tags) {
          if (!tagClusterMap.has(tag)) {
            await supabase
              .from('tag_cluster_mappings')
              .upsert({ tag, cluster: resolvedCluster }, { onConflict: 'tag', ignoreDuplicates: true })
            tagClusterMap.set(tag, resolvedCluster)
          }
        }
      }

      console.log('[InfluencerScrape] Tag classification complete')
    })

    // Step 6: Save approved posts
    const savedCount = await step.run('save-posts', async () => {
      if (qualityResults.length === 0) return 0

      let saved = 0
      for (const result of qualityResults) {
        const group = allScrapedPosts[result.groupIdx].influencerGroup

        // Create a row for each user who follows this influencer
        for (let u = 0; u < group.user_ids.length; u++) {
          const userId = group.user_ids[u]
          const influencerId = group.influencer_ids[u]

          const postedAtDate = result.post.postedAt?.date
            || (result.post.postedAt?.timestamp
              ? new Date(result.post.postedAt.timestamp).toISOString()
              : null)

          const linkedinPostId = result.post.id || null

          const row = {
            influencer_id: influencerId,
            user_id: userId,
            linkedin_url: result.post.linkedinUrl || null,
            linkedin_post_id: linkedinPostId,
            content: result.post.content || '',
            post_type: result.post.type || null,
            likes_count: result.post.engagement?.likes || 0,
            comments_count: result.post.engagement?.comments || 0,
            reposts_count: result.post.engagement?.shares || 0,
            posted_at: postedAtDate,
            quality_score: result.score,
            quality_status: result.approved ? 'approved' : 'rejected',
            rejection_reason: result.reason,
            tags: result.tags,
            primary_cluster: result.primaryCluster,
            raw_data: result.post as unknown as Record<string, unknown>,
          }

          const { error } = await supabase
            .from('influencer_posts')
            .upsert(row, { onConflict: 'user_id,linkedin_url', ignoreDuplicates: true })

          if (error) {
            console.error(`[InfluencerScrape] Failed to upsert post:`, error.message)
          } else {
            saved++
          }
        }
      }

      console.log(`[InfluencerScrape] Saved ${saved} influencer post records`)
      return saved
    })

    // Step 7: Update influencer counts and last_scraped_at
    await step.run('update-counts', async () => {
      for (const scraped of allScrapedPosts) {
        const group = scraped.influencerGroup

        for (const influencerId of group.influencer_ids) {
          // Query actual approved post count from DB
          const { count } = await supabase
            .from('influencer_posts')
            .select('id', { count: 'exact', head: true })
            .eq('influencer_id', influencerId)
            .eq('quality_status', 'approved')

          await supabase
            .from('followed_influencers')
            .update({
              posts_count: count || 0,
              last_scraped_at: new Date().toISOString(),
            })
            .eq('id', influencerId)
        }
      }
      console.log('[InfluencerScrape] Updated influencer counts and last_scraped_at')
    })

    // Step 8: Emit completion event
    await step.sendEvent('scrape-completed', {
      name: 'influencer/scrape.completed',
      data: {
        influencersScraped: influencerGroups.length,
        postsFound: qualityResults.length,
        postsApproved: qualityResults.filter(r => r.approved).length,
      },
    })

    return {
      success: true,
      influencersScraped: influencerGroups.length,
      postsFound: qualityResults.length,
      postsApproved: qualityResults.filter(r => r.approved).length,
      postsSaved: savedCount,
    }
  }
)
