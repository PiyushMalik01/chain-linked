/**
 * AI Prompt Playground API Route
 * @description Runs arbitrary system + user prompts with configurable model parameters.
 * Logs usage to the prompt analytics system for tracking experimentation.
 * @module app/api/ai/playground/route
 */

import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import {
  chatCompletion,
  createOpenAIClient,
  DEFAULT_MODEL,
  getErrorMessage,
  OpenAIError,
} from "@/lib/ai/openai-client"
import { decrypt } from "@/lib/crypto"
import { PromptService, PromptType } from "@/lib/prompts"

/**
 * Request body schema for prompt playground
 */
interface PlaygroundRequest {
  /** System prompt text */
  systemPrompt: string
  /** User prompt text */
  userPrompt: string
  /** Optional model override (e.g. openai/gpt-5.4, openai/gpt-5.4-mini, openai/gpt-4o) */
  model?: string
  /** Optional temperature override (0.0 - 2.0) */
  temperature?: number
  /** Optional max tokens override (100 - 4000) */
  maxTokens?: number
  /** Optional top-p override (0.0 - 1.0) */
  topP?: number
  /** Optional API key for this request */
  apiKey?: string
  /** Optional prompt ID if testing a saved prompt */
  promptId?: string
  /** Optional prompt version being tested */
  promptVersion?: number
}

/**
 * Model pricing map (per 1M tokens via OpenRouter)
 * Values are approximate and may change.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "openai/gpt-5.4": { input: 2.5, output: 15.0 },
  "openai/gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "openai/gpt-5.4-nano": { input: 0.2, output: 1.25 },
}

/**
 * Estimates cost for a completion based on token usage
 * @param model - Model identifier
 * @param promptTokens - Number of prompt tokens
 * @param completionTokens - Number of completion tokens
 * @returns Estimated cost in USD
 */
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["openai/gpt-5.4"]
  const inputCost = (promptTokens / 1_000_000) * pricing.input
  const outputCost = (completionTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

/**
 * Attempts to resolve an OpenRouter API key for the current user
 * @param requestKey - API key provided in the request
 * @returns API key string if available
 */
async function resolveApiKey(requestKey?: string) {
  if (requestKey?.trim()) {
    return requestKey.trim()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: apiKeyData } = await supabase
      .from("user_api_keys")
      .select("encrypted_key, is_valid")
      .eq("user_id", user.id)
      .eq("provider", "openai")
      .single()

    if (apiKeyData?.is_valid && apiKeyData.encrypted_key) {
      try {
        return decrypt(apiKeyData.encrypted_key)
      } catch (error) {
        console.error("Failed to decrypt API key:", error)
      }
    }
  }

  return process.env.OPENROUTER_API_KEY
}

/**
 * Clamps a number between min and max
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * POST /api/ai/playground
 * Executes a prompt playground request with configurable model parameters
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - require authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = (await request.json()) as PlaygroundRequest
    const { systemPrompt, userPrompt, model, temperature, maxTokens, topP, apiKey, promptId, promptVersion } = body

    if (!systemPrompt?.trim() || !userPrompt?.trim()) {
      return NextResponse.json({ error: "Both system and user prompts are required" }, { status: 400 })
    }

    const resolvedKey = await resolveApiKey(apiKey)
    if (!resolvedKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key found. Add your key in Settings or set OPENROUTER_API_KEY." },
        { status: 400 }
      )
    }

    // Validate and clamp parameters
    const resolvedModel = model || DEFAULT_MODEL
    const resolvedTemperature = clamp(temperature ?? 0.7, 0, 2)
    const resolvedMaxTokens = clamp(maxTokens ?? 1200, 100, 4000)
    const resolvedTopP = topP !== undefined ? clamp(topP, 0, 1) : undefined

    const client = createOpenAIClient({ apiKey: resolvedKey })

    // Build the completion request - include top_p only if explicitly set
    const completionRequest = {
      systemPrompt,
      userMessage: userPrompt,
      model: resolvedModel,
      temperature: resolvedTemperature,
      maxTokens: resolvedMaxTokens,
    }

    // Track start time for response metrics
    const startTime = Date.now()

    // The chatCompletion function uses the OpenAI SDK which supports top_p
    // We need to pass it through; for now we use the existing interface
    const response = await chatCompletion(client, completionRequest)

    const responseTimeMs = Date.now() - startTime
    const cost = estimateCost(resolvedModel, response.promptTokens, response.completionTokens)

    // Log usage for analytics (non-blocking)
    try {
      await PromptService.logUsage({
        promptId: promptId,
        promptType: PromptType.BASE_RULES, // Use BASE_RULES as default for playground
        promptVersion: promptVersion ?? 1,
        userId: user.id,
        feature: 'playground',
        inputTokens: response.promptTokens,
        outputTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        model: resolvedModel,
        responseTimeMs,
        success: true,
        metadata: {
          temperature: resolvedTemperature,
          maxTokens: resolvedMaxTokens,
          topP: resolvedTopP,
          estimatedCost: cost,
        },
      })
    } catch (logError) {
      // Usage logging should not block the response
      console.error('[Playground] Failed to log usage:', logError)
    }

    return NextResponse.json({
      content: response.content,
      metadata: {
        model: response.model,
        tokensUsed: response.totalTokens,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        finishReason: response.finishReason,
        estimatedCost: cost,
        temperature: resolvedTemperature,
        maxTokens: resolvedMaxTokens,
        topP: resolvedTopP,
      },
    })
  } catch (error) {
    console.error("Prompt playground error:", error)

    Sentry.captureException(error, {
      tags: { feature: 'playground' },
    })

    if (error instanceof OpenAIError) {
      const statusMap: Record<string, number> = {
        invalid_api_key: 401,
        rate_limit: 429,
        insufficient_quota: 402,
        server_error: 503,
        timeout: 504,
        unknown: 500,
      }

      return NextResponse.json(
        { error: getErrorMessage(error), errorType: error.type },
        { status: statusMap[error.type] || 500 }
      )
    }

    return NextResponse.json({ error: "Failed to run prompt" }, { status: 500 })
  }
}
