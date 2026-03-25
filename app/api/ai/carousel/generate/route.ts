/**
 * AI Carousel Generation API
 * @description Generates carousel content based on template structure.
 * Uses the centralized prompt service for prompt management with fallback to defaults.
 * @module app/api/ai/carousel/generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { createOpenAIClient, DEFAULT_MODEL } from '@/lib/ai/openai-client'
import {
  buildCarouselSystemPrompt,
  buildCarouselUserPrompt,
  parseCarouselResponse,
  validateContent,
  truncateToFit,
  type CarouselGenerationInput,
  type CarouselTone,
  type CtaType,
  type UserContext,
} from '@/lib/ai/carousel-prompts'
import type { TemplateSlot, SlideBreakdown } from '@/lib/ai/template-analyzer'
import { PromptService, PromptType } from '@/lib/prompts'
import { trackAIEvent } from '@/lib/posthog-server'

/**
 * Request validation schema
 */
const requestSchema = z.object({
  topic: z.string().min(10, 'Topic must be at least 10 characters'),
  audience: z.string().optional(),
  industry: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  tone: z.enum(['professional', 'casual', 'educational', 'inspirational', 'storytelling', 'match-my-style']),
  additionalContext: z.string().optional(),
  ctaType: z.enum(['none', 'follow', 'comment', 'share', 'link', 'dm', 'save', 'custom']).optional(),
  customCta: z.string().optional(),
  templateAnalysis: z.object({
    templateId: z.string(),
    templateName: z.string(),
    category: z.string(),
    totalSlides: z.number(),
    slideBreakdown: z.array(z.object({
      index: z.number(),
      purpose: z.string(),
      elementCount: z.number(),
      textElementCount: z.number(),
      hasImage: z.boolean(),
      backgroundColor: z.string(),
      slots: z.array(z.any())
    })),
    slots: z.array(z.object({
      id: z.string(),
      slideIndex: z.number(),
      elementId: z.string(),
      type: z.string(),
      maxLength: z.number(),
      placeholder: z.string(),
      purpose: z.string(),
      required: z.boolean(),
      originalFontSize: z.number(),
      position: z.object({
        x: z.number(),
        y: z.number()
      })
    })),
    brandColors: z.array(z.string()),
    fonts: z.array(z.string()),
    totalSlots: z.number(),
    requiredSlots: z.number()
  })
})

/**
 * Response structure
 */
interface GenerationResponse {
  success: boolean
  slots: Array<{
    slotId: string
    content: string
  }>
  caption?: string
  metadata: {
    tokensUsed: number
    generationTime: number
    model: string
  }
  error?: string
}

/**
 * Gets the API key from environment (same pattern as compose route)
 */
function getApiKey(): string {
  const systemKey = process.env.OPENROUTER_API_KEY
  if (!systemKey) {
    throw new Error('No API key available. Please set OPENROUTER_API_KEY in environment.')
  }
  return systemKey
}

/**
 * Fetches user context from Supabase for personalised content generation.
 * Pulls profile, company context, recent posts, and saved wishlist ideas.
 * @param supabase - Supabase server client
 * @param userId - Authenticated user ID
 * @returns UserContext object (all fields optional)
 */
