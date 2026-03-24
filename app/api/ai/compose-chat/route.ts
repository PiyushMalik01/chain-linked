/**
 * Compose Chat Streaming API Route
 * @description Streaming chat endpoint for the advanced compose mode.
 * Uses Vercel AI SDK with OpenRouter to provide a conversational
 * post generation experience with tool calls (MCQ options + post generation).
 * Fetches rich user context: profile, company, brand, top posts.
 * @module app/api/ai/compose-chat/route
 */

import { streamText, tool, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildComposeConversationPrompt } from '@/lib/ai/compose-system-prompt'
import { trackAIEvent } from '@/lib/posthog-server'
import { PromptService } from '@/lib/prompts/prompt-service'
import { PromptType } from '@/lib/prompts/prompt-types'

/**
 * Safely parses a JSON column value into a string array
 * @param value - JSON column value (could be string, array, null)
 * @returns Array of strings
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
    } catch { /* ignore */ }
  }
  return []
}

/**
 * Fetches comprehensive user context from Supabase for prompt personalization
 * @param userId - Authenticated user ID
 * @param tone - Selected tone for style matching
 * @returns Rich user context object
 */
async function getUserContext(userId: string, tone?: string) {
  try {
    const supabase = await createClient()

    const postLimit = tone === 'match-my-style' ? 20 : 10

    // Fetch all context in parallel
    const [
      { data: linkedinProfile },
      { data: userProfile },
      { data: companyContext },
      { data: recentPosts },
      { data: topPosts },
    ] = await Promise.all([
      // LinkedIn profile data
      supabase
        .from('linkedin_profiles')
        .select('first_name, last_name, headline, industry, summary')
        .eq('user_id', userId)
        .single(),

      // User profile with company onboarding data
      supabase
        .from('profiles')
        .select('company_name, company_description, company_products, company_icp, company_value_props')
        .eq('id', userId)
        .single(),

      // Detailed company context from onboarding
      supabase
        .from('company_context')
        .select('company_name, company_summary, industry, value_proposition, products_and_services, target_audience, tone_of_voice')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .single(),

      // Recent posts for style reference
      supabase
        .from('my_posts')
        .select('content')
        .eq('user_id', userId)
        .order('posted_at', { ascending: false })
        .limit(postLimit),

      // Top-performing posts by engagement
      supabase
        .from('my_posts')
        .select('content, impressions, reactions, comments')
        .eq('user_id', userId)
        .not('content', 'is', null)
        .not('impressions', 'is', null)
        .order('impressions', { ascending: false })
        .limit(5),
    ])

    const fullName = linkedinProfile
      ? [linkedinProfile.first_name, linkedinProfile.last_name].filter(Boolean).join(' ') || undefined
      : undefined

    // Build company info from company_context (preferred) or profiles fallback
    const companyName = companyContext?.company_name || userProfile?.company_name || undefined
    const companyDescription = companyContext?.company_summary || userProfile?.company_description || undefined
    const productsAndServices = companyContext?.products_and_services
      ? parseJsonArray(companyContext.products_and_services)
      : userProfile?.company_products
        ? [userProfile.company_products]
        : []
    const targetAudience = companyContext?.target_audience
      ? parseJsonArray(companyContext.target_audience)
      : userProfile?.company_icp
        ? [userProfile.company_icp]
        : []
    const valuePropositions = companyContext?.value_proposition
      ? [companyContext.value_proposition]
      : userProfile?.company_value_props
        ? [userProfile.company_value_props]
        : []
    const toneOfVoice = companyContext?.tone_of_voice
      ? parseJsonArray(companyContext.tone_of_voice)
      : []

    // Process recent posts
    const recentPostsText = recentPosts
      ?.map((p) => p.content)
      .filter((c): c is string => !!c && c.length > 20)
      .map((c) => {
        const limit = tone === 'match-my-style' ? 500 : 300
        return c.length > limit ? c.slice(0, limit) + '...' : c
      }) || []

    // Process top-performing posts
    const topPerformingPosts = topPosts
      ?.filter((p) => p.content && p.content.length > 20 && (p.impressions || 0) > 0)
      .map((p) => ({
        content: p.content!.length > 500 ? p.content!.slice(0, 500) + '...' : p.content!,
        impressions: p.impressions || 0,
        reactions: p.reactions || 0,
        comments: p.comments || 0,
      })) || []

    return {
      name: fullName,
      headline: linkedinProfile?.headline ?? undefined,
      industry: companyContext?.industry || linkedinProfile?.industry || undefined,
      summary: linkedinProfile?.summary
        ? (linkedinProfile.summary.length > 300 ? linkedinProfile.summary.slice(0, 300) + '...' : linkedinProfile.summary)
        : undefined,
      companyName,
      companyDescription,
      productsAndServices: productsAndServices.length > 0 ? productsAndServices : undefined,
      targetAudience: targetAudience.length > 0 ? targetAudience : undefined,
      valuePropositions: valuePropositions.length > 0 ? valuePropositions : undefined,
      toneOfVoice: toneOfVoice.length > 0 ? toneOfVoice : undefined,
      recentPostsText: recentPostsText.length > 0 ? recentPostsText : undefined,
      topPerformingPosts: topPerformingPosts.length > 0 ? topPerformingPosts : undefined,
    }
  } catch (error) {
    console.error('Failed to fetch user context:', error)
    return {}
  }
}

