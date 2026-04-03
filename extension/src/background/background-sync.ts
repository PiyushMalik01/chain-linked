/**
 * Background Sync Orchestrator for LinkedIn Data Fetching
 *
 * Manages periodic, unattended data synchronization from LinkedIn's Voyager API
 * within a Chrome extension Manifest V3 service worker. Uses `chrome.alarms`
 * for scheduling (service workers have no persistent timers), persists all
 * state to `chrome.storage.local` so it survives worker restarts, and
 * includes circuit-breaker and exponential back-off safety mechanisms.
 *
 * Coordinates with {@link linkedin-api} for authenticated API calls and writes
 * results to the same chrome.storage.local keys used by the existing service
 * worker message handlers, ensuring seamless integration with the popup UI.
 *
 * @module background/background-sync
 */

import type {
  BackgroundSyncState,
  BackgroundSyncConfig,
  SyncHistoryEntry,
  SyncEndpointType,
  SyncResult,
} from '../shared/sync-types';
import { DEFAULT_SYNC_CONFIG, DEFAULT_SYNC_STATE } from '../shared/sync-types';
import {
  getLinkedInAuth,
  isLinkedInAuthenticated,
  fetchEndpoint,
  fetchAllMyPosts,
  fetchCurrentUserProfile,
  fetchPostDetailedAnalytics,
  ENDPOINTS_REQUIRING_PROFILE_URN,
  ENDPOINTS_REQUIRING_PUBLIC_ID,
  CREATOR_ONLY_ENDPOINTS,
} from './linkedin-api';
import { ALARM_NAMES } from './alarms';
import { saveWithSync, queueForSync, processPendingChanges, reconcilePosts } from './supabase-sync-bridge';

// ---------------------------------------------------------------------------
// Storage Keys & Constants
// ---------------------------------------------------------------------------

/** chrome.storage.local key for persisted sync runtime state */
const SYNC_STATE_KEY = 'background_sync_state';

/** chrome.storage.local key for persisted sync user configuration */
const SYNC_CONFIG_KEY = 'background_sync_config';

/** Log prefix used by every function in this module */
const LOG_PREFIX = '[BackgroundSync]';

/** Maximum number of sync history entries to retain */
const MAX_HISTORY_ENTRIES = 20;

/** Minimum interval in milliseconds between two sync cycles (10 minutes) */
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000;

/** Maximum back-off multiplier to prevent excessively long waits */
const MAX_BACKOFF_MULTIPLIER = 6;

/** Duration in milliseconds of user inactivity that disqualifies active-hours sync (2 hours) */
const INACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * chrome.storage.local keys that mirror the existing service worker message
 * handler storage destinations. Background sync writes to these same keys so
 * the popup UI displays the freshest data regardless of source.
 */
const STORAGE_KEYS = {
  ANALYTICS: 'linkedin_analytics',
  PROFILE: 'linkedin_profile',
  AUDIENCE: 'linkedin_audience',
  MY_POSTS: 'linkedin_my_posts',
} as const;

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/**
 * Read the current background sync runtime state from chrome.storage.local.
 * Returns the default (clean) state if no state has been persisted yet.
 *
 * @returns The persisted {@link BackgroundSyncState}, or defaults.
 *
 * @example
 * const state = await getSyncState();
 * console.log('Last sync:', state.lastSyncTime);
 */
export async function getSyncState(): Promise<BackgroundSyncState> {
  try {
    const result = await chrome.storage.local.get(SYNC_STATE_KEY);
    return (result[SYNC_STATE_KEY] as BackgroundSyncState) || { ...DEFAULT_SYNC_STATE };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read sync state:`, error);
    return { ...DEFAULT_SYNC_STATE };
  }
}

/**
 * Persist the background sync runtime state to chrome.storage.local.
 * This ensures the state survives service worker restarts.
 *
 * @param state - The complete {@link BackgroundSyncState} to persist.
 */
async function saveSyncState(state: BackgroundSyncState): Promise<void> {
  try {
    await chrome.storage.local.set({ [SYNC_STATE_KEY]: state });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to save sync state:`, error);
  }
}

/**
 * Read the user-configurable sync settings from chrome.storage.local.
 * Returns the default configuration if none has been saved yet.
 *
 * @returns The persisted {@link BackgroundSyncConfig}, or defaults.
 *
 * @example
 * const config = await getSyncConfig();
 * if (config.enabled) {
 *   console.log('Sync interval:', config.baseIntervalMinutes, 'min');
 * }
 */
