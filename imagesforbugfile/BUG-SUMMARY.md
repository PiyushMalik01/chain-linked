# ChainLinked Bug Fixes — Summary

## Bug 1: Scheduled Post Editing — Wrong Panel
- **Issue:** Content loads into AI Generation panel instead of LinkedIn Preview
- **Fix:** `isEditing` starts true when editing, `content` prioritizes `initialContent`, auto-save disabled
- **Screenshots:** `bug1.png` → `bug1fixed.png`

## Bug 2: Schedule Modal — Post Preview Is Misleading
- **Issue:** Preview showed raw content with mention tokens and stray "0"
- **Fix:** Mini LinkedIn card with avatar, cleaned content, proper `mediaCount` guard
- **Screenshots:** `bug2.png` → `bug2fixed.png`

## Bug 3: Team Page — Empty State Shows Skeleton Forever
- **Issue:** Team page showed perpetual skeleton loaders when no posts existed
- **Fix:** Filter controls hidden when no posts, proper empty state shown

## Bug 4: All Dashboard Pages — 5-8 Second Loading Spinner
- **Issue:** Blank "Loading dashboard..." screen for 5-8 seconds on every page
- **Fix:** Dashboard shell renders immediately, only content area shows loading spinner

## Bug 5: Image/PDF Upload Buttons — Only Visible in Edit Mode
- **Issue:** Media upload buttons hidden until double-clicking to edit
- **Fix:** Persistent media attachment bar visible outside edit mode
- **Screenshots:** `bug5.png`

## Bug 6: Analytics Graphs Show Inaccurate Data
- **Issue:** Trend graph showed 0 while total showed 73. Daily Average was 0.0
- **Fix:** Charts use absolute data instead of deltas, summary uses accumulative totals

## Bug 7: Analytics — Filters Not Greyed Out When Not Enough Data
- **Issue:** 30D/90D/1Y filters clickable with only 3 days of data
- **Fix:** Filters disabled with opacity + tooltip when insufficient data
- **Screenshots:** `bug7.png`

## Bug 8: Compose Page — Auto-Expand, Start Over, Responsiveness
- **Issue:** Textareas didn't auto-expand, Start Over didn't clear AI fields, buttons overflowed
- **Fix:** Auto-expand textareas, Start Over clears everything via resetKey, responsive footer
- **Screenshots:** `bug8fixed.png`

## Bug 9: Inspiration Page — Tag Overflow
- **Issue:** Tag badges overflowed card boundaries on narrow screens
- **Fix:** Tags capped at 2, truncated, overflow-hidden containers

## Bug 10: Chat — Type Your Own + Infinite Loop + Scrollbar
- **Issue:** "Type your own" didn't support Shift+Enter, infinite loop from autoSaveFn, scrollbar overflow
- **Fix:** Changed to textarea, savedDraftId via ref, scrollbar-thin utility

## Bug 11: Post Series — Complete Overhaul
- **Issue:** Infinite loops, carousel overflow, large text, scroll issues, no Shift+Enter
- **Fix:** Full rewrite of compose-series-mode with all guards from advanced mode, compact preview, scrollbar-thin, textarea inputs, 5 more supabase useRef fixes

## Bug 12: Post Series & Advanced Chat — Input Off Screen, No Stop/Undo
- **Issue:** Chat input pushed below viewport, no way to stop generation or undo messages
- **Fix:** Viewport-relative container height, Stop button (cancels generation), Undo button (removes last exchange), shortened placeholder

## Additional Fixes (UI/UX Polish)
- Auto-save status moved from card to toast notifications
- "Save failed" no longer breaks card layout
- Calendar dot tooltips now readable (proper contrast)
- Theme toggle moved to navbar header
- Discover loading tips added
- Settings theme cards have circular expansion animation
- Confirm dialog supports "Don't show again" checkbox
