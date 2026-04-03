/**
 * ChainLinked Data Connector - Service Worker (Background Script)
 * TypeScript Version - v4.0
 */

// Declare importScripts for service worker
declare function importScripts(...urls: string[]): void;

// Declare global types for Supabase loaded via importScripts
declare const self: typeof globalThis & {
  supabase?: {
    url: string;
    anonKey: string;
    from: (table: string) => {
      upsert: (data: unknown[], options?: { onConflict?: string }) => Promise<{ error?: { message: string } }>;
      select: (fields?: string) => { eq: (field: string, value: string) => { single: () => Promise<{ data: unknown; error?: { message: string } }> } };
      insert: (data: unknown) => Promise<{ error?: { message: string } }>;
    };
    setAuth: (token: string, userId?: string) => void;
    clearAuth: () => void;
  };
  supabaseAuth?: {
    signIn: (email: string, password: string) => Promise<{ success: boolean; user?: { id: string; email: string }; session?: unknown; error?: string }>;
    signUp: (email: string, password: string) => Promise<{ success: boolean; user?: { id: string; email: string }; session?: unknown; error?: string; message?: string }>;
    signOut: () => Promise<{ error?: { message: string } }>;
    getSession: () => Promise<{ session?: { user?: { id: string; email?: string } }; user?: { id: string; email: string } }>;
    getUser: () => Promise<{ user?: { id: string; email: string } }>;
  };
  isSupabaseConfigured?: () => boolean;
  localCache?: unknown;
  syncManager?: { initialize: () => Promise<void>; cleanup: () => void };
};

// Load Supabase modules via importScripts (runs before main code)
try {
  importScripts(
    '../lib/supabase/client.js',
    '../lib/supabase/auth.js',
    '../lib/supabase/local-cache.js',
    '../lib/supabase/sync.js',
    '../lib/supabase/storage.js'
  );
  console.log('[ServiceWorker] Supabase modules loaded');
} catch (e) {
  console.error('[ServiceWorker] Failed to load Supabase modules:', e);
}

import type {
  ExtensionMessage,
  StorageKey,
  CaptureType,
  ProfileData,
  CreatorAnalytics,
  PostAnalytics,
  AudienceAnalytics,
  CaptureLog,
  CompanyAnalytics,
  ContentCalendarData,
} from '../shared/types';

import {
  initHistoryManager,
  recordAnalyticsTrends,
  recordProfileTrends,
  logCapture,
  getTrendDataForCharts,
  getTrendSummary,
  exportTrendsAsCSV,
  exportTrendsAsJSON,
  exportCaptureLogsAsCSV,
  exportFullBackup,
  runMaintenance,
  getStorageStats,
  checkAlerts,
} from '../shared/history-manager';

import {
  initializeAlarms,
  scheduleBackup,
  getBackupSchedule,
  updateBackupSchedule,
  getAlertConfigs,
  saveAlertConfigs,
  upsertAlertConfig,
  deleteAlertConfig,
  markAlertTriggered,
  getAllAlarms,
  ALARM_NAMES,
} from './alarms';

import {
  showCaptureNotification,
  showCaptureFailureNotification,
  showBackupSuccessNotification,
  showBackupFailureNotification,
  showGrowthAlertNotification,
  showMultipleGrowthAlerts,
  getNotificationSettings,
  saveNotificationSettings,
  setupNotificationListeners,
  type NotificationSettings,
} from './notifications';

import {
  getAuthState,
  startAuthFlow,
  logout as googleLogout,
} from './google-auth';

import {
  syncNow,
  getSyncStatus,
  getSyncSettings,
  saveSyncSettings,
  listBackups,
  restoreBackup,
  deleteBackup,
} from './drive-sync';

import {
  initSyncBridge,
  saveWithSync,
  appendWithSync,
  processPendingChanges,
  migrateExistingData,
  setCurrentUserId,
  getCurrentUserId,
  getSyncStatusInfo,
  getDetailedSyncStatus,
  syncWithRetry,
  isSyncableKey,
  startPeriodicSync,
  queueForSync,
} from './supabase-sync-bridge';

import {
  initBackgroundSync,
  enableBackgroundSync,
  disableBackgroundSync,
  triggerSync,
  getSyncState as getBackgroundSyncState,
  getSyncConfig as getBackgroundSyncConfig,
  updateSyncConfig as updateBackgroundSyncConfig,
  resetCircuitBreaker,
  handleBackgroundSyncAlarm,
  runDiagnostic,
  extractMediaUrls,
} from './background-sync';

import type { BackgroundSyncConfig } from '../shared/sync-types';

// ============================================
// CONSTANTS
// ============================================

const LINKEDIN_DOMAIN = '.linkedin.com';
const LINKEDIN_URL = 'https://www.linkedin.com';

const COOKIE_NAMES = {
  AUTH_TOKEN: 'li_at',
  CSRF_TOKEN: 'JSESSIONID',
  DATA_CENTER: 'lidc',
  BROWSER_ID: 'bcookie',
} as const;

const STORAGE_KEYS = {
  AUTH_DATA: 'linkedin_auth',
  PROFILE_DATA: 'linkedin_profile',
  ANALYTICS_DATA: 'linkedin_analytics',
  POST_ANALYTICS_DATA: 'linkedin_post_analytics',
  AUDIENCE_DATA: 'linkedin_audience',
  CONNECTIONS_DATA: 'linkedin_connections',
  POSTS_DATA: 'linkedin_posts',
  FEED_POSTS: 'linkedin_feed_posts',
  MY_POSTS: 'linkedin_my_posts',
  COMMENTS: 'linkedin_comments',
  FOLLOWERS: 'linkedin_followers',
  TRENDING: 'linkedin_trending',
  CAPTURED_APIS: 'captured_apis',
  SETTINGS: 'extension_settings',
  AUTO_CAPTURE_LOG: 'auto_capture_log',
  AUTO_CAPTURE_SETTINGS: 'linkedin_capture_settings',
  ANALYTICS_HISTORY: 'linkedin_analytics_history',
  AUDIENCE_HISTORY: 'linkedin_audience_history',
  CAPTURE_STATS: 'auto_capture_stats',
  // v4.0 Phase 5: Company data
  COMPANY_ANALYTICS: 'linkedin_company_analytics',
  CONTENT_CALENDAR: 'linkedin_content_calendar',
} as const;

const DECORATION_IDS = {
  FULL_PROFILE: 'com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-16',
  PROFILE_VIEW: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
  CONNECTIONS_LIST: 'com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionList-16',
  MINI_PROFILE: 'com.linkedin.voyager.dash.deco.identity.profile.StandardMiniProfile-3',
} as const;

// ============================================
// POST EXTRACTION FROM LINKEDIN API RESPONSES
// ============================================

interface ExtractedPost {
  activity_urn: string;
  content: string;
  media_type: string;
  media_urls: string[] | null;
  reactions: number;
  comments: number;
  reposts: number;
  impressions: number;
  posted_at: string | null;
  raw_data: unknown;
}

/**
 * Extract individual posts from a LinkedIn Voyager API response
 * LinkedIn uses URN references (*field) instead of inline objects in `included` arrays.
 * We build a URN lookup map to resolve these references.
 */
function extractPostsFromResponse(responseData: unknown): ExtractedPost[] {
  if (!responseData || typeof responseData !== 'object') {
    console.log(`[CL:WORKER] extractPosts: invalid input type=${typeof responseData}`);
    return [];
  }

  const data = responseData as Record<string, unknown>;
  const posts: ExtractedPost[] = [];
  const seenUrns = new Set<string>();

  // Diagnostic: log top-level keys to understand LinkedIn response structure
  const topKeys = Object.keys(data).slice(0, 15);
  const includedLen = Array.isArray(data.included) ? (data.included as unknown[]).length : 0;
  const elementsLen = Array.isArray(data.elements) ? (data.elements as unknown[]).length : 0;
  const hasGqlData = data.data && typeof data.data === 'object';
  console.log(`[CL:WORKER] extractPosts: topKeys=[${topKeys.join(',')}] included=${includedLen} elements=${elementsLen} hasGqlData=${!!hasGqlData}`);

  // Build URN → object lookup from `included` array
  // LinkedIn uses *field references (e.g., *commentary, *socialDetail) that point to other included items by URN
  const urnMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(data.included)) {
    for (const item of data.included as Record<string, unknown>[]) {
      if (!item || typeof item !== 'object') continue;
      const urn = (item.entityUrn || item.urn || '') as string;
      if (urn) urnMap.set(urn, item);
    }
    console.log(`[CL:WORKER] extractPosts: built URN lookup map with ${urnMap.size} entries`);
  }

  // Helper: resolve a field that might be inline or a *reference
  function resolve(item: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
    // Check inline field first (e.g., item.commentary)
    if (item[field] && typeof item[field] === 'object') {
      return item[field] as Record<string, unknown>;
    }
    // Check *reference field (e.g., item['*commentary'] → URN → lookup in included)
    const ref = item[`*${field}`] as string | undefined;
    if (ref && urnMap.has(ref)) {
      return urnMap.get(ref)!;
    }
    return undefined;
  }

  // Helper: extract text from LinkedIn's commentary/TextContent structure
  function extractText(obj: unknown): string {
    if (!obj || typeof obj !== 'object') return '';
    const o = obj as Record<string, unknown>;
    // Direct string
    if (typeof o.text === 'string') return o.text;
    // Nested: commentary.text.text or commentary.text → TextViewModel
    if (o.text && typeof o.text === 'object') {
      const t = o.text as Record<string, unknown>;
      if (typeof t.text === 'string') return t.text;
      // Could also have *text reference
      const textRef = t['*text'] as string | undefined;
      if (textRef && urnMap.has(textRef)) {
        const resolved = urnMap.get(textRef)!;
        if (typeof resolved.text === 'string') return resolved.text;
      }
    }
    // Try *text reference on the object itself
    const textRef = o['*text'] as string | undefined;
    if (textRef && urnMap.has(textRef)) {
      const resolved = urnMap.get(textRef)!;
      if (typeof resolved.text === 'string') return resolved.text;
    }
    return '';
  }

  // Helper: extract a post from an entity, resolving *references
  function tryExtractPost(item: Record<string, unknown>): ExtractedPost | null {
    // Get URN — try multiple field names
    let urn = (item.urn || item.entityUrn || item['*updateV2Urn'] || item.activityUrn || '') as string;
    // Also check updateMetadata for the activity URN
    if (!urn && item.updateMetadata && typeof item.updateMetadata === 'object') {
      const meta = item.updateMetadata as Record<string, unknown>;
      urn = (meta.urn || meta.activityUrn || '') as string;
    }
    if (!urn || seenUrns.has(urn)) return null;

    // Resolve commentary and socialDetail (handles both inline and *reference patterns)
    const commentary = resolve(item, 'commentary');
    const socialDetail = resolve(item, 'socialDetail');
    // LinkedIn stores counts in socialDetail.totalSocialActivityCounts (inline) or
    // socialDetail['*totalSocialActivityCounts'] (URN reference) — use resolve() to handle both
    const socialCounts = socialDetail
      ? (resolve(socialDetail, 'totalSocialActivityCounts') || socialDetail)
      : undefined;

    const content = commentary ? extractText(commentary) : '';

    // Skip items with no content and no social metrics (not a real post)
    if (!content && !socialCounts) return null;

    seenUrns.add(urn);

    const reactions = Number(socialCounts?.numLikes ?? socialCounts?.reactionCount ?? socialCounts?.likes ?? 0);
    const commentsCount = Number(socialCounts?.numComments ?? socialCounts?.commentCount ?? socialCounts?.comments ?? 0);
    const reposts = Number(socialCounts?.numShares ?? socialCounts?.shareCount ?? socialCounts?.shares ?? 0);
    const impressions = Number(socialCounts?.numImpressions ?? socialCounts?.impressionCount ?? socialCounts?.views ?? 0);

    // Detect media type — check both inline and *reference content
    let media_type = 'text';
    const contentObj = resolve(item, 'content') || resolve(item, 'mediaContent');
    if (contentObj) {
      const mediaType = (contentObj.mediaType || contentObj.type || contentObj.$type || '') as string;
      const mtLower = mediaType.toLowerCase();
      if (mtLower.includes('image') || contentObj.images || contentObj['*images']) media_type = 'image';
      else if (mtLower.includes('video') || contentObj.video || contentObj['*video']) media_type = 'video';
      else if (mtLower.includes('article') || contentObj.article || contentObj['*article']) media_type = 'article';
      else if (mtLower.includes('document') || contentObj.document || contentObj['*document']) media_type = 'document';
      else if (Object.keys(contentObj).length > 1) media_type = 'rich_media';
    }

    // Extract posted timestamp — check multiple sources
    let posted_at: string | null = null;

    // Source 1: Direct fields on the item
    const directTimestamp = (item.publishedAt || item.createdAt || item.postedAt) as number | string | undefined;
    if (typeof directTimestamp === 'number') {
      posted_at = new Date(directTimestamp).toISOString();
    } else if (typeof directTimestamp === 'string') {
      posted_at = directTimestamp;
    }

    // Source 2: Check updateMetadata (resolved) for timestamps
    if (!posted_at) {
      const updateMeta = resolve(item, 'updateMetadata');
      if (updateMeta) {
        const metaTime = (updateMeta.publishedAt || updateMeta.createdAt) as number | string | undefined;
        if (typeof metaTime === 'number') posted_at = new Date(metaTime).toISOString();
        else if (typeof metaTime === 'string') posted_at = metaTime;
      }
    }

    // Source 3: Extract from activity URN using LinkedIn Snowflake ID
    // LinkedIn activity IDs encode a timestamp: activityId >> 22 = Unix milliseconds
    if (!posted_at && urn) {
      const actMatch = urn.match(/activity:(\d+)/);
      if (actMatch) {
        try {
          const activityId = BigInt(actMatch[1]);
          const timestampMs = Number(activityId >> 22n);
          // Sanity: reasonable date range (2015–2030)
          if (timestampMs > 1420070400000 && timestampMs < 1893456000000) {
            posted_at = new Date(timestampMs).toISOString();
          }
        } catch {
          // BigInt not supported or parse error — skip
        }
      }
    }

    // Extract media URLs from content object
    const mediaUrls = extractMediaUrls(
      contentObj as Record<string, unknown> | undefined,
      media_type,
      urnMap
    );
    if (mediaUrls.length > 0) {
      console.log(`[CL:WORKER] Post ${urn.substring(0, 40)}... has ${mediaUrls.length} media URL(s) [${media_type}]`);
    }

    return {
      activity_urn: urn,
      content,
      media_type,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      reactions,
      comments: commentsCount,
      reposts,
      impressions,
      posted_at,
      raw_data: item,
    };
  }

  // Strategy 1: Check `included` array — find Update/Activity entities and resolve their references
  if (Array.isArray(data.included)) {
    const typeCounts: Record<string, number> = {};
    let matchCount = 0;
    for (const item of data.included as Record<string, unknown>[]) {
      if (!item || typeof item !== 'object') continue;
      const type = ((item.$type || item._type || '') as string).toLowerCase();
      const shortType = type.split('.').pop() || type || 'unknown';
      typeCounts[shortType] = (typeCounts[shortType] || 0) + 1;
      // Match posts: check type AND *reference fields (LinkedIn uses *commentary, *socialDetail)
      const isPostType = type.includes('update') || type.includes('activity') || type.includes('share') || type.includes('ugcpost');
      const hasContent = !!(item.commentary || item['*commentary'] || item.socialDetail || item['*socialDetail']);
      if (isPostType || hasContent) {
        matchCount++;
        const post = tryExtractPost(item);
        if (post) posts.push(post);
      }
    }
    console.log(`[CL:WORKER] extractPosts Strategy1: ${includedLen} included, ${matchCount} matched, ${posts.length} extracted. Types:`, JSON.stringify(typeCounts));
  }

  // Strategy 2: Check nested GraphQL data structures (data.{queryName}.elements[] or *elements[])
  // Also searches one level deeper for nested containers
  if (data.data && typeof data.data === 'object') {
    const gqlData = data.data as Record<string, unknown>;
    const gqlKeys = Object.keys(gqlData);
    console.log(`[CL:WORKER] extractPosts Strategy2: data.data keys=[${gqlKeys.join(',')}]`);

    // Helper to process an elements array (inline objects or URN strings)
    const processElements = (elements: unknown[], path: string) => {
      console.log(`[CL:WORKER] extractPosts Strategy2: found ${path}[${elements.length}] firstType=${typeof elements[0]} sample=${typeof elements[0] === 'string' ? (elements[0] as string).substring(0, 60) : 'object'}`);
      for (const el of elements) {
        if (!el) continue;
        let target: Record<string, unknown> | undefined;
        if (typeof el === 'string') {
          // URN reference string — resolve from included array via urnMap
          target = urnMap.get(el);
          if (!target) continue;
        } else if (typeof el === 'object') {
          const obj = el as Record<string, unknown>;
          // Handle wrapped elements: el.result contains the actual post
          target = (obj.result && typeof obj.result === 'object') ? obj.result as Record<string, unknown> : obj;
        }
        if (target) {
          const post = tryExtractPost(target);
          if (post) posts.push(post);
        }
      }
    };

    for (const [key, value] of Object.entries(gqlData)) {
      if (value && typeof value === 'object') {
        const container = value as Record<string, unknown>;
        const containerKeys = Object.keys(container).slice(0, 15);
        console.log(`[CL:WORKER] extractPosts Strategy2: data.data.${key} keys=[${containerKeys.join(',')}]`);

        // Check direct elements/*elements on this container
        const elements = container.elements || container['*elements'];
        if (Array.isArray(elements)) {
          const fieldName = container.elements ? 'elements' : '*elements';
          processElements(elements, `data.data.${key}.${fieldName}`);
        } else {
          // Search one level deeper — some GraphQL responses wrap results in nested objects
          for (const [subKey, subValue] of Object.entries(container)) {
            if (subValue && typeof subValue === 'object' && !Array.isArray(subValue)) {
              const subContainer = subValue as Record<string, unknown>;
              const subElements = subContainer.elements || subContainer['*elements'];
              if (Array.isArray(subElements)) {
                const fieldName = subContainer.elements ? 'elements' : '*elements';
                processElements(subElements, `data.data.${key}.${subKey}.${fieldName}`);
              }
            }
          }
        }
      }
    }
  }

  // Strategy 3: Check top-level `elements` array
  if (Array.isArray(data.elements)) {
    for (const el of data.elements as Record<string, unknown>[]) {
      if (!el || typeof el !== 'object') continue;
      const target = (el.result && typeof el.result === 'object') ? el.result as Record<string, unknown> : el;
      const post = tryExtractPost(target);
      if (post) posts.push(post);
    }
  }

  console.log(`[CL:WORKER] extractPosts RESULT: ${posts.length} posts from ${seenUrns.size} URNs (included=${includedLen} elements=${elementsLen})`);
  return posts;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CookieResult {
  success: boolean;
  cookies?: Record<string, string>;
  authToken?: string | null;
  csrfToken?: string | null;
  isAuthenticated: boolean;
  error?: string;
}