export async function getSyncConfig(): Promise<BackgroundSyncConfig> {
  try {
    const result = await chrome.storage.local.get(SYNC_CONFIG_KEY);
    return (result[SYNC_CONFIG_KEY] as BackgroundSyncConfig) || { ...DEFAULT_SYNC_CONFIG };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read sync config:`, error);
    return { ...DEFAULT_SYNC_CONFIG };
  }
}

/**
 * Persist the user-configurable sync settings to chrome.storage.local.
 *
 * @param config - The complete {@link BackgroundSyncConfig} to persist.
 */
async function saveSyncConfig(config: BackgroundSyncConfig): Promise<void> {
  try {
    await chrome.storage.local.set({ [SYNC_CONFIG_KEY]: config });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to save sync config:`, error);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize the background sync system on service worker startup.
 *
 * Reads the stored configuration and, if sync is enabled, sets up the
 * chrome.alarms alarm for periodic triggering. Should be called once
 * during the service worker's top-level initialization sequence.
 *
 * When called with `isStartup = true` (from chrome.runtime.onStartup),
 * an immediate sync is triggered so that data is captured as soon as
 * the user opens Chrome, without waiting for the next alarm cycle.
 *
 * @param isStartup - Whether this is a browser startup initialization.
 *
 * @example
 * // In service-worker.ts onStartup:
 * await initBackgroundSync(true);
 * // In service-worker.ts onInstalled or top-level IIFE:
 * await initBackgroundSync();
 */
/** Guard to ensure initBackgroundSync() only runs once per service worker lifetime */
let initCompleted = false;

export async function initBackgroundSync(isStartup: boolean = false): Promise<void> {
  // Prevent duplicate initialization from multiple entry points
  // (onInstalled, onStartup, top-level IIFE all call this function).
  if (initCompleted) {
    console.log(`${LOG_PREFIX} Already initialized, skipping duplicate call`);
    return;
  }
  initCompleted = true;

  console.log(`${LOG_PREFIX} Initializing background sync (startup=${isStartup})...`);

  const config = await getSyncConfig();
  const state = await getSyncState();

  // Auto-enable on first run: if the config has never been explicitly
  // saved (fresh install), check for LinkedIn cookies and enable
  // automatically so users don't have to configure anything.
  const rawConfig = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const isFirstRun = !rawConfig[SYNC_CONFIG_KEY];

  if (isFirstRun) {
    console.log(`${LOG_PREFIX} First run detected — checking LinkedIn auth`);
    const isLoggedIn = await isLinkedInAuthenticated();
    if (isLoggedIn) {
      console.log(`${LOG_PREFIX} LinkedIn cookies found — auto-enabling sync`);
      config.enabled = true;
      await saveSyncConfig(config);
    } else {
      console.log(`${LOG_PREFIX} No LinkedIn cookies — saving disabled config for now`);
      await saveSyncConfig(config);
    }
  }

  if (config.enabled) {
    console.log(`${LOG_PREFIX} Sync is enabled, scheduling alarm`);
    await scheduleNextSync(config, state);
    // Ensure state reflects enabled status
    if (!state.enabled) {
      state.enabled = true;
      await saveSyncState(state);
    }

    // Trigger immediate sync on browser startup or first run so the user
    // sees fresh data as soon as they open Chrome.
    if (isStartup || isFirstRun) {
      const reason = isFirstRun ? 'first run' : 'browser startup';
      console.log(`${LOG_PREFIX} Triggering immediate sync (${reason})`);
      // Use setTimeout to let the rest of initialization finish first
      setTimeout(() => {
        triggerSync(false, true).catch((err) => {
          console.error(`${LOG_PREFIX} Startup sync failed:`, err);
        });
      }, 3000);
    }
  } else {
    console.log(`${LOG_PREFIX} Sync is disabled, clearing any existing alarm`);
    await chrome.alarms.clear(ALARM_NAMES.BACKGROUND_SYNC);
  }

  // Listen for LinkedIn login cookies appearing — auto-enable sync
  // when user logs in after the extension was already installed.
  // Only register once to avoid duplicate listeners across multiple
  // initBackgroundSync() calls (onInstalled, onStartup, top-level IIFE).
  if (!cookieListenerRegistered) {
    try {
      chrome.cookies.onChanged.addListener((changeInfo) => {
        if (
          changeInfo.cookie.name === 'li_at' &&
          changeInfo.cookie.domain.includes('linkedin.com') &&
          !changeInfo.removed
        ) {
          // Cookie was set (login) — auto-enable and capture data immediately
          getSyncConfig().then(async (cfg) => {
            if (!cfg.enabled) {
              console.log(`${LOG_PREFIX} LinkedIn login detected — auto-enabling sync + immediate capture`);
              try {
                await enableBackgroundSync();
                // Trigger immediate data capture so user sees data right away
                setTimeout(() => {
                  triggerSync(true).catch((err) => {
                    console.error(`${LOG_PREFIX} Post-login immediate sync failed:`, err);
                  });
                }, 5000); // 5s delay to let login fully complete
              } catch (err) {
                console.error(`${LOG_PREFIX} Failed to auto-enable sync:`, err);
              }
            }
          });
        }
      });
      cookieListenerRegistered = true;
    } catch {
      // cookies.onChanged may not be available in all contexts
      console.warn(`${LOG_PREFIX} Could not register cookie change listener`);
    }
  }

  console.log(`${LOG_PREFIX} Initialization complete`);
}

/**
 * Enable background sync and start scheduling periodic data fetches.
 *
 * Optionally accepts partial configuration overrides that are merged
 * with the current (or default) configuration before persisting.
 *
 * @param config - Optional partial overrides to merge into the current config.
 *
 * @example
 * // Enable with defaults
 * await enableBackgroundSync();
 *
 * // Enable with a shorter interval
 * await enableBackgroundSync({ baseIntervalMinutes: 120 });
 */
export async function enableBackgroundSync(
  config?: Partial<BackgroundSyncConfig>,
): Promise<void> {
  console.log(`${LOG_PREFIX} Enabling background sync`);

  const currentConfig = await getSyncConfig();
  const mergedConfig: BackgroundSyncConfig = {
    ...currentConfig,
    ...config,
    enabled: true,
    endpoints: {
      ...currentConfig.endpoints,
      ...(config?.endpoints || {}),
    },
  };

  await saveSyncConfig(mergedConfig);

  const state = await getSyncState();
  state.enabled = true;
  await saveSyncState(state);

  await scheduleNextSync(mergedConfig, state);

  console.log(`${LOG_PREFIX} Background sync enabled with interval ${mergedConfig.baseIntervalMinutes}min`);
}

/**
 * Disable background sync and clear the scheduling alarm.
 *
 * The persisted state is updated to reflect the disabled status but
 * historical data (sync history, counters) is preserved.
 */
export async function disableBackgroundSync(): Promise<void> {
  console.log(`${LOG_PREFIX} Disabling background sync`);

  const config = await getSyncConfig();
  config.enabled = false;
  await saveSyncConfig(config);

  const state = await getSyncState();
  state.enabled = false;
  state.nextSyncTime = null;
  await saveSyncState(state);

  await chrome.alarms.clear(ALARM_NAMES.BACKGROUND_SYNC);

  console.log(`${LOG_PREFIX} Background sync disabled, alarm cleared`);
}

/**
 * Update sync configuration and reschedule the alarm if necessary.
 *
 * If the `enabled` flag changes as part of the update, the alarm is
 * created or cleared accordingly. If only timing parameters change,
 * the alarm is rescheduled with the new cadence.
 *
 * @param updates - Partial configuration overrides to apply.
 *
 * @example
 * await updateSyncConfig({ baseIntervalMinutes: 360, jitterMinutes: 30 });
 */
export async function updateSyncConfig(
  updates: Partial<BackgroundSyncConfig>,
): Promise<void> {
  console.log(`${LOG_PREFIX} Updating sync config:`, updates);

  const currentConfig = await getSyncConfig();
  const mergedConfig: BackgroundSyncConfig = {
    ...currentConfig,
    ...updates,
    endpoints: {
      ...currentConfig.endpoints,
      ...(updates.endpoints || {}),
    },
  };

  await saveSyncConfig(mergedConfig);

  const state = await getSyncState();

  if (mergedConfig.enabled) {
    state.enabled = true;
    await saveSyncState(state);
    await scheduleNextSync(mergedConfig, state);
  } else {
    state.enabled = false;
    state.nextSyncTime = null;
    await saveSyncState(state);
    await chrome.alarms.clear(ALARM_NAMES.BACKGROUND_SYNC);
  }

  console.log(`${LOG_PREFIX} Config updated successfully`);
}

// ---------------------------------------------------------------------------
// Sync Execution
// ---------------------------------------------------------------------------

/**
 * Main entry point for triggering a sync cycle.
 *
 * Can be invoked by the chrome.alarms callback or manually from the popup.
 * When called manually (`manual = true`), the active-hours check is bypassed.
 *
 * @param manual - If `true`, bypass the active-hours inactivity check.
 *
 * @example
 * // Triggered by alarm
 * await triggerSync();
 *
 * // Triggered by user pressing "Sync Now" in popup
 * await triggerSync(true);
 */
/** In-memory reentrancy guard -- prevents concurrent sync cycles */
let isSyncing = false;

/** Guard to ensure cookie change listener is registered only once */
let cookieListenerRegistered = false;

export async function triggerSync(manual?: boolean, startup?: boolean): Promise<void> {
  console.log(`${LOG_PREFIX} Sync triggered (manual=${!!manual}, startup=${!!startup})`);

  if (isSyncing) {
    console.log(`${LOG_PREFIX} Sync already in progress, skipping`);
    return;
  }

  const precondition = await shouldSyncNow(!!manual, !!startup);
  if (!precondition.canSync) {
    console.log(`${LOG_PREFIX} Sync skipped: ${precondition.reason}`);
    return;
  }

  isSyncing = true;
  try {
    const entry = await executeSyncCycle();
    console.log(
      `${LOG_PREFIX} Sync cycle complete: ${entry.endpointsFetched.length} endpoints, ` +
      `success=${entry.success}, duration=${entry.duration}ms`,
    );
  } catch (error) {
    // executeSyncCycle already increments consecutiveFailures and persists
    // state internally. Only log here to avoid double-counting failures
    // if the error was thrown after state was already saved (e.g. during
    // scheduleNextSync). If state was NOT yet saved (very early throw),
    // the next alarm cycle will re-attempt and track failures properly.
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Sync cycle failed unexpectedly:`, message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Evaluate all preconditions that must be true before a sync cycle can run.
 *
 * Checks, in order:
 * 1. Sync is enabled in config.
 * 2. Circuit breaker has not been tripped.
 * 3. User is authenticated to LinkedIn.
 * 4. (Non-manual/non-startup only) User has been active within the last 2 hours.
 * 5. (Non-startup only) At least 30 minutes have elapsed since the last sync.
 *
 * @param manual - Whether this is a manual (user-initiated) sync request.
 * @param startup - Whether this is a browser startup sync (bypasses interval + active-hours checks).
 * @returns An object indicating whether sync can proceed, with a reason if not.
 */
async function shouldSyncNow(
  manual: boolean,
  startup: boolean = false,
): Promise<{ canSync: boolean; reason?: string }> {
  const config = await getSyncConfig();
  const state = await getSyncState();

  // 1. Must be enabled
  if (!config.enabled) {
    return { canSync: false, reason: 'Sync disabled' };
  }

  // 2. Circuit breaker
  if (state.circuitBreakerTripped) {
    return { canSync: false, reason: 'Circuit breaker tripped' };
  }

  // 3. LinkedIn authentication
  const authenticated = await isLinkedInAuthenticated();
  if (!authenticated) {
    return { canSync: false, reason: 'Not authenticated' };
  }

  // 4. Active hours (skip for manual and startup triggers)
  if (!manual && !startup && config.activeHoursOnly) {
    try {
      const activityResult = await chrome.storage.local.get('last_user_activity');
      const lastActivity = activityResult.last_user_activity as number | undefined;

      // If activity data was never written, allow sync to proceed rather
      // than permanently blocking. Only block if there IS data showing
      // the user has been inactive for too long.
      if (lastActivity && (Date.now() - lastActivity) > INACTIVE_THRESHOLD_MS) {
        return { canSync: false, reason: 'User inactive' };
      }
    } catch {
      // If we cannot read activity data, allow the sync to proceed
      console.warn(`${LOG_PREFIX} Could not read user activity timestamp, proceeding`);
    }
  }

  // 5. Minimum interval guard (skip for startup — user just opened Chrome,
  //    we want fresh data regardless of when the last sync ran)
  if (!startup && state.lastSyncTime && (Date.now() - state.lastSyncTime < MIN_SYNC_INTERVAL_MS)) {
    return { canSync: false, reason: 'Too soon since last sync (30 min minimum)' };
  }

  return { canSync: true };
}

/**
 * Execute a full sync cycle: select endpoints, fetch data, process results.
 *
 * The cycle follows this sequence for each selected endpoint:
 * 1. Wait a random 1--4 second delay to mimic human browsing cadence.
 * 2. Call {@link fetchEndpoint} with the appropriate profile identifiers.
 * 3. On success, process and store the response data.
 * 4. On failure, record the error and continue to the next endpoint.
 *
 * After all endpoints are processed, a {@link SyncHistoryEntry} is created,
 * the runtime state is updated, and the next alarm is scheduled.
 *
 * @returns The completed history entry summarising the cycle.
 */
async function executeSyncCycle(): Promise<SyncHistoryEntry> {
  const cycleStart = Date.now();
  const config = await getSyncConfig();
  const state = await getSyncState();

  // Gather profile identifiers needed for endpoint URL templates
  let profileInfo = await getStoredProfileInfo();

  // Bootstrap: if no profile info is stored, fetch the current user's profile
  // via the /me endpoint (requires only authentication, no identifiers).
  if (!profileInfo?.profileUrn && !profileInfo?.publicIdentifier) {
    console.log(`${LOG_PREFIX} No stored profile — bootstrapping via /me endpoint`);
    try {
      const meResult = await fetchCurrentUserProfile();
      if (meResult.success && meResult.data) {
        await processProfileData(meResult.data);
        // Re-read the stored profile after processing
        profileInfo = await getStoredProfileInfo();
        console.log(
          `${LOG_PREFIX} Bootstrap complete: profileUrn=${profileInfo?.profileUrn ?? 'none'}, ` +
          `publicId=${profileInfo?.publicIdentifier ?? 'none'}`,
        );
      } else {
        console.warn(`${LOG_PREFIX} Bootstrap /me failed: ${meResult.error}`);
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} Bootstrap /me threw:`, error);
    }
  }

  const profileUrn = profileInfo?.profileUrn;
  const publicIdentifier = profileInfo?.publicIdentifier;

  // Determine which endpoints to fetch this cycle
  const endpoints = selectEndpoints(config, state, profileUrn, publicIdentifier);

  console.log(
    `${LOG_PREFIX} Executing sync cycle: endpoints=[${endpoints.join(',')}], ` +
    `profileUrn=${profileUrn ?? 'none'}, publicId=${publicIdentifier ?? 'none'}`,
  );

  // If no endpoints are feasible (e.g. fresh install with no stored profile),
  // return a no-op history entry without incrementing failure counters.
  if (endpoints.length === 0) {
    console.log(`${LOG_PREFIX} No feasible endpoints to sync — skipping cycle`);

    const noOpEntry: SyncHistoryEntry = {
      timestamp: cycleStart,
      endpointsFetched: [],
      success: true,
      errors: [],
      duration: Date.now() - cycleStart,
      apiCallCount: 0,
    };

    state.lastSyncTime = Date.now();
    state.syncHistory.push(noOpEntry);
    if (state.syncHistory.length > MAX_HISTORY_ENTRIES) {
      state.syncHistory = state.syncHistory.slice(-MAX_HISTORY_ENTRIES);
    }
    await saveSyncState(state);
    await scheduleNextSync(config, state);

    return noOpEntry;
  }

  const results: SyncResult[] = [];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    // Intra-request delay: random 1-4 seconds to mimic human browsing
    const delay = getIntraRequestDelay();
    console.log(`${LOG_PREFIX} Waiting ${delay}ms before fetching ${endpoint}`);
    await sleep(delay);

    try {
      // Use paginated fetch for myPosts to capture ALL historical posts
      const result = endpoint === 'myPosts' && profileUrn
        ? await fetchAllMyPosts(profileUrn)
        : await fetchEndpoint(endpoint, profileUrn, publicIdentifier);

      if (result.success && result.data) {
        // Process and store the fetched data
        await processEndpointData(endpoint, result.data);

        results.push({
          endpoint,
          success: true,
          dataSize: JSON.stringify(result.data).length,
          timestamp: Date.now(),
        });

        // Update per-endpoint tracking
        state.endpointLastSync[endpoint] = Date.now();
        state.endpointLastSuccess[endpoint] = true;

        console.log(`${LOG_PREFIX} Endpoint ${endpoint} synced successfully`);
      } else {
        // Creator-only endpoints returning 404 means the user isn't a
        // creator — skip gracefully without counting as a failure.
        if (result.status === 404 && CREATOR_ONLY_ENDPOINTS.has(endpoint)) {
          console.log(
            `${LOG_PREFIX} Endpoint ${endpoint} returned 404 (creator-only) — skipping`,
          );
          results.push({
            endpoint,
            success: true, // treat as non-failure
            timestamp: Date.now(),
          });
          state.endpointLastSync[endpoint] = Date.now();
          state.endpointLastSuccess[endpoint] = true;
          continue;
        }

        const errorMsg = result.error || `Failed to fetch ${endpoint}`;
        errors.push(errorMsg);

        results.push({
          endpoint,
          success: false,
          error: errorMsg,
          timestamp: Date.now(),
        });

        state.endpointLastSync[endpoint] = Date.now();
        state.endpointLastSuccess[endpoint] = false;

        console.warn(`${LOG_PREFIX} Endpoint ${endpoint} failed: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : `Unknown error fetching ${endpoint}`;
      errors.push(errorMsg);

      results.push({
        endpoint,
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
      });

      console.error(`${LOG_PREFIX} Endpoint ${endpoint} threw:`, error);
    }
  }

  // Build the history entry
  const cycleEnd = Date.now();
  const allSucceeded = results.length > 0 && results.every((r) => r.success);
  const anySucceeded = results.some((r) => r.success);

  const historyEntry: SyncHistoryEntry = {
    timestamp: cycleStart,
    endpointsFetched: endpoints,
    success: allSucceeded,
    errors,
    duration: cycleEnd - cycleStart,
    apiCallCount: results.length,
  };

  // Update runtime state
  state.lastSyncTime = cycleEnd;
  state.lastSyncSuccess = allSucceeded;
  state.totalSyncs += 1;
  state.totalApiCalls += results.length;

  if (allSucceeded) {
    state.consecutiveFailures = 0;
    state.lastError = null;
  } else if (!anySucceeded) {
    // Complete failure -- increment consecutive failures
    state.consecutiveFailures += 1;
    state.lastError = errors[0] || 'All endpoints failed';

    // Trip circuit breaker if threshold exceeded
    if (state.consecutiveFailures >= config.maxConsecutiveFailures) {
      state.circuitBreakerTripped = true;
      console.warn(
        `${LOG_PREFIX} Circuit breaker tripped after ${state.consecutiveFailures} consecutive failures`,
      );
    }
  } else {
    // Partial success -- reset consecutive failures but record the error
    state.consecutiveFailures = 0;
    state.lastError = errors[0] || null;
  }

  // Trim history to the most recent entries
  state.syncHistory.push(historyEntry);
  if (state.syncHistory.length > MAX_HISTORY_ENTRIES) {
    state.syncHistory = state.syncHistory.slice(-MAX_HISTORY_ENTRIES);
  }

  await saveSyncState(state);

  // Schedule the next alarm
  await scheduleNextSync(config, state);

  return historyEntry;
}

/**
 * Select which endpoints should be fetched during this sync cycle.
 *
 * Selection strategy:
 * - Only enabled endpoints (from config.endpoints) are candidates.
 * - Endpoints are sorted by their last sync time (oldest first, never-synced
 *   endpoints have the highest priority).
 * - At most `config.maxApiCallsPerSync` endpoints are returned.
 * - If the user's profile URN is unavailable, only endpoints that do not
 *   require it (`profile` and `profileViews`) are selected.
 *
 * @param config - The current sync configuration.
 * @param state - The current sync runtime state.
 * @param profileUrn - The user's LinkedIn profile URN, if available.
 * @param publicIdentifier - The user's LinkedIn public identifier, if available.
 * @returns An ordered array of endpoint types to fetch.
 */
function selectEndpoints(
  config: BackgroundSyncConfig,
  state: BackgroundSyncState,
  profileUrn?: string,
  publicIdentifier?: string,
): SyncEndpointType[] {
  const allEndpoints: SyncEndpointType[] = [
    'analytics',
    'profile',
    'audience',
    'myPosts',
    'profileViews',
    'networkInfo',
  ];

  // Filter to only enabled endpoints
  const enabled = allEndpoints.filter(
    (ep) => config.endpoints[ep],
  );

  // Filter out endpoints whose required identifiers are unavailable
  const feasible = enabled.filter((ep) => {
    if (ENDPOINTS_REQUIRING_PROFILE_URN.has(ep) && !profileUrn) {
      console.log(`${LOG_PREFIX} Skipping '${ep}': profileUrn not available`);
      return false;
    }
    if (ENDPOINTS_REQUIRING_PUBLIC_ID.has(ep) && !publicIdentifier) {
      console.log(`${LOG_PREFIX} Skipping '${ep}': publicIdentifier not available`);
      return false;
    }
    return true;
  });

  // Sort by last sync time -- oldest (or never-synced) first
  const sorted = [...feasible].sort((a, b) => {
    const aTime = state.endpointLastSync[a] ?? 0;
    const bTime = state.endpointLastSync[b] ?? 0;
    return aTime - bTime;
  });

  // Limit to max calls per cycle
  const selected = sorted.slice(0, config.maxApiCallsPerSync);

  return selected;
}

/**
 * Retrieve the user's LinkedIn profile URN and public identifier from
 * the stored profile data in chrome.storage.local.
 *
 * These values are populated by the existing AUTO_CAPTURE_PROFILE handler
 * and are needed to construct Voyager API URLs for analytics, audience,
 * and myPosts endpoints.
 *
 * @returns An object with `profileUrn` and `publicIdentifier`, or `null`
 *          if no profile data has been stored yet.
 */
async function getStoredProfileInfo(): Promise<{
  profileUrn?: string;
  publicIdentifier?: string;
} | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
    const profile = result[STORAGE_KEYS.PROFILE] as Record<string, unknown> | undefined;

    if (!profile) {
      console.log(`${LOG_PREFIX} No stored profile data found`);
      return null;
    }

    // The profile object may store the URN under several possible field names
    let profileUrn = (
      profile.memberUrn ||
      profile.profileUrn ||
      profile.entityUrn ||
      profile.profile_urn
    ) as string | undefined;

    const publicIdentifier = (
      profile.publicIdentifier ||
      profile.public_identifier ||
      profile.linkedin_id
    ) as string | undefined;

    // Normalize URN format: the /me endpoint returns urn:li:fs_miniProfile:...
    // but analytics/audience/myPosts endpoints require urn:li:fsd_profile:...
    // The member ID suffix (e.g. ACoAAEh4nZsB...) is identical across formats.
    if (profileUrn && !profileUrn.includes('fsd_profile')) {
      const memberId = profileUrn.split(':').pop();
      if (memberId) {
        const normalized = `urn:li:fsd_profile:${memberId}`;
        console.log(`${LOG_PREFIX} Normalized URN: ${profileUrn} → ${normalized}`);
        profileUrn = normalized;
      }
    }

    return { profileUrn, publicIdentifier };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read stored profile info:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Data Processing
// ---------------------------------------------------------------------------

/**
 * Route fetched endpoint data to the appropriate processor.
 *
 * @param endpoint - The endpoint type that was fetched.
 * @param data - The raw Voyager API response payload.
 */
async function processEndpointData(
  endpoint: SyncEndpointType,
  data: unknown,
): Promise<void> {
  switch (endpoint) {
    case 'analytics':
      await processAnalyticsData(data);
      break;
    case 'profile':
      await processProfileData(data);
      break;
    case 'audience':
      await processAudienceData(data);
      break;
    case 'myPosts':
      await processMyPostsData(data);
      break;
    case 'profileViews':
      await processProfileViewsData(data);
      break;
    case 'networkInfo':
      await processNetworkInfoData(data);
      break;
    default:
      console.warn(`${LOG_PREFIX} Unknown endpoint type: ${endpoint}`);
  }
}

/**
 * Process and store analytics data from the Voyager creator analytics endpoint.
 *
 * Mirrors the field mapping and storage pattern used by the existing
 * `AUTO_CAPTURE_CREATOR_ANALYTICS` handler in the service worker, saving
 * to the `'linkedin_analytics'` chrome.storage.local key.
 *
 * @param data - Raw response from the analytics Voyager endpoint.
 */
async function processAnalyticsData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} Analytics: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;

    // Voyager returns normalized responses: extract analytics from `included` array
    const included = Array.isArray(raw.included)
      ? raw.included as Record<string, unknown>[]
      : [];

    // Find the analytics entity in the included array
    let analyticsEntity: Record<string, unknown> = raw;
    if (included.length > 0) {
      const analyticsItem = included.find((item) => {
        const type = ((item.$type || '') as string).toLowerCase();
        return type.includes('analytics') || type.includes('creatoranalytics');
      });
      if (analyticsItem) {
        analyticsEntity = analyticsItem;
      }
    }

    // Also check top-level elements array
    const elements = Array.isArray(raw.elements)
      ? raw.elements as Record<string, unknown>[]
      : [];
    if (elements.length > 0 && analyticsEntity === raw) {
      analyticsEntity = elements[0] as Record<string, unknown>;
    }

    // Calculate engagements from available fields
    const impressions = Number(analyticsEntity.impressions ?? 0);
    const engagements = Number(analyticsEntity.engagements ?? 0);
    const engagementRate = impressions > 0
      ? Number(((engagements / impressions) * 100).toFixed(2))
      : 0;

    // Read existing analytics to merge with (preserves profileViews data)
    const existing = await chrome.storage.local.get(STORAGE_KEYS.ANALYTICS);
    const existingAnalytics = (existing[STORAGE_KEYS.ANALYTICS] as Record<string, unknown>) || {};

    const dataToSave = {
      ...existingAnalytics,
      ...analyticsEntity,
      impressions,
      engagements,
      members_reached: Number(
        analyticsEntity.membersReached ?? analyticsEntity.members_reached ?? 0,
      ),
      new_followers: Number(
        analyticsEntity.newFollowers ?? analyticsEntity.new_followers ?? 0,
      ),
      engagement_rate: engagementRate,
      page_type: 'creator_analytics',
      source: 'background_sync',
      captured_at: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      raw_data: data,
    };

    await saveWithSync(STORAGE_KEYS.ANALYTICS, dataToSave as Record<string, unknown>);
    console.log(`${LOG_PREFIX} Analytics data saved + queued for Supabase (impressions=${impressions})`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process analytics data:`, error);
  }
}

