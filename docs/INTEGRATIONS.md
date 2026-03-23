# ChainLinked Third-Party Integrations

Documentation of all external service integrations.

---

## Table of Contents

1. [OpenRouter](#1-openrouter)
2. [Supabase](#2-supabase)
3. [Inngest](#3-inngest)
4. [Firecrawl](#4-firecrawl)
5. [Brandfetch / Logo.dev](#5-brandfetch--logodev)
6. [Apify](#6-apify)
7. [Perplexity](#7-perplexity)
8. [Tavily](#8-tavily)
9. [Resend](#9-resend)
10. [LinkedIn Official API](#10-linkedin-official-api)
11. [LinkedIn Voyager API](#11-linkedin-voyager-api)
12. [PostHog](#12-posthog)

---

## 1. OpenRouter

### Purpose

Unified AI model gateway. Routes all LLM requests through a single API, providing access to GPT-4.1 (default), Perplexity sonar-pro, and other models. Supports BYOK (Bring Your Own Key) where users can provide their own API keys.

### Key Files

| File | Role |
|------|------|
| `lib/ai/openai-client.ts` | Core client wrapper using OpenAI SDK pointed at OpenRouter base URL |
| `lib/ai/compose-system-prompt.ts` | System prompt builder for compose chat |
| `lib/ai/suggestion-prompts.ts` | Prompts for swipe suggestion generation |
| `lib/ai/remix-prompts.ts` | Prompts for post remixing |
| `lib/ai/carousel-prompts.ts` | Prompts for carousel content generation |
| `lib/ai/carousel-builder.ts` | Carousel slide generation logic |
| `lib/ai/series-system-prompt.ts` | Multi-post series generation |
| `lib/ai/style-analyzer.ts` | Writing style analysis |
| `lib/ai/post-quality-filter.ts` | LLM-based quality assessment |
| `lib/ai/research-synthesizer.ts` | Cross-topic synthesis |
| `lib/ai/anti-ai-rules.ts` | Rules to make AI content sound human |
| `lib/ai/template-analyzer.ts` | Template recommendation logic |
| `app/api/ai/*/route.ts` | All AI API endpoints |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Platform API key for OpenRouter (server-side, used for background jobs and users without BYOK) |

### API Endpoints Used

- `POST https://openrouter.ai/api/v1/chat/completions` -- Chat completions (streaming and non-streaming)
- Default model: `openai/gpt-4.1`
- Also used: `perplexity/sonar-pro` (for research enrichment via the Perplexity client)

### Notes

- Users can bring their own API key, stored encrypted in `user_api_keys`
- The client supports configurable timeout (default 30s) and max retries (default 2)
- Token usage is logged to `prompt_usage_logs` for cost tracking

---

## 2. Supabase

### Purpose

Primary database (PostgreSQL), authentication, and storage. All application data lives in Supabase with Row Level Security (RLS) policies enforcing access control.

### Key Files

| File | Role |
|------|------|
| `lib/supabase/` | Server and browser client setup |
| `supabase/migrations/` | 30+ SQL migration files |
| `middleware.ts` | Session refresh and auth guard |
| `types/database.ts` | Generated TypeScript types |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://baurjucvzdboavbcuxjh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side admin operations (bypasses RLS) |

### API Endpoints Used

- Supabase JS client handles all queries (REST API under the hood)
- Auth: `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, `supabase.auth.signInWithOAuth()`
- Database: `supabase.from('table').select/insert/update/delete()`
- Storage: `supabase.storage.from('bucket').upload/download()`

### Notes

- Project ID: `baurjucvzdboavbcuxjh`
- Region: `ap-south-1`
- 75+ public tables organized by domain (see `DATABASE.md`)
- Background jobs use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

---

## 3. Inngest

### Purpose

Background job orchestration engine. Manages all cron jobs, multi-step workflows, and event-driven functions. Provides automatic retries, step-level idempotency, and observability.

### Key Files

| File | Role |
|------|------|
| `lib/inngest/client.ts` | Inngest client instance + type-safe event definitions |
| `lib/inngest/functions/` | 14 function implementations |
| `lib/inngest/functions/index.ts` | Function exports |
| `app/api/inngest/route.ts` | Webhook handler (serve endpoint) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `INNGEST_EVENT_KEY` | API key for sending events to Inngest |
| `INNGEST_SIGNING_KEY` | Webhook signing key for verifying incoming requests |

### API Endpoints Used

- Inngest SDK handles communication automatically
- Dev server: `http://127.0.0.1:8288` (local development)
- Production: Inngest Cloud

### Registered Functions

1. `publishScheduledPosts` -- Cron `*/2 * * * *`
2. `viralPostIngest` -- Cron daily 5 AM UTC
3. `influencerPostScrape` -- Cron daily 6 AM UTC + event
4. `dailyContentIngest` -- Cron daily
5. `onDemandContentIngest` -- Event-driven
6. `swipeAutoRefill` -- Cron daily
7. `analyzeCompanyWorkflow` -- Event: `company/analyze`
8. `deepResearchWorkflow` -- Event: `discover/research`
9. `generateSuggestionsWorkflow` -- Event: `swipe/generate-suggestions`
10. `suggestionsReadyHandler` -- Event: `swipe/suggestions-ready`
11. `analyticsPipeline` -- Event: `analytics/pipeline`
12. `analyticsSummaryCompute` -- Chained from pipeline
13. `analyticsBackfill` -- Manual trigger
14. `templateAutoGenerate` -- Event: `templates/auto-generate`

---

## 4. Firecrawl

### Purpose

Web scraping service used for brand kit extraction. Scrapes website HTML/CSS to extract brand colors, fonts, and logos during onboarding and brand kit setup.

### Key Files

| File | Role |
|------|------|
| `lib/firecrawl/client.ts` | Firecrawl API client |
| `lib/firecrawl/scraper.ts` | Website scraping logic |
| `lib/firecrawl/brand-extractor.ts` | CSS parsing for colors, fonts, logos |
| `lib/firecrawl/types.ts` | Type definitions |
| `lib/firecrawl/index.ts` | Module exports |
| `app/api/brand-kit/extract/route.ts` | Brand extraction API endpoint |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FIRECRAWL_API_KEY` | API key for Firecrawl service |

### API Endpoints Used

- Firecrawl scrape endpoint (via SDK/client)
- Returns HTML content, metadata, and structured data

### Notes

- Also used during company analysis (`analyze-company` Inngest workflow) to scrape company websites for context extraction
- Extracts CSS custom properties (`--primary`, `--brand`, `--accent`) for brand color detection

---

## 5. Brandfetch / Logo.dev

### Purpose

Fallback service for brand asset retrieval. Used when Firecrawl cannot extract a logo or when higher-quality brand assets are needed.

### Key Files

| File | Role |
|------|------|
| `lib/logo-dev.ts` | Logo.dev API client for logo retrieval |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LOGO_DEV_API_KEY` | API key for Logo.dev (Brandfetch) service |

### API Endpoints Used

- Logo.dev API for logo image retrieval by domain

---

## 6. Apify

### Purpose

LinkedIn profile scraping service. Used by Inngest cron jobs to scrape posts from viral creators and followed influencers without requiring LinkedIn cookies.

### Key Files

| File | Role |
|------|------|
| `lib/apify/client.ts` | Apify REST API client (run actors, fetch results) |
| `lib/inngest/functions/viral-post-ingest.ts` | Viral creator scraping |
| `lib/inngest/functions/influencer-post-scrape.ts` | Influencer post scraping |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `APIFY_API_TOKEN` | API token for Apify |

### API Endpoints Used

- `POST https://api.apify.com/v2/acts/{actorId}/runs` -- Start actor run
- `GET https://api.apify.com/v2/acts/{actorId}/runs/{runId}` -- Check run status
- `GET https://api.apify.com/v2/datasets/{datasetId}/items` -- Fetch results
- Primary actor: `harvestapi~linkedin-profile-posts` (no cookies required)

### Notes

- Default run timeout: 5 minutes
- Poll interval: 5 seconds when waiting for completion
- Results are quality-filtered by LLM before storage

---

## 7. Perplexity

### Purpose

AI-powered research and enrichment. Provides deep analysis of topics, company research, and content enrichment using the `sonar-pro` model. Routed through OpenRouter for unified API key management.

### Key Files

| File | Role |
|------|------|
| `lib/perplexity/client.ts` | Perplexity client (routes through OpenRouter, falls back to direct API) |
| `lib/perplexity/` | Module directory |
| `lib/inngest/functions/deep-research.ts` | Uses Perplexity for result enrichment |
| `lib/inngest/functions/analyze-company.ts` | Uses Perplexity for company research |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Primary: routes `perplexity/sonar-pro` through OpenRouter |
| `PERPLEXITY_API_KEY` | Fallback: direct Perplexity API access |

### API Endpoints Used

- Via OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions` with model `perplexity/sonar-pro`
- Direct fallback: `POST https://api.perplexity.ai/chat/completions` with model `sonar-pro`
- Supports search modes: `academic`, `sec`, `web` (default)

---

## 8. Tavily

### Purpose

Content search API used by the deep research pipeline. Performs web searches to find relevant articles and content on user-selected topics.

### Key Files

| File | Role |
|------|------|
| `lib/research/tavily-client.ts` | Tavily Search API client |
| `lib/inngest/functions/deep-research.ts` | Primary consumer |
| `lib/inngest/functions/ingest-articles.ts` | Article ingestion |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TAVILY_API_KEY` | API key for Tavily Search API |

### API Endpoints Used

- Tavily Search API (via SDK/client)
- Supports search depth: `basic` and `advanced`
- Returns: title, URL, content snippet, relevance score, published date

---

## 9. Resend

### Purpose

Transactional email service. Sends team invitations, email verification, and password reset emails.

### Key Files

| File | Role |
|------|------|
| `lib/email/resend.ts` | Resend client wrapper |
| `lib/email/index.ts` | Email module exports |
| `components/emails/` | React email templates |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key for Resend |
| `EMAIL_FROM_ADDRESS` | Sender email (default: `team@chainlinked.ai`) |
| `EMAIL_FROM_NAME` | Sender name (default: `ChainLinked`) |

### API Endpoints Used

- Resend SDK `emails.send()` method
- Supports React email components as templates

---

## 10. LinkedIn Official API

### Purpose

Official LinkedIn Marketing API for posting content, uploading media, and managing user profiles via OAuth 2.0.

### Key Files

| File | Role |
|------|------|
| `lib/linkedin/oauth.ts` | OAuth 2.0 flow (authorization URL, token exchange) |
| `lib/linkedin/api-client.ts` | HTTP client with token refresh |
| `lib/linkedin/post.ts` | Post creation (text, image, document) |
| `lib/linkedin/document-post.ts` | Document/carousel post creation |
| `lib/linkedin/mentions.ts` | @mention token processing |
| `lib/linkedin/types.ts` | API type definitions |
| `lib/linkedin/index.ts` | Module exports |
| `lib/linkedin/posting-config.ts` | Global posting killswitch |
| `app/api/linkedin/connect/` | OAuth initiation |
| `app/api/linkedin/callback/` | OAuth callback |
| `app/api/linkedin/disconnect/` | Token revocation |
| `app/api/linkedin/post/route.ts` | Post creation endpoint |
| `app/api/linkedin/post-document/route.ts` | Document post endpoint |
| `app/api/linkedin/status/` | Connection status check |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth app client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth app client secret |
| `LINKEDIN_REDIRECT_URI` | OAuth callback URL |
| `ENCRYPTION_KEY` | Key for encrypting/decrypting stored tokens |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET https://www.linkedin.com/oauth/v2/authorization` | OAuth authorization |
| `POST https://www.linkedin.com/oauth/v2/accessToken` | Token exchange |
| `GET https://api.linkedin.com/v2/userinfo` | Get user info |
| `GET https://api.linkedin.com/v2/me` | Get profile |
| `POST https://api.linkedin.com/v2/ugcPosts` | Create posts |
| `POST https://api.linkedin.com/v2/assets?action=registerUpload` | Register media upload |
| `PUT {uploadUrl}` | Upload media binary |

### Notes

- Tokens are encrypted at rest using `lib/crypto.ts` (`encrypt`/`safeDecrypt`)
- Token refresh is handled automatically by the API client
- Maximum 3,000 characters per post, 9 images per post
- `posting-config.ts` provides a global killswitch (`LINKEDIN_POSTING_ENABLED` env var)

---

## 11. LinkedIn Voyager API

### Purpose

LinkedIn's internal (unofficial) API used by the browser. Provides capabilities not available in the official API: post editing, deletion, reposting, and richer data access. Used via browser cookies captured by the Chrome extension.

### Key Files

| File | Role |
|------|------|
| `lib/linkedin/voyager-client.ts` | HTTP client with cookie auth, rate limiting, retries |
| `lib/linkedin/voyager-post.ts` | Post CRUD operations (create, edit, delete, repost) |
| `lib/linkedin/voyager-constants.ts` | Endpoints, headers, rate limits |
| `lib/linkedin/voyager-types.ts` | Type definitions |
| `lib/linkedin/voyager-metrics.ts` | Metrics extraction |
| `app/api/linkedin/voyager/post/route.ts` | Voyager post API endpoint |

### Environment Variables

None required (uses per-user cookies stored in database).

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /voyager/api/me` | Get current user profile |
| `POST /voyager/api/feed/normShares` | Create post |
| `POST /voyager/api/feed/normShares/{urn}` | Edit post |
| `DELETE /voyager/api/feed/updates/{urn}` | Delete post |
| Base URL: `https://www.linkedin.com` | |

### Notes

- Requires cookies: `li_at`, `JSESSIONID`, `liap`, `csrf_token` (stored in `linkedin_credentials`)
- In-memory rate limiting per user-endpoint (resets on cold start)
- Random delays between requests (MIN_REQUEST_DELAY_MS to MAX_REQUEST_DELAY_MS)
- Cookie validation checks before requests
- Automatic retry with exponential backoff

---

## 12. PostHog

### Purpose

Product analytics and session replay. Tracks user behavior, page views, feature usage, and provides session recordings for debugging.

### Key Files

| File | Role |
|------|------|
| `components/posthog-provider.tsx` | PostHog initialization with session replay |
| `hooks/use-posthog.ts` | PostHog hook for event tracking |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog instance URL |

### Features Enabled

- Page view tracking (automatic with Next.js router integration)
- Session replay with network recording
- Console log capture
- Performance monitoring
- User identification (linked to Supabase auth user)

---

## Environment Variables Summary

All environment variables needed for a complete deployment:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=

# Encryption
ENCRYPTION_KEY=

# AI / LLM
OPENROUTER_API_KEY=
PERPLEXITY_API_KEY=          # Fallback only

# Background Jobs
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Web Scraping
FIRECRAWL_API_KEY=
APIFY_API_TOKEN=
TAVILY_API_KEY=

# Brand Assets
LOGO_DEV_API_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# Feature Flags
LINKEDIN_POSTING_ENABLED=    # Global posting killswitch
```
