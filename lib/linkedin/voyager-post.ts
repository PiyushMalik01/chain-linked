/**
 * Voyager Post Module
 * @description Handle post creation via LinkedIn's Voyager API
 * @module lib/linkedin/voyager-post
 */

import { VoyagerClient, createVoyagerClient } from './voyager-client'
import { VOYAGER_ENDPOINTS, POST_VISIBILITY, MEDIA_CATEGORIES } from './voyager-constants'
import type {
  VoyagerPostRequest,
  VoyagerPostResponse,
  VoyagerResponse,
  VoyagerError,
} from './voyager-types'

/**
 * Post creation options
 */
export interface CreatePostOptions {
  /** Post text content */
  content: string
  /** Post visibility setting */
  visibility?: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN'
  /** Media URLs to attach (images, videos) */
  mediaUrls?: string[]
  /** Article URL to share */
  articleUrl?: string
  /** Original post URN for reposts */
  originalPostUrn?: string
}

/**
 * Post creation result
 */
export interface CreatePostResult {
  success: boolean
  postId: string | null
  activityUrn: string | null
  shareUrn: string | null
  error: VoyagerError | null
}

/**
 * Upload media request structure
 */
interface MediaUploadRequest {
  mediaUploadType: string
  fileSize: number
  filename: string
}

/**
 * Upload media response
 */
interface MediaUploadResponse {
  uploadUrl: string
  mediaUrn: string
}

/**
 * Build the Voyager share creation payload
 * @param options - Post options
 * @param profileUrn - User's LinkedIn profile URN
 * @returns Share creation payload
 */
function buildSharePayload(
  options: CreatePostOptions,
  profileUrn: string
): Record<string, unknown> {
  const visibility = options.visibility || POST_VISIBILITY.PUBLIC

  const payload: Record<string, unknown> = {
    visibleToGuest: visibility === POST_VISIBILITY.PUBLIC,
    externalAudienceProviders: [],
    commentaryV2: {
      text: options.content,
      attributes: extractMentionsAndHashtags(options.content),
    },
    origin: 'FEED',
    allowedCommentersScope: 'ALL',
    contentLandingPage: 'FEED_DETAIL',
  }

  // Set visibility
  payload.visibility = {
    'com.linkedin.voyager.common.VisibilityType': visibility,
  }

  // Add media if present
  if (options.mediaUrls && options.mediaUrls.length > 0) {
    payload.mediaCategory = MEDIA_CATEGORIES.IMAGE
    payload.media = options.mediaUrls.map((urn) => ({
      mediaUrn: urn,
      status: 'READY',
    }))
  }

  // Add article if present
  if (options.articleUrl) {
    payload.mediaCategory = MEDIA_CATEGORIES.ARTICLE
    payload.content = {
      'com.linkedin.voyager.feed.render.ArticleContent': {
        url: options.articleUrl,
      },
    }
  }

  // Handle repost
  if (options.originalPostUrn) {
    payload.resharedUpdate = options.originalPostUrn
  }

  // Add author info
  payload.author = profileUrn

  return payload
}

/**
 * Extract mentions and hashtags from post content
 * @param content - Post text content
 * @returns Array of attributes for mentions/hashtags
 */
function extractMentionsAndHashtags(content: string): Array<Record<string, unknown>> {
  const attributes: Array<Record<string, unknown>> = []

  // Extract hashtags
  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu
  let match

  while ((match = hashtagRegex.exec(content)) !== null) {
    attributes.push({
      start: match.index,
      length: match[0].length,
      type: {
        'com.linkedin.pemberly.text.HashtagAttributedEntity': {
          hashtag: match[1],
        },
      },
    })
  }

  return attributes
}

/**
 * Create a post via Voyager API
 * @param client - VoyagerClient instance
 * @param options - Post creation options
 * @returns Promise resolving to CreatePostResult
 */
export async function createPost(
  client: VoyagerClient,
  options: CreatePostOptions
): Promise<CreatePostResult> {
  // First, get the user's profile URN
  const profileResponse = await client.request<{ entityUrn: string }>({
    method: 'GET',
    endpoint: VOYAGER_ENDPOINTS.ME,
  })

  if (!profileResponse.success || !profileResponse.data) {
    return {
      success: false,
      postId: null,
      activityUrn: null,
      shareUrn: null,
      error: profileResponse.error,
    }
  }

  const profileUrn = profileResponse.data.entityUrn

  // Build the share payload
  const payload = buildSharePayload(options, profileUrn)

  // Create the post
  const response = await client.request<VoyagerPostResponse>({
    method: 'POST',
    endpoint: VOYAGER_ENDPOINTS.NORM_SHARES,
    body: payload,
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      postId: null,
      activityUrn: null,
      shareUrn: null,
      error: response.error,
    }
  }

  return {
    success: true,
    postId: response.data.entityUrn,
    activityUrn: response.data.activityUrn,
    shareUrn: response.data.shareUrn,
    error: null,
  }
}

