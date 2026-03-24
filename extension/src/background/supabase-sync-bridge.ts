/**
 * Supabase Sync Bridge
 * @description TypeScript bridge to connect service worker storage to Supabase sync
 * @module background/supabase-sync-bridge
 */

// Storage keys that should sync to Supabase
export const SYNCABLE_STORAGE_KEYS = [
  'linkedin_profile',
  'linkedin_analytics',
  'linkedin_post_analytics',
  'linkedin_audience',
  'linkedin_connections',
  'linkedin_feed_posts',
  'linkedin_my_posts',
  'linkedin_comments',
  'linkedin_followers',
  'linkedin_posts',
  'captured_apis',
  'auto_capture_stats',
  'extension_settings',
  // History tables for trend tracking
  'linkedin_analytics_history',
  'linkedin_audience_history',
] as const;

export type SyncableStorageKey = typeof SYNCABLE_STORAGE_KEYS[number];

// Storage key to Supabase table mapping
export const STORAGE_TABLE_MAP: Record<string, string> = {
  'linkedin_profile': 'linkedin_profiles',
  'linkedin_analytics': 'linkedin_analytics',
  'linkedin_post_analytics': 'post_analytics',
  'linkedin_audience': 'audience_data',
  'linkedin_connections': 'connections',
  'linkedin_feed_posts': 'feed_posts',
  'linkedin_my_posts': 'my_posts',
  'linkedin_posts': 'my_posts',
  'linkedin_comments': 'comments',
  'linkedin_followers': 'followers',
  'captured_apis': 'captured_apis',
  'auto_capture_stats': 'capture_stats',
  'extension_settings': 'extension_settings',
  // History tables for trend tracking
  'linkedin_analytics_history': 'analytics_history',
  'linkedin_audience_history': 'audience_history',
};

// Field mapping for camelCase to snake_case conversion
export const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  'linkedin_profiles': {
    'linkedinId': 'linkedin_id',
    'firstName': 'first_name',
    'lastName': 'last_name',
    'fullName': 'full_name',
    'name': 'full_name',  // alias
    'profilePicture': 'profile_picture_url',
    'profilePictureUrl': 'profile_picture_url',
    'profilePhoto': 'profile_picture_url',  // alias
    'publicIdentifier': 'public_identifier',
    'memberUrn': 'profile_urn',
    'profileUrn': 'profile_urn',
    'entityUrn': 'profile_urn',
    'connectionCount': 'connections_count',
    'connectionsCount': 'connections_count',
    'followerCount': 'followers_count',
    'followersCount': 'followers_count',
    'profileUrl': 'profile_url',
    'backgroundImage': 'background_image_url',
    'backgroundImageUrl': 'background_image_url',
    'aboutSection': 'summary',
    'about': 'summary',  // alias
    // Note: 'location' and 'industry' are already snake_case, no mapping needed
    // Identity mappings (key === value) cause the delete step to remove the field
  },
  'linkedin_analytics': {
    // Actual DB columns: page_type, impressions, members_reached, engagements,
    // new_followers, profile_views, search_appearances, top_posts, raw_data,
    // captured_at, updated_at
    'membersReached': 'members_reached',
    'profileViews': 'profile_views',
    'searchAppearances': 'search_appearances',
    'newFollowers': 'new_followers',
    'capturedAt': 'captured_at',
    'lastUpdated': 'updated_at',
    'topPosts': 'top_posts',
    'pageType': 'page_type',
    'rawData': 'raw_data',
    // Note: 'impressions', 'engagements' are already snake_case, no mapping needed
  },
  'post_analytics': {
    // Actual DB columns: activity_urn, post_content, post_type, impressions,
    // members_reached, unique_views, reactions, comments, reposts, saves, sends,
    // engagement_rate, profile_viewers, followers_gained, demographics,
    // raw_data, posted_at, captured_at, updated_at
    'activityUrn': 'activity_urn',
    'postText': 'post_content',
    'text': 'post_content',
    'commentary': 'post_content',
    'postType': 'post_type',
    'impressionCount': 'impressions',
    'numImpressions': 'impressions',
    'likeCount': 'reactions',
    'numLikes': 'reactions',
    'reactionCount': 'reactions',
    'commentCount': 'comments',
    'numComments': 'comments',
    'repostCount': 'reposts',
    'numShares': 'reposts',
    'shareCount': 'reposts',
    'saveCount': 'saves',
    'sendCount': 'sends',
    'membersReached': 'members_reached',
    'uniqueViews': 'unique_views',
    'profileViewers': 'profile_viewers',
    'followersGained': 'followers_gained',
    'engagementRate': 'engagement_rate',
    'postedAt': 'posted_at',
    'capturedAt': 'captured_at',
    'rawData': 'raw_data',
  },
  'audience_data': {
    // Actual DB columns: total_followers, follower_growth, demographics_preview,
    // top_job_titles, top_companies, top_locations, top_industries,
    // raw_data, captured_at, updated_at
    'totalFollowers': 'total_followers',
    'followerGrowth': 'follower_growth',
    'demographicsPreview': 'demographics_preview',
    'topJobTitles': 'top_job_titles',
    'topCompanies': 'top_companies',
    'topLocations': 'top_locations',
    'topIndustries': 'top_industries',
    'capturedAt': 'captured_at',
    'rawData': 'raw_data',
  },
  'connections': {
    // Actual DB columns: linkedin_id, first_name, last_name, headline,
    // profile_picture, public_identifier, connected_at, connection_degree (INTEGER),
    // raw_data, created_at, updated_at
    'linkedinId': 'linkedin_id',
    'firstName': 'first_name',
    'lastName': 'last_name',
    'profilePicture': 'profile_picture',
    'profilePictureUrl': 'profile_picture',
    'publicIdentifier': 'public_identifier',
    'connectedAt': 'connected_at',
    'connectionDegree': 'connection_degree',
    'capturedAt': 'created_at',
  },
  'feed_posts': {
    // Actual DB columns: activity_urn, author_urn, author_name, author_headline,
    // author_profile_url, content, hashtags, media_type, media_urls, reactions, comments,
    // reposts, engagement_score, posted_at, raw_data, created_at, updated_at
    'authorId': 'author_urn',
    'authorUrn': 'author_urn',
    'authorName': 'author_name',
    'authorHeadline': 'author_headline',
    'authorProfilePicture': 'author_profile_url',
    'authorProfileUrl': 'author_profile_url',
    'postText': 'content',
    'text': 'content',
    'commentary': 'content',
    'activityUrn': 'activity_urn',
    'likeCount': 'reactions',
    'numLikes': 'reactions',
    'reactionCount': 'reactions',
    'commentCount': 'comments',
    'numComments': 'comments',
    'repostCount': 'reposts',
    'numShares': 'reposts',
    'shareCount': 'reposts',
    'mediaType': 'media_type',
    'mediaUrls': 'media_urls',
    'engagementScore': 'engagement_score',
    'postedAt': 'posted_at',
    'capturedAt': 'created_at',
  },
  'my_posts': {
    // Actual DB columns: activity_urn, content, media_type, media_urls, reactions, comments,
    // reposts, impressions, saves, sends, unique_views, engagement_rate, posted_at, raw_data, created_at, updated_at
    'activityUrn': 'activity_urn',
    'postText': 'content',
    'text': 'content',
    'commentary': 'content',
    'impressionCount': 'impressions',
    'numImpressions': 'impressions',
    'likeCount': 'reactions',
    'numLikes': 'reactions',
    'reactionCount': 'reactions',
    'commentCount': 'comments',
    'numComments': 'comments',
    'repostCount': 'reposts',
    'numShares': 'reposts',
    'shareCount': 'reposts',
    'saveCount': 'saves',
    'sendCount': 'sends',
    'uniqueImpressionCount': 'unique_views',
    'engagementRate': 'engagement_rate',
    'mediaType': 'media_type',
    'mediaUrls': 'media_urls',
    'postedAt': 'posted_at',
    'capturedAt': 'created_at',
  },
  'comments': {
    // Actual DB columns: activity_urn, author_name, author_headline,
    // author_profile_url, content, comment_urn, parent_urn, reactions,
    // posted_at, raw_data, created_at, updated_at
    'activityUrn': 'activity_urn',
    'commentUrn': 'comment_urn',
    'parentUrn': 'parent_urn',
    'authorName': 'author_name',
    'authorHeadline': 'author_headline',
    'authorProfileUrl': 'author_profile_url',
    'commentText': 'content',
    'text': 'content',
    'likeCount': 'reactions',
    'reactionCount': 'reactions',
    'postedAt': 'posted_at',
    'capturedAt': 'created_at',
  },
  'followers': {
    // Actual DB columns: linkedin_id, first_name, last_name, headline,
    // profile_picture, public_identifier, followed_at, raw_data, created_at, updated_at
    'linkedinId': 'linkedin_id',
    'firstName': 'first_name',
    'lastName': 'last_name',
    'profilePicture': 'profile_picture',
    'profilePictureUrl': 'profile_picture',
    'publicIdentifier': 'public_identifier',
    'followedAt': 'followed_at',
    'capturedAt': 'created_at',
  },
  'captured_apis': {
    // Service worker stores: { endpoint, method, url, data, category, capturedAt }
    'data': 'response_data',
    'capturedAt': 'captured_at',
  },
  'capture_stats': {
    // Actual DB columns: date, api_calls_captured, feed_posts_captured,
    // analytics_captures, dom_extractions, created_at, updated_at
    'apiCallsCaptured': 'api_calls_captured',
    'feedPostsCaptured': 'feed_posts_captured',
    'analyticsCaptures': 'analytics_captures',
    'domExtractions': 'dom_extractions',
    'capturedAt': 'created_at',
  },
  'extension_settings': {
    'autoCapture': 'auto_capture_enabled',
    'storeImages': 'store_images',
    'captureNotifications': 'capture_notifications',
    'growthAlerts': 'growth_alerts',
    'captureFeed': 'capture_feed',
    'captureAnalytics': 'capture_analytics',
    'captureProfile': 'capture_profile',
    'captureMessaging': 'capture_messaging',
    'syncEnabled': 'sync_enabled',
    'syncInterval': 'sync_interval',
    'darkMode': 'dark_mode',
    'notificationsEnabled': 'notifications_enabled',
  },
  // Analytics history field mappings
  'analytics_history': {
    'membersReached': 'members_reached',
    'profileViews': 'profile_views',
    // Note: topPostsCount column does not exist in database
  },
  // Audience history field mappings
  'audience_history': {
    'totalFollowers': 'total_followers',
    'newFollowers': 'new_followers',
    // Note: follower_growth column does not exist in database
  },
};

