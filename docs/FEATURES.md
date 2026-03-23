# ChainLinked Feature Guide

Complete feature documentation for the ChainLinked LinkedIn content management platform.

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Post Composer](#2-post-composer)
3. [Post Scheduling](#3-post-scheduling)
4. [Analytics Dashboard](#4-analytics-dashboard)
5. [Team Management](#5-team-management)
6. [Discover & Inspiration](#6-discover--inspiration)
7. [Swipe Interface](#7-swipe-interface)
8. [Carousel Creator](#8-carousel-creator)
9. [Template Library](#9-template-library)
10. [Brand Kit](#10-brand-kit)
11. [AI Content Generation](#11-ai-content-generation)
12. [Deep Research](#12-deep-research)
13. [Chrome Extension](#13-chrome-extension)
14. [Settings](#14-settings)

---

## 1. Authentication & Onboarding

### What It Does

Users sign up via email/password or Google OAuth through Supabase Auth. After signup, a dual-path onboarding flow guides users based on their role:

- **Owner path** (4 steps): Company setup, company context analysis, invite teammates, review & complete.
- **Member path**: Join an existing team by searching for discoverable teams or accepting an invitation.

The middleware enforces onboarding completion before granting dashboard access. Users who have not finished onboarding are redirected back to their current step.

### Key Files

| Layer | File |
|-------|------|
| Middleware | `middleware.ts` |
| Auth pages | `app/login/`, `app/signup/`, `app/forgot-password/`, `app/reset-password/`, `app/verify-email/` |
| Auth API | `app/api/auth/callback/route.ts`, `app/api/auth/signup/route.ts`, `app/api/auth/google-token/route.ts`, `app/api/auth/resend-verification/route.ts`, `app/api/auth/reset-password/route.ts` |
| Onboarding pages | `app/onboarding/page.tsx` (role selection), `app/onboarding/step1/` through `step4/`, `app/onboarding/join/`, `app/onboarding/company/`, `app/onboarding/company-context/`, `app/onboarding/invite/`, `app/onboarding/brand-kit/` |
| Onboarding API | `app/api/onboarding/` |
| Components | `components/signup-form.tsx`, `components/features/company-onboarding-form.tsx`, `components/features/company-setup-form.tsx`, `components/features/invite-teammates-form.tsx`, `components/OnboardingProgress.tsx`, `components/onboarding-navbar.tsx` |
| Hooks | `hooks/use-auth.ts`, `hooks/use-onboarding-guard.ts` |
| Auth library | `lib/auth/` |
| Services | `services/onboarding.ts` |
| Invite handling | `app/invite/` |

### Technical Flow

1. User lands on `/signup` or `/login`.
2. Supabase Auth handles credential validation or Google OAuth callback via `app/api/auth/callback/route.ts`.
3. A database trigger (`handle_new_user`) creates a `profiles` row on first signup.
4. Middleware checks `profiles.onboarding_completed` and `profiles.onboarding_type` on every protected route request.
5. **Owner path**: Step 1 creates a company and team, Step 2 triggers the `company/analyze` Inngest workflow (Firecrawl + Perplexity + OpenAI), Step 3 sends team invitations via email, Step 4 is review.
6. **Member path**: User searches for discoverable teams or enters via an invitation link. A `team_join_requests` row is created if the team requires approval.
7. Once onboarding is marked complete, the middleware allows access to `/dashboard`.

### Database Tables

- `profiles` -- User profile with onboarding state (`onboarding_completed`, `onboarding_current_step`, `onboarding_type`, `company_onboarding_completed`)
- `companies` -- Company entity (name, slug, website, owner_id)
- `teams` -- Teams linked to companies (`discoverable` flag for member search)
- `team_members` -- User-team membership with role (owner/admin/member)
- `team_invitations` -- Email-based invitations with token and expiry
- `team_join_requests` -- Pending join requests for team approval
- `company_context` -- AI-analyzed company data from onboarding

---

## 2. Post Composer

### What It Does

A rich text composer for creating LinkedIn posts with:

- AI-powered compose chat (conversational post generation with OpenRouter)
- `@mention` support with a search popover that resolves LinkedIn profile URNs
- Unicode font styling (bold, italic, etc.) for LinkedIn-compatible formatting
- Default hashtag insertion from user settings
- Draft auto-save with conversation persistence
- Media upload (images up to 9 per post)
- Post type selection (text, image, document/carousel)
- Real-time character count with 3,000-character LinkedIn limit (code-point counting)
- AI inline panel for editing selected text
- Content rules enforcement

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/compose/` |
| Components | `components/features/compose/` (directory), `components/features/post-composer.tsx`, `components/features/mention-popover.tsx`, `components/features/emoji-picker.tsx`, `components/features/media-upload.tsx`, `components/features/post-type-selector.tsx`, `components/features/ai-inline-panel.tsx` |
| Hooks | `hooks/use-compose-mode.ts`, `hooks/use-auto-save.ts`, `hooks/use-conversation-persistence.ts`, `hooks/use-linkedin-post.ts`, `hooks/use-linkedin-document-post.ts`, `hooks/use-posting-config.ts`, `hooks/use-text-selection-popup.ts`, `hooks/use-drafts.ts` |
| API routes | `app/api/ai/compose-chat/route.ts`, `app/api/ai/edit-selection/route.ts`, `app/api/ai/compose-series/route.ts`, `app/api/mentions/`, `app/api/drafts/`, `app/api/linkedin/post/route.ts`, `app/api/linkedin/post-document/route.ts`, `app/api/linkedin/voyager/post/route.ts` |
| Libraries | `lib/linkedin/post.ts`, `lib/linkedin/mentions.ts`, `lib/linkedin/document-post.ts`, `lib/unicode-fonts.ts`, `lib/ai/compose-system-prompt.ts` |
| Types | `types/compose.ts` |

### Technical Flow

1. User opens the compose page. The `use-compose-mode` hook manages the current mode (write, AI chat, preview).
2. AI compose chat sends messages to `/api/ai/compose-chat` which streams responses from OpenRouter (GPT-4.1) using the compose system prompt and company context.
3. Mentions are triggered by typing `@` -- the popover queries `/api/mentions` which searches LinkedIn connections.
4. Unicode fonts are applied via `lib/unicode-fonts.ts` which maps characters to their Unicode mathematical bold/italic equivalents.
5. Drafts auto-save to `compose_conversations` via the `use-auto-save` hook.
6. On publish, the post is sent via the LinkedIn Official API (`lib/linkedin/post.ts`) using UGC Posts endpoint, or via the Voyager API for advanced features.
7. Mention tokens (`@[Name](URN)`) are converted to plain text + UGC mention attributes before posting.

### Database Tables

- `compose_conversations` -- Chat history, mode, tone, auto-save state
- `user_default_hashtags` -- User's default hashtags appended to posts
- `content_rules` -- Rules that constrain AI-generated content
- `writing_style_profiles` -- User's analyzed writing style for AI personalization
- `scheduled_posts` -- If the user schedules instead of publishing immediately
- `my_posts` -- Record of published posts

---

## 3. Post Scheduling

### What It Does

Users can schedule LinkedIn posts for future publication with timezone-aware scheduling. A cron-based Inngest pipeline runs every 2 minutes to find and publish pending posts. Features include:

- Calendar view for scheduled posts
- Timezone selection per post
- Queue management (edit, reschedule, cancel)
- Status tracking (pending, posting, posted, failed)
- Posting goals integration

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/schedule/` |
| Components | `components/features/schedule-calendar.tsx`, `components/features/schedule-modal.tsx`, `components/features/scheduled-posts.tsx`, `components/features/goals-tracker.tsx`, `components/features/post-goal-selector.tsx` |
| Hooks | `hooks/use-scheduled-posts.ts`, `hooks/use-posting-goals.ts` |
| Inngest function | `lib/inngest/functions/publish-scheduled-posts.ts` |
| LinkedIn posting | `lib/linkedin/post.ts`, `lib/linkedin/posting-config.ts` |
| Crypto | `lib/crypto.ts` (token encryption/decryption) |

### Technical Flow

1. User creates a post in the composer and selects "Schedule" instead of "Post Now."
2. A `scheduled_posts` row is created with `status = 'pending'` and the `scheduled_for` timestamp (stored in UTC).
3. The `publish-scheduled-posts` Inngest cron function runs every 2 minutes (`*/2 * * * *`).
4. It queries `scheduled_posts` for rows where `status = 'pending'` and `scheduled_for <= now()`.
5. For each post, it: fetches and decrypts LinkedIn tokens from `linkedin_tokens`, creates a LinkedIn API client with auto-refresh, calls `createPost()`, and updates the status to `posted` or `failed`.
6. Successfully posted content is also logged to `my_posts` with `source = 'scheduled'`.
7. A global posting killswitch (`lib/linkedin/posting-config.ts`) can disable all posting.

### Database Tables

- `scheduled_posts` -- Queue of scheduled posts (content, scheduled_for, timezone, status, linkedin_post_id, error_message)
- `linkedin_tokens` -- Encrypted OAuth tokens for LinkedIn API access
- `my_posts` -- Published post records
- `posting_goals` -- User's posting frequency targets (period, target_posts, current_posts)

---

## 4. Analytics Dashboard

### What It Does

A comprehensive analytics dashboard showing personal LinkedIn performance metrics:

- Summary cards (impressions, engagement rate, followers, profile views) with period comparison
- Interactive trend charts (area, line) for key metrics over time
- Data tables with sortable post-level analytics
- CSV export of analytics data
- Comparison mode (week-over-week, month-over-month)
- Analytics filter bar (date range, metric type)
- Profile analytics (follower growth, search appearances)

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/analytics/` |
| Components | `components/features/analytics-cards.tsx`, `components/features/analytics-chart.tsx`, `components/features/analytics-charts.tsx`, `components/features/analytics-data-table.tsx`, `components/features/analytics-filter-bar.tsx`, `components/features/analytics-summary-bar.tsx`, `components/features/analytics-trend-chart.tsx`, `components/features/post-performance.tsx` |
| Hooks | `hooks/use-analytics.ts`, `hooks/use-analytics-v2.ts`, `hooks/use-post-analytics.ts` |
| API routes | `app/api/analytics/route.ts`, `app/api/analytics/v2/route.ts`, `app/api/analytics/v2/profile/route.ts` |
| Inngest functions | `lib/inngest/functions/analytics-pipeline.ts`, `lib/inngest/functions/analytics-summary-compute.ts`, `lib/inngest/functions/analytics-backfill.ts` |
| Library | `lib/analytics.ts` |

### Technical Flow

1. The Chrome extension captures raw LinkedIn analytics data and syncs it to `linkedin_analytics`, `post_analytics`, `audience_data`, and `audience_history`.
2. The `analytics-pipeline` Inngest cron job runs daily to:
   - Snapshot profile-level metrics into `profile_analytics_daily` and `profile_analytics_accumulative`.
   - Snapshot post-level metrics into `post_analytics_daily` and `post_analytics_accumulative`.
   - Roll up daily data into weekly (`post_analytics_wk`), monthly (`post_analytics_mth`), quarterly (`post_analytics_qtr`), and yearly (`post_analytics_yr`) aggregates.
3. The `analytics-summary-compute` function pre-computes summary metrics into `analytics_summary_cache` for fast dashboard loading.
4. The v2 API endpoints read from the pipeline-computed tables and return time-series and summary data.
5. The dashboard renders charts using Recharts and data tables using TanStack React Table.

### Database Tables

- `linkedin_analytics` -- Raw analytics snapshots from extension
- `post_analytics` -- Raw per-post analytics from extension
- `post_analytics_daily` -- Daily deltas per post (Inngest-managed)
- `post_analytics_accumulative` -- Running totals per post (Inngest-managed)
- `post_analytics_wk`, `post_analytics_mth`, `post_analytics_qtr`, `post_analytics_yr` -- Period rollups (Inngest-managed)
- `profile_analytics_daily` -- Daily profile metric deltas (Inngest-managed)
- `profile_analytics_accumulative` -- Running profile totals (Inngest-managed)
- `analytics_summary_cache` -- Pre-computed summary metrics (Inngest-managed)
- `analytics_tracking_status` -- Tracking status enum (tracking, paused, etc.)
- `analytics_history` -- Legacy analytics history
- `audience_data` -- Audience demographics snapshot
- `audience_history` -- Historical follower counts
- `my_posts` -- Source of truth for user's published posts

---

## 5. Team Management

### What It Does

Teams allow multiple users to collaborate on LinkedIn content:

- Team creation during onboarding (linked to a company)
- Email-based invitations with unique tokens and expiry
- Join request workflow for discoverable teams
- Role-based access control (owner, admin, member)
- Team activity feed showing teammates' posts and metrics
- Team leaderboard with performance rankings
- Team settings management

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/team/` |
| Components | `components/features/team-management.tsx`, `components/features/team-header.tsx`, `components/features/team-member-list.tsx`, `components/features/team-members-preview.tsx`, `components/features/team-activity-feed.tsx`, `components/features/team-leaderboard.tsx`, `components/features/team-settings-panel.tsx`, `components/features/team-search.tsx`, `components/features/invite-team-dialog.tsx`, `components/features/invite-team-modal.tsx`, `components/features/join-requests-list.tsx`, `components/features/pending-invitations.tsx`, `components/features/pending-invitations-card.tsx`, `components/features/pending-approval-screen.tsx`, `components/features/no-team-state.tsx` |
| Hooks | `hooks/use-team.ts`, `hooks/use-team-invitations.ts`, `hooks/use-invitations.ts`, `hooks/use-join-requests.ts`, `hooks/use-team-leaderboard.ts`, `hooks/use-team-posts.ts` |
| API routes | `app/api/teams/route.ts`, `app/api/teams/[teamId]/`, `app/api/teams/accept-invite/`, `app/api/teams/join-request/`, `app/api/teams/search/` |
| Library | `lib/team/` |
| Email | `lib/email/resend.ts`, `lib/email/index.ts`, `components/emails/` |

### Technical Flow

1. During owner onboarding, a `companies` row and `teams` row are created. The owner is added to `team_members` with `role = 'owner'`.
2. Invitations are sent via Resend email with a unique token. The `team_invitations` row tracks status (pending, accepted, expired).
3. The invite link (`/invite/[token]`) validates the token and adds the user to the team.
4. For discoverable teams, the member onboarding path lets users search teams via `/api/teams/search` and submit a `team_join_requests` entry.
5. Owners/admins review join requests and approve or reject them.
6. The team activity feed and leaderboard aggregate data from `my_posts` and analytics tables for all team members.

### Database Tables

- `teams` -- Team entity (name, logo, owner_id, company_id, discoverable)
- `team_members` -- Membership records (team_id, user_id, role)
- `team_invitations` -- Email invitations (token, status, expires_at)
- `team_join_requests` -- Join requests (status, reviewed_by)
- `companies` -- Parent company entity
- `invitations` -- LinkedIn invitations captured by extension (separate from team invitations)

---

## 6. Discover & Inspiration

### What It Does

A content discovery hub with multiple content sources:

- **Viral post feed**: Curated high-engagement LinkedIn posts from viral creators, scraped via Apify and quality-filtered by AI.
- **News articles**: Industry news ingested daily via Perplexity research, categorized by topic.
- **Influencer tracking**: Follow specific LinkedIn influencers and see their latest posts.
- **Topic-based discovery**: Content organized by user-selected topics.
- **Saved inspirations**: Bookmark posts for later reference.
- **Remix**: Generate new post variations from any discovered content.

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/discover/` |
| Components | `components/features/discover-content-card.tsx`, `components/features/discover-news-card.tsx`, `components/features/discover-news-item.tsx`, `components/features/discover-trending-sidebar.tsx`, `components/features/article-detail-dialog.tsx`, `components/features/follow-influencer-dialog.tsx`, `components/features/followed-influencers-panel.tsx`, `components/features/manage-topics-modal.tsx`, `components/features/topic-selection-overlay.tsx`, `components/features/remix-dialog.tsx`, `components/features/remix-modal.tsx`, `components/features/remix-post-button.tsx` |
| Hooks | `hooks/use-discover.ts`, `hooks/use-discover-news.ts`, `hooks/use-inspiration.ts`, `hooks/use-followed-influencers.ts`, `hooks/use-remix.ts` |
| API routes | `app/api/discover/`, `app/api/influencers/`, `app/api/inspiration/`, `app/api/remix/` |
| Inngest functions | `lib/inngest/functions/daily-content-ingest.ts`, `lib/inngest/functions/on-demand-content-ingest.ts`, `lib/inngest/functions/viral-post-ingest.ts`, `lib/inngest/functions/influencer-post-scrape.ts`, `lib/inngest/functions/ingest-articles.ts` |
| Libraries | `lib/apify/client.ts`, `lib/ai/post-quality-filter.ts`, `lib/ai/remix-prompts.ts` |

### Technical Flow

1. **Viral post ingest** (daily cron at 5 AM UTC): Scrapes posts from curated `viral_source_profiles` via Apify's `harvestapi~linkedin-profile-posts` actor, filters through LLM quality assessment, classifies tags/clusters, and stores up to 20 approved posts per day in `discover_posts`.
2. **Influencer post scrape** (daily cron at 6 AM UTC): Scrapes posts from user-followed influencers via Apify, applies the same quality filter, and stores in `influencer_posts`.
3. **Daily content ingest**: Searches user-selected topics, processes results, and populates `discover_posts` and `discover_news_articles`.
4. **On-demand ingest**: Triggered when a user manually requests fresh content.
5. **Remix flow**: User selects a post, chooses remix options, and the `/api/remix` endpoint uses OpenRouter to generate a new variation using prompts from `lib/ai/remix-prompts.ts`.

### Database Tables

- `discover_posts` -- Curated content feed (viral posts, research results, ingested content)
- `discover_news_articles` -- News articles with topic tags and freshness
- `inspiration_posts` -- High-quality posts for the inspiration feed
- `saved_inspirations` -- User's bookmarked posts
- `followed_influencers` -- Influencers a user follows (linkedin_url, status, posts_count)
- `influencer_posts` -- Posts scraped from followed influencers (with quality_score, quality_status)
- `viral_source_profiles` -- Curated list of viral LinkedIn creators
- `linkedin_research_posts` -- Research posts from Apify LinkedIn scraping
- `tag_cluster_mappings` -- Maps content tags to topic clusters

---

## 7. Swipe Interface

### What It Does

A Tinder-style card interface for reviewing AI-generated post suggestions:

- Swipe right to save to wishlist, left to dismiss
- AI-generated suggestions based on company context and user preferences
- Wishlist management with collections
- Schedule directly from wishlist
- Auto-refill when suggestions run low (cron job)

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/swipe/` |
| Components | `components/features/swipe-card.tsx`, `components/features/swipe-interface.tsx` |
| Hooks | `hooks/use-swipe-actions.ts`, `hooks/use-swipe-suggestions.ts`, `hooks/use-generated-suggestions.ts` |
| API routes | `app/api/swipe/` |
| Inngest functions | `lib/inngest/functions/generate-suggestions.ts`, `lib/inngest/functions/suggestions-ready.ts`, `lib/inngest/functions/swipe-auto-refill.ts` |
| AI prompts | `lib/ai/suggestion-prompts.ts` |

### Technical Flow

1. The `generate-suggestions` Inngest workflow is triggered during onboarding or on demand.
2. It fetches the user's `company_context`, generates content ideas via OpenRouter, then expands each idea into a full LinkedIn post.
3. Generated suggestions are stored in `generated_suggestions` with metadata (post_type, category, estimated_engagement).
4. The swipe interface presents cards. User actions are recorded in `swipe_preferences`.
5. Right-swiped posts go to `swipe_wishlist`. Users can organize them into `wishlist_collections`.
6. The `swipe-auto-refill` cron job monitors suggestion counts and triggers new generation when a user's active suggestions drop below the threshold (max 10 active).
7. The `suggestions-ready` handler notifies the UI when new suggestions are available.

### Database Tables

- `generated_suggestions` -- AI-generated post suggestions (content, post_type, category, estimated_engagement, status)
- `suggestion_generation_runs` -- Tracks generation batches (status, suggestions_generated, company_context_id)
- `swipe_preferences` -- User swipe actions (post_id, action: like/dislike/skip)
- `swipe_wishlist` -- Saved suggestions with notes and scheduling status
- `wishlist_collections` -- Named collections for organizing wishlist items
- `company_context` -- Company data used for personalized generation

---

## 8. Carousel Creator

### What It Does

A visual canvas editor for creating LinkedIn carousel posts (document posts):

- Slide-by-slide canvas editor with drag-and-drop elements
- Brand kit integration (auto-apply colors, fonts, logos)
- Pre-built carousel templates
- AI-generated carousel content and captions
- PDF export for LinkedIn document posts
- Thumbnail preview generation

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/carousels/` |
| Components | `components/features/canvas-editor/` (directory), `components/features/carousel-creator.tsx`, `components/features/carousel-document-preview.tsx`, `components/features/brand-kit-preview.tsx`, `components/features/font-picker.tsx` |
| Hooks | `hooks/use-canvas-editor.ts`, `hooks/use-carousel.ts`, `hooks/use-carousel-templates.ts`, `hooks/use-brand-kit-templates.ts` |
| API routes | `app/api/ai/carousel/generate/route.ts`, `app/api/ai/carousel-caption/route.ts`, `app/api/carousel-templates/` |
| Libraries | `lib/canvas-pdf-export.ts`, `lib/pdf-export.ts`, `lib/canvas-templates/`, `lib/ai/carousel-builder.ts`, `lib/ai/carousel-prompts.ts` |
| LinkedIn posting | `lib/linkedin/document-post.ts`, `app/api/linkedin/post-document/route.ts` |
| Types | `types/canvas-editor.ts`, `types/carousel.ts` |

### Technical Flow

1. User opens the carousel creator and selects a template or starts from scratch.
2. The canvas editor (`use-canvas-editor` hook) manages slide state, element positioning, and styling.
3. Brand kit colors/fonts are auto-applied from `brand_kits` table.
4. AI can generate carousel slide content via `/api/ai/carousel/generate` using `lib/ai/carousel-builder.ts`.
5. AI can generate captions for the entire carousel via `/api/ai/carousel-caption`.
6. PDF export uses `lib/canvas-pdf-export.ts` to render slides as a PDF document.
7. The document is posted to LinkedIn via the document post API (`lib/linkedin/document-post.ts`), which registers an upload, uploads the PDF binary, and creates the post.

### Database Tables

- `carousel_templates` -- Saved carousel templates (slides JSON, brand_colors, fonts, thumbnail)
- `brand_kits` -- Brand colors, fonts, and logos for styling
- `my_posts` -- Published carousel posts tracked here

---

## 9. Template Library

### What It Does

A CRUD interface for managing reusable post templates:

- Create, edit, delete templates
- Categorize templates with custom categories
- Favorite templates for quick access
- Usage tracking (how many times each template has been used)
- AI-recommended templates based on context
- AI auto-generation of templates (Inngest cron)
- Team-shared templates

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/templates/` |
| Components | `components/features/template-library/` (directory) |
| Hooks | `hooks/use-templates.ts`, `hooks/use-template-categories.ts` |
| API routes | `app/api/templates/` |
| Inngest function | `lib/inngest/functions/template-auto-generate.ts` |
| AI | `lib/ai/template-analyzer.ts` |

### Technical Flow

1. Users create templates with content, category, and tags. Templates can be personal or team-shared (`team_id`).
2. Categories are user-defined via `template_categories`.
3. Users can favorite templates (`template_favorites`), and usage count increments on each use.
4. The `template-auto-generate` Inngest cron job analyzes user patterns and generates new templates using OpenRouter, marking them with `is_ai_generated = true`.
5. Templates can be loaded into the composer for quick post creation.

### Database Tables

- `templates` -- Template content (name, content, category, tags, usage_count, is_public, team_id, is_ai_generated)
- `template_categories` -- User-defined categories
- `template_favorites` -- User favorites (user_id, template_id)

---

## 10. Brand Kit

### What It Does

Automated brand asset extraction and management:

- Auto-extraction of brand colors, fonts, and logos from a website URL using Firecrawl
- Fallback to Brandfetch API for logo/color data
- Manual editing of brand elements
- Brand kit integration with carousel creator and templates
- Per-team brand kits

### Key Files

| Layer | File |
|-------|------|
| Page | `app/onboarding/brand-kit/` |
| Components | `components/features/brand-kit-preview.tsx` |
| Hooks | `hooks/use-brand-kit.ts`, `hooks/use-brand-kit-templates.ts` |
| API routes | `app/api/brand-kit/route.ts`, `app/api/brand-kit/extract/route.ts` |
| Libraries | `lib/firecrawl/brand-extractor.ts`, `lib/firecrawl/client.ts`, `lib/firecrawl/scraper.ts`, `lib/logo-dev.ts` |
| Types | `types/brand-kit.ts` |

### Technical Flow

1. During onboarding (or in settings), user provides their website URL.
2. The `/api/brand-kit/extract` endpoint calls Firecrawl to scrape the website HTML.
3. `lib/firecrawl/brand-extractor.ts` parses CSS for primary colors (checking `--primary`, `--brand`, `--accent` variables), extracts font families, and finds logo URLs.
4. Colors are ranked by frequency and position in CSS. The primary color is the most prominent brand-associated color.
5. The extracted data is saved to `brand_kits` with raw extraction data for debugging.
6. The carousel creator and template system reference the active brand kit for consistent styling.

### Database Tables

- `brand_kits` -- Brand assets (primary_color, secondary_color, accent_color, font_primary, font_secondary, logo_url, raw_extraction, team_id)

---

## 11. AI Content Generation

### What It Does

AI-powered content generation across the platform via OpenRouter:

- **Compose chat**: Conversational post generation with streaming responses
- **Post generation**: Direct post creation with post-type-specific prompts
- **Remix**: Generate variations of existing posts
- **Edit selection**: AI editing of selected text within the composer
- **Series generation**: Multi-post series creation
- **Carousel content**: AI-generated slide content
- **Playground**: Admin prompt testing and iteration
- **Anti-AI detection**: Writing rules to make content sound more human

### Key Files

| Layer | File |
|-------|------|
| API routes | `app/api/ai/compose-chat/route.ts`, `app/api/ai/generate/route.ts`, `app/api/ai/remix/route.ts`, `app/api/ai/edit-selection/route.ts`, `app/api/ai/compose-series/route.ts`, `app/api/ai/carousel/generate/route.ts`, `app/api/ai/carousel-caption/route.ts`, `app/api/ai/playground/route.ts`, `app/api/ai/analyze-company/route.ts` |
| Client | `lib/ai/openai-client.ts` -- OpenRouter client (BYOK support) |
| Prompts | `lib/ai/compose-system-prompt.ts`, `lib/ai/suggestion-prompts.ts`, `lib/ai/remix-prompts.ts`, `lib/ai/carousel-prompts.ts`, `lib/ai/series-system-prompt.ts`, `lib/ai/prompt-templates.ts`, `lib/ai/anti-ai-rules.ts` |
| Style | `lib/ai/style-analyzer.ts` -- Analyzes user's writing style from past posts |
| Quality | `lib/ai/post-quality-filter.ts` -- LLM-based quality assessment |
| Post types | `lib/ai/post-types.ts` |
| Components | `components/features/ai-generation-dialog.tsx`, `components/features/ai-inline-panel.tsx`, `components/features/generation-progress.tsx`, `components/features/remix-dialog.tsx` |
| Hooks | `hooks/use-remix.ts` |
| Prompt management | `app/dashboard/prompts/`, `hooks/use-prompts.ts`, `hooks/use-prompt-editor.ts`, `hooks/use-prompt-versions.ts`, `hooks/use-prompt-analytics.ts`, `hooks/use-prompt-history.ts` |

### Technical Flow

1. All AI requests route through `lib/ai/openai-client.ts`, which wraps OpenAI SDK configured for OpenRouter (`https://openrouter.ai/api/v1`).
2. The default model is `openai/gpt-4.1`. Users can bring their own API key (BYOK) stored encrypted in `user_api_keys`.
3. Each feature has dedicated system prompts. For compose chat, the system prompt includes company context, content rules, writing style profile, and anti-AI-detection rules.
4. The style analyzer (`lib/ai/style-analyzer.ts`) examines the user's past posts to extract patterns (sentence length, vocabulary level, hook patterns, CTA patterns, signature phrases).
5. Post quality filtering (`lib/ai/post-quality-filter.ts`) runs batch LLM assessments on scraped content to determine if it meets quality thresholds.
6. Prompt management (admin feature) supports versioning, A/B testing, and usage analytics via `system_prompts`, `prompt_versions`, `prompt_usage_logs`, and `prompt_test_results`.

### Database Tables

- `user_api_keys` -- Encrypted user API keys for BYOK (provider, encrypted_key, key_hint)
- `system_prompts` -- Managed system prompts (type, content, variables, version)
- `prompt_versions` -- Version history for prompts
- `prompt_usage_logs` -- Token usage and cost tracking per prompt invocation
- `prompt_test_results` -- A/B test results for prompt iterations
- `writing_style_profiles` -- Analyzed writing patterns
- `content_rules` -- User/team content constraints
- `company_context` -- Company data for context injection
- `generated_posts` -- AI-generated post outputs

---

## 12. Deep Research

### What It Does

A Perplexity-powered research pipeline that discovers trending content and generates LinkedIn posts from research findings:

- Topic-based research with configurable depth (basic/deep)
- Cross-topic synthesis for unique content angles
- Optional "My Style" writing integration
- Research session tracking with real-time progress
- Generated posts saved as drafts

### Key Files

| Layer | File |
|-------|------|
| Components | `components/features/research-section.tsx` |
| Hooks | `hooks/use-research.ts` |
| API routes | `app/api/research/` |
| Inngest function | `lib/inngest/functions/deep-research.ts` |
| Libraries | `lib/research/tavily-client.ts`, `lib/perplexity/client.ts`, `lib/ai/research-synthesizer.ts`, `lib/ai/style-analyzer.ts` |

### Technical Flow

1. User selects topics (up to 5), research depth, and post types to generate.
2. A `research_sessions` row is created and the `discover/research` Inngest event is fired.
3. **Step 1 (Initialize)**: Session status set to `initializing`.
4. **Step 2 (Search + Enrich)**: All topics are searched concurrently via Tavily API. For each result, Perplexity (`perplexity/sonar-pro` via OpenRouter) provides deeper analysis with key insights, trend analysis, and expert opinions.
5. **Step 3 (Synthesize)**: The `research-synthesizer` identifies cross-topic themes and unique angles using OpenRouter.
6. **Step 4 (Save Discover Posts)**: Enriched results are deduplicated and saved to `discover_posts`.
7. **Step 5 (Generate Posts)**: For each top result and selected post type, OpenRouter generates LinkedIn posts using type-specific prompts (thought-leadership, storytelling, educational, contrarian, data-driven, how-to, listicle). User writing style is optionally injected.
8. **Step 6 (Save Generated Posts)**: Posts saved to `generated_posts` as drafts.
9. **Step 7 (Finalize)**: Session marked complete with metrics.

### Database Tables

- `research_sessions` -- Research session state (topics, depth, status, posts_discovered, posts_generated, error_message)
- `discover_posts` -- Research results stored as discover content
- `generated_posts` -- AI-generated posts from research (linked via research_session_id)

---

## 13. Chrome Extension

### What It Does

A Chrome extension that captures LinkedIn data directly from the browser:

- Automatic capture of LinkedIn analytics, feed posts, profile data, and messaging data
- Profile sync (LinkedIn profile data to Supabase)
- Auto-login from webapp session (extension reads webapp cookies to authenticate)
- Configurable capture settings (toggle analytics, feed, profile, messaging capture)
- Sync status tracking

### Key Files

| Layer | File |
|-------|------|
| Extension root | `extension/` |
| Background script | `extension/background/` |
| Content scripts | `extension/content/` |
| Popup UI | `extension/popup/` |
| Extension source | `extension/src/` |
| Extension lib | `extension/lib/` |
| Extension Supabase | `extension/supabase/` |
| Manifest | `extension/manifest.json` |
| Build config | `extension/esbuild.config.js`, `extension/vite.config.ts` |
| Webapp callback | `app/auth/extension-callback/` |
| Webapp API | `app/api/sync/` |
| Library | `lib/extension/` |

### Technical Flow

1. User installs the Chrome extension and logs in (or auto-logs in via webapp session).
2. Content scripts inject into LinkedIn pages and intercept API responses.
3. Captured data categories:
   - **Analytics**: Impressions, engagement, follower data from LinkedIn analytics pages.
   - **Feed posts**: Posts from the LinkedIn feed with engagement metrics.
   - **Profile data**: User's own profile information.
   - **Comments, connections, followers**: Social graph data.
4. Data is synced to Supabase tables: `linkedin_analytics`, `post_analytics`, `feed_posts`, `my_posts`, `comments`, `connections`, `followers`, `audience_data`, `linkedin_profiles`.
5. `capture_stats` tracks daily capture volumes. `sync_metadata` tracks last sync timestamps per table.
6. `extension_settings` stores per-user capture preferences.

### Database Tables

- `linkedin_analytics` -- Raw analytics snapshots
- `post_analytics` -- Per-post analytics data
- `feed_posts` -- Captured feed posts
- `my_posts` -- User's own posts
- `comments` -- Post comments
- `connections` -- LinkedIn connections
- `followers` -- LinkedIn followers
- `audience_data` -- Audience demographics
- `linkedin_profiles` -- LinkedIn profile data
- `capture_stats` -- Daily capture volume tracking
- `captured_apis` -- Raw API response captures
- `sync_metadata` -- Sync timestamps per table
- `extension_settings` -- Per-user extension configuration
- `linkedin_credentials` -- Voyager API cookies (li_at, JSESSIONID, liap, csrf_token)

---

## 14. Settings

### What It Does

Comprehensive settings management covering:

- **Profile settings**: Name, avatar, LinkedIn connection status
- **API keys**: BYOK management for OpenRouter (encrypted storage)
- **Default hashtags**: Persist default hashtags to Supabase for auto-insertion in composer
- **Content rules**: Custom rules that constrain AI-generated content (e.g., "never use emojis", "always include a CTA")
- **Writing style**: View and refresh analyzed writing style profile
- **LinkedIn status**: Connection status badge, connect/disconnect

### Key Files

| Layer | File |
|-------|------|
| Page | `app/dashboard/settings/` |
| Components | `components/features/settings.tsx`, `components/features/api-key-settings.tsx`, `components/features/default-hashtags-editor.tsx`, `components/features/content-rules-editor.tsx`, `components/features/linkedin-status-badge.tsx` |
| Hooks | `hooks/use-settings.ts`, `hooks/use-api-keys.tsx`, `hooks/use-content-rules.ts`, `hooks/use-writing-style.ts` |
| API routes | `app/api/settings/`, `app/api/settings/api-keys/` |

### Technical Flow

1. Settings page loads user profile, API keys, hashtags, content rules, and writing style data.
2. **API keys**: Keys are encrypted client-side before storage. The `user_api_keys` table stores encrypted keys with a `key_hint` (last 4 characters) for display.
3. **Default hashtags**: Stored in `user_default_hashtags` and automatically appended when composing posts.
4. **Content rules**: Rules are stored in `content_rules` with type, text, priority, and active status. They are injected into AI system prompts to constrain generation.
5. **Writing style**: The `writing_style_profiles` table stores analyzed patterns. Users can trigger a refresh which re-analyzes their recent posts.

### Database Tables

- `profiles` -- Core user profile
- `user_api_keys` -- Encrypted API keys (provider, encrypted_key, key_hint, is_valid)
- `user_default_hashtags` -- Default hashtags array
- `content_rules` -- Content constraint rules (rule_type, rule_text, is_active, priority)
- `writing_style_profiles` -- Analyzed writing patterns (avg_sentence_length, vocabulary_level, tone, hook_patterns, etc.)
- `linkedin_tokens` -- LinkedIn OAuth token state
- `user_niches` -- User's content niches
