/**
 * WebApp Bridge Content Script
 * @description Runs on the ChainLinked web app domain (localhost / production)
 * to inject markers that allow the web app to detect the extension.
 * Registered in manifest.json with "world": "MAIN" so it shares the
 * page's JavaScript context.
 * @module extension/src/content/webapp-bridge
 */

// Inject global variable marker
;(window as Window & { __CHAINLINKED_EXTENSION__?: boolean }).__CHAINLINKED_EXTENSION__ = true

// Inject hidden DOM marker with version
const marker = document.createElement('div')
marker.id = 'chainlinked-extension-marker'
marker.setAttribute('data-version', chrome?.runtime?.getManifest?.()?.version ?? 'unknown')
marker.style.display = 'none'
document.documentElement.appendChild(marker)

// Listen for ping events from the web app and respond with pong
window.addEventListener('chainlinked-extension-ping', () => {
  window.dispatchEvent(new CustomEvent('chainlinked-extension-pong'))
})

// Listen for status request from the web app and relay through ISOLATED world
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if (event.data?.type !== '__CL_STATUS_REQUEST__') return

  // Forward to ISOLATED world relay which has chrome.runtime access
  window.postMessage({
    type: '__CL_STATUS_RELAY__',
    payload: { requestId: event.data.requestId },
  }, window.location.origin)
})

/** Allowed origins for postMessage communication */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://chainlinked.app',
  'https://www.chainlinked.app',
  'https://chainlinked.ai',
  'https://www.chainlinked.ai',
]

// Listen for mention search requests from the web app
// Relays to the ISOLATED world webapp-relay script via postMessage
// (MAIN world cannot call chrome.runtime.sendMessage without an extension ID)
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  // Verify origin to prevent cross-origin message injection
  if (!ALLOWED_ORIGINS.includes(event.origin)) return
  if (event.data?.type !== 'CHAINLINKED_MENTION_SEARCH') return

  const { query, requestId } = event.data
  console.log(`[ChainLinked Bridge] Mention search request: "${query}" (reqId=${requestId})`)

  // Forward to ISOLATED world relay via postMessage (uses __CL_MENTION_SEARCH__ type)
  // The relay script has chrome.runtime access and will forward to the service worker
  window.postMessage({
    type: '__CL_MENTION_SEARCH__',
    payload: { query, requestId },
  }, window.location.origin)
})

console.log('[ChainLinked Extension] WebApp bridge loaded')