// Known columns for each table - used to filter unknown fields
// IMPORTANT: Only include columns that actually exist in the database schema
// Verified against Supabase schema on 2026-01-31
export const TABLE_COLUMNS: Record<string, string[]> = {
  'linkedin_profiles': [
    // Verified columns from database schema
    'id', 'user_id', 'profile_urn', 'public_identifier', 'first_name', 'last_name',
    'headline', 'location', 'industry', 'profile_picture_url', 'background_image_url',
    'connections_count', 'followers_count', 'summary', 'raw_data',
    'captured_at', 'updated_at',
    // Note: linkedin_id, full_name, profile_url, created_at do NOT exist in database
  ],
  'linkedin_analytics': [
    // Verified columns from database schema
    'id', 'user_id', 'page_type', 'impressions', 'members_reached', 'engagements',
    'new_followers', 'profile_views', 'search_appearances', 'top_posts', 'raw_data',
    'captured_at', 'updated_at',
    // Note: engagement_rate, impression_growth, growth_percentage, post_count,
    // reaction_count, comment_count, share_count, created_at do NOT exist in database
  ],
  'post_analytics': [
    // Verified columns from database schema
    'id', 'user_id', 'activity_urn', 'post_content', 'post_type', 'impressions',
    'members_reached', 'unique_views', 'reactions', 'comments', 'reposts',
    'engagement_rate', 'profile_viewers', 'followers_gained', 'demographics',
    'raw_data', 'posted_at', 'captured_at', 'updated_at',
  ],
  'audience_data': [
    // Verified columns from database schema
    'id', 'user_id', 'total_followers', 'follower_growth',
    'demographics_preview', 'top_job_titles', 'top_companies', 'top_locations',
    'top_industries', 'raw_data', 'captured_at', 'updated_at',
    // Note: follower_growth_formatted does NOT exist in database
  ],
  'extension_settings': [
    'id', 'user_id', 'auto_capture_enabled', 'capture_feed', 'capture_analytics',
    'capture_profile', 'capture_messaging', 'sync_enabled', 'sync_interval',
    'dark_mode', 'notifications_enabled', 'raw_settings', 'created_at', 'updated_at',
  ],
  // Verified against live Supabase schema on 2026-02-13
  'feed_posts': [
    'id', 'user_id', 'activity_urn', 'author_urn', 'author_name', 'author_headline',
    'author_profile_url', 'content', 'hashtags', 'media_type', 'media_urls', 'reactions', 'comments',
    'reposts', 'engagement_score', 'posted_at', 'raw_data', 'created_at', 'updated_at',
  ],
  'my_posts': [
    'id', 'user_id', 'activity_urn', 'content', 'media_type', 'media_urls', 'reactions', 'comments',
    'reposts', 'impressions', 'posted_at', 'raw_data', 'created_at', 'updated_at', 'source',
  ],
  'comments': [
    'id', 'user_id', 'activity_urn', 'author_name', 'author_headline',
    'author_profile_url', 'content', 'comment_urn', 'parent_urn', 'reactions',
    'posted_at', 'raw_data', 'created_at', 'updated_at',
  ],
  'connections': [
    'id', 'user_id', 'linkedin_id', 'first_name', 'last_name', 'headline',
    'profile_picture', 'public_identifier', 'connected_at', 'connection_degree',
    'raw_data', 'created_at', 'updated_at',
  ],
  'followers': [
    'id', 'user_id', 'linkedin_id', 'first_name', 'last_name', 'headline',
    'profile_picture', 'public_identifier', 'followed_at', 'raw_data',
    'created_at', 'updated_at',
  ],
  'captured_apis': [
    'id', 'user_id', 'category', 'endpoint', 'method', 'response_hash',
    'response_data', 'captured_at',
  ],
  'capture_stats': [
    'id', 'user_id', 'date', 'api_calls_captured', 'feed_posts_captured',
    'analytics_captures', 'dom_extractions', 'created_at', 'updated_at',
  ],
  // Analytics history table for trend tracking
  'analytics_history': [
    'id', 'user_id', 'date', 'impressions', 'members_reached', 'engagements',
    'followers', 'profile_views', 'created_at',
  ],
  // Audience history table for follower trend tracking
  'audience_history': [
    'id', 'user_id', 'date', 'total_followers', 'new_followers', 'created_at',
  ],
};

/**
 * Interface for pending sync changes
 */
interface PendingChange {
  table: string;
  operation: 'upsert' | 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  localKey: string;
  timestamp: number;
}

/**
 * Interface for sync status
 */
export interface SyncStatus {
  isAuthenticated: boolean;
  userId: string | null;
  pendingCount: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
}

/**
 * Current user ID for sync operations
 */
let currentUserId: string | null = null;
let isSyncing = false;
let lastSyncTime: number | null = null;

/**
 * Check if a storage key should be synced to Supabase
 */
export function isSyncableKey(key: string): boolean {
  if (SYNCABLE_STORAGE_KEYS.includes(key as SyncableStorageKey)) return true;
  // Also sync captured_apis_{category} keys to the captured_apis table
  if (key.startsWith('captured_apis_')) return true;
  return false;
}

/**
 * Get the Supabase table name for a storage key
 */
