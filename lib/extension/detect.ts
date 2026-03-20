/**
 * Chrome Extension Detection Utilities
 * @description Detects if the ChainLinked Chrome extension is installed
 * using multiple methods with sessionStorage caching.
 * @module lib/extension/detect
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any

/** Extension ID for ChainLinked Chrome extension */
export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || 'chainlinked-extension'

/** Chrome Web Store URL for the extension */
export const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || 'https://chrome.google.com/webstore/detail/chainlinked'

/** Local storage key for dismissing the extension prompt */
export const DISMISS_PROMPT_KEY = 'chainlinked_extension_prompt_dismissed'

/** Local storage key for tracking prompt dismissal timestamp */
export const DISMISS_PROMPT_TIMESTAMP_KEY = 'chainlinked_extension_prompt_dismissed_at'

/** Session storage key for caching detection result */
const SESSION_CACHE_KEY = 'chainlinked_extension_detected'

/** Session storage key for caching extension status details */
const SESSION_STATUS_KEY = 'chainlinked_extension_status'

/**
 * Extension status details returned from the extension PING
 */
export interface ExtensionStatus {
  /** Whether the extension is installed */
  installed: boolean
  /** Whether the user is logged into LinkedIn in the browser */
  linkedInLoggedIn: boolean
  /** Whether the user is logged into ChainLinked platform in the extension */
  platformLoggedIn: boolean
  /** Email of the user logged into the extension (null if not logged in) */
  extensionUserEmail?: string | null
}

/**
 * Get the cached extension status from sessionStorage
 * @returns Cached status or null if not available
 */
export function getCachedExtensionStatus(): ExtensionStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = sessionStorage.getItem(SESSION_STATUS_KEY)
    if (cached) return JSON.parse(cached) as ExtensionStatus
  } catch {
    // noop
  }
  return null
}

/**
 * Cache the extension status in sessionStorage
 * @param status - Extension status to cache
 */
function cacheStatus(status: ExtensionStatus): void {
  try {
    sessionStorage.setItem(SESSION_STATUS_KEY, JSON.stringify(status))
  } catch {
    // noop
  }
}

/** Session storage key for per-session dismissal (resets on logout/tab close) */
const SESSION_DISMISS_KEY = 'chainlinked_extension_prompt_session_dismissed'

/**
 * Check if the ChainLinked extension is installed using multiple detection methods.
 * Results are cached in sessionStorage so detection only runs once per session.
 * @param skipCache - If true, bypass the session cache and re-run detection
 * @returns Promise resolving to true if extension is detected
 */
export async function isExtensionInstalled(skipCache = false): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  // Check session cache first
  if (!skipCache) {
    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY)
      if (cached !== null) {
        return cached === 'true'
      }
    } catch {
      // sessionStorage may be blocked
    }
  }

  try {
    let detected = false

    // Method 1: Check for extension-injected global variable
    if ((window as Window & { __CHAINLINKED_EXTENSION__?: boolean }).__CHAINLINKED_EXTENSION__) {
      detected = true
    }

    // Method 2: Check for custom DOM element injected by extension
    if (!detected) {
      const extensionMarker = document.getElementById('chainlinked-extension-marker')
      if (extensionMarker) {
        detected = true
      }
    }

    // Method 3: Dispatch custom event and wait for response
    if (!detected) {
      const eventResult = await checkExtensionViaEvent()
      if (eventResult) {
        detected = true
      }
    }

    // Method 4: External messaging via chrome.runtime.sendMessage
    if (!detected) {
      const externalResult = await checkExtensionViaExternalMessage()
      if (externalResult) {
        detected = true
      }
    }

    // If extension was detected, fetch live status via content script relay
    // (works without knowing the extension ID, unlike chrome.runtime.sendMessage)
    if (detected) {
      await fetchExtensionStatusViaRelay()
    }

    cacheResult(detected)
    return detected
  } catch (error) {
    console.warn('[Extension Detection] Error checking extension:', error)
    return false
  }
}

/**
 * Cache the detection result in sessionStorage
 * @param detected - Whether the extension was detected
 */
function cacheResult(detected: boolean): void {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, String(detected))
  } catch {
    // sessionStorage may be blocked
  }
}

/**
 * Fetch extension login status via window.postMessage relay through the content script.
 * This works without knowing the extension ID (unlike chrome.runtime.sendMessage).
 * @returns Promise that resolves when status is received or times out
 */
function fetchExtensionStatusViaRelay(): Promise<void> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2)
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResponse)
      console.warn('[Extension Detection] Status relay timed out')
      resolve()
    }, 2000)

    function handleResponse(event: MessageEvent) {
      if (event.source !== window) return
      if (event.data?.type !== '__CL_STATUS_RESPONSE__') return
      if (event.data?.requestId !== requestId) return

      clearTimeout(timeout)
      window.removeEventListener('message', handleResponse)

      const response = event.data.status
      console.log('[Extension Detection] Status relay response:', response)
      if (response?.installed) {
        cacheStatus({
          installed: true,
          linkedInLoggedIn: response?.linkedInLoggedIn === true,
          platformLoggedIn: response?.platformLoggedIn === true,
          extensionUserEmail: response?.email || null,
        })
      }
      resolve()
    }

    window.addEventListener('message', handleResponse)
    window.postMessage({
      type: '__CL_STATUS_REQUEST__',
      requestId,
    }, window.location.origin)
  })
}

