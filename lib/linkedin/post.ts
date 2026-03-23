/**
 * LinkedIn Post Creation Module
 * @description Functions for creating posts and uploading media to LinkedIn
 * @module lib/linkedin/post
 */

import {
  LINKEDIN_API,
  type LinkedInUgcPostRequest,
  type LinkedInUgcPostResponse,
  type LinkedInRegisterUploadRequest,
  type LinkedInRegisterUploadResponse,
  type LinkedInVisibility,
  type LinkedInShareMediaCategory,
  type LinkedInMentionAttribute,
  type CreatePostRequest,
  type CreatePostResponse,
} from './types'
import { LinkedInApiClient } from './api-client'
import { hasMentions, buildUgcMentionAttributes } from './mentions'

/**
 * Maximum content length for LinkedIn posts
 */
export const MAX_POST_LENGTH = 3000

/**
 * Maximum number of images per post
 */
export const MAX_IMAGES_PER_POST = 9

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
] as const

/**
 * Validate post content
 * @param content - Post content text
 * @throws Error if content is invalid
 */
export function validatePostContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error('Post content cannot be empty')
  }

  if (content.length > MAX_POST_LENGTH) {
    throw new Error(`Post content exceeds maximum length of ${MAX_POST_LENGTH} characters`)
  }
}

/**
 * Process content that may contain mention tokens.
 * Converts @[Name](URN) tokens to plain text + UGC attributes.
 * @param content - Raw content possibly containing mention tokens
 * @returns Object with plain text and optional attributes
 */
function processMentions(content: string): {
  text: string
  attributes?: LinkedInMentionAttribute[]
} {
  if (!hasMentions(content)) {
    return { text: content }
  }
  const { plainText, attributes } = buildUgcMentionAttributes(content)
  return {
    text: plainText,
    attributes: attributes.length > 0 ? attributes : undefined,
  }
}

/**
 * Build ugcPost request body for text-only posts
 * @param linkedInUrn - Author's LinkedIn URN
 * @param content - Post content text (may contain mention tokens)
 * @param visibility - Post visibility setting
 * @returns UGC post request body
 */
function buildTextPostRequest(
  linkedInUrn: string,
  content: string,
  visibility: LinkedInVisibility = 'PUBLIC'
): LinkedInUgcPostRequest {
  const { text, attributes } = processMentions(content)

  return {
    author: linkedInUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text,
          ...(attributes && { attributes }),
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility,
    },
  }
}

/**
 * Build ugcPost request body for posts with media
 * @param linkedInUrn - Author's LinkedIn URN
 * @param content - Post content text (may contain mention tokens)
 * @param mediaAssets - Array of uploaded media asset URNs
 * @param visibility - Post visibility setting
 * @returns UGC post request body
 */
function buildMediaPostRequest(
  linkedInUrn: string,
  content: string,
  mediaAssets: string[],
  visibility: LinkedInVisibility = 'PUBLIC'
): LinkedInUgcPostRequest {
  const { text, attributes } = processMentions(content)
  const mediaCategory: LinkedInShareMediaCategory = mediaAssets.length > 0 ? 'IMAGE' : 'NONE'

  const media = mediaAssets.map((asset) => ({
    status: 'READY' as const,
    media: asset,
  }))

  return {
    author: linkedInUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text,
          ...(attributes && { attributes }),
        },
        shareMediaCategory: mediaCategory,
        media: media.length > 0 ? media : undefined,
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility,
    },
  }
}

/**
 * Register a media upload with LinkedIn
 * @param client - LinkedIn API client
 * @param linkedInUrn - Owner's LinkedIn URN
 * @returns Upload registration response with upload URL
 */
