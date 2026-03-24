# ChainLinked Deployment Guide

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Vercel Deployment](#vercel-deployment)
3. [Supabase Production Setup](#supabase-production-setup)
4. [Inngest Setup](#inngest-setup)
5. [External Service Configuration](#external-service-configuration)
6. [Chrome Extension Deployment](#chrome-extension-deployment)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Environment Configuration](#environment-configuration)
10. [Rollback Procedures](#rollback-procedures)
11. [Database Migrations](#database-migrations)

---

## Deployment Overview

ChainLinked runs on a three-pillar production architecture:

| Service    | Role                                  | URL / Dashboard                        |
| ---------- | ------------------------------------- | -------------------------------------- |
| **Vercel** | Next.js 16 hosting, edge network, CDN | https://vercel.com                     |
| **Supabase** | PostgreSQL database, auth, storage, RLS | https://supabase.com/dashboard         |
| **Inngest** | Background jobs, cron schedules, event-driven workflows | https://app.inngest.com |

Additionally, a **Chrome Extension** ("ChainLinked Data Connector") is distributed via the Chrome Web Store and syncs LinkedIn data into Supabase.

### High-Level Architecture

```
Browser (chainlinked.ai)
  |
  v
Vercel (Next.js 16 App Router)
  |--- Server Components (data fetching via Supabase server client)
  |--- API Routes (/api/*)
  |--- /api/inngest (webhook endpoint for Inngest)
  |
  v
Supabase (PostgreSQL + Auth + Storage)
  ^
  |
Chrome Extension (LinkedIn data sync)

Inngest Cloud
  |--- Cron-triggered functions
  |--- Event-triggered workflows
  |--- Calls Supabase + external APIs (OpenRouter, Apify, Tavily, etc.)
```

---

## Vercel Deployment

### Project Setup

1. Import the repository into Vercel from the Git provider.
2. Set the **framework preset** to **Next.js**.
3. Vercel auto-detects `next.config.ts` and applies the correct build pipeline.

### Build Settings

| Setting           | Value             |
| ----------------- | ----------------- |
| Framework         | Next.js           |
| Build Command     | `next build`      |
| Output Directory  | `.next`           |
| Install Command   | `npm install`     |
| Node.js Version   | 20.x (LTS)       |

The `package.json` scripts used by Vercel:

```json
{
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

### Environment Variables

All variables from `.env.example` must be configured in Vercel's project settings under **Settings > Environment Variables**. Critical production values:

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://baurjucvzdboavbcuxjh.supabase.co`) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `NEXT_PUBLIC_APP_URL` | Production URL (`https://chainlinked.ai`) | Yes |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth app client ID | Yes |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth app secret | Yes |
| `LINKEDIN_REDIRECT_URI` | `https://chainlinked.ai/api/linkedin/callback` | Yes |
| `LINKEDIN_POSTING_ENABLED` | Set to `true` to enable live posting to LinkedIn | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls | Yes |
| `TAVILY_API_KEY` | Tavily API key for web search | Yes |
| `PERPLEXITY_API_KEY` | Perplexity API key for research | Yes |
| `APIFY_API_TOKEN` | Apify token for LinkedIn scraping | Yes |
| `RESEND_API_KEY` | Resend API key for transactional email | Yes |
| `EMAIL_FROM_ADDRESS` | `team@chainlinked.ai` | Yes |
| `EMAIL_FROM_NAME` | `ChainLinked` | Yes |
| `API_KEY_ENCRYPTION_SECRET` | Encryption key (minimum 32 characters) | Yes |
| `INNGEST_EVENT_KEY` | Inngest event key for sending events | Yes |
| `INNGEST_SIGNING_KEY` | Inngest signing key for webhook verification | Yes |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.posthog.com` | Yes |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | Logo.dev API token | No |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key for stock images | No |
| `ADMIN_EMAILS` | Comma-separated admin email addresses | Yes |
| `REMOVE_BG_API_KEY` | remove.bg API key for background removal | No |
| `CRON_SECRET` | Secret for Vercel cron job authentication | Yes |
| `NEXT_PUBLIC_CHROME_STORE_URL` | Chrome Web Store listing URL | No |
| `NEXT_PUBLIC_EXTENSION_ID` | Chrome extension ID for communication | No |
| `NEXT_PUBLIC_ONBOARDING_WEBHOOK_URL` | Webhook URL for onboarding events | No |

**Important**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never prefix secrets with `NEXT_PUBLIC_`.

### Domain Configuration

1. In Vercel dashboard, go to **Settings > Domains**.
2. Add `chainlinked.ai` and `www.chainlinked.ai`.
3. Configure DNS records at your domain registrar:
   - `A` record for `chainlinked.ai` pointing to Vercel's IP (`76.76.21.21`).
   - `CNAME` record for `www.chainlinked.ai` pointing to `cname.vercel-dns.com`.
4. Enable **Force HTTPS** and **Redirect www to root** (or vice versa).

### Security Headers

The `next.config.ts` applies the following security headers to all routes (`/(.*)`):

- `X-Frame-Options: DENY` -- prevents clickjacking
- `X-Content-Type-Options: nosniff` -- prevents MIME sniffing
- `Referrer-Policy: origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`

### Remote Image Domains

The Next.js image optimizer allows images from:

- `media.licdn.com` (LinkedIn profile photos and post images)
- `img.logo.dev` (company logos via Logo.dev)

---

## Supabase Production Setup

### Project Configuration

- **Project ID**: `baurjucvzdboavbcuxjh`
- **Region**: `ap-south-1`
- **URL**: `https://baurjucvzdboavbcuxjh.supabase.co`

### Database Tables

The following tables are used in production (see `docs/DATABASE.md` for full schema details):

| Table | Purpose |
| ----- | ------- |
| `users` | User accounts and profiles |
| `linkedin_profiles` | Connected LinkedIn profile data |
| `linkedin_analytics` | Raw LinkedIn analytics snapshots |
| `analytics_history` | Time-series analytics data |
| `post_analytics` | Per-post engagement metrics |
| `audience_data` | Current audience demographics |
| `audience_history` | Historical audience demographics |
| `connections` | User's LinkedIn connections |
| `feed_posts` | LinkedIn feed posts captured by extension |
| `my_posts` | User's own LinkedIn posts |
| `comments` | Post comments |
| `followers` | Follower data |
| `captured_apis` | Raw API captures from extension |
| `capture_stats` | Extension capture statistics |
| `extension_settings` | Per-user extension configuration |
| `sync_metadata` | Extension sync tracking |

### Row Level Security (RLS)

All tables must have RLS enabled. Policies should follow these patterns:

- **SELECT**: Users can only read their own data (`auth.uid() = user_id`).
- **INSERT**: Users can only insert rows where `user_id` matches their auth ID.
- **UPDATE**: Users can only update their own rows.
- **DELETE**: Users can only delete their own rows.
- **Service role**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS for server-side operations (Inngest functions, API routes using the service client).

### Storage Buckets

Configure any required storage buckets via the Supabase dashboard:

1. Navigate to **Storage** in the Supabase dashboard.
2. Create buckets as needed (e.g., for carousel images, user uploads).
3. Set appropriate RLS policies on each bucket.
4. Configure CORS if the extension or external clients need direct uploads.

### Edge Functions

If edge functions are deployed, manage them via the Supabase CLI:

```bash
supabase functions deploy <function-name> --project-ref baurjucvzdboavbcuxjh
```

---

## Inngest Setup

Inngest handles all background processing, cron-scheduled jobs, and event-driven workflows. The integration point is the API route at `/api/inngest`.

### How It Works

1. The Next.js app exposes an Inngest webhook endpoint at `POST /api/inngest`.
2. Inngest Cloud calls this endpoint to execute registered functions.
3. Functions are defined in `lib/inngest/functions/` and registered in `app/api/inngest/route.ts`.
4. The Inngest client is configured in `lib/inngest/client.ts` with the app ID `chainlinked`.

### Registered Functions

There are 15 registered functions:

| Function | Trigger | Schedule | Description |
| -------- | ------- | -------- | ----------- |
| `analyzeCompanyWorkflow` | Event: `company/analyze` | On-demand | Analyzes a company's website and generates context |
| `deepResearchWorkflow` | Event: `discover/research` | On-demand | Multi-step research pipeline with AI post generation |
| `generateSuggestionsWorkflow` | Event: `swipe/generate-suggestions` | On-demand | Generates swipe card suggestions for a user |
| `suggestionsReadyHandler` | Event: `swipe/suggestions-ready` | On-demand | Handles post-generation notification |
| `onDemandContentIngest` | Event: `discover/ingest` | On-demand | Ingests content for specific topics |
| `firstSyncBackfill` | Event: `sync/first-data` | On-demand | Processes first extension data sync immediately |
| `dailyContentIngest` | Cron | `0 6 * * *` (daily 06:00 UTC) | Ingests trending content across topics |
| `viralPostIngest` | Cron | `0 5 * * *` (daily 05:00 UTC) | Scrapes viral posts from source profiles |
| `influencerPostScrape` | Cron + Event | `0 6 * * *` (daily 06:00 UTC) | Scrapes followed influencer posts; also triggered by `influencer/follow` |
| `swipeAutoRefill` | Cron | `*/30 * * * *` (every 30 min) | Refills suggestion queues for all users |
| `analyticsPipeline` | Cron | `*/5 * * * *` (every 5 min) | Aggregates profile and post analytics |
| `analyticsSummaryCompute` | Cron | `*/5 * * * *` (every 5 min) | Computes analytics summary rollups |
| `analyticsBackfill` | Cron | `*/5 * * * *` (every 5 min) | Backfills missing analytics from extension sync data |
| `templateAutoGenerate` | Cron | `0 */4 * * *` (every 4 hours) | Auto-generates post templates for users |
| `publishScheduledPosts` | Cron | `*/2 * * * *` (every 2 min) | Publishes posts that are due for scheduling |

### Production Setup

1. Create an account at [app.inngest.com](https://app.inngest.com).
2. Create an app named "ChainLinked".
3. Copy the **Event Key** and **Signing Key** to Vercel environment variables.
4. After deploying, Inngest auto-discovers functions by calling `GET /api/inngest`.
5. Verify all 15 functions appear in the Inngest dashboard under your app.

### Local Development

Run the Inngest dev server alongside Next.js:

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Inngest dev server
npm run dev:inngest

# Or run both concurrently:
npm run dev:all
```

The Inngest dev dashboard is available at `http://127.0.0.1:8288`.

### Event Types

All events are strongly typed via `InngestEvents` in `lib/inngest/client.ts`. Key event categories:

- **Company**: `company/analyze`, `company/analyze.completed`
- **Discover/Research**: `discover/research`, `discover/research.completed`, `discover/research.failed`, `discover/research.progress`
- **Content Ingest**: `discover/ingest`, `discover/ingest.completed`
- **Swipe**: `swipe/generate-suggestions`, `swipe/suggestions-ready`, `swipe/auto-refill.completed`
- **Analytics**: `analytics/pipeline`, `analytics/pipeline.completed`
- **Templates**: `templates/auto-generate`, `templates/auto-generate.completed`
- **Influencer**: `influencer/follow`, `influencer/scrape.completed`
- **Sync**: `sync/first-data`
- **Viral**: `viral/ingest.completed`

---

## External Service Configuration

### LinkedIn OAuth App

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/).
2. Create or configure the OAuth application.
3. Add the production redirect URI: `https://chainlinked.ai/api/linkedin/callback`.
4. Required products/scopes:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn** (for posting)
   - **Marketing Developer Platform** (if using analytics APIs)
5. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in Vercel.

### OpenRouter API (LLM)

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. Create an API key.
3. Set `OPENROUTER_API_KEY` in Vercel.
4. Used via `@ai-sdk/openai-compatible` for AI-powered features (post generation, research, template creation, company analysis).

### Tavily API (Web Search)

1. Sign up at [tavily.com](https://tavily.com).
2. Generate an API key.
3. Set `TAVILY_API_KEY` in Vercel.
4. Used for deep research topic searches in the discover workflow.

### Perplexity API (Research)

1. Sign up at [perplexity.ai](https://www.perplexity.ai).
2. Generate an API key.
3. Set `PERPLEXITY_API_KEY` in Vercel.
4. Used for enriched research in deep research workflows.

### Apify API (LinkedIn Scraping)

1. Sign up at [apify.com](https://apify.com).
2. Create an API token.
3. Set `APIFY_API_TOKEN` in Vercel.
4. Used for influencer post scraping and viral post ingestion cron jobs.

### PostHog (Analytics and Product Tracking)

1. Sign up at [posthog.com](https://posthog.com).
2. Create a project.
3. Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.posthog.com`) in Vercel.
4. Both client-side (`posthog-js`) and server-side (`posthog-node`) SDKs are used.

### Resend (Transactional Email)

1. Sign up at [resend.com](https://resend.com).
2. Verify the sending domain (`chainlinked.ai`) by adding DNS records.
3. Create an API key.
4. Set `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` (`team@chainlinked.ai`), and `EMAIL_FROM_NAME` (`ChainLinked`) in Vercel.
5. Email templates are built with `@react-email/components`.

### Logo.dev (Company Logos)

1. Sign up at [logo.dev](https://logo.dev).
2. Get an API token.
3. Set `NEXT_PUBLIC_LOGO_DEV_TOKEN` in Vercel.
4. Images are served from `img.logo.dev` (configured in `next.config.ts`).

### Unsplash (Stock Images)

1. Sign up at [unsplash.com/developers](https://unsplash.com/developers).
2. Create an application and get an access key.
3. Set `UNSPLASH_ACCESS_KEY` in Vercel.

### remove.bg (Background Removal)

1. Sign up at [remove.bg](https://www.remove.bg).
2. Get an API key.
3. Set `REMOVE_BG_API_KEY` in Vercel.

---

## Chrome Extension Deployment

The Chrome Extension is located in the `extension/` directory. It is a Manifest V3 extension named "ChainLinked Data Connector" (current version: `4.1.0`).

### Building for Production

1. Ensure the extension source files in `extension/` are up to date.
2. The extension has its own `package.json` in `extension/`. Install dependencies if applicable.
3. Build the distribution-ready files into `extension/dist/` (if a build step is required).
4. Update `extension/manifest.json` version number following semver.

### Chrome Web Store Submission

1. Create a ZIP file of the `extension/` directory contents (excluding unnecessary files like `.git`, `node_modules`).
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
3. Upload the ZIP as a new version.
4. Fill in the listing details:
   - **Name**: ChainLinked Data Connector
   - **Description**: Extract your LinkedIn profile data, analytics, and network insights with cloud sync
   - **Author**: AGI Ready
5. Submit for review.

### Extension Permissions

The extension requires:

- `cookies`, `storage`, `unlimitedStorage`, `activeTab`, `scripting`, `alarms`, `notifications`, `identity`
- Host permissions for `*.linkedin.com`, `*.supabase.co`, `media.licdn.com`, `*.licdn.com`

### Externally Connectable

The extension communicates with the web app. Production origins:

- `https://chainlinked.ai/*`
- `https://www.chainlinked.ai/*`
- `http://localhost:3000/*` through `http://localhost:3004/*` (development)

### Version Management

- Update `version` in `extension/manifest.json` before each Chrome Web Store submission.
- The manifest version follows semver (`major.minor.patch`).
- Keep the `NEXT_PUBLIC_EXTENSION_ID` environment variable updated if the extension ID changes.

### OAuth2 (Google Sign-In)

The extension uses Google OAuth2 for authentication:

- Client ID: `316179618836-6q8qiu0d8gd3tak9fvat7m93dlksifs4.apps.googleusercontent.com`
- Scopes: `openid`, `userinfo.email`, `userinfo.profile`

---

## CI/CD Pipeline

### Build Verification

Vercel automatically runs the build on every push to the connected branch. The build pipeline:

1. `npm install` -- installs dependencies
2. `next build` -- compiles the Next.js application
3. TypeScript type checking (included in `next build`)
4. Output is deployed to Vercel's edge network

### Linting

Run ESLint locally or in CI:

```bash
npm run lint
```

### Type Checking

TypeScript strict mode is enabled. Type errors will fail the build:

```bash
npx tsc --noEmit
```

### Pre-Deployment Checklist

- [ ] All environment variables are set in Vercel for the target environment
- [ ] `npm run build` succeeds locally without errors
- [ ] `npm run lint` passes
- [ ] No `console.log` statements left in production code (use structured logging)
- [ ] Inngest functions are registered and visible in the Inngest dashboard
- [ ] Database migrations have been applied to the production Supabase instance
- [ ] Chrome extension version is updated if extension changes are included

---

## Monitoring and Observability

### PostHog Analytics

- **Client-side**: `posthog-js` (v1.335.3) tracks user interactions, page views, and feature usage.
- **Server-side**: `posthog-node` (v5.28.5) tracks server events and API usage.
- Dashboard: [us.posthog.com](https://us.posthog.com)

### Inngest Monitoring

- View function execution history, failures, and retries in the [Inngest dashboard](https://app.inngest.com).
- Each function emits completion events (e.g., `analytics/pipeline.completed`) with metrics.
- Failed functions include error details and the failing step name.

### Vercel Monitoring

- **Logs**: View serverless function logs in Vercel dashboard under **Deployments > Functions**.
- **Analytics**: Vercel provides built-in web analytics (Core Web Vitals, page views).
- **Alerts**: Configure alerts for build failures, high error rates, or performance degradation.

### Error Tracking

- Application errors surface in Vercel function logs.
- Inngest provides retry logic and error visibility for background jobs.
- Consider integrating a dedicated error tracking service (e.g., Sentry) for comprehensive error monitoring.

### Health Checks

- Vercel automatically monitors deployment health.
- Inngest monitors function health and alerts on repeated failures.
- Supabase dashboard shows database health, connection pool usage, and query performance.

---

## Environment Configuration

### Development

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback
LINKEDIN_POSTING_ENABLED=false
# Inngest auto-detects development mode (isDev)
```

Run locally:

```bash
npm run dev          # Next.js only
npm run dev:inngest  # Inngest dev server only
npm run dev:all      # Both concurrently
```

### Staging

If using Vercel preview deployments as staging:

```env
NEXT_PUBLIC_APP_URL=https://your-preview-url.vercel.app
LINKEDIN_REDIRECT_URI=https://your-preview-url.vercel.app/api/linkedin/callback
LINKEDIN_POSTING_ENABLED=false
```

Note: LinkedIn OAuth redirect URIs must be registered in the LinkedIn Developer Portal for each environment.

### Production

```env
NEXT_PUBLIC_APP_URL=https://chainlinked.ai
LINKEDIN_REDIRECT_URI=https://chainlinked.ai/api/linkedin/callback
LINKEDIN_POSTING_ENABLED=true
```

### Environment Variable Scoping in Vercel

Vercel allows scoping variables to specific environments:

- **Production**: Only applied to production deployments
- **Preview**: Applied to preview/staging deployments
- **Development**: Applied when using `vercel dev`

Use scoping to safely test with different API keys and configuration per environment.

---

## Rollback Procedures

### Vercel Rollback

1. Go to **Vercel Dashboard > Deployments**.
2. Find the last known-good deployment.
3. Click the three-dot menu and select **Promote to Production**.
4. The previous deployment is instantly promoted with zero downtime.

Alternatively, via CLI:

```bash
npx vercel rollback
```

### Inngest Rollback

Inngest functions are deployed as part of the Vercel deployment. Rolling back the Vercel deployment also rolls back Inngest function definitions. After rollback:

1. Verify functions are re-registered by checking the Inngest dashboard.
2. Cancel any in-progress function runs that may be using the new (broken) code.

### Database Rollback

Database schema changes are harder to roll back. Best practices:

1. Always write reversible migrations (include both `up` and `down` SQL).
2. Test migrations on a staging/branch database before production.
3. For emergency rollback, write a compensating migration that reverses the changes.
4. Never drop columns or tables without a migration period where the old code no longer references them.

### Chrome Extension Rollback

1. Chrome Web Store does not support instant rollback.
2. To revert, submit the previous version as a new upload with an incremented version number.
3. Review times vary (typically 1-3 business days).

---

## Database Migrations

### Overview

Database schema is managed through Supabase. The schema is defined in `extension/supabase/schema.sql` (for the extension-related tables) and managed via the Supabase dashboard or CLI.

### Using the Supabase CLI

Install the Supabase CLI:

```bash
npm install -g supabase
```

Initialize (if not already):

```bash
supabase init
```

Create a new migration:

```bash
supabase migration new <migration_name>
```

This creates a timestamped SQL file in `supabase/migrations/`.

### Applying Migrations

**Local development:**

```bash
supabase db reset    # Reset and replay all migrations
supabase db push     # Push migrations to linked project
```

**Production:**

```bash
supabase link --project-ref baurjucvzdboavbcuxjh
supabase db push
```

### Migration Best Practices

1. **One change per migration**: Keep migrations focused on a single schema change.
2. **Idempotent where possible**: Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
3. **Never modify a deployed migration**: Always create a new migration for changes.
4. **Include RLS policies**: Add RLS policies in the same migration as table creation.
5. **Test on a branch database**: Use Supabase branching to test migrations before production.
6. **Back up before migrating**: Create a database backup via the Supabase dashboard before applying migrations to production.

### Supabase Branching

For testing schema changes safely:

```bash
supabase branches create <branch-name>
# Test migrations on the branch
supabase db push --db-url <branch-db-url>
# When satisfied, merge
supabase branches merge <branch-name>
```

### Emergency Database Operations

- **Point-in-time recovery**: Available through Supabase dashboard (Pro plan and above).
- **Manual backup**: Use `pg_dump` via the Supabase connection string.
- **Read replicas**: Configure in Supabase dashboard for read-heavy workloads.
