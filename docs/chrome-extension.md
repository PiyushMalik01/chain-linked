# ChainLinked Chrome Extension

## 1. Extension Overview

The ChainLinked Chrome Extension (named "ChainLinked Data Connector") captures LinkedIn data in real time as the user browses LinkedIn. It intercepts LinkedIn's internal Voyager API responses, extracts structured data from the DOM, and syncs everything to Supabase so the ChainLinked web application can display analytics dashboards, post histories, audience insights, and more.

Key capabilities:

- **Passive data capture** -- intercepts LinkedIn API responses (fetch, XHR, JSON.parse, ReadableStream) without making extra network requests
- **DOM extraction** -- scrapes profile data, analytics metrics, and audience demographics directly from the rendered page when API data is unavailable
- **Background sync** -- periodically fetches fresh data from LinkedIn's Voyager API using `chrome.alarms`, even when the user is not actively browsing LinkedIn
- **Supabase cloud sync** -- writes captured data to Supabase PostgreSQL with an offline-first queue that retries on failure
- **Webapp bridge** -- allows the ChainLinked web application to detect the extension, receive auth sessions, and issue LinkedIn search queries through the extension's privileged cookie access

Current version: **4.1.0** (Manifest V3).

---

## 2. Architecture

The extension follows the Chrome Manifest V3 architecture with four main execution contexts:

```
+------------------+     postMessage      +-------------------+
|  MAIN World      | <------------------> |  ISOLATED World   |
|  (LinkedIn page) |                      |  (Content Scripts) |
|                  |                      |                    |
|  - main-world-   |                      |  - content-script  |
|    interceptor   |                      |  - auto-capture    |
|  - webapp-bridge |                      |  - dom-extractor   |
|    (on webapp)   |                      |  - company-extractor|
+------------------+                      |  - webapp-relay    |
                                          |    (on webapp)     |
                                          +--------+-----------+
                                                   |
                                      chrome.runtime.sendMessage
                                                   |
                                          +--------v-----------+
                                          |  Service Worker    |
                                          |  (Background)      |
                                          |                    |
                                          |  - service-worker  |
                                          |  - background-sync |
                                          |  - linkedin-api    |
                                          |  - supabase-sync   |
                                          |  - alarms          |
                                          |  - notifications   |
                                          |  - google-auth     |
                                          |  - drive-sync      |
                                          +--------+-----------+
                                                   |
                                            fetch (REST API)
                                                   |
                                          +--------v-----------+
                                          |  Supabase          |
                                          |  PostgreSQL        |
                                          +--------------------+

+------------------+
|  Popup UI        |
|  (React + Vite)  |
|                  |
|  - App.tsx       |
|  - Auth forms    |
|  - Status view   |
+------------------+
```

**World isolation**: LinkedIn content scripts use two injection worlds. The `main-world-interceptor` runs in the MAIN world (shares JavaScript context with LinkedIn) to monkey-patch `fetch`, `XMLHttpRequest`, `Response.json()`, `JSON.parse`, etc. It dispatches captured data via `window.postMessage` to the ISOLATED world content scripts, which relay it to the service worker via `chrome.runtime.sendMessage`.

---

## 3. File Structure

### Root Configuration

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension manifest (V3). Defines permissions, content scripts, service worker, popup, and externally connectable origins. |
| `package.json` | NPM package config. Dependencies include React 18, Recharts, Tailwind CSS, Lucide icons. |
| `esbuild.config.js` | Build script for TypeScript service worker and content scripts. Bundles each entry point as IIFE with esbuild. |
| `vite.config.ts` | Vite config for building the React popup UI. Outputs to `dist/popup/`. |
| `tsconfig.json` | TypeScript configuration for the extension source. |
| `tsconfig.node.json` | TypeScript config for Node-side tooling (Vite, esbuild configs). |
| `tailwind.config.js` | Tailwind CSS configuration for the popup UI. |
| `postcss.config.js` | PostCSS config (Tailwind + Autoprefixer). |
| `test-background-sync.js` | Manual test script for background sync functionality. |
| `.env.example` | Example environment variables (app URL for manifest injection). |

### `src/background/` -- Service Worker & Background Logic

