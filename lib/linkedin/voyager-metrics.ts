/**
 * Voyager Metrics Module
 * @description Handle analytics and metrics retrieval via LinkedIn's Voyager API
 * @module lib/linkedin/voyager-metrics
 */

import { VoyagerClient, createVoyagerClient } from './voyager-client'
import { VOYAGER_ENDPOINTS, ANALYTICS_PERIODS } from './voyager-constants'
import type {
  VoyagerAnalyticsSummary,
  VoyagerPostAnalytics,
  VoyagerProfile,
  VoyagerResponse,
  VoyagerError,
  VoyagerDemographics,
  VoyagerFeedUpdate,
} from './voyager-types'

/**
 * Analytics time period options
 */
export type AnalyticsPeriod = keyof typeof ANALYTICS_PERIODS

/**
 * Profile metrics response
 */
export interface ProfileMetrics {
  impressions: number
  profileViews: number
  searchAppearances: number
  followerCount: number
  connectionCount: number
  engagementRate: number
}

/**
 * Content analytics response
 */
export interface ContentAnalytics {
  totalImpressions: number
  totalEngagements: number
  totalFollowersGained: number
  avgEngagementRate: number
  topPosts: PostAnalyticsItem[]
}

/**
 * Individual post analytics item
 */
export interface PostAnalyticsItem {
  activityUrn: string
  content: string | null
  impressions: number
  uniqueViews: number
  reactions: number
  comments: number
  reposts: number
  engagementRate: number
  postedAt: string
}

/**
 * Audience insights response
 */
export interface AudienceInsights {
  totalFollowers: number
  followerGrowth: number
  demographics: VoyagerDemographics | null
  topIndustries: Array<{ name: string; percentage: number }>
  topLocations: Array<{ name: string; percentage: number }>
  topJobTitles: Array<{ name: string; percentage: number }>
}

/**
 * Raw analytics response from Voyager
 */
interface VoyagerAnalyticsResponse {
  data?: {
    analyticsCardByPeriod?: {
      impressions?: { value: number }
      engagements?: { value: number }
      profileViews?: { value: number }
      searchAppearances?: { value: number }
      followerGains?: { value: number }
    }
  }
  elements?: Array<Record<string, unknown>>
  included?: Array<Record<string, unknown>>
}

/**
 * Fetch creator analytics summary
 * @param client - VoyagerClient instance
 * @param period - Time period for analytics
 * @returns Promise resolving to analytics summary
 */
export async function fetchAnalyticsSummary(
  client: VoyagerClient,
  period: AnalyticsPeriod = 'LAST_30_DAYS'
): Promise<VoyagerResponse<VoyagerAnalyticsSummary>> {
  const params = new URLSearchParams({
    q: 'creatorAnalyticsSummary',
    timePeriod: period,
  })

  const response = await client.request<VoyagerAnalyticsResponse>({
    method: 'GET',
    endpoint: `${VOYAGER_ENDPOINTS.CREATOR_ANALYTICS}?${params.toString()}`,
  })

  if (!response.success || !response.data) {
    return {
      ...response,
      data: null,
    }
  }

  // Transform raw response to our type
  const rawData = response.data
  const cardData = rawData.data?.analyticsCardByPeriod

  const summary: VoyagerAnalyticsSummary = {
    impressions: cardData?.impressions?.value || 0,
    // Voyager API doesn't provide unique views separately from impressions
    uniqueViews: 0,
    engagements: cardData?.engagements?.value || 0,
    engagementRate: 0,
    followerGains: cardData?.followerGains?.value || 0,
    profileViews: cardData?.profileViews?.value || 0,
    searchAppearances: cardData?.searchAppearances?.value || 0,
    periodStart: '',
    periodEnd: '',
  }

  // Calculate engagement rate
  if (summary.impressions > 0) {
    summary.engagementRate = (summary.engagements / summary.impressions) * 100
  }

  return {
    ...response,
    data: summary,
  }
}

/**
 * Fetch analytics for a specific post
 * @param client - VoyagerClient instance
 * @param activityUrn - Activity URN of the post
 * @returns Promise resolving to post analytics
 */
export async function fetchPostAnalytics(
  client: VoyagerClient,
  activityUrn: string
): Promise<VoyagerResponse<VoyagerPostAnalytics>> {
  const params = new URLSearchParams({
    q: 'postAnalytics',
    activityUrn: activityUrn,
  })

  const response = await client.request<Record<string, unknown>>({
    method: 'GET',
    endpoint: `${VOYAGER_ENDPOINTS.POST_ANALYTICS}?${params.toString()}`,
  })

  if (!response.success || !response.data) {
    return {
      ...response,
      data: null,
    }
  }

  // Transform raw response
  const rawData = response.data

  const analytics: VoyagerPostAnalytics = {
    activityUrn,
    impressionCount: (rawData.impressionCount as number) || 0,
    uniqueImpressionCount: (rawData.uniqueImpressionCount as number) || 0,
    likeCount: (rawData.likeCount as number) || 0,
    commentCount: (rawData.commentCount as number) || 0,
    shareCount: (rawData.shareCount as number) || 0,
    engagementRate: (rawData.engagementRate as number) || 0,
    clickCount: (rawData.clickCount as number) || 0,
    memberReach: (rawData.memberReach as number) || 0,
    demographics: null,
  }

  return {
    ...response,
    data: analytics,
  }
}

