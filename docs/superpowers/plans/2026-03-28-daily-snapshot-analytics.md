# Daily Snapshot Analytics Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current delta-computation pipeline with a simple daily-snapshot model where absolute values are stored per day, deltas are computed by comparing consecutive days, and only data from the user's first capture date is shown.

**Architecture:** Two new snapshot tables (`daily_account_snapshots` for account-level aggregates, `daily_post_snapshots` for per-post values) are upserted every 5 minutes by the Inngest pipeline. The v2 API endpoints read from these tables, compute day-over-day deltas, and return timeseries data starting from the user's first snapshot. The frontend renders these deltas as trends, engagement breakdowns, and summary stats.

**Tech Stack:** Supabase PostgreSQL (migrations), Inngest (cron pipeline), Next.js API routes, React + Recharts (frontend)

---

## File Structure

### New Files
- `supabase/migrations/XXXXXX_create_daily_snapshot_tables.sql` - DB migration
- `lib/inngest/functions/daily-snapshot-pipeline.ts` - New snapshot pipeline
- `app/api/analytics/v3/route.ts` - New snapshot-based API (account-level)
- `app/api/analytics/v3/posts/route.ts` - New snapshot-based API (post-level)
- `hooks/use-analytics-v3.ts` - New data hook

### Modified Files
- `lib/inngest/client.ts` - Register new function
- `app/dashboard/analytics/page.tsx` - Wire up v3 hook
- `components/features/analytics-trend-chart.tsx` - Accept delta data
- `components/features/analytics-charts.tsx` - Fix engagement breakdown to use snapshot dates
- `components/features/analytics-summary-bar.tsx` - Show snapshot-based summaries
- `components/features/analytics-data-table.tsx` - Show snapshot-based table data
- `components/features/analytics-filter-bar.tsx` - Minor: remove unsupported granularities

---

## Task 1: Create Daily Snapshot Tables

**Files:**
- Create: `supabase/migrations/20260328000000_create_daily_snapshot_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Daily account-level snapshots (one row per user per day)
-- Stores absolute totals aggregated across all posts + profile metrics
CREATE TABLE IF NOT EXISTS daily_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,

  -- Post metrics (sum across all posts)
  total_impressions integer NOT NULL DEFAULT 0,
  total_reactions integer NOT NULL DEFAULT 0,
  total_comments integer NOT NULL DEFAULT 0,
  total_reposts integer NOT NULL DEFAULT 0,
  total_saves integer NOT NULL DEFAULT 0,
  total_sends integer NOT NULL DEFAULT 0,
  total_engagements integer NOT NULL DEFAULT 0,

  -- Profile metrics (absolute values)
  followers integer NOT NULL DEFAULT 0,
  connections integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  search_appearances integer NOT NULL DEFAULT 0,

  -- Meta
  post_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_daily_account_snapshot UNIQUE (user_id, date)
);

-- Daily per-post snapshots (one row per user per post per day)
-- Stores absolute values for each individual post
CREATE TABLE IF NOT EXISTS daily_post_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_urn text NOT NULL,
  date date NOT NULL,

  -- Absolute post metrics
  impressions integer NOT NULL DEFAULT 0,
  reactions integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  reposts integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  sends integer NOT NULL DEFAULT 0,
  engagements integer NOT NULL DEFAULT 0,

  -- Post metadata (denormalized for fast reads)
  media_type text,
  posted_at timestamptz,

  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_daily_post_snapshot UNIQUE (user_id, activity_urn, date)
);

-- Indexes for fast queries
CREATE INDEX idx_daily_account_snapshots_user_date
  ON daily_account_snapshots(user_id, date DESC);

CREATE INDEX idx_daily_post_snapshots_user_date
  ON daily_post_snapshots(user_id, date DESC);

CREATE INDEX idx_daily_post_snapshots_user_urn_date
  ON daily_post_snapshots(user_id, activity_urn, date DESC);

-- RLS policies
ALTER TABLE daily_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_post_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own account snapshots"
  ON daily_account_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage account snapshots"
  ON daily_account_snapshots FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own post snapshots"
  ON daily_post_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage post snapshots"
  ON daily_post_snapshots FOR ALL
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP `apply_migration` tool or:
```bash
npx supabase db push
```

- [ ] **Step 3: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('daily_account_snapshots', 'daily_post_snapshots');
```
Expected: Both tables listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260328000000_create_daily_snapshot_tables.sql
git commit -m "feat(db): add daily_account_snapshots and daily_post_snapshots tables"
```

---

## Task 2: Create Daily Snapshot Pipeline

**Files:**
- Create: `lib/inngest/functions/daily-snapshot-pipeline.ts`
- Modify: `lib/inngest/client.ts` (register the new function)

- [ ] **Step 1: Write the snapshot pipeline**

Create `lib/inngest/functions/daily-snapshot-pipeline.ts`:

```typescript
/**
 * Daily Snapshot Pipeline
 *
 * Runs every 5 minutes. For each user with LinkedIn data:
 * 1. Reads latest absolute values from source tables (my_posts, linkedin_profiles, linkedin_analytics)
 * 2. Upserts today's row in daily_account_snapshots (aggregated across all posts)
 * 3. Upserts today's row in daily_post_snapshots (per post)
 *
 * Same-day runs UPDATE the existing row. New day = new row inserted.
 */

