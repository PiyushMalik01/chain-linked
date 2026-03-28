/**
 * Prompt Test API Route
 * @description Dedicated endpoint for testing prompts with detailed response metadata,
 * version tracking, and comparison support.
 * @module app/api/prompts/test/route
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  chatCompletion,
  createOpenAIClient,
  DEFAULT_MODEL,
  getErrorMessage,
  OpenAIError,
} from "@/lib/ai/openai-client"
import { decrypt } from "@/lib/crypto"

/**
 * Request body schema for prompt testing
 */
interface PromptTestRequest {
  /** System prompt text */
  systemPrompt: string
  /** User prompt text */
  userPrompt: string
  /** Variables to substitute in prompts using {{variable}} syntax */
  variables?: Record<string, string>
  /** Optional model override */
  model?: string
  /** Optional temperature (0.0 - 2.0) */
  temperature?: number
  /** Optional max tokens (100 - 4000) */
  maxTokens?: number
  /** Optional top-p (0.0 - 1.0) */
  topP?: number
  /** Whether to include raw API response */
  includeRawResponse?: boolean
  /** Test run label for identification */
  label?: string
}

/**
 * Response schema for prompt testing
 */
interface PromptTestResponse {
  /** Generated content */
  content: string
  /** Test metadata */
  metadata: {
    /** Test run ID */
    testId: string
    /** ISO timestamp */
    timestamp: string
    /** User-provided label */
    label?: string
    /** Model used */
    model: string
    /** Temperature setting */
    temperature: number
    /** Max tokens setting */
    maxTokens: number
    /** Top-p setting */
    topP?: number
    /** Token usage breakdown */
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    /** Estimated cost in USD */
    estimatedCost: number
    /** Finish reason from API */
    finishReason: string | null
    /** Duration in milliseconds */
    durationMs: number
  }
  /** Processed prompts with variables substituted */
  processedPrompts: {
    systemPrompt: string
    userPrompt: string
  }
  /** Raw API response if requested */
  rawResponse?: unknown
}

/**
 * Model pricing map (per 1M tokens via OpenRouter)
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
 * Substitutes variables in a template string using {{variable}} syntax
 * @param template - Template string with placeholders
 * @param variables - Variable key-value pairs
 * @returns String with variables substituted
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value)
  }, template)
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
 * Attempts to resolve an OpenRouter API key for the current user
 * @returns API key string if available
 */
async function resolveApiKey(): Promise<string | undefined> {
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
 * POST /api/prompts/test
 * Tests a prompt with comprehensive metadata and optional raw response
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check - require authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = (await request.json()) as PromptTestRequest
    const {
      systemPrompt,
      userPrompt,
      variables = {},
      model,
      temperature,
      maxTokens,
      topP,
      includeRawResponse = false,
      label,
    } = body

    // Validate required fields
    if (!systemPrompt?.trim() || !userPrompt?.trim()) {
      return NextResponse.json(
        { error: "Both systemPrompt and userPrompt are required" },
        { status: 400 }
      )
    }

    // Resolve API key
    const apiKey = await resolveApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key found. Add your key in Settings or set OPENROUTER_API_KEY." },
        { status: 400 }
      )
    }

    // Process prompts with variable substitution
    const processedSystemPrompt = substituteVariables(systemPrompt, variables)
    const processedUserPrompt = substituteVariables(userPrompt, variables)

    // Validate and clamp parameters
    const resolvedModel = model || DEFAULT_MODEL
    const resolvedTemperature = clamp(temperature ?? 0.7, 0, 2)
    const resolvedMaxTokens = clamp(maxTokens ?? 1200, 100, 4000)
    const resolvedTopP = topP !== undefined ? clamp(topP, 0, 1) : undefined

    // Create client and execute
    const client = createOpenAIClient({ apiKey })

    const response = await chatCompletion(client, {
      systemPrompt: processedSystemPrompt,
      userMessage: processedUserPrompt,
      model: resolvedModel,
      temperature: resolvedTemperature,
      maxTokens: resolvedMaxTokens,
    })

    const durationMs = Date.now() - startTime
    const cost = estimateCost(resolvedModel, response.promptTokens, response.completionTokens)

    // Build response
    const testResponse: PromptTestResponse = {
      content: response.content,
      metadata: {
        testId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        label,
        model: response.model,
        temperature: resolvedTemperature,
        maxTokens: resolvedMaxTokens,
        topP: resolvedTopP,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        },
        estimatedCost: cost,
        finishReason: response.finishReason,
        durationMs,
      },
      processedPrompts: {
        systemPrompt: processedSystemPrompt,
        userPrompt: processedUserPrompt,
      },
    }

    // Include raw response if requested
    if (includeRawResponse) {
      testResponse.rawResponse = {
        model: response.model,
        finishReason: response.finishReason,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        },
      }
    }

    return NextResponse.json(testResponse)
  } catch (error) {
    console.error("Prompt test error:", error)

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

    return NextResponse.json({ error: "Failed to test prompt" }, { status: 500 })
  }
}