| File | Purpose |
|------|---------|
| `service-worker.ts` | **Main service worker entry point.** Handles all `chrome.runtime.onMessage` routing, cookie management, LinkedIn API calls, storage operations, post extraction from API responses, mention search, auth session management, history tracking, capture stats, and data export. Loads Supabase modules via `importScripts`. |
| `background-sync.ts` | **Background sync orchestrator.** Uses `chrome.alarms` for periodic LinkedIn data fetching. Implements circuit breaker, exponential backoff, active-hours-only mode, and configurable sync intervals (default 15 minutes with 2-minute jitter). |
| `linkedin-api.ts` | **LinkedIn Voyager API client.** Reads `li_at` and `JSESSIONID` cookies via `chrome.cookies`, builds authenticated Voyager request headers, and fetches endpoints for analytics, profile, audience, posts, and profile views. |
| `supabase-sync-bridge.ts` | **Supabase sync bridge.** Maps chrome.storage keys to Supabase table names, converts camelCase fields to snake_case, queues pending changes for sync, and processes the sync queue with retry logic. |
| `alarms.ts` | **Chrome alarms management.** Defines alarm names for daily backup, weekly backup, maintenance, alert checking, and background sync. Handles backup scheduling and alert configuration. |
| `notifications.ts` | **Chrome notifications.** Shows capture success/failure, backup status, and growth alert notifications. Supports quiet hours and per-type notification toggles. |
| `google-auth.ts` | **Google OAuth via `chrome.identity`.** Handles Google sign-in for Google Drive backup access. Manages token storage and expiry. |
| `drive-sync.ts` | **Google Drive backup/restore.** Backs up extension data to Google Drive's appdata folder. Supports configurable backup frequency and retention. |

### `src/content/` -- Content Scripts

| File | World | Purpose |
|------|-------|---------|
| `main-world-interceptor.ts` | MAIN | **API interceptor (v3.4).** Monkey-patches `fetch`, `XMLHttpRequest.open/send`, `Response.json()`, `Response.text()`, `JSON.parse`, `Response.arrayBuffer()`, Worker messages, and ReadableStream to capture LinkedIn Voyager API responses. Categorizes requests by URL patterns and GraphQL queryIds, then dispatches via `postMessage` with type `__CL_API_CAPTURED__`. |
| `content-script.ts` | ISOLATED | **Main orchestrator.** Listens for `__CL_API_CAPTURED__` messages from the MAIN world, forwards captured API data to the service worker, handles DOM extraction triggers, manages auto-capture controller state, and responds to popup messages (EXTRACT_NOW, GET_PAGE_TYPE, GET_AUTH_STATUS, etc.). |
| `auto-capture.ts` | ISOLATED | **Auto-capture controller.** Detects LinkedIn page types via URL pattern matching (profile, analytics, posts, audience demographics, etc.), waits for page elements to load, triggers DOM extraction with validation, and sends results to the service worker. Tracks capture completeness across data types. |
| `dom-extractor.ts` | ISOLATED | **DOM data extractor.** Extracts profile data (name, headline, location, connections, followers), analytics metrics (impressions, engagements, reach), post analytics, audience demographics, and profile views directly from LinkedIn's rendered DOM using CSS selectors with multiple fallbacks. |
| `company-extractor.ts` | ISOLATED | **Company page extractor.** Detects company pages and extracts company analytics (followers, page views, employees), content calendar data, and admin dashboard metrics. |
| `webapp-bridge.ts` | MAIN (webapp) | **Webapp detection bridge.** Runs on ChainLinked webapp pages in MAIN world. Sets `window.__CHAINLINKED_EXTENSION__` flag, injects a hidden DOM marker with the extension version, responds to ping events, relays mention search requests and auth sessions to the ISOLATED world via `postMessage`. Includes auto-session transfer from webapp localStorage to extension. |
| `webapp-relay.ts` | ISOLATED (webapp) | **Webapp message relay.** Runs on ChainLinked webapp pages in ISOLATED world. Has `chrome.runtime` access; relays auth sessions, status requests, and mention search queries between the MAIN world bridge and the service worker. Listens for auth state change broadcasts from the service worker and forwards them to the page. |

### `src/shared/` -- Shared Utilities

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript type definitions shared across all contexts: `ProfileData`, `CreatorAnalytics`, `PostAnalytics`, `AudienceAnalytics`, `CompanyAnalytics`, `ContentCalendarData`, `ExtensionMessage`, and more. |
| `sync-types.ts` | Types for background sync: `SyncEndpointType`, `BackgroundSyncConfig`, `BackgroundSyncState`, `SyncHistoryEntry`, `SyncResult`. |
| `retry-utils.ts` | Exponential backoff retry logic for `chrome.runtime.sendMessage`. Includes message queueing for offline/context-invalidated scenarios. |
| `validators.ts` | Data validation utilities for captured LinkedIn data. Validates creator analytics, post analytics, profile data, and audience data before storage. |
| `indexeddb.ts` | IndexedDB wrapper for persistent trend data, capture logs, and backup metadata. Stores time-series data that survives chrome.storage quota limits. |
| `history-manager.ts` | Trend data collection and aggregation. Records analytics/profile trends, manages capture logs, handles data export (CSV, JSON), and runs daily maintenance. |
| `storage.ts` | Shared storage utilities used across contexts. |

