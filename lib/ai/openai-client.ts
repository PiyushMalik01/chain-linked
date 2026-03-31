/**
 * OpenRouter AI Client with BYOK (Bring Your Own Key) Support
 * @description Handles AI API interactions via OpenRouter for access to GPT-4.1 and other models
 * @module lib/ai/openai-client
 */

import OpenAI from 'openai'
import { observeOpenAI } from '@langfuse/openai'

/**
 * OpenRouter API base URL
 * @see https://openrouter.ai/docs/api/reference/overview
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * Default model to use for AI generation
 * GPT-5.4 is OpenAI's latest frontier model with 1M+ context window
 * @see https://openrouter.ai/openai/gpt-5.4
 */
export const DEFAULT_MODEL = 'openai/gpt-5.4'

/**
 * Configuration for creating an OpenRouter client instance
 */
export interface OpenAIClientConfig {
  /** User's OpenRouter API key (or OpenAI key for backward compatibility) */
  apiKey: string
  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Optional max retries (default: 2) */
  maxRetries?: number
  /** Optional custom base URL (defaults to OpenRouter) */
  baseURL?: string
}

/**
 * Chat completion request parameters
 */
export interface ChatCompletionRequest {
  /** System prompt for the AI */
  systemPrompt: string
  /** User message/content to process */
  userMessage: string
  /** Optional model to use (default: openai/gpt-5.4 via OpenRouter) */
  model?: string
  /** Optional temperature for creativity (default: 0.7) */
  temperature?: number
  /** Optional max tokens for response (default: 1024) */
  maxTokens?: number
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  /** Generated content */
  content: string
  /** Tokens used in the request */
  promptTokens: number
  /** Tokens used in the response */
  completionTokens: number
  /** Total tokens used */
  totalTokens: number
  /** Model used for generation */
  model: string
  /** Finish reason */
  finishReason: string | null
}

/**
 * Error types for OpenAI operations
 */
export type OpenAIErrorType =
  | 'invalid_api_key'
  | 'rate_limit'
  | 'insufficient_quota'
  | 'server_error'
  | 'timeout'
  | 'unknown'

/**
 * Custom error class for OpenAI-related errors
 */
export class OpenAIError extends Error {
  /** Error type for categorization */
  type: OpenAIErrorType
  /** Original error if available */
  originalError?: unknown

  constructor(message: string, type: OpenAIErrorType, originalError?: unknown) {
    super(message)
    this.name = 'OpenAIError'
    this.type = type
    this.originalError = originalError
  }
}

/**
 * Creates an OpenRouter client instance with the user's API key
 * Uses OpenAI SDK with OpenRouter base URL for GPT-4.1 and other models
 * @param config - Client configuration
 * @returns Configured OpenAI-compatible client instance
 * @see https://openrouter.ai/docs/quickstart
 * @example
 * const client = createOpenAIClient({ apiKey: 'sk-or-v1-...' })
 */
export function createOpenAIClient(config: OpenAIClientConfig): OpenAI {
  // Auto-detect: if key starts with sk- it's a direct OpenAI key, use OpenAI API directly
  const isDirectOpenAIKey = config.apiKey?.startsWith('sk-') && !config.apiKey?.startsWith('sk-or-')
  const resolvedBaseURL = config.baseURL ?? (isDirectOpenAIKey ? 'https://api.openai.com/v1' : OPENROUTER_BASE_URL)

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: resolvedBaseURL,
    timeout: config.timeout ?? 30000,
    maxRetries: config.maxRetries ?? 2,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai',
      'X-Title': 'ChainLinked',
    },
  })

  // Wrap with Langfuse for automatic tracing of all LLM calls
  return observeOpenAI(client, {
    traceName: 'chainlinked-openai',
  })
}

/**
 * Validates an OpenRouter API key by making a test request
 * @param apiKey - The API key to validate (OpenRouter: sk-or-v1-... or legacy OpenAI: sk-...)
 * @returns True if the key is valid, false otherwise
 * @example
 * const isValid = await validateOpenAIKey('sk-or-v1-...')
 */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  // Accept both OpenRouter (sk-or-) and legacy OpenAI (sk-) keys
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return false
  }

  try {
    const client = createOpenAIClient({ apiKey, timeout: 10000, maxRetries: 1 })

    // Make a minimal request to validate the key via OpenRouter
    await client.models.list()
    return true
  } catch (error) {
    console.error('API key validation failed:', error)
    return false
  }
}

