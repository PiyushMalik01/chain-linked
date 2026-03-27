# ChainLinked Architecture Documentation

> Last updated: 2026-03-28

ChainLinked is a LinkedIn content management platform for teams. It combines a Next.js 16 web application, a Chrome extension for LinkedIn data capture, Supabase for database/auth, and Inngest for background job orchestration.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Application Architecture](#2-application-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Data Flow](#4-data-flow)
5. [State Management](#5-state-management)
6. [Authentication Architecture](#6-authentication-architecture)
7. [Background Jobs](#7-background-jobs)
8. [External Integrations](#8-external-integrations)
9. [Styling Architecture](#9-styling-architecture)
10. [Key Design Patterns](#10-key-design-patterns)

---

## 1. System Architecture Overview

```
+---------------------+         +---------------------+        +-----------------------+
|   Chrome Extension  |         |   Next.js Webapp    |        |   External APIs       |
|                     |         |   (App Router)      |        |                       |
|  - Content Script   |  sync   |  - Dashboard        |  HTTP  |  - OpenAI (GPT)       |
|  - DOM Extractor    |-------->|  - Composer         |<------>|  - Perplexity         |
|  - API Interceptor  |         |  - Analytics        |        |  - Brandfetch         |
|  - Background Sync  |         |  - Team Activity    |        |  - Apify              |
|  - Service Worker   |         |  - Templates        |        |  - Tavily             |
|                     |         |  - Carousels        |        |  - Unsplash           |
+--------+------------+         |  - Scheduling       |        |  - Logo.dev           |
         |                      +--------+------------+        |  - Resend (email)     |
         |                               |                     |  - Firecrawl          |
         |                               |                     +-----------------------+
         |          +--------------------+---------------------+
         |          |                                          |
         v          v                                          v
+---------------------+                              +---------------------+
|   Supabase          |                              |   Inngest           |
|                     |                              |                     |
|  - PostgreSQL DB    |<---------------------------->|  - Cron Jobs        |
|  - Auth (email,     |       read/write             |  - Event-driven     |
|    Google OAuth)    |                              |    Workflows        |
|  - Row Level        |                              |  - Analytics        |
|    Security (RLS)   |                              |    Pipeline         |
|  - Realtime         |                              |  - Content Ingest   |
|  - Storage          |                              |  - Post Publishing  |
+---------------------+                              +---------------------+
         ^
         |
+---------------------+
|   PostHog           |
|   (Analytics &      |
|    Session Replay)  |
+---------------------+
```

### Core Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Webapp** | Next.js 16, React 19, Tailwind CSS v4 | Dashboard, composer, analytics, team management |
| **Chrome Extension** | Vite, React, Chrome APIs | LinkedIn data capture, API interception, background sync |
| **Database** | Supabase PostgreSQL | User data, posts, analytics, team configuration |
| **Auth** | Supabase Auth | Email/password, Google OAuth, PKCE flow |
| **Background Jobs** | Inngest | Cron-based analytics, content ingest, post publishing |
| **Analytics** | PostHog | Product analytics, session replay, user identification |

---

## 2. Application Architecture

### Next.js App Router Structure

The application uses Next.js 16 with the App Router pattern. All routes live under `app/`.

```
Request Flow:

  Browser Request
       |
       v
  +------------------+
  |   middleware.ts   |  Session refresh, auth guards,
  |                   |  onboarding redirects
  +--------+---------+
           |
           v
  +------------------+
  |  app/layout.tsx   |  Root HTML shell, fonts,
  |  (Server)         |  <Providers> wrapper
  +--------+---------+
           |
           v
  +------------------+
  |  Providers        |  ThemeProvider > AuthProvider >
  |  (Client)         |  PostHogProvider > ApiKeysProvider >
  |                   |  DraftProvider
  +--------+---------+
           |
           +----------+----------+
           |                     |
           v                     v
  +------------------+  +--------------------+
  | Public Pages      |  | dashboard/layout   |
  | /login, /signup,  |  | (Client)           |
  | /onboarding/*     |  | Auth guard +       |
  |                   |  | SidebarProvider +   |
  |                   |  | DashboardProvider   |
  +------------------+  +--------+-----------+
                                 |
                                 v
                        +--------------------+
                        | Dashboard Pages     |
                        | /dashboard/*        |
                        | /dashboard/compose  |
                        | /dashboard/analytics|
                        | /dashboard/team     |
                        +--------------------+
```

### Server vs Client Components

- **Server Components** (default): Used for the root layout, static pages, and data-fetching entry points. Server components use the Supabase server client (`lib/supabase/server.ts`) which reads cookies via `next/headers`.
- **Client Components** (`"use client"`): Used for any component requiring interactivity, hooks, browser APIs, or context consumption. The dashboard layout, sidebar, providers, and all interactive features are client components. Client components use the Supabase browser client (`lib/supabase/client.ts`).

### Middleware Auth Flow

The middleware (`middleware.ts`) runs on every non-static request and handles:

1. **Session Refresh**: Creates a Supabase server client and calls `getUser()` to refresh JWT tokens. Updated cookies are forwarded via `redirectWithCookies()`.
2. **Stray OAuth Codes**: If a `?code=` parameter lands on the wrong page (not `/api/auth/callback`), it is redirected to the proper callback route.
3. **Protected Route Guard**: Routes starting with `/dashboard`, `/composer`, `/schedule`, `/team`, `/templates`, `/settings`, or `/onboarding` redirect unauthenticated users to `/login?redirect=<original_path>`.
4. **Auth Page Redirect**: Already-authenticated users on `/login` or `/signup` are redirected to `/dashboard` (or to invitation/extension callback URLs if specified).
5. **Onboarding Guard**: Authenticated users accessing `/dashboard` who have not completed onboarding are redirected to their current onboarding step. Conversely, users who have completed onboarding are redirected away from onboarding pages.
6. **Profile Queries with Timeout**: Profile checks use `Promise.race` with an 8-second timeout and fail-open semantics, so a slow database never blocks the user.

**Matcher config** excludes static assets (`_next/static`, `_next/image`, images, favicon).

### API Routes

All API routes are under `app/api/` and use Next.js Route Handlers:

| Route Group | Purpose |
|------------|---------|
| `api/auth/*` | Signup, callback, Google token exchange, password reset, account deletion |
| `api/linkedin/*` | OAuth connect/disconnect/callback, posting (official API + Voyager), status |
| `api/ai/*` | Compose chat, carousel generation, remix, edit selection, company analysis |
| `api/inngest` | Inngest webhook handler (serves all 15 background functions) |
| `api/research/*` | Deep research sessions, post research, start/status endpoints |
| `api/swipe/*` | Suggestion generation, generation status |
| `api/discover/*` | News, topics, post import |
| `api/prompts/*` | Prompt CRUD, versioning, activation, rollback, analytics |
| `api/carousel-templates/*` | Carousel template management, categories, favorites |
| `api/settings/*` | API key management |
| `api/teams/[teamId]/*` | Team members, invitations, join requests |
| `api/brand-kit/*` | Brand kit extraction and management |
| `api/analytics/*` | Analytics data (v1, v2, and v3 snapshot-based) |
| `api/influencers/*` | Influencer management and post scraping |
| `api/inspiration/*` | Inspiration feed search |
| `api/posts/*` | Post management |
| `api/drafts/*` | Draft auto-save |

---

## 3. Folder Structure

```
ChainLinked/
|
+-- app/                          # Next.js App Router
|   +-- layout.tsx                # Root layout (Server) - fonts, Providers, theme toggle
|   +-- globals.css               # Design system: CSS variables, light/dark themes
|   +-- page.tsx                  # Landing page
|   +-- login/                    # Login page
|   +-- signup/                   # Signup page
|   +-- forgot-password/          # Password recovery
|   +-- reset-password/           # Password reset form
|   +-- verify-email/             # Email verification
|   +-- invite/[token]/           # Team invitation acceptance
|   +-- auth/extension-callback/  # Extension auth callback
|   +-- onboarding/               # Multi-step onboarding flow
|   |   +-- page.tsx              # Role selection (owner vs member)
|   |   +-- layout.tsx            # Onboarding layout shell
|   |   +-- step1/ - step4/      # Owner/company onboarding steps
|   |   +-- join/                 # Member join flow + pending approval
|   |   +-- company/              # Company setup
|   |   +-- company-context/      # Company context configuration
|   |   +-- brand-kit/            # Brand kit setup
|   |   +-- invite/               # Invite team members
|   +-- dashboard/                # Protected dashboard area
|   |   +-- layout.tsx            # Dashboard shell (Client) - auth guard, sidebar, header
|   |   +-- page.tsx              # Dashboard home
|   |   +-- analytics/            # Analytics dashboard
|   |   +-- team/                 # Team activity + team settings
|   |   +-- compose/              # Post composer (rich editor with AI chat)
|   |   +-- drafts/               # Saved drafts
|   |   +-- templates/            # Template library
|   |   +-- inspiration/          # Curated viral posts
|   |   +-- carousels/            # Carousel creator (canvas editor)
|   |   +-- swipe/                # Tinder-style post suggestions
|   |   +-- schedule/             # Post scheduling
|   |   +-- discover/             # Content discovery + research
|   |   +-- posts/                # My posts
|   |   +-- prompts/              # Prompt management (admin)
|   +-- api/                      # API Route Handlers (see section 2)
|
+-- components/
|   +-- providers.tsx             # Global provider tree (theme, auth, PostHog, drafts)
|   +-- app-sidebar.tsx           # Main navigation sidebar with collapsible sections
|   +-- site-header.tsx           # Dashboard header with page title + actions
|   +-- nav-user.tsx              # Sidebar user avatar/menu
|   +-- posthog-provider.tsx      # PostHog analytics provider + user sync
|   +-- signup-form.tsx           # Reusable signup form
|   +-- error-boundary.tsx        # React error boundary
|   +-- skip-links.tsx            # Accessibility skip links
|   +-- onboarding-navbar.tsx     # Onboarding navigation bar
|   +-- OnboardingProgress.tsx    # Onboarding step indicator
|   +-- AiAnalysis.tsx            # AI analysis display component
|   +-- ui/                       # shadcn/ui primitives (new-york style)
|   |   +-- button, card, dialog, input, select, tabs, table, ...
|   |   +-- sidebar.tsx           # Sidebar compound component
|   |   +-- chart.tsx             # Recharts wrapper
|   |   +-- sonner.tsx            # Toast notifications (Sonner)
|   |   +-- animated-theme-toggler.tsx  # Floating theme toggle
|   |   +-- confirm-dialog.tsx    # Confirmation dialog
|   |   +-- partial-loader.tsx    # Partial page loader
|   |   +-- field.tsx             # Form field wrapper
|   +-- features/                 # Feature-specific components
|   |   +-- carousel-creator.tsx  # Canvas-based carousel editor
|   |   +-- canvas-editor/        # Canvas editor subcomponents
|   |   |   +-- ai-carousel-generator.tsx
|   |   |   +-- enhanced-ai-carousel-generator.tsx
|   |   |   +-- ai-content-generator.tsx
|   |   |   +-- template-selection-step.tsx
|   |   |   +-- topic-input-step.tsx
|   |   |   +-- tone-cta-step.tsx
|   |   |   +-- save-template-dialog.tsx
|   |   |   +-- editor-icon-rail.tsx
|   |   +-- template-library/     # Template CRUD components
|   |   |   +-- template-grid.tsx
|   |   |   +-- template-form-dialog.tsx
|   |   |   +-- template-preview-dialog.tsx
|   |   |   +-- template-empty-state.tsx
|   |   |   +-- category-filter-bar.tsx
|   |   +-- dashboard-tour/       # Guided onboarding tour
|   |   |   +-- dashboard-tour.tsx
|   |   |   +-- tour-overlay.tsx
|   |   |   +-- tour-tooltip.tsx
|   |   |   +-- tour-steps.ts
|   |   +-- remix-modal.tsx       # Post remix dialog
|   |   +-- linkedin-status-badge.tsx  # Extension connection indicator
|   |   +-- extension-install-prompt.tsx  # Extension install CTA
|   |   +-- goals-tracker.tsx     # Posting goals tracker
|   |   +-- generation-progress.tsx  # AI generation progress bar
|   |   +-- prompt-playground.tsx # AI prompt testing
|   |   +-- prompt-analytics.tsx  # Prompt performance metrics
|   |   +-- prompt-diff-viewer.tsx  # Prompt version diff
|   |   +-- prompt-version-history.tsx
|   |   +-- api-key-settings.tsx  # API key configuration
|   |   +-- post-type-selector.tsx
|   |   +-- post-goal-selector.tsx
|   |   +-- post-actions-menu.tsx
|   |   +-- font-picker.tsx       # Font selection for carousels
|   |   +-- manage-topics-modal.tsx
|   |   +-- topic-selection-overlay.tsx
|   |   +-- discover-news-card.tsx
|   |   +-- discover-trending-sidebar.tsx
|   |   +-- article-detail-dialog.tsx
|   |   +-- company-onboarding-form.tsx
|   |   +-- company-setup-form.tsx
|   |   +-- pending-invitations.tsx
|   |   +-- pending-invitations-card.tsx
|   +-- shared/                   # Reusable non-UI components
|   |   +-- empty-state.tsx       # Generic empty state pattern
|   |   +-- cross-nav.tsx         # Cross-page navigation
|   |   +-- markdown-content.tsx  # Markdown renderer
|   +-- landing/                  # Landing page sections
|   |   +-- hero.tsx, features-grid.tsx, about-section.tsx
|   |   +-- cta-banner.tsx, footer.tsx, navbar.tsx
|   +-- emails/                   # React email templates
|   |   +-- email-verification.tsx
|   |   +-- team-invitation.tsx
|   |   +-- welcome-to-team.tsx
|   |   +-- member-joined-team.tsx
|   |   +-- post-published.tsx
|   +-- debug/                    # Debug utilities
|       +-- session-replay-debug.tsx
|
+-- hooks/                        # Custom React hooks (50+)
|   +-- use-auth.ts               # Auth helpers
|   +-- use-analytics.ts          # Analytics data fetching
|   +-- use-analytics-v2.ts       # V2 analytics (rollup-based, legacy)
|   +-- use-analytics-v3.ts       # V3 analytics (snapshot-based, primary)
|   +-- use-post-analytics.ts     # Per-post performance
|   +-- use-drafts.ts             # Draft CRUD
|   +-- use-auto-save.ts          # Auto-save drafts
|   +-- use-templates.ts          # Template management
|   +-- use-template-categories.ts # Template categories
|   +-- use-carousel.ts           # Carousel state management
|   +-- use-carousel-templates.ts # Carousel template management
|   +-- use-canvas-editor.ts      # Canvas editor state
|   +-- use-compose-mode.ts       # Compose page state
|   +-- use-swipe-suggestions.ts  # Swipe card suggestions
|   +-- use-swipe-actions.ts      # Swipe accept/reject actions
|   +-- use-generated-suggestions.ts  # AI suggestion generation status
|   +-- use-team.ts               # Team data fetching
|   +-- use-team-posts.ts         # Team activity posts
|   +-- use-team-leaderboard.ts   # Team performance ranking
|   +-- use-team-invitations.ts   # Team invitations
|   +-- use-invitations.ts        # User invitations
|   +-- use-join-requests.ts      # Team join requests
|   +-- use-inspiration.ts        # Inspiration feed
|   +-- use-discover.ts           # Content discovery
|   +-- use-discover-news.ts      # News feed
|   +-- use-research.ts           # Deep research sessions
|   +-- use-writing-style.ts      # User writing style analysis
|   +-- use-brand-kit.ts          # Brand kit management
|   +-- use-brand-kit-templates.ts # Brand kit template generation
|   +-- use-company.ts            # Company settings
|   +-- use-settings.ts           # User settings
|   +-- use-api-keys.tsx          # API key management (provider + hook)
|   +-- use-prompts.ts            # Prompt CRUD
|   +-- use-prompt-editor.ts      # Prompt editor state
|   +-- use-prompt-versions.ts    # Prompt version history
|   +-- use-prompt-analytics.ts   # Prompt performance tracking
|   +-- use-prompt-history.ts     # Prompt change history
|   +-- use-linkedin-post.ts      # LinkedIn post publishing
|   +-- use-linkedin-document-post.ts  # Document/carousel posting
|   +-- use-scheduled-posts.ts    # Scheduled post management
|   +-- use-posting-config.ts     # Posting configuration
|   +-- use-posting-goals.ts      # Weekly posting goals
|   +-- use-content-rules.ts      # Content guidelines
|   +-- use-followed-influencers.ts  # Influencer tracking
|   +-- use-remix.ts              # Post remix logic
|   +-- use-mobile.ts             # Mobile detection
|   +-- use-graphics-library.ts   # Graphics/icon library
|   +-- use-dashboard-tour.ts     # Tour progress tracking
|   +-- use-posthog.ts            # PostHog analytics hooks
|   +-- use-conversation-persistence.ts  # AI chat persistence
|   +-- use-onboarding-guard.ts   # Client-side onboarding guard
|   +-- use-text-selection-popup.ts  # Text selection context menu
|   +-- use-minimum-loading.ts    # Minimum loading time for UX
|
+-- lib/                          # Core business logic and utilities
|   +-- utils.ts                  # cn() class merger, general utilities
|   +-- toast-utils.ts            # Toast notification helpers
|   +-- animations.ts             # Shared Framer Motion animation configs
|   +-- crypto.ts                 # Encryption utilities for API keys
|   +-- unicode-fonts.ts          # Unicode font transformations for posts
|   +-- pdf-export.ts             # PDF generation for carousels
|   +-- canvas-pdf-export.ts      # Canvas-based PDF export
|   +-- analytics.ts              # Analytics utilities
|   +-- category-utils.ts         # Content category helpers
|   +-- logo-dev.ts               # Logo.dev API client
|   +-- supabase/
|   |   +-- server.ts             # Server-side Supabase client (uses next/headers cookies)
|   |   +-- client.ts             # Browser-side Supabase client (PKCE flow, auto-refresh)
|   +-- auth/
|   |   +-- auth-provider.tsx     # AuthContext: user, profile, LinkedIn data, extension status
|   +-- store/
|   |   +-- draft-context.tsx     # DraftContext: in-memory draft state, media files, AI suggestions
|   +-- linkedin/
|   |   +-- oauth.ts              # LinkedIn OAuth 2.0 flow
|   |   +-- api-client.ts         # Official LinkedIn API client
|   |   +-- voyager-client.ts     # LinkedIn Voyager (internal) API client
|   |   +-- voyager-post.ts       # Voyager posting
|   |   +-- voyager-metrics.ts    # Voyager analytics metrics
|   |   +-- voyager-types.ts      # Voyager API type definitions
|   |   +-- voyager-constants.ts  # Voyager API constants
|   |   +-- post.ts               # Post creation via official API
|   |   +-- document-post.ts      # Document/carousel post upload
|   |   +-- mentions.ts           # @mention resolution
|   |   +-- posting-config.ts     # Posting configuration
|   |   +-- linkedin-service.ts   # Aggregated LinkedIn service
|   |   +-- types.ts              # LinkedIn API types
|   |   +-- index.ts              # Barrel export
|   +-- ai/
|   |   +-- openai-client.ts      # OpenAI API client
|   |   +-- compose-system-prompt.ts  # System prompt for post composition
|   |   +-- series-system-prompt.ts   # System prompt for post series
|   |   +-- carousel-prompts.ts   # Prompts for carousel content
|   |   +-- carousel-builder.ts   # AI carousel slide generation
|   |   +-- suggestion-prompts.ts # Prompts for swipe suggestions
|   |   +-- remix-prompts.ts      # Prompts for post remixing
|   |   +-- prompt-templates.ts   # Base prompt templates
|   |   +-- style-analyzer.ts     # Writing style analysis
|   |   +-- template-analyzer.ts  # Template analysis
|   |   +-- research-synthesizer.ts  # Research result synthesis
|   |   +-- post-types.ts         # Post type definitions
|   |   +-- post-quality-filter.ts   # Quality filtering for scraped posts
|   |   +-- anti-ai-rules.ts     # Rules to make AI output sound human
|   +-- inngest/
|   |   +-- client.ts             # Inngest client config + typed event definitions
|   |   +-- functions/            # All Inngest workflow functions
|   |       +-- index.ts          # Barrel export of all functions
|   |       +-- analyze-company.ts
|   |       +-- deep-research.ts
|   |       +-- generate-suggestions.ts
|   |       +-- suggestions-ready.ts
|   |       +-- daily-content-ingest.ts
|   |       +-- on-demand-content-ingest.ts
|   |       +-- swipe-auto-refill.ts
|   |       +-- analytics-pipeline.ts
|   |       +-- daily-snapshot-pipeline.ts
|   |       +-- analytics-summary-compute.ts
|   |       +-- analytics-backfill.ts
|   |       +-- first-sync-backfill.ts
|   |       +-- template-auto-generate.ts
|   |       +-- influencer-post-scrape.ts
|   |       +-- viral-post-ingest.ts
|   |       +-- publish-scheduled-posts.ts
|   |       +-- ingest-articles.ts
|   +-- perplexity/
|   |   +-- client.ts             # Perplexity API client
|   |   +-- research.ts           # Research query orchestration
|   |   +-- index.ts              # Barrel export
|   +-- research/
|   |   +-- tavily-client.ts      # Tavily search API client
|   +-- brandfetch/
|   |   +-- client.ts             # Brandfetch API client
|   |   +-- types.ts              # Brandfetch type definitions
|   +-- firecrawl/
|   |   +-- client.ts             # Firecrawl web scraping client
|   |   +-- scraper.ts            # Scraping orchestration
|   |   +-- brand-extractor.ts    # Brand data extraction from websites
|   |   +-- types.ts              # Firecrawl type definitions
|   |   +-- index.ts              # Barrel export
|   +-- apify/
|   |   +-- client.ts             # Apify web scraping client
|   +-- email/
|   |   +-- index.ts              # Email sending utilities
|   |   +-- resend.ts             # Resend email client
|   +-- extension/
|   |   +-- detect.ts             # Extension detection (PING/PONG protocol)
|   |   +-- linkedin-search.ts    # LinkedIn search via extension
|   +-- team/
|   |   +-- copy-context.ts       # Team context sharing utilities
|   +-- prompts/
|   |   +-- prompt-service.ts     # Prompt CRUD service
|   |   +-- prompt-cache.ts       # Prompt caching layer
|   |   +-- prompt-utils.ts       # Prompt utility functions
|   |   +-- prompt-types.ts       # Prompt type definitions
|   |   +-- prompt-defaults.ts    # Default prompt configurations
|   |   +-- index.ts              # Barrel export
|   +-- canvas-templates/         # Pre-built carousel templates
|   |   +-- index.ts, default-templates.ts
|   |   +-- minimal-template.ts, professional-template.ts
|   |   +-- creative-template.ts, story-template.ts
|   |   +-- financial-tips-template.ts
|   |   +-- cream-orange-entrepreneurship-template.ts
|   |   +-- white-minimal-time-management-template.ts
|   |   +-- brand-kit-template-generator.ts
|   +-- graphics-library/         # Icon/shape/image libraries for canvas
|   |   +-- icon-collection.ts, shape-collection.ts, unsplash.ts
|   +-- image/
|   |   +-- background-removal.ts # Background removal API
|   +-- dashboard-context.tsx     # DashboardContext: page title, header actions
|
+-- services/
|   +-- onboarding.ts             # Onboarding business logic
|
+-- types/                        # Shared TypeScript types
|   +-- database.ts               # Supabase generated database types
|   +-- index.ts                  # Shared application types
|   +-- carousel.ts               # Carousel/canvas types
|   +-- canvas-editor.ts          # Canvas editor types
|   +-- compose.ts                # Compose page types
|   +-- brand-kit.ts              # Brand kit types
|   +-- admin.ts                  # Admin types
|   +-- graphics-library.ts       # Graphics library types
|
+-- extension/                    # Chrome Extension (separate Vite build)
|   +-- src/
|   |   +-- background/           # Service worker and background processes
|   |   |   +-- service-worker.ts     # Main service worker entry point
|   |   |   +-- background-sync.ts    # Supabase sync from extension
|   |   |   +-- supabase-sync-bridge.ts  # Bridge between extension and Supabase
|   |   |   +-- linkedin-api.ts       # LinkedIn API calls from extension context
|   |   |   +-- google-auth.ts        # Google OAuth via chrome.identity
|   |   |   +-- drive-sync.ts         # Google Drive sync
|   |   |   +-- alarms.ts             # Chrome alarm scheduling for periodic tasks
|   |   |   +-- notifications.ts      # Chrome notification management
|   |   +-- content/              # Content scripts injected into LinkedIn
|   |   |   +-- content-script.ts     # Main content script entry
|   |   |   +-- main-world-interceptor.ts  # XHR/fetch interception in main world
|   |   |   +-- auto-capture.ts       # Automatic data capture on LinkedIn pages
|   |   |   +-- dom-extractor.ts      # DOM data extraction from LinkedIn UI
|   |   |   +-- company-extractor.ts  # Company page data extraction
|   |   |   +-- webapp-relay.ts       # Message relay from extension to webapp
|   |   |   +-- webapp-bridge.ts      # Bridge for webapp <-> extension communication
|   |   +-- popup/                # Extension popup UI (React + Vite)
|   |   |   +-- main.tsx              # Popup entry point
|   |   |   +-- components/           # Popup UI components
|   |   |   |   +-- Dashboard.tsx, Analytics.tsx, CompanyAnalytics.tsx
|   |   |   |   +-- ContentCalendar.tsx, QuickComposer.tsx, TrendChart.tsx
|   |   |   |   +-- ui/              # Popup UI primitives
|   |   |   +-- hooks/                # Popup hooks (useAnalytics, useStorage)
|   |   |   +-- lib/                  # Popup utilities
|   |   +-- shared/               # Shared utilities across extension
|   |       +-- types.ts              # Extension type definitions
|   |       +-- storage.ts            # Chrome storage wrapper
|   |       +-- indexeddb.ts          # IndexedDB for large data
|   |       +-- sync-types.ts         # Sync data type definitions
|   |       +-- validators.ts         # Data validators
|   |       +-- retry-utils.ts        # Retry logic with backoff
|   |       +-- history-manager.ts    # History tracking
|   +-- vite.config.ts            # Vite build configuration
|   +-- tsconfig.json             # Extension TypeScript config
|
+-- public/                       # Static assets (logo, favicon, images)
+-- docs/                         # Documentation
+-- middleware.ts                  # Auth + onboarding middleware
+-- next.config.ts                # Next.js config (image domains, security headers)
+-- tsconfig.json                 # TypeScript config (strict mode, @/* path alias)
```

---

## 4. Data Flow

### Chrome Extension to Dashboard

```
LinkedIn.com (browser)
       |
       | Content script injected
       v
+---------------------------+
| Content Script Layer       |
|                           |
| 1. main-world-interceptor |  Intercepts LinkedIn XHR/fetch
|    captures API responses |  (analytics, profile, posts)
|                           |
| 2. dom-extractor          |  Extracts visible data from DOM
|                           |
| 3. auto-capture           |  Periodic automated capture
|                           |
| 4. company-extractor      |  Company page data
+------------+--------------+
             |
             | Chrome message passing
             v
+---------------------------+
| Service Worker             |
|                           |
| background-sync.ts        |  Batches, deduplicates, and
| supabase-sync-bridge.ts   |  syncs captured data to Supabase
|                           |
| Sync targets:             |
| - linkedin_profiles       |
| - linkedin_analytics      |
| - my_posts                |
| - post_analytics          |
| - audience_data           |
| - connections             |
| - feed_posts              |
| - capture_stats           |
| - sync_metadata           |
+------------+--------------+
             |
             | HTTPS (Supabase client)
             v
+---------------------------+
| Supabase PostgreSQL        |
|                           |
| Tables written by ext:    |
| - linkedin_profiles       |
| - linkedin_analytics      |
| - analytics_history       |
| - post_analytics          |
| - my_posts                |
| - audience_data           |
| - audience_history        |
| - connections             |
| - feed_posts              |
| - capture_stats           |
| - sync_metadata           |
+------------+--------------+
             |
             | Supabase client (server or browser)
             v
+---------------------------+
| Next.js Dashboard          |
|                           |
| AuthProvider fetches:      |
| - profiles                |
| - linkedin_profiles       |  (parallel queries on auth)
| - linkedin_analytics      |
|                           |
| Hooks fetch on demand:    |
| - use-analytics.ts        |  Charts, metrics
| - use-analytics-v2.ts     |  Rollup-based analytics
| - use-post-analytics.ts   |  Per-post performance
| - use-team-posts.ts       |  Team activity feed
| - use-drafts.ts           |  Saved drafts
+---------------------------+
```

### AI Content Generation Flow

```
User Interaction (Compose Page)
       |
       v
+---------------------------+
| Client Hook                |
| (use-compose-mode.ts)     |
+------------+--------------+
             |
             | POST /api/ai/compose-chat
             v
+---------------------------+
| API Route Handler          |
| app/api/ai/compose-chat/  |
|                           |
| 1. Load user profile      |
| 2. Load writing style     |
| 3. Load company context   |
| 4. Load content rules     |
| 5. Apply anti-AI rules    |
| 6. Build system prompt    |
|    (compose-system-prompt) |
| 7. Call OpenAI API        |
| 8. Stream response (SSE)  |
+---------------------------+
```

### Swipe Suggestion Pipeline

```
Cron Trigger (Inngest)             User Request
       |                                |
       v                                v
swipeAutoRefill                POST /api/swipe/generate
(checks all users below        (single user trigger)
 suggestion threshold)               |
       |                                |
       +---------->+<-------------------+
                   |
                   v
       generateSuggestionsWorkflow (Inngest)
                   |
       1. Fetch user context (style, topics, company)
       2. Query inspiration posts for source material
       3. Call OpenAI to generate personalized suggestions
       4. Insert into swipe_suggestions table
       5. Fire 'swipe/suggestions-ready' event
                   |
                   v
       suggestionsReadyHandler (Inngest)
       - Updates generation run status
       - Client polls via use-generated-suggestions hook
```

### Scheduled Post Publishing Flow

```
User schedules post (content + datetime + timezone)
       |
       v
  Save to scheduled_posts (status: pending, scheduled_for: UTC)
       |
       v
  Inngest cron (every 2 minutes): publishScheduledPosts
       |
  1. Query: status=pending AND scheduled_for <= now()
  2. For each post:
     a. Fetch + decrypt LinkedIn tokens
     b. Create LinkedIn API client
     c. Call createPost() via official API
     d. On success: status=posted, save linkedin_post_id
     e. On failure: status=failed, save error_message
```

---

## 5. State Management

ChainLinked uses React Context for global state and custom hooks for feature-specific state. There is no external state management library (no Redux, Zustand, etc.).

### React Context Providers

The provider tree is defined in `components/providers.tsx` and wraps the entire app:

```
ThemeProvider            (next-themes)   -- Theming foundation
  AuthProvider           (lib/auth/auth-provider.tsx)   -- Auth state
    PostHogProvider      (components/posthog-provider.tsx)   -- Analytics
      PostHogUserSync    -- Identifies user to PostHog
      TooltipProvider    (shadcn/ui)   -- Global tooltip config
        ApiKeysProvider  (hooks/use-api-keys.tsx)   -- API key status
          DraftProvider  (lib/store/draft-context.tsx)   -- Draft state
            {children}
  Toaster                (sonner)   -- Toast notifications
  SessionReplayDebug     -- PostHog session replay (dev)
```

**Additional dashboard-scoped providers** (in `dashboard/layout.tsx`):

```
DashboardProvider        (lib/dashboard-context.tsx)   -- Page meta
  SidebarProvider        (shadcn/ui sidebar)   -- Sidebar state
    DashboardTour        -- Guided tour overlay
    AppSidebar           -- Navigation sidebar
    SidebarInset
      SiteHeader         -- Dynamic page header
      DataSyncBanner     -- Dismissible sync notification
      {dashboard pages}
```

#### AuthContext (`lib/auth/auth-provider.tsx`)

The central auth context. Provides:

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Supabase auth user object |
| `profile` | `UserProfileWithLinkedIn \| null` | Profile + LinkedIn profile + LinkedIn analytics |
| `session` | `Session \| null` | Supabase session (access/refresh tokens) |
| `isLoading` | `boolean` | Initial auth check in progress |
| `isAuthenticated` | `boolean` | Whether user is logged in |
| `hasCompletedOnboarding` | `boolean` | Full onboarding status |
| `hasCompletedCompanyOnboarding` | `boolean` | Company setup status |
| `currentOnboardingStep` | `number` | Current onboarding step (1-4) |
| `extensionInstalled` | `boolean \| null` | Chrome extension detected (`null` = not checked) |
| `extensionStatus` | `ExtensionStatus \| null` | Detailed extension status (installed, LinkedIn login, platform login) |
| `signOut` | `() => Promise<void>` | Sign out and redirect to /login |
| `refreshProfile` | `() => Promise<void>` | Re-fetch profile data (safe, never wipes existing) |
| `checkExtension` | `() => Promise<void>` | Re-check extension installation status |

Key behaviors:
- Fetches profile, LinkedIn profile, and LinkedIn analytics in **parallel** on auth via `Promise.all`
- Uses `safeSetProfile()` to **prevent null downgrades** -- if a re-fetch fails, existing data is preserved
- Re-fetches profile after 4 seconds if LinkedIn data is missing (handles extension sync race condition)
- Auto-pushes session to extension when installed but not logged in
- Listens for real-time auth state changes from the extension via `onExtensionAuthStateChange`
- Handles `TOKEN_REFRESHED` events without re-fetching profile (only updates session)
- Deduplicates `INITIAL_SESSION` + `SIGNED_IN` events that fire within 60 seconds
- Context value is memoized via `useMemo` to prevent unnecessary consumer re-renders

#### DraftContext (`lib/store/draft-context.tsx`)

Manages in-memory draft state for the compose page:
- Draft content, media files (with preview URLs)
- AI suggestion context (topic, tone, length, context)
- Remix metadata (original content, tone, instructions)

#### DashboardContext (`lib/dashboard-context.tsx`)

Manages dashboard-wide shared state:
- `pageMeta.title` -- page title displayed in the `SiteHeader`
- `pageMeta.headerActions` -- per-page action buttons rendered in the header

#### ApiKeysContext (`hooks/use-api-keys.tsx`)

Single fetch for API key status across all consumers:
- Tracks which external API keys the user has configured
- Prevents duplicate fetches when multiple components need this data

### Hooks Pattern

Custom hooks in `hooks/` encapsulate data fetching, mutations, and local state for each feature. They typically follow this pattern:

1. Get the authenticated user from `useAuthContext()`
2. Create a memoized Supabase browser client
3. Use `useState` + `useEffect` for data fetching with loading/error states
4. Expose action functions wrapped in `useCallback` for stable references
5. Return a structured object: `{ data, isLoading, error, mutate, ... }`

---

## 6. Authentication Architecture

### Auth Flows

ChainLinked supports three authentication methods:

#### 1. Email/Password with PKCE

```
User                     Webapp                    Supabase Auth
  |                        |                           |
  |  POST /api/auth/signup |                           |
  |  (email, password)     |                           |
  |----------------------->|                           |
  |                        |  supabase.auth.signUp()   |
  |                        |-------------------------->|
  |                        |                           |
  |                        |  Verification email sent   |
  |                        |<--------------------------|
  |                        |                           |
  |  Click email link      |                           |
  |  (PKCE code)           |                           |
  |----------------------->| GET /api/auth/callback     |
  |                        |  exchangeCodeForSession()  |
  |                        |-------------------------->|
  |                        |  Session tokens            |
  |                        |<--------------------------|
  |  Redirect to dashboard |                           |
  |<-----------------------|                           |
```

The browser client uses `flowType: 'pkce'` for enhanced security. The PKCE code verifier is stored in cookies for compatibility with server-side callback handling.

#### 2. Google OAuth

```
User                     Webapp                    Supabase Auth
  |                        |                           |
  |  Click "Sign in with   |                           |
  |  Google"               |                           |
  |----------------------->|                           |
  |                        |  signInWithOAuth({        |
  |                        |    provider: 'google'})   |
  |                        |-------------------------->|
  |  Redirect to Google    |                           |
  |<-----------------------|                           |
  |  ...Google consent...  |                           |
  |  Redirect back with    |                           |
  |  code param            |                           |
  |----------------------->| /api/auth/callback        |
  |                        |  exchangeCodeForSession()  |
  |  Session established   |                           |
  |<-----------------------|                           |
```

#### 3. Extension Authentication

The Chrome extension can authenticate independently or receive a session push from the webapp:

```
Webapp (authenticated)         Extension
  |                              |
  |  PING via postMessage        |
  |  (check if installed)        |
  |----------------------------->|
  |  PONG + status response      |
  |  {installed, linkedInLoggedIn,|
  |   platformLoggedIn}          |
  |<-----------------------------|
  |                              |
  |  pushSessionToExtension()    |
  |  (if ext installed but       |
  |   not platform-logged-in)    |
  |----------------------------->|
  |  Session accepted            |
  |<-----------------------------|
```

The extension can also authenticate via Google OAuth using `chrome.identity.launchWebAuthFlow`, then exchange the Google token at `/api/auth/google-token`.

The webapp listens for real-time auth state changes from the extension via `onExtensionAuthStateChange`, providing instant UI updates when the user signs in/out of the extension.

#### LinkedIn OAuth (Data Access, Not Login)

LinkedIn OAuth is used for API posting access, not for authentication:

```
User                     Webapp                    LinkedIn
  |                        |                           |
  |  Click "Connect        |                           |
  |  LinkedIn"             |                           |
  |----------------------->| /api/linkedin/connect     |
  |                        |  Generate auth URL with   |
  |                        |  scopes (w_member_social,  |
  |  Redirect to LinkedIn  |  r_liteprofile, etc.)     |
  |<-----------------------|                           |
  |  ...LinkedIn consent...|                           |
  |  Redirect back         |                           |
  |----------------------->| /api/linkedin/callback    |
  |                        |  Exchange code for tokens |
  |                        |  Store encrypted in DB    |
  |  Redirect to settings  |                           |
  |<-----------------------|                           |
```

### Session Management

- **Middleware**: Refreshes sessions on every request via `getUser()`. Updated cookies are forwarded through redirects.
- **Browser Client**: Configured with `autoRefreshToken: true`, `persistSession: true`, and `detectSessionInUrl: true`.
- **Token Refresh**: `TOKEN_REFRESHED` events update the session object without triggering a profile re-fetch (avoids unnecessary re-renders).
- **Cookie Forwarding**: `redirectWithCookies()` ensures refreshed session cookies are preserved across middleware redirects.

---

## 7. Background Jobs

All background jobs are powered by **Inngest** and served via a single API route at `/api/inngest`. The Inngest client is configured in `lib/inngest/client.ts` with fully typed events (`InngestEvents`).

### Inngest Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| **analyzeCompanyWorkflow** | `company/analyze` event | Scrapes company website via Firecrawl, researches via Perplexity, extracts structured context via OpenAI |
| **deepResearchWorkflow** | `discover/research` event | Multi-step: Tavily search, Perplexity enrichment, cross-topic synthesis, optional post generation |
| **generateSuggestionsWorkflow** | `swipe/generate-suggestions` event | Generates personalized swipe card suggestions using OpenAI with user style/company context |
| **suggestionsReadyHandler** | `swipe/suggestions-ready` event | Updates generation run status after suggestions are created |
| **dailyContentIngest** | Cron schedule | Ingests fresh content from configured topics for the discover feed |
| **onDemandContentIngest** | `discover/ingest` event | User-triggered content ingest for specific topics |
| **swipeAutoRefill** | Cron schedule | Checks all users and auto-triggers suggestion generation when below threshold |
| **analyticsPipeline** | `analytics/pipeline` event or cron (every 5 min) | *Legacy pipeline.* Computes analytics snapshots using accumulative totals, rolls up to weekly/monthly/quarterly/yearly. Superseded by `dailySnapshotPipeline` for dashboard and analytics page. |
| **dailySnapshotPipeline** | Cron (every 5 min) | Snapshots absolute metric values into `daily_account_snapshots` and `daily_post_snapshots`. Same-day runs update; new day inserts. Primary source for dashboard and analytics page. |
| **analyticsSummaryCompute** | Cron (every 5 min) | *Legacy.* Pre-computes dashboard summary cache using `post_analytics_accumulative` for lifetime totals. Dashboard now reads from `daily_account_snapshots` instead. |
| **analyticsBackfill** | Manual trigger | Backfills historical analytics data for new or corrected metrics |
| **firstSyncBackfill** | `sync/first-data` event | Triggered on first extension data sync, runs initial analytics backfill |
| **templateAutoGenerate** | `templates/auto-generate` event or cron | Auto-generates post templates per user/category based on writing style |
| **influencerPostScrape** | `influencer/follow` event or cron | Scrapes posts from followed influencers via Apify, filters by quality score |
| **viralPostIngest** | Cron schedule | Ingests viral posts from curated source profiles for the inspiration feed |
| **publishScheduledPosts** | Cron (every 2 minutes) | Publishes pending scheduled posts via LinkedIn API with token decryption |

### Event Flow

Inngest functions communicate via typed events defined in `InngestEvents` (in `lib/inngest/client.ts`):

```
User action or cron
       |
       v
  inngest.send({ name: 'event/name', data: {...} })
       |
       v
  Inngest Function (multi-step workflow)
       |
       | step.run('step-name', async () => { ... })
       | step.sleep('wait', '5m')
       | step.sendEvent('completion-event', { ... })
       |
       v
  Downstream handlers or completion events
```

Each event has typed `data` payloads. Completion events (e.g., `swipe/suggestions-ready`, `discover/research.completed`, `analytics/pipeline.completed`) carry result summaries that downstream handlers or client polling can consume.

---

## 8. External Integrations

### LinkedIn API

Two API approaches are used:

| Method | Modules | Use Case |
|--------|---------|----------|
| **Official API** | `lib/linkedin/api-client.ts`, `lib/linkedin/post.ts`, `lib/linkedin/document-post.ts` | Post creation (text, media, documents) via OAuth tokens, profile info via `r_liteprofile` |
| **Voyager API** | `lib/linkedin/voyager-client.ts`, `lib/linkedin/voyager-post.ts`, `lib/linkedin/voyager-metrics.ts` | Internal LinkedIn API for detailed metrics, editing, deleting, reposting. Uses browser cookies (li_at, JSESSIONID) captured by the extension |

The extension captures Voyager API responses by intercepting `XHR/fetch` calls on linkedin.com via the `main-world-interceptor.ts` content script.

### OpenAI

- **Client**: `lib/ai/openai-client.ts`
- **Usage**: Post composition (streaming chat), carousel content generation, post remixing, writing style analysis, template generation, swipe suggestion generation, company context analysis, research synthesis
- **System Prompts**: Modular prompt system in `lib/ai/` with:
  - `compose-system-prompt.ts` for post writing
  - `series-system-prompt.ts` for post series
  - `carousel-prompts.ts` for carousel slides
  - `anti-ai-rules.ts` to produce human-sounding output
  - `suggestion-prompts.ts` for swipe card generation
  - `remix-prompts.ts` for post remixing

### Perplexity

- **Client**: `lib/perplexity/client.ts`
- **Usage**: Deep research for content discovery with web citations, company research during onboarding
- **Integration**: Called from `deepResearchWorkflow` and `analyzeCompanyWorkflow` Inngest functions

### Tavily

- **Client**: `lib/research/tavily-client.ts`
- **Usage**: Web search API for content research, used as the initial search step in the deep research pipeline

### Brandfetch

- **Client**: `lib/brandfetch/client.ts`
- **Usage**: Extracts brand colors, logos, and fonts from company domains during the onboarding brand kit setup

### Firecrawl

- **Client**: `lib/firecrawl/client.ts`, `lib/firecrawl/scraper.ts`, `lib/firecrawl/brand-extractor.ts`
- **Usage**: Website scraping for company context analysis during onboarding. Extracts structured brand data from company websites.

### Apify

- **Client**: `lib/apify/client.ts`
- **Usage**: LinkedIn post scraping for followed influencers and viral post sourcing. Used by `influencerPostScrape` and `viralPostIngest` Inngest functions.

### Logo.dev

- **Client**: `lib/logo-dev.ts`
- **Usage**: Company logo resolution by domain name. Remote image pattern configured in `next.config.ts` for `img.logo.dev`.

### Resend

- **Client**: `lib/email/resend.ts`
- **Templates**: `components/emails/` (React Email components)
  - `email-verification.tsx` -- Email verification
  - `team-invitation.tsx` -- Team invitation
  - `welcome-to-team.tsx` -- Welcome after joining
- **Usage**: Transactional emails for onboarding, team management, and account actions

### PostHog

- **Provider**: `components/posthog-provider.tsx`
- **User Sync**: `PostHogUserSync` component identifies users from `AuthContext`
- **Usage**: Product analytics, feature flags, session replay
- **Debug**: `components/debug/session-replay-debug.tsx` for development session replay inspection

### Unsplash

- **Client**: `lib/graphics-library/unsplash.ts`
- **Usage**: Stock photo search for the canvas/carousel editor

---

## 9. Styling Architecture

### Tailwind CSS v4

The project uses Tailwind CSS v4 with CSS-first configuration. The entry point is `app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

The `tw-animate-css` plugin provides animation utilities.

### Design System

The design system is built on CSS custom properties using the **OKLCH color space** with two themes (light and dark):

**Primary Palette -- LinkedIn Blue**:
| Token | Value |
|-------|-------|
| `--primary` | `oklch(0.47 0.13 230)` |
| `--primary-foreground` | `oklch(0.98 0.005 230)` |
| `--primary-50` through `--primary-900` | Full scale for gradients/variations |

**Secondary Palette -- Terracotta**:
| Token | Value |
|-------|-------|
| `--secondary` | `oklch(0.65 0.12 45)` |
| `--secondary-foreground` | `oklch(0.98 0.01 45)` |
| `--secondary-50` through `--secondary-900` | Full scale |

**Semantic Colors**:
| Token | Purpose |
|-------|---------|
| `--success` | Success states (green) |
| `--warning` | Warning states (amber) |
| `--destructive` | Error/danger states (red) |

### Theme Bridge

The `@theme inline` block in `globals.css` maps CSS variables to Tailwind utility classes:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-chart-1: var(--chart-1);
  --radius-lg: var(--radius);
  /* ... 40+ mappings */
}
```

### Chart Colors

Five distinct chart colors for Recharts visualizations:

| Variable | Color | Usage |
|----------|-------|-------|
| `--chart-1` | LinkedIn Blue | Primary metric |
| `--chart-2` | Terracotta | Secondary metric |
| `--chart-3` | Blue | Tertiary |
| `--chart-4` | Emerald | Quaternary |
| `--chart-5` | Amber | Quinary |

### Animation System

CSS custom properties define animation timing:

```css
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-entrance: 600ms;
```

Framer Motion is used for component-level animations (sidebar collapse, page transitions, carousel animations). Shared animation configs live in `lib/animations.ts`.

### Shadow System

Custom shadow tokens with warm-toned OKLCH shadows:

```css
--shadow-xs: 0 1px 2px oklch(0.15 0.01 90 / 0.05);
--shadow-sm through --shadow-xl    /* increasing intensity */
--shadow-primary    /* primary-tinted shadow */
--shadow-secondary  /* terracotta-tinted shadow */
```

### Theme Switching

- Managed by `next-themes` ThemeProvider with `attribute="class"` (adds `.dark` class to `<html>`)
- Default theme: `system` (follows OS preference)
- Floating toggle button (`AnimatedThemeToggler`) fixed at bottom-right corner (`z-[9999]`)
- `suppressHydrationWarning` on `<html>` and `<body>` to prevent SSR/client mismatch

### Fonts

Two font families loaded via `next/font/google`:
- **Geist Sans** (`--font-geist-sans`) -- primary UI font
- **Geist Mono** (`--font-geist-mono`) -- code/monospace font

### Component Styling Conventions

- `cn()` utility (from `lib/utils.ts`) merges Tailwind classes via `clsx` + `tailwind-merge`
- Container queries (`@container/main`) for responsive dashboard layouts
- Mobile-first responsive design
- shadcn/ui **new-york** style variant as the component primitive layer

---

## 10. Key Design Patterns

### Component Patterns

**Compound Components**: Complex UI like the Sidebar uses a compound component pattern with `SidebarProvider`, `SidebarContent`, `SidebarMenu`, `SidebarMenuItem`, etc. The sidebar manages open/collapsed state internally while exposing it through context.

**Feature Components**: Self-contained feature components in `components/features/` own their data fetching via hooks and render their own loading/error/empty states. They compose smaller UI primitives from `components/ui/`.

**Collapsible Sections with Animation**: Sidebar navigation and other collapsible areas use `Collapsible` (Radix) + `AnimatePresence`/`motion.div` (Framer Motion) with the shared `smoothEase` curve `[0.16, 1, 0.3, 1]`.

**Hydration Safety**: Components that depend on client-only state (e.g., Radix-generated IDs, localStorage) use a `mounted` state pattern to render static HTML on the server and interactive HTML after hydration:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])

return mounted ? <InteractiveVersion /> : <StaticFallback />
```

**Page Meta Pattern**: Dashboard pages declare their title and header actions via `usePageMeta()` (from `DashboardContext`), which the shared `SiteHeader` renders automatically.

### Error Handling

1. **Middleware**: Fail-open with timeouts. Profile queries race against an 8-second timeout; on failure, the request proceeds without onboarding redirection.
2. **Auth Provider**: `safeSetProfile()` prevents null downgrades. If a profile re-fetch fails, existing data (including LinkedIn avatar, headline, etc.) is preserved rather than being wiped.
3. **API Routes**: Try-catch with structured error responses. User-facing errors are communicated via appropriate HTTP status codes.
4. **UI**: Toast notifications via Sonner (`components/ui/sonner.tsx`, configured in `Providers`) for user-facing errors. `richColors` and `closeButton` enabled. Error boundary component (`components/error-boundary.tsx`) for unrecoverable render errors.
5. **Supabase Queries**: Use `maybeSingle()` instead of `single()` where records may not exist to avoid PGRST116 errors.

### Loading States

- **Dashboard Layout**: Shows a centered spinner (`DashboardLoadingState`) during initial auth check. Once `ready` is set to `true`, it never shows the loading state again (prevents blank-page flash on client-side navigation when `isLoading` briefly flickers).
- **Data Sync Banner**: Dismissible banner (persisted in localStorage) informing users that LinkedIn data may take 24 hours to sync. Links to the Create page as an alternative.
- **Skeleton Loading**: Individual pages use skeleton components during data fetching.
- **Minimum Loading**: `use-minimum-loading.ts` hook ensures loading states display for at least a minimum duration to prevent jarring UI transitions.
- **Generation Progress**: `components/features/generation-progress.tsx` shows progress for long-running AI operations.

### Security

- **Security Headers** (`next.config.ts`):
  - `X-Frame-Options: DENY` -- prevents clickjacking
  - `X-Content-Type-Options: nosniff` -- prevents MIME sniffing
  - `Referrer-Policy: origin-when-cross-origin` -- limits referrer leakage
  - `X-XSS-Protection: 1; mode=block` -- legacy XSS protection
- **PKCE Auth Flow**: Browser client uses PKCE (`flowType: 'pkce'`) for enhanced OAuth security.
- **Row Level Security**: Supabase RLS policies enforce data isolation per user and team.
- **API Key Encryption**: `lib/crypto.ts` handles encryption/decryption for stored API keys and LinkedIn tokens.
- **Environment Validation**: Inngest client validates `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` presence and warns in production.
- **Remote Image Allowlist**: `next.config.ts` restricts remote images to `media.licdn.com` and `img.logo.dev`.

### Accessibility

- **Skip Links**: `components/skip-links.tsx` at root level and a dashboard-level skip link targeting `#main-content`.
- **Focus Management**: shadcn/ui primitives include proper focus rings (`ring-2 ring-ring`) and ARIA attributes.
- **Keyboard Navigation**: Sidebar collapsible sections respond to keyboard interaction. All interactive elements are keyboard-accessible.
- **Screen Reader**: `aria-label` on icon-only buttons (e.g., "Toggle theme", "Dismiss banner"). `sr-only` class for visually hidden labels.

### Performance

- **Parallel Data Fetching**: `AuthProvider` fetches profile, LinkedIn profile, and analytics in parallel via `Promise.all`.
- **Context Value Memoization**: All context values wrapped in `useMemo` to prevent unnecessary re-renders of consumers.
- **Supabase Client Memoization**: Browser client created once via `useMemo(() => createClient(), [])`.
- **Stale Fetch Cancellation**: Auth provider tracks fetch IDs (`currentFetchId`) and uses `AbortController` to cancel superseded requests.
- **Conditional Profile Fetching**: Middleware only queries profiles when the route requires it (dashboard or onboarding).
- **Token Refresh Optimization**: `TOKEN_REFRESHED` events only update user state if the user ID actually changed, preventing cascading re-renders.
- **Container Queries**: Dashboard uses `@container/main` for responsive layouts.
- **Debounced Re-fetch**: Profile re-fetch for missing LinkedIn data is delayed 4 seconds to allow extension sync to complete.
