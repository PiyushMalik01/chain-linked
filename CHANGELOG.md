# Changelog

All notable changes to ChainLinked are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] - 2026-03-28

### Added
- **Supabase Realtime subscriptions** for dashboard and analytics: `useAnalytics`, `useAnalyticsV3`, `usePostAnalytics`, and `useMyRecentPosts` hooks now auto-refetch when the Chrome extension writes new data — no page reload needed
- 7 tables added to `supabase_realtime` publication with `REPLICA IDENTITY FULL`: `daily_account_snapshots`, `daily_post_snapshots`, `linkedin_analytics`, `post_analytics`, `my_posts`, `linkedin_profiles`, `followers`
- **Duplicate company detection in onboarding**: when a user creates a company that already matches an existing name, the form shows the existing company and offers a "Send Join Request" button instead of silently creating a duplicate
- **Full inline company context editor in Settings**: "Edit AI Context & Company Info" now opens the step 4 "Review Brand Context" UI inline (Company Information, Brand Identity, Products & Services, Target Audience/ICP, Tone & Voice) instead of a basic dialog
- `CompanyContextEditor` reusable component (`components/features/company-context-editor.tsx`) with section blocks, compose-style editors, and product dialog
- `checkExistingCompany()` function in `useCompany` hook for case-insensitive company name lookup with team info
- `onJoinRequestSent` callback prop on `CompanySetupForm` for onboarding flow integration
- Daily snapshot analytics pipeline: `daily_account_snapshots` and `daily_post_snapshots` tables with Inngest cron (every 5 min) for absolute-value daily tracking
- Analytics v3 API (`/api/analytics/v3`, `/api/analytics/v3/posts`) with delta/absolute modes and comparison periods
- Analytics v3 API now returns both `absolute` and `current` (delta) timeseries in a single response
- `useAnalyticsV3` hook with `absoluteData` and `multiAbsoluteData` for data table display
- Infinite scroll on Inspiration feed using IntersectionObserver (replaces manual "Load More" button)
- Seamless invite-to-signup flow: non-registered invitees auto-redirect to signup, shortened onboarding (LinkedIn connect only), auto-accept invite on completion
- Email notification: team owner notified when a new member joins
- Email notification: post author notified when scheduled post is published on LinkedIn
- `MemberJoinedTeamEmail` and `PostPublishedEmail` React Email templates
- Database indexes on `linkedin_research_posts`, `discover_posts`, and `influencer_posts` for faster feed queries

### Fixed
- Analytics data table now shows absolute daily values (e.g., 9,564 impressions) instead of deltas (e.g., 10)
- Dashboard metrics now read from `daily_account_snapshots` instead of stale `analytics_summary_cache`, eliminating incorrect +105300% change display
- Analytics page shows data only from user's first capture date (not historical post publication dates)
- Engagement breakdown uses snapshot capture dates instead of `posted_at`
- Posting frequency and best days charts use `created_at` (capture date)
- Edit with AI button: accurate positioning via mirror-div measurement (works at any scroll position)
- Edit with AI button: opaque background in both dark/light modes (was transparent due to Button outline variant)
- Post cards show actual numbers (9,554) instead of abbreviated (1.5K)
- PostHog debug mode disabled to eliminate console log spam and failed fetch retry storms
- Middleware profile query timeout reduced from 8s to 3s (worst-case page load reduced from 16s to 6s)

### Changed
- Settings "Edit AI Context" replaced basic dialog with full inline `CompanyContextEditor` (step 4 UI) — includes section blocks for Company Info, Brand Identity, Products, Target Audience, and Tone & Voice
- Company setup form now checks for existing companies before creating (case-insensitive match) and offers join request flow
- Analytics data table wired to absolute values; trend charts continue using deltas for growth visualization
- Inspiration feed cards use CSS animations instead of per-card Framer Motion stagger (eliminates 1.2s+ animation delay for 24 cards)
- Analytics page wired to v3 snapshot-based pipeline (replaces v2 delta-computation pipeline)
- Dashboard `useAnalytics` hook simplified to single `daily_account_snapshots` query (was 8 parallel queries across 5 tables)
- `formatMetricNumber` utility now returns locale-formatted numbers instead of K/M abbreviations

---

## [Unreleased] - 2026-03-24

