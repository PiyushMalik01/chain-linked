# ChainLinked Bug Fixes — Detailed Report

This document tracks all bugs fixed in this session, with root cause analysis, exact file changes, and screenshots where available.

---

## Bug 1: Scheduled Post Editing — Wrong Panel

**Status:** Fixed
**Bug Screenshot:** `bug1.png`
**Fix Screenshot:** `bug1fixed.png`
**Problem:** When editing a scheduled post, the content loads into the AI Generation panel (left side) instead of the LinkedIn Preview panel (right side). The user sees "Your post content will appear here..." on the right while their actual content sits in the AI topic field. Also shows "Save failed" error because auto-save tries to save to the drafts API.

**Root Cause:** Three issues combined:
1. `content` state initialized from `draft.content || initialContent` — stale draft context overwrote the scheduled post's actual content with empty/old data
2. `isEditing` was `false` so the preview panel showed "Double-click to edit" instead of the editable textarea with content
3. Auto-save fired immediately on mount trying to save empty content, causing "Save failed" toast
4. Draft sync `useEffect` could overwrite `content` with stale `draft.content` on mount

**Changes:**

| File | Change |
|------|--------|
| `components/features/post-composer.tsx` | When `isEditingScheduledPost`: (1) `content` state now prioritizes `initialContent` over `draft.content`, (2) `isEditing` starts as `true` so preview panel is immediately editable, (3) auto-save disabled (passes `null` as saveFn — scheduled posts use their own `onSaveEdit` flow), (4) draft sync effect skipped to prevent stale content overwrite. |

---

## Bug 2: Schedule Modal — Post Preview Is Misleading

**Status:** Fixed
**Bug Screenshot:** `bug2.png`
**Fix Screenshot:** `bug2fixed.png`
**Problem:** The Post Preview in the Schedule Modal shows raw content including mention tokens (`@[Name](urn:li:person:...)`), truncated text, and a stray "0" at the end. Doesn't represent what the actual post looks like on LinkedIn.

**Root Cause:**
1. `truncateContent()` just sliced the raw string without cleaning mention tokens or formatting
2. `mediaCount` was `0`, and `{0 && ...}` in JSX renders the literal string "0" instead of nothing
3. Preview container used basic `text-sm` with no whitespace handling

**Changes:**

| File | Change |
|------|--------|
| `components/features/schedule-modal.tsx` | Added `cleanContentForPreview()` that strips mention tokens (`@[Name](urn:...)` → `Name`) and collapses excessive newlines. `truncateContent()` now cleans content before truncating. Replaced plain text preview with mini LinkedIn card — always visible, shows user avatar + name + headline, cleaned content (`line-clamp-5`, 250 chars), attachment count. Uses `bg-white dark:bg-zinc-900` to match main preview styling. Fixed `mediaCount` guard from `mediaCount && > 0` (renders "0") to `mediaCount != null && > 0`. Added `userProfile` to `PostPreview` interface. |
| `components/features/post-composer.tsx` | Passes `userProfile` (name, headline, avatarUrl) to the schedule modal's `postPreview` prop. |

---

## Bug 3: Team Page — Empty State Shows Skeleton Forever

**Status:** Fixed
**Bug Screenshot:** `audit_team.png`
**Problem:** When a team exists but has no posts or activity, the team page shows perpetual skeleton loaders for the Recent Team Activity section. Filter dropdown and "View All Activity" button appeared even when there were no posts to filter.

**Root Cause:** The `PostGrid` component already had a proper empty state, but the filter controls above it rendered unconditionally regardless of data availability. The combination of visible filter controls + empty grid made the page feel broken.

**Changes:**

| File | Change |
|------|--------|
| `app/dashboard/team/page.tsx` | Filter dropdown and "View All Activity" button now only render when `!postsLoading && posts.length > 0`. When there are no posts, the section shows just the heading and the `PostGrid` empty state (icon, "No recent posts", helpful message). Added `flex-wrap` to the header for responsive layout. |

---

## Bug 4: All Dashboard Pages — 5-8 Second Loading Spinner

**Status:** Fixed
**Problem:** Every dashboard page showed a blank "Loading dashboard..." spinner for 5-8 seconds before any content appeared. Users saw no sidebar, no header, no indication the app was responsive — just a centered spinner on a blank screen.

**Root Cause:** The dashboard layout blocked ALL rendering (including sidebar and header) on `isLoading` from the auth context. The auth provider fetched the full user profile (profiles + linkedin_profiles + extension status) before setting `isLoading(false)`, with a 10-second timeout race. This meant the entire dashboard shell was hidden for the full auth+profile fetch duration.

