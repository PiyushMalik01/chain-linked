# ChainLinked System Architecture

Technical architecture documentation with Mermaid diagrams.

---

## Overall System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["Next.js Web App<br/>(React 19 + App Router)"]
        EXT["Chrome Extension<br/>(Content Scripts + Background)"]
    end

    subgraph "API Layer"
        MW["Middleware<br/>(Auth + Onboarding Guard)"]
        API["Next.js API Routes<br/>(/api/*)"]
        INNGEST_EP["Inngest Webhook<br/>(/api/inngest)"]
    end

    subgraph "Background Jobs"
        INNGEST["Inngest Engine<br/>(14 Functions)"]
    end

    subgraph "Data Layer"
        SUPA["Supabase PostgreSQL<br/>(75+ tables, RLS)"]
        SUPA_AUTH["Supabase Auth<br/>(Email + Google OAuth)"]
        SUPA_STORAGE["Supabase Storage<br/>(Logos, Media)"]
    end

    subgraph "External Services"
        LI_OFFICIAL["LinkedIn Official API<br/>(OAuth, UGC Posts)"]
        LI_VOYAGER["LinkedIn Voyager API<br/>(Internal, Cookie-based)"]
        OPENROUTER["OpenRouter<br/>(GPT-4.1, Perplexity)"]
        FIRECRAWL["Firecrawl<br/>(Web Scraping)"]
        APIFY["Apify<br/>(LinkedIn Scraping)"]
        TAVILY["Tavily<br/>(Content Search)"]
        RESEND["Resend<br/>(Transactional Email)"]
        POSTHOG["PostHog<br/>(Product Analytics)"]
    end

    WEB --> MW --> API
    EXT --> SUPA
    EXT --> LI_VOYAGER
    API --> SUPA
    API --> SUPA_AUTH
    API --> LI_OFFICIAL
    API --> LI_VOYAGER
    API --> OPENROUTER
    API --> FIRECRAWL
    API --> RESEND
    INNGEST_EP --> INNGEST
    INNGEST --> SUPA
    INNGEST --> OPENROUTER
    INNGEST --> APIFY
    INNGEST --> TAVILY
    INNGEST --> FIRECRAWL
    WEB --> POSTHOG
```

---

## Data Flow: Extension to Dashboard

```mermaid
sequenceDiagram
    participant LI as LinkedIn.com
    participant EXT as Chrome Extension
    participant SB as Supabase
    participant INNGEST as Inngest Pipeline
    participant DASH as Dashboard

    Note over EXT: Content scripts inject into LinkedIn pages

    LI->>EXT: Intercept API responses<br/>(analytics, feed, profile)
    EXT->>EXT: Parse & categorize data
    EXT->>SB: Upsert to linkedin_analytics,<br/>post_analytics, feed_posts,<br/>my_posts, audience_data
    EXT->>SB: Update capture_stats,<br/>sync_metadata

    Note over INNGEST: Daily cron triggers

    SB->>INNGEST: analytics-pipeline reads<br/>raw extension data
    INNGEST->>INNGEST: Compute daily deltas
    INNGEST->>SB: Write profile_analytics_daily,<br/>post_analytics_daily
    INNGEST->>INNGEST: Roll up to wk/mth/qtr/yr
    INNGEST->>SB: Write rollup tables
    INNGEST->>INNGEST: Compute summary cache
    INNGEST->>SB: Write analytics_summary_cache

    DASH->>SB: Query analytics_summary_cache,<br/>post_analytics_daily, etc.
    SB->>DASH: Return time-series +<br/>summary data
    DASH->>DASH: Render Recharts +<br/>TanStack Table