export function getTableForKey(key: string): string | null {
  if (STORAGE_TABLE_MAP[key]) return STORAGE_TABLE_MAP[key];
  // Map captured_apis_{category} keys to the captured_apis table
  if (key.startsWith('captured_apis_')) return 'captured_apis';
  return null;
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function prepareForSupabase(
  data: Record<string, unknown>,
  table: string,
  userId: string | null
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;

  // If data is an array, unwrap the first element (e.g. analytics_history arrives as [{date:..., impressions:...}])
  if (Array.isArray(data)) {
    if (data.length === 0) return {};
    console.log(`[SYNC][PREPARE] Unwrapping array of ${data.length} items for ${table}`);
    return prepareForSupabase(data[0] as Record<string, unknown>, table, userId);
  }

  // If data is an array-like object with numeric keys ({"0": {...}, "1": {...}}),
  // this is a corrupted queue entry where an array was stored as an object.
  // Skip it entirely — these records should have been split at queue time.
  const dataKeys = Object.keys(data);
  if (dataKeys.length > 0 && dataKeys.every(k => /^\d+$/.test(k)) && typeof data[dataKeys[0]] === 'object' && data[dataKeys[0]] !== null) {
    console.warn(`[SYNC][PREPARE] Skipping array-like object with ${dataKeys.length} items for ${table} — should have been split at queue time`);
    return { __skip: true } as unknown as Record<string, unknown>;
  }

  // Log input data for debugging
  console.log(`[SYNC][PREPARE] Input data for ${table}:`, JSON.stringify(data, null, 2));

  const prepared: Record<string, unknown> = { ...data };

  // ── Flatten nested objects for post_analytics ──
  // The DOM extractor stores engagement metrics in nested objects:
  //   { engagement: { reactions, comments, reposts }, profileActivity: { profileViewers, followersGained } }
  // These must be flattened to top-level keys before field mapping can work.
  if (table === 'post_analytics') {
    const engagement = prepared.engagement as Record<string, unknown> | undefined;
    if (engagement && typeof engagement === 'object') {
      if (engagement.reactions !== undefined && engagement.reactions !== null) {
        prepared.reactions = Number(engagement.reactions);
      }
      if (engagement.comments !== undefined && engagement.comments !== null) {
        prepared.comments = Number(engagement.comments);
      }
      if (engagement.reposts !== undefined && engagement.reposts !== null) {
        prepared.reposts = Number(engagement.reposts);
      }
      delete prepared.engagement;
      console.log('[SYNC][PREPARE] Flattened engagement object for post_analytics');
    }

    const profileActivity = prepared.profileActivity as Record<string, unknown> | undefined;
    if (profileActivity && typeof profileActivity === 'object') {
      if (profileActivity.profileViewers !== undefined && profileActivity.profileViewers !== null) {
        prepared.profileViewers = Number(profileActivity.profileViewers);
      }
      if (profileActivity.followersGained !== undefined && profileActivity.followersGained !== null) {
        prepared.followersGained = Number(profileActivity.followersGained);
      }
      delete prepared.profileActivity;
      console.log('[SYNC][PREPARE] Flattened profileActivity object for post_analytics');
    }

    // Ensure numeric types for post_analytics metric fields
    const numericPostFields = ['impressions', 'reactions', 'comments', 'reposts',
      'members_reached', 'unique_views', 'profile_viewers', 'followers_gained'];
    for (const field of numericPostFields) {
      if (prepared[field] !== undefined && prepared[field] !== null) {
        const val = Number(prepared[field]);
        prepared[field] = isNaN(val) ? null : val;
      }
    }

    // Convert engagementRate string (e.g. "3.45") to number
    if (typeof prepared.engagementRate === 'string') {
      const parsed = parseFloat((prepared.engagementRate as string).replace('%', ''));
      prepared.engagementRate = isNaN(parsed) ? null : parsed;
    }

    // Remove DOM extractor internal fields before mapping
    delete prepared.extractedAt;
  }

  // Tables that use user_id as conflict key - don't include 'id' field
  // This lets PostgreSQL handle id auto-generation and proper upsert behavior
  const userIdConflictTables = ['linkedin_profiles', 'audience_data', 'extension_settings'];

  if (userIdConflictTables.includes(table)) {
    // Remove id field for user_id conflict tables - let DB handle it
    delete prepared.id;
  } else {
    // Generate UUID if missing (required for upsert with onConflict: 'id')
    if (!prepared.id) {
      prepared.id = generateUUID();
    }
  }

  // Add user_id if authenticated
  if (userId) {
    prepared.user_id = userId;
  }

  const now = new Date().toISOString();

  // Tables that have created_at but NOT captured_at
  const tablesWithCreatedAtOnly = [
    'feed_posts', 'my_posts', 'comments', 'connections', 'followers',
    'capture_stats',
  ];
  // Tables that have both created_at and captured_at
  const tablesWithBoth = ['extension_settings'];
  // Tables that have captured_at but NOT created_at
  const tablesWithCapturedAtOnly = [
    'linkedin_profiles', 'linkedin_analytics', 'post_analytics',
    'audience_data', 'captured_apis',
  ];

  // Add appropriate timestamps based on actual table schema
  if (tablesWithCreatedAtOnly.includes(table)) {
    if (!prepared.created_at) prepared.created_at = now;
    // Remove captured_at as these tables don't have that column
    delete prepared.captured_at;
  } else if (tablesWithBoth.includes(table)) {
    if (!prepared.created_at) prepared.created_at = now;
    if (!prepared.captured_at) prepared.captured_at = now;
  } else if (tablesWithCapturedAtOnly.includes(table)) {
    if (!prepared.captured_at) prepared.captured_at = now;
  } else {
    // Default: add captured_at
    if (!prepared.captured_at) prepared.captured_at = now;
  }
  prepared.updated_at = now;

  // Apply field mappings for the specific table
  const mapping = FIELD_MAPPINGS[table];
  if (mapping) {
    for (const [camelCase, snakeCase] of Object.entries(mapping)) {
      if (prepared[camelCase] !== undefined) {
        prepared[snakeCase] = prepared[camelCase];
        delete prepared[camelCase];
      }
    }
  }

  // Remove internal fields that shouldn't go to Supabase
  delete prepared._localId;
  delete prepared._pendingSync;
  delete prepared.source;

  // Data type conversions for specific tables
  if (table === 'audience_data') {
    // Convert follower_growth from string like "0%" or "302.9%" to integer
    if (typeof prepared.follower_growth === 'string') {
      const growthStr = prepared.follower_growth as string;
      const numericValue = parseFloat(growthStr.replace('%', ''));
      prepared.follower_growth = isNaN(numericValue) ? null : Math.round(numericValue);
      // Note: follower_growth_formatted removed - column does not exist in database
      // The formatted string is preserved in raw_data if needed
    }
  }

  // Ensure numeric fields are numbers for linkedin_analytics
  if (table === 'linkedin_analytics') {
    // Background sync already converts some fields to snake_case (members_reached, new_followers).
    // Also handle any lingering camelCase variants that didn't go through field mapping.
    const snakeCaseAliases: Record<string, string> = {
      'profileViews': 'profile_views',
      'searchAppearances': 'search_appearances',
      'membersReached': 'members_reached',
      'newFollowers': 'new_followers',
    };
    for (const [camel, snake] of Object.entries(snakeCaseAliases)) {
      if (prepared[camel] !== undefined && prepared[snake] === undefined) {
        prepared[snake] = prepared[camel];
        delete prepared[camel];
      }
    }

    // Only include columns that actually exist in the database
    const numericFields = [
      'impressions', 'engagements', 'members_reached', 'profile_views',
      'search_appearances', 'new_followers',
    ];
    numericFields.forEach(field => {
      if (prepared[field] !== undefined) {
        const val = typeof prepared[field] === 'string'
          ? parseInt((prepared[field] as string).replace(/,/g, ''), 10)
          : Number(prepared[field]);
        prepared[field] = isNaN(val) ? 0 : val;
      }
    });
    // Handle engagement_rate as float
    if (prepared.engagement_rate !== undefined && typeof prepared.engagement_rate === 'string') {
      const strValue = prepared.engagement_rate as string;
      const parsed = parseFloat(strValue.replace(/[%,]/g, ''));
      prepared.engagement_rate = isNaN(parsed) ? 0 : parsed;
    }
  }

  // Ensure numeric fields are numbers for linkedin_profiles
  if (table === 'linkedin_profiles') {
    const numericFields = ['connections_count', 'followers_count'];
    numericFields.forEach(field => {
      if (prepared[field] !== undefined && typeof prepared[field] === 'string') {
        const strValue = prepared[field] as string;
        const parsed = parseInt(strValue.replace(/,/g, ''), 10);
        prepared[field] = isNaN(parsed) ? 0 : parsed;
        console.log(`[SYNC][PREPARE] Converted ${field} from "${strValue}" to ${prepared[field]}`);
      }
    });
  }

  // Convert timestamp fields from Unix milliseconds to ISO 8601 strings
  // PostgreSQL timestamptz columns cannot accept raw millisecond integers
  const timestampFields = ['posted_at', 'connected_at', 'followed_at'];
  for (const field of timestampFields) {
    if (prepared[field] !== undefined && typeof prepared[field] === 'number') {
      const ms = prepared[field] as number;
      // Validate reasonable range (2010-2040) before converting
      if (ms > 1262304000000 && ms < 2208988800000) {
        prepared[field] = new Date(ms).toISOString();
      } else {
        // Out of range — drop it rather than sending bad data
        console.warn(`[SYNC][PREPARE] Dropping ${field}=${ms} (out of range) for ${table}`);
        delete prepared[field];
      }
    }
  }

  // Table-specific defaults for required NOT NULL columns.
  // Ensures stale or incomplete data doesn't fail the INSERT.
  if (table === 'linkedin_analytics' && !prepared.page_type) {
    prepared.page_type = 'profile_views';
  }

  // Filter to only known columns for this table
  const knownColumns = TABLE_COLUMNS[table];
  if (knownColumns) {
    const filtered: Record<string, unknown> = {};
    const unknownFields: string[] = [];
    for (const key of Object.keys(prepared)) {
      if (knownColumns.includes(key)) {
        filtered[key] = prepared[key];
      } else {
        unknownFields.push(key);
        // Store unknown fields in raw_data if the table supports it
        if (knownColumns.includes('raw_data') || knownColumns.includes('raw_settings')) {
          const rawKey = knownColumns.includes('raw_settings') ? 'raw_settings' : 'raw_data';
          if (!filtered[rawKey]) {
            filtered[rawKey] = {};
          }
          (filtered[rawKey] as Record<string, unknown>)[key] = prepared[key];
        }
      }
    }
    if (unknownFields.length > 0) {
      console.log(`[SYNC][PREPARE] Unknown fields for ${table} moved to raw_data:`, unknownFields);
    }
    console.log(`[SYNC][PREPARE] Output data for ${table}:`, JSON.stringify(filtered, null, 2));
    return filtered;
  }

  console.log(`[SYNC][PREPARE] Output data for ${table} (no column filter):`, JSON.stringify(prepared, null, 2));
  return prepared;
}

/**
 * Get pending changes from storage
 */
async function getPendingChanges(): Promise<PendingChange[]> {
  try {
    const result = await chrome.storage.local.get('supabase_pending_changes');
    return result.supabase_pending_changes || [];
  } catch (error) {
    console.error('[SyncBridge] Error getting pending changes:', error);
    return [];
  }
}

/**
 * Save pending changes to storage
 */
async function savePendingChanges(changes: PendingChange[]): Promise<void> {
  try {
    await chrome.storage.local.set({ supabase_pending_changes: changes });
  } catch (error) {
    console.error('[SyncBridge] Error saving pending changes:', error);
  }
}

/**
 * Queue data for sync to Supabase
 */
export async function queueForSync(
  localKey: string,
  data: Record<string, unknown>,
  operation: 'upsert' | 'insert' | 'update' = 'upsert'
): Promise<void> {
  const table = getTableForKey(localKey);
  if (!table) {
    console.log(`[SyncBridge] No table mapping for key: ${localKey}`);
    return;
  }

  // Multi-record tables (feed_posts, my_posts, comments, connections, followers)
  // may receive data as an array-like object with numeric keys: {"0": {...}, "1": {...}}
  // or as an actual Array. Detect this and queue each record individually.
  const multiRecordTables = ['feed_posts', 'my_posts', 'comments', 'connections', 'followers', 'post_analytics'];
  if (multiRecordTables.includes(table)) {
    const keys = Object.keys(data);
    const isArrayLike = keys.length > 0 && keys.every(k => /^\d+$/.test(k)) && typeof data[keys[0]] === 'object' && data[keys[0]] !== null;
    if (isArrayLike || Array.isArray(data)) {
      const items = Array.isArray(data) ? data : keys.map(k => data[k]);
      console.log(`[SyncBridge] Splitting ${items.length} records for ${table} into individual queue entries`);
      for (const item of items) {
        if (item && typeof item === 'object') {
          await queueForSync(localKey, item as Record<string, unknown>, operation);
        }
      }
      return;
    }
  }

  // Strip large fields before queueing to prevent storage quota issues
  // raw_data, included, data blobs can be 50-200KB+ each
  const MAX_QUEUE_ITEM_SIZE = 50_000; // 50KB limit per queued item
  let syncData = data;
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_QUEUE_ITEM_SIZE) {
    syncData = { ...data };
    // Strip known large fields in priority order
    const largeFields = ['raw_data', 'included', 'data', 'elements', 'rawData', 'responseData', 'response_data'];
    for (const field of largeFields) {
      if (syncData[field] !== undefined) {
        delete syncData[field];
      }
    }
    const newSize = JSON.stringify(syncData).length;
    console.log(`[CL:SYNC] --- TRIMMED: table=${table} ${serialized.length}→${newSize} bytes (stripped large fields)`);
  }

  const pendingChanges = await getPendingChanges();

  const change: PendingChange = {
    table,
    operation,
    data: syncData,
    localKey,
    timestamp: Date.now(),
  };

  // For multi-record tables, dedup by unique record identifiers (activity_urn, comment_urn, linkedin_id)
  // so that different records for the same table don't overwrite each other in the queue
  // Check both camelCase and snake_case variants of unique identifiers
  const recordId = (data.activity_urn || data.activityUrn || data.comment_urn || data.commentUrn || data.linkedin_id || data.linkedinId || '') as string;

  const existingIndex = pendingChanges.findIndex((c) => {
    if (c.localKey !== localKey || c.table !== table) return false;
    if (recordId) {
      // For records with unique IDs, only match if same record
      const existingRecordId = (c.data.activity_urn || c.data.activityUrn || c.data.comment_urn || c.data.commentUrn || c.data.linkedin_id || c.data.linkedinId || '') as string;
      return existingRecordId === recordId;
    }
    // For single-record tables (profile, settings), match by key alone
    return true;
  });

  if (existingIndex >= 0) {
    // Update existing pending change
    pendingChanges[existingIndex] = change;
  } else {
    // Add new pending change
    pendingChanges.push(change);
  }

  await savePendingChanges(pendingChanges);
  console.log(`[CL:SYNC] >>> QUEUED: key=${localKey} table=${table} recordId=${recordId || 'none'} pending_total=${pendingChanges.length}`);

  // Notify popup about pending change
  try {
    chrome.runtime.sendMessage({
      type: 'PENDING_CHANGE_ADDED',
      count: pendingChanges.length,
    }).catch(() => {}); // Ignore if no listener
  } catch {
    // Ignore errors when popup is closed
  }
}

