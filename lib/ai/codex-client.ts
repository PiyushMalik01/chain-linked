/**
 * ChatGPT Codex Responses API Client
 *
 * Routes through chatgpt.com/backend-api/codex/responses using the user's
 * ChatGPT Plus/Pro subscription. Uses the Responses API format (not Chat
 * Completions) with mandatory streaming.
 *
 * @module lib/ai/codex-client
 */

/** Codex backend endpoint */
const CODEX_URL = 'https://chatgpt.com/backend-api/codex/responses'

/** Default model for Codex — gpt-4o is NOT supported, must use gpt-5.x */
const CODEX_MODEL = 'gpt-5.4'

/**
 * Build standard Codex request headers.
 */
function buildHeaders(
  accessToken: string,
  accountId: string | null | undefined,
  accept = 'text/event-stream'
): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': accept,
  }
  if (accountId) {
    headers['chatgpt-account-id'] = accountId
  }
  return headers
}

/**
 * Parse the SSE stream from the Codex Responses API and extract the full text.
 * The stream emits events like response.output_text.delta with text chunks,
 * and response.completed with the final response including usage.
 */
async function consumeCodexStream(response: Response): Promise<{
  content: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let content = ''
  let model = CODEX_MODEL
  let promptTokens = 0
  let completionTokens = 0
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6)
      if (jsonStr === '[DONE]') continue

      try {
        const event = JSON.parse(jsonStr)

        // Collect text deltas
        if (event.type === 'response.output_text.delta' && event.delta) {
          content += event.delta
        }

        // Get usage from completed response
        if (event.type === 'response.completed' && event.response) {
          model = event.response.model || model
          if (event.response.usage) {
            promptTokens = event.response.usage.input_tokens ?? 0
            completionTokens = event.response.usage.output_tokens ?? 0
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return {
    content,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

/**
 * Non-streaming chat completion via Codex Responses API.
 * Internally streams (required by the endpoint) but collects the full response.
 * Automatically falls back to OpenRouter if Codex rejects the request (e.g. content moderation).
 */
export async function codexChatCompletion(
  accessToken: string,
  accountId: string | null | undefined,
  options: {
    model?: string
    systemPrompt: string
    userMessage: string
  }
): Promise<{
  content: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}> {
  const instructions = (options.systemPrompt || 'You are a helpful assistant.').toString()
  const userContent = (options.userMessage || '').toString()

  // Try Codex with sanitized content (ASCII-only, since Codex rejects non-ASCII).
  // If it fails, fall back to OpenRouter with the ORIGINAL content to preserve quality.
  const toAscii = (s: string) =>
    s.normalize('NFKD')
     .replace(/[\u0300-\u036f]/g, '')
     .replace(/\{\{#if\s+[^}]*\}\}/g, '')
     .replace(/\{\{\/if\}\}/g, '')
     .replace(/\{\{([^}]+)\}\}/g, '$1')
     .replace(/[^\x20-\x7E\n\r\t]/g, '')

  const body = {
    model: options.model || CODEX_MODEL,
    instructions: toAscii(instructions),
    input: [{ role: 'user' as const, content: toAscii(userContent) }],
    store: false,
    stream: true,
  }

  const response = await fetch(CODEX_URL, {
    method: 'POST',
    headers: buildHeaders(accessToken, accountId),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    // Fall back to OpenRouter with ORIGINAL unsanitized content (preserves quality)
    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (openRouterKey) {
      return openRouterFallback(openRouterKey, options)
    }
    const errorText = await response.text()
    throw new Error(`Codex API error (${response.status}): ${errorText.substring(0, 200)}`)
  }

  return consumeCodexStream(response)
}

/**
 * OpenRouter fallback for when Codex rejects a request.
 */
async function openRouterFallback(
  apiKey: string,
  options: { model?: string; systemPrompt: string; userMessage: string }
): Promise<{
  content: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}> {
  const model = 'openai/gpt-5.4'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai',
      'X-Title': 'ChainLinked',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userMessage },
      ],
      max_tokens: 1500,
      temperature: 0.85,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter fallback failed (${res.status}): ${errText.substring(0, 200)}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  return {
    content: choice?.message?.content || '',
    model: data.model || model,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  }
}

/**
 * Returns the raw SSE Response from the Codex Responses API for streaming to clients.
 */
export async function codexStreamResponse(
  accessToken: string,
  accountId: string | null | undefined,
  options: {
    model?: string
    systemPrompt: string
    messages: Array<{ role: string; content: string }>
  }
): Promise<Response> {
  const input = options.messages.map(msg => ({
    role: msg.role === 'system' ? 'developer' : msg.role,
    content: msg.content,
  }))

  const body = {
    model: options.model || CODEX_MODEL,
    instructions: options.systemPrompt,
    input,
    store: false,
    stream: true,
  }

  const response = await fetch(CODEX_URL, {
    method: 'POST',
    headers: buildHeaders(accessToken, accountId),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[codex-client] Stream ${response.status}:`, errorText.substring(0, 500))
    throw new Error(`Codex API error (${response.status}): ${errorText.substring(0, 200)}`)
  }

  return response
}
