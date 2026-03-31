/**
 * AI Post Remix API Route
 * @description Remixes posts using OpenAI with user context, writing style, and content history.
 * Uses the centralized prompt service for prompt management with fallback to defaults.
 * @module app/api/ai/remix/route
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, chatCompletion, DEFAULT_MODEL } from '@/lib/ai/openai-client'
import { decrypt } from '@/lib/crypto'
import { PromptService, PromptType, mapToneToPromptType } from '@/lib/prompts'
import { trackAIEvent } from '@/lib/posthog-server'

/**
 * Request body schema for post remix
 */
interface RemixPostRequest {
  /** Original post content to remix */
  originalContent: string
  /** Desired tone: professional, casual, inspiring, educational, thought-provoking, match-my-style */
  tone?: string
  /** Target length: short (500 chars), medium (1500 chars), long (2500 chars) */
  length?: 'short' | 'medium' | 'long'
  /** Custom instructions for the remix */
  customInstructions?: string
  /** User's OpenAI API key (optional - will fetch from database if not provided) */
  apiKey?: string
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
 * User content profile for style matching
 */
interface UserContentProfile {
  name?: string
  headline?: string
  industry?: string
  recentPosts: {
    content: string
    reactions: number
    comments: number
    reposts: number
  }[]
  niches: string[]
  writingPatterns: {
    avgLength: number
    usesEmojis: boolean
    usesHashtags: boolean
    usesBullets: boolean
    avgSentenceLength: number
    commonPhrases: string[]
  }
  topPerformingPosts: {
    content: string
    engagement: number
  }[]
}

/**
 * Analyzes user's writing patterns from their posts
 */
function analyzeWritingPatterns(posts: { content: string }[]): UserContentProfile['writingPatterns'] {
  if (!posts.length) {
    return {
      avgLength: 1200,
      usesEmojis: false,
      usesHashtags: true,
      usesBullets: false,
      avgSentenceLength: 15,
      commonPhrases: [],
    }
  }

  const contents = posts.map((p) => p.content || '').filter(Boolean)

  // Calculate average length
  const avgLength = Math.round(
    contents.reduce((sum, c) => sum + c.length, 0) / contents.length
  )

  // Check emoji usage
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
  const usesEmojis = contents.some((c) => emojiRegex.test(c))

  // Check hashtag usage
  const usesHashtags = contents.some((c) => /#\w+/.test(c))

  // Check bullet point usage
  const usesBullets = contents.some((c) => /^[-•*]\s/m.test(c) || /\n[-•*]\s/m.test(c))

  // Calculate average sentence length
  const allText = contents.join(' ')
  const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().length > 5)
  const avgSentenceLength = sentences.length
    ? Math.round(
        sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
      )
    : 15

  // Extract common phrases (simple n-gram approach)
  const wordFreq: Record<string, number> = {}
  contents.forEach((c) => {
    const words = c.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
      if (phrase.length > 10 && !/^(the|and|but|for|with|this|that)/i.test(phrase)) {
        wordFreq[phrase] = (wordFreq[phrase] || 0) + 1
      }
    }
  })
  const commonPhrases = Object.entries(wordFreq)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase)

  return {
    avgLength,
    usesEmojis,
    usesHashtags,
    usesBullets,
    avgSentenceLength,
    commonPhrases,
  }
}

/**
 * Fetches comprehensive user context from Supabase
 */