import { inngest } from '@/lib/inngest/client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 * @returns ISO date string
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export const dailySnapshotPipeline = inngest.createFunction(
  {
    id: 'daily-snapshot-pipeline',
    name: 'Daily Snapshot Pipeline',
    concurrency: [{ limit: 1 }],
  },
  { cron: '*/5 * * * *' },
  async ({ step, logger }) => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = getToday();

    // Step 1: Get all users who have LinkedIn data
    const users = await step.run('fetch-active-users', async () => {
      const { data, error } = await supabase
        .from('linkedin_profiles')
        .select('user_id, followers_count, connections_count');

      if (error) {
        logger.error('Failed to fetch profiles', { error });
        return [];
      }
      return data || [];
    });

    if (users.length === 0) {
      logger.info('No users with LinkedIn data, skipping');
      return { processed: 0 };
    }

    // Step 2: For each user, snapshot account + post data
    let processed = 0;

    for (const user of users) {
      await step.run(`snapshot-user-${user.user_id}`, async () => {
        const userId = user.user_id;

        // Fetch all posts for this user with their latest metrics
        const { data: posts, error: postsErr } = await supabase
          .from('my_posts')
          .select('activity_urn, impressions, reactions, comments, reposts, saves, sends, media_type, posted_at')
          .eq('user_id', userId);

        if (postsErr) {
          logger.error('Failed to fetch posts', { userId, error: postsErr });
          return;
        }

        // Fetch profile-level analytics
        const { data: analytics } = await supabase
          .from('linkedin_analytics')
          .select('profile_views, search_appearances')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        // Compute account-level aggregates
        const postList = posts || [];
        const accountSnapshot = {
          user_id: userId,
          date: today,
          total_impressions: 0,
          total_reactions: 0,
          total_comments: 0,
          total_reposts: 0,
          total_saves: 0,
          total_sends: 0,
          total_engagements: 0,
          followers: user.followers_count || 0,
          connections: user.connections_count || 0,
          profile_views: analytics?.profile_views || 0,
          search_appearances: analytics?.search_appearances || 0,
          post_count: postList.length,
          updated_at: new Date().toISOString(),
        };

        for (const post of postList) {
          const impressions = post.impressions || 0;
          const reactions = post.reactions || 0;
          const comments = post.comments || 0;
          const reposts = post.reposts || 0;
          const saves = post.saves || 0;
          const sends = post.sends || 0;

          accountSnapshot.total_impressions += impressions;
          accountSnapshot.total_reactions += reactions;
          accountSnapshot.total_comments += comments;
          accountSnapshot.total_reposts += reposts;
          accountSnapshot.total_saves += saves;
          accountSnapshot.total_sends += sends;
          accountSnapshot.total_engagements += reactions + comments + reposts;
        }

        // Upsert account snapshot (same day = update, new day = insert)
        const { error: acctErr } = await supabase
          .from('daily_account_snapshots')
          .upsert(accountSnapshot, { onConflict: 'user_id,date' });

        if (acctErr) {
          logger.error('Failed to upsert account snapshot', { userId, error: acctErr });
        }

        // Upsert per-post snapshots
        if (postList.length > 0) {
          const postSnapshots = postList.map((post) => ({
            user_id: userId,
            activity_urn: post.activity_urn,
            date: today,
            impressions: post.impressions || 0,
            reactions: post.reactions || 0,
            comments: post.comments || 0,
            reposts: post.reposts || 0,
            saves: post.saves || 0,
            sends: post.sends || 0,
            engagements: (post.reactions || 0) + (post.comments || 0) + (post.reposts || 0),
            media_type: post.media_type,
            posted_at: post.posted_at,
            updated_at: new Date().toISOString(),
          }));

          const { error: postErr } = await supabase
            .from('daily_post_snapshots')
            .upsert(postSnapshots, { onConflict: 'user_id,activity_urn,date' });

          if (postErr) {
            logger.error('Failed to upsert post snapshots', { userId, error: postErr });
          }
        }

        processed++;
      });
    }

    logger.info('Daily snapshot pipeline complete', { processed, today });
    return { processed, date: today };
  }
);
```

- [ ] **Step 2: Register the function in Inngest client**

Open `lib/inngest/client.ts` and add the import + export:

Find the existing function exports/registrations and add:
```typescript
import { dailySnapshotPipeline } from './functions/daily-snapshot-pipeline';
```

Add `dailySnapshotPipeline` to the array of functions passed to `serve()` or exported for registration.

- [ ] **Step 3: Verify pipeline runs locally**

```bash
npx inngest-cli dev
```

Check the Inngest dashboard for the `daily-snapshot-pipeline` function. Trigger it manually and verify rows appear in `daily_account_snapshots` and `daily_post_snapshots`.

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/functions/daily-snapshot-pipeline.ts lib/inngest/client.ts
git commit -m "feat(pipeline): add daily snapshot pipeline for account and post snapshots"
```

