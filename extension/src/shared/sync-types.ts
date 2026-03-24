/**
 * Background Sync Types for LinkedIn Data Chrome Extension (Manifest V3)
 *
 * Self-contained type definitions for the background sync feature that
 * periodically fetches LinkedIn data using chrome.alarms and service workers.
 */

// ---------------------------------------------------------------------------
// Endpoint Type
// ---------------------------------------------------------------------------

/**
 * Union type of all syncable LinkedIn data endpoint names.
 * Each value corresponds to a toggleable data source in the sync configuration.
 */
export type SyncEndpointType =
  | 'analytics'
  | 'profile'
  | 'audience'
  | 'myPosts'
  | 'profileViews'
  | 'networkInfo';

// ---------------------------------------------------------------------------
// Configuration Interfaces
// ---------------------------------------------------------------------------

/**
 * Per-endpoint toggle that controls which LinkedIn data types are
 * included during a background sync cycle.
 */
export interface SyncEndpointsConfig {
  /** Sync creator analytics (impressions, reach, engagement) */
  analytics: boolean;
  /** Sync profile data (name, headline, connections) */
  profile: boolean;
  /** Sync audience demographics and follower data */
  audience: boolean;
  /** Sync the user's own LinkedIn posts */
  myPosts: boolean;
  /** Sync profile view statistics */
  profileViews: boolean;
  /** Sync follower and connection counts via network info */
  networkInfo: boolean;
}

/**
 * User-configurable settings for the background sync feature.
 * Stored in chrome.storage.local under a dedicated key.
 *
 * @example
 * const config: BackgroundSyncConfig = {
 *   enabled: true,
 *   baseIntervalMinutes: 15,
 *   jitterMinutes: 2,
 *   maxApiCallsPerSync: 6,
 *   activeHoursOnly: true,
 *   maxConsecutiveFailures: 3,
 *   endpoints: {
 *     analytics: true,
 *     profile: true,
 *     audience: true,
 *     myPosts: false,
 *     profileViews: true,
 *     networkInfo: true,
 *   },
 * };
 */
export interface BackgroundSyncConfig {
  /** Whether background sync is enabled (default: false) */
  enabled: boolean;
  /** Base interval between sync cycles in minutes (default: 15) */
  baseIntervalMinutes: number;
  /** Random jitter added to the interval to avoid detection patterns (default: 60) */
  jitterMinutes: number;
  /** Maximum number of LinkedIn API calls allowed per sync cycle (default: 4) */
  maxApiCallsPerSync: number;
  /** Only sync during typical active hours to mimic human behavior (default: true) */
  activeHoursOnly: boolean;
  /** Number of consecutive failures before the circuit breaker trips (default: 3) */
  maxConsecutiveFailures: number;
  /** Per-endpoint toggles controlling which data types to sync */
  endpoints: SyncEndpointsConfig;
}

// ---------------------------------------------------------------------------
// Runtime State Interfaces
// ---------------------------------------------------------------------------

/**
 * A single entry in the sync history log, representing one completed
 * (or attempted) background sync cycle.
 */
export interface SyncHistoryEntry {
  /** Unix timestamp (ms) when the sync cycle started */
  timestamp: number;
  /** List of endpoint names that were fetched during this cycle */
  endpointsFetched: string[];
  /** Whether the overall sync cycle completed successfully */
  success: boolean;
  /** Error messages collected during the sync cycle (empty array on success) */
  errors: string[];
  /** Total duration of the sync cycle in milliseconds */
  duration: number;
  /** Number of LinkedIn API calls made during this cycle */
  apiCallCount: number;
}

/**
 * Runtime state of the background sync system, persisted across
 * service worker restarts via chrome.storage.local.
 */
export interface BackgroundSyncState {
  /** Whether the sync system is currently active */
  enabled: boolean;
  /** Unix timestamp (ms) of the last sync attempt, or null if never synced */
  lastSyncTime: number | null;
  /** Whether the most recent sync cycle succeeded */
  lastSyncSuccess: boolean;
  /** Number of consecutive failed sync cycles (resets on success) */
  consecutiveFailures: number;
  /** Unix timestamp (ms) of the next scheduled sync, or null if not scheduled */
  nextSyncTime: number | null;
  /** Lifetime count of completed sync cycles */
  totalSyncs: number;
  /** Lifetime count of LinkedIn API calls made by the sync system */
  totalApiCalls: number;
  /** Whether the circuit breaker has been tripped due to repeated failures */
  circuitBreakerTripped: boolean;
  /** Human-readable description of the last error, or null if no error */
  lastError: string | null;
  /** Rolling history of recent sync cycles */
  syncHistory: SyncHistoryEntry[];
  /** Map of endpoint name to Unix timestamp (ms) of its last sync attempt */
  endpointLastSync: Record<string, number>;
  /** Map of endpoint name to whether its last sync attempt succeeded */
  endpointLastSuccess: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Auth & Result Interfaces
// ---------------------------------------------------------------------------

/**
 * LinkedIn authentication data extracted from browser cookies.
 * Required for making authenticated API calls to LinkedIn's Voyager endpoints.
 */
export interface LinkedInAuth {
  /** The li_at session cookie value */
  liAt: string;
  /** The JSESSIONID cookie value (with surrounding quotes stripped) */
  jsessionId: string;
  /** The CSRF token derived from the JSESSIONID */
  csrfToken: string;
}

/**
 * Result of a single endpoint sync attempt within a background sync cycle.
 */
export interface SyncResult {
  /** The endpoint that was synced */
  endpoint: SyncEndpointType;
  /** Whether the sync for this endpoint succeeded */
  success: boolean;
  /** Error message if the sync failed */
  error?: string;
  /** Approximate size of the fetched data in bytes */
  dataSize?: number;
  /** Unix timestamp (ms) when the sync attempt completed */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Default Constants
// ---------------------------------------------------------------------------

/**
 * Default configuration for the background sync feature.
 * Used when initializing sync settings for the first time or
 * when resetting to factory defaults.
 */
export const DEFAULT_SYNC_CONFIG: BackgroundSyncConfig = {
  enabled: false,
  baseIntervalMinutes: 15,
  jitterMinutes: 2,
  maxApiCallsPerSync: 6,
  activeHoursOnly: false,
  maxConsecutiveFailures: 3,
  endpoints: {
    analytics: true,
    profile: true,
    audience: true,
    myPosts: true,
    profileViews: true,
    networkInfo: true,
  },
};

/**
 * Default (initial) runtime state for the background sync system.
 * Represents a clean state with no prior sync activity.
 */
export const DEFAULT_SYNC_STATE: BackgroundSyncState = {
  enabled: false,
  lastSyncTime: null,
  lastSyncSuccess: false,
  consecutiveFailures: 0,
  nextSyncTime: null,
  totalSyncs: 0,
  totalApiCalls: 0,
  circuitBreakerTripped: false,
  lastError: null,
  syncHistory: [],
  endpointLastSync: {},
  endpointLastSuccess: {},
};
