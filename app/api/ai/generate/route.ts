/**
 * AI Post Generation API Route
 * @description Generates LinkedIn posts using OpenAI with user context and advanced prompting.
 * Uses the centralized prompt service for prompt management with fallback to defaults.
 * @module app/api/ai/generate/route
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, chatCompletion, OpenAIError, getErrorMessage, DEFAULT_MODEL } from '@/lib/ai/openai-client'
import { getSystemPromptForType } from '@/lib/ai/prompt-templates'
import { ANTI_AI_WRITING_RULES } from '@/lib/ai/anti-ai-rules'
import { PromptService, PromptType, mapPostTypeToPromptType } from '@/lib/prompts'
import { trackAIEvent } from '@/lib/posthog-server'

/**
 * Request body schema for post generation
 */
interface GeneratePostRequest {
  /** Main topic or idea for the post */
  topic: string
  /** Tone/style: professional, casual, inspiring, educational, thought-provoking */
  tone?: string
  /** Target length: short (500 chars), medium (1500 chars), long (2500 chars) */
  length?: 'short' | 'medium' | 'long'
  /** Additional context or requirements */
  context?: string
  /** User's OpenAI API key (optional - will use env var if not provided) */
  apiKey?: string
  /** Post type ID for type-specific prompt templates (e.g., 'story', 'listicle') */
  postType?: string
}

/**
 * Calculates estimated cost based on model pricing
 * @param model - The model identifier string
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Estimated cost in USD
 */
function calculateEstimatedCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Pricing per 1K tokens (USD)
  const pricing: Record<string, { input: number; output: number }> = {
    'openai/gpt-5.4': { input: 0.0025, output: 0.015 },
    'openai/gpt-4o': { input: 0.0025, output: 0.01 },
  }
  const rates = pricing[model] || pricing['openai/gpt-5.4']
  return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output
}

/**
 * Character length targets for different post sizes
 */
const LENGTH_TARGETS = {
  short: { min: 400, max: 700, description: 'concise and punchy' },
  medium: { min: 1200, max: 1800, description: 'detailed with examples' },
  long: { min: 2200, max: 2900, description: 'comprehensive and in-depth' },
}

/**
 * Builds a comprehensive system prompt with user context
 * @param userContext - User profile and analytics data
 * @param tone - Desired tone/style
 * @param length - Target length category
 * @returns System prompt string
 */