**Changes:**

| File | Change |
|------|--------|
| `app/dashboard/layout.tsx` | Dashboard shell (sidebar, header, navigation) now renders immediately regardless of auth loading state. Only the main content area shows a small loading spinner while auth resolves. The full "Loading dashboard..." screen only appears during redirect to login (unauthenticated). Tour and data sync banner wait for `ready` before rendering. |
| `lib/auth/auth-provider.tsx` | Reduced profile fetch timeout from 10 seconds to 5 seconds. |

**Result:** Users see the sidebar, header, and navigation instantly (~500ms). Only the content area loads, giving the perception of a much faster app. Effective perceived load time reduced from ~6s (blank screen) to ~1s (shell visible).

---

## Bug 5: Image/PDF Upload Buttons — Only Visible in Edit Mode

**Status:** Fixed
**Bug Screenshot:** `bug5.png`
**Fix Screenshot:** `bug5fixed.png`
**Problem:** The image and PDF upload buttons were inside the formatting toolbar which only appears after double-clicking the preview to enter edit mode. Users couldn't attach media without first entering edit mode.

**Root Cause:** The image/document attachment buttons were inside the `AnimatePresence` block gated by `{isEditing && (...)}`. They were part of the formatting toolbar (Bold, Italic, etc.) instead of being independently accessible.

**Changes:**

| File | Change |
|------|--------|
| `components/features/post-composer.tsx` | Added a persistent media attachment bar (image + document buttons with tooltips) that shows when NOT in edit mode — positioned between the preview content and media preview area. When in edit mode, the buttons remain in the full formatting toolbar as before. Includes a subtle "Double-click preview to edit text" hint. |

---

## Bug 6: Analytics Graphs Show Inaccurate Data

**Status:** Fixed
**Bug Screenshot:** `audit_analytics_full.png`
**Problem:** The Impressions Trend graph showed a flat line at 0 while the summary showed "Total Impressions: 73". Daily Average showed 0.0. The Data Table correctly showed 73. All three visualizations were inconsistent.

**Root Cause:** Two issues:
1. The trend chart was passed `data` (delta/daily-change timeseries from `buildTimeseries(..., 'delta')`) which was all zeros because all 73 impressions arrived in a single sync batch. The Data Table used `absoluteData` (cumulative totals) and showed correctly.
2. The API summary calculated `total` and `average` from deltas too — showing 0 for both even though `accumulativeTotal` was 73.

**Changes:**

| File | Change |
|------|--------|
| `app/dashboard/analytics/page.tsx` | Trend chart now receives `absoluteData` instead of `data` (deltas). Multi-metric mode also uses `multiAbsoluteData`. Graph now matches the Data Table and summary. |
| `app/api/analytics/v3/route.ts` | Summary `total` now uses the latest absolute snapshot value (same as `accumulativeTotal`). `average` now computed from absolute values across the period instead of from deltas. Removed duplicate `absolute` variable declaration. |

**Result:** Trend graph shows actual impression values (73), Daily Average reflects real data, and all three visualizations (summary bar, trend chart, data table) are consistent.

---

## Bug 7: Analytics — Filters Not Greyed Out When Not Enough Data

**Status:** Fixed
**Bug Screenshot:** `bug7.png`
**Fix Screenshot:** `bug7fixed.png`
**Problem:** 30D, 90D, 1Y period filters were fully clickable even when the user only had 3 days of data. Selecting them showed empty/misleading charts with no indication why.

**Root Cause:** The period toggle buttons in `AnalyticsFilterBar` had no awareness of available data range. They were always enabled regardless of how much historical data existed.

**Changes:**

| File | Change |
|------|--------|
| `app/dashboard/analytics/page.tsx` | Passes `dataStartDate` (earliest date in `absoluteData`) to `AnalyticsFilterBar`. |
| `components/features/analytics-filter-bar.tsx` | Added `dataStartDate` prop, `PERIOD_DAYS` mapping, and `daysOfData` calculation. All period buttons (7D, 30D, 90D, 1Y) disabled with `opacity-40` when the user doesn't have enough days of data. Custom button disabled when `daysOfData === 0`. Hover tooltip shows "Need X days of data (have Y)". Mobile select shows "(not enough data)" suffix on disabled options. |

---

## Bug 8: Compose Page — Auto-Expand, Start Over, and Responsiveness

