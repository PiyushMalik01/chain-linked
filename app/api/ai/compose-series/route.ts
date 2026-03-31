/**
 * Compose Series Chat Streaming API Route
 * @description Streaming chat endpoint for the post series compose mode.
 * Uses Vercel AI SDK with OpenRouter to provide a conversational
 * series generation experience with tool calls (MCQ options + series generation).
 * @module app/api/ai/compose-series/route
 */

import { streamText, tool, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resolveApiKey } from '@/lib/ai/resolve-api-key'
import { buildSeriesConversationPrompt } from '@/lib/ai/series-system-prompt'

/**
 * Safely parses a JSON column value into a string array
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
 * Fetches comprehensive user context from Supabase
 */
async function getUserContext(userId: string, tone?: string) {
  try {
    const supabase = await createClient()

    const postLimit = tone === 'match-my-style' ? 20 : 10

    const [
      { data: linkedinProfile },
      { data: userProfile },
      { data: companyContext },
      { data: recentPosts },
      { data: topPosts },
    ] = await Promise.all([
      supabase
        .from('linkedin_profiles')
        .select('first_name, last_name, headline, industry, summary')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('profiles')
        .select('company_name, company_description, company_products, company_icp, company_value_props')
        .eq('id', userId)
        .single(),
      supabase
        .from('company_context')
        .select('company_name, company_summary, industry, value_proposition, products_and_services, target_audience, tone_of_voice')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .single(),
      supabase
        .from('my_posts')
        .select('content')
        .eq('user_id', userId)
        .order('posted_at', { ascending: false })
        .limit(postLimit),
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

    const companyName = companyContext?.company_name || userProfile?.company_name || undefined
    const companyDescription = companyContext?.company_summary || userProfile?.company_description || undefined
    const productsAndServices = companyContext?.products_and_services
      ? parseJsonArray(companyContext.products_and_services)
      : userProfile?.company_products ? [userProfile.company_products] : []
    const targetAudience = companyContext?.target_audience
      ? parseJsonArray(companyContext.target_audience)
      : userProfile?.company_icp ? [userProfile.company_icp] : []
    const valuePropositions = companyContext?.value_proposition
      ? [companyContext.value_proposition]
      : userProfile?.company_value_props ? [userProfile.company_value_props] : []
    const toneOfVoice = companyContext?.tone_of_voice
      ? parseJsonArray(companyContext.tone_of_voice)
      : []

    const recentPostsText = recentPosts
      ?.map((p) => p.content)
      .filter((c): c is string => !!c && c.length > 20)
      .map((c) => {
        const limit = tone === 'match-my-style' ? 500 : 300
        return c.length > limit ? c.slice(0, limit) + '...' : c
      }) || []

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
 * POST /api/ai/compose-series
 * Streaming chat endpoint for series compose mode
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

    const resolved = await resolveApiKey(supabase, user.id)
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: 'No API key found. Connect your ChatGPT account in Settings or set OPENROUTER_API_KEY in environment.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const aiApiKey = resolved.apiKey
    const isOpenAIDirect = resolved.provider === 'openai-direct'

    const userContext = await getUserContext(user.id, tone)
    let systemPrompt = buildSeriesConversationPrompt(userContext, tone)

    // Inject content rules
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
      name: isOpenAIDirect ? 'openai' : 'openrouter',
      apiKey: aiApiKey,
      baseURL: isOpenAIDirect ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1',
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
      generateSeries: tool({
        description: 'Generate a series of LinkedIn posts around a central theme',
        inputSchema: z.object({
          posts: z.array(z.object({
            post: z.string().describe('The complete LinkedIn post content'),
            subtopic: z.string().describe('The subtopic this post covers'),
            summary: z.string().describe('Brief summary of the post'),
          })).max(5).describe('The series of posts (2-5)'),
          seriesTheme: z.string().describe('The overarching theme of the series'),
        }),
        execute: async ({ posts, seriesTheme }) => ({ posts, seriesTheme }),
      }),
    }

    const result = streamText({
      model: provider(isOpenAIDirect ? 'gpt-4o' : 'openai/gpt-5.4'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      temperature: 0.8,
      maxOutputTokens: 4000,
      tools,
      stopWhen: stepCountIs(10),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'compose-series',
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Compose series chat error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process series chat message.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