/**
 * Fetch user's profile data
 * @param client - VoyagerClient instance
 * @returns Promise resolving to profile data
 */
export async function fetchProfile(
  client: VoyagerClient
): Promise<VoyagerResponse<VoyagerProfile>> {
  const response = await client.request<Record<string, unknown>>({
    method: 'GET',
    endpoint: VOYAGER_ENDPOINTS.ME,
  })

  if (!response.success || !response.data) {
    return {
      ...response,
      data: null,
    }
  }

  const rawData = response.data
  const miniProfile = rawData.miniProfile as Record<string, unknown> | undefined

  const profile: VoyagerProfile = {
    entityUrn: (rawData.entityUrn as string) || '',
    publicIdentifier: (miniProfile?.publicIdentifier as string) || '',
    firstName: (rawData.firstName as string) || (miniProfile?.firstName as string) || '',
    lastName: (rawData.lastName as string) || (miniProfile?.lastName as string) || '',
    headline: (rawData.headline as string) || (miniProfile?.occupation as string) || null,
    locationName: (rawData.geoLocationName as string) || null,
    industryName: (rawData.industryName as string) || null,
    summary: (rawData.summary as string) || null,
    profilePicture: null,
    backgroundPicture: null,
    connectionCount: (rawData.connectionCount as number) || null,
    followerCount: (rawData.followerCount as number) || null,
  }

  return {
    ...response,
    data: profile,
  }
}

/**
 * Fetch user's recent posts with metrics
 * @param client - VoyagerClient instance
 * @param limit - Maximum number of posts to fetch
 * @returns Promise resolving to array of posts with analytics
 */
export async function fetchRecentPosts(
  client: VoyagerClient,
  limit: number = 10
): Promise<VoyagerResponse<VoyagerFeedUpdate[]>> {
  // First get user's profile URN
  const profileResponse = await fetchProfile(client)

  if (!profileResponse.success || !profileResponse.data) {
    return {
      success: false,
      data: null,
      error: profileResponse.error,
      statusCode: profileResponse.statusCode,
      headers: {},
    }
  }

  const profileUrn = profileResponse.data.entityUrn

  const params = new URLSearchParams({
    q: 'memberShareFeed',
    profileUrn: profileUrn,
    count: limit.toString(),
  })

  return client.request<VoyagerFeedUpdate[]>({
    method: 'GET',
    endpoint: `${VOYAGER_ENDPOINTS.FEED_UPDATES}?${params.toString()}`,
  })
}

/**
 * Fetch profile statistics (views, search appearances)
 * @param client - VoyagerClient instance
 * @param profileUrn - Profile URN (optional, uses current user if not provided)
 * @returns Promise resolving to profile metrics
 */
export async function fetchProfileStatistics(
  client: VoyagerClient,
  profileUrn?: string
): Promise<VoyagerResponse<ProfileMetrics>> {
  let urn = profileUrn

  if (!urn) {
    const profileResponse = await fetchProfile(client)
    if (!profileResponse.success || !profileResponse.data) {
      return {
        success: false,
        data: null,
        error: profileResponse.error,
        statusCode: profileResponse.statusCode,
        headers: {},
      }
    }
    urn = profileResponse.data.entityUrn
  }

  const params = new URLSearchParams({
    q: 'statistics',
  })

  const response = await client.request<Record<string, unknown>>({
    method: 'GET',
    endpoint: `${VOYAGER_ENDPOINTS.PROFILE_STATISTICS}/${encodeURIComponent(urn!)}?${params.toString()}`,
  })

  if (!response.success || !response.data) {
    return {
      ...response,
      data: null,
    }
  }

  const rawData = response.data

  const metrics: ProfileMetrics = {
    impressions: (rawData.impressions as number) || 0,
    profileViews: (rawData.profileViews as number) || 0,
    searchAppearances: (rawData.searchAppearances as number) || 0,
    followerCount: (rawData.followerCount as number) || 0,
    connectionCount: (rawData.connectionCount as number) || 0,
    engagementRate: 0,
  }

  return {
    ...response,
    data: metrics,
  }
}

/**
 * VoyagerMetricsService class for managing metrics operations
 * Provides a higher-level API for analytics retrieval
 */
export class VoyagerMetricsService {
  private client: VoyagerClient