### `src/popup/` -- Popup UI (React)

| File | Purpose |
|------|---------|
| `App.tsx` | **Main popup component.** Minimal auth-focused UI (320x480px). Provides email/password sign-in, Google sign-in, sign-up, account status display, LinkedIn connection status, auto-capture status indicator, and dashboard link. |
| `main.tsx` | React entry point. Renders `App` into the popup DOM. |
| `index.html` | HTML shell for the popup. |
| `index.css` | Tailwind CSS imports and base styles. |
| `lib/utils.ts` | `cn()` utility for conditional Tailwind class merging. |
| `vite-env.d.ts` | Vite TypeScript environment declarations. |
| `hooks/useAnalytics.ts` | Hook for loading analytics data from chrome.storage. |
| `hooks/useStorage.ts` | Hook for reading/writing chrome.storage from React components. |
| `components/Analytics.tsx` | Analytics display component (impressions, reach, engagement charts). |
| `components/CompanyAnalytics.tsx` | Company analytics display. |
| `components/ContentCalendar.tsx` | Content calendar view for scheduled/published posts. |
| `components/Dashboard.tsx` | Dashboard overview component. |
| `components/QuickComposer.tsx` | Quick post composition interface. |
| `components/TrendChart.tsx` | Recharts-based trend visualization. |
| `components/CloudSync.tsx` | Cloud sync status and controls. |
| `components/Settings.tsx` | Extension settings panel. |
| `components/SupabaseAuth.tsx` | Supabase authentication UI component. |
| `components/ui/` | Shared UI primitives: `badge.tsx`, `button.tsx`, `card.tsx`, `switch.tsx`, `tabs.tsx`. |

### `lib/supabase/` -- Supabase Client (Plain JS)

These files are loaded via `importScripts()` in the service worker (they cannot be bundled as ES modules in MV3 service workers).

| File | Purpose |
|------|---------|
| `client.js` | **Lightweight Supabase client.** Implements `SupabaseClient`, `QueryBuilder`, `AuthClient`, and `RealtimeClient` classes using raw `fetch`. Supports SELECT, INSERT, UPDATE, UPSERT, DELETE operations, auth token management, session refresh, and WebSocket realtime subscriptions. Includes `fetchWithRetry` for transient network failures during service worker wake-up. |
| `local-cache.js` | **Offline-first local cache.** Manages `chrome.storage.local` as a cache with a pending changes queue. Maps local storage keys to Supabase table names. Handles online/offline transitions. |
| `sync.js` | **Real-time sync manager.** Subscribes to Supabase realtime channels for `linkedin_profiles`, `linkedin_analytics`, `post_analytics`, `audience_data`, `extension_settings`, and `sync_metadata`. Orchestrates periodic sync (default 5-minute interval). |
| `storage.js` | **Unified storage interface.** Wraps local cache with Supabase sync. Provides a single `save()`/`get()` API that writes locally first (offline-first) then syncs to Supabase. |

### Other Files

| File | Purpose |
|------|---------|
| `icons/` | Extension icons: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`, `icon.svg`. |
| `logo.png`, `src/popup/logo.png` | ChainLinked logo for popup header. |
| `dist/` | Build output directory loaded as the unpacked extension. |

---

## 4. Manifest Configuration

### Permissions

| Permission | Purpose |
|------------|---------|
| `cookies` | Read LinkedIn session cookies (`li_at`, `JSESSIONID`) for API authentication |
| `storage` | Access `chrome.storage.local` for data persistence |
| `unlimitedStorage` | Store large volumes of captured API responses and post data |
| `activeTab` | Access the currently active tab for content script injection |
| `scripting` | Programmatic script injection |
| `alarms` | Schedule periodic background sync and backup tasks |
| `notifications` | Show capture success, backup, and growth alert notifications |
| `identity` | Google OAuth flow via `chrome.identity.getAuthToken` for Drive backup |

### Host Permissions

- `https://*.linkedin.com/*` -- Content script injection and cookie access
- `https://www.linkedin.com/*` -- Voyager API requests from the service worker
- `https://*.supabase.co/*` -- Supabase database and auth API calls
- `https://media.licdn.com/*`, `https://*.licdn.com/*` -- LinkedIn media/CDN access

### Content Scripts

