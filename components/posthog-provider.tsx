"use client"

/**
 * PostHog Provider
 * @description Initializes PostHog analytics with session replay, network recording,
 * console log capture, and performance monitoring
 * @module components/posthog-provider
 */

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { PostHogProvider as PostHogProviderBase } from "posthog-js/react"

import { useAuthContext } from "@/lib/auth/auth-provider"

/**
 * Props for the PostHogProvider component
 */
interface PostHogProviderProps {
  /** Child nodes to render inside the provider */
  children: React.ReactNode
}

/**
 * PostHogProvider wrapper with safe client initialization
 * Includes full session replay with network recording, console logs, and performance monitoring
 * @param props - Provider props
 * @param props.children - Child nodes
 * @returns Provider-wrapped children
 */
export function PostHogProvider({ children }: PostHogProviderProps): React.ReactNode {
  const [isReady, setIsReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest"

  useEffect(() => {
    if (!apiKey || apiKey.includes("YOUR_PROJECT_API_KEY_HERE")) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PostHog] Missing or placeholder NEXT_PUBLIC_POSTHOG_KEY - analytics disabled")
      }
      return
    }

    // Prevent re-initialization (important for React Strict Mode)
    if (posthog.__loaded) {
      setIsReady(true)
      return
    }

    console.log("[PostHog] Initializing with config:", {
      api_host: apiHost,
      api_key: apiKey?.substring(0, 10) + "...",
      enable_heatmaps: true,
      session_recording: true,
      autocapture: true,
    })

    posthog.init(apiKey, {
      api_host: apiHost,
      ui_host: "https://us.posthog.com",

      // Core capture settings
      autocapture: true,
      capture_pageview: false, // We handle this manually for SPA navigation
      capture_pageleave: true, // Required for scrollmap heatmaps

      // Heatmaps - mouse movement and attention tracking
      enable_heatmaps: true,

      // Session Recording Configuration - Full replay capabilities
      disable_session_recording: false,

      // Enable console log recording for debugging
      enable_recording_console_log: true,

      // Console logs capture configuration
      logs: {
        captureConsoleLogs: true,
      },

      session_recording: {
        // Network recording - capture API calls and responses
        recordHeaders: true,
        recordBody: true,

        // Mask captured network requests for privacy
        maskCapturedNetworkRequestFn: (request) => {
          // Mask authorization headers
          if (request.requestHeaders) {
            const sensitiveHeaders = ["authorization", "cookie", "x-api-key", "x-auth-token"]
            for (const header of sensitiveHeaders) {
              if (request.requestHeaders[header]) {
                request.requestHeaders[header] = "***REDACTED***"
              }
            }
          }

          // Mask sensitive body content
          if (request.requestBody && typeof request.requestBody === "string") {
            try {
              const parsed = JSON.parse(request.requestBody)
              const sensitiveFields = ["password", "api_key", "apiKey", "secret", "token", "authorization"]
              for (const field of sensitiveFields) {
                if (parsed[field]) parsed[field] = "***"
              }
              request.requestBody = JSON.stringify(parsed)
            } catch {
              // Not JSON, leave as-is
            }
          }

          return request
        },

        // Text and input masking for privacy
        maskAllInputs: false, // We use selective masking instead
        maskTextSelector: '[type="password"], [data-sensitive], [name*="api_key"], [name*="apiKey"], [name*="secret"], [name*="token"], .sensitive-data',
        maskInputFn: (text, element) => {
          const el = element as HTMLInputElement | undefined
          if (
            el?.type === "password" ||
            el?.dataset?.sensitive === "true" ||
            el?.name?.toLowerCase().includes("api_key") ||
            el?.name?.toLowerCase().includes("apikey") ||
            el?.name?.toLowerCase().includes("secret") ||
            el?.name?.toLowerCase().includes("token") ||
            el?.classList?.contains("sensitive-data")
          ) {
            return "*".repeat(text.length)
          }
          return text
        },

        // Block specific elements from recording
        blockClass: "ph-no-capture",

        // Enable canvas recording for carousel editor
        captureCanvas: {
          recordCanvas: true,
          canvasFps: 4,
          canvasQuality: "0.4",
        },

        // Cross-origin iframe recording
        recordCrossOriginIframes: false,
      },

      // Feature flags
      advanced_disable_feature_flags: false,

      // Persistence
      persistence: "localStorage+cookie",

      // Bootstrap feature flags from server if available
      bootstrap: {},

      // Debug mode in development
      debug: process.env.NODE_ENV === "development",
    })

    setIsReady(true)

    // Log feature status after init
    console.log("[PostHog] Initialized successfully:", {
      sessionRecordingActive: posthog.sessionRecordingStarted?.() ?? "unknown",
      sessionId: posthog.get_session_id?.() ?? "unknown",
      distinctId: posthog.get_distinct_id?.(),
      heatmapsEnabled: true,
      proxyHost: apiHost,
    })

    // Note: We intentionally don't call posthog.reset() on cleanup
    // as it fragments sessions during React Strict Mode remounts
    // and hot module replacement in development
  }, [apiKey, apiHost])

  return (
    <PostHogProviderBase client={posthog}>
      {isReady ? (
        <Suspense fallback={null}>
          <PostHogPageview />
        </Suspense>
      ) : null}
      {children}
    </PostHogProviderBase>
  )
}

/**
 * Tracks page views on route changes.
 * Must be wrapped in Suspense due to useSearchParams.
 * @returns null
 */
function PostHogPageview(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const url = useMemo(() => {
    const search = searchParams?.toString()
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])

  /**
   * Derives the dashboard section from the current pathname.
   */
  const dashboardSection = useMemo(() => {
    if (!pathname) return null
    const match = pathname.match(/^\/dashboard\/(.+?)(?:\/|$)/)
    return match ? match[1] : pathname === "/dashboard" ? "overview" : null
  }, [pathname])

  useEffect(() => {
    console.log("[PostHog] Capturing pageview:", { url, dashboardSection })
    posthog.capture("$pageview", {
      $current_url: url,
      page_title: typeof document !== "undefined" ? document.title : undefined,
      dashboard_section: dashboardSection,
    })
  }, [url, dashboardSection])

  return null
}

/**
 * Syncs authenticated user identity to PostHog.
 * Must be rendered inside AuthProvider to access user context.
 * Exported separately to avoid circular dependency issues.
 * @returns null
 */
export function PostHogUserSync(): null {
  const { user, profile } = useAuthContext()
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    if (!apiKey || !posthog.__loaded) {
      return
    }

    if (!user) {
      // User logged out - reset PostHog identity
      // This ensures the next user gets a fresh anonymous ID
      posthog.reset()
      return
    }

    // Identify the authenticated user
    const userName = profile?.full_name ?? profile?.name ?? user.user_metadata?.name
    console.log("[PostHog] Identifying user:", { id: user.id, email: user.email, name: userName })
    posthog.identify(user.id, {
      email: user.email,
      name: userName,
      subscription_tier: (profile as unknown as Record<string, unknown> | null)?.subscription_tier ?? user.user_metadata?.subscription_tier ?? "free",
    })
  }, [apiKey, user, profile])

  return null
}