/**
 * Performs a chat completion request using the user's API key
 * @param client - OpenAI client instance
 * @param request - Chat completion parameters
 * @returns Chat completion response with content and usage stats
 * @throws OpenAIError if the request fails
 * @example
 * const response = await chatCompletion(client, {
 *   systemPrompt: 'You are a helpful assistant',
 *   userMessage: 'Hello!',
 * })
 */
export async function chatCompletion(
  client: OpenAI,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const {
    systemPrompt,
    userMessage,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1024,
  } = request

  try {
    // If using direct OpenAI API, convert OpenRouter model paths to OpenAI model names
    const isDirectOpenAI = (client as unknown as { baseURL?: string }).baseURL?.includes('api.openai.com')
    let resolvedModel = model
    if (isDirectOpenAI && model.startsWith('openai/')) {
      // Map OpenRouter paths to OpenAI model names
      const modelMap: Record<string, string> = {
        'openai/gpt-5.4': 'gpt-4o',
        'openai/gpt-4o': 'gpt-4o',
        'openai/gpt-4o-mini': 'gpt-4o-mini',
        'openai/gpt-4-turbo': 'gpt-4-turbo',
      }
      resolvedModel = modelMap[model] || model.replace('openai/', '')
    }

    const completion = await client.chat.completions.create({
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    })

    const choice = completion.choices[0]
    const content = choice?.message?.content

    if (!content) {
      throw new OpenAIError(
        'No content in response',
        'unknown'
      )
    }

    return {
      content,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
      model: completion.model,
      finishReason: choice?.finish_reason ?? null,
    }
  } catch (error) {
    throw categorizeOpenAIError(error)
  }
}

/**
 * Categorizes an OpenAI API error into a user-friendly error type
 * @param error - The error to categorize
 * @returns Categorized OpenAIError
 */
function categorizeOpenAIError(error: unknown): OpenAIError {
  if (error instanceof OpenAIError) {
    return error
  }

  // Handle OpenAI SDK errors
  if (error instanceof OpenAI.APIError) {
    const status = error.status

    switch (status) {
      case 401:
        return new OpenAIError(
          'Invalid API key. Please check your OpenAI API key in settings.',
          'invalid_api_key',
          error
        )
      case 429:
        if (error.message?.includes('quota')) {
          return new OpenAIError(
            'API quota exceeded. Please check your OpenAI billing.',
            'insufficient_quota',
            error
          )
        }
        return new OpenAIError(
          'Rate limit exceeded. Please wait a moment and try again.',
          'rate_limit',
          error
        )
      case 500:
      case 502:
      case 503:
        return new OpenAIError(
          'OpenAI service is temporarily unavailable. Please try again.',
          'server_error',
          error
        )
      default:
        return new OpenAIError(
          error.message || 'An unexpected error occurred.',
          'unknown',
          error
        )
    }
  }

  // Handle timeout errors
  if (error instanceof Error && error.message?.includes('timeout')) {
    return new OpenAIError(
      'Request timed out. Please try again.',
      'timeout',
      error
    )
  }

  // Generic error handling
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  return new OpenAIError(message, 'unknown', error)
}

/**
 * Gets a user-friendly error message for display
 * @param error - The OpenAI error
 * @returns User-friendly error message
 */
export function getErrorMessage(error: OpenAIError): string {
  switch (error.type) {
    case 'invalid_api_key':
      return 'Your OpenAI API key is invalid. Please update it in Settings.'
    case 'rate_limit':
      return 'Too many requests. Please wait a moment and try again.'
    case 'insufficient_quota':
      return 'Your OpenAI account has insufficient quota. Please check your billing.'
    case 'server_error':
      return 'OpenAI service is temporarily unavailable. Please try again later.'
    case 'timeout':
      return 'The request took too long. Please try again.'
    default:
      return error.message || 'An unexpected error occurred. Please try again.'
  }
}