Four content script groups are registered:

1. **Webapp bridge (MAIN world)** -- Injected on `localhost:3000-3004` and `chainlinked.ai`. Runs `webapp-bridge.js` at `document_start` to set extension detection markers.

2. **Webapp relay (ISOLATED world)** -- Same URL matches. Runs `webapp-relay.js` at `document_start` to relay messages between the MAIN world bridge and the service worker.

3. **LinkedIn interceptor (MAIN world)** -- Injected on `*.linkedin.com`. Runs `main-world-interceptor.js` at `document_start` to patch `fetch`/`XHR`/`JSON.parse` before LinkedIn's own code executes.

4. **LinkedIn content scripts (ISOLATED world)** -- Injected on `*.linkedin.com`. Runs `dom-extractor.js`, `company-extractor.js`, `auto-capture.js`, and `content-script.js` at `document_start`. Includes `content/styles.css`.

### Externally Connectable

The webapp can communicate directly with the extension via `chrome.runtime.sendMessage` (with extension ID) from:
- `http://localhost:3000-3004`
- `https://chainlinked.ai`, `https://www.chainlinked.ai`

### OAuth2

Google OAuth is configured for Google Drive backup access with the `openid`, `userinfo.email`, and `userinfo.profile` scopes.

---

## 5. Data Capture

### What Data Is Captured

#### Feed Posts
- Intercepted from Voyager feed endpoints (`voyagerFeedDashMainFeed`, `voyagerFeedDashFeedUpdate`, etc.)
- Extracted fields: `activity_urn`, `content` (post text), `media_type`, `media_urls`, `reactions`, `comments`, `reposts`, `impressions`, `posted_at`
- Posts are deduplicated by `activity_urn` and capped at 100 per storage key

#### Profile Analytics (Creator Analytics)
- Captured from `/voyager/api/contentcreation/creatorAnalytics` and DOM extraction on `/analytics/creator/content/`
- Fields: `impressions`, `membersReached`, `engagements`, `engagementRate`, `profileViews`, `searchAppearances`, `newFollowers`, `topPosts[]`

#### Profile Data
- Captured from Voyager identity endpoints and DOM extraction on `/in/{username}/`
- Fields: `memberUrn`, `publicIdentifier`, `firstName`, `lastName`, `headline`, `location`, `profilePhoto`, `connectionCount`, `followerCount`

#### Connections
- Intercepted from `voyagerRelationshipsDashConnections` endpoints
- Fields: `linkedinId`, `firstName`, `lastName`, `headline`, `profilePicture`, `publicIdentifier`, `connectedAt`, `connectionDegree`

#### Audience Data
- Captured from audience analytics endpoints and `/analytics/creator/audience/`
- Fields: `totalFollowers`, `followerGrowth`, `newFollowers`, `demographics` (industries, locations, seniority, companies, job titles)

#### Post Analytics (Individual)
- Captured from `/analytics/post-summary/urn:li:activity:{id}` pages
- Fields: `activityUrn`, `impressions`, `membersReached`, `reactions`, `comments`, `reposts`, `profileViewers`, `followersGained`, `engagementRate`

#### Notifications & Messaging
- Categorized from intercepted API responses (`voyagerNotificationsDash`, `messengerConversations`)
- Stored in `captured_apis` with category tags

#### Company Analytics
- Extracted from `/company/{slug}/analytics/` pages
- Fields: `companyId`, `companyName`, `followers`, `employees`, `pageViews`, `uniqueVisitors`

### API Interception (8 Interceptors)

The `main-world-interceptor.ts` patches these APIs at `document_start`:

1. **`fetch()`** -- Wraps the native fetch to intercept LinkedIn Voyager API responses
2. **`XMLHttpRequest.open/send`** -- Wraps XHR for older LinkedIn code paths
3. **`Response.json()`** -- Captures `.json()` consumption on response objects
4. **`Response.text()`** -- Captures `.text()` followed by `JSON.parse` patterns
5. **`JSON.parse`** -- Ultimate fallback for structure-detected LinkedIn data
6. **`Response.arrayBuffer()`** -- Captures binary JSON consumption
7. **Worker messages** -- Catches data from Web Workers
8. **ReadableStream** -- Captures streaming response consumption

### URL Categorization

Intercepted URLs are categorized by two strategies:

1. **GraphQL queryId matching** -- Maps `queryId=voyagerFeedDash...` parameters to categories using a comprehensive mapping of known Voyager endpoint prefixes (feed, myPosts, comments, reactions, messaging, profile, network, analytics, notifications, invitations, search, jobs, company, learning, events)