/**
 * POST /api/ai/compose-chat
 * Streaming chat endpoint for advanced compose mode
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { messages, tone = 'professional' } = body as {
      messages: UIMessage[]
      tone?: string
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userContext = await getUserContext(user.id, tone)
    let systemPrompt = buildComposeConversationPrompt(userContext, tone)

    // Inject active content rules from database (non-blocking)
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

      const allRules = [...teamRules, ...(personalRules || [])]
      if (allRules.length > 0) {
        systemPrompt += `\n\n## MANDATORY Content Rules\nThe following rules MUST be followed in all generated content:\n${allRules.map(r => `- ${r.rule_text}`).join('\n')}`
      }
    } catch {
      // Content rules injection is non-blocking
    }

    const provider = createOpenAICompatible({
      name: 'openrouter',
      apiKey: openRouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const tools = {
      presentOptions: tool({
        description: 'Present multiple choice options to the user for clarification. Always include a final option that lets the user type their own answer.',
        inputSchema: z.object({
          question: z.string().describe('The clarifying question to ask'),
          options: z.array(z.object({
            id: z.string().describe('Unique option identifier'),
            label: z.string().describe('Short option label'),
            description: z.string().optional().describe('Optional longer description'),
          })).describe('The options to present (3-4 specific options)'),
        }),
        execute: async ({ question, options }) => ({ question, options }),
      }),
      generatePost: tool({
        description: 'Generate the final LinkedIn post content',
        inputSchema: z.object({
          post: z.string().describe('The complete LinkedIn post content'),
          summary: z.string().describe('Brief summary of what was generated'),
        }),
        execute: async ({ post, summary }) => ({ post, summary }),
      }),
    }

    // Track AI generation start
    try { trackAIEvent(user.id, 'ai_generation_started', { feature: 'compose-chat', tone, message_count: messages.length }) } catch {}

    const startTime = Date.now()

    const result = streamText({
      model: provider('openai/gpt-4.1'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      temperature: 0.8,
      maxOutputTokens: 2000,
      tools,
      stopWhen: stepCountIs(8),
      onFinish: async ({ usage, text }) => {
        const responseTimeMs = Date.now() - startTime
        const inputTokens = usage?.inputTokens ?? 0
        const outputTokens = usage?.outputTokens ?? 0
        const totalTokens = inputTokens + outputTokens

        // Calculate cost: gpt-4.1 pricing
        const estimatedCost = (inputTokens * 0.002 + outputTokens * 0.008) / 1000

        try {
          await PromptService.logUsage({
            promptType: PromptType.BASE_RULES,
            promptVersion: 1,
            userId: user.id,
            feature: 'compose',
            inputTokens,
            outputTokens,
            totalTokens,
            model: 'openai/gpt-4.1',
            responseTimeMs,
            success: true,
            estimatedCost,
            metadata: {
              tone,
              message_count: messages.length,
            },
          })
        } catch (logError) {
          console.error('[ComposeChat] Failed to log usage:', logError)
        }

        try { trackAIEvent(user.id, 'ai_generation_completed', { feature: 'compose-chat', tone, message_count: messages.length, model: 'openai/gpt-4.1', tokens: totalTokens, response_time_ms: responseTimeMs }) } catch {}
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Compose chat error:', error)

    Sentry.captureException(error, {
      tags: { feature: 'compose-chat', model: 'openai/gpt-4.1' },
    })

    // Track AI generation failure
    try { trackAIEvent('anonymous', 'ai_generation_failed', { feature: 'compose-chat', error: error instanceof Error ? error.message : 'Unknown error' }) } catch {}

    return new Response(
      JSON.stringify({ error: 'Failed to process chat message.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