async function getUserContentProfile(userId: string): Promise<UserContentProfile> {
  const supabase = await createClient()

  // Fetch user profile
  const { data: profile } = await supabase
    .from('linkedin_profiles')
    .select('first_name, last_name, headline, industry')
    .eq('user_id', userId)
    .single()

  // Fetch user's recent posts (last 20 for better style analysis)
  const { data: recentPosts } = await supabase
    .from('my_posts')
    .select('content, reactions, comments, reposts, posted_at')
    .eq('user_id', userId)
    .order('posted_at', { ascending: false })
    .limit(20)

  // Fetch user's niches
  const { data: userNiches } = await supabase
    .from('user_niches')
    .select('niche')
    .eq('user_id', userId)
    .limit(5)

  const posts = recentPosts?.map((p) => ({
    content: p.content || '',
    reactions: p.reactions || 0,
    comments: p.comments || 0,
    reposts: p.reposts || 0,
  })) || []

  // Analyze writing patterns
  const writingPatterns = analyzeWritingPatterns(posts)

  // Get top performing posts by engagement
  const topPerformingPosts = posts
    .map((p) => ({
      content: p.content.slice(0, 300),
      engagement: p.reactions + p.comments * 3 + p.reposts * 5,
    }))
    .filter((p) => p.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 3)

  // Extract niches from user_niches table or from post hashtags
  const niches = userNiches?.map((n) => n.niche) || []
  if (niches.length === 0 && posts.length > 0) {
    // Extract from hashtags
    const hashtags: Record<string, number> = {}
    posts.forEach((p) => {
      const tags = p.content.match(/#(\w+)/g) || []
      tags.forEach((tag) => {
        hashtags[tag] = (hashtags[tag] || 0) + 1
      })
    })
    const topHashtags = Object.entries(hashtags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag.replace('#', ''))
    niches.push(...topHashtags)
  }

  const fullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined
    : undefined

  return {
    name: fullName,
    headline: profile?.headline ?? undefined,
    industry: profile?.industry ?? undefined,
    recentPosts: posts,
    niches,
    writingPatterns,
    topPerformingPosts,
  }
}

/**
 * Builds the remix system prompt with user context.
 * Enhances the base prompt from the prompt service with user-specific context.
 * @param basePrompt - Base prompt content from PromptService
 * @param userProfile - User profile data for personalization
 * @param tone - Desired tone for the remix
 * @param length - Target post length
 * @returns Complete system prompt with user context
 */
function buildRemixSystemPrompt(
  basePrompt: string,
  userProfile: UserContentProfile,
  tone: string,
  length: 'short' | 'medium' | 'long'
): string {
  const lengthConfig = LENGTH_TARGETS[length]
  const { writingPatterns, topPerformingPosts, niches } = userProfile

  // Style analysis section
  const styleAnalysis = tone === 'match-my-style' && writingPatterns
    ? `
## Your Writing Style Analysis (CRITICAL - Match This Exactly)
Based on your previous posts:
- Average post length: ~${writingPatterns.avgLength} characters
- Emoji usage: ${writingPatterns.usesEmojis ? 'Yes, use emojis naturally' : 'Minimal/no emojis'}
- Hashtag style: ${writingPatterns.usesHashtags ? 'Include 3-5 hashtags' : 'Few/no hashtags'}
- Formatting: ${writingPatterns.usesBullets ? 'Uses bullet points and lists' : 'Paragraph-based writing'}
- Sentence style: ~${writingPatterns.avgSentenceLength} words per sentence
${writingPatterns.commonPhrases.length > 0 ? `- Common phrases you use: "${writingPatterns.commonPhrases.join('", "')}"` : ''}
`
    : ''

  // Top performing posts for reference
  const topPostsSection = topPerformingPosts.length > 0
    ? `
## Your Top Performing Posts (For Style Reference)
${topPerformingPosts.map((p, i) => `${i + 1}. "${p.content}..." (${p.engagement} engagement)`).join('\n')}
`
    : ''

  // Niche/topic context
  const nicheSection = niches.length > 0
    ? `
## Your Content Niches/Topics
You typically post about: ${niches.join(', ')}
The remixed post should feel natural to your audience and topic focus.
`
    : ''

  // Build user context section
  const userContextSection = `
## User Profile
${userProfile.name ? `Author: ${userProfile.name}` : 'Anonymous'}
${userProfile.headline ? `Headline: ${userProfile.headline}` : ''}
${userProfile.industry ? `Industry: ${userProfile.industry}` : ''}
${styleAnalysis}${topPostsSection}${nicheSection}

## Length Requirements
Target: ${lengthConfig.description}
Character range: ${lengthConfig.min}-${lengthConfig.max} characters
`

  // Combine base prompt with user context
  return `${basePrompt}

${userContextSection}

## Remix Rules
1. **Never copy** - Transform the content significantly, don't just rephrase
2. **Add your perspective** - Inject personal viewpoints or experiences that fit the user's voice
3. **Maintain value** - Keep the key insights but present them uniquely
4. **Optimize hooks** - Create a compelling opening that stops the scroll
5. **Format well** - Use line breaks, short paragraphs, strategic emphasis
6. **Authentic voice** - Should sound like ${userProfile.name || 'the user'} wrote it
7. **Remove attributions** - Don't mention the original author or that it's a remix

## What NOT to Do
- Don't start with "I'm excited..." or similar clichés
- Don't use corporate jargon or buzzwords
- Don't make it obvious this is a remixed post
- Don't lose the original's valuable insights

## Output
Return ONLY the remixed post content. No explanations, no quotes, no meta-commentary.`
}

/**
 * Builds the user message for remix
 */
function buildRemixUserMessage(
  originalContent: string,
  customInstructions?: string,
  length: 'short' | 'medium' | 'long' = 'medium'
): string {
  const lengthConfig = LENGTH_TARGETS[length]

  let message = `Please remix the following LinkedIn post into my own voice and style:

---ORIGINAL POST---
${originalContent.trim()}
---END ORIGINAL---

`

  if (customInstructions?.trim()) {
    message += `Additional instructions: ${customInstructions.trim()}\n\n`
  }

  message += `Requirements:
- Transform this into ${lengthConfig.min}-${lengthConfig.max} characters
- Make it feel authentically mine, not a copy
- Keep the valuable insights but present them uniquely
- Optimize for LinkedIn engagement
- End with relevant hashtags and a call-to-action

Generate the remixed post now.`

  return message
}

/**
 * POST /api/ai/remix
 * Remixes a post using OpenAI with comprehensive user context
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as RemixPostRequest
    const {
      originalContent,
      tone = 'match-my-style',
      length = 'medium',
      customInstructions,
      apiKey,
    } = body

    // Validate required fields
    if (!originalContent?.trim()) {
      return NextResponse.json(
        { error: 'Original content is required' },
        { status: 400 }
      )
    }

    if (originalContent.trim().length < 20) {
      return NextResponse.json(
        { error: 'Original content is too short to remix' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get API key - either from request, database, or environment variable
    let openAIApiKey = apiKey?.trim()

    if (!openAIApiKey) {
      // Try to fetch encrypted key from database first
      try {
        const { data: apiKeyData } = await supabase
          .from('user_api_keys')
          .select('encrypted_key, is_valid')
          .eq('user_id', user.id)
          .eq('provider', 'openai')
          .single()

        if (apiKeyData?.is_valid && apiKeyData.encrypted_key) {
          // Decrypt the API key
          try {
            openAIApiKey = decrypt(apiKeyData.encrypted_key)
          } catch (decryptError) {
            console.error('Failed to decrypt API key:', decryptError)
          }
        }
      } catch {
        // Table might not exist, continue to fallback
        console.log('user_api_keys table not available, using environment variable')
      }
    }

    // Fallback to environment variable (OpenRouter)
    if (!openAIApiKey) {
      openAIApiKey = process.env.OPENROUTER_API_KEY
    }

    if (!openAIApiKey) {
      return NextResponse.json(
        { error: 'No OpenRouter API key found. Please set OPENROUTER_API_KEY in environment or add your API key in Settings.', code: 'no_api_key' },
        { status: 400 }
      )
    }

    // Fetch comprehensive user content profile
    const userProfile = user
      ? await getUserContentProfile(user.id)
      : {
          recentPosts: [],
          niches: [],
          writingPatterns: {
            avgLength: 1200,
            usesEmojis: false,
            usesHashtags: true,
            usesBullets: false,
            avgSentenceLength: 15,
            commonPhrases: [],
          },
          topPerformingPosts: [],
        }

    // Map tone to prompt type and get base prompt from service
    const promptType = mapToneToPromptType(tone) || PromptType.REMIX_PROFESSIONAL
    const basePrompt = await PromptService.getPromptWithFallback(promptType)

    // Build prompts with user context
    let systemPrompt = buildRemixSystemPrompt(basePrompt, userProfile, tone, length)
    const userMessage = buildRemixUserMessage(originalContent, customInstructions, length)

    // Inject active content rules from database
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

    // Track response timing for analytics
    const startTime = Date.now()

    // Create OpenAI client with user's API key and explicit timeout
    const openai = createOpenAIClient({ apiKey: openAIApiKey, timeout: 45000 })

    // Track AI generation start
    try { trackAIEvent(user.id, 'ai_generation_started', { feature: 'remix', tone, length }) } catch {}

    // Generate remixed post with GPT-4.1 via OpenRouter
    const response = await chatCompletion(openai, {
      systemPrompt,
      userMessage,
      model: DEFAULT_MODEL, // Use GPT-4.1 via OpenRouter for best quality
      temperature: 0.85, // Slightly higher for creative transformation
      maxTokens: 1500,
    })

    const responseTimeMs = Date.now() - startTime

    // Calculate estimated cost based on model pricing
    const estimatedCost = calculateEstimatedCost(
      response.model,
      response.promptTokens,
      response.completionTokens
    )

    // Log usage for analytics (non-blocking)
    try {
      await PromptService.logUsage({
        promptType,
        promptVersion: 1, // Default version for now
        userId: user.id,
        feature: 'remix',
        inputTokens: response.promptTokens,
        outputTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        model: response.model,
        responseTimeMs,
        success: true,
        estimatedCost,
        metadata: {
          tone,
          length,
          hasCustomInstructions: !!customInstructions?.trim(),
        },
      })
    } catch (logError) {
      // Usage logging should not block the response
      console.error('[Remix] Failed to log usage:', logError)
    }

    // Track AI generation completed
    try { trackAIEvent(user.id, 'ai_generation_completed', { feature: 'remix', tone, length, model: response.model, tokens: response.totalTokens, response_time_ms: responseTimeMs }) } catch {}

    // Build prompt snapshot for analytics
    const promptSnapshot = {
      system_prompt: systemPrompt,
      user_messages: [userMessage],
      assistant_response: response.content,
    }

    // Return remixed content with metadata and AI tracking fields
    return NextResponse.json({
      content: response.content,
      originalContent,
      metadata: {
        model: response.model,
        tokensUsed: response.totalTokens,
        tone,
        length,
        promptSource: 'service', // Indicates prompt came from service (with fallback)
        userContext: {
          hasProfile: !!userProfile.name,
          postsAnalyzed: userProfile.recentPosts.length,
          nichesDetected: userProfile.niches.length,
          styleMatched: tone === 'match-my-style',
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
    console.error('Post remix error:', error)

    Sentry.captureException(error, {
      tags: { feature: 'remix', model: DEFAULT_MODEL },
    })

    // Track AI generation failure
    try { trackAIEvent('anonymous', 'ai_generation_failed', { feature: 'remix', error: error instanceof Error ? error.message : 'Unknown error' }) } catch {}

    // Handle OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your API key in settings.' },
          { status: 401 }
        )
      }

      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'OpenAI rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }

      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI quota exceeded. Please check your billing.' },
          { status: 429 }
        )
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to remix post: ${errorMessage}` },
      { status: 500 }
    )
  }
}
