/**
 * WebApp Relay Content Script (ISOLATED World)
 * @description Runs on the ChainLinked web app domain in ISOLATED world,
 * which has full access to chrome.runtime APIs without needing an extension ID.
 * Listens for postMessage from the MAIN world webapp-bridge and relays
 * requests to the service worker via chrome.runtime.sendMessage().
 * Results are relayed back to the MAIN world via window.postMessage.
 * @module extension/src/content/webapp-relay
 */

// Listen for messages from the MAIN world webapp-bridge
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return

  // Relay auth session from the extension-callback page to the service worker
  if (event.data?.type === '__CL_AUTH_SESSION__' && event.data?.payload) {
    const session = event.data.payload
    console.log('[ChainLinked Relay] Received auth session, forwarding to service worker')

    chrome.runtime.sendMessage(
      { type: 'EXTENSION_AUTH_SESSION', data: session },
      (response: unknown) => {
        const error = chrome.runtime?.lastError
        if (error) {
          console.error('[ChainLinked Relay] Failed to send auth session:', error.message)
          return
        }
        console.log('[ChainLinked Relay] Auth session forwarded successfully:', response)
      }
    )
    return
  }

  // Relay status request to the service worker
  if (event.data?.type === '__CL_STATUS_RELAY__' && event.data?.payload) {
    const { requestId } = event.data.payload
    console.log('[ChainLinked Relay] Forwarding status request to service worker')

    chrome.runtime.sendMessage(
      { type: 'CHAINLINKED_PING' },
      (response: unknown) => {
        const error = chrome.runtime?.lastError
        if (error) {
          console.error('[ChainLinked Relay] Status request error:', error.message)
          window.postMessage({
            type: '__CL_STATUS_RESPONSE__',
            requestId,
            status: null,
          }, window.location.origin)
          return
        }

        // Internal handler wraps response as { success, data: { installed, ... } }
        const raw = response as { success?: boolean; data?: Record<string, unknown> } | null
        const statusData = raw?.data ?? raw
        console.log('[ChainLinked Relay] Status response:', statusData)
        window.postMessage({
          type: '__CL_STATUS_RESPONSE__',
          requestId,
          status: statusData,
        }, window.location.origin)
      }
    )
    return
  }

  // Relay mention search requests to the service worker
  if (event.data?.type === '__CL_MENTION_SEARCH__' && event.data?.payload) {
    const { query, requestId } = event.data.payload
    console.log(`[ChainLinked Relay] Forwarding mention search to service worker: "${query}" (reqId=${requestId})`)

    chrome.runtime.sendMessage(
      { type: 'LINKEDIN_MENTION_SEARCH', query },
      (response: unknown) => {
        const error = chrome.runtime?.lastError
        if (error) {
          console.error('[ChainLinked Relay] Service worker error:', error.message)
          window.postMessage({
            type: 'CHAINLINKED_MENTION_SEARCH_RESULT',
            requestId,
            success: false,
            results: [],
            error: error.message,
          }, window.location.origin)
          return
        }

        // Internal message handler wraps result as { success, data: { success, results } }
        const raw = response as { success: boolean; data?: { success: boolean; results: unknown[]; error?: string }; error?: string } | null
        const searchData = raw?.data ?? raw
        const resp = searchData as { success: boolean; results: unknown[]; error?: string } | null
        console.log(`[ChainLinked Relay] Search response: success=${resp?.success}, results=${resp?.results?.length ?? 0}`)

        window.postMessage({
          type: 'CHAINLINKED_MENTION_SEARCH_RESULT',
          requestId,
          success: resp?.success ?? false,
          results: resp?.results ?? [],
          error: resp?.error,
        }, window.location.origin)
      }
    )
  }
})

// Listen for auth state change broadcasts from the service worker
// and forward them to the page so the platform can update instantly
chrome.runtime.onMessage.addListener((message: { type?: string; event?: string; platformLoggedIn?: boolean }) => {
  if (message?.type === 'CHAINLINKED_AUTH_STATE_CHANGED') {
    window.postMessage({
      type: '__CL_AUTH_STATE_CHANGED__',
      event: message.event,
      platformLoggedIn: message.platformLoggedIn,
    }, window.location.origin)
  }
})

console.log('[ChainLinked Extension] WebApp relay (ISOLATED world) loaded')