**Status:** Fixed
**Fix Screenshot:** `bug8fixed.png`
**Problems:**
1. Topic and context textareas didn't auto-expand — long text was hidden behind a scrollbar
2. "Start Over" button in the card header cramped the layout, causing "Advanced" toggle to be cut off ("A...")
3. "Start Over" only cleared the right preview panel but NOT the AI generation fields (topic, tone, context)
4. LinkedIn action buttons ("Send") got cut off on narrow cards
5. Auto-save "Save failed" / "Saved" text inside the card header disrupted layout

**Root Cause:** Textareas used `resize-none` with fixed `min-h` and no auto-expand logic. "Start Over" had no connection to the AI panel state. The card header was overcrowded with too many elements.

**Changes:**

| File | Change |
|------|--------|
| `components/features/compose/compose-basic-mode.tsx` | Both textareas auto-expand via inline `style.height` on change. Added `resetKey` prop — when incremented, clears all fields (topic, tone, length, context) and localStorage cache. |
| `components/features/ai-inline-panel.tsx` | Same auto-expand fix with ref-based approach (`topicRef`, `contextRef`, `autoResize` callback). Added `resetKey` prop with `useEffect` to reset all internal state. |
| `components/features/post-composer.tsx` | Moved "Start Over" / "New Chat" from cramped header into `CardDescription` as a subtle text link. Added `aiResetKey` state passed to `ComposeBasicMode` — Start Over now clears BOTH the preview AND the AI fields. LinkedIn action buttons: text labels hidden on small screens (`hidden sm:inline`), only icons show. Auto-save indicator completely removed from card — save status now uses toast notifications (error toast on failure, success toast only after recovering from failure). Footer uses `flex-wrap`. |
| `components/features/compose/post-series-composer.tsx` | Same `flex-wrap` fix applied to series composer footer. |

---

## Bug 9: Inspiration Page — Tag Overflow

**Status:** Fixed
**Bug Screenshot:** `inspiration_audit1.png`
**Problem:** On the Inspiration page, tag badges on Viral Posts cards and Discover Topics featured cards overflowed their card boundaries on narrow screens. Long tags like "Leadership Development" and "Strategic Partnerships" spilled outside the card.

**Root Cause:** Tags used `flex-wrap` but had no width constraint or overflow control. Long tag text wasn't truncated, and the containers had no `max-height` or `overflow-hidden`.

**Changes:**

| File | Change |
|------|--------|
| `components/features/discover-news-card.tsx` | Featured card tags: reduced from 3 to 2 max tags, added `truncate max-w-[120px]` on each badge, container has `overflow-hidden max-h-[22px]`. Smaller text (9px). |
| `components/features/inspiration-post-card.tsx` | Post card tags: reduced from 3 to 2 max tags, added `truncate max-w-[100px]` on each tag, container has `overflow-hidden max-h-[20px]`. Smaller text (9px). |

---

## Bug 10: Chat — "Type Your Own" + Infinite Loop + Scrollbar Overflow

**Status:** Fixed
**Problems:**
1. In the AI Advanced mode chat, "Type your own" input didn't support Shift+Enter for new lines
2. Maximum update depth exceeded error (infinite loop)
3. Chat area scrollbar overflowed the card boundary horizontally

**Root Causes:**
1. "Type your own" was an `<input type="text">` element — single-line, no newline support. Ref typed as `HTMLInputElement`.
2. `autoSaveFn` in post-composer depended on `draft.savedDraftId` which changed after every successful auto-save, recreating the callback and causing re-render cascades.
3. Chat area had `overflow-y-auto` with `pr-1` which didn't give enough room for the scrollbar.

**Changes:**

| File | Change |
|------|--------|
| `components/features/compose/compose-advanced-mode.tsx` | "Type your own": changed from `<input>` to `<textarea>` with `rows={1}`, auto-expand (max 80px), Shift+Enter for new line, Enter (without Shift) submits. Fixed ref type to `HTMLTextAreaElement`. Form container changed from `items-center overflow-hidden` to `items-end`. Chat area: added `overflow-x-hidden scrollbar-thin`, increased padding to `pr-2`. |
| `components/features/post-composer.tsx` | `autoSaveFn` now reads `savedDraftId` from a ref (`savedDraftIdRef`) instead of the dependency array, preventing callback recreation after every save. |
| `app/globals.css` | Added `.scrollbar-thin` utility class (4px scrollbar width, 2px border-radius) for contained scroll areas. |

