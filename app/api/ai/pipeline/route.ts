/**
 * Post-Generation Pipeline API Route
 * @description Standalone endpoint to run the post-generation pipeline (verification,
 * fact-checking, and auto-refinement) on an existing post. Useful for re-running the
 * pipeline on edited content without regenerating the post.
 * @module app/api/ai/pipeline/route
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { resolveApiKey } from '@/lib/ai/resolve-api-key'
import { PostPipeline, DEFAULT_PIPELINE_CONFIG } from '@/lib/ai/pipeline'
import { PromptService, PromptType } from '@/lib/prompts'

/**
 * Request body schema for the pipeline endpoint
 */
interface PipelineRequest {
  /** The post content to process through the pipeline */
  content: string
  /** Whether to run content rules verification (default: true) */
  enableVerification?: boolean
  /** Whether to run fact-checking (default: true) */
  enableFactCheck?: boolean
  /** Whether to auto-refine if issues are found (default: true) */
  enableAutoRefine?: boolean
  /** User's OpenRouter API key (optional, falls back to env) */
  apiKey?: string
}

/**
 * POST /api/ai/pipeline
 * Runs the post-generation pipeline on provided content.
 * Requires authentication. Fetches content rules from the database.
 *
 * @param request - The incoming Next.js request containing a PipelineRequest JSON body
 * @returns JSON response with shape `{ pipeline: PipelineResult }` on success,
 *   or `{ error: string }` with an appropriate HTTP status on failure
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const body = (await request.json()) as PipelineRequest
    const { content, enableVerification, enableFactCheck, enableAutoRefine, apiKey } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Get API key — pipeline always runs via OpenRouter (it creates its own client)
    let openAIApiKey = apiKey?.trim() || undefined
    if (!openAIApiKey) {
      const resolved = await resolveApiKey(supabase, user.id)
      if (resolved?.provider === 'openai-oauth') {
        // Codex access_token can't be used with the pipeline (OpenRouter-only)
        openAIApiKey = process.env.OPENROUTER_API_KEY
      } else {
        openAIApiKey = resolved?.apiKey
      }
    }
    if (!openAIApiKey) {
      return NextResponse.json(
        { error: 'No API key found. Connect your ChatGPT account in Settings or set OPENROUTER_API_KEY in environment.' },
        { status: 400 }
      )
    }

    // Fetch content rules (personal + team, same pattern as generate route)
    let contentRules: string[] = []
    try {
      const [{ data: personalRules }, { data: teamMember }] = await Promise.all([
        supabase
          .from('content_rules')
          .select('rule_text')
          .eq('user_id', user.id)
          .is('team_id', null)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
        supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1),
      ])

      let teamRules: { rule_text: string }[] = []
      if (teamMember?.[0]?.team_id) {
        const { data } = await supabase
          .from('content_rules')
          .select('rule_text')
          .eq('team_id', teamMember[0].team_id)
          .eq('is_active', true)
          .order('priority', { ascending: false })
        teamRules = data || []
      }

      contentRules = [...teamRules, ...(personalRules || [])].map((r) => r.rule_text)
    } catch {
      // Content rules fetch is non-blocking
    }

    // Run pipeline
    const pipeline = new PostPipeline({
      ...DEFAULT_PIPELINE_CONFIG,
      enableVerification: enableVerification ?? DEFAULT_PIPELINE_CONFIG.enableVerification,
      enableFactCheck: enableFactCheck ?? DEFAULT_PIPELINE_CONFIG.enableFactCheck,
      enableAutoRefine: enableAutoRefine ?? DEFAULT_PIPELINE_CONFIG.enableAutoRefine,
      apiKey: openAIApiKey,
      contentRules,
    })

    const result = await pipeline.run(content)

    // Log pipeline usage (non-blocking)
    // PipelineResult exposes steps[] with durationMs but no per-step token counts,
    // so we log execution metadata without token breakdown.
    PromptService.logUsage({
      promptType: PromptType.BASE_RULES,
      promptVersion: 1,
      userId: user.id,
      feature: 'pipeline',
      model: 'openai/gpt-5.4',
      success: true,
      metadata: {
        provider: 'openrouter',
        enableVerification: enableVerification ?? true,
        enableFactCheck: enableFactCheck ?? true,
        enableAutoRefine: enableAutoRefine ?? true,
        totalDurationMs: result.totalDurationMs,
        totalIssues: result.totalIssues,
        wasRefined: result.wasRefined,
        stepsRun: result.steps.map(s => s.stage),
      },
    }).catch(() => {})

    return NextResponse.json({ pipeline: result })
  } catch (error) {
    console.error('[Pipeline API] Error:', error)
    Sentry.captureException(error, {
      tags: { feature: 'pipeline' },
    })

    return NextResponse.json(
      { error: 'Pipeline processing failed. Please try again.' },
      { status: 500 }
    )
  }
}