### Added
- PostHog reverse proxy via Next.js rewrites (`/ingest/*`) to bypass ad blockers
- PostHog heatmaps enabled (`enable_heatmaps: true`)
- PostHog diagnostic console logs for debugging capture status
- `loadSavedDraft()` method in draft context for atomic draft loading
- `accumulativeTotal` field in analytics v2 API response
- Sentry error tracking integration (client, server, edge configs)
- Composite key validation in extension sync bridge before upsert
- Server-side analytics support via PostHog Node SDK

### Fixed
- Analytics pipeline now shows correct absolute totals (e.g., 9,486 impressions) instead of daily deltas (e.g., 9)
- `analytics-summary-compute` rewritten to use `post_analytics_accumulative` for lifetime totals
- Backfill seed rows now use today's date and actual metric values instead of `posted_at` date with zeros
- Extension `feed_posts` "null activity_urn" sync error caused by array-like objects with numeric keys
- Draft navigation race condition where clicking a different draft showed old compose content
- PostComposer now remounts on draft switch via `_loadId` nonce and `draftId` URL param
- `X-Frame-Options:DENY` replaced with CSP `frame-ancestors` to allow PostHog toolbar
- Authentication flow improvements including team auto-creation on signup, account deletion handling, and data sync reliability
- Miscellaneous stability updates

### Changed
- Extension background sync interval: 4 hours → 15 minutes (with 2-min jitter)
- Analytics pipeline cron: daily midnight → every 5 minutes
- Summary cache compute cron: every 4 hours → every 5 minutes
- Min sync guard interval: 30 minutes → 10 minutes
- Analytics summary bar uses `accumulativeTotal` for all metric types (not just profile)
- `skipTrailingSlashRedirect` enabled for PostHog endpoint compatibility
- `NEXT_PUBLIC_POSTHOG_HOST` changed to `/ingest` (proxy path)

---

## 2026-03-20

### Added
- Default hashtags settings now persist to Supabase so they carry across sessions
- Auto-login for the Chrome extension using the webapp session, eliminating double sign-in
- Compose persistence, schedule pipeline enhancements, and a major scraping overhaul across multiple features
- Privacy policy page at `/privacy`

### Fixed
- Character limit validation now uses Unicode code-point counting instead of `.length`, correctly handling emoji and multi-byte characters

### Changed
- Privacy page redesigned to match the platform's visual theme

---

## 2026-03-17

### Added
- Inspiration tab redesign with smart search, analytics pipeline fixes, and an overhauled scraping system

### Fixed
- Apify scraper now uses the `targetUrls` parameter with diagnostic logging for better debugging
- Influencer scraping fetches all of a user's tracked influencers on event trigger instead of only the first
- Improved influencer matching logic and event-trigger filtering to reduce missed or duplicate scrapes

---

## 2026-03-13 - 2026-03-14

### Added
- AI state retention across sessions: series chat persistence and a new Settings AI Context dialog
- Carousel AI editor with draft persistence, circular JSON fix, and session restore
- Compose series mode with inline edit-with-AI capability

### Fixed
- Logout now properly redirects to the login page; all hardcoded localhost and Vercel URLs replaced with `chainlinked.ai`
- Extension background sync correctly handles reposts and verifies post ownership before attributing analytics

---

## 2026-03-06

### Added
- Apify-powered influencer scraping pipeline for inspiration content
- Team join flow improvements and miscellaneous UI fixes
- Extension now recognizes `chainlinked.ai` domain for detection

### Fixed
- `search_teams_fuzzy` RPC return type resolved, unblocking production builds

---

## 2026-03-01

### Added
- Dual-mode compose experience with multi-question AI chat and rich context injection

---

## 2026-02-27

### Added
- Lottie-based empty state illustrations throughout the app
- Resend-powered transactional email pipeline for invites and notifications
- Remix settings retention so AI regeneration keeps prior style choices
- Inngest analytics cron job for background data processing
- Smart AI template auto-generation cron with a unified template UI
- Saves and sends columns in analytics; engagement rate now calculated from actual metrics
- Complete analytics pipeline with auto-sync, nine new database tables, Inngest cron, and a redesigned analytics dashboard

### Fixed
- Auth flow hardening: improved invite acceptance, extension detection, and analytics backfill reliability

---

## 2026-02-24

### Fixed
- Comprehensive codebase audit addressing security vulnerabilities, bugs, performance bottlenecks, and code quality issues

---

## 2026-02-20 - 2026-02-21