/**
 * Extract a usable profile picture URL from LinkedIn's nested picture object.
 * LinkedIn stores profile pictures as a vectorImage with rootUrl + artifact segments.
 * We pick the 200x200 artifact (or fallback to any available).
 */
function extractProfilePictureUrl(entity: Record<string, unknown>): string | null {
  try {
    // Check if it's already a plain string URL
    const existing = entity.profile_picture_url ?? entity.profilePictureUrl;
    if (typeof existing === 'string' && existing.startsWith('http')) return existing;

    // Navigate LinkedIn's nested picture structure
    // WebTopCardCore uses `profilePicture`, miniProfile uses `picture`
    const picture = (entity.profilePicture ?? entity.profilePhoto ?? entity.picture) as Record<string, unknown> | undefined;
    if (!picture || typeof picture !== 'object') return null;

    const displayRef = picture.displayImageReference as Record<string, unknown> | undefined;
    const vectorImage = displayRef?.vectorImage as Record<string, unknown> | undefined;
    // miniProfile `picture` has rootUrl and artifacts directly (no displayImageReference)
    const effectiveVector = vectorImage ?? (picture.rootUrl ? picture : null) as Record<string, unknown> | null;
    if (!effectiveVector) return null;

    const rootUrl = effectiveVector.rootUrl as string | undefined;
    const artifacts = effectiveVector.artifacts as Array<Record<string, unknown>> | undefined;
    if (!rootUrl || !artifacts?.length) return null;

    // Prefer 200x200, fallback to first artifact
    const preferred = artifacts.find(a => a.width === 200 && a.height === 200) ?? artifacts[0];
    const segment = preferred?.fileIdentifyingUrlPathSegment as string | undefined;
    if (!segment) return null;

    return `${rootUrl}${segment}`;
  } catch {
    return null;
  }
}

/**
 * Process and store profile data from the Voyager profile endpoint.
 *
 * Mirrors the field mapping and storage pattern used by the existing
 * `AUTO_CAPTURE_PROFILE` handler in the service worker, saving to the
 * `'linkedin_profile'` chrome.storage.local key.
 *
 * @param data - Raw response from the profile Voyager endpoint.
 */