async function registerMediaUpload(
  client: LinkedInApiClient,
  linkedInUrn: string
): Promise<LinkedInRegisterUploadResponse> {
  const request: LinkedInRegisterUploadRequest = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: linkedInUrn,
      serviceRelationships: [
        {
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent',
        },
      ],
    },
  }

  const response = await client.post<LinkedInRegisterUploadResponse>(
    `${LINKEDIN_API.ASSETS}?action=registerUpload`,
    request
  )

  return response
}

/**
 * Upload media binary to LinkedIn
 * @param uploadUrl - URL from registerUpload response
 * @param mediaData - Binary media data
 * @param contentType - MIME type of the media
 * @returns True if upload succeeded
 */
async function uploadMediaBinary(
  accessToken: string,
  uploadUrl: string,
  mediaData: ArrayBuffer,
  contentType: string
): Promise<boolean> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: new Blob([mediaData], { type: contentType }),
  })

  return response.ok
}

/**
 * Fetch image from URL and return as buffer with content type
 * @param imageUrl - URL of the image to fetch
 * @returns Object with buffer and content type
 */
async function fetchImageFromUrl(imageUrl: string): Promise<{
  buffer: ArrayBuffer
  contentType: string
}> {
  const response = await fetch(imageUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = await response.arrayBuffer()

  return { buffer, contentType }
}

/**
 * Upload an image to LinkedIn from raw binary data (Buffer/ArrayBuffer)
 * @param client - LinkedIn API client
 * @param imageData - Raw image binary data
 * @param contentType - MIME type of the image (e.g., 'image/jpeg')
 * @returns Asset URN of the uploaded image
 */
export async function uploadImageFromBuffer(
  client: LinkedInApiClient,
  imageData: ArrayBuffer | Buffer,
  contentType: string
): Promise<string> {
  const linkedInUrn = client.getLinkedInUrn()

  // Step 1: Register the upload
  const registration = await registerMediaUpload(client, linkedInUrn)

  const uploadInfo = registration.value.uploadMechanism[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ]

  // Step 2: Upload the binary
  // Convert Buffer to ArrayBuffer if needed
  const arrayBuffer: ArrayBuffer = imageData instanceof ArrayBuffer
    ? imageData
    : imageData.buffer.slice(imageData.byteOffset, imageData.byteOffset + imageData.byteLength) as ArrayBuffer
  const uploadSuccess = await uploadMediaBinary(
    client.getAccessToken(),
    uploadInfo.uploadUrl,
    arrayBuffer,
    contentType
  )

  if (!uploadSuccess) {
    throw new Error('Failed to upload image to LinkedIn')
  }

  // Return the asset URN for use in the post
  return registration.value.asset
}

/**
 * Upload a single image to LinkedIn
 * @param client - LinkedIn API client
 * @param imageUrl - URL of the image to upload
 * @returns Asset URN of the uploaded image
 */
export async function uploadImage(
  client: LinkedInApiClient,
  imageUrl: string
): Promise<string> {
  const linkedInUrn = client.getLinkedInUrn()

  // Step 1: Register the upload
  const registration = await registerMediaUpload(client, linkedInUrn)

  const uploadInfo = registration.value.uploadMechanism[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ]

  // Step 2: Fetch the image
  const { buffer, contentType } = await fetchImageFromUrl(imageUrl)

  // Step 3: Upload the binary
  const uploadSuccess = await uploadMediaBinary(
    client.getAccessToken(),
    uploadInfo.uploadUrl,
    buffer,
    contentType
  )

  if (!uploadSuccess) {
    throw new Error('Failed to upload image to LinkedIn')
  }

  // Return the asset URN for use in the post
  return registration.value.asset
}

/**
 * Upload multiple images to LinkedIn
 * @param client - LinkedIn API client
 * @param imageUrls - Array of image URLs to upload
 * @returns Array of asset URNs
 */
export async function uploadImages(
  client: LinkedInApiClient,
  imageUrls: string[]
): Promise<string[]> {
  if (imageUrls.length > MAX_IMAGES_PER_POST) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_POST} images allowed per post`)
  }

  // Upload images in parallel with a limit
  const uploadPromises = imageUrls.map((url) => uploadImage(client, url))
  const assets = await Promise.all(uploadPromises)

  return assets
}

/**
 * Create a text-only post on LinkedIn
 * @param client - LinkedIn API client
 * @param content - Post content text
 * @param visibility - Post visibility (PUBLIC or CONNECTIONS)
 * @returns Post creation response
 * @example
 * const response = await createTextPost(client, "Hello LinkedIn!")
 */
export async function createTextPost(
  client: LinkedInApiClient,
  content: string,
  visibility: LinkedInVisibility = 'PUBLIC'
): Promise<LinkedInUgcPostResponse> {
  validatePostContent(content)

  const linkedInUrn = client.getLinkedInUrn()
  const requestBody = buildTextPostRequest(linkedInUrn, content, visibility)

  const response = await client.post<LinkedInUgcPostResponse>(
    LINKEDIN_API.UGC_POSTS,
    requestBody
  )

  return response
}

/**
 * Create a post with images on LinkedIn
 * @param client - LinkedIn API client
 * @param content - Post content text
 * @param imageUrls - Array of image URLs to attach
 * @param visibility - Post visibility
 * @returns Post creation response
 * @example
 * const response = await createImagePost(client, "Check out this image!", ["https://..."])
 */
export async function createImagePost(
  client: LinkedInApiClient,
  content: string,
  imageUrls: string[],
  visibility: LinkedInVisibility = 'PUBLIC'
): Promise<LinkedInUgcPostResponse> {
  validatePostContent(content)

  // Upload all images first
  const mediaAssets = await uploadImages(client, imageUrls)

  const linkedInUrn = client.getLinkedInUrn()
  const requestBody = buildMediaPostRequest(linkedInUrn, content, mediaAssets, visibility)

  const response = await client.post<LinkedInUgcPostResponse>(
    LINKEDIN_API.UGC_POSTS,
    requestBody
  )

  return response
}

/**
 * Create a post on LinkedIn (auto-detects if media is included)
 * @param client - LinkedIn API client
 * @param request - Post creation request
 * @returns Standardized post response
 * @example
 * const response = await createPost(client, {
 *   content: "Hello LinkedIn!",
 *   mediaUrls: ["https://example.com/image.jpg"],
 *   visibility: "PUBLIC"
 * })
 */
export async function createPost(
  client: LinkedInApiClient,
  request: CreatePostRequest
): Promise<CreatePostResponse> {
  try {
    const { content, visibility = 'PUBLIC', mediaUrls, mediaAssets } = request

    let response: LinkedInUgcPostResponse

    if (mediaAssets && mediaAssets.length > 0) {
      // Pre-uploaded assets: skip upload, go straight to post creation
      validatePostContent(content)
      const linkedInUrn = client.getLinkedInUrn()
      const requestBody = buildMediaPostRequest(linkedInUrn, content, mediaAssets, visibility)
      response = await client.post<LinkedInUgcPostResponse>(
        LINKEDIN_API.UGC_POSTS,
        requestBody
      )
    } else if (mediaUrls && mediaUrls.length > 0) {
      response = await createImagePost(client, content, mediaUrls, visibility)
    } else {
      response = await createTextPost(client, content, visibility)
    }

    return {
      success: true,
      postId: response.id,
      linkedinPostUrn: response.id,
    }
  } catch (error) {
    console.error('LinkedIn post creation error:', error)

    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to create LinkedIn post'

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Extract post ID from LinkedIn URN
 * @param urn - LinkedIn URN (e.g., "urn:li:share:123456")
 * @returns Numeric post ID
 */
export function extractPostIdFromUrn(urn: string): string {
  const parts = urn.split(':')
  return parts[parts.length - 1]
}

/**
 * Build LinkedIn post URL from URN
 * @param urn - LinkedIn post URN
 * @returns URL to view the post on LinkedIn
 */
export function buildPostUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}`
}
