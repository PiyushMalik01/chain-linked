/**
 * LinkedIn Search via Extension
 * @description Sends search queries to the ChainLinked Chrome extension which
 * makes Voyager API calls using its own session cookies. Cookies never leave
 * the extension — only parsed results are returned to the web app.
 * Uses window.postMessage to communicate with the extension's webapp-bridge
 * content script, so no extension ID is needed.
 * @module lib/extension/linkedin-search
 */

/**
 * Mention search result returned by the extension
 */
export interface ExtensionMentionResult {
  /** Display name */
  name: string
  /** LinkedIn URN (urn:li:person:xxx or urn:li:organization:xxx) */
  urn: string
  /** Professional headline (person) or tagline/industry (company) */
  headline: string | null
  /** Profile picture or company logo URL */
  avatarUrl: string | null
  /** Public profile identifier (person) or universal name slug (company) */
  publicIdentifier: string | null
  /** Entity type — person or company/page */
  type?: 'person' | 'company'
}

/** Counter for unique request IDs */
let requestCounter = 0

/**
 * Search LinkedIn users via the ChainLinked extension.
 * The extension reads cookies internally and makes the Voyager API call —
 * no credentials are sent to or stored by the web app.
 * Uses window.postMessage → webapp-bridge → service worker → Voyager API.
 * @param query - Search query string (name or keyword)
 * @returns Array of matching profiles, or null if extension unavailable
 */
export async function searchLinkedInViaExtension(
  query: string
): Promise<ExtensionMentionResult[] | null> {
  if (typeof window === 'undefined') {
    console.log('[MentionSearch:Web] SSR environment — skipping extension search')
    return null
  }

  // Check if extension bridge is available
  const ext = (window as Window & { __CHAINLINKED_EXTENSION__?: boolean }).__CHAINLINKED_EXTENSION__
  if (!ext) {
    console.log('[MentionSearch:Web] Extension not detected — __CHAINLINKED_EXTENSION__ is falsy')
    return null
  }

  const requestId = `mention_${++requestCounter}_${Date.now()}`
  console.log(`[MentionSearch:Web] Sending search via postMessage: "${query}" (reqId=${requestId})`)

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[MentionSearch:Web] Extension search timed out after 12s')
      window.removeEventListener('message', handler)
      resolve(null)
    }, 12000)

    function handler(event: MessageEvent) {
      if (event.source !== window) return
      if (event.data?.type !== 'CHAINLINKED_MENTION_SEARCH_RESULT') return
      if (event.data?.requestId !== requestId) return

      clearTimeout(timeout)
      window.removeEventListener('message', handler)

      const { success, results, error } = event.data
      console.log(`[MentionSearch:Web] Got response: success=${success}, results=${results?.length ?? 0}${error ? ', error=' + error : ''}`)

      if (success && results?.length > 0) {
        resolve(results)
      } else {
        resolve(null)
      }
    }

    window.addEventListener('message', handler)

    // Send search request to extension's webapp-bridge via postMessage
    window.postMessage({
      type: 'CHAINLINKED_MENTION_SEARCH',
      query,
      requestId,
    }, '*')
  })
}
