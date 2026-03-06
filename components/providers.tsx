"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { PostHogProvider, PostHogUserSync } from "@/components/posthog-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DraftProvider } from "@/lib/store/draft-context"
import { AuthProvider } from "@/lib/auth/auth-provider"
import { ApiKeysProvider } from "@/hooks/use-api-keys"
import { SessionReplayDebug } from "@/components/debug/session-replay-debug"

/**
 * Global providers wrapper component.
 * Includes auth, theme provider, draft state management, PostHog analytics,
 * and toast notifications.
 *
 * Provider Order (outermost to innermost):
 * 1. ThemeProvider - Theming foundation
 * 2. AuthProvider - Authentication state (needed by PostHog for user identification)
 * 3. PostHogProvider - Analytics (wraps auth-dependent components)
 * 4. ApiKeysProvider - Shared API key status (single fetch for all consumers)
 * 5. DraftProvider - Draft state management
 */
export function Providers({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <PostHogProvider>
          <PostHogUserSync />
          <TooltipProvider>
            <ApiKeysProvider>
              <DraftProvider>
                {children}
              </DraftProvider>
            </ApiKeysProvider>
          </TooltipProvider>
        </PostHogProvider>
      </AuthProvider>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        duration={4000}
      />
      <SessionReplayDebug />
    </ThemeProvider>
  )
}
