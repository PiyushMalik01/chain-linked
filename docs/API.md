# ChainLinked API Reference

Comprehensive reference for all API routes in the ChainLinked platform.

**Base URL:** `/api`
**Auth:** Most endpoints require Supabase session authentication unless noted otherwise.

---

## Table of Contents

- [Authentication](#authentication)
- [User](#user)
- [LinkedIn](#linkedin)
- [AI Generation](#ai-generation)
- [Posts & Drafts](#posts--drafts)
- [Analytics](#analytics)
- [Teams](#teams)
- [Prompts](#prompts)
- [Research](#research)
- [Discover](#discover)
- [Swipe](#swipe)
- [Inspiration](#inspiration)
- [Influencers](#influencers)
- [Templates](#templates)
- [Carousel Templates](#carousel-templates)
- [Brand Kit](#brand-kit)
- [Company Context](#company-context)
- [Settings](#settings)
- [Onboarding](#onboarding)
- [Image & Media](#image--media)
- [Sync](#sync)
- [Inngest](#inngest)

---

## Authentication

### `GET /api/auth/callback`
OAuth/email verification/password recovery callback handler.

- **Auth required:** No (public callback endpoint)
- **Query params:** `code`, `next`
- **Response:** Redirect to dashboard or error page

### `POST /api/auth/signup`
Creates a new user with auto-confirmation via Supabase admin client.

- **Auth required:** No
- **Request body:**
  ```json
  { "email": "string", "password": "string", "name": "string?" }
  ```
- **Response:** `{ user: { id, email } }` or `{ error: string }`

### `POST /api/auth/reset-password`
Generates a password reset link and sends branded email via Resend.

- **Auth required:** No
- **Request body:** `{ "email": "string" }`
- **Response:** `{ success: true }` or `{ error: string }`

### `POST /api/auth/resend-verification`
Resends verification email with custom branded template.

- **Auth required:** No
- **Request body:** `{ "email": "string" }`
- **Response:** `{ success: true }` or `{ error: string }`

### `OPTIONS /api/auth/google-token`
CORS preflight handler for Chrome extension.

- **Auth required:** No
- **Response:** CORS headers

### `POST /api/auth/google-token`
Exchanges a Google access token (from Chrome extension) for a Supabase session.

- **Auth required:** No
- **Request body:** `{ "google_access_token": "string" }`
- **Response:** `{ session: { access_token, refresh_token, ... } }`

---

## User

### `GET /api/user`
Returns current user profile with LinkedIn data.

- **Auth required:** Yes
- **Response:** `{ user: { id, email, profile, linkedin_profile } }`

### `PATCH /api/user`
Updates user profile fields.

- **Auth required:** Yes
- **Request body:** Profile field updates
- **Response:** `{ user: updated_data }`

### `GET /api/user/style`
Fetches writing style profile with refresh status.

- **Auth required:** Yes
- **Response:** `{ style: WritingStyleProfile, needsRefresh: boolean }`

### `POST /api/user/style`
Analyzes recent posts and upserts writing style profile.

- **Auth required:** Yes
- **Response:** `{ style: WritingStyleProfile }`

---

## LinkedIn

### `GET /api/linkedin/connect`
Initiates LinkedIn OAuth flow by redirecting to LinkedIn authorization.

- **Auth required:** Yes
- **Query params:** `redirect` (post-OAuth redirect path)
- **Response:** Redirect to LinkedIn

### `GET /api/linkedin/callback`
Handles LinkedIn OAuth callback, exchanges code for tokens, stores encrypted tokens.

- **Auth required:** Yes (via session)
- **Query params:** `code`, `state`, `error`
- **Response:** Redirect to settings with success/error

### `GET /api/linkedin/status`
Returns LinkedIn connection status including token validity.

- **Auth required:** Yes
- **Response:** `{ connected: boolean, expiresAt: string?, profileName: string?, needsReconnect: boolean }`

### `DELETE /api/linkedin/status`
Disconnects LinkedIn by deleting tokens.

- **Auth required:** Yes
- **Response:** `{ success: true }`

### `POST /api/linkedin/disconnect`
Revokes LinkedIn token and removes from database.

- **Auth required:** Yes
- **Response:** `{ success: true, message: string }`

### `POST /api/linkedin/post`
Creates a LinkedIn text/image post via official API.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "content": "string",
    "visibility": "PUBLIC | CONNECTIONS",
    "mediaUrls": ["string"]?,
    "mediaBase64": [{ "data": "base64", "contentType": "mime" }]?,
    "scheduledPostId": "string?"
  }
  ```
- **Response:** `{ success: true, postId: string, linkedinPostUrn: string }`

### `POST /api/linkedin/post-document`
Uploads a PDF document and creates a LinkedIn carousel/document post.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "content": "string",
    "visibility": "PUBLIC | CONNECTIONS",
    "pdfBase64": "base64-string",
    "documentTitle": "string?"
  }
  ```
- **Response:** `{ success: true, postId: string, linkedinPostUrn: string }`

### `POST /api/linkedin/voyager/post`
Creates a post via LinkedIn Voyager API (fallback).

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "content": "string",
    "visibility": "PUBLIC | CONNECTIONS | LOGGED_IN",
    "mediaUrls": ["string"]?,
    "articleUrl": "string?",
    "originalPostUrn": "string?"
  }
  ```
- **Response:** `{ success: true, post: { id, activityUrn, shareUrn, content, createdAt } }`

### `DELETE /api/linkedin/voyager/post`
Deletes a LinkedIn post via Voyager API.

- **Auth required:** Yes
- **Query params:** `activityUrn`
- **Response:** `{ success: true }`

### `PATCH /api/linkedin/voyager/post`
Edits a LinkedIn post via Voyager API.

- **Auth required:** Yes
- **Request body:** `{ "activityUrn": "string", "content": "string" }`
- **Response:** `{ success: true }`

### `GET /api/linkedin/voyager/metrics`
Retrieves analytics via LinkedIn Voyager API.

- **Auth required:** Yes
- **Query params:** `type` (summary|post|profile|profile-stats|content|recent-posts), `period`, `activityUrn`, `limit`
- **Response:** Varies by type -- analytics data with `{ success: true, ... }`

---

## AI Generation

### `POST /api/ai/generate`
Generates a LinkedIn post with user context and style matching.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "topic": "string",
    "tone": "professional | casual | inspiring | educational | thought-provoking | match-my-style",
    "length": "short | medium | long",
    "context": "string?",
    "apiKey": "string?",
    "postType": "string?"
  }
  ```
- **Response:** `{ content: string, metadata: { model, tokensUsed, tone, length, postType, promptSource } }`

### `POST /api/ai/remix`
Remixes a post with comprehensive user context and style analysis.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "originalContent": "string",
    "tone": "string?",
    "length": "short | medium | long",
    "customInstructions": "string?",
    "apiKey": "string?"
  }
  ```
- **Response:** `{ content: string, originalContent: string, metadata: { model, tokensUsed, tone, length, userContext } }`

### `POST /api/ai/compose-chat`
Streaming chat endpoint for advanced compose mode with tool calls.

- **Auth required:** Yes
- **Request body:** `{ "messages": UIMessage[], "tone": "string?" }`
- **Response:** Streaming UI message response

### `POST /api/ai/compose-series`
Streaming chat endpoint for post series generation with tool calls.

- **Auth required:** Yes
- **Request body:** `{ "messages": UIMessage[], "tone": "string?" }`
- **Response:** Streaming UI message response

### `POST /api/ai/edit-selection`
Edits selected text within a post per user instruction.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "selectedText": "string",
    "instruction": "string",
    "fullPostContent": "string"
  }
  ```
- **Response:** `{ editedText: string }`

### `POST /api/ai/analyze-company`
AI-powered website analysis for company onboarding context.

- **Auth required:** Yes
- **Request body:** `{ "websiteUrl": "string", "companyName": "string", "industry": "string?", "targetAudience": "string?" }`
- **Response:** `{ success: true, analysis: CompanyAnalysisResult, metadata: { model, tokensUsed } }`

### `POST /api/ai/playground`
Executes a prompt playground request with configurable model parameters.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "systemPrompt": "string",
    "userPrompt": "string",
    "model": "string?",
    "temperature": "number?",
    "maxTokens": "number?",
    "topP": "number?",
    "apiKey": "string?",
    "promptId": "string?",
    "promptVersion": "number?"
  }
  ```
- **Response:** `{ content: string, metadata: { model, tokensUsed, promptTokens, completionTokens, estimatedCost, ... } }`

### `POST /api/ai/carousel-caption`
Generates a LinkedIn caption for carousel content.

- **Auth required:** Yes (soft -- still works without user context)
- **Request body:** `{ "carouselContent": "string", "topic": "string?", "tone": "string?" }`
- **Response:** `{ content: string, metadata: { model, tokensUsed } }`

### `POST /api/ai/carousel/generate`
Generates carousel slide content based on template structure.

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "topic": "string",
    "audience": "string?",
    "industry": "string?",
    "keyPoints": ["string"]?,
    "tone": "professional | casual | educational | inspirational | storytelling | match-my-style",
    "ctaType": "string?",
    "templateAnalysis": { "templateId", "totalSlides", "slots": [...], ... }
  }
  ```
- **Response:** `{ success: true, slots: [{ slotId, content }], caption: string?, metadata: { tokensUsed, generationTime, model } }`

### `POST /api/remix`
Legacy remix endpoint (uses OpenRouter GPT-4.1).

- **Auth required:** Yes
- **Request body:** Remix parameters
- **Response:** `{ content: string, metadata: {...} }`

---

## Posts & Drafts

### `GET /api/posts`
Fetches user posts with type filtering.

- **Auth required:** Yes
- **Query params:** `limit`, `offset`, `type` (my_posts|feed_posts|scheduled|team_posts)
- **Response:** `{ posts: Post[], total: number }`

### `POST /api/posts`
Creates a scheduled post.

- **Auth required:** Yes
- **Request body:** `{ "content": "string", "scheduled_for": "ISO date", "timezone": "string?", "media_urls": ["string"]? }`
- **Response:** `{ post: ScheduledPost }`

### `DELETE /api/posts`
Deletes a scheduled post.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

### `POST /api/drafts/auto-save`
Auto-saves a draft (designed for navigator.sendBeacon).

- **Auth required:** Yes
- **Request body:**
  ```json
  {
    "content": "string",
    "postType": "string?",
    "source": "compose | swipe | inspiration | carousel | discover | research",
    "topic": "string?",
    "tone": "string?",
    "context": "string?",
    "wordCount": "number?",
    "draftId": "string?"
  }
  ```
- **Response:** `{ success: true, id: string }`

### `POST /api/drafts/bulk-delete`
Soft-deletes multiple drafts by setting status to archived.

- **Auth required:** Yes
- **Request body:** `{ "items": [{ "id": "string", "table": "generated_posts | scheduled_posts" }] }`
- **Response:** `{ success: true, deleted: number, errors: number }`

---

## Analytics

### `GET /api/analytics`
Returns latest LinkedIn analytics with history for trends.

- **Auth required:** Yes
- **Query params:** `days` (default 30, max 365)
- **Response:** `{ analytics, history }`

### `POST /api/analytics`
Stores analytics data from extension sync.

- **Auth required:** Yes
- **Request body:** Analytics data object
- **Response:** `{ success: true }`

### `GET /api/analytics/v2`
Post-level analytics with metric selection, time periods, content type/source filtering, comparison periods, and granularity.

- **Auth required:** Yes
- **Query params:** `metric`, `period`, `contentType`, `source`, `compare`, `granularity`, `page`, `limit`
- **Response:** Analytics data with comparison metrics

### `GET /api/analytics/v2/profile`
Profile-level analytics from daily and accumulative tables.

- **Auth required:** Yes
- **Query params:** `period`, `metric`, `granularity`
- **Response:** Profile analytics data

---

## Teams

### `GET /api/teams`
Lists teams the user belongs to.

- **Auth required:** Yes
- **Response:** `{ teams: Team[] }`

### `POST /api/teams`
Creates a new team.

- **Auth required:** Yes
- **Request body:** `{ "name": "string", "description": "string?", ... }`
- **Response:** `{ team: Team }`

### `PATCH /api/teams`
Updates team settings.

- **Auth required:** Yes
- **Request body:** Team field updates with team ID
- **Response:** `{ team: Team }`

### `DELETE /api/teams`
Deletes a team (owner only).

- **Auth required:** Yes
- **Request body:** `{ "teamId": "string" }`
- **Response:** `{ success: true }`

### `GET /api/teams/search`
Search discoverable teams by name.

- **Auth required:** Yes
- **Query params:** `q` (search query)
- **Response:** `{ teams: [{ id, name, member_count, company_name, logo_url }] }`

### `GET /api/teams/join-request`
Get current user's pending join request.

- **Auth required:** Yes
- **Response:** `{ joinRequest: JoinRequest? }`

### `POST /api/teams/join-request`
Creates a join request for a team.

- **Auth required:** Yes
- **Request body:** `{ "team_id": "string", "message": "string?" }`
- **Response:** `{ joinRequest: JoinRequest }`

### `DELETE /api/teams/join-request`
Cancels a pending join request.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

### `GET /api/teams/accept-invite`
Validates and displays invitation details.

- **Auth required:** Yes
- **Query params:** `token`
- **Response:** Invitation details or redirect

### `POST /api/teams/accept-invite`
Accepts a team invitation with welcome email.

- **Auth required:** Yes
- **Request body:** `{ "token": "string" }`
- **Response:** `{ success: true }`

### `GET /api/teams/[teamId]/members`
Lists team members.

- **Auth required:** Yes (must be team member)
- **Response:** `{ members: TeamMember[] }`

### `PATCH /api/teams/[teamId]/members`
Updates a member's role.

- **Auth required:** Yes (admin/owner)
- **Request body:** `{ "userId": "string", "role": "string" }`
- **Response:** `{ success: true }`

### `DELETE /api/teams/[teamId]/members`
Removes a member from the team.

- **Auth required:** Yes (admin/owner)
- **Query params:** `userId`
- **Response:** `{ success: true }`

### `GET /api/teams/[teamId]/invite`
Lists pending invitations.

- **Auth required:** Yes (admin/owner)
- **Response:** `{ invitations: Invitation[] }`

### `POST /api/teams/[teamId]/invite`
Sends team invitation email via Resend.

- **Auth required:** Yes (admin/owner)
- **Request body:** `{ "email": "string", "role": "string?" }`
- **Response:** `{ success: true, invitation: Invitation }`

### `PATCH /api/teams/[teamId]/invite`
Resends an invitation email.

- **Auth required:** Yes (admin/owner)
- **Request body:** `{ "invitationId": "string" }`
- **Response:** `{ success: true }`

### `DELETE /api/teams/[teamId]/invite`
Revokes an invitation.

- **Auth required:** Yes (admin/owner)
- **Query params:** `invitationId`
- **Response:** `{ success: true }`

### `GET /api/teams/[teamId]/join-requests`
Lists pending join requests for a team.

- **Auth required:** Yes (admin/owner)
- **Response:** `{ joinRequests: JoinRequest[] }`

### `PATCH /api/teams/[teamId]/join-requests`
Approves or rejects a join request.

- **Auth required:** Yes (admin/owner)
- **Request body:** `{ "requestId": "string", "action": "approve | reject" }`
- **Response:** `{ success: true }`

---

## Prompts

### `GET /api/prompts`
Lists prompts with optional filters.

- **Auth required:** Yes
- **Query params:** `type`, `isActive`
- **Response:** `{ prompts: Prompt[] }`

### `POST /api/prompts`
Creates a new prompt.

- **Auth required:** Yes
- **Request body:** `{ "name": "string", "type": "PromptType", "content": "string", "setActive": "boolean?" }`
- **Response:** `{ prompt: Prompt }`

### `GET /api/prompts/[id]`
Gets a single prompt by ID.

- **Auth required:** Yes
- **Response:** `{ prompt: Prompt }`

### `PUT /api/prompts/[id]`
Updates a prompt (creates new version).

- **Auth required:** Yes
- **Request body:** Prompt field updates
- **Response:** `{ prompt: Prompt }`

### `DELETE /api/prompts/[id]`
Deletes a prompt.

- **Auth required:** Yes
- **Response:** `{ success: true }`

### `POST /api/prompts/[id]/activate`
Activates a prompt (deactivates others of same type).

- **Auth required:** Yes
- **Response:** `{ success: true }`

### `POST /api/prompts/[id]/rollback`
Rollbacks a prompt to a specific version.

- **Auth required:** Yes
- **Request body:** `{ "version": "number" }`
- **Response:** `{ success: true }`

### `GET /api/prompts/[id]/versions`
Gets version history for a prompt.

- **Auth required:** Yes
- **Response:** `{ versions: PromptVersion[] }`

### `GET /api/prompts/analytics`
Gets usage analytics for prompts.

- **Auth required:** Yes
- **Query params:** `promptId`, `feature`, `period`
- **Response:** `{ analytics: PromptAnalytics }`

### `POST /api/prompts/test`
Tests a prompt with detailed response metadata.

- **Auth required:** Yes
- **Request body:** `{ "systemPrompt": "string", "userPrompt": "string", "model": "string?", ... }`
- **Response:** `{ content: string, metadata: { tokensUsed, responseTimeMs, ... } }`

---

## Research

### `POST /api/research`
Performs content research using Tavily API.

- **Auth required:** Yes
- **Request body:** Research query parameters
- **Response:** Research results

### `GET /api/research`
Gets research history.

- **Auth required:** Yes
- **Response:** Research session list

### `POST /api/research/start`
Triggers a deep research workflow via Inngest.

- **Auth required:** Yes
- **Request body:** `{ "topic": "string", "depth": "quick | standard | deep", "postTypes": ["string"], ... }`
- **Response:** `{ sessionId: string, status: "pending" }`

### `GET /api/research/start`
Lists available research configurations.

- **Auth required:** Yes
- **Response:** Configuration options

### `GET /api/research/sessions`
Lists user's research sessions.

- **Auth required:** Yes
- **Query params:** `page`, `limit`
- **Response:** `{ sessions: ResearchSession[] }`

### `GET /api/research/status/[sessionId]`
Gets status of a research session.

- **Auth required:** Yes
- **Response:** `{ session: ResearchSession }`

### `GET /api/research/posts`
Fetches AI-generated posts from research sessions.

- **Auth required:** Yes
- **Query params:** `sessionId`, `status`, `page`, `limit`
- **Response:** `{ posts: GeneratedPost[] }`

### `PATCH /api/research/posts`
Updates a generated post (e.g., status change).

- **Auth required:** Yes
- **Request body:** Post ID and field updates
- **Response:** `{ post: GeneratedPost }`

### `DELETE /api/research/posts`
Deletes a generated post.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

### `GET /api/research/test`
Tests Inngest configuration and returns diagnostics.

- **Auth required:** Yes
- **Response:** Diagnostic information

### `POST /api/research/test`
Sends a test event to Inngest.

- **Auth required:** Yes
- **Response:** `{ success: true }`

---

## Discover

### `GET /api/discover/posts`
Fetches curated/scraped industry posts with filtering and pagination.

- **Auth required:** Yes
- **Query params:** `topic`, `page`, `limit`, `sort` (engagement|recent|viral), `search`, `cluster`, `tags`
- **Response:** `{ posts: DiscoverPost[], pagination: { page, limit, total, hasMore } }`

### `POST /api/discover/import`
Imports scraped LinkedIn posts from Apify or manual sources.

- **Auth required:** Yes
- **Request body:** `{ "posts": [ImportedPost], "source": "apify | manual | import" }`
- **Response:** `{ summary: { total, new, updated, skipped }, errors: string[]? }`

### `GET /api/discover/news`
Fetches Perplexity-sourced news articles.

- **Auth required:** Yes
- **Query params:** `topic`, `page`, `limit`, `sort` (recent|relevance), `search`
- **Response:** `{ articles: NewsArticle[], pagination: { page, limit, total, hasMore } }`

### `POST /api/discover/news/seed`
Triggers the news article ingest pipeline.

- **Auth required:** Yes
- **Request body:** `{ "topics": ["string"], "force": "boolean?" }`
- **Response:** `{ seeded: boolean, reason: "no_api_key | already_exists | no_results | success | triggered", message: string }`

### `GET /api/discover/topics`
Retrieves user's selected discover topics.

- **Auth required:** Yes
- **Response:** `{ topics: string[], selected: boolean }`

### `POST /api/discover/topics`
Saves user's selected discover topics.

- **Auth required:** Yes
- **Request body:** `{ "topics": ["string"] }`
- **Response:** `{ success: true, topics: string[] }`

---

## Swipe

### `GET /api/swipe/suggestions`
Fetches AI-generated suggestions for the swipe feature.

- **Auth required:** Yes
- **Query params:** `status`, `limit`
- **Response:** `{ suggestions: Suggestion[] }`

### `PATCH /api/swipe/suggestions`
Updates suggestion status (like/dislike/save).

- **Auth required:** Yes
- **Request body:** Suggestion ID and status update
- **Response:** `{ success: true }`

### `POST /api/swipe/generate`
Triggers AI suggestion generation via Inngest.

- **Auth required:** Yes
- **Response:** `{ success: true, runId: string }`

### `DELETE /api/swipe/generate`
Clears suggestion generation state.

- **Auth required:** Yes
- **Response:** `{ success: true }`

### `GET /api/swipe/generation-status`
Polls for suggestion generation run status.

- **Auth required:** Yes
- **Query params:** `runId`
- **Response:** `{ status: string, count: number? }`

---

## Inspiration

### `GET /api/inspiration/search`
AI-powered semantic search across discover_posts and influencer_posts.

- **Auth required:** Yes
- **Query params:** `q` (search query), `page`, `limit`
- **Response:** `{ results: SearchResult[], metadata: { query, clusters, totalCount } }`

---

## Influencers

### `GET /api/influencers`
Returns user's followed influencers list.

- **Auth required:** Yes
- **Response:** `{ influencers: Influencer[] }`

### `POST /api/influencers`
Follows a new influencer.

- **Auth required:** Yes
- **Request body:** `{ "linkedin_url": "string", "author_name": "string?", "author_headline": "string?", "author_profile_picture": "string?" }`
- **Response:** `{ influencer: Influencer }`

### `DELETE /api/influencers`
Unfollows an influencer.

- **Auth required:** Yes
- **Request body:** `{ "id": "string" }`
- **Response:** `{ success: true }`

### `PATCH /api/influencers`
Triggers a rescrape for an influencer.

- **Auth required:** Yes
- **Request body:** `{ "influencer_id": "string" }`
- **Response:** `{ success: true }`

### `GET /api/influencers/posts`
Returns approved posts from followed influencers.

- **Auth required:** Yes
- **Query params:** `page`, `limit`
- **Response:** `{ posts: InfluencerPost[], totalCount: number }`

---

## Templates

### `GET /api/templates`
Fetches user's post templates and public templates.

- **Auth required:** Yes
- **Query params:** `type`
- **Response:** `{ templates: Template[] }`

### `POST /api/templates`
Creates a new post template.

- **Auth required:** Yes
- **Request body:** Template data
- **Response:** `{ template: Template }`

### `PATCH /api/templates`
Updates a template.

- **Auth required:** Yes
- **Request body:** Template ID and field updates
- **Response:** `{ template: Template }`

### `DELETE /api/templates`
Deletes a template.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

---

## Carousel Templates

### `GET /api/carousel-templates`
Fetches user's saved carousel templates.

- **Auth required:** Yes
- **Response:** `{ templates: CarouselTemplate[] }`

### `POST /api/carousel-templates`
Creates a new carousel template.

- **Auth required:** Yes
- **Request body:** `{ "name": "string", "slides": CanvasSlide[], "category": "string?", "brandColors": ["string"]?, ... }`
- **Response:** `{ template: CarouselTemplate }` (201)

### `PUT /api/carousel-templates`
Updates an existing carousel template.

- **Auth required:** Yes
- **Request body:** `{ "id": "string", ...fields }`
- **Response:** `{ template: CarouselTemplate }`

### `DELETE /api/carousel-templates`
Deletes a carousel template.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

### `GET /api/carousel-templates/favorites`
Fetches user's favorite template IDs.

- **Auth required:** Yes
- **Response:** `{ favoriteIds: string[] }`

### `POST /api/carousel-templates/favorites`
Adds a template to favorites.

- **Auth required:** Yes
- **Request body:** `{ "templateId": "string" }`
- **Response:** `{ templateId: string }` (201)

### `DELETE /api/carousel-templates/favorites`
Removes a template from favorites.

- **Auth required:** Yes
- **Query params:** `templateId`
- **Response:** `{ success: true }`

### `GET /api/carousel-templates/categories`
Fetches user's template categories.

- **Auth required:** Yes
- **Response:** `{ categories: [{ id, name, created_at }] }`

### `POST /api/carousel-templates/categories`
Creates a template category.

- **Auth required:** Yes
- **Request body:** `{ "name": "string" }`
- **Response:** `{ category: { id, name, created_at } }` (201)

### `DELETE /api/carousel-templates/categories`
Deletes a template category.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

---

## Brand Kit

### `GET /api/brand-kit`
Fetches user's brand kit.

- **Auth required:** Yes
- **Response:** `{ brandKit: BrandKit? }`

### `POST /api/brand-kit`
Creates a new brand kit.

- **Auth required:** Yes
- **Request body:** Brand kit data (colors, fonts, logos, etc.)
- **Response:** `{ brandKit: BrandKit }`

### `PUT /api/brand-kit`
Updates the brand kit.

- **Auth required:** Yes
- **Request body:** Brand kit field updates
- **Response:** `{ brandKit: BrandKit }`

### `DELETE /api/brand-kit`
Deletes the brand kit.

- **Auth required:** Yes
- **Query params:** `id`
- **Response:** `{ success: true }`

### `POST /api/brand-kit/extract`
Extracts brand elements from a website URL using Firecrawl and Brandfetch.

- **Auth required:** Yes
- **Request body:** `{ "url": "string" }`
- **Response:** `{ success: true, data: ExtractedBrandData }`

---

## Company Context

### `GET /api/company-context`
Returns company context for the authenticated user.

- **Auth required:** Yes
- **Response:** CompanyContext object or null

### `PUT /api/company-context`
Updates company context.

- **Auth required:** Yes
- **Request body:** `{ "companyName": "string", "websiteUrl": "string?", "industry": "string?", ... }`
- **Response:** Updated CompanyContext

### `GET /api/company-context/status`
Polls the status of company analysis workflow.

- **Auth required:** Yes
- **Response:** `{ status: string, progress: number, currentStep: string, errorMessage: string? }`

### `POST /api/company-context/trigger`
Creates/resets a company context record and triggers the Inngest analysis workflow.

- **Auth required:** Yes
- **Request body:** `{ "companyName": "string", "websiteUrl": "string?", "industry": "string?", "targetAudienceInput": "string?" }`
- **Response:** `{ success: true, companyContextId: string, status: "pending" }`

### `POST /api/company/analyze`
Direct AI-powered company website analysis (no Inngest).

- **Auth required:** Yes
- **Request body:** `{ "websiteUrl": "string", "companyName": "string?" }`
- **Response:** `{ success: true, data: CompanyContextResult, metadata: { model, tokensUsed } }`

---

## Settings

### `GET /api/settings/api-keys`
Checks if user has API key configured.

- **Auth required:** Yes
- **Response:** `{ hasKey: boolean, provider: string?, keyHint: string?, isValid: boolean? }`

### `POST /api/settings/api-keys`
Saves an encrypted API key.

- **Auth required:** Yes
- **Request body:** `{ "provider": "openai", "apiKey": "string" }`
- **Response:** `{ success: true, keyHint: string }`

### `DELETE /api/settings/api-keys`
Removes the user's API key.

- **Auth required:** Yes
- **Response:** `{ success: true }`

### `PATCH /api/settings/api-keys`
Re-validates existing API key.

- **Auth required:** Yes
- **Response:** `{ isValid: boolean }`

---

## Onboarding

### `POST /api/onboarding/complete`
Marks onboarding as complete.

- **Auth required:** Yes
- **Response:** `{ success: true, onboarding_completed: true, onboarding_current_step: 4 }`

---

## Image & Media

### `GET /api/graphics-library`
Proxies search requests to Unsplash API.

- **Auth required:** No
- **Query params:** `q` (search query), `page`, `per_page`
- **Response:** Unsplash search results `{ results: Photo[], total: number, total_pages: number }`

### `GET /api/proxy-image`
Proxies external images to bypass CORS for canvas rendering.

- **Auth required:** Yes
- **Query params:** `url` (image URL)
- **Response:** Proxied image binary with CORS headers

### `POST /api/image/remove-background`
Removes image background via remove.bg API.

- **Auth required:** Yes
- **Request body:** FormData (file upload) or JSON with base64 string
- **Response:** PNG image blob with transparent background

### `GET /api/mentions/search`
Searches local connections for @mention autocomplete (extension fallback).

- **Auth required:** Yes
- **Query params:** `q` (search query), `limit`
- **Response:** `{ results: Connection[] }`

---

## Sync

### `POST /api/sync`
Handles data sync from Chrome extension (profile, analytics, posts, etc.).

- **Auth required:** Yes
- **Request body:** Sync payload with type discriminator
- **Response:** `{ success: true, synced: { ... } }`

### `GET /api/sync`
Returns sync status and metadata.

- **Auth required:** Yes
- **Response:** `{ lastSync: string?, ... }`

---

## Inngest

### `GET /api/inngest`
### `POST /api/inngest`
### `PUT /api/inngest`
Inngest webhook handlers for background job processing.

- **Auth required:** No (Inngest signature verification)
- **Description:** Exposes all workflow functions to the Inngest runtime including: company analysis, deep research, suggestion generation, content ingest, analytics pipelines, influencer scraping, and scheduled post publishing.

---

*Generated from 80 API route files across the ChainLinked codebase.*
