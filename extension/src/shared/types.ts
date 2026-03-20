// ChainLinked Data Connector - Shared Types

// Profile Data Types
export interface ProfileData {
  memberUrn: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline?: string;
  location?: string;
  profilePhoto?: string;
  connectionCount?: number;
  followerCount?: number;
  followers_count?: number; // Alias for trend tracking
  connections_count?: number;
  capturedAt: number;
  // Additional profile fields
  name?: string;
  linkedin_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_url?: string;
  profile_picture_url?: string;
  // Index signature for dynamic access
  [key: string]: unknown;
}

// Analytics Types
export interface CreatorAnalytics {
  impressions: number;
  membersReached: number;
  engagementRate?: number;
  topPosts: TopPost[];
  period: string;
  capturedAt: number;
  // Trend tracking aliases (populated during capture)
  impressions_last_7_days?: number;
  followers_count?: number;
  engagements_last_7_days?: number;
  // Additional fields for data capture
  profileViews?: number;
  engagements?: number;
  newFollowers?: number;
  searchAppearances?: number;
  // Index signature for dynamic access
  [key: string]: unknown;
}

export interface TopPost {
  title: string;
  impressions: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  reposts?: number;
  postUrl?: string;
}

export interface PostAnalytics {
  postUrn: string;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  demographics?: PostDemographics;
  capturedAt: number;
}

export interface PostDemographics {
  topCompanies: DemographicItem[];
  topTitles: DemographicItem[];
  topLocations: DemographicItem[];
  topIndustries: DemographicItem[];
}

export interface DemographicItem {
  name: string;
  percentage: number;
  count?: number;
}

export interface AudienceAnalytics {
  totalFollowers: number;
  newFollowers?: number;
  growthRate?: number;
  demographics?: AudienceDemographics;
  capturedAt: number;
  // camelCase aliases
  followerGrowth?: number | string;
  topLocations?: unknown;
  topIndustries?: unknown;
  topJobTitles?: unknown;
  topCompanies?: unknown;
  // Index signature for dynamic access
  [key: string]: unknown;
}

export interface AudienceDemographics {
  companies: DemographicItem[];
  titles: DemographicItem[];
  locations: DemographicItem[];
  industries: DemographicItem[];
}

// Company Analytics Types (v4.0 Phase 5)
export interface CompanyAnalytics {
  companyId: string;
  companyName: string;
  companyUrl?: string;
  capturedAt: number;
  followers: number;
  employees?: number;
  updates?: number;
  pageViews?: number;
  uniqueVisitors?: number;
  customButtonClicks?: number;
  industry?: string;
  headquarters?: string;
  companySize?: string;
  founded?: string;
  specialties?: string[];
  // Index signature for dynamic access
  [key: string]: unknown;
}

// Content Calendar Types (v4.0 Phase 5)
export interface ContentItem {
  id: string;
  type: 'post' | 'article' | 'poll' | 'video' | 'document';
  status: 'published' | 'scheduled' | 'draft';
  title?: string;
  content?: string;
  publishedAt?: number;
  scheduledFor?: number;
  impressions?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  engagement?: number;
  postUrl?: string;
}

export interface ContentCalendarData {
  items: ContentItem[];
  capturedAt: number;
  period: {
    start: string;
    end: string;
  };
  // Index signature for dynamic access
  [key: string]: unknown;
}

// Capture Types
export interface CaptureLog {
  id: string;
  timestamp: number;
  type: CaptureType | string; // Allow string for flexibility
  pageUrl?: string;
  dataSize: number;
  success: boolean;
  errorMessage?: string;
}

// Backup Metadata Types
export interface BackupMetadata {
  id: string;
  timestamp: number;
  size: number;
  type: 'manual' | 'scheduled';
  destination?: 'local' | 'google-drive';
  filename?: string;
}

export type CaptureType =
  | 'creator_analytics'
  | 'post_analytics'
  | 'audience_analytics'
  | 'audience_demographics'
  | 'post_demographics'
  | 'profile_views'
  | 'profile'
  | 'network'
  | 'company_analytics'
  | 'content_calendar';

// Trend Data Types
export interface TrendDataPoint {
  id?: string;
  date: string;
  type: TrendType;
  value: number;
  source: string;
  capturedAt: number;
}

export type TrendType =
  | 'impressions'
  | 'followers'
  | 'engagements'
  | 'profile_views'
  | 'connections';

// Settings Types
export interface ExtensionSettings {
  autoCapture: boolean;
  storeImages: boolean;
  captureNotifications: boolean;
  growthAlerts: boolean;
}

export interface AlertConfig {
  id: string;
  type: TrendType;
  condition: 'above' | 'below' | 'change_percent';
  threshold: number;
  enabled: boolean;
  lastTriggered?: number;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  dayOfWeek?: number; // 0-6 for weekly
  time: string; // HH:mm format
  lastBackup?: number;
}

// Message Types
export interface ExtensionMessage {
  type: MessageType;
  key?: string;
  data?: unknown;
  url?: string;
  timestamp?: number;
}

