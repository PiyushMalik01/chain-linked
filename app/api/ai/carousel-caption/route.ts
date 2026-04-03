/**
 * AI Carousel Caption Generation API Route
 * @description Generates LinkedIn post captions for carousel content
 * @module app/api/ai/carousel-caption
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveClient, resolveApiKey } from '@/lib/ai/resolve-api-key'
import { codexChatCompletion } from '@/lib/ai/codex-client'
import { chatCompletion, OpenAIError, getErrorMessage, DEFAULT_MODEL } from '@/lib/ai/openai-client'
import { ANTI_AI_WRITING_RULES } from '@/lib/ai/anti-ai-rules'
import { PromptService, PromptType } from '@/lib/prompts'

/**
 * Request body for carousel caption generation
 */
interface CarouselCaptionRequest {
  /** Combined text content from carousel slides */
  carouselContent: string
  /** Optional topic/theme for the caption */
  topic?: string
  /** Optional tone: professional, casual, inspiring, educational */
  tone?: string
}

/**
 * System prompt for generating carousel captions
 */
const CAROUSEL_CAPTION_SYSTEM_PROMPT = `You are an expert LinkedIn content strategist specializing in carousel posts.

Your task is to write a compelling LinkedIn post caption that accompanies a carousel (PDF document post).

## Rules
1. **Hook (Lines 1-2)**: Write an irresistible opening that makes people stop scrolling. Use a surprising insight, bold claim, or relatable problem from the carousel content.
2. **Introduction (Lines 3-5)**: Briefly introduce what the carousel covers and why it matters.
3. **Call-to-Action**: Include an engaging CTA like "Swipe through to learn...", "Save this for later", or "Which slide resonated most?"
4. **Hashtags**: Add 3-5 relevant hashtags at the end.
5. **Length**: Keep between 500-1500 characters total. Enough to entice but not overwhelm.
6. **Formatting**: Use line breaks for readability. Keep paragraphs short (1-2 sentences).

## What NOT to Do
- Don't summarize every slide - leave curiosity gaps
- Don't start with "I'm excited to share..."
- Don't use excessive emojis (1-2 max, if any)
- Don't write a wall of text

## Output
Return ONLY the caption text, no explanations or meta-commentary.

${ANTI_AI_WRITING_RULES}`

/**
 * POST /api/ai/carousel-caption
 * Generates a LinkedIn post caption for carousel content
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CarouselCaptionRequest
    const { carouselContent, topic, tone = 'professional' } = body

    if (!carouselContent?.trim()) {
      return NextResponse.json(
        { error: 'Carousel content is required' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Build user message
    let userMessage = `Write a LinkedIn caption for my carousel post.\n\n`
    userMessage += `Carousel content:\n${carouselContent.slice(0, 3000)}\n\n`

    if (topic?.trim()) {
      userMessage += `Topic/theme: ${topic}\n`
    }

    userMessage += `Tone: ${tone}\n`
    userMessage += `\nGenerate the caption now.`

    // Resolve provider: OAuth/Codex first, then OpenRouter fallback
    const resolvedProvider = user
      ? await resolveApiKey(supabase, user.id)
      : null

    let response: { content: string; model: string; promptTokens: number; completionTokens: number; totalTokens: number }

    if (resolvedProvider?.provider === 'openai-oauth') {
      // Use Codex Responses API — bills against ChatGPT subscription
      response = await codexChatCompletion(
        resolvedProvider.apiKey,
        resolvedProvider.accountId,
        { model: 'gpt-5.4', systemPrompt: CAROUSEL_CAPTION_SYSTEM_PROMPT, userMessage }
      )
    } else {
      // Use OpenRouter via OpenAI SDK
      const openai = user
        ? await resolveClient(supabase, user.id)
        : null
      if (!openai) {
        return NextResponse.json(
          { error: 'No API key available. Connect your ChatGPT account or set OPENROUTER_API_KEY.' },
          { status: 400 }
        )
      }

      response = await chatCompletion(openai, {
        systemPrompt: CAROUSEL_CAPTION_SYSTEM_PROMPT,
        userMessage,
        model: DEFAULT_MODEL,
        temperature: 0.8,
        maxTokens: 800,
      })
    }

    // Log usage (non-blocking)
    if (user) {
      const estimatedCost = ((response.promptTokens ?? 0) * 0.0025 + (response.completionTokens ?? 0) * 0.015) / 1000
      PromptService.logUsage({
        promptType: PromptType.CAROUSEL_SYSTEM,
        promptVersion: 1,
        userId: user.id,
        feature: 'carousel-caption',
        inputTokens: response.promptTokens,
        outputTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        model: response.model,
        success: true,
        estimatedCost,
        metadata: { provider: resolvedProvider?.provider === 'openai-oauth' ? 'openai-oauth' : 'openrouter', tone },
      }).catch(() => {})
    }

    return NextResponse.json({
      content: response.content,
      metadata: {
        model: response.model,
        tokensUsed: response.totalTokens,
      },
    })
  } catch (error) {
    console.error('Carousel caption generation error:', error)

    if (error instanceof OpenAIError) {
      return NextResponse.json(
        { error: getErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate caption. Please try again.' },
      { status: 500 }
    )
  }
}