/**
 * Save data to local storage and queue for sync
 */
export async function saveWithSync<T extends Record<string, unknown>>(
  key: string,
  data: T,
  skipSync = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Always save to local storage first
    await chrome.storage.local.set({ [key]: data });

    // Queue for sync if this is a syncable key and sync is not skipped
    if (!skipSync && isSyncableKey(key) && currentUserId) {
      await queueForSync(key, data);

      // Trigger immediate sync (don't wait for periodic sync)
      // Use setTimeout to avoid blocking the save operation
      setTimeout(async () => {
        try {
          const result = await processPendingChanges();
          console.log(`[SyncBridge] Immediate sync complete: ${result.success} success, ${result.failed} failed`);
        } catch (err) {
          console.error('[SyncBridge] Immediate sync error:', err);
        }
      }, 100);
    }

    return { success: true };
  } catch (error) {
    console.error('[SyncBridge] Save error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Append data to array in storage and queue for sync
 */
export async function appendWithSync<T extends Record<string, unknown>>(
  key: string,
  newData: T,
  maxItems = 1000,
  skipSync = false
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const result = await chrome.storage.local.get(key);
    let currentArray: T[] = result[key] || [];

    const dataWithTimestamp = {
      ...newData,
      capturedAt: new Date().toISOString(),
    } as T;

    // Check for duplicates (by id or activityUrn)
    const idField = 'id' in newData ? 'id' : 'activityUrn' in newData ? 'activityUrn' : null;
    if (idField && newData[idField]) {
      const existingIndex = currentArray.findIndex(
        (item) => item[idField] === newData[idField]
      );
      if (existingIndex >= 0) {
        currentArray[existingIndex] = dataWithTimestamp;
      } else {
        currentArray.push(dataWithTimestamp);
      }
    } else {
      currentArray.push(dataWithTimestamp);
    }

    // Trim array to max items
    currentArray = currentArray.slice(-maxItems);

    // Save to local storage
    await chrome.storage.local.set({ [key]: currentArray });

    // Queue for sync if this is a syncable key
    if (!skipSync && isSyncableKey(key) && currentUserId) {
      // For arrays, we queue the individual item, not the whole array
      await queueForSync(key, dataWithTimestamp);
    }

    return { success: true, count: currentArray.length };
  } catch (error) {
    console.error('[SyncBridge] Append error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process all pending changes and sync to Supabase
 */
export async function processPendingChanges(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  if (isSyncing) {
    console.log('[SyncBridge] Sync already in progress');
    return { success: 0, failed: 0, errors: ['Sync already in progress'] };
  }

  if (!navigator.onLine) {
    console.log('[SyncBridge] Offline - skipping sync');
    return { success: 0, failed: 0, errors: ['Offline'] };
  }

  if (!currentUserId) {
    console.log('[SyncBridge] Not authenticated - skipping sync');
    return { success: 0, failed: 0, errors: ['Not authenticated'] };
  }

  // Ensure JWT is fresh before attempting sync
  try {
    const supabaseAuth = (self as unknown as { supabaseAuth?: {
      getSession: () => Promise<{ session?: { user?: { id: string }; access_token?: string }; user?: { id: string } }>;
    } }).supabaseAuth;
    if (supabaseAuth) {
      const { session } = await supabaseAuth.getSession();
      if (!session?.access_token) {
        console.warn('[SyncBridge] No valid session after refresh attempt - skipping sync');
        return { success: 0, failed: 0, errors: ['Session expired, please log in again'] };
      }
    }
  } catch (authErr) {
    console.warn('[SyncBridge] JWT refresh check failed:', authErr instanceof Error ? authErr.message : authErr);
  }

  isSyncing = true;
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  try {
    // Notify sync started
    chrome.runtime.sendMessage({ type: 'SYNC_STARTED' }).catch(() => {});

    const pendingChanges = await getPendingChanges();
    if (pendingChanges.length === 0) {
      console.log('[SyncBridge] No pending changes to sync');
      return { success: 0, failed: 0, errors: [] };
    }

    console.log(`[SyncBridge] Processing ${pendingChanges.length} pending changes...`);

    // Group by table for batch operations
    const byTable: Record<string, PendingChange[]> = {};
    for (const change of pendingChanges) {
      if (!byTable[change.table]) {
        byTable[change.table] = [];
      }
      byTable[change.table].push(change);
    }

    // Get supabase client from global scope (loaded in service worker)
    const supabase = (self as unknown as { supabase?: { from: (table: string) => unknown } }).supabase;
    if (!supabase) {
      console.error('[SyncBridge] Supabase client not available');
      return { success: 0, failed: pendingChanges.length, errors: ['Supabase client not available'] };
    }

    const processedChanges: PendingChange[] = [];

    for (const [table, changes] of Object.entries(byTable)) {
      try {
        console.log(`[CL:SYNC] --- PROCESSING: table=${table} changes=${changes.length}`);

        // Prepare all data for this table, filtering out skipped/corrupted records
        const records = changes.map((c) =>
          prepareForSupabase(c.data, table, currentUserId)
        ).filter(r => !(r as Record<string, unknown>).__skip);

        if (records.length === 0) {
          console.warn(`[CL:SYNC] --- SKIPPED: table=${table} — all ${changes.length} records were corrupted/array-like`);
          // Mark these as processed so they don't retry forever
          processedChanges.push(...changes);
          continue;
        }

        // Log the columns that will be sent to Supabase
        const firstRecordKeys = records[0] ? Object.keys(records[0]).sort().join(', ') : 'empty';
        console.log(`[CL:SYNC] --- PREPARED: table=${table} records=${records.length} columns=[${firstRecordKeys}]`);
        console.log(`[CL:SYNC] --- FIRST_RECORD:`, JSON.stringify(records[0], null, 2));
        if (records.length > 1) {
          console.log(`[CL:SYNC] --- Additional records: ${records.length - 1}`);
        }

        // Determine the correct conflict key for each table
        const userIdConflictTables = ['linkedin_profiles', 'audience_data', 'extension_settings'];
        const compositeConflictTables: Record<string, string> = {
          'capture_stats': 'user_id,date',
          'analytics_history': 'user_id,date',
          'audience_history': 'user_id,date',
          'my_posts': 'user_id,activity_urn',
          'feed_posts': 'user_id,activity_urn',
          'post_analytics': 'user_id,activity_urn',
          'linkedin_analytics': 'user_id,page_type',
        };
        const isUserIdTable = userIdConflictTables.includes(table);
        const compositeKey = compositeConflictTables[table];

        // Normalize records so all have the same keys (PostgREST batch upsert requires this)
        if (records.length > 1) {
          const allKeys = new Set<string>();
          for (const r of records) {
            for (const k of Object.keys(r)) allKeys.add(k);
          }
          for (const r of records) {
            for (const k of allKeys) {
              if (!(k in r)) {
                r[k] = null;
              }
            }
          }
        }

        let error: { message: string } | undefined;

        if (compositeKey) {
          // Tables with composite unique constraints (user_id + activity_urn, user_id + date, etc.)
          // FK constraints on child tables (post_analytics_daily, etc.) now use ON UPDATE CASCADE,
          // so standard upsert is safe for all tables including FK parents like my_posts.
          const tableClient = supabase.from(table) as {
            upsert: (data: unknown, options?: { onConflict?: string }) => Promise<{ data?: unknown[]; error?: { message: string } }>;
          };
          console.log(`[SyncBridge] Using UPSERT for ${table} with onConflict: ${compositeKey}`);

          for (const record of records) {
            const recordWithUser = { ...record, user_id: currentUserId } as Record<string, unknown>;

            // Validate that all composite key columns have values (skip corrupted records)
            const keyColumns = compositeKey.split(',').map(k => k.trim());
            const missingKeys = keyColumns.filter(k => !recordWithUser[k] && recordWithUser[k] !== 0);
            if (missingKeys.length > 0) {
              console.warn(`[SyncBridge] Skipping record for ${table} — missing composite key columns: ${missingKeys.join(', ')}`);
              continue;
            }

            // Ensure date is set for date-composite tables
            if (!recordWithUser.date && compositeKey.includes('date')) {
              recordWithUser.date = new Date().toISOString().split('T')[0];
            }
            // Strip auto-generated id for composite key tables — let the DB handle id
            // to avoid conflicts when the same logical record is re-synced with a new UUID
            if (recordWithUser.id && !compositeKey.includes('id')) {
              delete recordWithUser.id;
            }

            const upsertResult = await tableClient.upsert(recordWithUser, { onConflict: compositeKey });
            console.log(`[SyncBridge] Upsert result for ${table}:`, JSON.stringify(upsertResult));
            if (upsertResult.error) {
              console.error(`[SyncBridge] Upsert failed for ${table}:`, upsertResult.error);
              error = upsertResult.error;
            }
          }
        } else if (isUserIdTable && currentUserId) {
          // For user_id tables: use UPSERT with user_id as conflict key
          console.log(`[SyncBridge] Using UPSERT strategy for ${table} with onConflict: user_id`);

          for (const record of records) {
            const recordWithUser = { ...record, user_id: currentUserId };
            const tableClient = supabase.from(table) as {
              upsert: (data: unknown, options?: { onConflict?: string }) => Promise<{ data?: unknown[]; error?: { message: string } }>;
            };

            const upsertResult = await tableClient.upsert(recordWithUser, { onConflict: 'user_id' });
            console.log(`[SyncBridge] Upsert result for ${table}:`, JSON.stringify(upsertResult));

            if (upsertResult.error) {
              console.error(`[SyncBridge] Upsert failed for ${table}:`, upsertResult.error);
              error = upsertResult.error;
            } else {
              console.log(`[SyncBridge] Successfully upserted record to ${table}`);
            }
          }
        } else {
          // For other tables: use standard upsert with id conflict
          const tableClient = supabase.from(table) as {
            upsert: (data: unknown[], options?: { onConflict?: string }) => Promise<{ error?: { message: string } }>;
          };

          console.log(`[SyncBridge] Upserting to ${table} with conflictKey: id`);
          const result = await tableClient.upsert(records, { onConflict: 'id' });
          console.log(`[SyncBridge] Upsert result for ${table}:`, JSON.stringify(result));
          error = result.error;
        }

        if (error) {
          console.error(`[CL:SYNC] !!! FAILED: table=${table} error="${error.message}"`);
          errors.push(`${table}: ${error.message}`);

          // Treat duplicate key violations and FK constraint violations as non-fatal —
          // remove from queue to prevent endless retries.
          const isDuplicateError =
            error.message.includes('duplicate key value violates unique constraint');
          const isFkError =
            error.message.includes('violates foreign key constraint');

          const isAuthError =
            error.message.includes('JWT expired') ||
            error.message.includes('row-level security policy') ||
            error.message.includes('JWSError') ||
            error.message.includes('invalid token');

          if (isDuplicateError || isFkError) {
            console.log(`[CL:SYNC] --- ${isDuplicateError ? 'DUPLICATE' : 'FK_CONSTRAINT'}: table=${table} (removing from queue to prevent retry loop)`);
            processedChanges.push(...changes);
          } else if (isAuthError) {
            console.warn(`[CL:SYNC] --- AUTH_ERROR: table=${table} — JWT expired or RLS denied. Stopping sync, user needs to re-authenticate.`);
            // Break out of the table loop — no point retrying other tables with a bad JWT
            failed += changes.length;
            break;
          } else {
            failed += changes.length;
          }
        } else {
          console.log(`[CL:SYNC] +++ SUCCESS: table=${table} records=${changes.length} synced to Supabase`);
          success += changes.length;
          processedChanges.push(...changes);
        }
      } catch (err) {
        console.error(`[CL:SYNC] !!! EXCEPTION: table=${table} error="${err instanceof Error ? err.message : 'Unknown error'}"`);
        errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        failed += changes.length;
      }
    }

    // Remove processed changes from pending queue
    // IMPORTANT: Re-read from storage to avoid overwriting items queued during sync.
    // Without this, items added by queueForSync while sync was in progress get lost.
    if (processedChanges.length > 0) {
      const currentPending = await getPendingChanges();
      const remainingChanges = currentPending.filter(
        (change) =>
          !processedChanges.some(
            (p) => p.timestamp === change.timestamp && p.table === change.table
          )
      );
      console.log(`[CL:SYNC] Pending cleanup: had=${currentPending.length} processed=${processedChanges.length} remaining=${remainingChanges.length}`);
      await savePendingChanges(remainingChanges);
    }

    lastSyncTime = Date.now();
    console.log(`[CL:SYNC] ========== SYNC COMPLETE: success=${success} failed=${failed} errors=${errors.length} ==========`);
    if (errors.length > 0) {
      console.log(`[CL:SYNC] Error details:`, errors);
    }

    // Notify sync complete
    chrome.runtime.sendMessage({
      type: 'SYNC_COMPLETE',
      data: { success, failed },
    }).catch(() => {});

    return { success, failed, errors };
  } catch (error) {
    console.error('[SyncBridge] Sync error:', error);
    return {
      success,
      failed: failed || 1,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Migrate existing local data to Supabase
 */
export async function migrateExistingData(): Promise<{
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
}> {
  if (!currentUserId) {
    console.log('[SyncBridge] No user - cannot migrate');
    return { success: false, migrated: 0, failed: 0, errors: ['Not authenticated'] };
  }

  console.log('[SyncBridge] Starting data migration...');
  const errors: string[] = [];
  let migrated = 0;
  let failed = 0;

  for (const localKey of SYNCABLE_STORAGE_KEYS) {
    try {
      const result = await chrome.storage.local.get(localKey);
      const data = result[localKey];

      if (data) {
        // Queue for sync
        await queueForSync(localKey, data);
        migrated++;
        console.log(`[SyncBridge] Queued ${localKey} for migration`);
      }
    } catch (error) {
      console.error(`[SyncBridge] Migration failed for ${localKey}:`, error);
      errors.push(`${localKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log(`[SyncBridge] Migration queued: ${migrated} items`);

  // Process all pending changes immediately
  const syncResult = await processPendingChanges();

  // Mark migration as complete
  await chrome.storage.local.set({
    supabase_migration_complete: true,
    supabase_migration_date: new Date().toISOString(),
    supabase_migration_user: currentUserId,
  });

  return {
    success: true,
    migrated,
    failed: failed + syncResult.failed,
    errors: [...errors, ...syncResult.errors],
  };
}

/**
 * Reconcile posts in Supabase with the current set of posts from LinkedIn.
 * Deletes any rows whose activity_urn is NOT present in the current sync set,
 * so that deleted or removed LinkedIn posts no longer appear on the platform.
 *
 * @param table - The Supabase table name ('my_posts' or 'feed_posts')
 * @param currentUrns - Set of activity_urn values that currently exist on LinkedIn
 */
export async function reconcilePosts(
  table: 'my_posts' | 'feed_posts',
  currentUrns: Set<string>,
): Promise<void> {
  if (!currentUserId || currentUrns.size === 0) return;

  try {
    const supabase = (self as unknown as { supabase?: { from: (table: string) => unknown } }).supabase;
    if (!supabase) return;

    /**
     * QueryBuilder type matching the lightweight Supabase client in lib/supabase/client.js.
     * Filters (.eq, .in) are chainable and mutate the builder; terminal methods
     * (.execute/.delete/.update) are async and consume the accumulated filters.
     */
    type QueryBuilder = {
      select: (cols: string) => QueryBuilder;
      eq: (col: string, val: string) => QueryBuilder;
      in: (col: string, vals: string[]) => QueryBuilder;
      delete: () => Promise<{ data?: unknown; error?: { message: string } | null }>;
      then: (resolve: (v: { data?: { activity_urn: string }[]; error?: { message: string } | null }) => void, reject?: (e: unknown) => void) => void;
    };

    // Use a fresh query builder for SELECT (filters accumulate on the instance)
    const selectClient = supabase.from(table) as QueryBuilder;
    const { data: existingRows, error: fetchError } = await selectClient
      .select('activity_urn')
      .eq('user_id', currentUserId) as { data?: { activity_urn: string }[]; error?: { message: string } | null };

    if (fetchError || !existingRows) {
      console.warn(`[SyncBridge] reconcilePosts: failed to fetch ${table}:`, fetchError?.message);
      return;
    }

    // Find URNs that are in Supabase but NOT in the current LinkedIn data
    const staleUrns = existingRows
      .map((r) => r.activity_urn)
      .filter((urn) => !currentUrns.has(urn));

    if (staleUrns.length === 0) return;

    console.log(`[SyncBridge] reconcilePosts: removing ${staleUrns.length} stale rows from ${table}`);

    // Use a NEW query builder for DELETE — filters must be set BEFORE calling .delete()
    const deleteClient = supabase.from(table) as QueryBuilder;
    const { error: deleteError } = await deleteClient
      .eq('user_id', currentUserId)
      .in('activity_urn', staleUrns)
      .delete();

    if (deleteError) {
      console.error(`[SyncBridge] reconcilePosts: delete failed for ${table}:`, deleteError.message);
    } else {
      console.log(`[SyncBridge] reconcilePosts: removed ${staleUrns.length} stale rows from ${table}`);
    }
  } catch (err) {
    console.error(`[SyncBridge] reconcilePosts error:`, err);
  }
}

/**
 * Set the current user ID for sync operations
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
  console.log(`[SyncBridge] User ID set: ${userId ? userId.substring(0, 8) + '...' : 'null'}`);
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Get sync status
 */
export async function getSyncStatusInfo(): Promise<SyncStatus> {
  const pendingChanges = await getPendingChanges();
  return {
    isAuthenticated: !!currentUserId,
    userId: currentUserId,
    pendingCount: pendingChanges.length,
    lastSyncTime,
    isSyncing,
  };
}

/**
 * Extended sync status with more details
 */
export interface DetailedSyncStatus extends SyncStatus {
  isOnline: boolean;
  tables: string[];
  oldestPendingChange: number | null;
}

/**
 * Get detailed sync status including last sync time and affected tables
 */
export async function getDetailedSyncStatus(): Promise<DetailedSyncStatus> {
  const pendingChanges = await getPendingChanges();
  const lastSyncResult = await chrome.storage.local.get('last_sync_time');

  return {
    isAuthenticated: !!currentUserId,
    userId: currentUserId,
    pendingCount: pendingChanges.length,
    lastSyncTime: lastSyncResult.last_sync_time ? new Date(lastSyncResult.last_sync_time).getTime() : lastSyncTime,
    isSyncing,
    isOnline: navigator.onLine,
    tables: [...new Set(pendingChanges.map(c => c.table))],
    oldestPendingChange: pendingChanges.length > 0
      ? Math.min(...pendingChanges.map(c => c.timestamp))
      : null
  };
}

/**
 * Record successful sync time to storage
 */
async function recordSyncTime(): Promise<void> {
  const now = new Date().toISOString();
  await chrome.storage.local.set({ last_sync_time: now });
  lastSyncTime = Date.now();
  console.log('[SyncBridge] Recorded sync time:', now);
}

// ---------------------------------------------------------------------------
// Media Upload to Supabase Storage
// ---------------------------------------------------------------------------

/** Supabase Storage bucket name for post media */
const MEDIA_BUCKET = 'post-media';

/**
 * Determine file extension from URL or Content-Type header.
 * @param url - The source URL
 * @param contentType - Optional Content-Type header value
 * @returns File extension string (e.g. 'jpg', 'mp4')
 */
function getFileExtension(url: string, contentType?: string): string {
  // Try Content-Type first
  if (contentType) {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
    };
    for (const [mime, ext] of Object.entries(mimeMap)) {
      if (contentType.includes(mime)) return ext;
    }
  }

  // Try URL path
  const pathMatch = url.match(/\.(\w{3,4})(?:[?#]|$)/);
  if (pathMatch) return pathMatch[1].toLowerCase();

  // Default based on URL patterns
  if (url.includes('video') || url.includes('mp4')) return 'mp4';
  if (url.includes('pdf') || url.includes('document')) return 'pdf';
  return 'jpg'; // default to jpg for images
}

/**
 * Upload a single media file from a URL to Supabase Storage.
 *
 * Downloads from the source URL (e.g. LinkedIn CDN) and uploads to
 * the post-media bucket in Supabase Storage.
 *
 * @param sourceUrl - The URL to download from
 * @param storagePath - The path within the bucket (e.g. "{userId}/{urn}/{filename}")
 * @returns The public URL of the uploaded file, or null on failure
 */
async function uploadMediaFile(
  sourceUrl: string,
  storagePath: string
): Promise<string | null> {
  const supabase = (self as unknown as {
    supabase?: {
      url: string;
      anonKey: string;
      authToken: string | null;
    }
  }).supabase;

  if (!supabase?.authToken) {
    console.warn('[MediaUpload] No auth token available for Storage upload');
    return null;
  }

  try {
    console.log(`[MediaUpload] Downloading: ${sourceUrl.substring(0, 80)}...`);

    // Download the media file from LinkedIn CDN
    const downloadResponse = await fetch(sourceUrl, {
      headers: {
        // Some LinkedIn CDN URLs need a user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!downloadResponse.ok) {
      console.warn(`[MediaUpload] Download failed: HTTP ${downloadResponse.status} for ${sourceUrl.substring(0, 60)}...`);
      return null;
    }

    const contentType = downloadResponse.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await downloadResponse.blob();

    if (blob.size === 0) {
      console.warn('[MediaUpload] Downloaded file is empty, skipping');
      return null;
    }

    // Cap upload size at 50MB
    if (blob.size > 52428800) {
      console.warn(`[MediaUpload] File too large (${(blob.size / 1024 / 1024).toFixed(1)}MB), skipping`);
      return null;
    }

    console.log(`[MediaUpload] Downloaded ${(blob.size / 1024).toFixed(1)}KB, uploading to Storage: ${storagePath}`);

    // Upload to Supabase Storage REST API
    const uploadUrl = `${supabase.url}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabase.authToken}`,
        'apikey': supabase.anonKey,
        'Content-Type': contentType,
        'x-upsert': 'true', // Overwrite if exists
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text().catch(() => 'unknown');
      console.warn(`[MediaUpload] Upload failed: HTTP ${uploadResponse.status} - ${errText}`);
      return null;
    }

    // Construct the public URL
    const publicUrl = `${supabase.url}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;
    console.log(`[MediaUpload] Successfully uploaded: ${publicUrl.substring(0, 80)}...`);
    return publicUrl;
  } catch (err) {
    console.warn('[MediaUpload] Error during media upload:', err);
    return null;
  }
}

/**
 * Check if a URL is a LinkedIn CDN URL (not yet uploaded to Storage).
 * @param url - URL to check
 * @returns true if the URL is from LinkedIn CDN
 */
function isLinkedInCdnUrl(url: string): boolean {
  return url.includes('media.licdn.com') ||
         url.includes('media-exp') ||
         url.includes('dms/image') ||
         url.includes('dms/video');
}

/**
 * Sanitize activity URN for use as a file path component.
 * Replaces colons and other unsafe characters.
 * @param urn - LinkedIn activity URN
 * @returns Safe path-friendly string
 */
function sanitizeUrnForPath(urn: string): string {
  return urn.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 60);
}

/**
 * Upload media for recently synced posts to Supabase Storage.
 *
 * This runs AFTER the main sync to avoid blocking the pipeline.
 * It queries posts that still have LinkedIn CDN URLs and uploads them
 * to Supabase Storage, then updates the database records.
 *
 * @param userId - The current user's ID
 * @param tables - Which tables to process ('my_posts' and/or 'feed_posts')
 */
export async function uploadPostMediaToStorage(
  userId: string,
  tables: string[] = ['my_posts', 'feed_posts']
): Promise<void> {
  const supabase = (self as unknown as {
    supabase?: {
      url: string;
      anonKey: string;
      authToken: string | null;
      from: (table: string) => {
        select: (columns: string) => {
          eq: (col: string, val: string) => {
            not: (col: string, op: string, val: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          } & Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        };
        update: (data: Record<string, unknown>) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
  }).supabase;

  if (!supabase?.authToken) {
    console.log('[MediaUpload] Skipping — no auth token');
    return;
  }

  console.log(`[MediaUpload] Starting media upload for user ${userId.substring(0, 8)}...`);
  let totalUploaded = 0;
  let totalFailed = 0;

  for (const table of tables) {
    try {
      // Query posts that have media_urls containing LinkedIn CDN URLs
      // We look for posts with non-null media_urls
      const queryBuilder = supabase.from(table).select('id,activity_urn,media_urls,media_type').eq('user_id', userId);
      const { data: posts, error } = await queryBuilder;

      if (error) {
        console.warn(`[MediaUpload] Error querying ${table}:`, error.message);
        continue;
      }

      if (!posts || posts.length === 0) {
        console.log(`[MediaUpload] No posts found in ${table}`);
        continue;
      }

      // Filter to posts with LinkedIn CDN URLs that need uploading
      const postsWithCdnMedia = posts.filter((p: Record<string, unknown>) => {
        const urls = p.media_urls as string[] | null;
        return urls && urls.length > 0 && urls.some((u: string) => isLinkedInCdnUrl(u));
      });

      if (postsWithCdnMedia.length === 0) {
        console.log(`[MediaUpload] No posts with LinkedIn CDN URLs in ${table}`);
        continue;
      }

      console.log(`[MediaUpload] Found ${postsWithCdnMedia.length} posts with CDN media in ${table}`);

      // Process each post (limit to 10 per sync to avoid overwhelming the service worker)
      for (const post of postsWithCdnMedia.slice(0, 10)) {
        const activityUrn = post.activity_urn as string;
        const originalUrls = post.media_urls as string[];
        const urnPath = sanitizeUrnForPath(activityUrn);
        const newUrls: string[] = [];

        for (let i = 0; i < originalUrls.length; i++) {
          const url = originalUrls[i];
          if (!isLinkedInCdnUrl(url)) {
            // Already a Storage URL, keep as-is
            newUrls.push(url);
            continue;
          }

          const ext = getFileExtension(url);
          const storagePath = `${userId}/${urnPath}/${i}.${ext}`;
          const storageUrl = await uploadMediaFile(url, storagePath);

          if (storageUrl) {
            newUrls.push(storageUrl);
            totalUploaded++;
          } else {
            // Keep original CDN URL if upload fails — will retry next sync
            newUrls.push(url);
            totalFailed++;
          }
        }

        // Update the post record with new Storage URLs if any changed
        const hasNewUrls = newUrls.some((u, i) => u !== originalUrls[i]);
        if (hasNewUrls) {
          try {
            const updateBuilder = supabase.from(table).update({ media_urls: newUrls }).eq('user_id', userId).eq('activity_urn', activityUrn);
            const { error: updateError } = await updateBuilder;
            if (updateError) {
              console.warn(`[MediaUpload] Failed to update ${table} record:`, updateError.message);
            } else {
              console.log(`[MediaUpload] Updated ${table} record ${urnPath} with ${newUrls.length} Storage URLs`);
            }
          } catch (updateErr) {
            console.warn(`[MediaUpload] Error updating ${table} record:`, updateErr);
          }
        }
      }
    } catch (tableErr) {
      console.warn(`[MediaUpload] Error processing ${table}:`, tableErr);
    }
  }

  console.log(`[MediaUpload] Complete: ${totalUploaded} uploaded, ${totalFailed} failed`);
}

/**
 * Sync result with retry information
 */
export interface SyncWithRetryResult {
  success: boolean;
  synced: number;
  failed: number;
  attempts: number;
  error?: string;
}

/**
 * Sync pending changes with retry logic and exponential backoff
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Promise with sync result including attempt count
 */
export async function syncWithRetry(maxRetries = 3): Promise<SyncWithRetryResult> {
  let attempt = 0;
  let lastError: Error | null = null;

  console.log(`[SyncBridge] Starting sync with retry (max ${maxRetries} attempts)`);

  while (attempt < maxRetries) {
    try {
      // Check preconditions
      if (!navigator.onLine) {
        console.log('[SyncBridge] Offline - cannot sync');
        return { success: false, synced: 0, failed: 0, attempts: attempt, error: 'Offline' };
      }

      if (isSyncing) {
        console.log('[SyncBridge] Sync already in progress');
        return { success: false, synced: 0, failed: 0, attempts: attempt, error: 'Sync already in progress' };
      }

      if (!currentUserId) {
        console.log('[SyncBridge] Not authenticated - cannot sync');
        return { success: false, synced: 0, failed: 0, attempts: attempt, error: 'Not authenticated' };
      }

      // Process pending changes
      const result = await processPendingChanges();

      // Check if sync was successful (all items synced or no items to sync)
      if (result.failed === 0) {
        console.log(`[SyncBridge] Sync succeeded on attempt ${attempt + 1}`);
        await recordSyncTime();

        // Async media upload — runs after sync completes, non-blocking
        if (currentUserId) {
          uploadPostMediaToStorage(currentUserId).catch(err => {
            console.warn('[SyncBridge] Media upload error (non-blocking):', err);
          });
        }

        return {
          success: true,
          synced: result.success,
          failed: 0,
          attempts: attempt + 1
        };
      }

      // Some items failed - this counts as a partial failure that should retry
      throw new Error(`${result.failed} items failed to sync: ${result.errors.join(', ')}`);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      console.log(`[SyncBridge] Sync attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[SyncBridge] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const pendingChanges = await getPendingChanges();
  console.error(`[SyncBridge] Sync failed after ${maxRetries} attempts:`, lastError);

  return {
    success: false,
    synced: 0,
    failed: pendingChanges.length,
    attempts: attempt,
    error: lastError?.message || 'Unknown error'
  };
}

/**
 * Initialize sync bridge on startup
 */
export async function initSyncBridge(): Promise<void> {
  console.log('[SyncBridge] Initializing...');

  // Check for existing Supabase session using auth module (handles token refresh)
  try {
    // First try to use the auth module if available (handles token refresh)
    const supabaseAuth = (self as unknown as { supabaseAuth?: {
      getSession: () => Promise<{ session?: { user?: { id: string } }; user?: { id: string } }>;
    } }).supabaseAuth;

    if (supabaseAuth) {
      console.log('[SyncBridge] Using auth module to restore session...');
      const { session, user } = await supabaseAuth.getSession();
      const userId = user?.id || session?.user?.id;
      console.log('[SyncBridge] Auth module session check:', session ? 'found' : 'not found', userId ? `user: ${userId.substring(0, 8)}...` : 'no user');

      if (userId) {
        currentUserId = userId;
        console.log(`[SyncBridge] Restored user session via auth module: ${currentUserId!.substring(0, 8)}...`);
      }
    }

    // Always try direct storage as fallback if no user found yet
    if (!currentUserId) {
      console.log('[SyncBridge] Trying direct storage fallback...');
      const result = await chrome.storage.local.get('supabase_session');
      const session = result.supabase_session;
      console.log('[SyncBridge] Storage session check:', session ? 'found' : 'not found', session?.user?.id ? `user: ${session.user.id.substring(0, 8)}...` : 'no user');
      if (session?.user?.id) {
        // Check if the stored JWT is expired before using it
        const isExpired = session.expires_at && (Date.now() / 1000) > session.expires_at;

        if (isExpired) {
          console.warn('[SyncBridge] Stored session JWT is expired — skipping auth set to avoid RLS errors');
          // Still set userId so we know who the user is, but don't set expired JWT
          currentUserId = session.user.id;
        } else {
          currentUserId = session.user.id;
          console.log(`[SyncBridge] Restored user session from storage: ${currentUserId!.substring(0, 8)}...`);

          // Only set auth if token is not expired
          const supabase = (self as unknown as { supabase?: { setAuth: (token: string, userId?: string) => void } }).supabase;
          if (supabase && session.access_token) {
            supabase.setAuth(session.access_token, session.user.id);
            console.log('[SyncBridge] Set auth on Supabase client');
          }
        }
      }
    }

    // Check if we need to run initial migration
    if (currentUserId) {
      const migrationCheck = await chrome.storage.local.get([
        'supabase_migration_complete',
        'supabase_migration_user',
      ]);

      if (
        !migrationCheck.supabase_migration_complete ||
        migrationCheck.supabase_migration_user !== currentUserId
      ) {
        console.log('[SyncBridge] Migration needed for current user');
        // Don't auto-migrate, let user trigger it
      }
    }
  } catch (error) {
    console.error('[SyncBridge] Error checking session:', error);
  }

  // Note: online/offline event listeners are registered at module level
  // (below this function) to satisfy Chrome service worker requirements.

  console.log('[SyncBridge] Initialized');
}

/**
 * Start periodic sync
 */
export function startPeriodicSync(intervalMinutes = 5): void {
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(async () => {
    if (navigator.onLine && currentUserId) {
      console.log('[SyncBridge] Running periodic sync...');
      await processPendingChanges();
    }
  }, intervalMs);

  console.log(`[SyncBridge] Periodic sync started (every ${intervalMinutes} minutes)`);
}

// ============================================================
// Top-level online/offline event listeners.
// Chrome service workers require these to be registered during
// initial script evaluation, NOT inside an async function.
// ============================================================
if (typeof self !== 'undefined' && self.addEventListener) {
  self.addEventListener('online', async () => {
    console.log('[SyncBridge] ServiceWorker: Back online - triggering sync with retry');
    const result = await syncWithRetry(3);
    console.log('[SyncBridge] ServiceWorker online sync result:', result);
  });

  self.addEventListener('offline', () => {
    console.log('[SyncBridge] ServiceWorker: Gone offline');
  });
}
