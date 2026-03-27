# ChainLinked -- Comprehensive Feature Documentation

Complete feature documentation for the ChainLinked LinkedIn content management platform. This guide is intended for both clients evaluating the platform and developers building or extending it.

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Post Composer](#2-post-composer)
3. [Analytics Dashboard](#3-analytics-dashboard)
4. [Team Management](#4-team-management)
5. [Template Library](#5-template-library)
6. [Carousel Creator](#6-carousel-creator)
7. [Discover and Inspiration](#7-discover-and-inspiration)
8. [Swipe Interface](#8-swipe-interface)
9. [Scheduling](#9-scheduling)
10. [Drafts](#10-drafts)
11. [My Posts](#11-my-posts)
12. [AI Features](#12-ai-features)
13. [Brand Kit](#13-brand-kit)
14. [Settings](#14-settings)
15. [Onboarding](#15-onboarding)
16. [Chrome Extension](#16-chrome-extension)
17. [Prompt Playground](#17-prompt-playground)

---

## 1. Dashboard

### Description

The Dashboard is the main landing page after login. It provides a high-level overview of the user's LinkedIn activity, upcoming scheduled content, recent posts, and a getting-started checklist for new users. The layout is designed for quick orientation and fast navigation into deeper features.

### Key Capabilities

- **Getting Started Checklist** -- A progress-tracked onboarding widget shown to new users. Steps include connecting LinkedIn, installing the Chrome extension, creating a first post, and scheduling content. Users can dismiss it once all steps are complete or at any time.
- **Quick Stat Metric Cards** -- Four animated cards displaying key LinkedIn metrics (impressions, followers, reactions, engagement rate) with percentage change compared to the previous period. Each card is color-coded by accent theme and uses animated number transitions.
- **Schedule Calendar** -- A full-size interactive calendar displaying all scheduled posts as color-coded indicators. Clicking a date with no posts navigates to the compose page pre-filled with that date. Clicking a date with one post opens it for editing. Clicking a date with multiple posts opens a picker dialog.
- **Upcoming Scheduled Posts** -- A panel showing the next batch of scheduled posts with content previews, scheduled times, and quick edit/delete actions.
- **My Recent Posts** -- A section listing the user's most recently published LinkedIn posts with engagement metrics (impressions, reactions, comments, reposts).
- **Extension Install Prompt** -- A contextual banner prompting users to install the ChainLinked Chrome extension if it is not detected.

### User Workflow

1. User logs in and lands on the Dashboard.
2. New users see the Getting Started checklist and follow the steps.
3. Metric cards provide an at-a-glance view of recent LinkedIn performance.
4. The calendar shows upcoming content at a glance; clicking a date opens compose or edit flows.
5. Recent posts allow quick review of published content and its performance.

### Pages and Components

- `app/dashboard/page.tsx` -- Main dashboard page
- `components/features/schedule-calendar.tsx` -- Calendar component
- `components/features/my-recent-posts.tsx` -- Recent posts section
- `components/features/extension-install-prompt.tsx` -- Extension prompt banner
- `components/skeletons/page-skeletons.tsx` -- Loading skeleton (DashboardSkeleton)

---

## 2. Post Composer

### Description

The Post Composer is the primary content creation interface. It supports writing, formatting, previewing, and publishing or scheduling LinkedIn posts. The composer operates in two major modes: Single Post and Post Series.

### Key Capabilities

- **Two Compose Tabs** -- "Single Post" for individual posts and "Post Series" for creating a sequence of related posts.
- **Rich Text Editor** -- A full-featured text editor with formatting toolbar supporting bold, italic, lists, and Unicode font styles. Character count uses Unicode code-point counting for accuracy with emoji and special characters.
- **AI Chat-Based Generation** -- An inline AI panel (chat interface) that generates post content based on user-provided topics, tone, context, and post type. The conversation is persisted across sessions.
- **Tone Selector** -- Choose the tone of AI-generated content (professional, casual, inspirational, humorous, etc.).
- **Post Types** -- Select the type of post (thought leadership, how-to, story, list, question, etc.) to guide AI generation.
- **Character Limit Indicator** -- Real-time character count with visual indicator against LinkedIn's 3,000-character limit. Uses code-point-based counting to handle emoji correctly.
- **Emoji Picker** -- Integrated emoji selection interface for inserting emoji into post content.
- **@Mention Tagging** -- Mention other LinkedIn users in posts with an autocomplete popover. Mentions are tokenized for LinkedIn API compatibility.
- **Default Hashtags** -- Automatically append saved default hashtags to posts. Hashtags are persisted per user in Supabase.
- **Media Upload** -- Upload images to include with posts. Supports multiple image files converted to base64 for the LinkedIn API.
- **LinkedIn Preview** -- Live preview showing how the post will appear on LinkedIn, including the user's profile photo, name, headline, and post content.
- **Post Goal Selector** -- Tag posts with a content goal category (awareness, engagement, conversion, etc.) for tracking purposes.
- **Font Picker** -- Apply Unicode font styles (serif, sans-serif, monospace, script, etc.) to selected text for visual variety within LinkedIn's plain-text format.
- **Scheduling** -- Schedule a post for a future date and time with timezone support. The schedule modal allows picking date, time, and timezone, with proper UTC conversion.
- **Post to LinkedIn** -- Directly publish content to LinkedIn via the API with image support.
- **Edit Scheduled Posts** -- Open an existing scheduled post for editing, with the ability to reschedule or save changes without re-picking the time.
- **Auto-Save Drafts** -- Content is automatically saved as a draft every 30 seconds, on page navigation, and on browser close (via `navigator.sendBeacon`). Draft status is shown with a saving/saved indicator.
- **Remix from My Posts** -- A collapsible section showing the user's 10 most recent posts with a "Remix" button that feeds the content into AI for generating a fresh version.
- **Compose Mode** -- The composer supports both basic and advanced modes, toggling the visibility of AI features and additional controls.

### User Workflow

1. Navigate to Compose from the sidebar or dashboard.
2. Choose "Single Post" or "Post Series" tab.
3. Type content directly or use the AI panel to generate content by providing a topic, tone, and post type.
4. Use the formatting toolbar to add bold, italic, or other styles.
5. Insert emoji, @mentions, or hashtags as needed.
6. Preview the post in the LinkedIn preview panel.
7. Choose to "Post" (publish immediately), "Schedule" (pick a future date/time), or let the auto-save handle draft persistence.
8. Optionally remix an existing post from the collapsible section.

### Pages and Components

- `app/dashboard/compose/page.tsx` -- Compose page with tab switching, auto-save logic, edit mode, and remix section
- `components/features/post-composer.tsx` -- Core PostComposer component with editor, formatting, preview, and actions
- `components/features/compose/post-series-composer.tsx` -- Post series mode
- `components/features/ai-inline-panel.tsx` -- AI chat panel for content generation
- `components/features/ai-generation-dialog.tsx` -- AI generation dialog
- `components/features/emoji-picker.tsx` -- Emoji picker
- `components/features/media-upload.tsx` -- Media upload handler
- `components/features/schedule-modal.tsx` -- Schedule date/time picker
- `components/features/remix-post-button.tsx` -- Remix button component
- `components/features/font-picker.tsx` -- Unicode font style picker
- `components/features/mention-popover.tsx` -- @mention autocomplete
- `components/features/default-hashtags-editor.tsx` -- Default hashtags management
- `components/features/post-goal-selector.tsx` -- Post goal tagging
- `components/features/post-actions-menu.tsx` -- Actions dropdown
- `components/features/carousel-document-preview.tsx` -- Document/carousel preview in composer
- `hooks/use-compose-mode.ts` -- Basic/Advanced mode toggle
- `hooks/use-auto-save.ts` -- Auto-save logic
- `hooks/use-conversation-persistence.ts` -- AI conversation persistence
- `hooks/use-text-selection-popup.ts` -- Text selection popup for formatting
- `lib/store/draft-context.tsx` -- Draft state management context
- `lib/unicode-fonts.ts` -- Unicode font transformation utilities
- `lib/linkedin/mentions.ts` -- Mention token building and character counting

---

## 3. Analytics Dashboard

### Description

The Analytics Dashboard provides detailed LinkedIn performance tracking with interactive charts, metric cards, and data tables. Users can filter by time period, metric type, content type, and granularity, with optional comparison overlays to visualize trends.

### Key Capabilities

- **Filter Bar** -- Select the primary metric (impressions, reactions, comments, reposts, engagement rate), time period (7d, 14d, 30d, 90d, custom date range), content type filter, granularity (daily, weekly, monthly), and comparison toggle.
- **Summary Bar** -- Displays aggregated summary metrics for the selected period with trend indicators showing percentage change.
- **Trend Chart** -- Interactive Recharts-powered line/area chart showing the selected metric over time. When comparison mode is enabled, an overlay of the previous period is shown for visual benchmarking. Multi-metric overlays are supported.
- **Analytics Charts Section** -- Additional chart grids showing breakdowns such as engagement by content type, posting frequency, and audience demographics.
- **Data Table** -- Tabular view of the analytics data with sortable columns, granularity switching (daily/weekly/monthly), and the ability to drill into specific data points.
- **URL-Based Filter Hydration** -- Filter state can be hydrated from URL search params, making it possible to share or bookmark specific analytics views.

### User Workflow

1. Navigate to Analytics from the sidebar.
2. Use the filter bar to select the desired metric, time period, and granularity.
3. Review summary metrics at a glance in the summary bar.
4. Examine trends in the interactive chart; toggle comparison mode to see period-over-period changes.
5. Scroll to the data table for detailed row-by-row data.
6. Adjust granularity in the data table for different levels of aggregation.

### Data Pipeline

- Data comes from `daily_account_snapshots` and `daily_post_snapshots` tables (v3 snapshot pipeline)
- Shows data only from user's first capture date onward (not historical post publication dates)
- Day-over-day deltas computed from consecutive daily snapshots
- Falls back to absolute values when only 1 day of data is available
- Engagement breakdown uses capture-date weekly grouping (not `posted_at`)
- All numbers shown in full with locale formatting (e.g., 9,554 instead of 1.5K)

### Pages and Components

- `app/dashboard/analytics/page.tsx` -- Analytics page with filters, summary, chart, and table
- `components/features/analytics-filter-bar.tsx` -- Filter bar
- `components/features/analytics-summary-bar.tsx` -- Summary metrics bar
- `components/features/analytics-trend-chart.tsx` -- Trend chart with comparison overlay
- `components/features/analytics-data-table.tsx` -- Data table with granularity switching
- `components/features/analytics-charts.tsx` -- Additional analytics chart grid
- `hooks/use-analytics-v3.ts` -- V3 snapshot-based analytics data fetching hook (primary)
- `hooks/use-analytics-v2.ts` -- V2 analytics data fetching hook (legacy)
- `hooks/use-analytics.ts` -- Dashboard-level analytics hook (reads from `daily_account_snapshots`)

---

## 4. Team Management

### Description

Team Management enables organizations to collaborate on LinkedIn content. Team members can view each other's posts, track performance on a leaderboard, manage membership and roles, and coordinate content strategy.

### Key Capabilities

- **Team Creation** -- Create a new team from the team page. If the user selected "owner" during onboarding, the team is auto-created.
- **Member Invitations** -- Invite team members by email. Invitations are tracked with status (pending, accepted, expired) and can be resent or cancelled by admins/owners.
- **Join Requests** -- Users can search for and request to join existing teams. Admins and owners can approve or reject join requests.
- **Team Search** -- When joining as a member, users can search for teams by name.
- **Animated Tab Bar** -- The team page features Overview and Members tabs with a Framer Motion-powered sliding capsule indicator.
- **Team Leaderboard** -- Ranked list of team members by LinkedIn engagement metrics (impressions, reactions, comments). Supports time range filtering (7d, 14d, 30d). Highlights the current user's position.
- **Recent Team Activity Feed** -- A responsive 3-column grid of team member posts with author info, content preview, engagement metrics, and post date. Cards feature stagger animations on load and hover effects.
- **Post Detail Popup** -- Click any post card to open a full-detail modal showing complete post content, media, engagement metrics, and action buttons (React, Comment, Repost, Remix).
- **Member Filtering** -- Filter the activity feed by specific team members via a dropdown.
- **Remix Team Posts** -- Each post card includes a Remix button that loads the content into the AI remix workflow.
- **Member List** -- View all team members with their roles, avatars, and join dates. Admins can change roles or remove members.
- **Pending Invitations Card** -- Displays all outstanding invitations with resend and cancel actions.
- **Team Header** -- Shows team name, member count, brand kit logo (if set), and settings/invite actions.
- **Role Management** -- Supports three roles: owner, admin, and member. Owners and admins can manage members and invitations.
- **No-Team State** -- When the user has no team, a prompt to create or join a team is shown with contextual guidance based on onboarding type.

### User Workflow

1. Navigate to Team from the sidebar.
2. If no team exists, create one or search and join an existing team.
3. The Overview tab shows the leaderboard and recent team posts.
4. Filter posts by member or view all.
5. Click a post card to see full details and remix content.
6. Switch to the Members tab to manage team membership, approve join requests, or view pending invitations.
7. Use the invite feature to bring in new team members by email.

### Pages and Components

- `app/dashboard/team/page.tsx` -- Team page with tabs, leaderboard, post grid, member management
- `components/features/team-leaderboard.tsx` -- Ranked member leaderboard
- `components/features/team-header.tsx` -- Team header with actions
- `components/features/team-activity-feed.tsx` -- Activity feed types
- `components/features/team-member-list.tsx` -- Member list with role management
- `components/features/pending-invitations-card.tsx` -- Pending invitations display
- `components/features/no-team-state.tsx` -- No-team empty state
- `components/features/remix-post-button.tsx` -- Remix button on post cards
- `hooks/use-team.ts` -- Team data and operations hook
- `hooks/use-team-posts.ts` -- Team posts fetching
- `hooks/use-team-leaderboard.ts` -- Leaderboard data
- `hooks/use-team-invitations.ts` -- Invitation management
- `hooks/use-join-requests.ts` -- Join request management

---

## 5. Template Library

### Description

The Template Library is a collection of reusable LinkedIn post templates. Users can create, edit, delete, and use templates to speed up content creation. Templates can be filtered by category and searched.

### Key Capabilities

- **Create Templates** -- Build new templates with a title, content body, and category tag.
- **Edit Templates** -- Modify existing templates in-place.
- **Delete Templates** -- Remove templates that are no longer needed.
- **Category Filtering** -- Filter templates by category to find relevant formats quickly.
- **Search** -- Full-text search across template titles and content.
- **Use Template** -- Select a template to load it into the composer. Usage count is tracked for analytics.
- **AI Auto-Generated Templates** -- Templates can be generated by AI based on user context and company information.
- **Template Preview** -- Preview the template content before using it.
- **Error and Loading States** -- Proper skeleton loading, error display with retry, and empty states.

### User Workflow

1. Navigate to Templates from the sidebar.
2. Browse or search for templates by keyword or category.
3. Click "Use" on a template to load it into the Post Composer.
4. Create new templates from scratch or let AI generate them.
5. Edit or delete templates as needed.

### Pages and Components

- `app/dashboard/templates/page.tsx` -- Templates page
- `components/features/template-library.tsx` -- Template browsing, search, create, edit, delete
- `hooks/use-templates.ts` -- Template CRUD operations hook
- `components/skeletons/page-skeletons.tsx` -- TemplatesSkeleton

---

## 6. Carousel Creator

### Description

The Carousel Creator is a full-featured canvas-based editor for designing multi-slide LinkedIn carousel posts. It follows a Canva/Figma-inspired interface with drag-and-drop elements, AI-powered content generation, template support, and PDF export for posting as a LinkedIn document.

### Key Capabilities

- **Canvas-Based Editor** -- A full-height, Konva.js-powered interactive canvas for designing slides visually. Supports selection, drag, resize, and layering of elements.
- **Slide Management** -- Add, duplicate, reorder, and delete slides. The left panel includes a slide navigator with thumbnails.
- **Text Elements** -- Add text blocks with configurable font family, size, weight, color, alignment, and line height. Inline editing is supported.
- **Image Elements** -- Upload and place images on slides with drag, resize, and crop capabilities.
- **Shape Elements** -- Add geometric shapes (rectangles, circles, lines, etc.) with customizable fill, stroke, and opacity.
- **AI Content Generation** -- Generate carousel content using AI. The workflow consists of multiple steps: topic input, tone and CTA selection, template selection, content preview, and final generation. An enhanced AI generator provides more sophisticated multi-slide content.
- **Template System** -- Browse and apply pre-built carousel templates. Templates define default slide layouts, colors, and element positions. Users can save their own creations as templates. Template categories help organize the library.
- **Brand Kit Integration** -- Pull colors, fonts, and logos from the user's brand kit to maintain visual consistency.
- **Property Panel** -- A right-side panel for editing properties of the selected element (position, size, color, font, etc.).
- **Floating Toolbar** -- Contextual toolbar that appears when an element is selected, providing quick access to common actions (duplicate, delete, layer order, alignment).
- **Export to PDF** -- Export the entire carousel as a multi-page PDF for uploading to LinkedIn as a document post. Export options include format, quality, and filename configuration.
- **Export Slides as Images** -- Export individual slides as PNG/JPG images.
- **Post to LinkedIn** -- Directly post the carousel to LinkedIn from within the editor via a publishing dialog.
- **Save Template Dialog** -- Save the current carousel design as a reusable template with name and category.
- **Graphics Library** -- A panel with pre-built graphic shapes that can be dragged onto slides.
- **Uploads Panel** -- Manage and insert previously uploaded images.
- **Icon Rail** -- Quick-access icon strip for switching between left panel sections (templates, elements, AI, uploads, graphics, slides).
- **Top Actions Bar** -- Undo, redo, zoom controls, export, save, and post actions.

### User Workflow

1. Navigate to Carousels from the sidebar.
2. Start with a blank carousel or select a template.
3. Add and arrange text, images, and shapes on each slide.
4. Use the AI generator to create slide content based on a topic and tone.
5. Customize colors and fonts using the property panel, optionally pulling from the brand kit.
6. Preview the carousel by navigating through slides.
7. Export as PDF for LinkedIn document posts, or post directly to LinkedIn.

### Pages and Components

- `app/dashboard/carousels/page.tsx` -- Carousels page wrapper
- `components/features/canvas-editor/canvas-editor.tsx` -- Main orchestrating editor component
- `components/features/canvas-editor/canvas-stage.tsx` -- Konva canvas stage
- `components/features/canvas-editor/canvas-text-element.tsx` -- Text element renderer
- `components/features/canvas-editor/canvas-image-element.tsx` -- Image element renderer
- `components/features/canvas-editor/canvas-shape-element.tsx` -- Shape element renderer
- `components/features/canvas-editor/editor-left-panel.tsx` -- Left sidebar with tabs
- `components/features/canvas-editor/editor-floating-toolbar.tsx` -- Floating context toolbar
- `components/features/canvas-editor/editor-top-actions.tsx` -- Top action bar
- `components/features/canvas-editor/editor-icon-rail.tsx` -- Icon strip for panel switching
- `components/features/canvas-editor/property-panel.tsx` -- Element property editor
- `components/features/canvas-editor/panel-slides.tsx` -- Slide navigator panel
- `components/features/canvas-editor/panel-templates.tsx` -- Template browser panel
- `components/features/canvas-editor/panel-ai-generate.tsx` -- AI generation panel
- `components/features/canvas-editor/panel-graphics.tsx` -- Graphics library panel
- `components/features/canvas-editor/panel-uploads.tsx` -- Uploads panel
- `components/features/canvas-editor/ai-content-generator.tsx` -- AI content generator workflow
- `components/features/canvas-editor/ai-carousel-generator.tsx` -- Basic AI carousel generator
- `components/features/canvas-editor/enhanced-ai-carousel-generator.tsx` -- Enhanced AI generator
- `components/features/canvas-editor/topic-input-step.tsx` -- Topic input step for AI workflow
- `components/features/canvas-editor/tone-cta-step.tsx` -- Tone and CTA selection step
- `components/features/canvas-editor/template-selection-step.tsx` -- Template selection step
- `components/features/canvas-editor/preview-step.tsx` -- AI content preview step
- `components/features/canvas-editor/template-selector-modal.tsx` -- Full template selector modal
- `components/features/canvas-editor/export-dialog.tsx` -- PDF/image export dialog
- `components/features/canvas-editor/post-to-linkedin-dialog.tsx` -- LinkedIn posting dialog
- `components/features/canvas-editor/save-template-dialog.tsx` -- Save as template dialog
- `components/features/canvas-editor/enhanced-color-picker.tsx` -- Color picker with brand kit colors
- `hooks/use-canvas-editor.ts` -- Canvas state management hook
- `hooks/use-carousel-templates.ts` -- Template fetching hook
- `hooks/use-template-categories.ts` -- Template category management
- `lib/canvas-pdf-export.ts` -- PDF export utilities
- `types/canvas-editor.ts` -- TypeScript types for canvas elements, slides, templates
- `types/graphics-library.ts` -- Graphics shape types

---

## 7. Discover and Inspiration

### Description

Discover and Inspiration is a unified content discovery hub that combines three tabs into a single interface: Viral Posts (Inspiration), Discover Topics (News), and Swipe (AI Suggestions). It helps users find trending content, follow influencers, and remix high-performing posts into their own LinkedIn content.

### Key Capabilities

#### Inspiration Tab (Viral Posts)
- **Curated Viral Posts Feed** -- Browse high-performing LinkedIn posts from across the platform with engagement metrics.
- **Influencer Following** -- Follow specific LinkedIn influencers to see their content in your feed.
- **Followed Influencers Panel** -- View and manage followed influencers.
- **Post Detail Dialog** -- Click a post to see full content, author info, metrics, and media.
- **Bookmark Posts** -- Save inspiring posts for later reference.
- **Remix Posts** -- Remix any viral post through the AI remix workflow, which adjusts tone, length, and adds custom instructions.

#### Discover Tab (News)
- **Perplexity-Powered News Feed** -- Industry news articles fetched and organized by topic using Perplexity AI.
- **Topic Selection** -- First-time users are shown a topic selection overlay to personalize their feed. Topics can be managed via a modal.
- **Topic Pills** -- Horizontal scrollable pill-based filters to switch between selected topics.
- **Two-Column Layout** -- Main feed with featured "Top Stories" (3-card grid) and compact "Latest" article list, plus a trending sidebar.
- **Article Detail Dialog** -- Click any article to read the full summary, view source info, and access remix/read-original actions.
- **Trending Sidebar** -- Shows trending articles and topic navigation on large screens.
- **Search** -- Debounced search across article headlines and summaries.
- **Infinite Scroll** -- Automatically loads more articles as the user scrolls down.
- **Deep Research Mode** -- Toggle a research section that provides in-depth analysis powered by AI.
- **Seeding Banner** -- Shows a progress indicator when the Inngest ingest workflow is populating the feed with fresh articles.
- **Manage Topics Modal** -- Add, remove, or reorder topics to customize the news feed.
- **Remix Articles** -- Remix any news article into a LinkedIn post with tone, length, and custom instruction controls.

#### Swipe Tab
- See [Swipe Interface](#8-swipe-interface) below (also accessible as a standalone page).

### User Workflow

1. Navigate to Inspiration from the sidebar.
2. The capsule tab bar lets you switch between Viral Posts, Discover Topics, and Swipe.
3. On the Viral Posts tab, browse high-performing posts, follow influencers, and bookmark or remix content.
4. On the Discover tab, select topics of interest, browse news articles, search for specific topics, and remix articles into posts.
5. On the Swipe tab, review AI-generated suggestions by swiping.

### Pages and Components

- `app/dashboard/inspiration/page.tsx` -- Unified inspiration page with three tabs
- `app/dashboard/discover/page.tsx` -- Standalone Discover page (also embedded in inspiration)
- `components/features/inspiration-feed.tsx` -- Viral posts feed
- `components/features/followed-influencers-panel.tsx` -- Influencer management panel
- `components/features/discover-news-card.tsx` -- News article card (featured and compact variants)
- `components/features/discover-trending-sidebar.tsx` -- Trending articles sidebar
- `components/features/article-detail-dialog.tsx` -- Full article detail modal
- `components/features/topic-selection-overlay.tsx` -- First-time topic selection
- `components/features/manage-topics-modal.tsx` -- Topic management modal
- `components/features/remix-dialog.tsx` -- AI remix dialog with tone/length/instructions
- `components/features/research-section.tsx` -- Deep research mode section
- `hooks/use-discover-news.ts` -- News fetching, topic management, infinite scroll
- `hooks/use-inspiration.ts` -- Inspiration/viral posts hook
- `hooks/use-followed-influencers.ts` -- Influencer following hook
- `hooks/use-api-keys.ts` -- API key status for remix availability

---

## 8. Swipe Interface

### Description

The Swipe Interface presents AI-generated post suggestions in a Tinder-style card stack. Users swipe right to save a suggestion as a draft, swipe left to skip it, or use action buttons for more nuanced interactions like editing, remixing, or generating fresh ideas.

### Key Capabilities

- **Card Stack** -- Visually stacked cards with the current suggestion on top. Background cards are slightly offset and scaled for depth effect.
- **Swipe Gestures** -- Drag/touch-based swiping with a configurable threshold (100px). Supports both mouse and touch events.
- **Keyboard Navigation** -- Arrow keys (left/right) trigger swipe actions for accessibility.
- **Swipe Right (Like)** -- Saves the suggestion as a draft via the auto-save API. Shows a success toast.
- **Swipe Left (Skip)** -- Dismisses the suggestion and marks it as not interesting.
- **Edit and Post** -- Load the current suggestion directly into the Post Composer for editing and publishing.
- **Remix with AI** -- Opens the remix dialog to adjust tone, length, and add custom instructions before loading into the composer.
- **Category Filtering** -- Filter suggestions by category (e.g., thought-leadership, how-to, storytelling). Auto-resets to "all" when a filtered category runs out of cards.
- **AI Generation** -- Generate new personalized suggestions on demand. Shows generation progress with a progress bar. Maximum of 10 active suggestions at a time.
- **Session Stats Card** -- Tracks session statistics including likes, skips, total reviewed, like rate, and capture rate (percentage of liked posts). Displays contextual tips based on session behavior.
- **Exit Animations** -- Cards animate off-screen in the swipe direction with rotation and fade effects.
- **Estimated Engagement** -- Each suggestion card displays an AI-estimated engagement score.
- **Post Type Badge** -- Cards show the type of post (thought-leadership, story, etc.).
- **Personalization** -- Suggestions are tailored based on the user's company context, audience, and content preferences.
- **Empty State** -- When no suggestions remain, users can generate more or refresh the queue.

### User Workflow

1. Navigate to Swipe from the sidebar or the Inspiration page's Swipe tab.
2. Review the top card's content, estimated engagement, and post type.
3. Swipe right (or click the heart button) to save as draft.
4. Swipe left (or click the X button) to skip.
5. Click "Edit & Post" to load into the composer, or "Remix" to adjust with AI.
6. Filter by category to focus on specific content types.
7. Generate new suggestions when the queue runs low.
8. Track session progress in the stats card.

### Pages and Components

- `app/dashboard/swipe/page.tsx` -- Standalone swipe page
- `components/features/swipe-card.tsx` -- SwipeCard, SwipeCardStack, SwipeCardEmpty components
- `components/features/generation-progress.tsx` -- Generation progress indicator
- `components/features/remix-dialog.tsx` -- AI remix dialog
- `hooks/use-generated-suggestions.ts` -- Suggestion data and generation hook
- `hooks/use-swipe-actions.ts` -- Swipe session tracking hook
- `lib/toast-utils.ts` -- Custom toast helpers (swipeToast, inspirationToast)

---

## 9. Scheduling

### Description

The Scheduling page provides a content calendar view and list management for scheduled LinkedIn posts. Users can visualize their posting cadence, manage upcoming posts, and schedule new content.

### Key Capabilities

- **Content Calendar** -- Full interactive calendar displaying scheduled posts as indicators on their respective dates. Posts are color-coded by status (pending, posting, failed).
- **Quick Stats Row** -- Four stat cards showing: Scheduled (pending count), Published (posted count), This Month (total count), and a Best Times tip card suggesting optimal posting windows (Tue-Thu, 8-10 AM).
- **Scheduled Posts List** -- Below the calendar, a list view of all pending/scheduled posts with content preview, scheduled time, and actions.
- **Date Click Interaction** -- Clicking an empty date navigates to compose with that date pre-filled. Clicking a date with one post opens it for editing. Clicking a date with multiple posts shows a picker dialog.
- **Edit Scheduled Posts** -- Open any scheduled post in the composer for content editing and optional rescheduling.
- **Delete Posts** -- Remove scheduled posts with confirmation.
- **Post Now** -- Immediately queue a scheduled post for publishing (bypasses the scheduled time).
- **Posting Configuration** -- Respects the posting enabled/disabled flag, showing appropriate warnings when posting is disabled.
- **Status Mapping** -- Database statuses (pending, scheduled, posting, processing, failed, error) are mapped to display statuses.

### User Workflow

1. Navigate to Schedule from the sidebar.
2. View the calendar to see upcoming scheduled posts.
3. Click the "Schedule Post" button to create new scheduled content via the composer.
4. Click a date on the calendar to create, view, or edit posts for that day.
5. Use the list below the calendar to manage individual posts (edit, delete, post now).
6. Review stats cards for a quick overview of scheduling activity.

### Pages and Components

- `app/dashboard/schedule/page.tsx` -- Schedule page with calendar, stats, and post list
- `components/features/schedule-calendar.tsx` -- Interactive calendar with post indicators
- `components/features/scheduled-posts.tsx` -- Scheduled posts list component
- `hooks/use-scheduled-posts.ts` -- Scheduled posts data hook
- `hooks/use-posting-config.ts` -- Posting enabled/disabled configuration

---

## 10. Drafts

### Description

The Drafts page manages all auto-saved and manually saved draft posts. Drafts are created from multiple sources (compose auto-save, swipe likes, discover remixes, inspiration remixes, research outputs) and are organized with source-colored badges for easy identification.

### Key Capabilities

- **Source-Colored Badges** -- Each draft is tagged with its source (Compose, Swipe, Discover, Inspiration, Research) using distinct color-coded badges with corresponding gradient card backgrounds.
- **Card and List Views** -- Toggle between a visual card grid view and a compact list view.
- **Search** -- Full-text search across draft content.
- **Source Filtering** -- Filter drafts by their source (compose, swipe, discover, inspiration, research).
- **Sorting** -- Sort drafts by most recent, oldest, or word count.
- **Bulk Selection** -- Select multiple drafts for bulk operations. Includes select-all functionality.
- **Bulk Delete** -- Delete multiple selected drafts at once with confirmation.
- **Edit Draft** -- Open a draft in the Post Composer for editing and publishing.
- **Copy Content** -- Copy draft content to clipboard.
- **Remix Draft** -- Load a draft into the AI remix workflow.
- **Individual Delete** -- Delete a single draft with confirmation.
- **Word Count Display** -- Each draft card shows the word count.
- **Relative Timestamps** -- Display how long ago each draft was saved.
- **Empty State** -- When no drafts exist, a friendly prompt guides users to create content.

### User Workflow

1. Navigate to Drafts from the sidebar.
2. Browse drafts in card or list view.
3. Use search, source filter, or sorting to find specific drafts.
4. Click a draft to open it in the composer for editing and posting.
5. Use the context menu for quick actions (copy, remix, delete).
6. Select multiple drafts for bulk deletion when cleaning up.

### Pages and Components

- `app/dashboard/drafts/page.tsx` -- Drafts page with views, search, filter, sort, bulk actions
- `hooks/use-drafts.ts` -- Drafts CRUD and filtering hook
- `lib/store/draft-context.tsx` -- Draft state context
- `components/features/remix-post-button.tsx` -- Remix action on draft cards

---

## 11. My Posts

### Description

The My Posts page displays the user's published LinkedIn posts with engagement metrics, search, filtering, and sorting capabilities. It serves as a historical view of all content the user has posted.

### Key Capabilities

- **Post Cards** -- Each post is displayed as a card with content preview, media thumbnails, engagement metrics (impressions, reactions, comments, reposts), and posted date.
- **Engagement Metrics** -- Visual display of impressions, reactions, comments, and reposts with formatted numbers.
- **Media Preview** -- Posts with images show thumbnail previews.
- **Content Type Tabs** -- Filter posts by content type (all, text-only, with media, articles).
- **Search** -- Search across post content.
- **Sorting** -- Sort by most recent, most impressions, most reactions, or most comments.
- **Remix** -- Each post includes a Remix button for generating new content based on an existing post.
- **Summary Statistics** -- Overview stats for total posts and aggregate engagement.
- **Expandable Content** -- Toggle between truncated and full post content.
- **Author Profiles** -- For team views, posts show the author's profile information.

### User Workflow

1. Navigate to Posts from the sidebar.
2. Browse published posts sorted by recency or engagement.
3. Use tabs to filter by content type.
4. Search for specific posts.
5. Click Remix on any post to create a fresh version in the composer.

### Pages and Components

- `app/dashboard/posts/page.tsx` -- Posts page with cards, search, filter, sort
- `components/features/remix-post-button.tsx` -- Remix action
- `hooks/use-analytics.ts` -- Post analytics data

---

## 12. AI Features

### Description

AI is deeply integrated across ChainLinked's feature set. Multiple AI-powered capabilities help users generate, refine, and optimize LinkedIn content.

### Key Capabilities

- **Post Generation (Compose Chat)** -- The AI inline panel in the Post Composer uses a chat interface where users provide a topic, tone, context, and post type. The AI generates LinkedIn-ready content that can be iterated upon through conversation.
- **Remix Posts** -- Available on My Posts, Team Posts, Inspiration Posts, Discover Articles, Swipe Suggestions, and Drafts. Opens a dialog where users set tone (professional, casual, etc.), length (shorter, same, longer), and custom instructions. The AI produces a remixed version.
- **Edit with AI** -- Select text in the composer and use AI to rewrite, expand, shorten, or change the tone of specific sections.
- **Carousel AI Content** -- The carousel creator's AI generator creates multi-slide content with a step-by-step workflow: topic input, tone and CTA selection, template matching, content preview, and final slide population.
- **Enhanced Carousel AI** -- An advanced carousel generation mode that produces richer, more structured content for each slide.
- **Company Analysis** -- During onboarding (Step 2), the system analyzes the user's company website using Firecrawl (scraping), Perplexity (research), and OpenAI (structured extraction) to build a company context profile.
- **Suggestion Generation (Swipe)** -- The swipe interface generates personalized post suggestions based on the user's company context, audience, and content goals. Generation progress is streamed to the UI.
- **Deep Research Mode** -- Available on the Discover page, this mode provides in-depth AI-powered analysis on a topic, generating detailed research briefs.
- **Content Rules** -- Users can define AI writing guidelines (content rules) in Settings that are applied to all AI-generated content.
- **Prompt Playground** -- A dedicated testing surface for iterating on AI prompts (see section 17).

### Pages and Components

- `components/features/ai-inline-panel.tsx` -- Compose chat AI panel
- `components/features/ai-generation-dialog.tsx` -- AI generation dialog
- `components/features/remix-dialog.tsx` -- Remix dialog with settings
- `components/features/canvas-editor/ai-content-generator.tsx` -- Carousel AI generator
- `components/features/canvas-editor/enhanced-ai-carousel-generator.tsx` -- Enhanced carousel AI
- `components/features/research-section.tsx` -- Deep research mode
- `components/features/content-rules-editor.tsx` -- AI content rules
- `lib/ai/post-types.ts` -- Post type definitions and goal categories

---

## 13. Brand Kit

### Description

The Brand Kit captures a company's visual identity -- colors, fonts, and logo -- and makes it available across the platform for consistent content creation. Brand kit data is extracted automatically during onboarding and can be edited in Settings.

### Key Capabilities

- **Automatic Extraction via Brandfetch** -- During onboarding Step 3, the system automatically extracts brand colors, fonts, and logo from the company website URL provided in Step 2 using Brandfetch integration.
- **Color Palette** -- Primary, secondary, accent, background, and text colors are stored and applied to carousel templates and AI-generated content.
- **Font Configuration** -- Primary and secondary font families are captured for use in carousel slides and template designs.
- **Logo URL** -- The company logo is extracted and stored. It appears in the team header and can be used in carousel designs.
- **Website URL** -- The source website is stored for reference and re-extraction.
- **Brand Kit Preview** -- A visual preview component shows the extracted brand kit during onboarding for user review before saving.
- **Settings Editing** -- Colors, fonts, and logo can be modified in the Settings page's Brand Kit and AI section.
- **Carousel Integration** -- The carousel editor's color picker includes brand kit colors for quick access to on-brand color choices.

### User Workflow

1. During onboarding Step 2, provide the company website URL.
2. In Step 3, the brand kit is automatically extracted and displayed for review.
3. Confirm or edit the extracted brand kit.
4. Brand colors appear in the carousel editor's color picker.
5. Modify the brand kit at any time from Settings > Brand Kit and AI.

### Pages and Components

- `app/onboarding/step3/page.tsx` -- Brand kit extraction and review during onboarding
- `components/features/brand-kit-preview.tsx` -- Brand kit visual preview
- `components/features/canvas-editor/enhanced-color-picker.tsx` -- Color picker with brand kit integration
- `hooks/use-brand-kit.ts` -- Brand kit data hook
- `types/brand-kit.ts` -- Brand kit TypeScript types

---

## 14. Settings

### Description

The Settings page provides a comprehensive configuration interface with sidebar navigation and section cards. It covers profile management, LinkedIn connection status, brand kit and AI context, content rules, team settings, notifications, and account management.

### Key Capabilities

#### Profile Section
- Edit personal information: name, headline, location, education, bio.
- Upload and manage avatar/profile photo.
- View email address.

#### LinkedIn Section
- View LinkedIn connection status with a status badge.
- Connect or reconnect LinkedIn account.
- View LinkedIn profile information.

#### Brand Kit and AI Section
- View and edit brand kit colors (primary, secondary, accent, background, text).
- Configure primary and secondary fonts.
- Set or update logo URL.
- Manage website URL for brand extraction.

#### Content Rules Section
- Define AI writing guidelines that are applied to all AI-generated content.
- Set rules for tone, formatting, topics to avoid, and preferred style.

#### Default Hashtags
- Manage a list of default hashtags that are automatically appended to posts.
- Hashtags are persisted to Supabase per user.

#### API Keys Section
- Configure API keys for AI services (OpenAI, etc.).
- Status indicators showing whether keys are set.

#### Team Section
- View current team information.
- Manage team settings (for admins/owners).

#### Notifications Section
- Toggle email notifications on/off.
- Configure notification preferences: post published, post scheduled, weekly digest, team activity, system updates.

#### Account Section
- Theme selection: light, dark, or system.
- Data export functionality.
- Delete account with confirmation.

### User Workflow

1. Navigate to Settings from the sidebar.
2. Use the sidebar navigation to jump between sections.
3. Edit profile information, LinkedIn connection, brand kit, content rules, hashtags, or API keys.
4. Configure notification preferences.
5. Manage account settings including theme and data.

### Pages and Components

- `app/dashboard/settings/page.tsx` -- Settings page with sidebar navigation and section cards
- `components/features/api-key-settings.tsx` -- API key management
- `components/features/linkedin-status-badge.tsx` -- LinkedIn connection status
- `components/features/content-rules-editor.tsx` -- Content rules editor
- `components/features/default-hashtags-editor.tsx` -- Default hashtags management
- `hooks/use-settings.ts` -- Settings data and persistence hook

---

## 15. Onboarding

### Description

The onboarding flow guides new users through initial setup with a multi-step process. Users first select their role (organization owner or joining member), then proceed through role-specific steps to connect tools, set up their company context, extract a brand kit, and review AI-generated company analysis.

### Key Capabilities

- **Role Selection** -- The entry page presents two paths: "I'm setting up my organization" (owner) or "I'm joining an existing team" (member). The selection determines the subsequent steps.
- **Step 1: Connect** -- Connect LinkedIn tools and the Chrome extension. Saves progress to the database.
- **Step 2: Company Context** -- Enter company name, website URL, industry, and description. Triggers an Inngest-powered analysis workflow using Firecrawl (website scraping), Perplexity (company research), and OpenAI (structured extraction) to build a comprehensive company profile.
- **Step 3: Brand Kit** -- Automatically extracts brand colors, fonts, and logo from the company website URL provided in Step 2 using Brandfetch. Displays the results for review and editing before saving.
- **Step 4: Review and Complete** -- Review the AI-extracted company context (mission, products, target audience, value propositions, tone guidelines). Edit any field inline with compose-style textareas. Confirm and complete onboarding.
- **Join Flow** -- Members who select the joining path can search for teams, send join requests, and wait for approval on a pending page.
- **Invite Flow** -- Users who arrive via an email invitation are guided through an invite-specific onboarding path. Non-registered invitees are auto-redirected to `/signup?invite=TOKEN`. After signup (email/password or Google OAuth), onboarding is shortened to the LinkedIn connect step only (role selection is skipped). The connect button reads "Connect & Join Team". After LinkedIn connect, the invite is auto-accepted, onboarding completes, and the user lands on the dashboard.
- **Progress Persistence** -- Onboarding step progress is saved to the database, allowing users to resume from where they left off.
- **Onboarding Guard** -- A hook ensures users are on the correct step and redirects them if they try to skip ahead.

### User Workflow

#### Owner Path
1. Select "I'm setting up my organization."
2. Step 1: Connect LinkedIn and extension.
3. Step 2: Enter company details; wait for AI analysis.
4. Step 3: Review and edit the extracted brand kit.
5. Step 4: Review and edit AI-generated company context; complete onboarding.

#### Member Path
1. Select "I'm joining an existing team."
2. Search for a team and send a join request.
3. Wait for admin approval on the pending page.
4. Once approved, complete remaining setup steps.

### Pages and Components

- `app/onboarding/page.tsx` -- Role selection entry page
- `app/onboarding/step1/page.tsx` -- Step 1: Connect LinkedIn tools
- `app/onboarding/step2/page.tsx` -- Step 2: Company context and AI analysis
- `app/onboarding/step3/page.tsx` -- Step 3: Brand kit extraction and review
- `app/onboarding/step4/page.tsx` -- Step 4: Review and complete
- `app/onboarding/join/page.tsx` -- Team search and join request
- `app/onboarding/join/pending/page.tsx` -- Pending approval page
- `app/onboarding/invite/page.tsx` -- Invite-based onboarding
- `app/onboarding/company/page.tsx` -- Company setup
- `app/onboarding/company-context/page.tsx` -- Company context collection
- `app/onboarding/brand-kit/page.tsx` -- Brand kit step
- `app/onboarding/layout.tsx` -- Onboarding layout wrapper
- `components/ConnectTools.tsx` -- LinkedIn connection tools component
- `hooks/use-onboarding-guard.ts` -- Step guard and redirect hook
- `services/onboarding.ts` -- Onboarding database operations

---

## 16. Chrome Extension

### Description

The ChainLinked Chrome Extension runs in the background on LinkedIn pages to capture analytics data, post metrics, audience information, and profile data. It syncs this data to Supabase for use in the web application's analytics and team features.

### Key Capabilities

- **LinkedIn Data Capture** -- Intercepts LinkedIn API responses to capture post impressions, reactions, comments, reposts, follower counts, profile views, and audience demographics.
- **Background Sync** -- Periodically syncs captured data to Supabase in the background.
- **Auto-Login** -- When a user is logged into the ChainLinked webapp, the extension automatically authenticates using the same session, eliminating the need for separate login.
- **Extension Detection** -- The webapp detects whether the extension is installed and prompts for installation if not.
- **Capture Statistics** -- Tracks what data has been captured and when, stored in the `capture_stats` table.
- **Extension Settings** -- Per-user extension configuration stored in `extension_settings`.
- **Sync Metadata** -- Tracks sync status and timing via `sync_metadata`.

### User Workflow

1. Install the Chrome extension from the provided link.
2. The extension auto-logs in using the webapp session.
3. Browse LinkedIn normally; the extension captures data in the background.
4. Data appears in the ChainLinked analytics dashboard and team activity feed.
5. The webapp's dashboard prompts for extension installation if not detected.

### Related Database Tables

- `linkedin_analytics` -- Aggregated LinkedIn analytics data
- `analytics_history` -- Historical analytics snapshots
- `post_analytics` -- Per-post engagement data
- `audience_data` -- Audience demographic data
- `audience_history` -- Historical audience snapshots
- `connections` -- LinkedIn connections
- `feed_posts` -- LinkedIn feed posts
- `my_posts` -- User's own LinkedIn posts
- `comments` -- Post comments
- `followers` -- Follower data
- `captured_apis` -- Raw captured API responses
- `capture_stats` -- Capture statistics
- `extension_settings` -- Extension configuration
- `sync_metadata` -- Sync status tracking

### Pages and Components

- `components/features/extension-install-prompt.tsx` -- Installation banner and prompt
- `lib/extension/detect.ts` -- Extension detection utilities

---

## 17. Prompt Playground

### Description

The Prompt Playground is a developer-oriented tool for testing, iterating, and managing AI prompts. It provides a full-featured testing surface with variable management, response comparison, model parameter controls, run history, and database integration for prompt versioning.

### Key Capabilities

- **Prompt Editor** -- A large text area for writing and editing AI prompts with syntax highlighting.
- **Variable Management** -- Define variables (e.g., `{{topic}}`, `{{tone}}`) in prompts and provide values for testing. Variables are extracted automatically from the prompt text.
- **Model Parameter Controls** -- Adjust temperature, max tokens, top-p, and other model parameters via sliders and inputs.
- **Run Prompt** -- Execute the prompt against the configured AI model and view the response.
- **Response Display** -- View AI responses with formatted output. Toggle between rendered and raw JSON views.
- **Side-by-Side Comparison** -- Compare responses from different prompts or parameter settings in a split-column view.
- **Run History** -- A side sheet displaying previous prompt runs with timestamps, token usage, and cost estimates. Click any historical run to reload its prompt and response.
- **Template Library Integration** -- Browse and load prompt templates for common use cases.
- **Save Prompts** -- Save prompts to the database with versioning support.
- **Version History** -- Track prompt versions and roll back to previous iterations.
- **Activate Prompts** -- Mark a prompt version as the active/production version.
- **Export** -- Download prompt configurations and responses.
- **Copy to Clipboard** -- Quick copy of prompts or responses.
- **Search** -- Search through saved prompts.
- **Bookmarks** -- Bookmark prompts for quick access.

### User Workflow

1. Navigate to Prompt Playground from the sidebar.
2. Write or load a prompt template.
3. Define variables and set model parameters.
4. Run the prompt and review the response.
5. Iterate by adjusting the prompt, variables, or parameters.
6. Compare multiple responses side by side.
7. Save successful prompts with version tracking.
8. Review run history for previous experiments.

### Pages and Components

- `app/dashboard/prompts/page.tsx` -- Prompt playground page
- `components/features/prompt-playground.tsx` -- Full prompt playground component with editor, variables, parameters, history, and versioning

---

## Architecture Notes

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 with App Router |
| UI Library | React 19 |
| Components | shadcn/ui (new-york style) |
| Styling | Tailwind CSS v4 with CSS variables |
| Charts | Recharts |
| Animations | Framer Motion |
| Canvas | Konva.js (carousel editor) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password, Google OAuth) |
| Icons | Tabler Icons + Lucide React |
| State | React hooks (useState, useContext, useRef) |
| Form Validation | Zod |
| Tables | TanStack React Table |

### Key Design Patterns

- **Server Components by default** -- Pages use `"use client"` directive only when interactivity is needed.
- **Custom hooks for data** -- Each feature has dedicated hooks (e.g., `use-analytics-v2`, `use-team-posts`) that encapsulate data fetching, caching, and error handling.
- **Context providers** -- Auth state (`AuthProvider`), draft state (`DraftContext`), and dashboard metadata (`DashboardContext`) are managed via React Context.
- **Auto-save with sendBeacon** -- The compose page uses `navigator.sendBeacon` for reliable draft saving on page close and `fetch` for periodic saves.
- **Framer Motion animations** -- Stagger containers, fade/slide variants, and spring-based transitions are used throughout for polished UI interactions.
- **Error boundaries** -- Feature sections are wrapped in error boundaries to prevent cascading failures.
- **Skeleton loading** -- Every page has a dedicated skeleton component for smooth loading states.
- **Toast notifications** -- Sonner-based toast system with feature-specific helpers (swipeToast, postToast, inspirationToast).