2. **URL path matching** -- Falls back to URL substring checks (e.g., `/feed/updates` -> feed, `/messaging` -> messaging)

3. **Structure-based detection** -- When URL categorization returns "other", examines the response JSON structure (e.g., checking `included[]` array `$type` values for `UpdateV2`, `Activity`, `Message`, etc.)

Known junk endpoints (ads, onboarding, migration, feature flags) are excluded via an explicit exclusion list.

### Deduplication

A hash-based deduplication system prevents the same API response from being dispatched twice within a 500ms window.

---

## 6. Background Service Worker

### Entry Point: `service-worker.ts`

The service worker is the central hub. It:

1. **Loads Supabase modules** via `importScripts()` at startup (client, auth, local-cache, sync, storage)
2. **Handles all message routing** via `chrome.runtime.onMessage` with a large `switch` statement covering 30+ message types
3. **Manages LinkedIn cookies** -- reads `li_at` (auth token), `JSESSIONID` (CSRF token), `lidc`, and `bcookie` via `chrome.cookies`
4. **Performs direct LinkedIn API calls** via `fetchLinkedInAPI()` using authenticated Voyager headers
5. **Extracts posts** from LinkedIn's normalized API responses (handles `included[]` arrays, URN references, GraphQL nested structures)
6. **Tracks history** -- maintains analytics history (90 days) and audience history with daily entries
7. **Manages capture stats** -- tracks total/successful/failed captures by type
8. **Handles external messages** from the webapp via `chrome.runtime.onMessageExternal`
9. **Broadcasts auth state changes** to all open ChainLinked webapp tabs

### Background Sync (`background-sync.ts`)

The background sync orchestrator runs autonomously using `chrome.alarms`:

- **Default interval**: 15 minutes with 2-minute random jitter
- **Minimum interval**: 10 minutes between cycles
- **Active hours only**: Can be configured to sync only during typical usage hours
- **Circuit breaker**: Trips after 3 consecutive failures, preventing runaway API calls
- **Exponential backoff**: Up to 6x multiplier on the base interval after failures
- **Endpoint toggles**: Each data type (analytics, profile, audience, myPosts, profileViews, networkInfo) can be independently enabled/disabled
- **State persistence**: All sync state survives service worker restarts via `chrome.storage.local`

### LinkedIn API Client (`linkedin-api.ts`)

Provides authenticated access to LinkedIn's Voyager API from the service worker:

- Reads `li_at` and `JSESSIONID` cookies via `chrome.cookies.get()`
- Builds headers matching LinkedIn's SPA requests (`x-li-track`, `csrf-token`, `x-restli-protocol-version`)
- Endpoints: creator analytics, profile data, audience data, user posts (GraphQL), profile views, network info
- 30-second timeout per request with AbortController

### Mention Search

The service worker implements LinkedIn user search for the webapp's @mention feature:

- Uses 5 fallback strategies: typeahead/hitsV2, GraphQL search with rotated queryId hashes, search/dash/clusters, legacy typeahead/hits, and broadest included[] scan
- Parses results from both legacy `MiniProfile` format and newer `EntityResultViewModel` GraphQL format
- Returns: name, URN, headline, avatar URL, public identifier

---

## 7. Content Scripts

### DOM Extraction (`dom-extractor.ts`)

Extracts data directly from LinkedIn's rendered HTML when API responses are not available:

- **Page detection**: Identifies page type by URL pathname (profile, analytics, post_analytics, demographics, profile_views, feed)
- **Profile extraction**: Name (10+ CSS selector fallbacks), headline, location, profile photo, background image, connection count, follower count, about section
- **Analytics extraction**: Impressions, engagements, members reached, growth rate, profile views, search appearances, top posts
- **Post analytics**: Activity URN, impressions, members reached, reactions/comments/reposts, profile viewers, followers gained, engagement rate
- **Audience data**: Total followers, follower growth, new followers
- **Demographics**: Industries, locations, seniority, companies, job titles with percentage breakdowns

### Auto-Capture Controller (`auto-capture.ts`)

Manages automatic data capture as the user navigates LinkedIn:

- **Page pattern matching**: Regex patterns for post summary, post demographics, audience demographics, creator content/top-posts/audience, profile views, and profile pages
- **Capture tracking**: Maintains a status dashboard of which data types have been captured this session (profile, creator_analytics, audience_analytics, top_posts, profile_views, audience_demographics, dashboard)
- **Timing**: 1-second capture delay after page detection, 5-minute debounce between captures of the same type, 500ms URL polling interval
- **Validation**: Uses shared validators to verify captured data quality before sending to the service worker
- **Retry mechanism**: Leverages shared retry utilities with exponential backoff for message delivery