async function fetchUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tone?: string
): Promise<UserContext> {
  const ctx: UserContext = {}

  // Fetch more data for match-my-style to give AI deeper style analysis
  const postLimit = tone === 'match-my-style' ? 15 : 5
  const wishlistLimit = tone === 'match-my-style' ? 10 : 5

  // Fetch profile, company, recent posts, and wishlist in parallel
  const [profileResult, companyResult, postsResult, wishlistResult] = await Promise.allSettled([
    supabase
      .from('linkedin_profiles')
      .select('first_name, last_name, headline, industry, summary')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('company_context')
      .select('company_name, industry, target_audience, value_proposition, products_and_services, tone_of_voice')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('my_posts')
      .select('content')
      .eq('user_id', userId)
      .order('posted_at', { ascending: false })
      .limit(postLimit),
    supabase
      .from('swipe_wishlist')
      .select('content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(wishlistLimit),
  ])

  // Profile
  if (profileResult.status === 'fulfilled' && profileResult.value.data) {
    const p = profileResult.value.data
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ')
    if (fullName) ctx.name = fullName
    if (p.headline) ctx.headline = p.headline
    if (p.industry) ctx.industry = p.industry
  }

  // Company context (some columns are JSONB so cast to string)
  if (companyResult.status === 'fulfilled' && companyResult.value.data) {
    const c = companyResult.value.data
    if (c.company_name) ctx.companyName = String(c.company_name)
    if (c.industry && !ctx.industry) ctx.industry = String(c.industry)
    if (c.target_audience) ctx.targetAudience = String(c.target_audience)
    if (c.value_proposition) ctx.valueProposition = String(c.value_proposition)
    if (c.products_and_services) ctx.productsAndServices = String(c.products_and_services)
    if (c.tone_of_voice) {
      // tone_of_voice is JSONB with {descriptors, writingStyle, examples}
      if (typeof c.tone_of_voice === 'object' && c.tone_of_voice !== null) {
        const tov = c.tone_of_voice as Record<string, unknown>
        const parts: string[] = []
        if (Array.isArray(tov.descriptors)) {
          parts.push(`Tone: ${(tov.descriptors as string[]).join(', ')}`)
        }
        if (typeof tov.writingStyle === 'string') {
          parts.push(`Style: ${tov.writingStyle}`)
        }
        if (Array.isArray(tov.examples) && (tov.examples as string[]).length > 0) {
          parts.push(`Example phrases: "${(tov.examples as string[]).slice(0, 3).join('", "')}"`)
        }
        ctx.toneOfVoice = parts.join('\n')
      } else {
        ctx.toneOfVoice = String(c.tone_of_voice)
      }
    }
  }

  // Recent posts (longer truncation for match-my-style to preserve more voice cues)
  const postTruncateLimit = tone === 'match-my-style' ? 400 : 200
  if (postsResult.status === 'fulfilled' && postsResult.value.data) {
    const posts = postsResult.value.data
      .map((p) => p.content)
      .filter((c): c is string => !!c && c.length > 20)
      .map((c) => c.length > postTruncateLimit ? c.slice(0, postTruncateLimit) + '...' : c)
    if (posts.length > 0) ctx.recentPosts = posts
  }

  // Wishlist / saved ideas (longer truncation for match-my-style)
  const ideaTruncateLimit = tone === 'match-my-style' ? 400 : 200
  if (wishlistResult.status === 'fulfilled' && wishlistResult.value.data) {
    const ideas = wishlistResult.value.data
      .map((w) => w.content)
      .filter((c): c is string => !!c && c.length > 20)
      .map((c) => c.length > ideaTruncateLimit ? c.slice(0, ideaTruncateLimit) + '...' : c)
    if (ideas.length > 0) ctx.savedIdeas = ideas
  }

  return ctx
}

/**
 * POST /api/ai/carousel/generate
 * Generates carousel content based on template and topic
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }

    const input = validationResult.data as CarouselGenerationInput

    // Get API key (same pattern as compose route)
    const apiKey = getApiKey()

    // Fetch user context for personalisation (profile, company, recent posts, wishlist)
    const userContext = await fetchUserContext(supabase, user.id, input.tone)
    input.userContext = userContext

    // Build prompts using the template-aware builders with user context
    const systemPrompt = buildCarouselSystemPrompt(input)
    const userPrompt = buildCarouselUserPrompt(input)

    // Track start time for response metrics
    const aiStartTime = Date.now()

    // Initialize OpenRouter client (same shared helper as compose route)
    const client = createOpenAIClient({ apiKey })

    // Track AI generation start
    try { trackAIEvent(user.id, 'ai_generation_started', { feature: 'carousel', topic: input.topic, tone: input.tone, totalSlides: input.templateAnalysis.totalSlides }) } catch {}

    // Call AI using the same model as compose route
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const aiResponseTimeMs = Date.now() - aiStartTime

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from AI')
    }

    // Parse response
    const contentMap = parseCarouselResponse(responseContent, input.templateAnalysis.slots)
    if (!contentMap) {
      throw new Error('Failed to parse AI response')
    }

    // Validate and fix content
    const validation = validateContent(contentMap, input.templateAnalysis.slots)

    // Truncate any content that exceeds limits
    const slots: Array<{ slotId: string; content: string }> = []
    input.templateAnalysis.slots.forEach(slot => {
      let content = contentMap.get(slot.id) || ''

      // Truncate if needed
      if (content.length > slot.maxLength) {
        content = truncateToFit(content, slot.maxLength)
      }

      if (content) {
        slots.push({
          slotId: slot.id,
          content
        })
      }
    })

    // Generate a LinkedIn caption for the carousel (non-blocking secondary call)
    let caption: string | undefined
    try {
      const captionCompletion = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a LinkedIn content expert. Write a compelling LinkedIn post caption to accompany a carousel document. The caption should hook readers and encourage them to swipe through the slides. Keep it under 500 characters. Do NOT repeat slide content verbatim — tease key insights. Include relevant hashtags at the end.'
          },
          {
            role: 'user',
            content: `Topic: ${input.topic}\nTone: ${input.tone}\nSlide content summary:\n${slots.map(s => s.content).join('\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
      caption = captionCompletion.choices[0]?.message?.content || undefined
    } catch (captionError) {
      // Caption generation is best-effort; don't fail the whole request
      console.warn('[Carousel] Caption generation failed:', captionError)
    }

    const generationTime = Date.now() - startTime

    const response: GenerationResponse = {
      success: true,
      slots,
      caption,
      metadata: {
        tokensUsed: completion.usage?.total_tokens || 0,
        generationTime,
        model: DEFAULT_MODEL
      }
    }

    // Log validation issues as warnings
    if (!validation.isValid) {
      console.warn('Content validation issues:', validation.issues)
    }

    // Log usage for analytics (non-blocking)
    try {
      await PromptService.logUsage({
        promptType: PromptType.CAROUSEL_SYSTEM,
        promptVersion: 1,
        userId: user.id,
        feature: 'carousel',
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
        model: DEFAULT_MODEL,
        responseTimeMs: aiResponseTimeMs,
        success: true,
        metadata: {
          topic: input.topic,
          tone: input.tone,
          totalSlides: input.templateAnalysis.totalSlides,
          slotsGenerated: slots.length,
          validationPassed: validation.isValid,
        },
      })
    } catch (logError) {
      // Usage logging should not block the response
      console.error('[Carousel] Failed to log usage:', logError)
    }

    // Track AI generation completed
    try { trackAIEvent(user.id, 'ai_generation_completed', { feature: 'carousel', topic: input.topic, tone: input.tone, model: DEFAULT_MODEL, tokens: completion.usage?.total_tokens ?? 0, response_time_ms: generationTime, slotsGenerated: slots.length }) } catch {}

    return NextResponse.json(response)

  } catch (error) {
    console.error('Carousel generation error:', error)

    // Track AI generation failure
    try { trackAIEvent('anonymous', 'ai_generation_failed', { feature: 'carousel', error: error instanceof Error ? error.message : 'Unknown error' }) } catch {}

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Handle specific error types
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 401 }
      )
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate carousel content' },
      { status: 500 }
    )
  }
}