---

## Task 3: Create v3 Analytics API (Account-Level)

**Files:**
- Create: `app/api/analytics/v3/route.ts`

- [ ] **Step 1: Write the account-level snapshot API**

```typescript
/**
 * Analytics V3 API - Account-level snapshot-based analytics
 *
 * Reads from daily_account_snapshots to return:
 * - Timeseries of absolute values OR day-over-day deltas
 * - Summary stats with % change vs previous period
 * - Only data from user's first snapshot date onward
 *
 * @param metric - The metric to query (impressions, reactions, comments, reposts, engagements, followers, profile_views, etc.)
 * @param period - Time period (7d, 30d, 90d, 1y, custom)
 * @param compare - Whether to include comparison period
 * @param mode - 'absolute' (raw values) or 'delta' (day-over-day change). Default: 'delta'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Map of metric names to daily_account_snapshots columns */
const METRIC_COLUMN_MAP: Record<string, string> = {
  impressions: 'total_impressions',
  reactions: 'total_reactions',
  comments: 'total_comments',
  reposts: 'total_reposts',
  saves: 'total_saves',
  sends: 'total_sends',
  engagements: 'total_engagements',
  followers: 'followers',
  connections: 'connections',
  profile_views: 'profile_views',
  search_appearances: 'search_appearances',
};

const VALID_METRICS = Object.keys(METRIC_COLUMN_MAP);

/**
 * Compute date range from period string
 * @param period - Period like '7d', '30d', '90d', '1y'
 * @param startDate - Custom start date
 * @param endDate - Custom end date
 * @returns [startDate, endDate] as ISO date strings
 */
function getDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): [string, string] {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  if (period === 'custom' && startDate) {
    start = new Date(startDate);
  } else {
    const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const d = days[period] || 30;
    start = new Date(end);
    start.setDate(start.getDate() - d);
  }

  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const metric = params.get('metric') || 'impressions';
  const period = params.get('period') || '30d';
  const compare = params.get('compare') === 'true';
  const mode = params.get('mode') || 'delta';
  const customStart = params.get('startDate') || undefined;
  const customEnd = params.get('endDate') || undefined;

  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 });
  }

  const column = METRIC_COLUMN_MAP[metric];
  const [startDate, endDate] = getDateRange(period, customStart, customEnd);

  // Also compute comparison period (same length, immediately before)
  const periodDays = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const compStart = new Date(startDate);
  compStart.setDate(compStart.getDate() - periodDays);
  const compStartStr = compStart.toISOString().split('T')[0];

  // Fetch snapshots for current + comparison period in one query
  const { data: snapshots, error: snapErr } = await supabase
    .from('daily_account_snapshots')
    .select(`date, ${column}`)
    .eq('user_id', user.id)
    .gte('date', compare ? compStartStr : startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (snapErr) {
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }

  const rows = snapshots || [];

  // Split into current and comparison periods
  const currentRows = rows.filter((r) => r.date >= startDate && r.date <= endDate);
  const compRows = compare
    ? rows.filter((r) => r.date >= compStartStr && r.date < startDate)
    : [];

  /**
   * Compute timeseries from snapshot rows
   * In delta mode: value = today's snapshot - yesterday's snapshot
   * In absolute mode: value = today's snapshot
   */
  function buildTimeseries(data: typeof rows): { date: string; value: number }[] {
    if (mode === 'absolute') {
      return data.map((r) => ({ date: r.date, value: r[column] as number }));
    }

    // Delta mode: compute day-over-day change
    const result: { date: string; value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      const current = data[i][column] as number;
      if (i === 0) {
        // First day: check if there's a previous-day snapshot for context
        const prevRow = rows.find(
          (r) => r.date < data[0].date
        );
        const prev = prevRow ? (prevRow[column] as number) : current;
        result.push({ date: data[i].date, value: current - prev });
      } else {
        const prev = data[i - 1][column] as number;
        result.push({ date: data[i].date, value: current - prev });
      }
    }
    return result;
  }

  const currentTimeseries = buildTimeseries(currentRows);
  const compTimeseries = compare ? buildTimeseries(compRows) : null;

  // Compute summary
  const currentSum = currentTimeseries.reduce((sum, p) => sum + p.value, 0);
  const currentAvg = currentTimeseries.length > 0 ? currentSum / currentTimeseries.length : 0;

  const compSum = compTimeseries ? compTimeseries.reduce((sum, p) => sum + p.value, 0) : 0;

  const pctChange =
    compare && compSum !== 0 ? ((currentSum - compSum) / Math.abs(compSum)) * 100 : 0;

  // Accumulative total = latest snapshot's absolute value
  const latestSnapshot = currentRows[currentRows.length - 1];
  const accumulativeTotal = latestSnapshot ? (latestSnapshot[column] as number) : 0;

  return NextResponse.json({
    current: currentTimeseries,
    comparison: compTimeseries,
    summary: {
      total: currentSum,
      average: Math.round(currentAvg * 100) / 100,
      change: Math.round(pctChange * 100) / 100,
      compCount: compTimeseries?.length || 0,
      accumulativeTotal,
    },
  });
}
```