async function processProfileData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} Profile: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;

    // Extract profile fields, accommodating LinkedIn's nested response structures
    const included = Array.isArray(raw.included) ? raw.included as Record<string, unknown>[] : [];
    let profileEntity = raw;

    // LinkedIn profile responses have the main profile entity in the included array.
    // Match on specific profile types to avoid picking up Photo/Privacy entities.
    if (included.length > 0) {
      const profileItem = included.find((item) => {
        const type = ((item.$type || '') as string).toLowerCase();
        // Match main profile entities — exclude photo, privacy, edit config, etc.
        return (
          type.includes('topcardcore') ||
          type.includes('fullprofile') ||
          type.includes('miniprofile') ||
          type.includes('webtopcardcore')
        );
      }) ?? included.find((item) => {
        // Fallback: match entity that has firstName or publicIdentifier (concrete profile data)
        return (
          item.firstName !== undefined ||
          item.first_name !== undefined ||
          item.publicIdentifier !== undefined
        );
      });
      if (profileItem) {
        profileEntity = profileItem;
      }
    }

    const followersCount = Number(
      profileEntity.followers_count ??
      profileEntity.followerCount ??
      (profileEntity as { followersCount?: number }).followersCount ?? 0,
    );

    const connectionsCount = Number(
      profileEntity.connections_count ??
      profileEntity.connectionCount ??
      (profileEntity as { connectionsCount?: number }).connectionsCount ?? 0,
    );

    // Split full name into first/last if not already provided
    const rawFirstName = (
      profileEntity.first_name ??
      (profileEntity as { firstName?: string }).firstName ?? ''
    ) as string;
    const rawLastName = (
      profileEntity.last_name ??
      (profileEntity as { lastName?: string }).lastName ?? ''
    ) as string;
    const fullName = (
      profileEntity.full_name ??
      (profileEntity as { fullName?: string }).fullName ??
      profileEntity.name ?? ''
    ) as string;

    let firstName = rawFirstName;
    let lastName = rawLastName;
    if (!firstName && !lastName && fullName) {
      const nameParts = fullName.trim().split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    const extractedPictureUrl = extractProfilePictureUrl(profileEntity);

    const dataToSave = {
      ...profileEntity,
      followers_count: followersCount,
      connections_count: connectionsCount,
      followerCount: followersCount,
      connectionCount: connectionsCount,
      linkedin_id: (
        profileEntity.linkedin_id ??
        (profileEntity as { linkedinId?: string }).linkedinId ??
        profileEntity.publicIdentifier
      ),
      first_name: firstName,
      last_name: lastName,
      full_name: fullName || `${firstName} ${lastName}`.trim(),
      profile_url: (
        profileEntity.profile_url ??
        (profileEntity as { profileUrl?: string }).profileUrl
      ),
      profile_picture_url: extractedPictureUrl,
      source: 'background_sync',
      captured_at: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    // Remove nested picture/background objects that would bloat the sync data
    // and confuse the Supabase sync bridge column mapping.
    const keysToRemove = [
      'profilePicture', 'profilePhoto', 'backgroundPicture',
      'picture', 'backgroundImage',
    ];
    for (const key of keysToRemove) {
      delete (dataToSave as Record<string, unknown>)[key];
    }

    await saveWithSync(STORAGE_KEYS.PROFILE, dataToSave as Record<string, unknown>);
    console.log(
      `${LOG_PREFIX} Profile data saved + queued for Supabase (name=${dataToSave.full_name}, ` +
      `followers=${followersCount})`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process profile data:`, error);
  }
}

/**
 * Process and store audience data from the Voyager audience analytics endpoint.
 *
 * Mirrors the field mapping and storage pattern used by the existing
 * `AUTO_CAPTURE_AUDIENCE` handler in the service worker, saving to the
 * `'linkedin_audience'` chrome.storage.local key.
 *
 * @param data - Raw response from the audience Voyager endpoint.
 */
async function processAudienceData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} Audience: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;

    // Voyager returns normalized responses: extract audience entity from `included`
    const included = Array.isArray(raw.included)
      ? raw.included as Record<string, unknown>[]
      : [];

    let audienceEntity: Record<string, unknown> = raw;
    if (included.length > 0) {
      const audienceItem = included.find((item) => {
        const type = ((item.$type || '') as string).toLowerCase();
        return type.includes('audience') || type.includes('follower');
      });
      if (audienceItem) {
        audienceEntity = audienceItem;
      }
    }

    // Also check top-level elements array
    const elements = Array.isArray(raw.elements)
      ? raw.elements as Record<string, unknown>[]
      : [];
    if (elements.length > 0 && audienceEntity === raw) {
      audienceEntity = elements[0] as Record<string, unknown>;
    }

    const dataToSave = {
      ...audienceEntity,
      totalFollowers: Number(
        audienceEntity.totalFollowers ??
        audienceEntity.total_followers ?? 0,
      ),
      followerGrowth: Number(
        audienceEntity.followerGrowth ??
        audienceEntity.follower_growth ?? 0,
      ),
      newFollowers: Number(audienceEntity.newFollowers ?? 0),
      topLocations: audienceEntity.topLocations ?? audienceEntity.top_locations,
      topIndustries: audienceEntity.topIndustries ?? audienceEntity.top_industries,
      topJobTitles: audienceEntity.topJobTitles ?? audienceEntity.top_job_titles,
      topCompanies: audienceEntity.topCompanies ?? audienceEntity.top_companies,
      source: 'background_sync',
      lastUpdated: new Date().toISOString(),
      raw_data: data,
    };

    await saveWithSync(STORAGE_KEYS.AUDIENCE, dataToSave as Record<string, unknown>);
    console.log(
      `${LOG_PREFIX} Audience data saved + queued for Supabase (followers=${dataToSave.totalFollowers})`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process audience data:`, error);
  }
}

/**
 * Process and store the user's own posts from the Voyager profile updates endpoint.
 *
 * Mirrors the deduplication and storage pattern used by the existing
 * `AUTO_CAPTURE_API` handler for myPosts in the service worker, saving
 * to the `'linkedin_my_posts'` chrome.storage.local key.
 *
 * Posts are deduplicated by `activity_urn` and capped at the most recent 500 locally.
 * All posts are also synced to Supabase where they persist indefinitely.
 *
 * @param data - Raw response from the myPosts Voyager endpoint.
 */
