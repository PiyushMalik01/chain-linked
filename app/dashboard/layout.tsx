/**
 * Dashboard Layout
 * @description Wraps all dashboard pages with authentication guard and shared
 * sidebar/header shell. Individual pages no longer need to repeat this boilerplate.
 * @module app/dashboard/layout
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { IconLoader2, IconX, IconInfoCircle } from '@tabler/icons-react'

import { useAuthContext } from '@/lib/auth/auth-provider'
import { DashboardProvider } from '@/lib/dashboard-context'
import { DashboardTour } from '@/components/features/dashboard-tour'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

/** localStorage key for dismissing the data sync banner */
const SYNC_BANNER_DISMISSED_KEY = 'chainlinked_sync_banner_dismissed'

/**
 * Persistent banner informing users that LinkedIn data syncing may take time
 * Dismissible via localStorage so it persists across sessions
 * @returns Dismissible banner or null if already dismissed
 */
function DataSyncBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return localStorage.getItem(SYNC_BANNER_DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(SYNC_BANNER_DISMISSED_KEY, 'true')
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  if (dismissed) return null

  return (
    <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconInfoCircle className="size-4 text-primary shrink-0" />
          <p>
            LinkedIn data syncing may take up to 24 hours. In the meantime, feel free to explore features in{' '}
            <a href="/dashboard/compose" className="text-primary font-medium hover:underline">
              Create
            </a>.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
          aria-label="Dismiss banner"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Loading component displayed while checking auth status
 * @returns Loading UI with spinner
 */
function DashboardLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading dashboard...</p>
      </div>
    </div>
  )
}

/**
 * Dashboard Layout Component
 * Provides auth guard + shared sidebar/header shell for all dashboard pages.
 *
 * @param props - Layout props
 * @param props.children - Dashboard page content
 * @returns Dashboard layout with auth guard and shared shell
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading, isAuthenticated } = useAuthContext()

  const [ready, setReady] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated || !user) {
      setRedirecting(true)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    // Auth confirmed — middleware already enforced onboarding status server-side
    setReady(true)
  }, [isLoading, isAuthenticated, user, pathname, router])

  // Show full loading only while redirecting to login (unauthenticated)
  if (redirecting) {
    return <DashboardLoadingState />
  }

  // Show the dashboard shell immediately — sidebar, header visible while content loads.
  // This gives instant visual feedback instead of a blank spinner for 5-8 seconds.
  return (
    <DashboardProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as React.CSSProperties
        }
      >
        {ready && <DashboardTour />}
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          {ready && <DataSyncBanner />}
          <main id="main-content" className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {ready ? children : (
                <div className="flex flex-1 items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DashboardProvider>
  )
}