  /**
   * Create a VoyagerMetricsService instance
   * @param client - VoyagerClient instance
   */
  constructor(client: VoyagerClient) {
    this.client = client
  }

  /**
   * Get analytics summary for a time period
   * @param period - Time period
   * @returns Promise resolving to analytics summary
   */
  async getSummary(
    period: AnalyticsPeriod = 'LAST_30_DAYS'
  ): Promise<{ success: boolean; data: VoyagerAnalyticsSummary | null; error: VoyagerError | null }> {
    const response = await fetchAnalyticsSummary(this.client, period)
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    }
  }

  /**
   * Get analytics for a specific post
   * @param activityUrn - Post activity URN
   * @returns Promise resolving to post analytics
   */
  async getPostAnalytics(
    activityUrn: string
  ): Promise<{ success: boolean; data: VoyagerPostAnalytics | null; error: VoyagerError | null }> {
    const response = await fetchPostAnalytics(this.client, activityUrn)
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    }
  }

  /**
   * Get user's profile data
   * @returns Promise resolving to profile data
   */
  async getProfile(): Promise<{ success: boolean; data: VoyagerProfile | null; error: VoyagerError | null }> {
    const response = await fetchProfile(this.client)
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    }
  }

  /**
   * Get profile statistics
   * @returns Promise resolving to profile metrics
   */
  async getProfileStatistics(): Promise<{
    success: boolean
    data: ProfileMetrics | null
    error: VoyagerError | null
  }> {
    const response = await fetchProfileStatistics(this.client)
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    }
  }

  /**
   * Get recent posts with their analytics
   * @param limit - Maximum posts to fetch
   * @returns Promise resolving to posts array
   */
  async getRecentPostsWithAnalytics(limit: number = 10): Promise<{
    success: boolean
    data: PostAnalyticsItem[]
    error: VoyagerError | null
  }> {
    const postsResponse = await fetchRecentPosts(this.client, limit)

    if (!postsResponse.success || !postsResponse.data) {
      return {
        success: false,
        data: [],
        error: postsResponse.error,
      }
    }

    // Fetch analytics for each post
    const postsWithAnalytics: PostAnalyticsItem[] = []

    for (const post of postsResponse.data) {
      const analyticsResponse = await fetchPostAnalytics(this.client, post.entityUrn)

      const item: PostAnalyticsItem = {
        activityUrn: post.entityUrn,
        content: post.commentary,
        impressions: analyticsResponse.data?.impressionCount || 0,
        uniqueViews: analyticsResponse.data?.uniqueImpressionCount || 0,
        reactions: analyticsResponse.data?.likeCount || post.socialDetail?.totalSocialActivityCounts?.numLikes || 0,
        comments: analyticsResponse.data?.commentCount || post.socialDetail?.totalSocialActivityCounts?.numComments || 0,
        reposts: analyticsResponse.data?.shareCount || post.socialDetail?.totalSocialActivityCounts?.numShares || 0,
        engagementRate: analyticsResponse.data?.engagementRate || 0,
        postedAt: new Date(post.createdAt).toISOString(),
      }

      postsWithAnalytics.push(item)
    }

    return {
      success: true,
      data: postsWithAnalytics,
      error: null,
    }
  }

  /**
   * Get comprehensive content analytics
   * @param period - Time period for analytics
   * @param postLimit - Number of recent posts to include
   * @returns Promise resolving to content analytics
   */
  async getContentAnalytics(
    period: AnalyticsPeriod = 'LAST_30_DAYS',
    postLimit: number = 10
  ): Promise<{ success: boolean; data: ContentAnalytics | null; error: VoyagerError | null }> {
    // Get summary analytics
    const summaryResponse = await fetchAnalyticsSummary(this.client, period)

    if (!summaryResponse.success || !summaryResponse.data) {
      return {
        success: false,
        data: null,
        error: summaryResponse.error,
      }
    }

    // Get recent posts
    const postsResult = await this.getRecentPostsWithAnalytics(postLimit)

    const contentAnalytics: ContentAnalytics = {
      totalImpressions: summaryResponse.data.impressions,
      totalEngagements: summaryResponse.data.engagements,
      totalFollowersGained: summaryResponse.data.followerGains,
      avgEngagementRate: summaryResponse.data.engagementRate,
      topPosts: postsResult.data.sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    }

    return {
      success: true,
      data: contentAnalytics,
      error: null,
    }
  }
}

/**
 * Create a VoyagerMetricsService for a user
 * @param userId - Supabase user ID
 * @returns Promise resolving to VoyagerMetricsService instance
 * @example
 * const metricsService = await createVoyagerMetricsService(userId)
 * const analytics = await metricsService.getSummary('LAST_30_DAYS')
 */
export async function createVoyagerMetricsService(userId: string): Promise<VoyagerMetricsService> {
  const client = await createVoyagerClient(userId)
  return new VoyagerMetricsService(client)
}