/**
 * Check for extension by dispatching a custom event and listening for response
 * @returns Promise resolving to true if extension responds
 */
function checkExtensionViaEvent(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('chainlinked-extension-pong', handlePong)
      resolve(false)
    }, 500)

    function handlePong() {
      clearTimeout(timeout)
      window.removeEventListener('chainlinked-extension-pong', handlePong)
      resolve(true)
    }

    window.addEventListener('chainlinked-extension-pong', handlePong)
    window.dispatchEvent(new CustomEvent('chainlinked-extension-ping'))
  })
}

/**
 * Check for extension via chrome.runtime.sendMessage (external messaging)
 * Most reliable method when extension is configured with externally_connectable
 * @returns Promise resolving to true if extension responds
 */
function checkExtensionViaExternalMessage(): Promise<boolean> {
  return new Promise((resolve) => {
    // chrome.runtime.sendMessage is only available in Chrome-based browsers
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve(false)
      return
    }

    const timeout = setTimeout(() => resolve(false), 1000)

    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'CHAINLINKED_PING' },
        (response: any) => {
          clearTimeout(timeout)
          if (chrome.runtime.lastError) {
            // Extension not installed or not connectable
            resolve(false)
            return
          }
          const installed = response?.installed === true
          if (installed) {
            // Cache the full status including login states and email
            cacheStatus({
              installed: true,
              linkedInLoggedIn: response?.linkedInLoggedIn === true,
              platformLoggedIn: response?.platformLoggedIn === true,
              extensionUserEmail: response?.email || null,
            })
          }
          resolve(installed)
        }
      )
    } catch {
      clearTimeout(timeout)
      resolve(false)
    }
  })
}

/**
 * Listen for real-time auth state changes from the extension.
 * When the extension signs in or out, it broadcasts a message via the content script.
 * @param callback - Called with the updated status when auth state changes
 * @returns Cleanup function to remove the listener
 */
export function onExtensionAuthStateChange(callback: (status: ExtensionStatus) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type !== '__CL_AUTH_STATE_CHANGED__') return

    const status: ExtensionStatus = {
      installed: true,
      linkedInLoggedIn: getCachedExtensionStatus()?.linkedInLoggedIn ?? false,
      platformLoggedIn: event.data.platformLoggedIn === true,
      extensionUserEmail: event.data.platformLoggedIn ? getCachedExtensionStatus()?.extensionUserEmail : null,
    }
    cacheStatus(status)
    callback(status)
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

/**
 * Check if the prompt has been dismissed
 * Permanent dismissal uses localStorage (survives logout).
 * Temporary dismissal ("Remind me later") uses sessionStorage (resets on logout/tab close).
 * @returns true if prompt should be hidden
 */
export function isPromptDismissed(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    // Check permanent dismissal (localStorage)
    const permanentlyDismissed = localStorage.getItem(DISMISS_PROMPT_KEY)
    if (permanentlyDismissed === 'true') {
      return true
    }

    // Check session dismissal (sessionStorage - resets on logout/tab close)
    const sessionDismissed = sessionStorage.getItem(SESSION_DISMISS_KEY)
    if (sessionDismissed === 'true') {
      return true
    }

    return false
  } catch (error) {
    console.warn('[Extension Detection] Error checking prompt dismissed state:', error)
    return false
  }
}

/**
 * Dismiss the extension prompt
 * @param permanent - If true, dismiss permanently in localStorage. Otherwise dismiss for current session only.
 */
export function dismissPrompt(permanent = false): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (permanent) {
      // Permanent: store in localStorage (survives logout)
      localStorage.setItem(DISMISS_PROMPT_KEY, 'true')
    } else {
      // Temporary: store in sessionStorage (resets when user logs out or closes tab)
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true')
    }
  } catch (error) {
    console.warn('[Extension Detection] Error dismissing prompt:', error)
  }
}

/**
 * Reset the prompt dismissal state (both permanent and session)
 */
export function resetPromptDismissal(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(DISMISS_PROMPT_KEY)
    localStorage.removeItem(DISMISS_PROMPT_TIMESTAMP_KEY)
    sessionStorage.removeItem(SESSION_DISMISS_KEY)
  } catch (error) {
    console.warn('[Extension Detection] Error resetting prompt:', error)
  }
}

/**
 * Check if extension prompt should be shown
 * @returns Promise resolving to true if prompt should be shown
 */
export async function shouldShowExtensionPrompt(): Promise<boolean> {
  if (isPromptDismissed()) {
    return false
  }

  const installed = await isExtensionInstalled()
  if (installed) {
    return false
  }

  return true
}