export type MessageType =
  | 'GET_COOKIES'
  | 'GET_DATA'
  | 'SAVE_DATA'
  | 'EXPORT_DATA'
  | 'CLEAR_DATA'
  | 'API_RESPONSE'
  | 'API_CAPTURED'
  | 'EXTRACT_NOW'
  | 'AUTO_CAPTURE_CREATOR_ANALYTICS'
  | 'AUTO_CAPTURE_POST_ANALYTICS'
  | 'AUTO_CAPTURE_AUDIENCE'
  | 'AUTO_CAPTURE_AUDIENCE_DEMOGRAPHICS'
  | 'AUTO_CAPTURE_POST_DEMOGRAPHICS'
  | 'AUTO_CAPTURE_PROFILE_VIEWS'
  | 'AUTO_CAPTURE_PROFILE'
  | 'AUTO_CAPTURE_LOG'
  | 'GET_CAPTURE_STATS'
  | 'GET_ANALYTICS_GROWTH'
  | 'GET_AUDIENCE_GROWTH'
  // IndexedDB operations (v4.0)
  | 'GET_TREND_DATA'
  | 'GET_TREND_SUMMARY'
  | 'EXPORT_TRENDS_CSV'
  | 'EXPORT_TRENDS_JSON'
  | 'EXPORT_CAPTURE_LOGS'
  | 'EXPORT_FULL_BACKUP'
  | 'GET_STORAGE_STATS'
  | 'RUN_MAINTENANCE'
  // Alarms & Notifications (v4.0)
  | 'GET_BACKUP_SCHEDULE'
  | 'UPDATE_BACKUP_SCHEDULE'
  | 'GET_ALERT_CONFIGS'
  | 'SAVE_ALERT_CONFIG'
  | 'DELETE_ALERT_CONFIG'
  | 'GET_NOTIFICATION_SETTINGS'
  | 'SAVE_NOTIFICATION_SETTINGS'
  | 'GET_ALL_ALARMS'
  | 'TRIGGER_MANUAL_BACKUP'
  // Company Analytics (v4.0 Phase 5)
  | 'AUTO_CAPTURE_COMPANY_ANALYTICS'
  | 'AUTO_CAPTURE_CONTENT_CALENDAR'
  | 'GET_COMPANY_ANALYTICS'
  | 'GET_CONTENT_CALENDAR'
  // Google Drive Sync (v4.0 Phase 6)
  | 'GOOGLE_AUTH_START'
  | 'GOOGLE_AUTH_STATUS'
  | 'GOOGLE_AUTH_LOGOUT'
  | 'DRIVE_SYNC_NOW'
  | 'DRIVE_SYNC_STATUS'
  | 'DRIVE_GET_BACKUPS'
  | 'DRIVE_RESTORE_BACKUP'
  | 'DRIVE_DELETE_BACKUP'
  // Quick Post Composer (v4.1)
  | 'CREATE_LINKEDIN_POST'
  // Supabase Sync (v4.1)
  | 'SUPABASE_AUTH_STATUS'
  | 'SUPABASE_AUTH_SIGN_IN'
  | 'SUPABASE_AUTH_SIGN_UP'
  | 'SUPABASE_AUTH_SIGN_OUT'
  | 'SUPABASE_SYNC_STATUS'
  | 'SUPABASE_SYNC_NOW'
  | 'SUPABASE_FULL_SYNC'
  | 'SUPABASE_MIGRATE_DATA'
  // Legacy/compatibility message types
  | 'CHECK_AUTH'
  | 'GET_ALL_DATA'
  | 'EXPORT_JSON'
  | 'EXPORT_CSV'
  // Debug message types
  | 'SUPABASE_SYNC_RETRY'
  | 'SUPABASE_DETAILED_STATUS'
  | 'DEBUG_AUTH_RESTORE'
  | 'DEBUG_CLEAR_PENDING'
  | 'DEBUG_GET_PENDING'
  // Notification message types
  | 'SHOW_CAPTURE_FAILURE_NOTIFICATION'
  // Background Sync (v4.2)
  | 'BACKGROUND_SYNC_ENABLE'
  | 'BACKGROUND_SYNC_DISABLE'
  | 'BACKGROUND_SYNC_TRIGGER'
  | 'BACKGROUND_SYNC_STATUS'
  | 'BACKGROUND_SYNC_CONFIG'
  | 'BACKGROUND_SYNC_UPDATE_CONFIG'
  | 'BACKGROUND_SYNC_RESET_CIRCUIT_BREAKER'
  | 'BACKGROUND_SYNC_HISTORY'
  | 'BACKGROUND_SYNC_DIAGNOSTIC'
  // Platform ↔ Extension communication
  | 'CHAINLINKED_PING'
  | 'EXTENSION_AUTH_SESSION'
  | 'SUPABASE_AUTH_GOOGLE';

// Storage Keys
export type StorageKey =
  | 'extension_settings'
  | 'profile_data'
  | 'creator_analytics'
  | 'post_analytics'
  | 'audience_analytics'
  | 'capture_history'
  | 'capture_log'
  | 'api_responses';

// API Response Types
export interface VoyagerResponse {
  endpoint: string;
  data: unknown;
  timestamp: number;
}

// Growth Calculation Types
export interface GrowthData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

// Export Types
export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeHistory: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Google Drive Sync Types (v4.0 Phase 6)
export interface GoogleAuthState {
  isAuthenticated: boolean;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  accessToken?: string;
  expiresAt?: number;
}

export interface DriveSyncStatus {
  lastSync?: number;
  lastSyncSuccess?: boolean;
  lastSyncError?: string;
  syncInProgress: boolean;
  autoSyncEnabled: boolean;
  backupCount?: number;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size: number;
  mimeType: string;
}

export interface DriveSyncSettings {
  enabled: boolean;
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly' | 'manual';
  lastSync?: number;
  keepBackups: number; // Number of backups to retain
}

// Page Detection Types
export type LinkedInPageType =
  | 'creator_analytics'
  | 'post_analytics'
  | 'audience_analytics'
  | 'audience_demographics'
  | 'post_demographics'
  | 'profile_views'
  | 'company_analytics'
  | 'company_admin'
  | 'content_calendar'
  | 'feed'
  | 'profile'
  | 'company'
  | 'unknown';