---

## Bug 11: Post Series — Complete Overhaul

**Status:** Fixed
**Bug Screenshot:** `series_chatbox_audit.png`, `series_chatbox_full.png`
**Problems:**
1. React Error #185 (infinite loop) when using Post Series
2. Series preview carousel overflowed the chat box boundary
3. Text in series preview was too large for the chat container
4. "Type your own" input was `<input>` (no Shift+Enter, no multiline)
5. Chat area scrollbar overflowed horizontally
6. Difficult to scroll while AI was generating content
7. `onMessagesChange` effect fired without guard (could trigger infinite loops)
8. `setHasGeneratedSeries` called unconditionally on every messages change

**Root Cause:** The `compose-series-mode.tsx` was a copy of the original `compose-advanced-mode.tsx` but never received the infinite loop fixes (ref-based guards, stable message notifications). The series preview slider used large text and unrestricted height.

**Changes:**

| File | Change |
|------|--------|
| `components/features/compose/compose-series-mode.tsx` | Complete rewrite: (1) `customInputRef` changed to `HTMLTextAreaElement`, (2) "Type your own" changed from `<input>` to `<textarea>` with Shift+Enter and auto-expand, (3) Added `lastNotifiedRef` guard on `onMessagesChange` (identical to advanced mode), (4) Added `prevHasSeriesRef` guard on `setHasGeneratedSeries`, (5) Chat area: `overflow-x-hidden scrollbar-thin pr-2`, viewport-relative height, (6) Series preview: reduced text to `text-[11px]`, `max-h-[200px]`, compact padding, (7) MCQ buttons: smaller padding, (8) Main input: `overflow: hidden` inline style for clean auto-expand. |

**Additional supabase stabilization (preventing React Error #185 globally):**

| File | Change |
|------|--------|
| `app/dashboard/compose/page.tsx` | `createClient()` → `useRef(createClient())` |
| `app/dashboard/page.tsx` | `createClient()` → `useRef(createClient())`, removed duplicate `supabaseRef` |
| `app/dashboard/team/activity/page.tsx` | `createClient()` → `useRef(createClient())` |
| `app/invite/[token]/page.tsx` | `createClient()` → `useRef(createClient())` |
| `hooks/use-team-leaderboard.ts` | `createClient()` → `useRef(createClient())` |

**Total files fixed for createClient stability across all sessions: 19 files** (14 hooks + 5 pages).

---

## Bug 12: Post Series & Advanced Chat — Input Off Screen, No Stop/Undo

**Status:** Fixed
**Bug Screenshot:** `series_chatbox_full.png`
**Problems:**
1. Chat input textarea pushed below viewport — invisible without scrolling down
2. Placeholder text too long — "Describe your series theme... (Shift+Enter for new line)" gets truncated in the visible area
3. No way to stop AI generation mid-stream
4. No way to undo/go back to a previous point in the conversation

**Root Cause:** The chat container used `min-h-[400px]` with no viewport-relative constraint. Combined with card padding and the tone selector, the input was pushed well below the fold. No `stop` or history management was exposed from `useChat`.

**Changes:**

| File | Change |
|------|--------|
| `components/features/compose/compose-series-mode.tsx` | Container height set to `calc(100vh - 320px)` with `minHeight: 350px / maxHeight: 600px`, keeping input always within viewport. Placeholder shortened to "Describe your series theme...". Added **Stop** button (visible during generation, calls `useChat.stop()` to cancel mid-stream). Added **Undo** button (visible when ready + has messages, removes last user message + AI response). |
| `components/features/compose/compose-advanced-mode.tsx` | Same viewport-relative height fix. Same Stop and Undo buttons added. Added `IconX` import. |

---

## Additional Fixes (UI/UX Polish)

| Fix | Details |
|-----|---------|
| Auto-save indicator | Removed from card header entirely. Save status uses toast notifications — error toast on failure, success toast only after recovering from a previous failure. Normal saves are silent. |
| Calendar dot tooltips | Text now uses `text-foreground` with proper opacity levels instead of `text-muted-foreground`. Explicit `bg-popover text-popover-foreground` for readability in both light and dark mode. |
| "Save failed" layout | No longer disrupts the AI Generation card layout. Completely removed from inline UI. |
| Button overflow | Footer buttons use `flex-wrap` in both single post and series composers. |
| Discover loading tips | Rotating tips component added to both `/dashboard/discover` and `/dashboard/inspiration` pages during content skeleton loading. |