### Company Extractor (`company-extractor.ts`)

Detects and extracts data from LinkedIn company pages:

- Pattern matching for `/company/{slug}/`, `/company/{slug}/analytics/`, `/company/{slug}/admin/`, `/company/{slug}/posts/`
- Extracts company name, ID, follower count, employee count, page views, and content calendar data

---

## 8. Popup UI

The popup (`App.tsx`) is a compact 320x480px React application built with Vite and styled with Tailwind CSS.

### States

1. **Loading** -- Spinner while checking auth status
2. **Unauthenticated** -- Shows sign-in form (email/password), Google sign-in button, and sign-up toggle
3. **Authenticated** -- Shows account info (email, avatar initial), "Open Dashboard" link to `chainlinked.ai/login`, auto-capture status indicator, LinkedIn connection status, and sign-out button

### Authentication Methods

- **Email/password** -- Via `SUPABASE_AUTH_SIGN_IN` / `SUPABASE_AUTH_SIGN_UP` messages to the service worker
- **Google OAuth** -- Via `SUPABASE_AUTH_GOOGLE` message, which opens the platform login tab and prompts the user to complete sign-in there

### Data Flow

The popup communicates with the service worker exclusively via `chrome.runtime.sendMessage`:
- `SUPABASE_AUTH_STATUS` -- Check current auth state
- `GET_COOKIES` -- Check LinkedIn login status
- `SUPABASE_SYNC_NOW` -- Trigger immediate sync after sign-in

---

## 9. Communication

### Extension <-> Supabase

The extension communicates with Supabase through a custom lightweight client (`lib/supabase/client.js`) that uses raw `fetch` instead of the full Supabase JS SDK (to avoid bundle size in the service worker).

- **Authentication**: JWT-based. Sessions are stored in `chrome.storage.local` under the `supabase_session` key. Token refresh is handled automatically by the auth client.
- **Database operations**: REST API calls to `https://baurjucvzdboavbcuxjh.supabase.co/rest/v1/{table}`. Supports SELECT, INSERT, UPDATE, UPSERT, DELETE with PostgREST filter syntax.
- **Realtime**: WebSocket connection to Supabase Realtime for live data subscriptions.
- **Retry**: `fetchWithRetry` handles transient "Failed to fetch" errors common during MV3 service worker wake-up (exponential backoff, max 3 retries).

### Extension <-> Webapp

Two communication channels exist:

1. **`chrome.runtime.sendMessageExternal`** (direct) -- The webapp can send messages directly to the extension if it knows the extension ID. Used for `CHAINLINKED_PING` (status check) and `CHAINLINKED_PUSH_SESSION` (auto-login).

2. **Content script bridge** (indirect) -- For pages where the extension ID is not known:
   - `webapp-bridge.ts` (MAIN world) sets `window.__CHAINLINKED_EXTENSION__ = true` and a hidden DOM marker
   - The webapp detects the extension via these markers
   - Messages flow: webapp -> `postMessage` -> `webapp-bridge.ts` (MAIN) -> `postMessage` -> `webapp-relay.ts` (ISOLATED) -> `chrome.runtime.sendMessage` -> service worker
   - Responses flow back through the same chain in reverse

3. **Auth state broadcasts** -- When the extension's auth state changes, the service worker broadcasts `CHAINLINKED_AUTH_STATE_CHANGED` to all open webapp tabs via `chrome.tabs.sendMessage`, which the relay forwards to the page.

### Extension <-> LinkedIn DOM and APIs

- **Content scripts** run on `*.linkedin.com` and have access to the page DOM
- **MAIN world interceptor** shares JavaScript context with LinkedIn's code, enabling API patching
- **Service worker** makes direct authenticated requests to LinkedIn's Voyager API using cookies read via `chrome.cookies`
- Data flows from interceptor (MAIN) -> content script (ISOLATED) -> service worker -> chrome.storage / Supabase

---

## 10. Authentication

### Supabase Authentication

The extension supports three sign-in methods:

1. **Email/Password** -- Standard Supabase email auth. Sign-up with email confirmation, sign-in with stored credentials.

2. **Google OAuth** -- Uses `chrome.identity.getAuthToken()` to get a Google OAuth token, then exchanges it with Supabase via `signInWithIdToken`. The OAuth client ID is configured in `manifest.json` under `oauth2`.