- [ ] **Step 2: Verify the endpoint works**

Start dev server and test:
```bash
curl "http://localhost:3000/api/analytics/v3?metric=impressions&period=7d"
```

Expected: JSON with `current`, `comparison`, `summary` fields.

- [ ] **Step 3: Commit**

```bash
git add app/api/analytics/v3/route.ts
git commit -m "feat(api): add v3 account-level snapshot analytics endpoint"
```

---

## Task 4: Create v3 Analytics API (Post-Level)

**Files:**
- Create: `app/api/analytics/v3/posts/route.ts`

- [ ] **Step 1: Write the post-level snapshot API**

```typescript
/**
 * Analytics V3 Posts API - Per-post snapshot-based analytics
 *
 * Returns per-post timeseries or a specific post's daily snapshots.
 * Used for drill-down and engagement breakdown charts.
 *
 * @param metric - The metric (impressions, reactions, comments, reposts, engagements)
 * @param period - Time period
 * @param activity_urn - Optional: filter to specific post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_METRICS = ['impressions', 'reactions', 'comments', 'reposts', 'saves', 'sends', 'engagements'];

/**
 * Compute date range from period string
 */
function getDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): [string, string] {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  if (period === 'custom' && startDate) {
    start = new Date(startDate);
  } else {
    const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const d = days[period] || 30;
    start = new Date(end);
    start.setDate(start.getDate() - d);
  }

  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const metric = params.get('metric') || 'impressions';
  const period = params.get('period') || '30d';
  const activityUrn = params.get('activity_urn') || null;
  const contentType = params.get('contentType') || 'all';
  const customStart = params.get('startDate') || undefined;
  const customEnd = params.get('endDate') || undefined;

  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 });
  }

  const [startDate, endDate] = getDateRange(period, customStart, customEnd);

  // Build query
  let query = supabase
    .from('daily_post_snapshots')
    .select('date, activity_urn, impressions, reactions, comments, reposts, saves, sends, engagements, media_type')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (activityUrn) {
    query = query.eq('activity_urn', activityUrn);
  }

  if (contentType !== 'all') {
    query = query.eq('media_type', contentType);
  }

  const { data: snapshots, error: snapErr } = await query;

  if (snapErr) {
    return NextResponse.json({ error: 'Failed to fetch post snapshots' }, { status: 500 });
  }

  const rows = snapshots || [];

  // Group by date: aggregate all posts' metrics per day for engagement breakdown
  const dateMap = new Map<string, {
    date: string;
    impressions: number;
    reactions: number;
    comments: number;
    reposts: number;
    saves: number;
    sends: number;
    engagements: number;
  }>();

  for (const row of rows) {
    const existing = dateMap.get(row.date) || {
      date: row.date,
      impressions: 0,
      reactions: 0,
      comments: 0,
      reposts: 0,
      saves: 0,
      sends: 0,
      engagements: 0,
    };

    existing.impressions += row.impressions || 0;
    existing.reactions += row.reactions || 0;
    existing.comments += row.comments || 0;
    existing.reposts += row.reposts || 0;
    existing.saves += row.saves || 0;
    existing.sends += row.sends || 0;
    existing.engagements += row.engagements || 0;

    dateMap.set(row.date, existing);
  }

  const aggregated = Array.from(dateMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Compute deltas (day-over-day change)
  const deltas = aggregated.map((day, i) => {
    if (i === 0) {
      return { ...day, delta: 0 };
    }
    const prev = aggregated[i - 1];
    return {
      ...day,
      delta: day[metric as keyof typeof day] as number - (prev[metric as keyof typeof prev] as number),
    };
  });

  return NextResponse.json({
    timeseries: deltas,
    // Raw per-post data for drill-down
    posts: activityUrn ? rows : undefined,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/analytics/v3/posts/route.ts
git commit -m "feat(api): add v3 per-post snapshot analytics endpoint"
```

