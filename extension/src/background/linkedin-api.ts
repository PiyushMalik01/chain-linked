/**
 * LinkedIn Voyager API Client for Background Data Fetching
 *
 * Provides authenticated access to LinkedIn's internal Voyager API from a
 * Chrome extension Manifest V3 service worker. Unlike content scripts, the
 * service worker cannot rely on `credentials: 'include'` to auto-attach
 * cookies -- they must be read via `chrome.cookies.get()` and passed
 * explicitly in the Cookie header.
 *
 * @module background/linkedin-api
 */

import type { LinkedInAuth, SyncEndpointType } from '../shared/sync-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base URL for all LinkedIn Voyager API calls */
const LINKEDIN_BASE_URL = 'https://www.linkedin.com';

/** Log prefix used by every function in this module */
const LOG_PREFIX = '[BackgroundSync:API]';

/** Maximum time in milliseconds to wait for a single API request */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Map of sync endpoint types to their Voyager API path templates.
 * Paths containing `{profileUrn}` or `{publicIdentifier}` are substituted
 * at runtime by {@link getEndpointUrl}.
 */
const ENDPOINT_PATHS: Record<SyncEndpointType, string> = {
  analytics:
    '/voyager/api/contentcreation/creatorAnalytics' +
    '?q=analytics' +
    '&profileUrn={profileUrn}' +
    '&timePeriod=PAST_7_DAYS',

  profile:
    '/voyager/api/identity/dash/profiles' +
    '?q=memberIdentity' +
    '&memberIdentity={publicIdentifier}' +
    '&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-16',

  audience:
    '/voyager/api/contentcreation/creatorAnalytics' +
    '?q=audience' +
    '&profileUrn={profileUrn}',

  myPosts:
    '/voyager/api/graphql' +
    '?includeWebMetadata=true' +
    '&variables=(count:100,start:{start},profileUrn:{profileUrn})' +
    '&queryId=voyagerFeedDashProfileUpdates.4af00b28d60ed0f1488018948daad822',

  profileViews: '/voyager/api/identity/wvmpCards',

  networkInfo:
    '/voyager/api/identity/dash/profiles' +
    '?q=memberIdentity' +
    '&memberIdentity={publicIdentifier}' +
    '&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-128',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a RFC 4122 version 4 UUID.
 * Used to populate the `x-li-page-instance` header with a fresh value on
 * every request, matching the behaviour of the LinkedIn SPA.
 *
 * @returns A lowercase UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Read LinkedIn session cookies from the browser and derive authentication
 * credentials required by the Voyager API.
 *
 * The service worker cannot use `credentials: 'include'` on fetch requests,
 * so we read `li_at` and `JSESSIONID` manually via the `chrome.cookies` API
 * and include them in the request Cookie header.
 *
 * @returns A {@link LinkedInAuth} object if both cookies are present, or
 *          `null` when the user is not logged in to LinkedIn.
 *
 * @example
 * const auth = await getLinkedInAuth();
 * if (!auth) {
 *   console.warn('User is not authenticated');
 * }
 */
export async function getLinkedInAuth(): Promise<LinkedInAuth | null> {
  try {
    const [liAt, jsessionid] = await Promise.all([
      chrome.cookies.get({ url: LINKEDIN_BASE_URL, name: 'li_at' }),
      chrome.cookies.get({ url: LINKEDIN_BASE_URL, name: 'JSESSIONID' }),
    ]);

    if (!liAt?.value || !jsessionid?.value) {
      console.log(`${LOG_PREFIX} Auth cookies missing: li_at=${!!liAt?.value}, JSESSIONID=${!!jsessionid?.value}`);
      return null;
    }

    return {
      liAt: liAt.value,
      jsessionId: jsessionid.value,
      csrfToken: jsessionid.value.replace(/"/g, ''),
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read LinkedIn cookies:`, error);
    return null;
  }
}

/**
 * Quick boolean check for whether the user currently has valid LinkedIn
 * session cookies. Does not make any network requests.
 *
 * @returns `true` if both `li_at` and `JSESSIONID` cookies are present.
 *
 * @example
 * if (!(await isLinkedInAuthenticated())) {
 *   console.warn('Skipping sync -- user not logged in');
 *   return;
 * }
 */
export async function isLinkedInAuthenticated(): Promise<boolean> {
  const auth = await getLinkedInAuth();
  return auth !== null;
}

// ---------------------------------------------------------------------------
// Header Construction
// ---------------------------------------------------------------------------

/**
 * Build the HTTP headers required to make an authenticated Voyager API
 * request that mimics real browser traffic.
 *
 * Key headers include:
 * - `csrf-token` derived from the JSESSIONID cookie
 * - `x-li-page-instance` with a fresh UUID to simulate page navigation
 * - `x-li-track` with client version and device metadata
 * - `cookie` with session cookies attached manually
 *
 * @param auth - Authentication credentials obtained from {@link getLinkedInAuth}
 * @returns A plain object of HTTP headers suitable for the `fetch` Headers init.
 *
 * @example
 * const auth = await getLinkedInAuth();
 * if (auth) {
 *   const headers = buildVoyagerHeaders(auth);
 *   const res = await fetch(url, { headers });
 * }
 */
export function buildVoyagerHeaders(auth: LinkedInAuth): Record<string, string> {
  return {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    'csrf-token': auth.csrfToken,
    'x-li-lang': 'en_US',
    'x-li-page-instance': `urn:li:page:d_flagship3_profile_view_base;${generateUUID()}`,
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
    'cookie': `li_at=${auth.liAt}; JSESSIONID=${auth.jsessionId}`,
  };
}

// ---------------------------------------------------------------------------
// URL Construction
// ---------------------------------------------------------------------------

/**
 * Build the full Voyager API URL for a given sync endpoint type.
 *
 * Replaces `{profileUrn}` and `{publicIdentifier}` placeholders in the
 * endpoint path template with the supplied values. The `profileViews`
 * endpoint does not require any parameters.
 *
 * @param type - The sync endpoint type to build a URL for.
 * @param profileUrn - The user's LinkedIn profile URN
 *                      (e.g. `urn:li:fsd_profile:ACoAAA...`). Required for
 *                      analytics, audience, and myPosts endpoints.
 * @param publicIdentifier - The user's public LinkedIn identifier
 *                           (e.g. `johndoe`). Required for the profile endpoint.
 * @returns The fully-qualified URL string ready for `fetch`.
 *
 * @example
 * const url = getEndpointUrl('analytics', 'urn:li:fsd_profile:ACoAAA123');
 * // => "https://www.linkedin.com/voyager/api/contentcreation/creatorAnalytics?q=analytics&profileUrn=urn%3Ali%3Afsd_profile%3AACoAAA123&timePeriod=PAST_7_DAYS"
 */
export function getEndpointUrl(
  type: SyncEndpointType,
  profileUrn?: string,
  publicIdentifier?: string,
  start?: number,
): string {
  let path = ENDPOINT_PATHS[type];

  if (profileUrn) {
    path = path.replace('{profileUrn}', encodeURIComponent(profileUrn));
  }

  if (publicIdentifier) {
    path = path.replace('{publicIdentifier}', encodeURIComponent(publicIdentifier));
  }

  // Replace pagination offset (defaults to 0 for first page)
  path = path.replace('{start}', String(start ?? 0));

  // Validate that no unsubstituted placeholders remain
  if (path.includes('{profileUrn}') || path.includes('{publicIdentifier}')) {
    throw new Error(
      `Missing required parameter for endpoint '${type}': ` +
      `profileUrn=${profileUrn ?? 'undefined'}, publicIdentifier=${publicIdentifier ?? 'undefined'}`,
    );
  }

  return `${LINKEDIN_BASE_URL}${path}`;
}

/**
 * Endpoints that require a profile URN to function.
 * Used by the sync orchestrator to filter endpoints when no URN is available.
 */
export const ENDPOINTS_REQUIRING_PROFILE_URN: ReadonlySet<SyncEndpointType> = new Set([
  'analytics',
  'audience',
  'myPosts',
]);

/**
 * Endpoints that require a public identifier to function.
 */
export const ENDPOINTS_REQUIRING_PUBLIC_ID: ReadonlySet<SyncEndpointType> = new Set([
  'profile',
  'networkInfo',
]);

/**
 * Endpoints that require LinkedIn Creator status.
 * These return HTTP 404 for non-creator accounts, which should not be
 * treated as failures or trip the circuit breaker.
 */
export const CREATOR_ONLY_ENDPOINTS: ReadonlySet<SyncEndpointType> = new Set([
  'analytics',
  'audience',
]);

// ---------------------------------------------------------------------------
// Low-level Fetch
// ---------------------------------------------------------------------------

/**
 * Result shape returned by {@link voyagerFetch} and {@link fetchEndpoint}.
 */
export interface VoyagerFetchResult {
  /** Whether the request completed successfully (HTTP 2xx and valid JSON) */
  success: boolean;
  /** Parsed JSON response body, present only when `success` is `true` */
  data?: unknown;
  /** Human-readable error description, present only when `success` is `false` */
  error?: string;
  /** HTTP status code from the response, useful for back-off decisions */
  status?: number;
}

/**
 * Execute an authenticated GET request against a LinkedIn Voyager API
 * endpoint and return the parsed JSON response.
 *
 * Handles common failure modes:
 * - **HTTP 401 / 403** -- authentication expired or insufficient permissions.
 * - **HTTP 429** -- rate-limited by LinkedIn.
 * - **HTTP 999** -- LinkedIn has flagged the request as bot traffic.
 * - **Network errors** -- DNS failure, timeout, etc.
 *
 * Cookies are attached manually via the Cookie header rather than using
 * `credentials: 'include'`, which is required in a Manifest V3 service
 * worker context.
 *
 * @param endpoint - Fully-qualified Voyager API URL to fetch.
 * @param auth - Authentication credentials from {@link getLinkedInAuth}.
 * @returns A {@link VoyagerFetchResult} with the parsed data or error details.
 *
 * @example
 * const auth = await getLinkedInAuth();
 * if (auth) {
 *   const result = await voyagerFetch(
 *     'https://www.linkedin.com/voyager/api/identity/wvmpCards',
 *     auth,
 *   );
 *   if (result.success) {
 *     console.log('Profile views:', result.data);
 *   }
 * }
 */
export async function voyagerFetch(
  endpoint: string,
  auth: LinkedInAuth,
): Promise<VoyagerFetchResult> {
  try {
    const headers = buildVoyagerHeaders(auth);

    console.log(`${LOG_PREFIX} Fetching: ${endpoint}`);

    // Enforce a timeout to prevent hanging requests from consuming the
    // MV3 service worker's limited execution lifetime.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
      // Do NOT use credentials: 'include' -- service workers must pass
      // cookies explicitly via the Cookie header.
    });

    clearTimeout(timeout);

    const status = response.status;

    // ----- Handle well-known error status codes -----

    if (status === 401 || status === 403) {
      console.warn(`${LOG_PREFIX} Auth error (${status}) for ${endpoint}`);
      return {
        success: false,
        error: `Authentication failed (HTTP ${status}). LinkedIn session may have expired.`,
        status,
      };
    }

    if (status === 429) {
      console.warn(`${LOG_PREFIX} Rate limited (429) for ${endpoint}`);
      return {
        success: false,
        error: 'Rate limited by LinkedIn. Please wait before retrying.',
        status,
      };
    }

    if (status === 999) {
      console.warn(`${LOG_PREFIX} LinkedIn block (999) for ${endpoint}`);
      return {
        success: false,
        error: 'LinkedIn has temporarily blocked requests. Reduce sync frequency.',
        status,
      };
    }

    if (!response.ok) {
      console.error(`${LOG_PREFIX} HTTP ${status} for ${endpoint}`);
      return {
        success: false,
        error: `HTTP error ${status}`,
        status,
      };
    }

    // ----- Parse JSON body -----

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.error(`${LOG_PREFIX} Failed to parse JSON for ${endpoint} (HTTP ${status})`);
      return {
        success: false,
        error: `Invalid JSON response (HTTP ${status}). Possible login redirect or CAPTCHA page.`,
        status,
      };
    }

    console.log(`${LOG_PREFIX} Success: ${endpoint} (${status})`);

    return {
      success: true,
      data,
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    console.error(`${LOG_PREFIX} Network error for ${endpoint}:`, error);

    return {
      success: false,
      error: `Network error: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// High-level Fetch
// ---------------------------------------------------------------------------

/**
 * High-level convenience function that performs the full authentication,
 * URL construction, and fetch flow for a given sync endpoint type.
 *
 * This is the primary entry point for the background sync scheduler. It:
 * 1. Reads LinkedIn session cookies via {@link getLinkedInAuth}.
 * 2. Constructs the Voyager API URL via {@link getEndpointUrl}.
 * 3. Executes the authenticated request via {@link voyagerFetch}.
 *
 * @param type - The sync endpoint type to fetch (e.g. `'analytics'`).
 * @param profileUrn - The user's LinkedIn profile URN. Required for
 *                      analytics, audience, and myPosts endpoints.
 * @param publicIdentifier - The user's public LinkedIn identifier.
 *                           Required for the profile endpoint.
 * @returns A {@link VoyagerFetchResult} with the parsed data or error details
 *          including the HTTP status code for back-off decisions.
 *
 * @example
 * const result = await fetchEndpoint('analytics', 'urn:li:fsd_profile:ACoAAA123');
 * if (result.success) {
 *   console.log('Analytics data:', result.data);
 * } else {
 *   console.error(`Sync failed: ${result.error} (HTTP ${result.status})`);
 * }
 */
export async function fetchEndpoint(
  type: SyncEndpointType,
  profileUrn?: string,
  publicIdentifier?: string,
): Promise<VoyagerFetchResult> {
  console.log(`${LOG_PREFIX} fetchEndpoint: type=${type}, profileUrn=${profileUrn ?? 'none'}, publicId=${publicIdentifier ?? 'none'}`);

  // Step 1: Authenticate
  const auth = await getLinkedInAuth();
  if (!auth) {
    console.warn(`${LOG_PREFIX} fetchEndpoint: not authenticated, aborting`);
    return {
      success: false,
      error: 'Not authenticated to LinkedIn. Please log in first.',
    };
  }

  // Step 2: Build URL
  const url = getEndpointUrl(type, profileUrn, publicIdentifier);

  // Step 3: Fetch
  return voyagerFetch(url, auth);
}

// ---------------------------------------------------------------------------
// Bootstrap: Fetch Current User's Own Profile
// ---------------------------------------------------------------------------

/**
 * Fetch the currently authenticated user's own profile via the `/me` endpoint.
 *
 * This endpoint requires only valid authentication — no profileUrn or
 * publicIdentifier needed. It returns the user's miniProfile which contains
 * the `entityUrn` (profileUrn) and `publicIdentifier` needed by other endpoints.
 *
 * Used as a bootstrap step on the first sync cycle when no stored profile
 * data is available, breaking the chicken-and-egg dependency.
 *
 * @returns A {@link VoyagerFetchResult} with the user's profile data.
 */
export async function fetchCurrentUserProfile(): Promise<VoyagerFetchResult> {
  console.log(`${LOG_PREFIX} Fetching current user profile via /me endpoint`);

  const auth = await getLinkedInAuth();
  if (!auth) {
    return {
      success: false,
      error: 'Not authenticated to LinkedIn.',
    };
  }

  return voyagerFetch(`${LINKEDIN_BASE_URL}/voyager/api/me`, auth);
}

// ---------------------------------------------------------------------------
// Paginated Posts Fetch
// ---------------------------------------------------------------------------

/** Maximum pages to fetch to avoid infinite loops */
const MAX_POST_PAGES = 20;

/** Delay between paginated requests (ms) to avoid rate limiting */
const PAGINATION_DELAY_MS = 2000;

/**
 * Fetch ALL of the user's posts by paginating through the myPosts endpoint.
 * LinkedIn returns up to 100 posts per page. This function keeps fetching
 * until an empty page is returned or the max page limit is reached.
 *
 * @param profileUrn - The user's LinkedIn profile URN
 * @returns A {@link VoyagerFetchResult} with all pages merged into one data object
 */
export async function fetchAllMyPosts(
  profileUrn: string,
): Promise<VoyagerFetchResult> {
  console.log(`${LOG_PREFIX} fetchAllMyPosts: starting paginated fetch for ${profileUrn}`);

  const auth = await getLinkedInAuth();
  if (!auth) {
    return { success: false, error: 'Not authenticated to LinkedIn.' };
  }

  const allIncluded: unknown[] = [];
  const allElements: unknown[] = [];
  let totalFetched = 0;

  for (let page = 0; page < MAX_POST_PAGES; page++) {
    const start = page * 100;
    const url = getEndpointUrl('myPosts', profileUrn, undefined, start);

    console.log(`${LOG_PREFIX} fetchAllMyPosts: page ${page + 1}, start=${start}`);

    const result = await voyagerFetch(url, auth);

    if (!result.success || !result.data) {
      if (page === 0) {
        return result; // First page failed — propagate error
      }
      break; // Later pages failing — return what we have
    }

    const raw = result.data as Record<string, unknown>;
    const included = Array.isArray(raw.included) ? raw.included : [];
    const elements = Array.isArray((raw.data as Record<string, unknown>)?.elements)
      ? ((raw.data as Record<string, unknown>).elements as unknown[])
      : [];

    allIncluded.push(...included);
    allElements.push(...elements);
    totalFetched += included.length;

    console.log(`${LOG_PREFIX} fetchAllMyPosts: page ${page + 1} returned ${included.length} items (total: ${totalFetched})`);

    // If fewer items than requested, we've reached the last page
    if (elements.length === 0 || included.length < 100) {
      console.log(`${LOG_PREFIX} fetchAllMyPosts: last page reached (included=${included.length}, elements=${elements.length})`);
      break;
    }

    // Rate limit delay between pages
    if (page < MAX_POST_PAGES - 1) {
      await new Promise(resolve => setTimeout(resolve, PAGINATION_DELAY_MS));
    }
  }

  console.log(`${LOG_PREFIX} fetchAllMyPosts: complete — ${totalFetched} total items across all pages`);

  // Merge all pages into a single response that processMyPostsData can handle
  return {
    success: true,
    data: {
      included: allIncluded,
      data: { elements: allElements },
    },
    status: 200,
  };
}

// ---------------------------------------------------------------------------
// Per-Post Analytics (dashPostAnalytics)
// ---------------------------------------------------------------------------

/**
 * Fetch detailed analytics for a single LinkedIn post via the
 * `dashPostAnalytics` Voyager endpoint.
 *
 * This endpoint returns richer metrics than the GraphQL `myPosts` feed:
 * - `impressionCount` / `uniqueImpressionCount`
 * - `memberReach`
 * - `likeCount`, `commentCount`, `shareCount`
 * - `engagementRate`
 * - `clickCount`
 *
 * The result fills in the data gap that exists when posts are discovered
 * via the background sync `myPosts` endpoint (which only gives social
 * activity counts: reactions, comments, reposts, impressions).
 *
 * @param activityUrn - The LinkedIn activity URN (e.g. `urn:li:activity:123`).
 * @returns A {@link VoyagerFetchResult} with parsed per-post analytics.
 */
export async function fetchPostDetailedAnalytics(
  activityUrn: string,
): Promise<VoyagerFetchResult> {
  console.log(`${LOG_PREFIX} Fetching per-post analytics for ${activityUrn}`);

  const auth = await getLinkedInAuth();
  if (!auth) {
    return {
      success: false,
      error: 'Not authenticated to LinkedIn.',
    };
  }

  const params = new URLSearchParams({
    q: 'postAnalytics',
    activityUrn,
  });

  const url = `${LINKEDIN_BASE_URL}/voyager/api/analytics/dashPostAnalytics?${params.toString()}`;

  return voyagerFetch(url, auth);
}