3. **Auto-login from Webapp** -- When the user is signed into the ChainLinked webapp but not the extension:
   - The `webapp-bridge.ts` script checks if the extension is logged in
   - If not, it reads the Supabase session from the webapp's `localStorage` (key pattern: `sb-*-auth-token`)
   - It pushes the session to the extension via the relay chain
   - The service worker saves the session and sets the Supabase client auth state
   - The webapp can also push sessions directly via `CHAINLINKED_PUSH_SESSION` external message

### Session Management

- Sessions are stored in `chrome.storage.local` under `supabase_session`
- The service worker restores the userId on startup by checking the auth module first (with token refresh), then falling back to stored session data
- Expired JWTs are detected and not set on the Supabase client; refresh tokens are used to obtain new access tokens
- Auth state changes trigger broadcasts to all webapp tabs for instant UI updates

### LinkedIn Authentication

The extension does not log into LinkedIn. Instead, it reads existing LinkedIn session cookies:

- `li_at` -- LinkedIn auth token (presence indicates the user is logged in)
- `JSESSIONID` -- CSRF token (stripped of quotes, used as `csrf-token` header)
- `lidc` -- Data center cookie
- `bcookie` -- Browser ID cookie

These cookies are read via `chrome.cookies.get()` and included in Voyager API requests.

---

## 11. Data Sync Pipeline

```
LinkedIn (browser)
       |
       v
[Main World Interceptor]  -- patches fetch/XHR/JSON.parse
       |
  postMessage (__CL_API_CAPTURED__)
       |
       v
[Content Script]  -- categorizes, forwards to service worker
       |
  chrome.runtime.sendMessage (API_CAPTURED)
       |
       v
[Service Worker]
  |-- Save to chrome.storage.local (per-category, max 50 items)
  |-- Extract individual posts from API response
  |-- Save posts to linkedin_my_posts / linkedin_feed_posts
  |-- Queue for Supabase sync (lightweight version, no raw response blob)
       |
       v
[Supabase Sync Bridge]
  |-- Map storage key -> Supabase table name
  |-- Convert camelCase fields -> snake_case
  |-- Add user_id to every record
  |-- Upsert to Supabase via REST API
       |
       v
[Supabase PostgreSQL]
       |
       v (Inngest cron, every 5 min)
[dailySnapshotPipeline]
  |-- Reads from my_posts, linkedin_profiles, linkedin_analytics
  |-- Upserts into daily_account_snapshots (account-level)
  |-- Upserts into daily_post_snapshots (per-post)
  |-- Same-day runs UPDATE existing row; new day = new INSERT
       |
       v
[Analytics Dashboard & Analytics Page]
```

> **Note:** The extension syncs data to `my_posts`, `linkedin_profiles`, and `linkedin_analytics` tables. The `dailySnapshotPipeline` (Inngest, every 5 min) then aggregates this data into `daily_account_snapshots` and `daily_post_snapshots` for the analytics dashboard.

### Offline-First Queue

1. Data is always saved to `chrome.storage.local` first
2. If the user is authenticated and the key is syncable, the data is queued in `supabase_pending_changes`
3. `processPendingChanges()` attempts to sync queued items to Supabase
4. Failed syncs remain in the queue for retry
5. The `LocalCache` class monitors online/offline status and processes the queue when connectivity returns

### Background Sync Pipeline

Independent of passive capture, the background sync actively fetches data:

1. `chrome.alarms` fires the `linkedin-background-sync` alarm
2. `handleBackgroundSyncAlarm()` checks if enough time has elapsed and the circuit breaker is not tripped
3. For each enabled endpoint, `fetchEndpoint()` calls the Voyager API with authenticated headers
4. Results are saved to the same chrome.storage keys used by passive capture
5. Data is queued for Supabase sync via `saveWithSync()` / `queueForSync()`

---

## 12. Settings & Configuration

### Auto-Capture Settings

Stored in `chrome.storage.local` under `linkedin_capture_settings`:
- Enable/disable auto-capture globally
- Per-capture-type debounce tracking

### Background Sync Config

Stored under `background_sync_config`:
- `enabled` (boolean) -- Master toggle (default: false)
- `baseIntervalMinutes` (number) -- Base sync interval (default: 15 minutes)
- `jitterMinutes` (number) -- Random jitter added to interval (default: 2)
- `maxApiCallsPerSync` (number) -- Max API calls per cycle (default: 4)
- `activeHoursOnly` (boolean) -- Only sync during active hours (default: true)
- `maxConsecutiveFailures` (number) -- Circuit breaker threshold (default: 3)
- `endpoints` -- Per-endpoint toggles (analytics, profile, audience, myPosts, profileViews, networkInfo)

### Notification Settings