function buildSystemPrompt(
  userContext: {
    name?: string
    headline?: string
    industry?: string
    recentTopics?: string[]
    topPerformingPosts?: Array<{ content: string; engagement: number }>
    recentPostsText?: string[]
    savedIdeas?: string[]
  },
  tone: string = 'professional',
  length: 'short' | 'medium' | 'long' = 'medium'
): string {
  const lengthConfig = LENGTH_TARGETS[length]

  return `You are an expert LinkedIn content strategist and copywriter specializing in creating high-engagement professional posts.

## Your Mission
Generate a compelling LinkedIn post that:
- Captures attention in the first 2 lines (before "see more")
- Provides genuine value through insights, stories, or actionable advice
- Uses strategic formatting for maximum readability
- Incorporates proven engagement patterns

## User Context
${userContext.name ? `Author: ${userContext.name}` : ''}
${userContext.headline ? `Headline: ${userContext.headline}` : ''}
${userContext.industry ? `Industry: ${userContext.industry}` : ''}
${userContext.recentTopics?.length ? `Recent topics: ${userContext.recentTopics.join(', ')}` : ''}

## Tone & Style
Target tone: ${tone}
${tone === 'professional' ? '- Authoritative yet approachable\n- Industry insights and thought leadership' : ''}
${tone === 'casual' ? '- Conversational and relatable\n- Personal stories and experiences' : ''}
${tone === 'inspiring' ? '- Motivational and uplifting\n- Success stories and lessons learned' : ''}
${tone === 'educational' ? '- Informative and instructive\n- How-to guidance and frameworks' : ''}
${tone === 'thought-provoking' ? '- Challenging conventional wisdom\n- Deep analysis and predictions' : ''}
${tone === 'match-my-style' ? `- CRITICAL: Deeply analyze the author's writing samples below and replicate their EXACT voice
- Mirror their sentence structures, paragraph lengths, and formatting habits
- Use similar vocabulary, expressions, and rhetorical devices
- Match their level of formality, humor, and storytelling approach
- The output should be indistinguishable from their other posts` : ''}

## Length Requirements
Target: ${lengthConfig.description}
Character range: ${lengthConfig.min}-${lengthConfig.max} characters
Current setting: ${length}

## Advanced Formatting Rules
1. **Hook (First 1-2 lines)**: Start with a surprising stat, question, or bold statement
2. **Structure**: Use line breaks generously (double line breaks between sections)
3. **Lists**: Use bullet points when listing items (you may use "- ", "→", or "•")
4. **Emphasis**: Use **bold** for key phrases (sparingly, 2-3 times max)
5. **Hashtags**: Include 3-5 relevant hashtags at the end
6. **Call-to-Action**: End with a question or invitation to comment
7. **User overrides**: If the user provides specific formatting instructions (e.g. "no dashes", "no bullet points"), ALWAYS follow those over the defaults above

## Engagement Optimization
- Use the "scroll-stop" technique: make first line irresistible
- Include personal anecdotes or case studies when relevant
- Ask thought-provoking questions throughout
- Use the "problem-agitate-solve" framework when appropriate
- Create curiosity gaps that make people want to read more

${ANTI_AI_WRITING_RULES}
${userContext.recentPostsText && userContext.recentPostsText.length > 0 ? `
## Writing Style Reference
${tone === 'match-my-style' ? 'CRITICAL: Replicate the exact voice, structure, and style of these posts:' : 'Reference these recent posts for style context:'}
${userContext.recentPostsText.map((post, i) => `${i + 1}. "${post}"`).join('\n')}
` : ''}
${userContext.savedIdeas && userContext.savedIdeas.length > 0 ? `
## Content Preferences (Posts the author found interesting)
${userContext.savedIdeas.map((idea, i) => `${i + 1}. "${idea}"`).join('\n')}
` : ''}
## Output Format
Return ONLY the post content, no explanations or meta-commentary.`
}

/**
 * Builds the user message with topic, length, and additional context.
 * The additional context is placed directly in the user message because
 * LLMs give the strongest weight to the most recent (user) message.
 * Formatting uses numbered lists instead of dashes so the message format
 * itself does not conflict with user instructions like "no dashes".
 */
function buildUserMessage(
  topic: string,
  length: 'short' | 'medium' | 'long' = 'medium',
  context?: string
): string {
  const lengthConfig = LENGTH_TARGETS[length]

  let message = `Create a LinkedIn post about: ${topic}\n\n`

  message += `Requirements:\n`
  message += `1. Keep it between ${lengthConfig.min}-${lengthConfig.max} characters\n`
  message += `2. Start with a compelling hook\n`
  message += `3. Use strategic line breaks and formatting\n`
  message += `4. End with 3-5 relevant hashtags\n`
  message += `5. Include a call-to-action question\n`

  if (context?.trim()) {
    message += `\nIMPORTANT: The user has given these specific instructions. You MUST follow them exactly, even if they override the default formatting rules above:\n\n`
    message += `${context.trim()}\n`
  }

  message += `\nGenerate the post now.`

  return message
}

/**
 * Fetches user context from Supabase
 */
