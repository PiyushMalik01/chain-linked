/**
 * Inngest API Route Handler
 * @description Webhook handler for Inngest background job processing
 * @module app/api/inngest/route
 */

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  analyzeCompanyWorkflow,
  deepResearchWorkflow,
  generateSuggestionsWorkflow,
  suggestionsReadyHandler,
  dailyContentIngest,
  onDemandContentIngest,
  swipeAutoRefill,
  analyticsPipeline,
  analyticsSummaryCompute,
  analyticsBackfill,
  firstSyncBackfill,
  templateAutoGenerate,
  influencerPostScrape,
  viralPostIngest,
  publishScheduledPosts,
  dailySnapshotPipeline,
} from '@/lib/inngest/functions'

/**
 * Inngest serve handler
 * Exposes all workflow functions to Inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeCompanyWorkflow,
    deepResearchWorkflow,
    generateSuggestionsWorkflow,
    suggestionsReadyHandler,
    dailyContentIngest,
    onDemandContentIngest,
    swipeAutoRefill,
    analyticsPipeline,
    analyticsSummaryCompute,
    analyticsBackfill,
    firstSyncBackfill,
    templateAutoGenerate,
    influencerPostScrape,
    viralPostIngest,
    publishScheduledPosts,
    dailySnapshotPipeline,
  ],
})