interface StorageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CaptureStats {
  totalCaptures: number;
  successfulCaptures: number;
  failedCaptures: number;
  capturesByType: Record<string, { success: number; failed: number }>;
  lastCapture: {
    type: string;
    success: boolean;
    timestamp: string;
    identifier?: string;
  } | null;
  captureHistory: Array<{
    type: string;
    success: boolean;
    timestamp: string;
    identifier?: string;
  }>;
}

interface AnalyticsHistoryEntry {
  date: string;
  timestamp: string;
  impressions: number;
  membersReached: number;
  profileViews: number;
  topPostsCount: number;
}

interface AudienceHistoryEntry {
  date: string;
  timestamp: string;
  totalFollowers: number;
  followerGrowth: number;
  newFollowers: number;
}

// ============================================
// COOKIE MANAGEMENT
// ============================================

async function getLinkedInCookies(): Promise<CookieResult> {
  try {
    const cookies = await chrome.cookies.getAll({ domain: LINKEDIN_DOMAIN });
    const cookieMap: Record<string, string> = {};

    cookies.forEach((cookie) => {
      cookieMap[cookie.name] = cookie.value;
    });

    return {
      success: true,
      cookies: cookieMap,
      authToken: cookieMap[COOKIE_NAMES.AUTH_TOKEN] || null,
      csrfToken: cookieMap[COOKIE_NAMES.CSRF_TOKEN] || null,
      isAuthenticated: !!cookieMap[COOKIE_NAMES.AUTH_TOKEN],
    };
  } catch (error) {
    console.error('[ServiceWorker] Error getting cookies:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      isAuthenticated: false,
    };
  }
}

async function getLinkedInCookie(name: string): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: LINKEDIN_URL, name });
    return cookie ? cookie.value : null;
  } catch (error) {
    console.error(`[ServiceWorker] Error getting cookie ${name}:`, error);
    return null;
  }
}

async function checkAuthentication(): Promise<{ isAuthenticated: boolean; token: string | null }> {
  const authToken = await getLinkedInCookie(COOKIE_NAMES.AUTH_TOKEN);
  return {
    isAuthenticated: !!authToken,
    token: authToken,
  };
}

// ============================================
// STORAGE MANAGEMENT
// ============================================

/**
 * Restore userId and Supabase auth from stored session if currentUserId is null.
 * Call this before any direct queueForSync usage outside of saveToStorage.
 * @returns The current userId (may still be null if no session exists)
 */
async function ensureUserId(): Promise<string | null> {
  let userId = getCurrentUserId();
  if (userId) return userId;

  // First try the auth module which handles token refresh properly
  try {
    const supabaseAuth = (self as unknown as { supabaseAuth?: {
      getSession: () => Promise<{ session?: { user?: { id: string }; access_token?: string }; user?: { id: string } }>;
    } }).supabaseAuth;
    if (supabaseAuth) {
      const { session, user } = await supabaseAuth.getSession();
      const authUserId = user?.id || session?.user?.id;
      if (authUserId) {
        console.log(`[CL:WORKER] Restored userId via auth module (with refresh): ${authUserId.substring(0, 8)}...`);
        setCurrentUserId(authUserId);
        return authUserId;
      }
    }
  } catch (authErr) {
    console.warn('[CL:WORKER] Auth module restore failed:', authErr instanceof Error ? authErr.message : authErr);
  }

  // Fallback to storage — but check expiry before setting JWT
  try {
    const sessionResult = await chrome.storage.local.get('supabase_session');
    if (sessionResult.supabase_session?.user?.id) {
      const session = sessionResult.supabase_session;
      const restoredUserId = session.user.id;
      console.log(`[CL:WORKER] Restored userId from session: ${restoredUserId.substring(0, 8)}...`);
      setCurrentUserId(restoredUserId);

      // Only set auth if token is not expired
      const isExpired = session.expires_at && (Date.now() / 1000) > session.expires_at;
      if (!isExpired && self.supabase && session.access_token) {
        self.supabase.setAuth(session.access_token, restoredUserId);
        console.log(`[CL:WORKER] Set auth on Supabase client`);
      } else if (isExpired) {
        console.warn(`[CL:WORKER] Stored JWT is expired — not setting on client`);
      }

      return restoredUserId;
    }
  } catch (err) {
    console.error('[CL:WORKER] Failed to restore userId:', err);
  }
  return null;
}