/**
 * Delete a post via Voyager API
 * @param client - VoyagerClient instance
 * @param activityUrn - Activity URN of the post to delete
 * @returns Promise resolving to VoyagerResponse
 */
export async function deletePost(
  client: VoyagerClient,
  activityUrn: string
): Promise<VoyagerResponse<void>> {
  return client.request<void>({
    method: 'DELETE',
    endpoint: `${VOYAGER_ENDPOINTS.FEED_UPDATES}/${encodeURIComponent(activityUrn)}`,
  })
}

/**
 * Edit a post via Voyager API
 * @param client - VoyagerClient instance
 * @param activityUrn - Activity URN of the post to edit
 * @param newContent - Updated post content
 * @returns Promise resolving to VoyagerResponse
 */
export async function editPost(
  client: VoyagerClient,
  activityUrn: string,
  newContent: string
): Promise<VoyagerResponse<VoyagerPostResponse>> {
  const payload = {
    patch: {
      $set: {
        commentary: {
          text: newContent,
          attributes: extractMentionsAndHashtags(newContent),
        },
      },
    },
  }

  return client.request<VoyagerPostResponse>({
    method: 'POST',
    endpoint: `${VOYAGER_ENDPOINTS.NORM_SHARES}/${encodeURIComponent(activityUrn)}`,
    body: payload,
  })
}

/**
 * Request media upload URL from LinkedIn
 * @param client - VoyagerClient instance
 * @param fileSize - Size of the file in bytes
 * @param filename - Name of the file
 * @param mediaType - Type of media (image/video)
 * @returns Promise resolving to upload URL and media URN
 */
export async function requestMediaUpload(
  client: VoyagerClient,
  fileSize: number,
  filename: string,
  mediaType: 'image' | 'video'
): Promise<VoyagerResponse<MediaUploadResponse>> {
  const uploadRequest = {
    mediaUploadType: mediaType === 'image' ? 'IMAGE_SHARING' : 'VIDEO_SHARING',
    fileSize,
    filename,
  } as Record<string, unknown>

  return client.request<MediaUploadResponse>({
    method: 'POST',
    endpoint: '/voyagerMediaUploadMetadata',
    body: uploadRequest,
  })
}

/**
 * VoyagerPostService class for managing post operations
 * Provides a higher-level API for post management
 */
export class VoyagerPostService {
  private client: VoyagerClient

  /**
   * Create a VoyagerPostService instance
   * @param client - VoyagerClient instance
   */
  constructor(client: VoyagerClient) {
    this.client = client
  }

  /**
   * Create a new post
   * @param options - Post creation options
   * @returns Promise resolving to CreatePostResult
   */
  async create(options: CreatePostOptions): Promise<CreatePostResult> {
    return createPost(this.client, options)
  }

  /**
   * Delete a post
   * @param activityUrn - Activity URN of post to delete
   * @returns Promise resolving to success/failure
   */
  async delete(activityUrn: string): Promise<{ success: boolean; error: VoyagerError | null }> {
    const response = await deletePost(this.client, activityUrn)
    return {
      success: response.success,
      error: response.error,
    }
  }

  /**
   * Edit a post
   * @param activityUrn - Activity URN of post to edit
   * @param newContent - Updated content
   * @returns Promise resolving to success/failure
   */
  async edit(
    activityUrn: string,
    newContent: string
  ): Promise<{ success: boolean; error: VoyagerError | null }> {
    const response = await editPost(this.client, activityUrn, newContent)
    return {
      success: response.success,
      error: response.error,
    }
  }

  /**
   * Repost/share an existing post
   *
   * NOTE: Even when commentary is empty, the profile URN is still required by
   * the Voyager API to set the `author` field on the share payload, so the
   * profile fetch inside `createPost` cannot be skipped.
   *
   * @param originalPostUrn - URN of post to repost
   * @param commentary - Optional commentary to add
   * @returns Promise resolving to CreatePostResult
   */
  async repost(originalPostUrn: string, commentary?: string): Promise<CreatePostResult> {
    return createPost(this.client, {
      content: commentary || '',
      originalPostUrn,
    })
  }
}

/**
 * Create a VoyagerPostService for a user
 * @param userId - Supabase user ID
 * @returns Promise resolving to VoyagerPostService instance
 * @example
 * const postService = await createVoyagerPostService(userId)
 * const result = await postService.create({ content: 'Hello LinkedIn!' })
 */
export async function createVoyagerPostService(userId: string): Promise<VoyagerPostService> {
  const client = await createVoyagerClient(userId)
  return new VoyagerPostService(client)
}