---

## Task 5: Create v3 Analytics Hook

**Files:**
- Create: `hooks/use-analytics-v3.ts`

- [ ] **Step 1: Write the hook**

```typescript
/**
 * useAnalyticsV3 - React hook for snapshot-based analytics
 *
 * Fetches data from /api/analytics/v3 (account-level) and
 * /api/analytics/v3/posts (for engagement breakdown).
 *
 * @param filters - Filter configuration
 * @returns Analytics data, summary, comparison data, and loading state
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** Filter configuration for analytics queries */
export interface AnalyticsV3Filters {
  metric: string;
  period: string;
  startDate?: string;
  endDate?: string;
  contentType: string;
  compare: boolean;
  granularity: string;
}

/** Single data point in a timeseries */
export interface AnalyticsDataPoint {
  date: string;
  value: number;
}

/** Summary statistics for a metric */
export interface AnalyticsSummary {
  total: number;
  average: number;
  change: number;
  accumulativeTotal?: number;
  compCount?: number;
}

/** Engagement breakdown data point (all metrics per day) */
export interface EngagementDataPoint {
  date: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  engagements: number;
  delta: number;
}

/** Multi-metric data for "all" mode */
export type MultiMetricData = Record<string, AnalyticsDataPoint[]>;

export interface UseAnalyticsV3Return {
  data: AnalyticsDataPoint[];
  summary: AnalyticsSummary | null;
  comparisonData: AnalyticsDataPoint[] | null;
  multiData: MultiMetricData | null;
  engagementBreakdown: EngagementDataPoint[];
  isLoading: boolean;
  error: string | null;
}

const ALL_MODE_METRICS = ['impressions', 'reactions', 'comments', 'reposts', 'engagements'];

/**
 * Build URL search params from filters
 */
function buildParams(filters: AnalyticsV3Filters, metricOverride?: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set('metric', metricOverride || filters.metric);
  p.set('period', filters.period);
  p.set('compare', String(filters.compare));
  if (filters.contentType !== 'all') p.set('contentType', filters.contentType);
  if (filters.period === 'custom' && filters.startDate) p.set('startDate', filters.startDate);
  if (filters.period === 'custom' && filters.endDate) p.set('endDate', filters.endDate);
  return p;
}

export function useAnalyticsV3(filters: AnalyticsV3Filters): UseAnalyticsV3Return {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [comparisonData, setComparisonData] = useState<AnalyticsDataPoint[] | null>(null);
  const [multiData, setMultiData] = useState<MultiMetricData | null>(null);
  const [engagementBreakdown, setEngagementBreakdown] = useState<EngagementDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const isAllMode = filters.metric === 'all';

      if (isAllMode) {
        // Fetch all 5 metrics in parallel
        const results = await Promise.all(
          ALL_MODE_METRICS.map(async (m) => {
            const params = buildParams(filters, m);
            const res = await fetch(`/api/analytics/v3?${params}`, { signal: controller.signal });
            if (!res.ok) throw new Error(`Failed to fetch ${m}`);
            return { metric: m, data: await res.json() };
          })
        );

        const multi: MultiMetricData = {};
        for (const r of results) {
          multi[r.metric] = r.data.current || [];
        }
        setMultiData(multi);
        setData([]);
        setSummary(null);
        setComparisonData(null);
      } else {
        // Single metric
        const params = buildParams(filters);
        const res = await fetch(`/api/analytics/v3?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();

        setData(json.current || []);
        setSummary(json.summary || null);
        setComparisonData(json.comparison || null);
        setMultiData(null);
      }

      // Always fetch engagement breakdown for charts section
      const engParams = new URLSearchParams();
      engParams.set('metric', 'engagements');
      engParams.set('period', filters.period);
      if (filters.contentType !== 'all') engParams.set('contentType', filters.contentType);
      if (filters.period === 'custom' && filters.startDate) engParams.set('startDate', filters.startDate);
      if (filters.period === 'custom' && filters.endDate) engParams.set('endDate', filters.endDate);

      const engRes = await fetch(`/api/analytics/v3/posts?${engParams}`, { signal: controller.signal });
      if (engRes.ok) {
        const engJson = await engRes.json();
        setEngagementBreakdown(engJson.timeseries || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  return { data, summary, comparisonData, multiData, engagementBreakdown, isLoading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-analytics-v3.ts
git commit -m "feat(hooks): add useAnalyticsV3 hook for snapshot-based analytics"
```

---

## Task 6: Update Analytics Page to Use v3

**Files:**
- Modify: `app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Replace v2 hook with v3**

In `app/dashboard/analytics/page.tsx`, change the import and usage:

Replace:
```typescript
import { useAnalyticsV2, type AnalyticsV2Filters } from '@/hooks/use-analytics-v2';
```

With:
```typescript
import { useAnalyticsV3, type AnalyticsV3Filters } from '@/hooks/use-analytics-v3';
```

Replace the hook call:
```typescript
const { data, summary, comparisonData, multiData, isLoading, error } = useAnalyticsV2(filters);
```

With:
```typescript
const { data, summary, comparisonData, multiData, engagementBreakdown, isLoading, error } = useAnalyticsV3(filters);
```

Update the type references from `AnalyticsV2Filters` to `AnalyticsV3Filters`.

Pass `engagementBreakdown` to `AnalyticsChartsSection`:
```tsx
<AnalyticsChartsSection
  userId={user?.id}
  isLoading={isLoading}
  engagementBreakdown={engagementBreakdown}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/analytics/page.tsx
git commit -m "feat(analytics): wire up v3 snapshot-based analytics hook"
```

---

## Task 7: Fix Engagement Breakdown Chart

**Files:**
- Modify: `components/features/analytics-charts.tsx`

- [ ] **Step 1: Update AnalyticsChartsSection to accept engagement data**

The current `AnalyticsChartsSection` fetches `my_posts` directly and groups by `posted_at` (the date the post was published). This is wrong — it shows historical data from before the user joined the platform.

Change the component to accept pre-computed engagement breakdown data from the v3 API, which is keyed by **snapshot date** (the date data was captured).

Update the props interface:
```typescript
interface AnalyticsChartsSectionProps {
  userId: string | undefined;
  isLoading: boolean;
  engagementBreakdown?: EngagementDataPoint[];
}
```

Add the import:
```typescript
import type { EngagementDataPoint } from '@/hooks/use-analytics-v3';
```

Replace the `computeEngagementTimeline` function. Instead of grouping `my_posts` by `posted_at` week, use the `engagementBreakdown` prop directly and group by week:

```typescript
const engagementByWeek = useMemo(() => {
  if (!engagementBreakdown || engagementBreakdown.length === 0) return [];

  const weekMap = new Map<string, {
    weekStart: string;
    reactions: number;
    comments: number;
    reposts: number;
    saves: number;
  }>();

  for (const day of engagementBreakdown) {
    const d = new Date(day.date);
    // Get Monday of this week
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const weekKey = monday.toISOString().split('T')[0];

    const existing = weekMap.get(weekKey) || {
      weekStart: weekKey,
      reactions: 0,
      comments: 0,
      reposts: 0,
      saves: 0,
    };

    existing.reactions += day.reactions;
    existing.comments += day.comments;
    existing.reposts += day.reposts;
    existing.saves += day.saves + day.sends;

    weekMap.set(weekKey, existing);
  }

  return Array.from(weekMap.values()).sort(
    (a, b) => a.weekStart.localeCompare(b.weekStart)
  );
}, [engagementBreakdown]);
```

Update the Engagement Breakdown chart render to use `engagementByWeek` instead of the old `computeEngagementTimeline()` result.

For the other 3 charts (Posting Frequency, Content Performance, Best Days), these can continue using `my_posts` data since they're about post metadata — but filter to only show posts that have snapshot data (i.e., posts captured since the user joined):

Add a filter at the top of each compute function:
```typescript
// Only include posts captured since user started using the platform
const relevantPosts = posts.filter(p => /* post exists in snapshot data */);
```

Or simpler: keep using `my_posts` for these 3 charts since they show metadata about the user's posts (frequency, content types, best days) which is valid regardless of when they joined.

- [ ] **Step 2: Commit**

```bash
git add components/features/analytics-charts.tsx
git commit -m "fix(charts): use snapshot dates for engagement breakdown instead of posted_at"
```

---

## Task 8: Update Summary Bar and Data Table

**Files:**
- Modify: `components/features/analytics-summary-bar.tsx`
- Modify: `components/features/analytics-data-table.tsx`

- [ ] **Step 1: Update summary bar**

The summary bar already receives `summary` as a prop and displays `total`, `average`, `change`, `accumulativeTotal`. The v3 API returns the same shape, so this component should work without changes.

Verify the prop types are compatible. If `AnalyticsSummary` is imported from `use-analytics-v2`, update the import to `use-analytics-v3`:

```typescript
import type { AnalyticsSummary } from '@/hooks/use-analytics-v3';
```

- [ ] **Step 2: Update data table**

The data table receives `data: AnalyticsDataPoint[]` and renders it. The v3 API returns the same `{ date, value }` shape for timeseries data.

Update imports if needed:
```typescript
import type { AnalyticsDataPoint, MultiMetricData } from '@/hooks/use-analytics-v3';
```

The data table should now show snapshot-date-based data (starting from when the user first captured data), not historical dates.

- [ ] **Step 3: Commit**

```bash
git add components/features/analytics-summary-bar.tsx components/features/analytics-data-table.tsx
git commit -m "refactor(analytics): update summary bar and data table to use v3 types"
```

---

## Task 9: Backfill Today's Snapshots

**Files:** None (database operation only)

- [ ] **Step 1: Trigger initial snapshot**

After deploying, manually trigger the daily-snapshot-pipeline via Inngest dashboard, or run this SQL to bootstrap from existing data:

```sql
-- Backfill daily_account_snapshots from current my_posts + linkedin_profiles + linkedin_analytics
INSERT INTO daily_account_snapshots (user_id, date, total_impressions, total_reactions, total_comments, total_reposts, total_saves, total_sends, total_engagements, followers, connections, profile_views, search_appearances, post_count, updated_at)
SELECT
  p.user_id,
  CURRENT_DATE,
  COALESCE(SUM(mp.impressions), 0),
  COALESCE(SUM(mp.reactions), 0),
  COALESCE(SUM(mp.comments), 0),
  COALESCE(SUM(mp.reposts), 0),
  COALESCE(SUM(mp.saves), 0),
  COALESCE(SUM(mp.sends), 0),
  COALESCE(SUM(mp.reactions), 0) + COALESCE(SUM(mp.comments), 0) + COALESCE(SUM(mp.reposts), 0),
  COALESCE(p.followers_count, 0),
  COALESCE(p.connections_count, 0),
  COALESCE(MAX(la.profile_views), 0),
  COALESCE(MAX(la.search_appearances), 0),
  COUNT(mp.id),
  now()
FROM linkedin_profiles p
LEFT JOIN my_posts mp ON mp.user_id = p.user_id
LEFT JOIN linkedin_analytics la ON la.user_id = p.user_id
GROUP BY p.user_id, p.followers_count, p.connections_count
ON CONFLICT (user_id, date) DO UPDATE SET
  total_impressions = EXCLUDED.total_impressions,
  total_reactions = EXCLUDED.total_reactions,
  total_comments = EXCLUDED.total_comments,
  total_reposts = EXCLUDED.total_reposts,
  total_saves = EXCLUDED.total_saves,
  total_sends = EXCLUDED.total_sends,
  total_engagements = EXCLUDED.total_engagements,
  followers = EXCLUDED.followers,
  connections = EXCLUDED.connections,
  profile_views = EXCLUDED.profile_views,
  search_appearances = EXCLUDED.search_appearances,
  post_count = EXCLUDED.post_count,
  updated_at = now();
```

- [ ] **Step 2: Backfill daily_post_snapshots**

```sql
INSERT INTO daily_post_snapshots (user_id, activity_urn, date, impressions, reactions, comments, reposts, saves, sends, engagements, media_type, posted_at, updated_at)
SELECT
  user_id,
  activity_urn,
  CURRENT_DATE,
  COALESCE(impressions, 0),
  COALESCE(reactions, 0),
  COALESCE(comments, 0),
  COALESCE(reposts, 0),
  COALESCE(saves, 0),
  COALESCE(sends, 0),
  COALESCE(reactions, 0) + COALESCE(comments, 0) + COALESCE(reposts, 0),
  media_type,
  posted_at,
  now()
FROM my_posts
ON CONFLICT (user_id, activity_urn, date) DO UPDATE SET
  impressions = EXCLUDED.impressions,
  reactions = EXCLUDED.reactions,
  comments = EXCLUDED.comments,
  reposts = EXCLUDED.reposts,
  saves = EXCLUDED.saves,
  sends = EXCLUDED.sends,
  engagements = EXCLUDED.engagements,
  updated_at = now();
```

- [ ] **Step 3: Verify data**

```sql
SELECT * FROM daily_account_snapshots ORDER BY date DESC LIMIT 5;
SELECT * FROM daily_post_snapshots ORDER BY date DESC LIMIT 10;
```

- [ ] **Step 4: Commit** (no code changes, just verification)

---

## Task 10: Build Verification and Cleanup

**Files:** All modified files

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Fix any TypeScript errors.

- [ ] **Step 2: Verify the full flow**

1. Open the analytics page in the browser
2. Confirm the trend chart shows data starting from today (first snapshot date)
3. Confirm engagement breakdown uses capture dates, not post publication dates
4. Confirm summary bar shows correct totals and % change
5. Confirm data table shows snapshot-date-based rows
6. Wait 5 minutes for the pipeline to run again — verify the same day's row gets UPDATED (not a new row)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(analytics): complete v3 snapshot-based analytics pipeline"
```