async function saveToStorage<T>(key: string, data: T, skipSync = false): Promise<StorageResult> {
  try {
    const syncable = isSyncableKey(key);
    // Ensure userId is available for syncable keys
    const userId = syncable ? await ensureUserId() : getCurrentUserId();

    console.log(`[ServiceWorker] saveToStorage: key=${key}, syncable=${syncable}, userId=${userId ? userId.substring(0, 8) + '...' : 'null'}`);

    // Use sync bridge for syncable keys when user is authenticated
    if (syncable && userId) {
      console.log(`[ServiceWorker] Using saveWithSync for ${key}`);
      const result = await saveWithSync(key, data as Record<string, unknown>, skipSync);
      if (!result.success) {
        console.error('[ServiceWorker] Sync save error:', result.error);
      }
      return result;
    }

    // Direct storage for non-syncable keys or when not authenticated
    console.log(`[ServiceWorker] Direct storage for ${key} (no sync)`);
    await chrome.storage.local.set({ [key]: data });
    return { success: true };
  } catch (error) {
    console.error('[ServiceWorker] Storage save error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getFromStorage<T>(key: string): Promise<StorageResult<T>> {
  try {
    const result = await chrome.storage.local.get(key);
    return { success: true, data: result[key] || null };
  } catch (error) {
    console.error('[ServiceWorker] Storage get error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getAllStoredData(): Promise<StorageResult<Record<string, unknown>>> {
  try {
    const result = await chrome.storage.local.get(null);
    return { success: true, data: result };
  } catch (error) {
    console.error('[ServiceWorker] Storage get all error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function clearStorage(): Promise<StorageResult> {
  try {
    await chrome.storage.local.clear();
    return { success: true };
  } catch (error) {
    console.error('[ServiceWorker] Storage clear error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function appendToStorage<T extends Record<string, unknown>>(
  key: string,
  newData: T,
  maxItems = 1000,
  skipSync = false
): Promise<StorageResult<{ count: number }>> {
  try {
    // Use sync bridge for syncable keys when user is authenticated
    if (isSyncableKey(key) && getCurrentUserId()) {
      const result = await appendWithSync(key, newData, maxItems, skipSync);
      if (!result.success) {
        console.error('[ServiceWorker] Sync append error:', result.error);
      }
      return { success: result.success, data: { count: result.count || 0 }, error: result.error };
    }

    // Direct storage for non-syncable keys or when not authenticated
    const existing = await getFromStorage<T[]>(key);
    const currentArray = existing.data || [];

    const dataWithTimestamp = {
      ...newData,
      capturedAt: new Date().toISOString(),
    };

    currentArray.push(dataWithTimestamp as T);
    const trimmedArray = currentArray.slice(-maxItems);

    await chrome.storage.local.set({ [key]: trimmedArray });
    return { success: true, data: { count: trimmedArray.length } };
  } catch (error) {
    console.error('[ServiceWorker] Append to storage error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// HISTORY TRACKING
// ============================================

async function addToAnalyticsHistory(analyticsData: Partial<CreatorAnalytics>): Promise<StorageResult> {
  try {
    const existing = await getFromStorage<AnalyticsHistoryEntry[]>(STORAGE_KEYS.ANALYTICS_HISTORY);
    let history = existing.data || [];

    const today = new Date().toISOString().split('T')[0];
    const entry: AnalyticsHistoryEntry = {
      date: today,
      timestamp: new Date().toISOString(),
      impressions: analyticsData.impressions || 0,
      membersReached: analyticsData.membersReached || 0,
      profileViews: analyticsData.profileViews || 0,
      topPostsCount: analyticsData.topPosts?.length || 0,
    };

    // Don't create new analytics_history entries with all-zero metrics
    // (happens when creator analytics returns 404 but profile_views still syncs)
    const hasSubstantiveData = entry.impressions > 0 || (analyticsData.engagements || 0) > 0 || (analyticsData.newFollowers || 0) > 0;

    const existingIndex = history.findIndex((h) => h.date === today);
    if (existingIndex >= 0) {
      // Update existing entry - merge profile_views but don't overwrite non-zero values with zeros
      const existing = history[existingIndex];
      history[existingIndex] = {
        ...existing,
        profileViews: entry.profileViews || existing.profileViews,
        // Only overwrite impressions etc if we have real data
        ...(hasSubstantiveData ? {
          impressions: entry.impressions,
          membersReached: entry.membersReached,
          topPostsCount: entry.topPostsCount,
        } : {}),
        timestamp: entry.timestamp,
      };
    } else if (hasSubstantiveData || entry.profileViews > 0) {
      // Only create new entry if we have some data
      history.push(entry);
    }

    history = history.slice(-90);
    await saveToStorage(STORAGE_KEYS.ANALYTICS_HISTORY, history);
    console.log(`[ServiceWorker] Analytics history updated: ${history.length} entries`);

    // ============================================
    // SYNC TO SUPABASE - analytics_history table
    // ============================================
    const userId = getCurrentUserId();
    if (userId) {
      try {
        // Queue the individual entry for sync to Supabase
        const supabaseEntry = {
          date: today,
          impressions: entry.impressions,
          members_reached: entry.membersReached,
          profile_views: entry.profileViews,
          engagements: analyticsData.engagements || 0,
          followers: analyticsData.newFollowers || 0,
        };
        await queueForSync('linkedin_analytics_history', supabaseEntry);
        console.log(`[ServiceWorker] Analytics history entry queued for Supabase sync`);
      } catch (syncError) {
        console.warn('[ServiceWorker] Failed to queue analytics history for sync:', syncError);
        // Don't fail the main operation if sync queueing fails
      }
    }

    return { success: true, data: { entries: history.length } };
  } catch (error) {
    console.error('[ServiceWorker] Error updating analytics history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function addToAudienceHistory(audienceData: Partial<AudienceAnalytics>): Promise<StorageResult> {
  try {
    const existing = await getFromStorage<AudienceHistoryEntry[]>(STORAGE_KEYS.AUDIENCE_HISTORY);
    let history = existing.data || [];

    const today = new Date().toISOString().split('T')[0];
    const entry: AudienceHistoryEntry = {
      date: today,
      timestamp: new Date().toISOString(),
      totalFollowers: audienceData.totalFollowers || 0,
      followerGrowth: audienceData.growthRate || 0,
      newFollowers: audienceData.newFollowers || 0,
    };

    const existingIndex = history.findIndex((h) => h.date === today);
    if (existingIndex >= 0) {
      history[existingIndex] = entry;
    } else {
      history.push(entry);
    }

    history = history.slice(-90);
    await saveToStorage(STORAGE_KEYS.AUDIENCE_HISTORY, history);
    console.log(`[ServiceWorker] Audience history updated: ${history.length} entries`);

    // ============================================
    // SYNC TO SUPABASE - audience history via analytics_history table
    // (Using same table but with follower-focused data)
    // ============================================
    const userId = getCurrentUserId();
    if (userId) {
      try {
        // Queue for sync - will be stored with follower data
        // Note: follower_growth column does not exist in audience_history table
        const supabaseEntry = {
          date: today,
          total_followers: entry.totalFollowers,
          new_followers: entry.newFollowers,
        };
        await queueForSync('linkedin_audience_history', supabaseEntry);
        console.log(`[ServiceWorker] Audience history entry queued for Supabase sync`);
      } catch (syncError) {
        console.warn('[ServiceWorker] Failed to queue audience history for sync:', syncError);
        // Don't fail the main operation if sync queueing fails
      }
    }

    return { success: true, data: { entries: history.length } };
  } catch (error) {
    console.error('[ServiceWorker] Error updating audience history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function updateCaptureStats(captureType: string, success: boolean): Promise<StorageResult> {
  try {
    const existing = await getFromStorage<CaptureStats>(STORAGE_KEYS.CAPTURE_STATS);
    const stats: CaptureStats = existing.data || {
      totalCaptures: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      capturesByType: {},
      lastCapture: null,
      captureHistory: [],
    };

    stats.totalCaptures++;
    if (success) {
      stats.successfulCaptures++;
    } else {
      stats.failedCaptures++;
    }

    if (!stats.capturesByType[captureType]) {
      stats.capturesByType[captureType] = { success: 0, failed: 0 };
    }
    if (success) {
      stats.capturesByType[captureType].success++;
    } else {
      stats.capturesByType[captureType].failed++;
    }

    stats.lastCapture = {
      type: captureType,
      success,
      timestamp: new Date().toISOString(),
    };

    stats.captureHistory.push({
      type: captureType,
      success,
      timestamp: new Date().toISOString(),
    });
    stats.captureHistory = stats.captureHistory.slice(-50);

    await saveToStorage(STORAGE_KEYS.CAPTURE_STATS, stats);
    console.log(`[ServiceWorker] Capture stats updated: ${stats.totalCaptures} total`);

    return { success: true, data: { stats } };
  } catch (error) {
    console.error('[ServiceWorker] Error updating capture stats:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Handle capture result and show notification
 * Shows failure notification if capture was unsuccessful
 */
async function handleCaptureResult(
  captureType: string,
  response: StorageResult,
  successDetails?: string
): Promise<void> {
  await updateCaptureStats(captureType, response.success);

  if (response.success) {
    await showCaptureNotification(captureType, successDetails);
  } else {
    await showCaptureFailureNotification(
      captureType,
      response.error || 'Storage operation failed'
    );
  }
}

async function getAnalyticsGrowth(): Promise<StorageResult> {
  try {
    const existing = await getFromStorage<AnalyticsHistoryEntry[]>(STORAGE_KEYS.ANALYTICS_HISTORY);
    const history = existing.data || [];

    if (history.length < 2) {
      return { success: true, data: { growth: null, message: 'Not enough data for growth calculation' } };
    }

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    const growth = {
      impressionsChange: latest.impressions - previous.impressions,
      impressionsGrowth:
        previous.impressions > 0
          ? ((latest.impressions - previous.impressions) / previous.impressions * 100).toFixed(2)
          : 0,
      membersReachedChange: latest.membersReached - previous.membersReached,
      profileViewsChange: latest.profileViews - previous.profileViews,
      period: `${previous.date} to ${latest.date}`,
    };

    return { success: true, data: { growth } };
  } catch (error) {
    console.error('[ServiceWorker] Error calculating analytics growth:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getAudienceGrowth(): Promise<StorageResult> {
  try {
    const existing = await getFromStorage<AudienceHistoryEntry[]>(STORAGE_KEYS.AUDIENCE_HISTORY);
    const history = existing.data || [];

    if (history.length < 2) {
      return { success: true, data: { growth: null, message: 'Not enough data for growth calculation' } };
    }

    const latest = history[history.length - 1];
    const oldest = history[0];

    const growth: Record<string, unknown> = {
      totalGrowth: latest.totalFollowers - oldest.totalFollowers,
      growthRate:
        oldest.totalFollowers > 0
          ? ((latest.totalFollowers - oldest.totalFollowers) / oldest.totalFollowers * 100).toFixed(2)
          : 0,
      period: `${oldest.date} to ${latest.date}`,
      daysTracked: history.length,
    };

    if (history.length >= 7) {
      const weekAgo = history[history.length - 7];
      growth.weeklyGrowth = latest.totalFollowers - weekAgo.totalFollowers;
      growth.weeklyGrowthRate =
        weekAgo.totalFollowers > 0
          ? ((latest.totalFollowers - weekAgo.totalFollowers) / weekAgo.totalFollowers * 100).toFixed(2)
          : 0;
    }

    return { success: true, data: { growth } };
  } catch (error) {
    console.error('[ServiceWorker] Error calculating audience growth:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// POST ANALYTICS STORAGE
// ============================================

interface PostAnalyticsData {
  activityUrn: string;
  impressions?: number;
  engagement?: {
    reactions?: number;
    comments?: number;
    reposts?: number;
  };
  engagementRate?: string;
  [key: string]: unknown;
}

async function savePostAnalyticsToStorage(newData: PostAnalyticsData): Promise<StorageResult> {
  try {
    if (!newData?.activityUrn) {
      return { success: false, error: 'No activity URN provided' };
    }

    const existing = await getFromStorage<{ posts: PostAnalyticsData[]; stats: Record<string, unknown> }>(
      STORAGE_KEYS.POST_ANALYTICS_DATA
    );
    const existingData = existing.data || { posts: [], stats: {} };
    let allPosts = existingData.posts || [];

    const existingIndex = allPosts.findIndex((p) => p.activityUrn === newData.activityUrn);

    if (existingIndex >= 0) {
      allPosts[existingIndex] = {
        ...allPosts[existingIndex],
        ...newData,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      allPosts.push({
        ...newData,
        firstCaptured: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }

    allPosts.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    allPosts = allPosts.slice(0, 100);

    const totalImpressions = allPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const totalReactions = allPosts.reduce((sum, p) => sum + (p.engagement?.reactions || 0), 0);
    const totalComments = allPosts.reduce((sum, p) => sum + (p.engagement?.comments || 0), 0);

    const postAnalyticsData = {
      posts: allPosts,
      totalCount: allPosts.length,
      lastUpdated: new Date().toISOString(),
      stats: {
        totalImpressions,
        totalReactions,
        totalComments,
        avgImpressions: allPosts.length > 0 ? Math.round(totalImpressions / allPosts.length) : 0,
        avgReactions: allPosts.length > 0 ? Math.round(totalReactions / allPosts.length) : 0,
      },
    };

    // Save the aggregate blob to local storage only (skip Supabase sync for the blob).
    // The blob ({ posts, stats }) is a local convenience structure — not a valid post_analytics row.
    await saveToStorage(STORAGE_KEYS.POST_ANALYTICS_DATA, postAnalyticsData, /* skipSync */ true);

    // Instead, sync each individual post as a flattened record to the post_analytics table.
    // This ensures prepareForSupabase receives per-post data with top-level fields.
    const userId = getCurrentUserId();
    if (userId) {
      // Access raw data to handle both typed and untyped access patterns
      const raw = newData as Record<string, unknown>;
      const engagement = raw.engagement as Record<string, unknown> | undefined;
      const profileActivity = raw.profileActivity as Record<string, unknown> | undefined;

      const flatPost: Record<string, unknown> = {
        activityUrn: raw.activityUrn,
        impressions: raw.impressions ?? null,
        membersReached: raw.membersReached ?? null,
        reactions: engagement?.reactions ?? null,
        comments: engagement?.comments ?? null,
        reposts: engagement?.reposts ?? null,
        profileViewers: profileActivity?.profileViewers ?? null,
        followersGained: profileActivity?.followersGained ?? null,
        engagementRate: raw.engagementRate ?? null,
      };

      // Only sync if we have at least one metric value (avoid syncing empty records from failed extractions)
      const hasMetrics = flatPost.impressions !== null || flatPost.reactions !== null ||
                         flatPost.comments !== null || flatPost.reposts !== null;

      console.log(`[ServiceWorker] Post analytics flat data:`, JSON.stringify(flatPost));
      console.log(`[ServiceWorker] Raw engagement:`, JSON.stringify(engagement));
      console.log(`[ServiceWorker] Raw profileActivity:`, JSON.stringify(profileActivity));
      console.log(`[ServiceWorker] Has metrics: ${hasMetrics}`);

      if (hasMetrics) {
        await queueForSync(STORAGE_KEYS.POST_ANALYTICS_DATA, flatPost);
        console.log(`[ServiceWorker] Post analytics queued for sync (flattened): ${raw.activityUrn}`);
      } else {
        console.warn(`[ServiceWorker] Skipping sync for ${raw.activityUrn} — no metric data extracted`);
      }
    }

    console.log(`[ServiceWorker] Post analytics saved: ${allPosts.length} posts, latest: ${newData.activityUrn}`);

    return {
      success: true,
      data: { totalCount: allPosts.length, isUpdate: existingIndex >= 0 },
    };
  } catch (error) {
    console.error('[ServiceWorker] Error saving post analytics:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// AUDIENCE DATA STORAGE
// ============================================

async function saveAudienceDataToStorage(newData: Partial<AudienceAnalytics>): Promise<StorageResult> {
  try {
    if (!newData) {
      return { success: false, error: 'No audience data provided' };
    }

    const audienceData = {
      ...newData,
      lastUpdated: new Date().toISOString(),
    };

    await saveToStorage(STORAGE_KEYS.AUDIENCE_DATA, audienceData);
    console.log(`[ServiceWorker] Audience data saved: ${newData.totalFollowers} followers`);

    return { success: true, data: { totalFollowers: newData.totalFollowers } };
  } catch (error) {
    console.error('[ServiceWorker] Error saving audience data:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

async function exportAsJSON(): Promise<StorageResult<{ content: string; filename: string }>> {
  const allData = await getAllStoredData();
  if (!allData.success) {
    return { success: false, error: allData.error };
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '4.0.0',
    data: allData.data,
  };

  return {
    success: true,
    data: {
      content: JSON.stringify(exportData, null, 2),
      filename: `linkedin-data-${Date.now()}.json`,
    },
  };
}

async function exportAsCSV(dataKey: string): Promise<StorageResult<{ content: string; filename: string }>> {
  const result = await getFromStorage<unknown[]>(dataKey);
  if (!result.success || !result.data) {
    return { success: false, error: 'No data to export' };
  }

  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { success: false, error: 'No data to export' };
  }

  const allKeys = new Set<string>();
  data.forEach((item) => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach((key) => allKeys.add(key));
    }
  });

  const headers = Array.from(allKeys);
  const csvRows = [headers.join(',')];

  data.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const record = item as Record<string, unknown>;
    const row = headers.map((header) => {
      const value = record[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return String(value).replace(/"/g, '""');
    });
    csvRows.push(row.map((v) => `"${v}"`).join(','));
  });

  return {
    success: true,
    data: {
      content: csvRows.join('\n'),
      filename: `linkedin-${dataKey}-${Date.now()}.csv`,
    },
  };
}

// ============================================
// LINKEDIN API FUNCTIONS
// ============================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function fetchLinkedInAPI(endpoint: string, options: RequestInit = {}): Promise<StorageResult> {
  try {
    const cookies = await getLinkedInCookies();
    if (!cookies.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    const csrfToken = cookies.csrfToken?.replace(/"/g, '') || '';

    const headers: HeadersInit = {
      accept: 'application/vnd.linkedin.normalized+json+2.1',
      'accept-language': 'en-US,en;q=0.9',
      'csrf-token': csrfToken,
      'x-li-lang': 'en_US',
      'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;' + generateUUID(),
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.8960',
        mpVersion: '1.13.8960',
        osName: 'web',
        timezoneOffset: new Date().getTimezoneOffset() / -60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web',
      }),
      'x-restli-protocol-version': '2.0.0',
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(`https://www.linkedin.com${endpoint}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`[ServiceWorker] API error: ${response.status} for ${endpoint}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[ServiceWorker] API fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// LINKEDIN MENTION SEARCH (for web app @mention)
// ============================================

/**
 * MiniProfile shape from Voyager search/blended included array
 */
interface VoyagerMiniProfile {
  $type?: string;
  firstName?: string;
  lastName?: string;
  occupation?: string;
  entityUrn?: string;
  objectUrn?: string;
  publicIdentifier?: string;
  picture?: {
    rootUrl?: string;
    artifacts?: Array<{
      width?: number;
      height?: number;
      fileIdentifyingUrlPathSegment?: string;
    }>;
  };
}

/**
 * Known GraphQL queryId hashes for voyagerSearchDashClusters.
 * LinkedIn rotates these hashes periodically (every 4-8 weeks).
 * When one stops working, add the new hash at the top of this list.
 * The hash can be extracted from LinkedIn's bundled JS in the browser.
 */
const SEARCH_QUERY_IDS = [
  'voyagerSearchDashClusters.994bf4e7d2173b92ccdb5935710c3c5d',
  'voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0',
  'voyagerSearchDashClusters.2e1bd7852900a8ea30c06e5e09d1843b',
];

/**
 * Attempt a single Voyager fetch with a timeout.
 * @param url - Voyager API endpoint
 * @param headers - Pre-built Voyager headers
 * @param label - Human-readable label for logging
 * @returns The fetch Response, or null if it failed/timed out
 */
async function tryVoyagerFetch(
  url: string,
  headers: Record<string, string>,
  label: string,
): Promise<Response | null> {
  try {
    console.log(`[MentionSearch] Trying ${label}: ${url.substring(0, 120)}...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);
    console.log(`[MentionSearch] ${label} status: ${response.status}`);
    if (response.ok) return response;
    return null;
  } catch (err) {
    console.warn(`[MentionSearch] ${label} failed:`, err);
    return null;
  }
}

/**
 * Search LinkedIn users via Voyager API.
 * Tries multiple endpoint strategies in order:
 *   1. typeahead/hitsV2 (newer lightweight endpoint)
 *   2. GraphQL search with multiple queryId hashes (rotated by LinkedIn)
 *   3. search/dash/clusters REST endpoint
 * Cookies stay in the extension — only parsed results are returned.
 * @param query - Search query string
 * @returns Object with success flag and results array
 */
async function handleMentionSearch(query: string): Promise<{
  success: boolean;
  results: Array<{
    name: string;
    urn: string;
    headline: string | null;
    avatarUrl: string | null;
    publicIdentifier: string | null;
    type: 'person' | 'company';
  }>;
  error?: string;
}> {
  console.log(`[MentionSearch] Starting search for "${query}"`);
  try {
    // Read cookies directly — they never leave the extension
    const liAt = await chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'li_at' });
    const jsessionid = await chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'JSESSIONID' });

    console.log(`[MentionSearch] Cookies: li_at=${liAt ? 'found' : 'MISSING'}, JSESSIONID=${jsessionid ? 'found' : 'MISSING'}`);

    if (!liAt?.value || !jsessionid?.value) {
      console.warn('[MentionSearch] Missing LinkedIn cookies — user not logged in');
      return { success: false, results: [], error: 'Not logged into LinkedIn' };
    }

    const csrfToken = jsessionid.value.replace(/"/g, '');
    const encodedQuery = encodeURIComponent(query);

    // Generate UUID for page instance (required by Voyager)
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    // Build headers matching what LinkedIn expects (same as working background-sync)
    const headers: Record<string, string> = {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'accept-language': 'en-US,en;q=0.9',
      'csrf-token': csrfToken,
      'x-li-lang': 'en_US',
      'x-li-page-instance': `urn:li:page:d_flagship3_feed;${uuid}`,
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.8960',
        mpVersion: '1.13.8960',
        osName: 'web',
        timezoneOffset: new Date().getTimezoneOffset() / -60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web',
      }),
      'x-restli-protocol-version': '2.0.0',
      'cookie': `li_at=${liAt.value}; JSESSIONID=${jsessionid.value}`,
    };

    let response: Response | null = null;

    // Strategy 1: typeahead/hitsV2 — newer version of the deprecated typeahead/hits
    // Request both PEOPLE and COMPANY results for blended mention search
    response = await tryVoyagerFetch(
      'https://www.linkedin.com/voyager/api/typeahead/hitsV2' +
        `?q=blended&query=${encodedQuery}` +
        '&count=10&types=List(PEOPLE,COMPANY)',
      headers,
      'typeahead/hitsV2',
    );

    // Strategy 2: GraphQL search with multiple queryId hashes
    // LinkedIn rotates the hash — try each known hash until one works
    if (!response) {
      for (const queryId of SEARCH_QUERY_IDS) {
        response = await tryVoyagerFetch(
          'https://www.linkedin.com/voyager/api/graphql' +
            `?variables=(start:0,origin:SWITCH_SEARCH_VERTICAL,query:(keywords:${encodedQuery},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE,COMPANY))),includeFiltersInResponse:false))` +
            `&queryId=${queryId}`,
          headers,
          `graphql(${queryId.split('.')[1]?.substring(0, 8)}...)`,
        );
        if (response) break;
      }
    }

    // Strategy 3: search/dash/clusters REST endpoint (newer than search/blended)
    if (!response) {
      response = await tryVoyagerFetch(
        'https://www.linkedin.com/voyager/api/search/dash/clusters' +
          `?q=all&query=(keywords:${encodedQuery},flagshipSearchIntent:SEARCH_SRP,` +
          'queryParameters:List((key:resultType,value:List(PEOPLE,COMPANY))))' +
          '&count=10&start=0&origin=GLOBAL_SEARCH_HEADER',
        headers,
        'search/dash/clusters',
      );
    }

    // Strategy 4: legacy typeahead/hits (kept as last resort)
    if (!response) {
      response = await tryVoyagerFetch(
        'https://www.linkedin.com/voyager/api/typeahead/hits' +
          `?q=blended&query=${encodedQuery}&types=List(PEOPLE,COMPANY)`,
        headers,
        'typeahead/hits (legacy)',
      );
    }

    if (!response) {
      console.error('[MentionSearch] All Voyager endpoints failed');
      return { success: false, results: [], error: 'All LinkedIn API endpoints failed' };
    }

    const data = await response.json() as Record<string, unknown>;
    const responseUrl = response.url;
    console.log(`[MentionSearch] Success from: ${responseUrl.substring(0, 80)}...`);
    console.log(`[MentionSearch] Response keys: ${Object.keys(data || {}).join(', ')}`);

    type MentionResult = {
      name: string;
      urn: string;
      headline: string | null;
      avatarUrl: string | null;
      publicIdentifier: string | null;
      type: 'person' | 'company';
    };
    const results: MentionResult[] = [];
    const seen = new Set<string>();

    /**
     * Helper: Detect whether an entity is a company based on URN or $type
     */
    function isCompanyEntity(entityUrn?: string, $type?: string): boolean {
      if (entityUrn && (entityUrn.includes('urn:li:company:') || entityUrn.includes('urn:li:organization:') || entityUrn.includes('urn:li:fsd_company:'))) return true;
      if ($type && ($type.includes('Company') || $type.includes('Organization'))) return true;
      return false;
    }

    /**
     * Helper: Extract a clean company URN from various LinkedIn URN formats.
     * Handles: urn:li:company:X, urn:li:organization:X, urn:li:fsd_company:X,
     * urn:li:fs_entityResultViewModel:(urn:li:fsd_company:X,...)
     */
    function toCompanyUrn(rawUrn: string): string {
      const companyMatch = rawUrn.match(/urn:li:(?:fsd_company|company|organization):([^,)]+)/);
      if (companyMatch) return `urn:li:organization:${companyMatch[1]}`;
      const id = rawUrn.split(':').pop() || rawUrn;
      return `urn:li:organization:${id}`;
    }

    /**
     * Helper: Extract company logo URL from Voyager logo or logoV2 object
     */
    function buildCompanyLogo(logo: Record<string, unknown> | undefined): string | null {
      if (!logo) return null;
      // Try vectorImage path (logoV2 format)
      const vectorImage = (logo.image?.valueOf() as Record<string, unknown>)?.['com.linkedin.common.VectorImage'] as Record<string, unknown> | undefined
        || logo['com.linkedin.common.VectorImage'] as Record<string, unknown> | undefined
        || logo.vectorImage as Record<string, unknown> | undefined;
      if (vectorImage?.rootUrl) {
        const arts = (vectorImage.artifacts || []) as Array<Record<string, unknown>>;
        if (arts.length > 0) {
          const art = arts.find(a => (a.width as number) === 100) || arts[0];
          if (art?.fileIdentifyingUrlPathSegment) {
            return `${vectorImage.rootUrl}${art.fileIdentifyingUrlPathSegment}`;
          }
        }
      }
      // Try rootUrl + artifacts directly (legacy format)
      if (logo.rootUrl && (logo.artifacts as unknown[])) {
        const arts = (logo.artifacts || []) as Array<Record<string, unknown>>;
        if (arts.length > 0) {
          const art = arts.find(a => (a.width as number) === 100) || arts[0];
          if (art?.fileIdentifyingUrlPathSegment) {
            return `${logo.rootUrl}${art.fileIdentifyingUrlPathSegment}`;
          }
        }
      }
      return null;
    }

    /**
     * Helper: Extract public slug (universalName) from a company navigation URL
     */
    function extractCompanySlug(navUrl: string | undefined): string | null {
      if (!navUrl) return null;
      const match = navUrl.match(/\/company\/([^/?]+)/);
      return match ? match[1] : null;
    }

    /**
     * Helper: Build avatar URL from Voyager picture object (legacy MiniProfile format)
     */
    function buildAvatar(picture?: VoyagerMiniProfile['picture']): string | null {
      if (!picture?.rootUrl || !picture.artifacts?.length) return null;
      const artifact =
        picture.artifacts.find(a => a.width === 100 && a.height === 100) ||
        picture.artifacts[0];
      if (!artifact?.fileIdentifyingUrlPathSegment) return null;
      return `${picture.rootUrl}${artifact.fileIdentifyingUrlPathSegment}`;
    }

    /**
     * Helper: Extract avatar URL from GraphQL EntityResultViewModel image object
     */
    function extractGraphqlAvatar(imageObj: Record<string, unknown> | undefined): string | null {
      if (!imageObj) return null;
      const imageAttrs = (imageObj.attributes || []) as Array<Record<string, unknown>>;
      if (imageAttrs.length === 0) return null;
      const detailData = imageAttrs[0].detailData as Record<string, unknown> | undefined;
      // Try nonEntityProfilePicture path (most common for people search)
      const nonEntity = detailData?.nonEntityProfilePicture as Record<string, unknown> | undefined;
      // Also try profilePicture path (alternative)
      const profilePic = detailData?.profilePicture as Record<string, unknown> | undefined;
      const vectorImage = (nonEntity?.vectorImage || profilePic?.vectorImage) as Record<string, unknown> | undefined;
      if (!vectorImage?.rootUrl) return null;
      const arts = (vectorImage.artifacts || []) as Array<Record<string, unknown>>;
      if (arts.length === 0) return null;
      const art = arts.find(a => (a.width as number) === 100) || arts[0];
      if (!art?.fileIdentifyingUrlPathSegment) return null;
      return `${vectorImage.rootUrl}${art.fileIdentifyingUrlPathSegment}`;
    }

    /**
     * Helper: Extract text from a LinkedIn text object (handles both {text:"..."} and plain string)
     */
    function extractText(obj: unknown): string {
      if (typeof obj === 'string') return obj;
      if (obj && typeof obj === 'object' && 'text' in obj) return (obj as Record<string, unknown>).text as string || '';
      return '';
    }

    /**
     * Helper: Extract publicIdentifier from a LinkedIn navigation URL
     */
    function extractPublicId(navUrl: string | undefined): string | null {
      if (!navUrl) return null;
      const match = navUrl.match(/\/in\/([^/?]+)/);
      return match ? match[1] : null;
    }

    /**
     * Helper: Extract a clean person URN from various LinkedIn URN formats.
     * Handles: urn:li:fsd_profile:X, urn:li:fs_miniProfile:X,
     * urn:li:fs_entityResultViewModel:(urn:li:fsd_profile:X,...), urn:li:member:X
     */
    function toPersonUrn(rawUrn: string): string {
      // EntityResultViewModel URN contains inner URN: extract fsd_profile part
      const innerMatch = rawUrn.match(/urn:li:fsd_profile:([^,)]+)/);
      if (innerMatch) return `urn:li:person:${innerMatch[1]}`;
      // fs_miniProfile or member URN: just take the last segment
      const id = rawUrn.split(':').pop() || rawUrn;
      return `urn:li:person:${id}`;
    }

    /**
     * Helper: Add a result, deduplicating by URN
     */
    function addResult(r: MentionResult): void {
      if (seen.has(r.urn)) return;
      seen.add(r.urn);
      results.push(r);
    }

    // Build a URN lookup map from included[] for resolving pointer references
    const included = (data?.included || []) as Array<Record<string, unknown>>;
    const includedByUrn = new Map<string, Record<string, unknown>>();
    for (const item of included) {
      const urn = item.entityUrn as string | undefined;
      if (urn) includedByUrn.set(urn, item);
    }

    // Log distinct $type values for debugging
    if (included.length > 0) {
      const types = [...new Set(included.map(i => i.$type).filter(Boolean))];
      console.log(`[MentionSearch] included: ${included.length} items, types: ${types.join(', ')}`);
    }

    // ─── Strategy 1: Parse EntityResultViewModel objects from included[] ───
    // GraphQL search responses put these in the included array. They have
    // title.text (full name), primarySubtitle.text (headline), image, navigationUrl
    // Both person and company results use this same $type — differentiate by URN
    for (const item of included) {
      if (item.$type === 'com.linkedin.voyager.dash.search.EntityResultViewModel') {
        const name = extractText(item.title);
        const entityUrn = item.entityUrn as string | undefined;
        if (!name || !entityUrn) continue;

        const isCompany = isCompanyEntity(entityUrn);
        addResult({
          name,
          urn: isCompany ? toCompanyUrn(entityUrn) : toPersonUrn(entityUrn),
          headline: extractText(item.primarySubtitle) || null,
          avatarUrl: extractGraphqlAvatar(item.image as Record<string, unknown> | undefined),
          publicIdentifier: isCompany
            ? extractCompanySlug(item.navigationUrl as string | undefined)
            : extractPublicId(item.navigationUrl as string | undefined),
          type: isCompany ? 'company' : 'person',
        });
      }
    }

    // ─── Strategy 2: Parse legacy MiniProfile + MiniCompany objects from included[] ───
    // Older REST endpoints (typeahead/hits, search/blended) return these
    if (results.length === 0) {
      for (const item of included) {
        // Person results: MiniProfile
        if (
          item.$type === 'com.linkedin.voyager.identity.shared.MiniProfile' &&
          item.firstName && item.entityUrn
        ) {
          const mp = item as unknown as VoyagerMiniProfile;
          addResult({
            name: [mp.firstName, mp.lastName].filter(Boolean).join(' '),
            urn: toPersonUrn(mp.entityUrn!),
            headline: mp.occupation || null,
            avatarUrl: buildAvatar(mp.picture),
            publicIdentifier: mp.publicIdentifier || null,
            type: 'person',
          });
        }
        // Company results: Company or MiniCompany objects
        if (
          (item.$type?.includes('Company') || item.$type?.includes('Organization')) &&
          item.name && item.entityUrn &&
          isCompanyEntity(item.entityUrn as string, item.$type as string)
        ) {
          const companyName = item.name as string;
          const entityUrn = item.entityUrn as string;
          addResult({
            name: companyName,
            urn: toCompanyUrn(entityUrn),
            headline: (item.tagline || item.industry || null) as string | null,
            avatarUrl: buildCompanyLogo(item.logo as Record<string, unknown> | undefined)
              || buildCompanyLogo(item.logoV2 as Record<string, unknown> | undefined),
            publicIdentifier: (item.universalName as string) || null,
            type: 'company',
          });
        }
      }
    }

    // ─── Strategy 3: Walk the GraphQL data.data.searchDashClustersByAll tree ───
    // LinkedIn's normalized GraphQL response has a double-nested data structure:
    // response.data.data.searchDashClustersByAll.elements[].items[]
    // Items may have inline entityResult or URN pointers (*entityResult)
    if (results.length === 0) {
      // Navigate the double-nested data (data.data or data)
      const outerData = data?.data as Record<string, unknown> | undefined;
      const innerData = (outerData?.data || outerData) as Record<string, unknown> | undefined;
      const clusters = (
        innerData?.searchDashClustersByAll ||
        innerData?.searchClustersByAll
      ) as Record<string, unknown> | undefined;

      if (clusters) {
        const clusterElements = (clusters.elements || []) as Array<Record<string, unknown>>;
        console.log(`[MentionSearch] Walking cluster tree: ${clusterElements.length} clusters`);

        for (const cluster of clusterElements) {
          const items = (cluster.items || []) as Array<Record<string, unknown>>;
          for (const itemWrapper of items) {
            const itemObj = itemWrapper.item as Record<string, unknown> | undefined;
            if (!itemObj) continue;

            // Get entityResult — may be inline or via URN pointer
            let entityResult = itemObj.entityResult as Record<string, unknown> | undefined;
            if (!entityResult) {
              // Try URN pointer: "*entityResult" -> lookup in included
              const urnRef = (itemObj as Record<string, string>)['*entityResult'];
              if (urnRef) entityResult = includedByUrn.get(urnRef) as Record<string, unknown> | undefined;
            }
            if (!entityResult) continue;

            const name = extractText(entityResult.title);
            const entityUrn = entityResult.entityUrn as string | undefined;
            if (!name || !entityUrn) continue;

            const isCompany = isCompanyEntity(entityUrn);
            addResult({
              name,
              urn: isCompany ? toCompanyUrn(entityUrn) : toPersonUrn(entityUrn),
              headline: extractText(entityResult.primarySubtitle) || null,
              avatarUrl: extractGraphqlAvatar(entityResult.image as Record<string, unknown> | undefined),
              publicIdentifier: isCompany
                ? extractCompanySlug(entityResult.navigationUrl as string | undefined)
                : extractPublicId(entityResult.navigationUrl as string | undefined),
              type: isCompany ? 'company' : 'person',
            });
          }
        }
      } else if (outerData) {
        console.log(`[MentionSearch] graphql data keys: ${Object.keys(innerData || {}).join(', ')}`);
      }
    }

    // ─── Strategy 4: Typeahead elements array (typeahead/hits format) ───
    const elements = (data?.elements || []) as Array<Record<string, unknown>>;
    if (elements.length > 0 && results.length === 0) {
      console.log(`[MentionSearch] Parsing typeahead elements: ${elements.length} items`);
      for (const el of elements) {
        const hitInfo = (el.hitInfo || el) as Record<string, unknown>;
        // Check for person results (miniProfile / member)
        const mp = (hitInfo.miniProfile || hitInfo.member) as VoyagerMiniProfile | undefined;
        if (mp?.firstName && mp?.entityUrn) {
          addResult({
            name: [mp.firstName, mp.lastName].filter(Boolean).join(' '),
            urn: toPersonUrn(mp.entityUrn),
            headline: mp.occupation || null,
            avatarUrl: buildAvatar(mp.picture),
            publicIdentifier: mp.publicIdentifier || null,
            type: 'person',
          });
          continue;
        }
        // Check for company results (miniCompany / company)
        const co = (hitInfo.miniCompany || hitInfo.company || hitInfo) as Record<string, unknown>;
        if (co?.name && co?.entityUrn && isCompanyEntity(co.entityUrn as string, co.$type as string | undefined)) {
          addResult({
            name: co.name as string,
            urn: toCompanyUrn(co.entityUrn as string),
            headline: (co.tagline || co.industry || null) as string | null,
            avatarUrl: buildCompanyLogo(co.logo as Record<string, unknown> | undefined)
              || buildCompanyLogo(co.logoV2 as Record<string, unknown> | undefined),
            publicIdentifier: (co.universalName as string) || null,
            type: 'company',
          });
        }
      }
    }

    // ─── Strategy 5: Broadest fallback — any included item with firstName or company name ───
    if (results.length === 0 && included.length > 0) {
      console.log(`[MentionSearch] Broadest fallback: scanning for any firstName+entityUrn or company`);
      for (const item of included) {
        // Person fallback
        if (item.firstName && item.entityUrn) {
          const mp = item as unknown as VoyagerMiniProfile;
          addResult({
            name: [mp.firstName, mp.lastName].filter(Boolean).join(' '),
            urn: toPersonUrn(mp.entityUrn!),
            headline: mp.occupation || null,
            avatarUrl: buildAvatar(mp.picture),
            publicIdentifier: mp.publicIdentifier || null,
            type: 'person',
          });
        }
        // Company fallback
        if (item.name && item.entityUrn && isCompanyEntity(item.entityUrn as string, item.$type as string | undefined)) {
          addResult({
            name: item.name as string,
            urn: toCompanyUrn(item.entityUrn as string),
            headline: (item.tagline || item.industry || null) as string | null,
            avatarUrl: buildCompanyLogo(item.logo as Record<string, unknown> | undefined)
              || buildCompanyLogo(item.logoV2 as Record<string, unknown> | undefined),
            publicIdentifier: (item.universalName as string) || null,
            type: 'company',
          });
        }
      }
    }

    console.log(`[MentionSearch] Search complete for "${query}": ${results.length} results`);
    if (results.length > 0) {
      console.log(`[MentionSearch] First result: ${results[0].name} (${results[0].urn})`);
    }
    return { success: true, results };
  } catch (error) {
    console.error('[MentionSearch] Search failed:', error);
    return { success: false, results: [], error: error instanceof Error ? error.message : 'Search failed' };
  }
}

/**
 * Broadcast auth state change to all tabs running the ChainLinked platform
 * so the dashboard updates instantly without needing a refresh.
 * @param event - Auth event type (SIGNED_IN or SIGNED_OUT)
 * @param platformLoggedIn - Whether the extension is now logged in
 */
function broadcastAuthStateChange(event: string, platformLoggedIn: boolean): void {
  chrome.tabs.query({}, (tabs) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://chainlinked.app',
      'https://www.chainlinked.app',
      'https://chainlinked.ai',
      'https://www.chainlinked.ai',
    ];
    for (const tab of tabs) {
      if (tab.id && tab.url && allowedOrigins.some((o) => tab.url!.startsWith(o))) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'CHAINLINKED_AUTH_STATE_CHANGED',
          event,
          platformLoggedIn,
        }).catch(() => { /* tab may not have content script */ });
      }
    }
  });
}

// ============================================
// EXTERNAL MESSAGE HANDLING (from web app)
// ============================================

chrome.runtime.onMessageExternal.addListener(
  (message: { type?: string; query?: string }, sender, sendResponse) => {
    console.log(`[ExternalMsg] Received: type=${message?.type}, from=${sender?.origin || 'unknown'}`);
    if (message?.type === 'CHAINLINKED_PING') {
      console.log('[ExternalMsg] Responding to PING with status check');
      // Check LinkedIn login status via cookies
      Promise.all([
        chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'li_at' }),
        self.supabaseAuth?.getSession?.(),
      ]).then(([liAtCookie, sessionResult]) => {
        const linkedInLoggedIn = !!liAtCookie?.value;
        const platformLoggedIn = !!(sessionResult?.session?.user || sessionResult?.user);
        const extensionEmail = sessionResult?.session?.user?.email || sessionResult?.user?.email || null;
        console.log(`[ExternalMsg] PING response: linkedIn=${linkedInLoggedIn}, platform=${platformLoggedIn}, email=${extensionEmail}`);
        sendResponse({
          installed: true,
          version: chrome.runtime.getManifest().version,
          linkedInLoggedIn,
          platformLoggedIn,
          email: extensionEmail,
        });
      }).catch((err) => {
        console.error('[ExternalMsg] PING status check error:', err);
        sendResponse({
          installed: true,
          version: chrome.runtime.getManifest().version,
          linkedInLoggedIn: false,
          platformLoggedIn: false,
        });
      });
    } else if (message?.type === 'CHAINLINKED_PUSH_SESSION') {
      console.log('[ExternalMsg] CHAINLINKED_PUSH_SESSION received from platform');
      (async () => {
        try {
          const sessionData = (message as unknown as { session?: { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; token_type?: string; user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> } } }).session;
          if (!sessionData?.access_token || !sessionData?.user?.email) {
            sendResponse({ success: false, error: 'Invalid session data' });
            return;
          }

          // Check if extension already has a session with a different email
          const existingSession = await self.supabaseAuth?.getSession?.();
          const existingEmail = existingSession?.session?.user?.email || existingSession?.user?.email;
          if (existingEmail && existingEmail !== sessionData.user.email) {
            console.log(`[ExternalMsg] Push rejected: extension=${existingEmail}, platform=${sessionData.user.email}`);
            sendResponse({ success: false, error: 'different_user' });
            return;
          }

          // Save the session (reuse EXTENSION_AUTH_SESSION logic)
          await chrome.storage.local.set({
            supabase_session: {
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
              expires_in: sessionData.expires_in,
              expires_at: sessionData.expires_at,
              token_type: sessionData.token_type,
              user: sessionData.user,
            },
          });

          // Update the Supabase client auth state
          const supabaseClient = (self as unknown as { supabase?: { setAuth: (token: string, userId: string) => void } }).supabase;
          if (supabaseClient) {
            supabaseClient.setAuth(sessionData.access_token, sessionData.user?.id || '');
          }

          // Update the auth module state
          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            session: unknown;
            currentUser: { id: string; email: string } | null;
            notifyListeners: (event: string, user: unknown) => void;
            ensureUserRecord: (user: unknown) => Promise<void>;
          } }).supabaseAuth;

          if (supabaseAuth) {
            supabaseAuth.session = sessionData;
            supabaseAuth.currentUser = {
              id: sessionData.user?.id || '',
              email: sessionData.user?.email || '',
            };
            supabaseAuth.notifyListeners('SIGNED_IN', supabaseAuth.currentUser);
            await supabaseAuth.ensureUserRecord(sessionData.user);
          }

          setCurrentUserId(sessionData.user?.id || '');

          // Mark extension as logged in on the user's profile
          if (sessionData.user?.id) {
            try {
              const sbClient = (self as unknown as { supabase?: { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } } }).supabase;
              if (sbClient) {
                await sbClient.from('profiles').update({ extension_logged_in: true, extension_last_active_at: new Date().toISOString() }).eq('id', sessionData.user.id);
              }
            } catch (e) {
              console.warn('[ExternalMsg] Failed to update extension_logged_in:', e);
            }
          }

          console.log('[ExternalMsg] Push session saved for:', sessionData.user?.email);
          sendResponse({ success: true });
        } catch (error) {
          console.error('[ExternalMsg] CHAINLINKED_PUSH_SESSION error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      })();
    } else if (message?.type === 'LINKEDIN_MENTION_SEARCH' && message.query) {
      console.log(`[ExternalMsg] Mention search request: "${message.query}"`);
      // Search LinkedIn users via Voyager API — cookies never leave the extension
      handleMentionSearch(message.query).then((result) => {
        console.log(`[ExternalMsg] Mention search response: success=${result.success}, results=${result.results.length}`);
        sendResponse(result);
      }).catch((err) => {
        console.error('[ExternalMsg] Mention search error:', err);
        sendResponse({ success: false, error: 'Search failed', results: [] });
      });
    }
    return true
  }
)

// MESSAGE HANDLING
// ============================================

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  // Smart logging: highlight captures, quiet repeated auth/cookie checks
  if (message.type.startsWith('AUTO_CAPTURE_')) {
    console.log(
      `%c[Capture] \u{1F4E5} Received: ${message.type.replace('AUTO_CAPTURE_', '')}`,
      'color: #16a34a; font-weight: bold; font-size: 12px'
    );
  } else if (message.type === 'SUPABASE_AUTH_STATUS' || message.type === 'GET_COOKIES') {
    // Suppress repeated auth polling - only log once per 30s
    const now = Date.now();
    const key = `_lastLog_${message.type}`;
    const last = (globalThis as Record<string, number>)[key] || 0;
    if (now - last > 30000) {
      console.log(`[ServiceWorker] ${message.type} (repeated calls suppressed for 30s)`);
      (globalThis as Record<string, number>)[key] = now;
    }
  } else {
    console.log('[ServiceWorker] Received message:', message.type);
  }

  (async () => {
    let response: StorageResult;

    switch (message.type) {
      case 'GET_COOKIES':
        response = await getLinkedInCookies();
        break;

      case 'CHAINLINKED_PING': {
        // Internal PING from webapp-relay content script
        console.log('[ServiceWorker] Internal CHAINLINKED_PING received');
        try {
          const [liAtCookie, sessionResult] = await Promise.all([
            chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'li_at' }),
            self.supabaseAuth?.getSession?.(),
          ]);
          const linkedInLoggedIn = !!liAtCookie?.value;
          const platformLoggedIn = !!(sessionResult?.session?.user || sessionResult?.user);
          const email = sessionResult?.session?.user?.email || sessionResult?.user?.email || null;
          response = {
            success: true,
            data: {
              installed: true,
              version: chrome.runtime.getManifest().version,
              linkedInLoggedIn,
              platformLoggedIn,
              email,
            },
          };
        } catch (err) {
          console.error('[ServiceWorker] Internal PING error:', err);
          response = {
            success: true,
            data: {
              installed: true,
              version: chrome.runtime.getManifest().version,
              linkedInLoggedIn: false,
              platformLoggedIn: false,
              email: null,
            },
          };
        }
        break;
      }

      case 'LINKEDIN_MENTION_SEARCH': {
        // Internal message from webapp-bridge content script
        const query = (message as unknown as { query?: string }).query;
        console.log(`[ServiceWorker] Internal mention search: "${query}"`);
        if (query) {
          const searchResult = await handleMentionSearch(query);
          response = { success: searchResult.success, data: searchResult };
        } else {
          response = { success: false, error: 'No query provided' };
        }
        break;
      }

      case 'CHECK_AUTH':
        response = { success: true, data: await checkAuthentication() };
        break;

      case 'SAVE_DATA':
        response = await saveToStorage(message.key!, message.data);
        break;

      case 'GET_DATA':
        response = await getFromStorage(message.key!);
        break;

      case 'GET_ALL_DATA':
        response = await getAllStoredData();
        break;

      case 'CLEAR_DATA':
        response = await clearStorage();
        break;

      case 'API_CAPTURED': {
        const apiData = message as unknown as {
          endpoint: string;
          method: string;
          url: string;
          data: unknown;
          category?: string;
        };
        const category = apiData.category || 'other';
        const storageKey = `${STORAGE_KEYS.CAPTURED_APIS}_${category}`;

        console.log(`[CL:WORKER] <<< RECEIVED API_CAPTURED: category=${category} endpoint=${apiData.endpoint?.substring(0, 50)} storageKey=${storageKey}`);

        try {
          // Build individual captured API record
          const capturedItem = {
            endpoint: apiData.endpoint,
            method: apiData.method,
            url: apiData.url,
            data: apiData.data,
            category,
            capturedAt: new Date().toISOString(),
          };

          // Get existing captured data for this category
          const existing = await getFromStorage(storageKey);
          const items: unknown[] = Array.isArray(existing?.data) ? existing.data as unknown[] : [];
          items.push(capturedItem);

          // Keep last 50 items per category to prevent storage bloat
          const trimmed = items.slice(-50);
          // Save array to chrome.storage locally (skip sync — array would be mangled)
          await chrome.storage.local.set({ [storageKey]: trimmed });
          // Queue a lightweight version for Supabase sync (strip the massive response blob)
          const capturedUserId = await ensureUserId();
          if (isSyncableKey(storageKey) && capturedUserId) {
            const syncItem = {
              endpoint: apiData.endpoint,
              method: apiData.method,
              category,
              capturedAt: capturedItem.capturedAt,
              // Store only a hash/size instead of the full response to avoid quota issues
              response_hash: `size:${JSON.stringify(apiData.data).length}`,
            };
            await queueForSync(storageKey, syncItem as unknown as Record<string, unknown>);
            // Trigger sync for captured_apis with retry for race condition
            const triggerCapturedSync = async (attempt = 1) => {
              try {
                const result = await processPendingChanges();
                if (result.errors?.includes('Sync already in progress') && attempt < 3) {
                  setTimeout(() => triggerCapturedSync(attempt + 1), 2000 * attempt);
                }
              } catch (err) {
                console.error('[CL:WORKER] Captured API sync error:', err);
              }
            };
            setTimeout(() => triggerCapturedSync(), 200);
          } else {
            console.log(`[CL:WORKER] --- SKIPPED captured_apis sync: syncable=${isSyncableKey(storageKey)} userId=${capturedUserId ? 'yes' : 'null'}`);
          }

          // Also save to category-specific storage keys that are syncable to Supabase
          if (category === 'posts' || category === 'myPosts') {
            const postsKey = category === 'myPosts' ? STORAGE_KEYS.MY_POSTS : STORAGE_KEYS.POSTS_DATA;
            const existingPosts = await getFromStorage(postsKey);
            const postItems: ExtractedPost[] = Array.isArray(existingPosts?.data) ? existingPosts.data as ExtractedPost[] : [];
            // Extract individual posts from the API response
            const extracted = extractPostsFromResponse(apiData.data);
            if (extracted.length > 0) {
              const newPosts: ExtractedPost[] = [];
              // Deduplicate by activity_urn — but allow updating stale cached posts
              for (const post of extracted) {
                const existingIdx = postItems.findIndex(p => p.activity_urn === post.activity_urn);
                if (existingIdx === -1) {
                  // Truly new post
                  postItems.push(post);
                  newPosts.push(post);
                } else {
                  // Post exists — check if new extraction has better data
                  const existing = postItems[existingIdx];
                  const needsUpdate = (
                    (!existing.posted_at && post.posted_at) ||
                    (existing.reactions === 0 && post.reactions > 0) ||
                    (existing.comments === 0 && post.comments > 0) ||
                    (!existing.content && post.content)
                  );
                  if (needsUpdate) {
                    console.log(`[CL:WORKER] Updating stale post ${post.activity_urn.substring(0, 50)}: posted_at=${existing.posted_at}->${post.posted_at} reactions=${existing.reactions}->${post.reactions}`);
                    postItems[existingIdx] = post;
                    newPosts.push(post); // Queue updated post for sync
                  }
                }
              }
              // Save full array to chrome.storage (skip sync — we queue individual posts below)
              await chrome.storage.local.set({ [postsKey]: postItems.slice(-100) });
              // Queue individual posts for Supabase sync (strip raw_data to save quota)
              const postsUserId = await ensureUserId();
              if (postsUserId) {
                // If we have new posts (or updated posts), queue them
                const postsToSync = newPosts.length > 0 ? newPosts : (
                  // Bootstrap sync: if new=0 (all duplicates, no updates), queue ALL existing posts
                  // This handles the case where posts were captured locally but never synced
                  postItems
                );
                if (newPosts.length === 0 && postItems.length > 0) {
                  console.log(`[CL:WORKER] Bootstrap sync: queueing all ${postItems.length} existing posts (new=0, likely never synced)`);
                }
                for (const post of postsToSync) {
                  const { raw_data: _raw, ...syncPost } = post;
                  await queueForSync(postsKey, syncPost as unknown as Record<string, unknown>);
                }
                // Trigger sync with retry for race condition
                const triggerSync = async (attempt = 1) => {
                  try {
                    const syncResult = await processPendingChanges();
                    console.log(`[CL:WORKER] Post sync (attempt ${attempt}): ${syncResult.success} success, ${syncResult.failed} failed`);
                    if (syncResult.errors?.includes('Sync already in progress') && attempt < 3) {
                      setTimeout(() => triggerSync(attempt + 1), 2000 * attempt);
                    }
                  } catch (err) {
                    console.error('[CL:WORKER] Post sync error:', err);
                  }
                };
                setTimeout(() => triggerSync(), 500);
                console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${postsKey} extracted=${extracted.length} new=${newPosts.length} total=${Math.min(postItems.length, 100)} table=my_posts`);
              } else {
                console.log(`[CL:WORKER] --- SKIPPED myPosts sync: no userId. Posts saved locally only. extracted=${extracted.length}`);
              }
            } else {
              // Diagnostic: log sample of the raw data structure to understand why extraction failed
              const rawSample = JSON.stringify(apiData.data, null, 2).substring(0, 500);
              console.log(`[CL:WORKER] --- NO POSTS EXTRACTED from myPosts response. Raw sample: ${rawSample}`);
            }
          } else if (category === 'feed') {
            const existingFeed = await getFromStorage(STORAGE_KEYS.FEED_POSTS);
            const feedItems: ExtractedPost[] = Array.isArray(existingFeed?.data) ? existingFeed.data as ExtractedPost[] : [];
            // Extract individual posts from the feed response
            const extracted = extractPostsFromResponse(apiData.data);
            if (extracted.length > 0) {
              const newFeedPosts: ExtractedPost[] = [];
              for (const post of extracted) {
                const existingIdx = feedItems.findIndex(p => p.activity_urn === post.activity_urn);
                if (existingIdx === -1) {
                  feedItems.push(post);
                  newFeedPosts.push(post);
                } else {
                  // Allow updating stale feed posts with better data
                  const existing = feedItems[existingIdx];
                  const needsUpdate = (
                    (!existing.posted_at && post.posted_at) ||
                    (existing.reactions === 0 && post.reactions > 0) ||
                    (existing.comments === 0 && post.comments > 0)
                  );
                  if (needsUpdate) {
                    feedItems[existingIdx] = post;
                    newFeedPosts.push(post);
                  }
                }
              }
              // Save full array to chrome.storage (skip sync — we queue individual posts below)
              await chrome.storage.local.set({ [STORAGE_KEYS.FEED_POSTS]: feedItems.slice(-100) });
              // Queue each individual post for Supabase sync (strip raw_data to save quota)
              const feedUserId = await ensureUserId();
              if (feedUserId) {
                for (const post of newFeedPosts) {
                  const { raw_data: _raw, ...syncPost } = post;
                  await queueForSync(STORAGE_KEYS.FEED_POSTS, syncPost as unknown as Record<string, unknown>);
                }
                // Always trigger sync with retry for race condition
                const triggerFeedSync = async (attempt = 1) => {
                  try {
                    const syncResult = await processPendingChanges();
                    console.log(`[CL:WORKER] Feed sync (attempt ${attempt}): ${syncResult.success} success, ${syncResult.failed} failed`);
                    if (syncResult.errors?.includes('Sync already in progress') && attempt < 3) {
                      setTimeout(() => triggerFeedSync(attempt + 1), 2000 * attempt);
                    }
                  } catch (err) {
                    console.error('[CL:WORKER] Feed sync error:', err);
                  }
                };
                setTimeout(() => triggerFeedSync(), 100);
                console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.FEED_POSTS} extracted=${extracted.length} new=${newFeedPosts.length} total=${Math.min(feedItems.length, 100)} table=feed_posts`);
              } else {
                console.log(`[CL:WORKER] --- SKIPPED feed sync: no userId. Posts saved locally only. extracted=${extracted.length}`);
              }
            } else {
              console.log(`[CL:WORKER] --- NO POSTS EXTRACTED from feed response (raw data stored in captured_apis)`);
            }
          } else if (category === 'connections') {
            await saveToStorage(STORAGE_KEYS.CONNECTIONS_DATA, apiData.data);
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.CONNECTIONS_DATA} table=connections`);
          } else if (category === 'comments') {
            const existingComments = await getFromStorage(STORAGE_KEYS.COMMENTS);
            const commentItems: unknown[] = Array.isArray(existingComments?.data) ? existingComments.data as unknown[] : [];
            commentItems.push(apiData.data);
            await saveToStorage(STORAGE_KEYS.COMMENTS, commentItems.slice(-100));
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.COMMENTS} items=${Math.min(commentItems.length, 100)} table=comments`);
          } else if (category === 'followers') {
            await saveToStorage(STORAGE_KEYS.FOLLOWERS, apiData.data);
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.FOLLOWERS} table=followers`);
          } else if (category === 'reactions') {
            const existingReactions = await getFromStorage(`${STORAGE_KEYS.CAPTURED_APIS}_reactions`);
            const reactionItems: unknown[] = Array.isArray(existingReactions?.data) ? existingReactions.data as unknown[] : [];
            reactionItems.push(apiData.data);
            await saveToStorage(`${STORAGE_KEYS.CAPTURED_APIS}_reactions`, reactionItems.slice(-100));
            console.log(`[CL:WORKER] >>> STORED: key=captured_apis_reactions items=${Math.min(reactionItems.length, 100)}`);
          } else if (category === 'profile') {
            await saveToStorage(STORAGE_KEYS.PROFILE_DATA, {
              ...(apiData.data as Record<string, unknown>),
              source: 'api_intercept',
              capturedAt: new Date().toISOString(),
              raw_data: apiData.data,
            });
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.PROFILE_DATA} table=linkedin_profiles`);
          } else if (category === 'analytics') {
            await saveToStorage(STORAGE_KEYS.ANALYTICS_DATA, {
              ...(apiData.data as Record<string, unknown>),
              source: 'api_intercept',
              page_type: 'api_captured',
              capturedAt: new Date().toISOString(),
              raw_data: apiData.data,
            });
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.ANALYTICS_DATA} table=linkedin_analytics`);
          } else if (category === 'network') {
            await saveToStorage(STORAGE_KEYS.CONNECTIONS_DATA, {
              ...(apiData.data as Record<string, unknown>),
              source: 'api_intercept',
              capturedAt: new Date().toISOString(),
            });
            console.log(`[CL:WORKER] >>> STORED SYNCABLE: key=${STORAGE_KEYS.CONNECTIONS_DATA} table=connections (via network)`);
          } else {
            console.log(`[CL:WORKER] --- NO SYNCABLE ROUTE for category=${category} (only stored in generic captured_apis)`);
          }

          console.log(`[CL:WORKER] >>> STORED: category=${category} endpoint=${apiData.endpoint?.substring(0, 50)} generic_items=${trimmed.length}`);
          response = { success: true, data: { count: trimmed.length } };
        } catch (error) {
          console.error('[ServiceWorker] Error saving API data:', error);
          response = { success: false, error: String(error) };
        }
        break;
      }

      case 'AUTO_CAPTURE_CREATOR_ANALYTICS': {
        console.log('[CAPTURE][ANALYTICS] Received data:', JSON.stringify(message.data, null, 2));
        const analyticsData = message.data as Partial<CreatorAnalytics> & {
          searchAppearances?: number;
          search_appearances?: number;
          engagementRate?: number;
          engagement_rate?: number;
        };

        // Calculate engagements if not present (sum of reactions, comments, reposts from top posts)
        let engagements = (analyticsData as { engagements?: number }).engagements || 0;
        if (!engagements && analyticsData.topPosts) {
          engagements = analyticsData.topPosts.reduce((sum, post) => {
            const postEngagements = (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0);
            return sum + postEngagements;
          }, 0);
        }

        // Map fields to ensure consistency (camelCase -> snake_case for storage)
        const dataToSave = {
          // Original data
          ...analyticsData,
          // Ensure all required fields are present with proper naming
          impressions: analyticsData.impressions || 0,
          engagements: engagements,
          members_reached: analyticsData.membersReached || (analyticsData as { members_reached?: number }).members_reached || 0,
          profile_views: (analyticsData as { profileViews?: number }).profileViews || (analyticsData as { profile_views?: number }).profile_views || 0,
          search_appearances: analyticsData.searchAppearances || analyticsData.search_appearances || 0,
          new_followers: analyticsData.newFollowers || (analyticsData as { new_followers?: number }).new_followers || 0,
          engagement_rate: analyticsData.engagementRate || analyticsData.engagement_rate ||
            (analyticsData.impressions && analyticsData.impressions > 0
              ? ((engagements / analyticsData.impressions) * 100).toFixed(2)
              : 0),
          // Metadata
          page_type: 'creator_analytics',
          source: 'auto_capture',
          captured_at: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          raw_data: analyticsData,
        };

        console.log('[CAPTURE][ANALYTICS] Saving to storage:', JSON.stringify({
          impressions: dataToSave.impressions,
          engagements: dataToSave.engagements,
          members_reached: dataToSave.members_reached,
          profile_views: dataToSave.profile_views,
          search_appearances: dataToSave.search_appearances,
          new_followers: dataToSave.new_followers,
          engagement_rate: dataToSave.engagement_rate,
        }, null, 2));

        response = await saveToStorage(STORAGE_KEYS.ANALYTICS_DATA, dataToSave);
        await addToAnalyticsHistory(analyticsData);
        await updateCaptureStats('creator_analytics', true);

        // Record to IndexedDB for trend tracking
        try {
          await recordAnalyticsTrends(analyticsData as CreatorAnalytics);
          await logCapture('creator_analytics', JSON.stringify(analyticsData).length, true);
        } catch (error) {
          console.error('[ERROR][ANALYTICS] Error recording analytics trends:', error);
        }

        // Show capture notification
        const impressions = analyticsData.impressions?.toLocaleString() || '';
        await showCaptureNotification('creator_analytics', impressions ? `${impressions} impressions` : undefined);
        console.log('[CAPTURE][ANALYTICS] Save completed successfully');
        break;
      }

      case 'AUTO_CAPTURE_POST_ANALYTICS': {
        console.log('[CAPTURE][POST_ANALYTICS] Received data:', JSON.stringify(message.data, null, 2));
        const postData = message.data as PostAnalyticsData;

        console.log('[CAPTURE][POST_ANALYTICS] Saving post:', {
          activityUrn: postData.activityUrn,
          impressions: postData.impressions,
          reactions: postData.engagement?.reactions,
          comments: postData.engagement?.comments,
          reposts: postData.engagement?.reposts,
        });

        response = await savePostAnalyticsToStorage(postData);
        await handleCaptureResult('post_analytics', response, postData.impressions?.toLocaleString());
        console.log('[CAPTURE][POST_ANALYTICS] Save completed, success:', response.success);
        break;
      }

      case 'AUTO_CAPTURE_AUDIENCE': {
        console.log('[CAPTURE][AUDIENCE] Received data:', JSON.stringify(message.data, null, 2));
        const audienceData = message.data as Partial<AudienceAnalytics> & {
          total_followers?: number;
          follower_growth?: number;
          top_locations?: unknown;
          top_industries?: unknown;
          top_job_titles?: unknown;
          top_companies?: unknown;
        };

        // Map to snake_case for database consistency
        const dataToSave: Partial<AudienceAnalytics> = {
          ...audienceData,
          totalFollowers: audienceData.totalFollowers || audienceData.total_followers || 0,
          followerGrowth: audienceData.followerGrowth || audienceData.follower_growth || 0,
          newFollowers: audienceData.newFollowers || 0,
          // Keep original field names for demographics
          topLocations: audienceData.topLocations || audienceData.top_locations,
          topIndustries: audienceData.topIndustries || audienceData.top_industries,
          topJobTitles: audienceData.topJobTitles || audienceData.top_job_titles,
          topCompanies: audienceData.topCompanies || audienceData.top_companies,
        };

        console.log('[CAPTURE][AUDIENCE] Saving to storage:', JSON.stringify({
          totalFollowers: dataToSave.totalFollowers,
          followerGrowth: dataToSave.followerGrowth,
          newFollowers: dataToSave.newFollowers,
        }, null, 2));

        response = await saveAudienceDataToStorage(dataToSave);
        await addToAudienceHistory(dataToSave);

        // Record to IndexedDB for trend tracking (follower count)
        try {
          if (dataToSave.totalFollowers) {
            await recordProfileTrends({ followers_count: dataToSave.totalFollowers } as ProfileData);
          }
          await logCapture('audience_analytics', JSON.stringify(audienceData).length, response.success);
        } catch (error) {
          console.error('[ERROR][AUDIENCE] Error recording audience trends:', error);
        }

        // Show capture notification (success or failure)
        const followers = dataToSave.totalFollowers?.toLocaleString() || '';
        await handleCaptureResult('audience_analytics', response, followers ? `${followers} followers` : undefined);
        console.log('[CAPTURE][AUDIENCE] Save completed, success:', response.success);
        break;
      }

      case 'AUTO_CAPTURE_AUDIENCE_DEMOGRAPHICS': {
        console.log('[CAPTURE][AUDIENCE_DEMOGRAPHICS] Received data:', JSON.stringify(message.data, null, 2));
        const existingAudience = await getFromStorage<Partial<AudienceAnalytics>>(STORAGE_KEYS.AUDIENCE_DATA);
        const messageData = message.data as { demographics?: Record<string, unknown> } | Record<string, unknown>;
        const audienceWithDemographics = {
          ...(existingAudience.data || {}),
          demographics: ('demographics' in messageData ? messageData.demographics : messageData) as AudienceAnalytics['demographics'],
          demographicsUpdated: new Date().toISOString(),
        };

        console.log('[CAPTURE][AUDIENCE_DEMOGRAPHICS] Merging with existing data:', {
          hadExistingData: !!existingAudience.data,
          newDemographicsKeys: Object.keys((message.data as { demographics?: unknown })?.demographics || message.data || {}),
        });

        response = await saveAudienceDataToStorage(audienceWithDemographics);
        await handleCaptureResult('audience_demographics', response);
        console.log('[CAPTURE][AUDIENCE_DEMOGRAPHICS] Save completed, success:', response.success);
        break;
      }

      case 'AUTO_CAPTURE_POST_DEMOGRAPHICS': {
        console.log('[CAPTURE][POST_DEMOGRAPHICS] Received data:', JSON.stringify(message.data, null, 2));
        const pageInfo = (message.data as { pageInfo?: { identifier?: string } })?.pageInfo;
        if (pageInfo?.identifier) {
          const postUrn = `urn:li:activity:${pageInfo.identifier}`;
          console.log('[CAPTURE][POST_DEMOGRAPHICS] Looking for post:', postUrn);

          const existingPostAnalytics = await getFromStorage<{ posts: PostAnalyticsData[] }>(
            STORAGE_KEYS.POST_ANALYTICS_DATA
          );
          const posts = existingPostAnalytics.data?.posts || [];
          const postIndex = posts.findIndex((p) => p.activityUrn === postUrn);

          if (postIndex >= 0) {
            posts[postIndex].demographics = (message.data as { demographics?: unknown })?.demographics;
            posts[postIndex].demographicsUpdated = new Date().toISOString();

            console.log('[CAPTURE][POST_DEMOGRAPHICS] Updating post at index:', postIndex);

            await saveToStorage(STORAGE_KEYS.POST_ANALYTICS_DATA, {
              ...existingPostAnalytics.data,
              posts,
              lastUpdated: new Date().toISOString(),
            }, /* skipSync */ true);
          } else {
            console.log('[CAPTURE][POST_DEMOGRAPHICS] Post not found in storage');
          }
        } else {
          console.log('[CAPTURE][POST_DEMOGRAPHICS] No page identifier provided');
        }
        response = { success: true };
        await updateCaptureStats('post_demographics', true);
        console.log('[CAPTURE][POST_DEMOGRAPHICS] Save completed');
        break;
      }

      case 'AUTO_CAPTURE_PROFILE_VIEWS': {
        console.log('[CAPTURE][PROFILE_VIEWS] Received data:', JSON.stringify(message.data, null, 2));
        const existingAnalytics = await getFromStorage<Record<string, unknown>>(STORAGE_KEYS.ANALYTICS_DATA);
        const profileViewsData = message.data as {
          totalViews?: number;
          profileViews?: number;
          profile_views?: number;
          searchAppearances?: number;
          search_appearances?: number;
          viewers?: unknown[];
        };

        // Extract profile views from various possible field names
        const profileViews = profileViewsData?.totalViews ||
          profileViewsData?.profileViews ||
          profileViewsData?.profile_views ||
          (profileViewsData?.viewers?.length) ||
          0;

        // Extract search appearances from various possible field names
        const searchAppearances = profileViewsData?.searchAppearances ||
          profileViewsData?.search_appearances ||
          0;

        const dataToSave = {
          ...(existingAnalytics.data || {}),
          // Use snake_case for consistency with database schema
          profile_views: profileViews,
          search_appearances: searchAppearances,
          // Also keep camelCase for backward compatibility
          profileViews: profileViews,
          searchAppearances: searchAppearances,
          // Store raw data for debugging
          profileViewsData: message.data,
          profileViewsUpdated: new Date().toISOString(),
        };

        console.log('[CAPTURE][PROFILE_VIEWS] Saving to storage:', JSON.stringify({
          profile_views: dataToSave.profile_views,
          search_appearances: dataToSave.search_appearances,
        }, null, 2));

        response = await saveToStorage(STORAGE_KEYS.ANALYTICS_DATA, dataToSave);
        await handleCaptureResult('profile_views', response, dataToSave.profile_views?.toLocaleString());
        console.log('[CAPTURE][PROFILE_VIEWS] Save completed, success:', response.success);
        break;
      }

      case 'AUTO_CAPTURE_PROFILE': {
        console.log('[CAPTURE][PROFILE] Received data:', JSON.stringify(message.data, null, 2));
        const profileData = message.data as ProfileData & {
          connectionCount?: number;
          followerCount?: number;
          followersCount?: number;
          connectionsCount?: number;
        };

        // Map various field naming conventions to snake_case for database consistency
        const followersCount = profileData.followers_count ||
          profileData.followerCount ||
          profileData.followersCount ||
          0;

        const connectionsCount = profileData.connections_count ||
          profileData.connectionCount ||
          profileData.connectionsCount ||
          0;

        // Split full name into first/last if not already provided
        let firstName = profileData.first_name || (profileData as { firstName?: string }).firstName || '';
        let lastName = profileData.last_name || (profileData as { lastName?: string }).lastName || '';
        if (!firstName && !lastName && profileData.name) {
          const nameParts = profileData.name.trim().split(/\s+/);
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }

        const dataToSave = {
          ...profileData,
          // Ensure snake_case fields are present (database schema uses snake_case)
          followers_count: followersCount,
          connections_count: connectionsCount,
          // Also include camelCase for backward compatibility
          followerCount: followersCount,
          connectionCount: connectionsCount,
          // Map other profile fields
          linkedin_id: profileData.linkedin_id || (profileData as { linkedinId?: string }).linkedinId,
          first_name: firstName,
          last_name: lastName,
          full_name: profileData.full_name || (profileData as { fullName?: string }).fullName || profileData.name,
          profile_url: profileData.profile_url || (profileData as { profileUrl?: string }).profileUrl,
          profile_picture_url: profileData.profile_picture_url || (profileData as { profilePictureUrl?: string }).profilePictureUrl || profileData.profilePhoto,
          // Metadata
          source: 'auto_capture',
          captured_at: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        console.log('[CAPTURE][PROFILE] Saving to storage:', JSON.stringify({
          name: dataToSave.full_name || dataToSave.name,
          followers_count: dataToSave.followers_count,
          connections_count: dataToSave.connections_count,
          headline: dataToSave.headline,
        }, null, 2));

        response = await saveToStorage(STORAGE_KEYS.PROFILE_DATA, dataToSave);
        await updateCaptureStats('profile', true);

        // Record profile trends to IndexedDB for trend tracking
        try {
          await recordProfileTrends(dataToSave as ProfileData);
          await logCapture('profile', JSON.stringify(profileData).length, true);
        } catch (error) {
          console.error('[ERROR][PROFILE] Error recording profile trends:', error);
        }

        // Show capture notification
        const followers = followersCount?.toLocaleString() || '';
        await showCaptureNotification('profile', followers ? `${followers} followers` : undefined);
        console.log('[CAPTURE][PROFILE] Save completed successfully');
        break;
      }

      // ==========================================
      // Company Analytics (v4.0 Phase 5)
      // ==========================================

      case 'AUTO_CAPTURE_COMPANY_ANALYTICS': {
        console.log('[CAPTURE][COMPANY_ANALYTICS] Received data:', JSON.stringify(message.data, null, 2));
        const companyData = message.data as CompanyAnalytics;

        // Get existing company data
        const existingCompanies = await getFromStorage<Record<string, CompanyAnalytics>>(
          STORAGE_KEYS.COMPANY_ANALYTICS
        );
        const companies = existingCompanies.data || {};

        // Store by company ID
        if (companyData.companyId) {
          companies[companyData.companyId] = {
            ...companyData,
            capturedAt: Date.now(),
          };
          console.log('[CAPTURE][COMPANY_ANALYTICS] Saving company:', {
            companyId: companyData.companyId,
            companyName: companyData.companyName,
            followers: companyData.followers,
          });
        } else {
          console.log('[CAPTURE][COMPANY_ANALYTICS] No company ID provided');
        }

        response = await saveToStorage(STORAGE_KEYS.COMPANY_ANALYTICS, companies);
        await updateCaptureStats('company_analytics', response.success);

        // Log capture
        try {
          await logCapture('company_analytics', JSON.stringify(companyData).length, response.success);
        } catch (error) {
          console.error('[ERROR][COMPANY_ANALYTICS] Error logging company capture:', error);
        }

        // Show capture notification
        const followers = companyData.followers?.toLocaleString() || '';
        await showCaptureNotification('company_analytics', followers ? `${followers} followers` : companyData.companyName);
        console.log('[CAPTURE][COMPANY_ANALYTICS] Save completed, success:', response.success);
        break;
      }

      case 'AUTO_CAPTURE_CONTENT_CALENDAR': {
        console.log('[CAPTURE][CONTENT_CALENDAR] Received data:', JSON.stringify(message.data, null, 2));
        const calendarData = message.data as ContentCalendarData & { companyId?: string };

        // Get existing calendar data
        const existingCalendars = await getFromStorage<Record<string, ContentCalendarData>>(
          STORAGE_KEYS.CONTENT_CALENDAR
        );
        const calendars = existingCalendars.data || {};

        // Store by company ID or 'personal'
        const calendarKey = calendarData.companyId || 'personal';
        calendars[calendarKey] = {
          ...calendarData,
          capturedAt: Date.now(),
        };

        console.log('[CAPTURE][CONTENT_CALENDAR] Saving calendar:', {
          calendarKey,
          itemCount: calendarData.items?.length || 0,
        });

        response = await saveToStorage(STORAGE_KEYS.CONTENT_CALENDAR, calendars);
        await updateCaptureStats('content_calendar', response.success);

        // Log capture
        try {
          await logCapture('content_calendar', JSON.stringify(calendarData).length, response.success);
        } catch (error) {
          console.error('[ERROR][CONTENT_CALENDAR] Error logging calendar capture:', error);
        }

        // Show capture notification
        const postCount = calendarData.items?.length || 0;
        await showCaptureNotification('content_calendar', `${postCount} posts`);
        console.log('[CAPTURE][CONTENT_CALENDAR] Save completed, success:', response.success);
        break;
      }

      case 'GET_COMPANY_ANALYTICS': {
        console.log('[ServiceWorker] GET_COMPANY_ANALYTICS received');
        const companyId = (message.data as { companyId?: string })?.companyId;
        try {
          const companies = await getFromStorage<Record<string, CompanyAnalytics>>(
            STORAGE_KEYS.COMPANY_ANALYTICS
          );
          if (companyId && companies.data) {
            response = { success: true, data: companies.data[companyId] || null };
          } else {
            response = { success: true, data: companies.data || {} };
          }
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_CONTENT_CALENDAR': {
        console.log('[ServiceWorker] GET_CONTENT_CALENDAR received');
        const calendarKey = (message.data as { companyId?: string })?.companyId || 'personal';
        try {
          const calendars = await getFromStorage<Record<string, ContentCalendarData>>(
            STORAGE_KEYS.CONTENT_CALENDAR
          );
          if (calendars.data && calendars.data[calendarKey]) {
            response = { success: true, data: calendars.data[calendarKey] };
          } else {
            response = { success: true, data: null };
          }
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'AUTO_CAPTURE_LOG': {
        const logData = message.data as { pageType?: string; url?: string; success?: boolean };
        console.log('[CAPTURE][LOG] Recording capture event:', JSON.stringify({
          pageType: logData.pageType,
          url: logData.url,
          success: logData.success,
        }, null, 2));

        const captureLog = await getFromStorage<unknown[]>(STORAGE_KEYS.AUTO_CAPTURE_LOG);
        const logs = captureLog.data || [];
        logs.push({
          ...(message.data as Record<string, unknown>),
          loggedAt: new Date().toISOString(),
        });
        response = await saveToStorage(STORAGE_KEYS.AUTO_CAPTURE_LOG, logs.slice(-100));
        console.log('[CAPTURE][LOG] Logged, total entries:', Math.min(logs.length, 100));
        break;
      }

      case 'SHOW_CAPTURE_FAILURE_NOTIFICATION': {
        const failureData = message.data as {
          captureType?: string;
          error?: string;
          retryCount?: number;
        };
        if (failureData.captureType && failureData.error) {
          await showCaptureFailureNotification(
            failureData.captureType,
            failureData.error,
            failureData.retryCount
          );
          response = { success: true };
        } else {
          response = { success: false, error: 'Missing captureType or error' };
        }
        break;
      }

      case 'GET_ANALYTICS_GROWTH':
        response = await getAnalyticsGrowth();
        break;

      case 'GET_AUDIENCE_GROWTH':
        response = await getAudienceGrowth();
        break;

      case 'GET_CAPTURE_STATS':
        response = await getFromStorage(STORAGE_KEYS.CAPTURE_STATS);
        break;

      case 'EXPORT_JSON':
        response = await exportAsJSON();
        break;

      case 'EXPORT_CSV':
        response = await exportAsCSV(message.key!);
        break;

      // ==========================================
      // IndexedDB / Trend Data Operations
      // ==========================================

      case 'GET_TREND_DATA': {
        console.log('[ServiceWorker] GET_TREND_DATA received');
        const days = (message.data as { days?: number })?.days || 30;
        try {
          const trendData = await getTrendDataForCharts(days);
          response = { success: true, data: trendData };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_TREND_SUMMARY': {
        console.log('[ServiceWorker] GET_TREND_SUMMARY received');
        const summaryDays = (message.data as { days?: number })?.days || 7;
        try {
          const summary = await getTrendSummary(summaryDays);
          response = { success: true, data: summary };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'EXPORT_TRENDS_CSV': {
        console.log('[ServiceWorker] EXPORT_TRENDS_CSV received');
        const csvDays = (message.data as { days?: number })?.days || 90;
        try {
          const csv = await exportTrendsAsCSV(csvDays);
          response = {
            success: true,
            data: {
              content: csv,
              filename: `linkedin-trends-${Date.now()}.csv`,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'EXPORT_TRENDS_JSON': {
        console.log('[ServiceWorker] EXPORT_TRENDS_JSON received');
        const jsonDays = (message.data as { days?: number })?.days || 90;
        try {
          const json = await exportTrendsAsJSON(jsonDays);
          response = {
            success: true,
            data: {
              content: json,
              filename: `linkedin-trends-${Date.now()}.json`,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'EXPORT_CAPTURE_LOGS': {
        console.log('[ServiceWorker] EXPORT_CAPTURE_LOGS received');
        const limit = (message.data as { limit?: number })?.limit || 100;
        try {
          const logsCSV = await exportCaptureLogsAsCSV(limit);
          response = {
            success: true,
            data: {
              content: logsCSV,
              filename: `linkedin-capture-logs-${Date.now()}.csv`,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'EXPORT_FULL_BACKUP': {
        console.log('[ServiceWorker] EXPORT_FULL_BACKUP received');
        try {
          const backup = await exportFullBackup();
          response = {
            success: true,
            data: {
              content: backup,
              filename: `linkedin-full-backup-${Date.now()}.json`,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_STORAGE_STATS': {
        console.log('[ServiceWorker] GET_STORAGE_STATS received');
        try {
          const stats = await getStorageStats();
          response = { success: true, data: stats };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'RUN_MAINTENANCE': {
        console.log('[ServiceWorker] RUN_MAINTENANCE received');
        try {
          await runMaintenance();
          response = { success: true, data: { message: 'Maintenance completed' } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      // ==========================================
      // Alarms & Notifications Operations
      // ==========================================

      case 'GET_BACKUP_SCHEDULE': {
        console.log('[ServiceWorker] GET_BACKUP_SCHEDULE received');
        try {
          const schedule = await getBackupSchedule();
          response = { success: true, data: schedule };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'UPDATE_BACKUP_SCHEDULE': {
        console.log('[ServiceWorker] UPDATE_BACKUP_SCHEDULE received');
        try {
          const newSchedule = message.data as import('../shared/types').BackupSchedule;
          await updateBackupSchedule(newSchedule);
          response = { success: true, data: { message: 'Backup schedule updated' } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_ALERT_CONFIGS': {
        console.log('[ServiceWorker] GET_ALERT_CONFIGS received');
        try {
          const configs = await getAlertConfigs();
          response = { success: true, data: configs };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SAVE_ALERT_CONFIG': {
        console.log('[ServiceWorker] SAVE_ALERT_CONFIG received');
        try {
          const config = message.data as import('../shared/types').AlertConfig;
          await upsertAlertConfig(config);
          response = { success: true, data: { message: 'Alert config saved' } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DELETE_ALERT_CONFIG': {
        console.log('[ServiceWorker] DELETE_ALERT_CONFIG received');
        try {
          const alertId = (message.data as { id: string }).id;
          await deleteAlertConfig(alertId);
          response = { success: true, data: { message: 'Alert config deleted' } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_NOTIFICATION_SETTINGS': {
        console.log('[ServiceWorker] GET_NOTIFICATION_SETTINGS received');
        try {
          const settings = await getNotificationSettings();
          response = { success: true, data: settings };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SAVE_NOTIFICATION_SETTINGS': {
        console.log('[ServiceWorker] SAVE_NOTIFICATION_SETTINGS received');
        try {
          const settings = message.data as NotificationSettings;
          await saveNotificationSettings(settings);
          response = { success: true, data: { message: 'Notification settings saved' } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GET_ALL_ALARMS': {
        console.log('[ServiceWorker] GET_ALL_ALARMS received');
        try {
          const alarms = await getAllAlarms();
          response = { success: true, data: alarms };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'TRIGGER_MANUAL_BACKUP': {
        console.log('[ServiceWorker] TRIGGER_MANUAL_BACKUP received');
        try {
          const backup = await exportFullBackup();
          const size = new Blob([backup]).size;

          const backupId = `backup-${Date.now()}`;
          await saveToStorage(`backup_${backupId}`, {
            id: backupId,
            timestamp: Date.now(),
            size,
            type: 'manual',
            data: backup,
          });

          await showBackupSuccessNotification('manual', size);
          response = {
            success: true,
            data: { backupId, size, content: backup },
          };
        } catch (error) {
          await showBackupFailureNotification(error instanceof Error ? error.message : 'Unknown error');
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      // ==========================================
      // Supabase Sync (v4.1)
      // ==========================================

      case 'SUPABASE_AUTH_STATUS': {
        console.log('[ServiceWorker] SUPABASE_AUTH_STATUS received');
        try {
          // First check storage for session (in case service worker restarted)
          const sessionResult = await chrome.storage.local.get('supabase_session');
          const session = sessionResult.supabase_session;

          // If session exists in storage but currentUserId is not set, restore it
          let syncStatus = await getSyncStatusInfo();
          if (!syncStatus.isAuthenticated && session?.user?.id) {
            console.log('[ServiceWorker] Restoring session from storage for user:', session.user.id.substring(0, 8) + '...');
            // Restore the currentUserId in sync bridge
            setCurrentUserId(session.user.id);

            // Try auth module first (handles token refresh)
            let tokenSet = false;
            const supabaseAuth = (self as unknown as { supabaseAuth?: {
              getSession: () => Promise<{ session?: { user?: { id: string }; access_token?: string }; user?: { id: string } }>;
            } }).supabaseAuth;
            if (supabaseAuth) {
              try {
                const { session: refreshedSession } = await supabaseAuth.getSession();
                if (refreshedSession?.access_token) {
                  tokenSet = true;
                  console.log('[ServiceWorker] Session refreshed via auth module');
                }
              } catch (refreshErr) {
                console.warn('[ServiceWorker] Auth module refresh failed:', refreshErr);
              }
            }

            // Fallback: only set token if not expired
            if (!tokenSet) {
              const isExpired = session.expires_at && (Date.now() / 1000) > session.expires_at;
              const supabaseClient = (self as unknown as { supabase?: { setAuth: (token: string, userId?: string) => void } }).supabase;
              if (!isExpired && supabaseClient && session.access_token) {
                supabaseClient.setAuth(session.access_token, session.user.id);
              } else if (isExpired) {
                console.warn('[ServiceWorker] Stored JWT expired — user needs to re-authenticate');
              }
            }

            // Re-fetch sync status after restoration
            syncStatus = await getSyncStatusInfo();
          }

          response = {
            success: true,
            data: {
              isConfigured: true,
              isAuthenticated: syncStatus.isAuthenticated || !!session?.user?.id,
              userId: syncStatus.userId || session?.user?.id || null,
              email: session?.user?.email || null,  // Add email directly for popup
              user: session?.user || null,
              pendingCount: syncStatus.pendingCount,
              lastSyncTime: syncStatus.lastSyncTime,
              isSyncing: syncStatus.isSyncing,
            },
          };
          const responseData = response.data as { isAuthenticated?: boolean; email?: string };
          console.log('[ServiceWorker] Auth status response:', {
            isAuthenticated: responseData.isAuthenticated,
            hasEmail: !!responseData.email
          });
        } catch (error) {
          console.error('[ServiceWorker] Auth status error:', error);
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_AUTH_SIGN_IN': {
        console.log('[ServiceWorker] SUPABASE_AUTH_SIGN_IN received');
        try {
          const { email, password } = message.data as { email: string; password: string };

          // Use the supabase auth module from lib/supabase/auth.js
          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            signIn: (email: string, password: string) => Promise<{ success: boolean; user?: { id: string }; error?: string }>;
          } }).supabaseAuth;

          if (!supabaseAuth) {
            response = { success: false, error: 'Supabase auth not initialized' };
            break;
          }

          const result = await supabaseAuth.signIn(email, password);
          if (result.success && result.user) {
            setCurrentUserId(result.user.id);

            // Mark extension as logged in on the user's profile
            try {
              const sbClient = (self as unknown as { supabase?: { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } } }).supabase;
              if (sbClient) {
                await sbClient.from('profiles').update({ extension_logged_in: true, extension_last_active_at: new Date().toISOString() }).eq('id', result.user.id);
                console.log('[ServiceWorker] Marked extension_logged_in=true for user');
              }
            } catch (e) {
              console.warn('[ServiceWorker] Failed to update extension_logged_in:', e);
            }

            // Check if migration is needed
            const migrationCheck = await chrome.storage.local.get([
              'supabase_migration_complete',
              'supabase_migration_user',
            ]);

            if (
              !migrationCheck.supabase_migration_complete ||
              migrationCheck.supabase_migration_user !== result.user.id
            ) {
              console.log('[ServiceWorker] First sign-in - running data migration');
              await migrateExistingData();
            }
          }

          response = { success: result.success, data: result, error: result.error };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_AUTH_SIGN_UP': {
        console.log('[ServiceWorker] SUPABASE_AUTH_SIGN_UP received');
        try {
          const { email, password } = message.data as { email: string; password: string };

          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            signUp: (email: string, password: string) => Promise<{ success: boolean; user?: { id: string }; error?: string; message?: string }>;
          } }).supabaseAuth;

          if (!supabaseAuth) {
            response = { success: false, error: 'Supabase auth not initialized' };
            break;
          }

          const result = await supabaseAuth.signUp(email, password);
          if (result.success && result.user) {
            setCurrentUserId(result.user.id);
          }

          response = { success: result.success, data: result, error: result.error };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_AUTH_GOOGLE': {
        console.log('[ServiceWorker] SUPABASE_AUTH_GOOGLE received');
        try {
          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            signInWithGoogle: () => Promise<{ success: boolean; pending?: boolean; error?: string | null }>;
          } }).supabaseAuth;

          if (!supabaseAuth) {
            response = { success: false, error: 'Supabase auth not initialized' };
            break;
          }

          const result = await supabaseAuth.signInWithGoogle();
          // signInWithGoogle now opens a tab to the platform login page.
          // The session will arrive asynchronously via EXTENSION_AUTH_SESSION.
          response = { success: result.success, pending: result.pending, error: result.error };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'EXTENSION_AUTH_SESSION': {
        console.log('[ServiceWorker] EXTENSION_AUTH_SESSION received from webapp relay');
        try {
          const sessionData = message.data;
          if (!sessionData?.access_token) {
            response = { success: false, error: 'No session data provided' };
            break;
          }

          // Guard: reject if extension is already logged in as a different user
          const existingSession = await chrome.storage.local.get('supabase_session');
          const existingEmail = existingSession?.supabase_session?.user?.email;
          if (existingEmail && sessionData.user?.email && existingEmail !== sessionData.user.email) {
            console.warn(`[ServiceWorker] Rejecting session push: extension logged in as ${existingEmail}, push is for ${sessionData.user.email}`);
            response = { success: false, error: 'Different user already logged in' };
            break;
          }

          // Save the session to chrome.storage.local (same format as SupabaseAuth)
          await chrome.storage.local.set({
            supabase_session: {
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
              expires_in: sessionData.expires_in,
              expires_at: sessionData.expires_at,
              token_type: sessionData.token_type,
              user: sessionData.user,
            },
          });

          // Update the Supabase client auth state
          const supabaseClient = (self as unknown as { supabase?: { setAuth: (token: string, userId: string) => void } }).supabase;
          if (supabaseClient) {
            supabaseClient.setAuth(sessionData.access_token, sessionData.user?.id);
          }

          // Update the auth module state
          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            session: unknown;
            currentUser: { id: string; email: string } | null;
            notifyListeners: (event: string, user: unknown) => void;
            ensureUserRecord: (user: unknown) => Promise<void>;
          } }).supabaseAuth;

          if (supabaseAuth) {
            supabaseAuth.session = sessionData;
            supabaseAuth.currentUser = {
              id: sessionData.user?.id,
              email: sessionData.user?.email,
            };
            supabaseAuth.notifyListeners('SIGNED_IN', supabaseAuth.currentUser);
            await supabaseAuth.ensureUserRecord(sessionData.user);
          }

          setCurrentUserId(sessionData.user?.id);

          // Mark extension as logged in on the user's profile
          if (sessionData.user?.id) {
            try {
              const sbClient = (self as unknown as { supabase?: { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } } }).supabase;
              if (sbClient) {
                await sbClient.from('profiles').update({ extension_logged_in: true, extension_last_active_at: new Date().toISOString() }).eq('id', sessionData.user.id);
                console.log('[ServiceWorker] Marked extension_logged_in=true for user');
              }
            } catch (e) {
              console.warn('[ServiceWorker] Failed to update extension_logged_in:', e);
            }
          }

          // Check if data migration is needed
          const migrationCheck = await chrome.storage.local.get([
            'supabase_migration_complete',
            'supabase_migration_user',
          ]);

          if (
            !migrationCheck.supabase_migration_complete ||
            migrationCheck.supabase_migration_user !== sessionData.user?.id
          ) {
            console.log('[ServiceWorker] First extension sign-in - running data migration');
            await migrateExistingData();
          }

          console.log('[ServiceWorker] Extension auth session saved for:', sessionData.user?.email);

          // Broadcast auth state change to all tabs so the platform updates instantly
          broadcastAuthStateChange('SIGNED_IN', true);

          response = { success: true, data: { userId: sessionData.user?.id, email: sessionData.user?.email } };
        } catch (error) {
          console.error('[ServiceWorker] EXTENSION_AUTH_SESSION error:', error);
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_AUTH_SIGN_OUT': {
        console.log('[ServiceWorker] SUPABASE_AUTH_SIGN_OUT received');
        try {
          // Mark extension as logged out before clearing session
          const sessionForLogout = await chrome.storage.local.get('supabase_session');
          const logoutUserId = sessionForLogout.supabase_session?.user?.id;
          if (logoutUserId) {
            try {
              const sbClient = (self as unknown as { supabase?: { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } } }).supabase;
              if (sbClient) {
                await sbClient.from('profiles').update({ extension_logged_in: false }).eq('id', logoutUserId);
                console.log('[ServiceWorker] Marked extension_logged_in=false for user');
              }
            } catch (e) {
              console.warn('[ServiceWorker] Failed to clear extension_logged_in:', e);
            }
          }

          const supabaseAuth = (self as unknown as { supabaseAuth?: {
            signOut: () => Promise<{ success: boolean; error?: string }>;
          } }).supabaseAuth;

          if (supabaseAuth) {
            await supabaseAuth.signOut();
          }

          setCurrentUserId(null);

          // Broadcast auth state change to all tabs so the platform updates instantly
          broadcastAuthStateChange('SIGNED_OUT', false);

          response = { success: true };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_SYNC_STATUS': {
        console.log('[ServiceWorker] SUPABASE_SYNC_STATUS received');
        try {
          const syncStatus = await getSyncStatusInfo();
          // Also get last sync time from storage
          const lastSyncResult = await chrome.storage.local.get('last_sync_time');
          response = {
            success: true,
            data: {
              ...syncStatus,
              lastSyncTimeISO: lastSyncResult.last_sync_time || null,
              isOnline: navigator.onLine,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_SYNC_NOW': {
        console.log('[ServiceWorker] SUPABASE_SYNC_NOW received');
        try {
          const result = await processPendingChanges();
          response = { success: true, data: result };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_SYNC_RETRY': {
        console.log('[ServiceWorker] SUPABASE_SYNC_RETRY received');
        try {
          const maxRetries = (message.data as { maxRetries?: number })?.maxRetries || 3;
          const result = await syncWithRetry(maxRetries);
          response = { success: result.success, data: result };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_DETAILED_STATUS': {
        console.log('[ServiceWorker] SUPABASE_DETAILED_STATUS received');
        try {
          const detailedStatus = await getDetailedSyncStatus();
          response = { success: true, data: detailedStatus };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_FULL_SYNC': {
        console.log('[ServiceWorker] SUPABASE_FULL_SYNC received');
        try {
          // Re-queue all data and sync
          const migrationResult = await migrateExistingData();
          response = { success: true, data: migrationResult };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'SUPABASE_MIGRATE_DATA': {
        console.log('[ServiceWorker] SUPABASE_MIGRATE_DATA received');
        try {
          const result = await migrateExistingData();
          response = { success: true, data: result };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DEBUG_AUTH_RESTORE': {
        console.log('[ServiceWorker] DEBUG_AUTH_RESTORE received');
        try {
          // Get current state
          const currentState = {
            currentUserId: getCurrentUserId(),
            supabaseAvailable: !!self.supabase,
            supabaseAuthAvailable: !!self.supabaseAuth,
          };
          console.log('[DEBUG] Current state:', currentState);

          // Try to restore from storage
          const storageResult = await chrome.storage.local.get(['supabase_session', 'linkedin_profile']);
          console.log('[DEBUG] Storage session:', storageResult.supabase_session ? 'found' : 'not found');
          console.log('[DEBUG] Storage profile:', storageResult.linkedin_profile ? 'found' : 'not found');

          if (storageResult.supabase_session?.user?.id) {
            const userId = storageResult.supabase_session.user.id;
            console.log('[DEBUG] Restoring user ID:', userId);
            setCurrentUserId(userId);

            // Also set auth on supabase client
            if (self.supabase && storageResult.supabase_session.access_token) {
              self.supabase.setAuth(storageResult.supabase_session.access_token, userId);
              console.log('[DEBUG] Set auth on Supabase client');
            }
          }

          // Now try to sync if we have profile data
          if (storageResult.linkedin_profile && getCurrentUserId()) {
            console.log('[DEBUG] Queuing profile for sync...');
            await queueForSync('linkedin_profile', storageResult.linkedin_profile);
            const syncResult = await processPendingChanges();
            console.log('[DEBUG] Sync result:', syncResult);
            response = {
              success: true,
              data: {
                ...currentState,
                restoredUserId: getCurrentUserId(),
                syncResult,
                profileData: storageResult.linkedin_profile,
              },
            };
          } else {
            response = {
              success: true,
              data: {
                ...currentState,
                restoredUserId: getCurrentUserId(),
                error: !storageResult.linkedin_profile ? 'No profile data' : 'No user ID',
              },
            };
          }
        } catch (error) {
          console.error('[DEBUG] Error:', error);
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DEBUG_CLEAR_PENDING': {
        console.log('[ServiceWorker] DEBUG_CLEAR_PENDING received');
        try {
          // Get current pending changes
          const pendingResult = await chrome.storage.local.get('supabase_pending_changes');
          const pendingCount = (pendingResult.supabase_pending_changes || []).length;

          // Clear pending changes
          await chrome.storage.local.set({ supabase_pending_changes: [] });

          response = {
            success: true,
            data: {
              clearedCount: pendingCount,
              message: `Cleared ${pendingCount} pending changes`,
            },
          };
        } catch (error) {
          console.error('[DEBUG] Error clearing pending:', error);
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DEBUG_GET_PENDING': {
        console.log('[ServiceWorker] DEBUG_GET_PENDING received');
        try {
          const pendingResult = await chrome.storage.local.get('supabase_pending_changes');
          const pending = pendingResult.supabase_pending_changes || [];

          response = {
            success: true,
            data: {
              count: pending.length,
              changes: pending,
            },
          };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      // ==========================================
      // Google Drive Sync (v4.0 Phase 6)
      // ==========================================

      case 'GOOGLE_AUTH_STATUS': {
        console.log('[ServiceWorker] GOOGLE_AUTH_STATUS received');
        try {
          const authState = await getAuthState();
          response = { success: true, data: authState };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GOOGLE_AUTH_START': {
        console.log('[ServiceWorker] GOOGLE_AUTH_START received');
        try {
          const authState = await startAuthFlow();
          response = { success: true, data: authState };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'GOOGLE_AUTH_LOGOUT': {
        console.log('[ServiceWorker] GOOGLE_AUTH_LOGOUT received');
        try {
          await googleLogout();
          response = { success: true };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DRIVE_SYNC_NOW': {
        console.log('[ServiceWorker] DRIVE_SYNC_NOW received');
        try {
          const backupFile = await syncNow();
          response = { success: true, data: backupFile };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DRIVE_SYNC_STATUS': {
        console.log('[ServiceWorker] DRIVE_SYNC_STATUS received');
        try {
          const status = await getSyncStatus();
          const settings = await getSyncSettings();
          response = { success: true, data: { status, settings } };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DRIVE_GET_BACKUPS': {
        console.log('[ServiceWorker] DRIVE_GET_BACKUPS received');
        try {
          const backups = await listBackups();
          response = { success: true, data: backups };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DRIVE_RESTORE_BACKUP': {
        console.log('[ServiceWorker] DRIVE_RESTORE_BACKUP received');
        try {
          const fileId = (message.data as { fileId: string }).fileId;
          await restoreBackup(fileId);
          response = { success: true };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      case 'DRIVE_DELETE_BACKUP': {
        console.log('[ServiceWorker] DRIVE_DELETE_BACKUP received');
        try {
          const fileId = (message.data as { fileId: string }).fileId;
          await deleteBackup(fileId);
          response = { success: true };
        } catch (error) {
          response = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;
      }

      // ==========================================
      // Quick Post Composer (AGI-59)
      // ==========================================

      case 'CREATE_LINKEDIN_POST': {
        console.log('[ServiceWorker] CREATE_LINKEDIN_POST received');
        try {
          const postData = message.data as { content: string; visibility?: string };

          // Get auth cookies
          const cookies = await getLinkedInCookies();
          if (!cookies.isAuthenticated) {
            response = { success: false, error: 'Not authenticated to LinkedIn. Please log in first.' };
            break;
          }

          // Create post using LinkedIn Voyager API
          const csrfToken = cookies.csrfToken?.replace(/"/g, '') || '';

          const postPayload = {
            visibleToGuest: postData.visibility === 'PUBLIC',
            externalAudienceProviders: [],
            commentaryV2: {
              text: postData.content,
              attributes: [],
            },
            origin: 'FEED',
            allowedCommentersScope: 'ALL',
            postState: 'PUBLISHED',
          };

          const postResponse = await fetch('https://www.linkedin.com/voyager/api/contentcreation/normShares', {
            method: 'POST',
            headers: {
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
              'accept-language': 'en-US,en;q=0.9',
              'content-type': 'application/json; charset=UTF-8',
              'csrf-token': csrfToken,
              'x-li-lang': 'en_US',
              'x-li-page-instance': 'urn:li:page:feed_index_logged_in;' + generateUUID(),
              'x-li-track': JSON.stringify({
                clientVersion: '1.13.8960',
                mpVersion: '1.13.8960',
                osName: 'web',
                timezoneOffset: new Date().getTimezoneOffset() / -60,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceFormFactor: 'DESKTOP',
                mpName: 'voyager-web',
              }),
              'x-restli-protocol-version': '2.0.0',
            },
            credentials: 'include',
            body: JSON.stringify(postPayload),
          });

          if (!postResponse.ok) {
            const errorText = await postResponse.text();
            console.error('[ServiceWorker] Post creation failed:', postResponse.status, errorText);
            response = {
              success: false,
              error: `Failed to create post (${postResponse.status}). Try posting from LinkedIn directly.`
            };
            break;
          }

          const result = await postResponse.json();
          console.log('[ServiceWorker] Post created successfully:', result);

          // Save post to history
          const existingPosts = await getFromStorage<unknown[]>('quick_posts_history');
          const posts = existingPosts.data || [];
          posts.unshift({
            id: Date.now().toString(),
            content: postData.content.substring(0, 100),
            timestamp: new Date().toISOString(),
            postId: result.data?.value?.urn || null,
          });
          await saveToStorage('quick_posts_history', posts.slice(0, 50));

          response = {
            success: true,
            data: {
              message: 'Post created successfully!',
              postId: result.data?.value?.urn,
            }
          };
        } catch (error) {
          console.error('[ServiceWorker] Error creating post:', error);
          response = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create post'
          };
        }
        break;
      }

      // ============================================
      // BACKGROUND SYNC MESSAGE HANDLERS (v4.2)
      // ============================================

      case 'BACKGROUND_SYNC_ENABLE': {
        const syncConfig = message.data as Partial<BackgroundSyncConfig> | undefined;
        await enableBackgroundSync(syncConfig);
        response = { success: true };
        break;
      }

      case 'BACKGROUND_SYNC_DISABLE': {
        await disableBackgroundSync();
        response = { success: true };
        break;
      }

      case 'BACKGROUND_SYNC_TRIGGER': {
        // Fire-and-forget: respond immediately so the popup doesn't hang
        triggerSync(true).catch((err) => {
          console.error('[BackgroundSync] Manual trigger failed:', err);
        });
        response = { success: true, data: { message: 'Sync started' } };
        break;
      }

      case 'BACKGROUND_SYNC_STATUS': {
        const bgSyncState = await getBackgroundSyncState();
        response = { success: true, data: bgSyncState };
        break;
      }

      case 'BACKGROUND_SYNC_CONFIG': {
        const bgSyncConfig = await getBackgroundSyncConfig();
        response = { success: true, data: bgSyncConfig };
        break;
      }

      case 'BACKGROUND_SYNC_UPDATE_CONFIG': {
        const configUpdates = message.data as Partial<BackgroundSyncConfig>;
        await updateBackgroundSyncConfig(configUpdates);
        response = { success: true };
        break;
      }

      case 'BACKGROUND_SYNC_RESET_CIRCUIT_BREAKER': {
        await resetCircuitBreaker();
        response = { success: true };
        break;
      }

      case 'BACKGROUND_SYNC_HISTORY': {
        const bgState = await getBackgroundSyncState();
        response = { success: true, data: bgState.syncHistory };
        break;
      }

      case 'BACKGROUND_SYNC_DIAGNOSTIC': {
        const diagnosticResults = await runDiagnostic();
        response = { success: true, data: diagnosticResults };
        break;
      }

      default:
        response = { success: false, error: 'Unknown message type' };
    }

    sendResponse(response);
  })();

  return true;
});

// ============================================
// ALARM EVENT HANDLER
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[ServiceWorker] Alarm triggered: ${alarm.name}`);

  switch (alarm.name) {
    case ALARM_NAMES.DAILY_BACKUP:
    case ALARM_NAMES.WEEKLY_BACKUP:
      await handleScheduledBackup();
      break;

    case ALARM_NAMES.MAINTENANCE:
      await handleMaintenanceAlarm();
      break;

    case ALARM_NAMES.ALERT_CHECK:
      await handleAlertCheck();
      break;

    case ALARM_NAMES.BACKGROUND_SYNC:
      await handleBackgroundSyncAlarm();
      break;

    default:
      console.log(`[ServiceWorker] Unknown alarm: ${alarm.name}`);
  }
});

async function handleScheduledBackup(): Promise<void> {
  console.log('[ServiceWorker] Running scheduled backup...');
  try {
    const backup = await exportFullBackup();
    const size = new Blob([backup]).size;

    // Store backup metadata
    const backupId = `backup-${Date.now()}`;
    await saveToStorage(`backup_${backupId}`, {
      id: backupId,
      timestamp: Date.now(),
      size,
      type: 'scheduled',
      data: backup,
    });

    // Update last backup time
    const schedule = await getBackupSchedule();
    schedule.lastBackup = Date.now();
    await updateBackupSchedule(schedule);

    await showBackupSuccessNotification('scheduled', size);
    console.log(`[ServiceWorker] Scheduled backup completed: ${size} bytes`);
  } catch (error) {
    console.error('[ServiceWorker] Scheduled backup failed:', error);
    await showBackupFailureNotification(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleMaintenanceAlarm(): Promise<void> {
  console.log('[ServiceWorker] Running maintenance...');
  try {
    await runMaintenance();
    console.log('[ServiceWorker] Maintenance completed');
  } catch (error) {
    console.error('[ServiceWorker] Maintenance failed:', error);
  }
}

async function handleAlertCheck(): Promise<void> {
  console.log('[ServiceWorker] Checking alerts...');
  try {
    const alerts = await getAlertConfigs();
    const triggered = await checkAlerts(alerts);

    if (triggered.length > 0) {
      console.log(`[ServiceWorker] ${triggered.length} alerts triggered`);

      // Get current values for triggered alerts
      const summary = await getTrendSummary(7);
      const alertsWithValues = triggered.map((alert) => {
        const typeKey = alert.type as keyof typeof summary;
        const stats = summary[typeKey] || { current: 0, changePercent: 0 };
        return {
          alert,
          currentValue: stats.current,
          changePercent: stats.changePercent,
        };
      });

      // Show notifications
      await showMultipleGrowthAlerts(alertsWithValues);

      // Mark alerts as triggered
      for (const alert of triggered) {
        await markAlertTriggered(alert.id);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Alert check failed:', error);
  }
}

// ============================================
// EXTENSION LIFECYCLE
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ServiceWorker] Extension installed:', details.reason);

  // Initialize IndexedDB
  try {
    await initHistoryManager();
    console.log('[ServiceWorker] IndexedDB initialized');
  } catch (error) {
    console.error('[ServiceWorker] Failed to initialize IndexedDB:', error);
  }

  // Initialize alarms
  try {
    await initializeAlarms();
    console.log('[ServiceWorker] Alarms initialized');
  } catch (error) {
    console.error('[ServiceWorker] Failed to initialize alarms:', error);
  }

  // Initialize background sync
  try {
    await initBackgroundSync();
    console.log('[ServiceWorker] Background sync initialized');
  } catch (error) {
    console.error('[ServiceWorker] Failed to initialize background sync:', error);
  }

  // Setup notification listeners
  setupNotificationListeners();

  saveToStorage(STORAGE_KEYS.SETTINGS, {
    autoCapture: true,
    captureProfiles: true,
    captureAnalytics: true,
    captureConnections: true,
    maxStoredApis: 1000,
  });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[ServiceWorker] Browser started — triggering immediate data sync');

  // Initialize IndexedDB on browser startup
  try {
    await initHistoryManager();
    console.log('[ServiceWorker] IndexedDB initialized on startup');

    // Run daily maintenance (prune old data)
    await runMaintenance();
  } catch (error) {
    console.error('[ServiceWorker] Startup initialization error:', error);
  }

  // Initialize alarms on browser startup
  try {
    await initializeAlarms();
    console.log('[ServiceWorker] Alarms initialized on startup');
  } catch (error) {
    console.error('[ServiceWorker] Alarms initialization error:', error);
  }

  // Initialize background sync on browser startup with startup=true
  // to trigger an immediate sync so data is fresh when the user opens Chrome
  try {
    await initBackgroundSync(true);
    console.log('[ServiceWorker] Background sync initialized on startup (immediate sync queued)');
  } catch (error) {
    console.error('[ServiceWorker] Background sync initialization error:', error);
  }

  // Setup notification listeners
  setupNotificationListeners();
});

// Initialize when service worker loads
(async () => {
  try {
    await initHistoryManager();
    console.log('[ServiceWorker] IndexedDB ready');

    await initializeAlarms();
    console.log('[ServiceWorker] Alarms ready');

    setupNotificationListeners();
    console.log('[ServiceWorker] Notifications ready');

    // Initialize Supabase sync bridge
    await initSyncBridge();
    console.log('[ServiceWorker] Supabase sync bridge ready');

    // Start periodic sync (every 5 minutes)
    startPeriodicSync(5);
    console.log('[ServiceWorker] Periodic sync started');

    // Initialize background sync
    await initBackgroundSync();
    console.log('[ServiceWorker] Background sync ready');

    // Check for stale data on service worker wake-up
    const state = await getBackgroundSyncState();
    const config = await getBackgroundSyncConfig();
    if (config.enabled && state.lastSyncTime) {
      const msSinceLastSync = Date.now() - state.lastSyncTime;
      const intervalMs = (config.intervalMinutes || 30) * 60 * 1000;
      if (msSinceLastSync > intervalMs) {
        console.log('[ServiceWorker] Stale data detected, triggering catch-up sync');
        triggerSync(false, false).catch(console.error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Initialization error:', error);
  }
})();

console.log('[ServiceWorker] ChainLinked Data Connector service worker loaded (TypeScript v4.2)');

// Expose diagnostic utilities on the global scope for service worker console debugging.
// Usage: In the service worker DevTools console, type:
//   self.__bgSync.diagnostic()    — run full diagnostic
//   self.__bgSync.status()        — get current sync state
//   self.__bgSync.trigger()       — manually trigger a sync
//   self.__bgSync.enable()        — enable background sync
//   self.__bgSync.disable()       — disable background sync
Object.assign(self, {
  __bgSync: {
    diagnostic: runDiagnostic,
    status: getBackgroundSyncState,
    config: getBackgroundSyncConfig,
    trigger: () => triggerSync(true),
    enable: enableBackgroundSync,
    disable: disableBackgroundSync,
    reset: resetCircuitBreaker,
  },
});