### Added
- `@mention` tagging in the composer powered by extension-based LinkedIn profile search
- Brand kit extraction via Brandfetch API and redesigned team management pages
- Template library redesign with modular architecture and custom category support
- Dashboard restructured with a LinkedIn-style three-column layout, sidebar navigation overhaul, and email verification prompt
- Analytics and Goals page redesign with metric selector and goal tracker
- Team Activity page with animated capsule tabs and post grid with popup detail view
- Saved Drafts page with grid layout and quick actions
- Unified Inspiration / Discover / Swipe tabbed page replacing three separate routes
- Settings page redesigned with sidebar navigation; template library gains AI-generated templates
- Swipe auto-refill Inngest cron job to keep the swipe deck populated
- Auto-save drafts on navigate-away with AI context persistence
- Schedule calendar integrated into the dashboard layout with inline greeting
- AI generation context persistence and discover content improvements
- Extension banner capture, auto-capture UI, and Vercel environment detection

### Fixed
- Emoji picker button click handling and popover integration in the composer
- Removed `lottie-react` dependency that caused build failures
- Discover article ingest pipeline and Inngest event routing corrected
- Dashboard updated to use theme tokens; Goals widget removed; layout polished
- Drafts page now uses theme colors with fixed card heights
- Sidebar no longer references a stale compose route; "Views" renamed to "Impressions" in analytics cards

### Changed
- Authentication pages updated with the ChainLinked logo replacing placeholder icons; server-side signup added

---

## 2026-02-19

### Infrastructure
- Repository cleanup: removed screenshots, planning documents, and updated `.gitignore`

---

## 2026-02-13 - 2026-02-16

### Added
- Media gallery, compose redesign, canvas editor refactor, and full platform polish pass

### Fixed
- Extension popup freeze resolved; AI context override in compose and carousel editors fixed

---

## 2026-02-07 - 2026-02-10

### Added
- Posts page with chart color fixes, improved Discover page, and QA asset updates
- Database migrations for collections, carousels, and extension tables
- PostHog client-side analytics integration, sidebar updates, and type improvements
- Brand kit settings tab connected to saved API data
- Five-step onboarding flow with brand kit extraction
- Enhanced Chrome extension with robust data capture and sync pipeline
- Chrome extension installation prompt for new users
- `PartialLoader` component with staggered loading animations

### Fixed
- Data sync, auth batching, CORS proxy, and company context lookup issues resolved
- Viral tags removed from Discover; content card display improved

### Documentation
- Front-end quality audit completed
- Extension capture completeness verified and documented
- Development task list and workflow rules added
- Development task list and QA testing checklist created

---

## [1.0.0] - 2026-01-31 — v1 Complete

### Added
- Deep research feature with generated posts display
- Chrome extension for LinkedIn data capture
- Complete v1 platform milestone reached

---

## 2026-01-17

### Fixed
- Auth session configured to use `localStorage` for reliable persistence
- `INITIAL_SESSION` event handling restored for page-reload auth restoration
- Page reload no longer shows only skeleton loaders indefinitely
- Auth race condition in `useAuthContext` eliminated
- Skeleton flash on initial load removed with instant demo data hydration
- Demo data fallbacks added to prevent endless skeleton loading states

### Added
- Complete ChainLinked platform features (analytics, scheduling, team management, and more)

### Infrastructure
- Auth debugging logs added to diagnose session persistence issues

---

## 2026-01-14 - 2026-01-16

### Added
- Complete authentication integration (sign-up, sign-in, session management)
- Core Supabase infrastructure and API routes
- Schedule page connected to real Supabase data
- Dashboard connected to real Supabase data
- Analytics dashboard connected to real Supabase data

### Changed
- Mock data fallbacks removed from Dashboard and Team pages, replaced with live Supabase queries

---

## 2026-01-12 — Initial Build

### Added
- Phase 5: Mobile polish improvements (responsive design, touch interactions)
- Phase 4: Accessibility improvements (focus management, ARIA labels, keyboard navigation)
- Phase 3: Core PostComposer features (rich text editing, LinkedIn preview, character counter)
- Phase 2: Connected user flows (navigation between features, shared state)
- Phase 1: UX feedback infrastructure (toasts, loading indicators, transitions)
- Skeleton loading screens for all nine dashboard pages
- Sidebar navigation with differentiated dashboard vs. analytics routes
- Complete LinkedIn content management platform v0.2.0 (dashboard, team activity, analytics, scheduling, inspiration, settings)
- All remaining frontend components v0.3.0

### Fixed
- Lint errors in new components resolved
- QA issues in feature components addressed
- Sidebar navigation corrected to properly distinguish dashboard from analytics

---

## 2026-01-12 — Project Init

- Initial commit from Create Next App
