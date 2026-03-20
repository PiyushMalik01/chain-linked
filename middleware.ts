/**
 * Next.js Middleware for Supabase Authentication and Onboarding
 * @description Handles session refresh, auth redirects, and onboarding guards
 * @module middleware
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * All paths that are part of the onboarding flow (step-based and legacy)
 * Users are allowed to access these even if onboarding is not complete
 * Step 4 is the final step (Review & Complete)
 */
const ONBOARDING_STEP_PATHS = [
  '/onboarding',
  '/onboarding/step1',
  '/onboarding/step2',
  '/onboarding/step3',
  '/onboarding/step4',
  '/onboarding/join',
  '/onboarding/company',
  '/onboarding/company-context',
  '/onboarding/invite',
  '/onboarding/brand-kit',
]

/**
 * Middleware to handle Supabase authentication and onboarding
 * - Refreshes user session tokens
 * - Protects routes that require authentication
 * - Redirects users to company onboarding if not completed
 * @param request - Incoming request
 * @returns Response with updated cookies or redirect
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session - IMPORTANT: avoid writing logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/composer', '/schedule', '/team', '/templates', '/settings', '/onboarding']
  const isProtectedPath = protectedPaths.some(path =>
    pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Auth pages that should redirect logged-in users
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some(path =>
    pathname === path
  )

  if (isAuthPath && user) {
    // Check if there's a redirect param (e.g., for invitation acceptance)
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    if (redirectParam && redirectParam.startsWith('/invite/')) {
      // Before redirecting to invite, check if user has completed onboarding
      // If not, redirect to onboarding first (the invite can be accepted after)
      try {
        const { data: inviteProfile } = await Promise.race([
          supabase
            .from('profiles')
            .select('onboarding_completed, onboarding_current_step, company_onboarding_completed, onboarding_type')
            .eq('id', user.id)
            .single(),
          new Promise<{ data: null; error: null }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: null }), 8000)
          ),
        ])

        if (inviteProfile && inviteProfile.onboarding_completed !== true && inviteProfile.company_onboarding_completed !== true) {
          // User hasn't completed onboarding - redirect to role selection or their current path
          const url = request.nextUrl.clone()
          url.search = ''

          if (!inviteProfile.onboarding_type) {
            // No type chosen yet - go to role selection
            url.pathname = '/onboarding'
          } else if (inviteProfile.onboarding_type === 'member') {
            url.pathname = '/onboarding/join'
          } else {
            const rawStep = inviteProfile.onboarding_current_step ?? 1
            const step = Math.min(Math.max(rawStep, 1), 4)
            url.pathname = `/onboarding/step${step}`
          }
          return NextResponse.redirect(url)
        }
      } catch {
        // Fail-open: if the profile check fails, allow the invite redirect
      }

      // Allow redirect to invitation acceptance page
      const url = request.nextUrl.clone()
      url.pathname = redirectParam
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Allow redirect to extension callback (extension Google sign-in flow)
    if (redirectParam === '/auth/extension-callback') {
      const url = request.nextUrl.clone()
      url.pathname = redirectParam
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Default redirect to dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Cache profile data to avoid duplicate queries
  // Only fetch if we need it for dashboard or onboarding route checks
  let profile: {
    onboarding_completed: boolean | null
    onboarding_current_step: number | null
    company_onboarding_completed: boolean | null
    onboarding_type: string | null
  } | null = null

  const needsProfileCheck =
    pathname.startsWith('/dashboard') ||
    ONBOARDING_STEP_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))

  if (user && needsProfileCheck) {
    try {
      const profileQuery = supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_current_step, company_onboarding_completed, onboarding_type')
        .eq('id', user.id)
        .single()

      // Race the profile query against an 8-second timeout (fail-open)
      const result = await Promise.race([
        profileQuery,
        new Promise<{ data: null; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: null }), 8000)
        ),
      ])

      profile = result.data
    } catch {
      // Fail-open: if the query errors, allow the request to proceed
      profile = null
    }
  }

  // Onboarding guard for dashboard routes
  // Only redirect when we have a definitive profile response (not on timeout/error)
  if (user && pathname.startsWith('/dashboard') && profile) {
    const isOnboardingDone =
      profile.onboarding_completed === true ||
      profile.company_onboarding_completed === true

    if (!isOnboardingDone) {
      const url = request.nextUrl.clone()

      if (!profile.onboarding_type) {
        // No type chosen yet - go to role selection
        url.pathname = '/onboarding'
      } else if (profile.onboarding_type === 'member') {
        // Individual path
        url.pathname = '/onboarding/join'
      } else {
        // Company/owner path - go to their current step
        const rawStep = profile.onboarding_current_step ?? 1
        const step = Math.min(Math.max(rawStep, 1), 4)
        url.pathname = `/onboarding/step${step}`
      }
      return NextResponse.redirect(url)
    }
  }

  // If user is on any onboarding page but has already completed onboarding,
  // redirect to dashboard
  if (user && profile && ONBOARDING_STEP_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    const isOnboardingDone =
      profile.onboarding_completed === true ||
      profile.company_onboarding_completed === true

    if (isOnboardingDone) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

/**
 * Matcher configuration - exclude static assets and API routes that handle their own auth
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