Stored under `notification_settings`:
- `captureNotifications` -- Show notifications on successful captures
- `backupNotifications` -- Show backup success/failure notifications
- `growthAlerts` -- Show growth milestone alerts
- `silentMode` -- Suppress all notifications
- `quietHoursEnabled` / `quietHoursStart` / `quietHoursEnd` -- Quiet hours configuration

### Google Drive Backup Settings

Stored under `drive_sync_settings`:
- `enabled` -- Enable Drive backup
- `autoSync` -- Automatic backup toggle
- `syncFrequency` -- Backup frequency (daily, weekly)
- `keepBackups` -- Number of backups to retain (default: 5)

---

## 13. Installation & Development

### Prerequisites

- Node.js (for building)
- Chrome browser
- A LinkedIn account (for data capture)
- Supabase project (pre-configured; URL and anon key are in `lib/supabase/client.js`)

### Development Setup

```bash
# Navigate to extension directory
cd extension/

# Install dependencies
npm install

# Build everything (popup + scripts)
npm run build

# Or watch mode for development
npm run dev
```

### Build Process

The build uses two tools:

1. **Vite** (`npm run build:popup`) -- Builds the React popup UI from `src/popup/` to `dist/popup/`
2. **esbuild** (`npm run build:scripts`) -- Bundles TypeScript service worker and content scripts as IIFE format to `dist/background/` and `dist/content/`

The `esbuild.config.js` also:
- Copies `manifest.json` to `dist/`
- Copies icons to `dist/icons/`
- Copies `lib/supabase/*.js` to `dist/lib/supabase/`
- Copies `content/injected.js` and `content/styles.css` to `dist/content/`
- Creates `dist/popup/popup.html` from the Vite output with corrected paths

### Loading in Chrome

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension/dist/` directory
6. The extension icon appears in the toolbar

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode -- rebuilds on file changes (Vite + esbuild concurrently) |
| `npm run build` | Full production build (popup + scripts) |
| `npm run build:popup` | Build only the React popup |
| `npm run build:scripts` | Build only the service worker and content scripts |
| `npm run typecheck` | Run TypeScript type checking without emitting |
| `npm run clean` | Remove the `dist/` directory |

---

## 14. Key Supabase Tables Used

The extension writes to the following Supabase tables via the sync bridge. The mapping is defined in `supabase-sync-bridge.ts` (`STORAGE_TABLE_MAP`):

| Chrome Storage Key | Supabase Table | Description |
|--------------------|---------------|-------------|
| `linkedin_profile` | `linkedin_profiles` | User profile data (name, headline, location, connections, followers, profile URN) |
| `linkedin_analytics` | `linkedin_analytics` | Creator analytics (impressions, reach, engagements, followers, profile views, top posts) |
| `linkedin_post_analytics` | `post_analytics` | Individual post metrics (activity URN, impressions, reactions, comments, reposts, engagement rate) |
| `linkedin_audience` | `audience_data` | Audience demographics (total followers, growth, top job titles/companies/locations/industries) |
| `linkedin_connections` | `connections` | Connection list (LinkedIn ID, name, headline, profile picture, connected date, degree) |
| `linkedin_feed_posts` | `feed_posts` | Feed posts from other users (activity URN, content, media type, reactions, comments, posted date) |
| `linkedin_my_posts` | `my_posts` | User's own posts (activity URN, content, media type/URLs, reactions, comments, reposts, impressions, posted date) |
| `linkedin_comments` | `comments` | Post comments captured from API interception |
| `linkedin_followers` | `followers` | Follower data |
| `captured_apis` | `captured_apis` | Raw captured API endpoint metadata (endpoint, method, category, timestamp, response hash) |
| `auto_capture_stats` | `capture_stats` | Capture statistics (total/successful/failed counts, per-type breakdown, capture history) |
| `extension_settings` | `extension_settings` | User's extension settings synced to the cloud |
| `linkedin_analytics_history` | `analytics_history` | Daily analytics snapshots for trend tracking (date, impressions, members reached, profile views, engagements, followers) |
| `linkedin_audience_history` | `audience_history` | Daily audience snapshots for trend tracking (date, total followers, new followers) |

### Field Mapping

The sync bridge automatically converts camelCase JavaScript field names to snake_case database column names. Examples:

- `membersReached` -> `members_reached`
- `activityUrn` -> `activity_urn`
- `totalFollowers` -> `total_followers`
- `profileViews` -> `profile_views`
- `engagementRate` -> `engagement_rate`

Every synced record automatically receives:
- `user_id` -- The authenticated Supabase user's UUID
- Timestamps (`captured_at`, `updated_at`) as appropriate