async function processMyPostsData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} MyPosts: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;

    // Read existing posts from storage
    const existing = await chrome.storage.local.get(STORAGE_KEYS.MY_POSTS);
    const existingPosts: Record<string, unknown>[] = Array.isArray(existing[STORAGE_KEYS.MY_POSTS])
      ? existing[STORAGE_KEYS.MY_POSTS] as Record<string, unknown>[]
      : [];

    // Extract new posts from the API response (from included/elements arrays)
    const allExtracted = extractBasicPosts(raw);

    // ── Verify post ownership ──
    // Read the stored profile URN and filter out posts by other users.
    // The myPosts endpoint should only return the current user's posts,
    // but reposts and feed contamination can cause foreign posts to slip in.
    const storedProfile = await getStoredProfileInfo();
    const myUrn = storedProfile?.profileUrn || '';

    const newPosts = myUrn
      ? allExtracted.filter((post) => {
          const actorUrn = (post.actor_urn as string) || '';
          // If we can't determine the actor, keep it (benefit of the doubt)
          if (!actorUrn) return true;
          // Check if the actor URN contains the user's member ID
          // LinkedIn URNs: urn:li:fsd_profile:XXX or urn:li:member:XXX
          const myId = myUrn.split(':').pop() || '';
          return actorUrn.includes(myId);
        })
      : allExtracted;

    if (newPosts.length !== allExtracted.length) {
      console.log(
        `${LOG_PREFIX} MyPosts: filtered out ${allExtracted.length - newPosts.length} foreign posts ` +
        `(kept ${newPosts.length}/${allExtracted.length})`,
      );
    }

    if (newPosts.length === 0) {
      console.log(`${LOG_PREFIX} MyPosts: no posts extracted from response`);
      return;
    }

    // Deduplicate by activity_urn, updating stale entries.
    // Track which posts had metric changes so we can re-sync them to Supabase.
    const postMap = new Map<string, Record<string, unknown>>();
    for (const post of existingPosts) {
      const urn = post.activity_urn as string;
      if (urn) {
        postMap.set(urn, post);
      }
    }
    const updatedPosts: Record<string, unknown>[] = [];
    for (const post of newPosts) {
      const urn = post.activity_urn as string;
      if (urn) {
        const existing = postMap.get(urn);
        if (existing) {
          // Check if any metrics changed before merging
          const metricsChanged =
            Number(post.impressions ?? 0) !== Number(existing.impressions ?? 0) ||
            Number(post.reactions ?? 0) !== Number(existing.reactions ?? 0) ||
            Number(post.comments ?? 0) !== Number(existing.comments ?? 0) ||
            Number(post.reposts ?? 0) !== Number(existing.reposts ?? 0);

          // Merge: preserve fields from existing entry if the new value is null
          const merged = {
            ...existing,
            ...post,
            posted_at: post.posted_at ?? existing.posted_at,
            media_type: post.media_type !== 'text' ? post.media_type : (existing.media_type ?? 'text'),
          };
          postMap.set(urn, merged);

          if (metricsChanged) {
            updatedPosts.push(merged);
          }
        } else {
          postMap.set(urn, post);
        }
      }
    }

    // Convert back to array, sort by posted date (newest first), and trim.
    // Keep 500 posts locally so metrics stay updated for older posts.
    // All posts are also synced to Supabase where they persist forever.
    const mergedPosts = Array.from(postMap.values())
      .sort((a, b) => {
        const aTime = Number(a.posted_at ?? a.capturedAt ?? 0);
        const bTime = Number(b.posted_at ?? b.capturedAt ?? 0);
        return bTime - aTime;
      })
      .slice(0, 500);

    // Save to local storage
    await chrome.storage.local.set({ [STORAGE_KEYS.MY_POSTS]: mergedPosts });

    // Queue each NEW post individually for Supabase sync (the bridge only
    // processes the first element when given an array, so we queue per-post).
    for (const post of newPosts) {
      await queueForSync(STORAGE_KEYS.MY_POSTS, post as Record<string, unknown>);
    }
    // Also queue existing posts whose metrics changed (impressions, reactions, etc.)
    for (const post of updatedPosts) {
      await queueForSync(STORAGE_KEYS.MY_POSTS, post as Record<string, unknown>);
    }

    // Also queue per-post analytics to the post_analytics table so the
    // analytics pipeline can pick them up. This ensures post-level metrics
    // are captured even without the user visiting individual post pages.
    const POST_ANALYTICS_KEY = 'linkedin_post_analytics';
    const allPostsToSync = [...newPosts, ...updatedPosts];
    for (const post of allPostsToSync) {
      const urn = (post.activity_urn || post.activityUrn) as string;
      const hasMetrics = Number(post.impressions ?? 0) > 0 ||
        Number(post.reactions ?? 0) > 0 ||
        Number(post.comments ?? 0) > 0 ||
        Number(post.reposts ?? 0) > 0;

      if (urn && hasMetrics) {
        // Only include fields with actual values — omit zeros so the upsert
        // doesn't overwrite richer DOM-scraped data (engagement_rate, members_reached,
        // profile_viewers, followers_gained) with empty background sync values.
        const flatAnalytics: Record<string, unknown> = {
          activityUrn: urn,
          impressions: Number(post.impressions ?? 0),
          reactions: Number(post.reactions ?? 0),
          comments: Number(post.comments ?? 0),
          reposts: Number(post.reposts ?? 0),
          source: 'background_sync',
          extractedAt: new Date().toISOString(),
        };
        // Only include DOM-only fields if they have non-zero values
        const mr = Number(post.members_reached ?? post.membersReached ?? 0);
        const er = Number(post.engagement_rate ?? post.engagementRate ?? 0);
        const pv = Number(post.profile_viewers ?? post.profileViewers ?? 0);
        const fg = Number(post.followers_gained ?? post.followersGained ?? 0);
        const sv = Number(post.saves ?? post.saveCount ?? 0);
        const sn = Number(post.sends ?? post.sendCount ?? 0);
        if (mr > 0) flatAnalytics.membersReached = mr;
        if (er > 0) flatAnalytics.engagementRate = er;
        if (pv > 0) flatAnalytics.profileViewers = pv;
        if (fg > 0) flatAnalytics.followersGained = fg;
        if (sv > 0) flatAnalytics.saveCount = sv;
        if (sn > 0) flatAnalytics.sendCount = sn;

        await queueForSync(POST_ANALYTICS_KEY, flatAnalytics);
      }
    }
    console.log(
      `${LOG_PREFIX} Queued ${allPostsToSync.filter(p => {
        const hasM = Number(p.impressions ?? 0) > 0 || Number(p.reactions ?? 0) > 0 ||
          Number(p.comments ?? 0) > 0 || Number(p.reposts ?? 0) > 0;
        return (p.activity_urn || p.activityUrn) && hasM;
      }).length} posts to post_analytics table`,
    );

    // ── Fetch detailed per-post analytics from dashPostAnalytics ──
    // The myPosts GraphQL endpoint only provides basic social counts
    // (impressions, reactions, comments, reposts). The dashPostAnalytics
    // Voyager endpoint provides richer metrics: engagement_rate,
    // members_reached (memberReach), unique_views, click_count.
    // We fetch these for each known post and merge them into post_analytics.
    const MAX_PER_POST_FETCHES = 10; // Rate-limit: max 10 per sync cycle
    const allUrns = mergedPosts
      .map(p => (p.activity_urn || p.activityUrn) as string)
      .filter(Boolean)
      .slice(0, MAX_PER_POST_FETCHES);

    let detailedFetchCount = 0;
    for (const activityUrn of allUrns) {
      try {
        const result = await fetchPostDetailedAnalytics(activityUrn);
        if (!result.success || !result.data) {
          // Non-creator accounts or posts without analytics return 404 — skip
          if (result.status === 404) continue;
          console.warn(`${LOG_PREFIX} dashPostAnalytics failed for ${activityUrn}: ${result.error}`);
          // Stop fetching on auth errors or rate limits to avoid tripping circuit breaker
          if (result.status === 401 || result.status === 403 || result.status === 429 || result.status === 999) break;
          continue;
        }

        const rawAnalytics = result.data as Record<string, unknown>;

        // The dashPostAnalytics response may be nested in `elements` array
        let analyticsData = rawAnalytics;
        if (Array.isArray(rawAnalytics.elements) && (rawAnalytics.elements as Record<string, unknown>[]).length > 0) {
          analyticsData = (rawAnalytics.elements as Record<string, unknown>[])[0];
        }

        const impressionCount = Number(analyticsData.impressionCount ?? 0);
        const uniqueImpressionCount = Number(analyticsData.uniqueImpressionCount ?? 0);
        const memberReach = Number(analyticsData.memberReach ?? 0);
        const likeCount = Number(analyticsData.likeCount ?? 0);
        const commentCount = Number(analyticsData.commentCount ?? 0);
        const shareCount = Number(analyticsData.shareCount ?? 0);
        const saveCount = Number(analyticsData.saveCount ?? 0);
        const sendCount = Number(analyticsData.sendCount ?? 0);
        const engagementRate = Number(analyticsData.engagementRate ?? 0);
        const clickCount = Number(analyticsData.clickCount ?? 0);

        // Only queue if we got meaningful data
        if (impressionCount > 0 || memberReach > 0 || engagementRate > 0) {
          const detailedAnalytics: Record<string, unknown> = {
            activityUrn,
            impressions: impressionCount,
            reactions: likeCount,
            comments: commentCount,
            reposts: shareCount,
            source: 'background_sync_detailed',
            extractedAt: new Date().toISOString(),
          };
          // Include enriched fields only when non-zero
          if (uniqueImpressionCount > 0) detailedAnalytics.uniqueViews = uniqueImpressionCount;
          if (memberReach > 0) detailedAnalytics.membersReached = memberReach;
          if (engagementRate > 0) detailedAnalytics.engagementRate = engagementRate;
          if (clickCount > 0) detailedAnalytics.clickCount = clickCount;
          if (saveCount > 0) detailedAnalytics.saveCount = saveCount;
          if (sendCount > 0) detailedAnalytics.sendCount = sendCount;

          await queueForSync(POST_ANALYTICS_KEY, detailedAnalytics);
          detailedFetchCount++;
        }

        // Small delay between requests to avoid rate-limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`${LOG_PREFIX} Error fetching detailed analytics for ${activityUrn}:`, err);
      }
    }
    if (detailedFetchCount > 0) {
      console.log(`${LOG_PREFIX} Enriched ${detailedFetchCount}/${allUrns.length} posts with detailed analytics (dashPostAnalytics)`);
    }

    // Trigger sync for all queued posts to Supabase, then reconcile
    // deleted posts within the window LinkedIn returned.
    setTimeout(async () => {
      try {
        const result = await processPendingChanges();
        console.log(`${LOG_PREFIX} Supabase sync: ${result.success} success, ${result.failed} failed`);

        // Reconcile deleted posts: only within the date window LinkedIn returned.
        // Posts OLDER than the oldest returned post are preserved in Supabase —
        // we can't tell if they were deleted or just fell off the API pagination.
        const currentUrns = new Set<string>();
        let oldestDate: string | undefined;
        for (const post of mergedPosts) {
          const urn = post.activity_urn as string;
          if (urn) currentUrns.add(urn);
          const postedAt = post.posted_at as string | undefined;
          if (postedAt && (!oldestDate || postedAt < oldestDate)) {
            oldestDate = postedAt;
          }
        }
        await reconcilePosts('my_posts', currentUrns, oldestDate);
      } catch (err) {
        console.error(`${LOG_PREFIX} Supabase sync error:`, err);
      }
    }, 100);

    console.log(
      `${LOG_PREFIX} MyPosts saved: ${newPosts.length} new + ${updatedPosts.length} updated → queued for Supabase (${mergedPosts.length} total)`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process my posts data:`, error);
  }
}

/**
 * Process and store profile views data from the Voyager wvmpCards endpoint.
 *
 * Mirrors the field mapping and merge logic used by the existing
 * `AUTO_CAPTURE_PROFILE_VIEWS` handler in the service worker. The data
 * is merged into the existing `'linkedin_analytics'` key rather than
 * overwriting it, preserving analytics fields from other sources.
 *
 * @param data - Raw response from the profileViews Voyager endpoint.
 */
async function processProfileViewsData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} ProfileViews: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;

    // Read existing analytics to merge with
    const existing = await chrome.storage.local.get(STORAGE_KEYS.ANALYTICS);
    const existingAnalytics = (existing[STORAGE_KEYS.ANALYTICS] as Record<string, unknown>) || {};

    // Extract profile views count from wvmpCards nested structure.
    // The response nests the count at:
    //   included[].value.insightCards[].value.numViews (WvmpSummaryInsightCard)
    //   included[].value.extraProfileViewers (WvmpPremiumUpsellCard)
    let profileViews = 0;

    // First try top-level fields (simpler response formats)
    const viewers = Array.isArray(raw.viewers) ? raw.viewers : [];
    profileViews = Number(
      raw.totalViews ??
      (raw as { profileViews?: number }).profileViews ??
      (raw as { profile_views?: number }).profile_views ??
      0,
    );

    // If zero, parse the nested wvmpCards / included structure
    if (profileViews === 0) {
      const included = Array.isArray(raw.included)
        ? raw.included as Record<string, unknown>[]
        : [];
      // Also check data.included for double-nested responses
      const dataObj = raw.data as Record<string, unknown> | undefined;
      const dataIncluded = dataObj && Array.isArray(dataObj.included)
        ? dataObj.included as Record<string, unknown>[]
        : [];
      const allIncluded = [...included, ...dataIncluded];

      for (const item of allIncluded) {
        if (!item || typeof item !== 'object') continue;
        const value = item.value as Record<string, unknown> | undefined;
        if (!value) continue;

        // Check extraProfileViewers (WvmpPremiumUpsellCard)
        if (typeof value.extraProfileViewers === 'number' && value.extraProfileViewers > 0) {
          profileViews = Math.max(profileViews, value.extraProfileViewers);
        }

        // Check insightCards[].value.numViews (WvmpViewersCard → WvmpSummaryInsightCard)
        const insightCards = Array.isArray(value.insightCards)
          ? value.insightCards as Record<string, unknown>[]
          : [];
        for (const card of insightCards) {
          const cardValue = card?.value as Record<string, unknown> | undefined;
          if (cardValue && typeof cardValue.numViews === 'number') {
            profileViews = Math.max(profileViews, cardValue.numViews);
          }
        }
      }

      // Fallback: check viewers array length
      if (profileViews === 0 && viewers.length > 0) {
        profileViews = viewers.length;
      }
    }

    const searchAppearances = Number(
      (raw as { searchAppearances?: number }).searchAppearances ??
      (raw as { search_appearances?: number }).search_appearances ??
      0,
    );

    const dataToSave = {
      ...existingAnalytics,
      profile_views: profileViews,
      search_appearances: searchAppearances,
      profileViews: profileViews,
      searchAppearances: searchAppearances,
      // page_type is required by the linkedin_analytics table NOT NULL constraint
      page_type: (existingAnalytics.page_type as string) || 'profile_views',
      profileViewsUpdated: new Date().toISOString(),
    };

    await saveWithSync(STORAGE_KEYS.ANALYTICS, dataToSave as Record<string, unknown>);
    console.log(
      `${LOG_PREFIX} Profile views data merged + queued for Supabase (views=${profileViews}, ` +
      `searchAppearances=${searchAppearances})`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process profile views data:`, error);
  }
}

/**
 * Process and store network info (follower/connection counts) from the
 * Voyager dash profile endpoint with TopCardSupplementary-128 decoration.
 *
 * The richer decoration includes `followerCount` and connection data that
 * are NOT included in the lightweight `WebTopCardCore-16` decoration used
 * by the regular `profile` endpoint. The extracted counts are merged into
 * the existing stored profile data and synced to Supabase.
 *
 * @param data - Raw response from the networkInfo Voyager endpoint.
 */
