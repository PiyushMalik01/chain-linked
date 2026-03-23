/**
 * LinkedIn Integration Module
 * @description Central export for LinkedIn API functionality
 * @module lib/linkedin
 */

// Export types
export * from './types'

// Export OAuth functions
export {
  getLinkedInConfig,
  generateState,
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  getLinkedInUserInfo,
  getLinkedInUserInfoFromTokens,
  decodeIdToken,
  isTokenExpired,
  calculateExpiresAt,
  getValidAccessToken,
} from './oauth'

// Export API client
export {
  LinkedInApiClient,
  createLinkedInClient,
} from './api-client'

// Export post functions
export {
  MAX_POST_LENGTH,
  MAX_IMAGES_PER_POST,
  SUPPORTED_IMAGE_TYPES,
  validatePostContent,
  uploadImageFromBuffer,
  uploadImage,
  uploadImages,
  createTextPost,
  createImagePost,
  createPost,
  extractPostIdFromUrn,
  buildPostUrl,
} from './post'

// Export mention utilities
export {
  MENTION_REGEX,
  parseMentions,
  mentionsToPlainText,
  buildUgcMentionAttributes,
  hasMentions,
  buildMentionToken,
  countCharactersWithMentions,
} from './mentions'
export type { ParsedMention, MentionAttribute } from './mentions'

// Export document post functions
export {
  MAX_DOCUMENT_SIZE_BYTES,
  initializeDocumentUpload,
  uploadDocumentBinary,
  createRestPost,
  postDocument,
} from './document-post'

// ==========================================
// Voyager API (Fallback) Exports
// ==========================================

// Export Voyager types
export type {
  LinkedInCredentials,
  ProxyConfig,
  RateLimitConfig as VoyagerRateLimitConfig,
  RetryConfig as VoyagerRetryConfig,
  VoyagerRequestOptions,
  VoyagerResponse,
  VoyagerError,
  VoyagerProfile,
  VoyagerMediaContent,
  VoyagerImageArtifact,
  VoyagerPostRequest,
  VoyagerPostResponse,
  VoyagerAnalyticsSummary,
  VoyagerPostAnalytics,
  VoyagerDemographics,
  VoyagerDemographicItem,
  VoyagerFeedUpdate,
  VoyagerActor,
  VoyagerSocialDetail,
  VoyagerReactionCount,
  VoyagerContent,
  VoyagerArticle,
  VoyagerImage,
  VoyagerVideo,
  FallbackTrigger,
  CookieValidationResult,
  RateLimitState,
} from './voyager-types'

// Export Voyager client
export { VoyagerClient, createVoyagerClient } from './voyager-client'

// Export Voyager post service
export {
  VoyagerPostService,
  createVoyagerPostService,
  createPost as createVoyagerPost,
  deletePost as deleteVoyagerPost,
  editPost as editVoyagerPost,
  requestMediaUpload,
  type CreatePostOptions as VoyagerCreatePostOptions,
  type CreatePostResult as VoyagerCreatePostResult,
} from './voyager-post'

// Export Voyager metrics service
export {
  VoyagerMetricsService,
  createVoyagerMetricsService,
  fetchAnalyticsSummary,
  fetchPostAnalytics,
  fetchProfile,
  fetchRecentPosts,
  fetchProfileStatistics,
  type AnalyticsPeriod,
  type ProfileMetrics,
  type ContentAnalytics,
  type PostAnalyticsItem,
  type AudienceInsights,
} from './voyager-metrics'

// Export unified LinkedIn service with fallback support
export {
  LinkedInService,
  createLinkedInService,
  type FallbackConfig,
  type ServiceResult,
  type PostServiceResult,
} from './linkedin-service'

// Export Voyager constants
export {
  VOYAGER_BASE_URL,
  VOYAGER_API_VERSION,
  VOYAGER_ENDPOINTS,
  getVoyagerHeaders,
  DEFAULT_USER_AGENT,
  RATE_LIMITS as VOYAGER_RATE_LIMITS,
  DEFAULT_RETRY_CONFIG as VOYAGER_DEFAULT_RETRY_CONFIG,
  REQUEST_TIMEOUT_MS,
  FALLBACK_TRIGGER_STATUS_CODES,
  VOYAGER_ERROR_CODES,
  LINKEDIN_COOKIE_NAMES,
  MIN_REQUEST_DELAY_MS,
  MAX_REQUEST_DELAY_MS,
  POST_VISIBILITY,
  MEDIA_CATEGORIES,
  ANALYTICS_PERIODS,
} from './voyager-constants'
