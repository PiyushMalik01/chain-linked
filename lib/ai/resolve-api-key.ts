/**
 * Resolves the AI API key and provider for a user.
 *
 * Priority:
 * 1. User's stored OpenAI OAuth token (from openai_connections table) — always preferred
 *    Routes through ChatGPT Codex backend (chatgpt.com/backend-api)
 * 2. Server-side OPENROUTER_API_KEY environment variable as fallback
 *    Routes through OpenRouter (openrouter.ai/api/v1)
 *
 * @module lib/ai/resolve-api-key
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'
import type { Database } from '@/types/database'
import { createOpenAIClient } from '@/lib/ai/openai-client'

/** Result from resolving the AI provider credentials */
export interface ResolvedProvider {
  /** The API key or OAuth access token */
  apiKey: string
  /** Which backend to route to */
  provider: 'openrouter' | 'openai-direct'
  /** ChatGPT account ID (required for Codex routing) */
  accountId?: string | null
}

/**
 * Resolves the best available API key and provider for AI generation.
 * OAuth connection is always checked first and preferred over OpenRouter.
 *
 * @param supabase - Authenticated Supabase server client
 * @param userId - The authenticated user's ID
 * @returns Resolved provider info, or null if none available
 */
export async function resolveApiKey(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ResolvedProvider | null> {
  // 1. Check for stored OAuth connection first (always preferred)
  try {
    const { data: connection } = await supabase
      .from('openai_connections')
      .select('auth_method, api_key, access_token, token_expires_at, is_active, account_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (connection) {
      // Manual API key stored via settings — route through OpenRouter
      if (connection.auth_method === 'manual' && connection.api_key) {
        return { apiKey: connection.api_key, provider: 'openrouter' }
      }
      // OAuth device-code — use the exchanged API key via standard OpenAI API
      if (connection.auth_method === 'oauth-device' && connection.api_key) {
        if (connection.token_expires_at) {
          const expiresAt = new Date(connection.token_expires_at)
          if (expiresAt <= new Date()) {
            console.warn('[resolve-api-key] OAuth token expired for user', userId)
            // Token expired — fall through to OpenRouter
          } else {
            return {
              apiKey: connection.api_key,
              provider: 'openai-direct',
              accountId: connection.account_id,
            }
          }
        } else {
          return {
            apiKey: connection.api_key,
            provider: 'openai-direct',
            accountId: connection.account_id,
          }
        }
      }
    }
  } catch {
    // Query failed — fall through to OpenRouter
  }

  // 2. Fallback to server environment variable (OpenRouter)
  const envKey = process.env.OPENROUTER_API_KEY
  if (envKey) {
    return { apiKey: envKey, provider: 'openrouter' }
  }

  return null
}

/**
 * Resolves the API key and creates the appropriate OpenAI client.
 * Uses Codex backend for OAuth connections, OpenRouter for everything else.
 *
 * @param supabase - Authenticated Supabase server client
 * @param userId - The authenticated user's ID
 * @returns Configured OpenAI client, or null if no credentials available
 */
export async function resolveClient(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OpenAI | null> {
  const resolved = await resolveApiKey(supabase, userId)
  if (!resolved) return null

  if (resolved.provider === 'openai-direct') {
    // OAuth key — route to api.openai.com directly
    return createOpenAIClient({ apiKey: resolved.apiKey, baseURL: 'https://api.openai.com/v1' })
  }

  // OpenRouter key
  return createOpenAIClient({ apiKey: resolved.apiKey })
}
