/**
 * LinkedIn API Types
 * @description Type definitions for LinkedIn API requests and responses
 * @module lib/linkedin/types
 */

/**
 * LinkedIn OAuth scopes
 * Products required in LinkedIn Developer Console:
 * - "Sign In with LinkedIn using OpenID Connect" (provides openid, profile, email)
 * - "Share on LinkedIn" (provides w_member_social)
 *
 * IMPORTANT: The /v2/me endpoint is FULLY DEPRECATED by LinkedIn.
 * You MUST enable "Sign In with LinkedIn using OpenID Connect" product.
 */
export const LINKEDIN_SCOPES = [
  'openid',           // Required for OpenID Connect authentication
  'profile',          // Required to get user's name and profile picture
  'email',            // Required to get user's email address
  'w_member_social',  // Required for posting to LinkedIn
] as const

export type LinkedInScope = typeof LINKEDIN_SCOPES[number]

/**
 * Get LinkedIn scopes for OAuth
 */
export function getLinkedInScopes(): string[] {
  return [...LINKEDIN_SCOPES]
}

/**
 * LinkedIn OAuth token response
 * When using OpenID Connect (openid scope), also includes id_token
 */
export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope: string
  /** JWT containing user info when openid scope is used */
  id_token?: string
}

/**
 * LinkedIn user info response from /v2/userinfo endpoint (OpenID Connect)
 * Requires openid scope
 */
export interface LinkedInUserInfo {
  /** OpenID Connect subject - LinkedIn member ID */
  sub: string
  /** Full name */
  name?: string
  /** Given name / First name */
  given_name?: string
  /** Family name / Last name */
  family_name?: string
  /** Profile picture URL */
  picture?: string
  /** Email address (requires email scope) */
  email?: string
  /** Whether email is verified */
  email_verified?: boolean
  /** Locale */
  locale?: {
    country: string
    language: string
  }
}

/**
 * LinkedIn user info response from /v2/me endpoint (legacy)
 * Used when openid scope is not available
 */
export interface LinkedInMeResponse {
  /** LinkedIn member ID (used to construct URN) */
  id: string
  /** Localized first name */
  localizedFirstName: string
  /** Localized last name */
  localizedLastName: string
  /** Profile picture data */
  profilePicture?: {
    displayImage: string
    'displayImage~'?: {
      elements?: Array<{
        identifiers?: Array<{
          identifier: string
        }>
      }>
    }
  }
}

/**
 * Stored LinkedIn token data in database
 */
export interface LinkedInTokenData {
  id: string
  user_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string
  linkedin_urn: string
  scopes: string[]
  created_at: string
  updated_at: string
}

/**
 * LinkedIn API error response
 */
export interface LinkedInApiError {
  status: number
  serviceErrorCode?: number
  code?: string
  message: string
}

/**
 * LinkedIn ugcPost visibility types
 */
export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS'

/**
 * LinkedIn media category for uploads
 */
export type LinkedInMediaCategory = 'NONE' | 'ARTICLE' | 'IMAGE'

/**
 * LinkedIn share media category
 */
export type LinkedInShareMediaCategory = 'NONE' | 'ARTICLE' | 'IMAGE' | 'RICH' | 'VIDEO'

/**
 * LinkedIn ugcPost author type
 */
export interface LinkedInAuthor {
  author: string
}

/**
 * UGC mention attribute for tagging a person in posts
 */
export interface LinkedInMemberMentionAttribute {
  start: number
  length: number
  value: {
    'com.linkedin.common.MemberAttributedEntity': {
      member: string
    }
  }
}

/**
 * UGC mention attribute for tagging a company/organization in posts
 */
export interface LinkedInCompanyMentionAttribute {
  start: number
  length: number
  value: {
    'com.linkedin.common.CompanyAttributedEntity': {
      company: string
    }
  }
}

/**
 * UGC mention attribute (person or company)
 */
export type LinkedInMentionAttribute = LinkedInMemberMentionAttribute | LinkedInCompanyMentionAttribute

/**
 * LinkedIn share commentary (text content with optional mention attributes)
 */
export interface LinkedInShareCommentary {
  text: string
  attributes?: LinkedInMentionAttribute[]
}

/**
 * LinkedIn media status
 */
export type LinkedInMediaStatus = 'PROCESSING' | 'READY' | 'FAILED'

/**
 * LinkedIn media details for posts
 */
export interface LinkedInMedia {
  status: LinkedInMediaStatus
  description?: LinkedInShareCommentary
  media: string
  title?: LinkedInShareCommentary
}

/**
 * LinkedIn share content
 */
export interface LinkedInShareContent {
  shareCommentary: LinkedInShareCommentary
  shareMediaCategory: LinkedInShareMediaCategory
  media?: LinkedInMedia[]
}

/**
 * LinkedIn ugcPost request body
 */