async function getUserContext(userId: string, tone?: string) {
  try {
    const supabase = await createClient()

    const postLimit = tone === 'match-my-style' ? 15 : 10
    const wishlistLimit = tone === 'match-my-style' ? 10 : 0

    // Fetch user profile
    const { data: profile } = await supabase
      .from('linkedin_profiles')
      .select('first_name, last_name, headline, industry')
      .eq('user_id', userId)
      .single()

    // Fetch recent posts for topic analysis
    const { data: recentPosts } = await supabase
      .from('my_posts')
      .select('content, reactions, comments, reposts')
      .eq('user_id', userId)
      .order('posted_at', { ascending: false })
      .limit(postLimit)

    // Extract topics from recent posts (simple keyword extraction)
    const recentTopics = recentPosts
      ?.map((p) => {
        const hashtags = p.content?.match(/#(\w+)/g)
        return hashtags?.slice(0, 3)
      })
      .flat()
      .filter(Boolean)
      .slice(0, 5) as string[] | undefined

    // Get top performing posts (calculate engagement from available metrics)
    const topPerformingPosts = recentPosts
      ?.map((p) => ({
        content: p.content?.slice(0, 200) || '',
        engagement: (p.reactions || 0) + (p.comments || 0) + (p.reposts || 0),
      }))
      .filter((p) => p.engagement > 0)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 3)

    // Fetch wishlist items for style reference
    let wishlistItems: string[] = []
    if (wishlistLimit > 0) {
      const { data: wishlist } = await supabase
        .from('swipe_wishlist')
        .select('content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(wishlistLimit)

      if (wishlist) {
        wishlistItems = wishlist
          .map((w) => w.content)
          .filter((c): c is string => !!c && c.length > 20)
          .map((c) => c.length > 300 ? c.slice(0, 300) + '...' : c)
      }
    }

    // Construct full name from first_name and last_name
    const fullName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined
      : undefined

    return {
      name: fullName,
      headline: profile?.headline ?? undefined,
      industry: profile?.industry ?? undefined,
      recentTopics,
      topPerformingPosts,
      recentPostsText: recentPosts
        ?.map((p) => p.content)
        .filter((c): c is string => !!c && c.length > 20)
        .map((c) => {
          const limit = tone === 'match-my-style' ? 400 : 200
          return c.length > limit ? c.slice(0, limit) + '...' : c
        }) || [],
      savedIdeas: wishlistItems,
    }
  } catch (error) {
    console.error('Failed to fetch user context:', error)
    return {}
  }
}

/**
 * POST /api/ai/generate
 * Generates a LinkedIn post using OpenAI with user context
 */
export async function POST(request: NextRequest) {
  try {
    // Require authenticated user before any processing
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = (await request.json()) as GeneratePostRequest
    const { topic, tone = 'professional', length = 'medium', context, apiKey, postType } = body

    // Validate required fields
    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Get API key from request or environment variable (OpenRouter)
    const openAIApiKey = apiKey?.trim() || process.env.OPENROUTER_API_KEY

    if (!openAIApiKey) {
      return NextResponse.json({ error: 'OpenRouter API key is required. Please set OPENROUTER_API_KEY in environment.' }, { status: 400 })
    }

    // Fetch user context for personalization
    const userContext = await getUserContext(user.id, tone)

    // Determine the prompt type and get prompt from service
    let promptType: PromptType | undefined
    let systemPrompt: string
    let promptSource: 'database' | 'default' | 'fallback' = 'fallback'

    if (postType) {
      // Map post type to prompt type and fetch from service
      promptType = mapPostTypeToPromptType(postType)
      if (promptType) {
        // Get prompt from service (with automatic fallback)
        systemPrompt = await PromptService.getPromptWithFallback(promptType)
        promptSource = 'database'
      } else {
        // Unknown post type, use legacy template
        systemPrompt = getSystemPromptForType(postType, {
          industry: userContext.industry,
          tone,
          headline: userContext.headline,
        })
        promptSource = 'fallback'
      }
    } else {
      // No post type, use generic prompt builder
      systemPrompt = buildSystemPrompt(userContext, tone, length)
      promptSource = 'default'
    }

    // Inject content rules from database BEFORE user instructions
    // (user instructions go last for highest weight)
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

    // Inject additional context at END of system prompt (highest weight position)
    if (context?.trim()) {
      systemPrompt += `\n\n=== CRITICAL USER INSTRUCTIONS (MANDATORY) ===
The user has provided the following specific instructions. These OVERRIDE all other guidelines above. Follow them exactly, even if they contradict previous formatting rules, tone guidance, or structural suggestions. This is non-negotiable:

${context.trim()}

If additional instructions exist above, they override all other guidelines.`
    }

    const userMessage = buildUserMessage(topic, length, context)

    // Track start time for response metrics
    const startTime = Date.now()

    // Create OpenAI client with API key
    const openai = createOpenAIClient({ apiKey: openAIApiKey })

    // Track AI generation start
    try { trackAIEvent(user.id, 'ai_generation_started', { feature: 'generate', topic, tone, length, postType: postType ?? null }) } catch {}

    // Generate post with GPT-4.1 via OpenRouter for best quality
    const response = await chatCompletion(openai, {
      systemPrompt,
      userMessage,
      model: DEFAULT_MODEL, // Use GPT-4.1 via OpenRouter for best quality
      temperature: 0.8, // Higher creativity for engaging content
      maxTokens: 1500, // Allow for longer responses
    })

    const responseTimeMs = Date.now() - startTime

    // Calculate estimated cost based on model pricing
    const estimatedCost = calculateEstimatedCost(
      response.model,
      response.promptTokens,
      response.completionTokens
    )

    // Log usage for analytics (non-blocking)
    if (user && promptType) {
      try {
        await PromptService.logUsage({
          promptType,
          promptVersion: 1,
          userId: user.id,
          feature: 'compose',
          inputTokens: response.promptTokens,
          outputTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          model: response.model,
          responseTimeMs,
          success: true,
          estimatedCost,
          metadata: {
            postType,
            tone,
            length,
            hasContext: !!context?.trim(),
            promptSource,
          },
        })
      } catch (logError) {
        // Usage logging should not block the response
        console.error('[Generate] Failed to log usage:', logError)
      }
    }

    // Track AI generation completed
    try { trackAIEvent(user.id, 'ai_generation_completed', { feature: 'generate', topic, tone, length, postType: postType ?? null, model: response.model, tokens: response.totalTokens, response_time_ms: responseTimeMs }) } catch {}

    // Build prompt snapshot for analytics
    const promptSnapshot = {
      system_prompt: systemPrompt,
      user_messages: [userMessage],
      assistant_response: response.content,
    }

    // Return generated content with AI metadata for downstream persistence
    return NextResponse.json({
      content: response.content,
      metadata: {
        model: response.model,
        tokensUsed: response.totalTokens,
        tone,
        length,
        postType: postType ?? null,
        promptSource,
        userContext: {
          hasProfile: !!userContext.name,
          hasRecentPosts: !!userContext.recentTopics?.length,
        },
      },
      /** AI tracking fields for generated_posts persistence */
      aiMetadata: {
        prompt_tokens: response.promptTokens,
        completion_tokens: response.completionTokens,
        total_tokens: response.totalTokens,
        model: response.model,
        estimated_cost: estimatedCost,
        prompt_snapshot: promptSnapshot,
      },
    })
  } catch (error) {
    console.error('Post generation error:', error)

    Sentry.captureException(error, {
      tags: { feature: 'generate', model: DEFAULT_MODEL },
      extra: { tone: 'unknown', length: 'unknown' },
    })

    // Track AI generation failure
    try { trackAIEvent('anonymous', 'ai_generation_failed', { feature: 'generate', error: error instanceof Error ? error.message : 'Unknown error' }) } catch {}

    // Handle typed OpenAI errors
    if (error instanceof OpenAIError) {
      const statusMap: Record<string, number> = {
        invalid_api_key: 401,
        rate_limit: 429,
        insufficient_quota: 402, // Use 402 Payment Required for quota issues
        server_error: 503,
        timeout: 504,
        unknown: 500,
      }

      return NextResponse.json(
        {
          error: getErrorMessage(error),
          errorType: error.type,
          // Add helpful info for quota errors
          ...(error.type === 'insufficient_quota' && {
            helpUrl: 'https://platform.openai.com/account/billing',
            helpText: 'Add credits to your OpenAI account to continue using AI generation.',
          }),
        },
        { status: statusMap[error.type] || 500 }
      )
    }

    // Handle generic Error instances
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your API key in settings.' },
          { status: 401 }
        )
      }

      if (error.message.includes('quota')) {
        return NextResponse.json(
          {
            error: 'Your OpenAI account has insufficient quota. Please check your billing.',
            errorType: 'insufficient_quota',
            helpUrl: 'https://platform.openai.com/account/billing',
          },
          { status: 402 }
        )
      }

      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'OpenAI rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate post. Please try again.' },
      { status: 500 }
    )
  }
}