```

---

## AI Pipeline: User Prompt to Response

```mermaid
sequenceDiagram
    participant USER as User
    participant API as API Route
    participant PROMPT as Prompt Builder
    participant OPENROUTER as OpenRouter API
    participant DB as Supabase

    USER->>API: Send message / request
    API->>DB: Fetch user context:<br/>company_context, content_rules,<br/>writing_style_profiles, user_api_keys
    DB->>API: Context data
    API->>PROMPT: Build system prompt with:<br/>- Company context<br/>- Content rules<br/>- Writing style fragment<br/>- Anti-AI rules<br/>- Post type template
    PROMPT->>API: Complete system prompt
    API->>OPENROUTER: POST /v1/chat/completions<br/>model: openai/gpt-4.1<br/>(or user's BYOK key)
    OPENROUTER->>API: Streamed response
    API->>USER: SSE stream / JSON response
    API->>DB: Log to prompt_usage_logs<br/>(tokens, cost, model)
```

---

## Inngest Workflow Architecture

All 14 registered Inngest functions and their triggers:

```mermaid
graph LR
    subgraph "Cron Triggers"
        C1["*/2 * * * *"]
        C2["Daily 5 AM UTC"]
        C3["Daily 6 AM UTC"]
        C4["Daily"]
        C5["Weekly"]
    end

    subgraph "Event Triggers"
        E1["company/analyze"]
        E2["discover/research"]
        E3["swipe/generate-suggestions"]
        E4["swipe/suggestions-ready"]
        E5["discover/ingest"]
        E6["influencer/follow"]
        E7["analytics/pipeline<br/>(manual)"]
        E8["templates/auto-generate<br/>(manual)"]
    end

    subgraph "Inngest Functions"
        F1["publishScheduledPosts"]
        F2["viralPostIngest"]
        F3["influencerPostScrape"]
        F4["dailyContentIngest"]
        F5["swipeAutoRefill"]
        F6["analyzeCompanyWorkflow"]
        F7["deepResearchWorkflow"]
        F8["generateSuggestionsWorkflow"]
        F9["suggestionsReadyHandler"]
        F10["onDemandContentIngest"]
        F11["analyticsPipeline"]
        F12["analyticsSummaryCompute"]
        F13["analyticsBackfill"]
        F14["templateAutoGenerate"]
    end

    C1 --> F1
    C2 --> F2
    C3 --> F3
    C4 --> F4
    C4 --> F5
    C5 --> F14
    E1 --> F6
    E2 --> F7
    E3 --> F8
    E4 --> F9
    E5 --> F10
    E6 --> F3
    E7 --> F11
    E7 --> F12
    E7 --> F13
    E8 --> F14
```

### Function Details

| Function | Trigger | Purpose | Key Tables |
|----------|---------|---------|------------|
| `publishScheduledPosts` | Cron `*/2 * * * *` | Publish pending scheduled posts via LinkedIn API | `scheduled_posts`, `linkedin_tokens`, `my_posts` |
| `viralPostIngest` | Cron daily 5 AM | Scrape viral creators via Apify, quality filter, save | `viral_source_profiles`, `discover_posts` |
| `influencerPostScrape` | Cron daily 6 AM + event | Scrape followed influencers via Apify | `followed_influencers`, `influencer_posts` |
| `dailyContentIngest` | Cron daily | Ingest topic-based content | `discover_posts`, `discover_news_articles` |
| `swipeAutoRefill` | Cron daily | Check user suggestion counts, trigger refills | `generated_suggestions` |
| `analyzeCompanyWorkflow` | Event `company/analyze` | Firecrawl + Perplexity + OpenAI company analysis | `company_context` |
| `deepResearchWorkflow` | Event `discover/research` | Tavily + Perplexity + OpenAI research pipeline | `research_sessions`, `discover_posts`, `generated_posts` |
| `generateSuggestionsWorkflow` | Event `swipe/generate-suggestions` | Generate personalized post suggestions | `generated_suggestions`, `suggestion_generation_runs` |
| `suggestionsReadyHandler` | Event `swipe/suggestions-ready` | Post-generation notification handler | -- |
| `onDemandContentIngest` | Event `discover/ingest` | User-triggered content ingest | `discover_posts` |
| `analyticsPipeline` | Event `analytics/pipeline` | Daily/weekly/monthly analytics rollup | All `post_analytics_*` and `profile_analytics_*` tables |
| `analyticsSummaryCompute` | Chained from pipeline | Pre-compute dashboard summary metrics | `analytics_summary_cache` |
| `analyticsBackfill` | Manual trigger | Backfill historical analytics data | All analytics tables |
| `templateAutoGenerate` | Event `templates/auto-generate` | AI-generate templates for users | `templates` |

---

## LinkedIn Posting Flow

```mermaid
graph TD
    subgraph "Post Creation"
        COMPOSE["User composes post<br/>in Composer"]
        SCHEDULE{"Schedule or<br/>Post Now?"}
    end

    subgraph "Immediate Post"
        VALIDATE["Validate content<br/>(3000 char limit)"]
        MENTIONS["Process @mentions<br/>(token → URN attributes)"]
        MEDIA{"Has media?"}
        TEXT_POST["Build text-only<br/>UGC payload"]
        MEDIA_UPLOAD["Register upload →<br/>Upload binary →<br/>Get asset URN"]
        MEDIA_POST["Build media<br/>UGC payload"]
        DOC_POST["Build document<br/>post payload"]
        OFFICIAL["LinkedIn Official API<br/>(UGC Posts endpoint)"]
        VOYAGER["LinkedIn Voyager API<br/>(normShares endpoint)"]
    end

    subgraph "Scheduled Post"
        SAVE_QUEUE["Save to scheduled_posts<br/>(status: pending)"]
        CRON["Inngest cron<br/>(every 2 min)"]
        FETCH_TOKENS["Fetch + decrypt<br/>LinkedIn tokens"]
        PUBLISH["Create LinkedIn client<br/>→ createPost()"]
        UPDATE["Update status<br/>(posted/failed)"]
    end

    COMPOSE --> SCHEDULE
    SCHEDULE -->|Post Now| VALIDATE
    SCHEDULE -->|Schedule| SAVE_QUEUE
    VALIDATE --> MENTIONS
    MENTIONS --> MEDIA
    MEDIA -->|No| TEXT_POST
    MEDIA -->|Images| MEDIA_UPLOAD --> MEDIA_POST
    MEDIA -->|Document/PDF| DOC_POST
    TEXT_POST --> OFFICIAL
    MEDIA_POST --> OFFICIAL
    DOC_POST --> OFFICIAL
    OFFICIAL --> |"Success"| RECORD["Log to my_posts"]
    SAVE_QUEUE --> CRON
    CRON --> FETCH_TOKENS
    FETCH_TOKENS --> PUBLISH
    PUBLISH --> UPDATE
    UPDATE -->|Success| RECORD

    style OFFICIAL fill:#0077b5,color:#fff
    style VOYAGER fill:#0077b5,color:#fff
```

### Dual API Strategy

ChainLinked supports two LinkedIn API paths:

1. **Official API** (`lib/linkedin/post.ts`, `lib/linkedin/api-client.ts`): Uses OAuth 2.0 tokens from `linkedin_tokens`. Supports UGC Posts, media upload, document posts. Used for all scheduled posts and primary posting.

2. **Voyager API** (`lib/linkedin/voyager-post.ts`, `lib/linkedin/voyager-client.ts`): Uses browser cookies from `linkedin_credentials` (li_at, JSESSIONID). Supports posting, editing, deleting, reposting. Used as fallback and for operations not available in the official API. Includes rate limiting, retry logic, and cookie validation.

---

## Onboarding Flow

```mermaid
graph TD
    SIGNUP["User signs up<br/>(email or Google OAuth)"]
    ROLE["Role Selection<br/>/onboarding"]

    subgraph "Owner Path"
        S1["Step 1: Company Setup<br/>/onboarding/step1<br/>Create company + team"]
        S2["Step 2: Company Context<br/>/onboarding/step2<br/>Trigger AI analysis"]
        S3["Step 3: Invite Team<br/>/onboarding/step3<br/>Send email invitations"]
        S4["Step 4: Review<br/>/onboarding/step4<br/>Mark complete"]
    end

    subgraph "Member Path"
        JOIN["Join Team<br/>/onboarding/join<br/>Search discoverable teams<br/>or accept invitation"]
        PENDING["Pending Approval<br/>(if team requires approval)"]
    end

    subgraph "Background (Owner Step 2)"
        INNGEST_CO["Inngest: analyze-company"]
        FIRECRAWL_S["Firecrawl: Scrape website"]
        PERPLEXITY_S["Perplexity: Research company"]
        OPENAI_S["OpenAI: Extract structured data"]
        SAVE_CTX["Save to company_context"]
    end

    SIGNUP --> ROLE
    ROLE -->|"I'm creating<br/>a team"| S1
    ROLE -->|"I'm joining<br/>a team"| JOIN
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> DASHBOARD["Dashboard"]
    JOIN --> PENDING
    PENDING -->|Approved| DASHBOARD
    JOIN -->|Direct accept| DASHBOARD

    S2 -.->|Triggers| INNGEST_CO
    INNGEST_CO --> FIRECRAWL_S
    FIRECRAWL_S --> PERPLEXITY_S
    PERPLEXITY_S --> OPENAI_S
    OPENAI_S --> SAVE_CTX
```

---

## Scheduling Pipeline Flow

```mermaid
graph TD
    subgraph "User Actions"
        CREATE["User schedules post<br/>(content + datetime + timezone)"]
    end

    subgraph "Database"
        SP["scheduled_posts<br/>status: pending<br/>scheduled_for: UTC timestamp"]
    end

    subgraph "Inngest Cron (every 2 min)"
        FETCH["Query: status=pending<br/>AND scheduled_for <= now()<br/>LIMIT 50"]
        CHECK["Check global posting<br/>killswitch"]
        LOOP["For each post:"]
        GET_TOKENS["Fetch linkedin_tokens<br/>for user_id"]
        DECRYPT["Decrypt access_token<br/>+ refresh_token"]
        CLIENT["Create LinkedIn API client<br/>(with token refresh callback)"]
        POST["Call createPost()<br/>(Official API)"]
        SUCCESS["Update status: posted<br/>Set linkedin_post_id<br/>Log to my_posts"]
        FAIL["Update status: failed<br/>Set error_message"]
    end

    CREATE --> SP
    SP --> FETCH
    FETCH --> CHECK
    CHECK -->|Enabled| LOOP
    CHECK -->|Disabled| SKIP["Skip all posts"]
    LOOP --> GET_TOKENS
    GET_TOKENS --> DECRYPT
    DECRYPT --> CLIENT
    CLIENT --> POST
    POST -->|Success| SUCCESS
    POST -->|Error| FAIL

    style SUCCESS fill:#22c55e,color:#fff
    style FAIL fill:#ef4444,color:#fff
```

---

## Deep Research Pipeline Flow

```mermaid
graph TD
    subgraph "User Input"
        INPUT["Select topics (1-5)<br/>Choose depth (basic/deep)<br/>Select post types<br/>Toggle 'My Style'"]
    end

    subgraph "Step 1: Initialize"
        INIT["Create research_sessions row<br/>Status: initializing"]
    end

    subgraph "Step 2: Search + Enrich (Parallel per topic)"
        TAVILY["Tavily API Search<br/>(per topic, concurrent)"]
        PERPLEXITY["Perplexity Enrichment<br/>(per result, concurrent)<br/>Key insights + trends"]
        DEDUP["Deduplicate by URL<br/>Sort by relevance score"]
    end

    subgraph "Step 3: Synthesize"
        SYNTH["Cross-topic synthesis<br/>(OpenRouter)<br/>Find themes + unique angles"]
    end

    subgraph "Step 4: Save Discover Posts"
        SAVE_DISC["Upsert to discover_posts<br/>(skip existing URLs)"]
    end

    subgraph "Step 5: Generate Posts (Parallel)"
        GEN["For each top result x post type:<br/>OpenRouter GPT-4.1<br/>+ Type-specific prompt<br/>+ Company context<br/>+ Style fragment<br/>+ Cross-topic context"]
    end

    subgraph "Step 6: Save Generated Posts"
        SAVE_GEN["Insert to generated_posts<br/>(status: draft)"]
    end

    subgraph "Step 7: Finalize"
        DONE["Session status: completed<br/>Emit discover/research.completed"]
    end

    INPUT --> INIT
    INIT --> TAVILY
    TAVILY --> PERPLEXITY
    PERPLEXITY --> DEDUP
    DEDUP --> SYNTH
    SYNTH --> SAVE_DISC
    SAVE_DISC --> GEN
    GEN --> SAVE_GEN
    SAVE_GEN --> DONE
```

---

## Directory Structure Overview

```
ChainLinked/
├── app/
│   ├── api/                    # 30+ API route groups
│   │   ├── ai/                 # AI generation endpoints
│   │   ├── analytics/          # Analytics data endpoints
│   │   ├── auth/               # Authentication callbacks
│   │   ├── brand-kit/          # Brand extraction
│   │   ├── inngest/            # Inngest webhook handler
│   │   ├── linkedin/           # LinkedIn API proxy
│   │   ├── teams/              # Team management
│   │   └── ...
│   ├── dashboard/              # Authenticated app pages
│   │   ├── analytics/
│   │   ├── carousels/
│   │   ├── compose/
│   │   ├── discover/
│   │   ├── drafts/
│   │   ├── inspiration/
│   │   ├── posts/
│   │   ├── prompts/
│   │   ├── schedule/
│   │   ├── settings/
│   │   ├── swipe/
│   │   ├── team/
│   │   └── templates/
│   ├── onboarding/             # Onboarding flow pages
│   ├── login/, signup/         # Auth pages
│   └── invite/                 # Team invitation acceptance
├── components/
│   ├── features/               # Feature-specific components (70+)
│   ├── ui/                     # shadcn/ui primitives
│   └── shared/                 # Reusable components
├── hooks/                      # 50+ custom React hooks
├── lib/
│   ├── ai/                     # OpenRouter client + prompts
│   ├── apify/                  # Apify scraping client
│   ├── auth/                   # Auth utilities
│   ├── firecrawl/              # Brand extraction
│   ├── inngest/                # Background job definitions
│   │   └── functions/          # 14 Inngest functions
│   ├── linkedin/               # LinkedIn API (Official + Voyager)
│   ├── perplexity/             # Perplexity research client
│   ├── research/               # Tavily search client
│   ├── supabase/               # Supabase client setup
│   └── email/                  # Resend email client
├── extension/                  # Chrome extension source
├── types/                      # TypeScript type definitions
├── services/                   # Service layer
└── supabase/
    └── migrations/             # 30+ SQL migrations
```