export interface LinkedInUgcPostRequest {
  author: string
  lifecycleState: 'PUBLISHED' | 'DRAFT'
  specificContent: {
    'com.linkedin.ugc.ShareContent': LinkedInShareContent
  }
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': LinkedInVisibility
  }
}

/**
 * LinkedIn ugcPost response
 */
export interface LinkedInUgcPostResponse {
  id: string
  author: string
  created: {
    time: number
  }
  lifecycleState: string
}

/**
 * LinkedIn register upload request
 */
export interface LinkedInRegisterUploadRequest {
  registerUploadRequest: {
    recipes: string[]
    owner: string
    serviceRelationships: {
      relationshipType: 'OWNER'
      identifier: 'urn:li:userGeneratedContent'
    }[]
  }
}

/**
 * LinkedIn register upload response
 */
export interface LinkedInRegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        headers: Record<string, string>
        uploadUrl: string
      }
    }
    mediaArtifact: string
    asset: string
  }
}

/**
 * Post request from client
 */
export interface CreatePostRequest {
  content: string
  visibility?: LinkedInVisibility
  /** Image URLs to fetch, upload, and attach */
  mediaUrls?: string[]
  /** Pre-uploaded media asset URNs (skip upload step) */
  mediaAssets?: string[]
}

/**
 * Post response to client
 */
export interface CreatePostResponse {
  success: boolean
  postId?: string
  linkedinPostUrn?: string
  error?: string
}

/**
 * LinkedIn connection status returned by the /api/linkedin/status endpoint
 */
export interface LinkedInConnectionStatus {
  /** Whether the user currently has a valid LinkedIn connection */
  connected: boolean
  /** ISO timestamp of when the token expires, or null if not connected */
  expiresAt: string | null
  /** Display name from the LinkedIn profile, or null if not available */
  profileName: string | null
  /** Whether the token is expired or within 7 days of expiry and needs reconnection */
  needsReconnect: boolean
}

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableStatuses: number[]
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

/**
 * LinkedIn API endpoints
 */
export const LINKEDIN_API = {
  AUTHORIZATION: 'https://www.linkedin.com/oauth/v2/authorization',
  ACCESS_TOKEN: 'https://www.linkedin.com/oauth/v2/accessToken',
  /** OpenID Connect userinfo endpoint - requires openid scope */
  USERINFO: 'https://api.linkedin.com/v2/userinfo',
  /** User profile endpoint - fallback when openid scope is not available */
  ME: 'https://api.linkedin.com/v2/me',
  UGC_POSTS: 'https://api.linkedin.com/v2/ugcPosts',
  ASSETS: 'https://api.linkedin.com/v2/assets',
} as const

/**
 * LinkedIn REST API endpoints (versioned API)
 * Used for document uploads and new-style post creation
 */
export const LINKEDIN_REST_API = {
  /** Document upload initialization */
  DOCUMENTS: 'https://api.linkedin.com/rest/documents',
  /** Post creation (new versioned API) */
  POSTS: 'https://api.linkedin.com/rest/posts',
} as const

/**
 * LinkedIn API version header
 * Must be updated periodically — LinkedIn sunset versions after ~1 year.
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/versioning
 */
export const LINKEDIN_API_VERSION = '202601'

/**
 * Request body for initializing a document upload on LinkedIn
 */
export interface LinkedInInitializeDocumentUploadRequest {
  initializeUploadRequest: {
    owner: string
  }
}

/**
 * Response from LinkedIn document upload initialization
 */
export interface LinkedInInitializeDocumentUploadResponse {
  value: {
    uploadUrl: string
    document: string
  }
}

/**
 * Request body for creating a post via the LinkedIn REST API (/rest/posts)
 */
export interface LinkedInRestPostRequest {
  author: string
  commentary: string
  visibility: 'PUBLIC' | 'CONNECTIONS'
  distribution: {
    feedDistribution: 'MAIN_FEED'
    targetEntities: never[]
    thirdPartyDistributionChannels: never[]
  }
  content?: {
    media: {
      title: string
      id: string
    }
  }
  lifecycleState: 'PUBLISHED'
  isReshareDisabledByAuthor: boolean
}

/**
 * Response from creating a post via the LinkedIn REST API
 */
export interface LinkedInRestPostResponse {
  success: boolean
  id?: string | null
  status?: number
}

/**
 * Request for creating a document post (client-facing)
 */
export interface CreateDocumentPostRequest {
  /** Post caption text */
  content: string
  /** Post visibility */
  visibility?: LinkedInVisibility
  /** PDF binary data as Buffer */
  pdfBuffer: Buffer
  /** Display title for the document in the post */
  documentTitle?: string
}

/**
 * Progress stages for document posting flow
 */
export type DocumentPostStage =
  | 'generating-pdf'
  | 'uploading-document'
  | 'creating-post'
  | 'complete'
  | 'error'
