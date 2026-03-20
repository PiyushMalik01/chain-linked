/**
 * Extension Auth Callback Page
 * @description After the user signs in on the platform (e.g. via Google OAuth),
 * this page grabs the Supabase session and sends it to the ChainLinked Chrome
 * extension via window.postMessage. The extension's webapp-relay content script
 * picks it up and forwards it to the service worker.
 * @module app/auth/extension-callback
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Extension callback page component
 * Transfers the Supabase session to the Chrome extension
 */
export default function ExtensionCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'no-session'>('loading')

  useEffect(() => {
    const supabase = createClient()

    /**
     * Post session to the extension's webapp-relay content script
     * @param session - Supabase session to transfer
     */
    function postSessionToExtension(session: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }) {
      window.postMessage({
        type: '__CL_AUTH_SESSION__',
        payload: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
          user: {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          },
        },
      }, window.location.origin)

      setStatus('success')
    }

    async function transferSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        postSessionToExtension(session)
        return
      }

      // Session may not be hydrated yet after OAuth redirect.
      // Wait for onAuthStateChange to deliver it (up to 5 seconds).
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, newSession) => {
          if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && newSession) {
            subscription.unsubscribe()
            clearTimeout(timeout)
            postSessionToExtension(newSession)
          }
        }
      )

      const timeout = setTimeout(() => {
        subscription.unsubscribe()
        setStatus('no-session')
      }, 5000)
    }

    transferSession()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Connecting to extension...</p>
        </div>
      </div>
    )
  }

  if (status === 'no-session') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <span className="text-amber-600 text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold">Not signed in</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in first, then return to this page.
          </p>
          <a
            href="/login?redirect=/auth/extension-callback"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold">Connected to extension!</h1>
        <p className="text-sm text-muted-foreground">
          Your session has been sent to the ChainLinked extension. You can close this tab and return to the extension.
        </p>
      </div>
    </div>
  )
}