async function processNetworkInfoData(data: unknown): Promise<void> {
  try {
    if (!data || typeof data !== 'object') {
      console.warn(`${LOG_PREFIX} NetworkInfo: invalid data type`);
      return;
    }

    const raw = data as Record<string, unknown>;
    let followersCount = 0;
    let connectionsCount = 0;

    // The TopCardSupplementary-128 decoration returns a normalized profile
    // response with an `included` array containing profile entities, network
    // info entities, and relationship entities.
    const included = Array.isArray(raw.included)
      ? raw.included as Record<string, unknown>[]
      : [];

    console.log(`${LOG_PREFIX} NetworkInfo: ${included.length} included entities`);

    // Build a URN lookup map to resolve *references between entities
    const urnMap = new Map<string, Record<string, unknown>>();
    for (const item of included) {
      if (!item || typeof item !== 'object') continue;
      const urn = (item.entityUrn ?? item.urn ?? '') as string;
      if (urn) urnMap.set(urn, item);
    }

    for (const item of included) {
      if (!item || typeof item !== 'object') continue;
      const type = ((item.$type || '') as string).toLowerCase();

      // FollowingState entities contain followerCount
      if (type.includes('followingstate') || type.includes('following')) {
        const fc = Number(item.followerCount ?? item.followersCount ?? 0);
        if (fc > followersCount) followersCount = fc;
      }

      // Profile entities may include followerCount / connectionCount directly,
      // or a *connections reference to a CollectionResponse with paging.total
      if (type.includes('profile') && !type.includes('photo') && !type.includes('privacy')) {
        const fc = Number(
          item.followerCount ?? item.followersCount ?? item.numFollowers ??
          item.followingCount ?? 0,
        );
        const cc = Number(
          item.connectionCount ?? item.connectionsCount ?? item.numConnections ??
          item.connectionCountBound ?? 0,
        );
        if (fc > followersCount) followersCount = fc;
        if (cc > connectionsCount) connectionsCount = cc;

        // Resolve *connections reference → CollectionResponse.paging.total
        const connectionsRef = item['*connections'] as string | undefined;
        if (connectionsRef) {
          const connEntity = urnMap.get(connectionsRef);
          if (connEntity) {
            const paging = connEntity.paging as Record<string, unknown> | undefined;
            const total = Number(paging?.total ?? paging?.count ?? 0);
            if (total > connectionsCount) {
              connectionsCount = total;
              console.log(`${LOG_PREFIX} NetworkInfo: resolved *connections → paging.total=${total}`);
            }
          }
        }
      }

      // NetworkInfo entities (if present)
      if (type.includes('networkinfo') || type.includes('network')) {
        const fc = Number(
          item.followersCount ?? item.followerCount ?? item.numFollowers ?? 0,
        );
        const cc = Number(
          item.connectionsCount ?? item.connectionCount ?? item.numConnections ??
          item.connectionCountBound ?? 0,
        );
        if (fc > followersCount) followersCount = fc;
        if (cc > connectionsCount) connectionsCount = cc;
      }

      // MemberRelationship entities may include connectionCountBound
      if (type.includes('memberrelationship') || type.includes('relationship')) {
        const cc = Number(
          item.connectionCount ?? item.connectionCountBound ?? item.numConnections ?? 0,
        );
        if (cc > connectionsCount) connectionsCount = cc;
      }

      // CollectionResponse entities may have paging.total for connection count
      if (type.includes('collectionresponse')) {
        const paging = item.paging as Record<string, unknown> | undefined;
        const total = Number(paging?.total ?? 0);
        // Only use if it looks like a connections count (reasonable range)
        if (total > connectionsCount && total < 100000) {
          // We'll prefer the *connections resolved count, but track the max
          // collection total as a fallback for connection count
          connectionsCount = Math.max(connectionsCount, total);
        }
      }

      // Generic scan: any entity with count-like fields
      if (followersCount === 0 || connectionsCount === 0) {
        const fc = Number(item.followerCount ?? item.followersCount ?? item.numFollowers ?? 0);
        const cc = Number(
          item.connectionCount ?? item.connectionsCount ?? item.numConnections ??
          item.connectionCountBound ?? 0,
        );
        if (fc > followersCount) followersCount = fc;
        if (cc > connectionsCount) connectionsCount = cc;
      }
    }

    // Fallback: check top-level fields (simpler response formats)
    if (followersCount === 0) {
      followersCount = Number(
        raw.followersCount ?? raw.followerCount ?? raw.followers_count ??
        raw.numFollowers ?? 0,
      );
    }
    if (connectionsCount === 0) {
      connectionsCount = Number(
        raw.connectionsCount ?? raw.connectionCount ?? raw.connections_count ??
        raw.numConnections ?? 0,
      );
    }

    // Also check elements array
    if (followersCount === 0 && connectionsCount === 0 && Array.isArray(raw.elements)) {
      const elements = raw.elements as Record<string, unknown>[];
      if (elements.length > 0) {
        const el = elements[0] as Record<string, unknown>;
        followersCount = Number(el.followerCount ?? el.followersCount ?? el.numFollowers ?? 0) || followersCount;
        connectionsCount = Number(el.connectionCount ?? el.connectionsCount ?? el.numConnections ?? 0) || connectionsCount;
      }
    }

    console.log(
      `${LOG_PREFIX} NetworkInfo extracted: followers=${followersCount}, connections=${connectionsCount}`,
    );

    // Merge into existing profile data in chrome.storage.local
    const existing = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
    const existingProfile = (existing[STORAGE_KEYS.PROFILE] as Record<string, unknown>) || {};

    const updatedProfile = {
      ...existingProfile,
      // Only overwrite if we got a non-zero value
      followers_count: followersCount || (existingProfile.followers_count as number) || 0,
      connections_count: connectionsCount || (existingProfile.connections_count as number) || 0,
      followerCount: followersCount || (existingProfile.followerCount as number) || 0,
      connectionCount: connectionsCount || (existingProfile.connectionCount as number) || 0,
      networkInfoUpdated: new Date().toISOString(),
    };

    await saveWithSync(STORAGE_KEYS.PROFILE, updatedProfile);
    console.log(
      `${LOG_PREFIX} NetworkInfo merged into profile + queued for Supabase ` +
      `(followers=${updatedProfile.followers_count}, connections=${updatedProfile.connections_count})`,
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to process network info:`, error);
  }
}

// ---------------------------------------------------------------------------
// Post Extraction Helper
// ---------------------------------------------------------------------------

/**
 * Extract media URLs from a LinkedIn post content object.
 *
 * Walks the content structure to find image, video, article, and document
 * URLs from various LinkedIn API response formats (REST and GraphQL).
 *
 * @param contentObj - The resolved content object from the post.
 * @param mediaType - The detected media type (image, video, article, document).
 * @param urnMap - The URN lookup map from the included array.
 * @returns Array of extracted media URLs, or empty array if none found.
 */
export function extractMediaUrls(
  contentObj: Record<string, unknown> | undefined,
  mediaType: string,
  urnMap: Map<string, Record<string, unknown>>
): string[] {
  const urls: string[] = [];
  if (!contentObj || mediaType === 'text') return urls;

  try {
    /**
     * Construct a full image URL from a vectorImage object.
     * LinkedIn stores images as rootUrl + artifact path segment.
     * Picks the largest artifact for best quality.
     */
    const extractVectorImageUrl = (vectorImage: Record<string, unknown>): string | null => {
      const rootUrl = vectorImage.rootUrl as string | undefined;
      const artifacts = vectorImage.artifacts as Array<Record<string, unknown>> | undefined;
      if (!rootUrl) return null;

      if (artifacts && artifacts.length > 0) {
        // Sort by width descending, pick largest
        const sorted = [...artifacts].sort((a, b) =>
          (Number(b.width || 0)) - (Number(a.width || 0))
        );
        const pathSegment = sorted[0].fileIdentifyingUrlPathSegment as string | undefined;
        if (pathSegment) {
          return `${rootUrl}${pathSegment}`;
        }
      }
      // If no artifacts, rootUrl alone might still work
      return rootUrl;
    };

    /**
     * Recursively search an object for vectorImage structures.
     * LinkedIn nests images in various places depending on API version.
     */
    const findVectorImages = (obj: unknown, depth = 0): void => {
      if (depth > 6 || !obj || typeof obj !== 'object') return;
      const record = obj as Record<string, unknown>;

      // Direct vectorImage
      if (record.vectorImage && typeof record.vectorImage === 'object') {
        const url = extractVectorImageUrl(record.vectorImage as Record<string, unknown>);
        if (url && !urls.includes(url)) {
          console.log('[MediaExtract] Found vectorImage URL:', url.substring(0, 80) + '...');
          urls.push(url);
        }
      }

      // Resolve vectorImage URN reference
      if (typeof record['*vectorImage'] === 'string') {
        const resolved = urnMap.get(record['*vectorImage'] as string);
        if (resolved) {
          const url = extractVectorImageUrl(resolved);
          if (url && !urls.includes(url)) {
            console.log('[MediaExtract] Found *vectorImage ref URL:', url.substring(0, 80) + '...');
            urls.push(url);
          }
        }
      }

      // Recurse into arrays and objects
      if (Array.isArray(obj)) {
        for (const item of obj) {
          findVectorImages(item, depth + 1);
        }
      } else {
        for (const value of Object.values(record)) {
          if (value && typeof value === 'object') {
            findVectorImages(value, depth + 1);
          }
        }
      }
    };

    // ── Image extraction ──
    if (mediaType === 'image') {
      // GraphQL: imageComponent.images[].attributes[].vectorImage
      // REST: images[] on the content object itself
      findVectorImages(contentObj);

      // Also check for direct image URL strings
      const imageUrl = contentObj.url as string | undefined;
      if (imageUrl && imageUrl.startsWith('http') && !urls.includes(imageUrl)) {
        urls.push(imageUrl);
      }
    }

    // ── Video extraction ──
    if (mediaType === 'video') {
      // GraphQL: videoComponent.videoPlayMetadata.progressiveStreams[]
      // REST: videoPlayMetadata on content or media object
      const walkForVideo = (obj: unknown, depth = 0): void => {
        if (depth > 6 || !obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;

        // Progressive streams (main video source)
        if (Array.isArray(record.progressiveStreams)) {
          const streams = record.progressiveStreams as Array<Record<string, unknown>>;
          // Sort by bitrate or resolution to get best quality
          const sorted = [...streams].sort((a, b) => {
            const aRate = Number((a.bitRate as Record<string, unknown>)?.value || a.bitRate || 0);
            const bRate = Number((b.bitRate as Record<string, unknown>)?.value || b.bitRate || 0);
            return bRate - aRate;
          });
          for (const stream of sorted.slice(0, 1)) {
            // Streaming locations
            if (Array.isArray(stream.streamingLocations)) {
              for (const loc of stream.streamingLocations as Array<Record<string, unknown>>) {
                const url = loc.url as string | undefined;
                if (url && !urls.includes(url)) {
                  console.log('[MediaExtract] Found video stream URL:', url.substring(0, 80) + '...');
                  urls.push(url);
                }
              }
            }
            // Direct URL on stream
            const streamUrl = stream.url as string | undefined;
            if (streamUrl && !urls.includes(streamUrl)) {
              urls.push(streamUrl);
            }
          }
        }

        // Also grab video thumbnail
        findVectorImages(record);

        // Recurse
        if (Array.isArray(obj)) {
          for (const item of obj) walkForVideo(item, depth + 1);
        } else {
          for (const value of Object.values(record)) {
            if (value && typeof value === 'object') walkForVideo(value, depth + 1);
          }
        }
      };

      walkForVideo(contentObj);

      // Resolve media URN reference for video
      const mediaRef = (contentObj.media || contentObj['*media']) as string | undefined;
      if (typeof mediaRef === 'string' && mediaRef.startsWith('urn:')) {
        const resolved = urnMap.get(mediaRef);
        if (resolved) walkForVideo(resolved);
      }
    }

    // ── Article extraction ──
    if (mediaType === 'article') {
      // GraphQL: articleComponent.navigationContext.actionTarget
      // REST: navigationContext.actionTarget
      const walkForArticle = (obj: unknown, depth = 0): void => {
        if (depth > 4 || !obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;

        if (record.navigationContext && typeof record.navigationContext === 'object') {
          const nav = record.navigationContext as Record<string, unknown>;
          const target = nav.actionTarget as string | undefined;
          if (target && target.startsWith('http') && !urls.includes(target)) {
            console.log('[MediaExtract] Found article URL:', target.substring(0, 80) + '...');
            urls.push(target);
          }
        }

        // Also grab article thumbnail image
        findVectorImages(record);

        for (const value of Object.values(record)) {
          if (value && typeof value === 'object') walkForArticle(value, depth + 1);
        }
      };

      walkForArticle(contentObj);
    }

    // ── Document / Carousel extraction ──
    if (mediaType === 'document') {
      const walkForDocument = (obj: unknown, depth = 0): void => {
        if (depth > 5 || !obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;

        // Transcribed document URL (full PDF)
        const transcribedUrl = record.transcribedDocumentUrl as string | undefined;
        if (transcribedUrl && !urls.includes(transcribedUrl)) {
          console.log('[MediaExtract] Found document URL:', transcribedUrl.substring(0, 80) + '...');
          urls.push(transcribedUrl);
        }

        // Individual carousel pages
        if (Array.isArray(record.pages)) {
          for (const page of record.pages as Array<Record<string, unknown>>) {
            const pageUrl = page.imageUrl as string | undefined;
            if (pageUrl && !urls.includes(pageUrl)) {
              console.log('[MediaExtract] Found carousel page URL:', pageUrl.substring(0, 80) + '...');
              urls.push(pageUrl);
            }
            // Some pages have vectorImage instead of imageUrl
            findVectorImages(page);
          }
        }

        // Resolve document URN reference
        const docRef = record['*document'] as string | undefined;
        if (typeof docRef === 'string') {
          const resolved = urnMap.get(docRef);
          if (resolved) walkForDocument(resolved);
        }

        for (const value of Object.values(record)) {
          if (value && typeof value === 'object') walkForDocument(value, depth + 1);
        }
      };

      walkForDocument(contentObj);
    }

    if (urls.length > 0) {
      console.log(`[MediaExtract] Extracted ${urls.length} media URL(s) for ${mediaType} post`);
    }
  } catch (err) {
    console.warn('[MediaExtract] Error extracting media URLs:', err);
  }

  return urls;
}

/**
 * Lightweight post extractor for background sync responses.
 *
 * Extracts basic post information from LinkedIn Voyager API responses that
 * contain `included` or `elements` arrays. This is a simplified version of
 * the full `extractPostsFromResponse` in the service worker, sufficient for
 * background sync purposes.
 *
 * @param responseData - The raw API response object.
 * @returns An array of post objects with standardised field names.
 */
function extractBasicPosts(responseData: Record<string, unknown>): Record<string, unknown>[] {
  const posts: Record<string, unknown>[] = [];
  const seenUrns = new Set<string>();

  // Build URN lookup from included array
  const urnMap = new Map<string, Record<string, unknown>>();
  const included = Array.isArray(responseData.included)
    ? responseData.included as Record<string, unknown>[]
    : [];

  for (const item of included) {
    if (!item || typeof item !== 'object') continue;
    const urn = (item.entityUrn || item.urn || '') as string;
    if (urn) urnMap.set(urn, item);
  }

  /**
   * Attempt to extract a post from a single entity object.
   * @param item - A candidate entity from the API response.
   */
  function tryExtract(item: Record<string, unknown>): void {
    // Prefer metadata.backendUrn (clean activity URN) over the verbose fsd_update URN
    const metadata = (item.metadata && typeof item.metadata === 'object')
      ? item.metadata as Record<string, unknown>
      : {};
    const urn = (
      metadata.backendUrn || item.urn || item.entityUrn || item.activityUrn || ''
    ) as string;
    if (!urn || seenUrns.has(urn)) return;

    // ── Extract actor URN for author verification ──
    // LinkedIn Update entities have an actor (or *actor) field referencing
    // the profile URN of the post author. We store this so the web app can
    // verify it matches the authenticated user.
    let actorUrn = '';
    const actorField = item.actor ?? item['*actor'] ?? item.authorUrn;
    if (typeof actorField === 'string') {
      actorUrn = actorField;
    } else if (actorField && typeof actorField === 'object') {
      const actorObj = actorField as Record<string, unknown>;
      actorUrn = (actorObj.urn || actorObj.entityUrn || '') as string;
    }

    // Resolve commentary (inline or *reference)
    let commentary: Record<string, unknown> | undefined;
    if (item.commentary && typeof item.commentary === 'object') {
      commentary = item.commentary as Record<string, unknown>;
    } else if (typeof item['*commentary'] === 'string') {
      commentary = urnMap.get(item['*commentary'] as string);
    }

    // Resolve social detail → social activity counts.
    // GraphQL responses use a two-hop reference chain:
    //   Update.*socialDetail → SocialDetail.*totalSocialActivityCounts → SocialActivityCounts
    let socialCounts: Record<string, unknown> | undefined;
    let socialDetail: Record<string, unknown> | undefined;
    if (item.socialDetail && typeof item.socialDetail === 'object') {
      socialDetail = item.socialDetail as Record<string, unknown>;
    } else if (typeof item['*socialDetail'] === 'string') {
      socialDetail = urnMap.get(item['*socialDetail'] as string);
    }
    if (socialDetail) {
      // Try inline counts first (REST format)
      if (socialDetail.numLikes !== undefined || socialDetail.numImpressions !== undefined) {
        socialCounts = socialDetail;
      }
      // Follow *totalSocialActivityCounts reference (GraphQL format)
      const countsRef = socialDetail['*totalSocialActivityCounts'] as string | undefined;
      if (countsRef) {
        const resolved = urnMap.get(countsRef);
        if (resolved) socialCounts = resolved;
      }
      // Also check inline totalSocialActivityCounts object
      if (!socialCounts && socialDetail.totalSocialActivityCounts && typeof socialDetail.totalSocialActivityCounts === 'object') {
        socialCounts = socialDetail.totalSocialActivityCounts as Record<string, unknown>;
      }
    }

    // ── Detect reposts ──
    // LinkedIn reposts have a resharedUpdate reference pointing to the original.
    // The user's own commentary (if any) is in `commentary`, while the original
    // post's text is inside the reshared entity.
    let isRepost = false;
    let originalContent = '';
    const resharedRef = item.resharedUpdate ?? item['*resharedUpdate'];
    if (resharedRef) {
      isRepost = true;
      // Resolve the original post to extract its text for context
      const originalPost = typeof resharedRef === 'string'
        ? urnMap.get(resharedRef)
        : (typeof resharedRef === 'object' ? resharedRef as Record<string, unknown> : undefined);
      if (originalPost) {
        let origCommentary: Record<string, unknown> | undefined;
        if (originalPost.commentary && typeof originalPost.commentary === 'object') {
          origCommentary = originalPost.commentary as Record<string, unknown>;
        } else if (typeof originalPost['*commentary'] === 'string') {
          origCommentary = urnMap.get(originalPost['*commentary'] as string);
        }
        if (origCommentary) {
          if (typeof origCommentary.text === 'string') {
            originalContent = origCommentary.text;
          } else if (origCommentary.text && typeof origCommentary.text === 'object') {
            const textObj = origCommentary.text as Record<string, unknown>;
            originalContent = (textObj.text as string) || '';
          }
        }
      }
    }

    // Extract text content — use the user's own commentary
    let content = '';
    if (commentary) {
      if (typeof commentary.text === 'string') {
        content = commentary.text;
      } else if (commentary.text && typeof commentary.text === 'object') {
        const textObj = commentary.text as Record<string, unknown>;
        content = (textObj.text as string) || '';
      }
    }

    // For reposts without user commentary, use a label + original content preview
    if (isRepost && !content && originalContent) {
      content = `[Repost] ${originalContent}`;
    }

    // Skip items with no content and no social metrics
    if (!content && !socialCounts) return;

    seenUrns.add(urn);

    // Extract engagement metrics from resolved SocialActivityCounts
    const counts = socialCounts || {};
    const reactions = Number(counts.numLikes ?? counts.reactionCount ?? 0);
    const comments = Number(counts.numComments ?? counts.commentCount ?? 0);
    const reposts = Number(counts.numShares ?? counts.shareCount ?? 0);
    const impressions = Number(counts.numImpressions ?? counts.impressionCount ?? 0);
    const saves = Number(counts.saveCount ?? counts.numSaves ?? 0);
    const sends = Number(counts.sendCount ?? counts.numSends ?? 0);

    // Extract timestamp from available fields, or decode from activity URN.
    // LinkedIn activity URNs use Snowflake IDs where the upper bits encode
    // a millisecond timestamp. The epoch offset is 0 (Unix epoch).
    let postedAt: number | null = null;
    const rawTimestamp = item.createdAt ?? item.publishedAt ?? item.postedAt ?? null;
    if (rawTimestamp) {
      postedAt = Number(rawTimestamp);
    } else {
      // Decode timestamp from activity URN Snowflake ID
      const activityMatch = urn.match(/activity:(\d+)/);
      if (activityMatch) {
        // LinkedIn activity Snowflake IDs: the upper bits (ID >> 22) directly
        // encode Unix millisecond timestamps — no custom epoch offset needed.
        const snowflakeId = BigInt(activityMatch[1]);
        const timestampMs = Number(snowflakeId >> 22n);
        // Validate the decoded timestamp is reasonable (2015-2030)
        if (timestampMs > 1420070400000 && timestampMs < 1893456000000) {
          postedAt = timestampMs;
        }
      }
    }

    // Detect media type from content field.
    // GraphQL format uses named sub-components (articleComponent, imageComponent, etc.)
    // REST format uses $type on the content object.
    let mediaType = 'text';
    const contentField = item.content ?? item['*content'];
    if (contentField && typeof contentField === 'object') {
      const contentObj = contentField as Record<string, unknown>;
      const contentKeys = Object.keys(contentObj).join(' ').toLowerCase();
      if (contentKeys.includes('image')) mediaType = 'image';
      else if (contentKeys.includes('video')) mediaType = 'video';
      else if (contentKeys.includes('article')) mediaType = 'article';
      else if (contentKeys.includes('document') || contentKeys.includes('carousel')) mediaType = 'document';
      // Fallback to $type check (REST format)
      if (mediaType === 'text') {
        const contentType = ((contentObj.$type || '') as string).toLowerCase();
        if (contentType.includes('image')) mediaType = 'image';
        else if (contentType.includes('video')) mediaType = 'video';
        else if (contentType.includes('article')) mediaType = 'article';
        else if (contentType.includes('document')) mediaType = 'document';
      }
    } else if (typeof contentField === 'string') {
      const resolved = urnMap.get(contentField);
      if (resolved) {
        const resolvedType = ((resolved.$type || '') as string).toLowerCase();
        if (resolvedType.includes('image')) mediaType = 'image';
        else if (resolvedType.includes('video')) mediaType = 'video';
        else if (resolvedType.includes('article')) mediaType = 'article';
        else if (resolvedType.includes('document')) mediaType = 'document';
      }
    }

    // ── Extract media URLs from content field ──
    let resolvedContentObj: Record<string, unknown> | undefined;
    if (contentField && typeof contentField === 'object') {
      resolvedContentObj = contentField as Record<string, unknown>;
    } else if (typeof contentField === 'string') {
      resolvedContentObj = urnMap.get(contentField);
    }
    const mediaUrls = extractMediaUrls(resolvedContentObj, mediaType, urnMap);
    if (mediaUrls.length > 0) {
      console.log(`[BackgroundSync] Post ${urn.substring(0, 40)}... has ${mediaUrls.length} media URL(s) [${mediaType}]`);
    }

    posts.push({
      activity_urn: urn,
      content,
      reactions,
      comments,
      reposts,
      impressions,
      saves,
      sends,
      media_type: mediaType,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      posted_at: postedAt,
      source: 'background_sync',
      is_repost: isRepost,
      original_content: isRepost ? originalContent : null,
      actor_urn: actorUrn || null,
    });
  }

  // Search included array for post-like entities
  for (const item of included) {
    if (!item || typeof item !== 'object') continue;
    const type = ((item.$type || '') as string).toLowerCase();
    const isPostType = type.includes('update') || type.includes('activity') || type.includes('share');
    const hasContent = !!(item.commentary || item['*commentary'] || item.socialDetail || item['*socialDetail']);
    if (isPostType || hasContent) {
      tryExtract(item);
    }
  }

  // Also check top-level elements array
  const elements = Array.isArray(responseData.elements)
    ? responseData.elements as Record<string, unknown>[]
    : [];
  for (const item of elements) {
    if (item && typeof item === 'object') {
      tryExtract(item);
    }
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Safety Mechanisms
// ---------------------------------------------------------------------------

/**
 * Reset the circuit breaker after manual intervention.
 *
 * This allows syncing to resume after the user has investigated and
 * resolved the root cause of repeated failures (e.g. re-authenticating
 * to LinkedIn).
 *
 * @example
 * // Called from popup after user logs back in to LinkedIn:
 * await resetCircuitBreaker();
 */
export async function resetCircuitBreaker(): Promise<void> {
  console.log(`${LOG_PREFIX} Resetting circuit breaker`);

  const state = await getSyncState();
  state.circuitBreakerTripped = false;
  state.consecutiveFailures = 0;
  state.lastError = null;
  await saveSyncState(state);

  // Reschedule if sync is still enabled
  const config = await getSyncConfig();
  if (config.enabled) {
    await scheduleNextSync(config, state);
  }

  console.log(`${LOG_PREFIX} Circuit breaker reset, sync can resume`);
}

/**
 * Calculate the next sync time in Unix milliseconds, incorporating
 * the base interval, random jitter, and exponential back-off.
 *
 * Back-off formula:
 * ```
 * nextTime = now + (baseInterval * backoffMultiplier) + jitter
 * ```
 * where `backoffMultiplier = min(2^consecutiveFailures, MAX_BACKOFF_MULTIPLIER)`
 *
 * @param config - The current sync configuration.
 * @param state - The current sync runtime state.
 * @returns Unix timestamp (ms) for the next scheduled sync.
 */
function calculateNextSyncTime(
  config: BackgroundSyncConfig,
  state: BackgroundSyncState,
): number {
  const baseMs = config.baseIntervalMinutes * 60 * 1000;
  const jitterMs = Math.random() * config.jitterMinutes * 60 * 1000;
  const backoffMultiplier = Math.min(
    Math.pow(2, state.consecutiveFailures),
    MAX_BACKOFF_MULTIPLIER,
  );

  return Date.now() + (baseMs * backoffMultiplier) + jitterMs;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule the next background sync alarm using chrome.alarms.
 *
 * The alarm fires at the time computed by {@link calculateNextSyncTime},
 * which accounts for the base interval, jitter, and exponential back-off.
 * The computed next-sync time is also persisted to state for UI display.
 *
 * @param config - The current sync configuration.
 * @param state - The current sync runtime state.
 */
async function scheduleNextSync(
  config: BackgroundSyncConfig,
  state: BackgroundSyncState,
): Promise<void> {
  // Clear any existing alarm first
  await chrome.alarms.clear(ALARM_NAMES.BACKGROUND_SYNC);

  const nextSyncTime = calculateNextSyncTime(config, state);
  const delayMinutes = Math.max(
    (nextSyncTime - Date.now()) / (60 * 1000),
    1, // Chrome alarms require at least 1 minute for non-persistent MV3
  );

  chrome.alarms.create(ALARM_NAMES.BACKGROUND_SYNC, {
    delayInMinutes: delayMinutes,
  });

  // Persist the scheduled time for UI display
  state.nextSyncTime = nextSyncTime;
  await saveSyncState(state);

  const nextDate = new Date(nextSyncTime);
  console.log(
    `${LOG_PREFIX} Next sync scheduled in ${delayMinutes.toFixed(1)}min ` +
    `(at ${nextDate.toLocaleTimeString()})`,
  );
}

/**
 * Handle the chrome.alarms `onAlarm` event for the background sync alarm.
 *
 * This function should be called from the service worker's alarm listener
 * when the alarm name matches {@link ALARM_NAMES.BACKGROUND_SYNC}.
 *
 * @example
 * // In service-worker.ts:
 * chrome.alarms.onAlarm.addListener(async (alarm) => {
 *   if (alarm.name === 'linkedin-background-sync') {
 *     await handleBackgroundSyncAlarm();
 *   }
 * });
 */
export async function handleBackgroundSyncAlarm(): Promise<void> {
  console.log(`${LOG_PREFIX} Alarm fired, triggering sync`);
  await triggerSync(false);
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random intra-request delay between 1000ms and 4000ms.
 * Mimics human browsing cadence between consecutive API requests.
 *
 * @returns Delay in milliseconds.
 */
function getIntraRequestDelay(): number {
  return 1000 + Math.random() * 3000;
}

/**
 * Promise-based sleep utility.
 *
 * @param ms - Duration to sleep in milliseconds.
 * @returns A promise that resolves after the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Diagnostic Test
// ---------------------------------------------------------------------------

/**
 * Diagnostic result for a single test step.
 */
interface DiagnosticStep {
  step: string;
  passed: boolean;
  detail: string;
  data?: unknown;
}

/**
 * Run a comprehensive diagnostic that validates every layer of the background
 * sync pipeline against the live LinkedIn environment. This is the single
 * source of truth for "will it work?"
 *
 * Tests (in order):
 * 1. Can we read LinkedIn cookies via chrome.cookies.get()?
 * 2. Can we derive CSRF token from JSESSIONID?
 * 3. Can we send a fetch() with manual Cookie header from the service worker?
 * 4. Does LinkedIn return a valid JSON response (not 401/403/429/999)?
 * 5. Does the response contain the expected normalized structure (included/elements)?
 * 6. Can we read/write chrome.storage.local?
 * 7. Can we read stored profile info (profileUrn, publicIdentifier)?
 *
 * @returns An array of diagnostic step results.
 */
export async function runDiagnostic(): Promise<DiagnosticStep[]> {
  const results: DiagnosticStep[] = [];

  // Step 1: Cookie access
  let auth: Awaited<ReturnType<typeof getLinkedInAuth>> = null;
  try {
    auth = await getLinkedInAuth();
    if (auth) {
      results.push({
        step: '1. Cookie Access',
        passed: true,
        detail: `li_at: ${auth.liAt.substring(0, 8)}..., JSESSIONID present: true`,
      });
    } else {
      results.push({
        step: '1. Cookie Access',
        passed: false,
        detail: 'LinkedIn cookies not found. User must be logged into linkedin.com.',
      });
      return results; // Cannot proceed without cookies
    }
  } catch (error) {
    results.push({
      step: '1. Cookie Access',
      passed: false,
      detail: `chrome.cookies.get() threw: ${error instanceof Error ? error.message : String(error)}`,
    });
    return results;
  }

  // Step 2: CSRF token derivation
  results.push({
    step: '2. CSRF Token',
    passed: auth.csrfToken.length > 0 && !auth.csrfToken.includes('"'),
    detail: `Token: ${auth.csrfToken.substring(0, 12)}... (length=${auth.csrfToken.length})`,
  });

  // Step 3 & 4: Fetch with manual Cookie header (use profileViews — needs no params)
  let fetchResult: Awaited<ReturnType<typeof fetchEndpoint>> | null = null;
  try {
    fetchResult = await fetchEndpoint('profileViews');

    if (fetchResult.success) {
      results.push({
        step: '3. Service Worker Fetch',
        passed: true,
        detail: `HTTP ${fetchResult.status} — Cookie header was accepted by LinkedIn`,
      });
    } else if (fetchResult.status === 401 || fetchResult.status === 403) {
      results.push({
        step: '3. Service Worker Fetch',
        passed: false,
        detail: `HTTP ${fetchResult.status} — Cookie header may have been stripped by Chrome. ` +
          `This is the known MV3 risk. Error: ${fetchResult.error}`,
      });
      return results;
    } else {
      results.push({
        step: '3. Service Worker Fetch',
        passed: false,
        detail: `HTTP ${fetchResult.status} — ${fetchResult.error}`,
      });
    }
  } catch (error) {
    results.push({
      step: '3. Service Worker Fetch',
      passed: false,
      detail: `fetch() threw: ${error instanceof Error ? error.message : String(error)}`,
    });
    return results;
  }

  // Step 5: Response structure validation
  if (fetchResult?.success && fetchResult.data) {
    const data = fetchResult.data as Record<string, unknown>;
    const hasIncluded = Array.isArray(data.included);
    const hasElements = Array.isArray(data.elements);
    const hasData = data.data !== undefined;
    const topLevelKeys = Object.keys(data).slice(0, 10);

    results.push({
      step: '4. Response Structure',
      passed: hasIncluded || hasElements || hasData || topLevelKeys.length > 0,
      detail: `Keys: [${topLevelKeys.join(', ')}], ` +
        `included: ${hasIncluded ? (data.included as unknown[]).length + ' items' : 'absent'}, ` +
        `elements: ${hasElements ? (data.elements as unknown[]).length + ' items' : 'absent'}`,
      data: topLevelKeys,
    });
  }

  // Step 6: Storage read/write
  try {
    const testKey = '_bg_sync_diagnostic_test';
    const testValue = { ts: Date.now(), ok: true };
    await chrome.storage.local.set({ [testKey]: testValue });
    const readBack = await chrome.storage.local.get(testKey);
    const match = readBack[testKey]?.ts === testValue.ts;
    await chrome.storage.local.remove(testKey);

    results.push({
      step: '5. Storage Read/Write',
      passed: match,
      detail: match ? 'chrome.storage.local round-trip OK' : 'Read-back mismatch',
    });
  } catch (error) {
    results.push({
      step: '5. Storage Read/Write',
      passed: false,
      detail: `Storage error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Step 7: Stored profile info
  try {
    const profileInfo = await getStoredProfileInfo();
    if (profileInfo?.profileUrn) {
      results.push({
        step: '6. Stored Profile Info',
        passed: true,
        detail: `profileUrn: ${profileInfo.profileUrn.substring(0, 25)}..., ` +
          `publicId: ${profileInfo.publicIdentifier ?? 'not found'}`,
      });
    } else {
      results.push({
        step: '6. Stored Profile Info',
        passed: false,
        detail: 'No stored profile URN. Analytics/audience/myPosts endpoints will be skipped ' +
          'until the user visits their LinkedIn profile page once.',
      });
    }
  } catch (error) {
    results.push({
      step: '6. Stored Profile Info',
      passed: false,
      detail: `Error reading profile: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Step 8: Test a URN-dependent endpoint if profile is available
  try {
    const profileInfo = await getStoredProfileInfo();
    if (profileInfo?.profileUrn) {
      const analyticsResult = await fetchEndpoint('analytics', profileInfo.profileUrn);
      if (analyticsResult.success) {
        const data = analyticsResult.data as Record<string, unknown>;
        const keys = Object.keys(data).slice(0, 8);
        results.push({
          step: '7. Analytics Endpoint',
          passed: true,
          detail: `HTTP ${analyticsResult.status} — Keys: [${keys.join(', ')}]`,
          data: keys,
        });
      } else {
        results.push({
          step: '7. Analytics Endpoint',
          passed: false,
          detail: `HTTP ${analyticsResult.status} — ${analyticsResult.error}`,
        });
      }
    } else {
      results.push({
        step: '7. Analytics Endpoint',
        passed: false,
        detail: 'Skipped — no profileUrn available',
      });
    }
  } catch (error) {
    results.push({
      step: '7. Analytics Endpoint',
      passed: false,
      detail: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return results;
}
