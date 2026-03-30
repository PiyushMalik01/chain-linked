/**
 * Auth Provider
 * @description React context provider for authentication state with LinkedIn profile data
 * @module lib/auth/auth-provider
 */

'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isExtensionInstalled as detectExtension, getCachedExtensionStatus, onExtensionAuthStateChange, pushSessionToExtension, type ExtensionStatus } from '@/lib/extension/detect'
import type { User, Session } from '@supabase/supabase-js'

/**
 * LinkedIn profile data type
 * Matches the database schema with extended raw_data typing
 */
export interface LinkedInProfile {
  id: string
  user_id: string
  profile_urn: string | null
  public_identifier: string | null
  first_name: string | null
  last_name: string | null
  headline: string | null
  location: string | null
  industry: string | null
  profile_picture_url: string | null
  background_image_url: string | null
  connections_count: number | null
  followers_count: number | null
  summary: string | null
  raw_data: {
    name?: string
    headline?: string
    profilePhotoUrl?: string
    backgroundPhotoUrl?: string
    location?: string
    industry?: string
    about?: string
    currentCompany?: string
    education?: string
    profileUrl?: string
    [key: string]: unknown
  } | null
  captured_at: string | null
  updated_at: string | null
}

/**
 * LinkedIn analytics data type
 * Note: Numeric fields can be null when data hasn't been captured yet
 */
export interface LinkedInAnalytics {
  id: string
  user_id: string
  page_type: string
  impressions: number | null
  members_reached: number | null
  engagements: number | null
  new_followers: number | null
  profile_views: number | null
  search_appearances: number | null
  top_posts: unknown[] | null
  raw_data: {
    impressionGrowth?: number
    [key: string]: unknown
  } | null
  captured_at: string | null
  updated_at: string | null
}

/**
 * Profile data from profiles table
 */
export interface ProfileData {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  created_at: string | null
  linkedin_access_token: string | null
  linkedin_user_id: string | null
  linkedin_connected_at: string | null
  linkedin_token_expires_at: string | null
  /** LinkedIn profile picture URL (from OAuth) */
  linkedin_avatar_url: string | null
  /** LinkedIn headline */
  linkedin_headline: string | null
  /** LinkedIn profile URL */
  linkedin_profile_url: string | null
  /** Whether the user has completed company onboarding */
  company_onboarding_completed: boolean
  /** Company name for AI context */
  company_name: string | null
  /** Company website URL */
  company_website: string | null
  /** Whether the user has completed the full onboarding flow */
  onboarding_completed: boolean
  /** Current step in the onboarding flow (1-4) */
  onboarding_current_step: number
  /** Whether the user has completed the dashboard tour */
  dashboard_tour_completed: boolean
  /** User onboarding type: 'owner' (org) or 'member' (individual) */
  onboarding_type: string | null
  /** Whether the Chrome extension is currently logged in */
  extension_logged_in: boolean
  /** Last time the extension was active */
  extension_last_active_at: string | null
}

/**
 * Extended user profile with LinkedIn data
 */
export interface UserProfileWithLinkedIn extends ProfileData {
  name?: string | null
  linkedin_profile?: LinkedInProfile | null
  linkedin_analytics?: LinkedInAnalytics | null
}

/**
 * Auth context type definition
 */
interface AuthContextType {
  user: User | null
  profile: UserProfileWithLinkedIn | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  /** Whether the user has completed company onboarding */
  hasCompletedCompanyOnboarding: boolean
  /** Whether the user has completed the full onboarding flow */
  hasCompletedOnboarding: boolean
  /** Current step in the onboarding flow (1-4) */
  currentOnboardingStep: number
  /** Whether the Chrome extension is installed (null = not checked yet) */
  extensionInstalled: boolean | null
  /** Detailed extension status (installed, LinkedIn logged in, platform logged in) */
  extensionStatus: ExtensionStatus | null
  /** Force re-check extension status */
  checkExtension: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Auth Provider Component
 * Provides authentication state to the entire app
 * @param props - Provider props
 * @returns Auth context provider
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfileWithLinkedIn | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null)
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null)

  // Refs to hold latest state without causing re-renders
  // Used by callbacks that need current state but shouldn't trigger re-renders
  const profileRef = useRef<UserProfileWithLinkedIn | null>(null)
  const userRef = useRef<User | null>(null)

  // Keep refs in sync with state
  profileRef.current = profile
  userRef.current = user

  // Memoize the Supabase client to prevent re-creation on every render
  const supabase = useMemo(() => createClient(), [])

  /**
   * Fetch user profile with LinkedIn data from database
   * Runs queries in parallel for better performance
   * Uses maybeSingle() to gracefully handle missing records
   * @param userId - User ID to fetch profile for
   * @returns User profile with LinkedIn data or null
   */
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfileWithLinkedIn | null> => {
    try {
      // Run all queries in parallel for better performance
      // Using maybeSingle() instead of single() to handle missing records gracefully
      const [profileResult, linkedinResult, analyticsResult] = await Promise.all([
        // Fetch user profile from 'profiles' table
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        // Fetch LinkedIn profile - optional, may not exist
        supabase
          .from('linkedin_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        // Fetch latest LinkedIn analytics - optional, may not exist
        supabase
          .from('linkedin_analytics')
          .select('*')
          .eq('user_id', userId)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const { data: profileData, error: profileError } = profileResult
      const { data: linkedinProfile, error: linkedinError } = linkedinResult
      const { data: linkedinAnalytics, error: analyticsError } = analyticsResult

      // Log actual errors (not just missing data)
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError)
      }
      if (linkedinError && linkedinError.code !== 'PGRST116') {
        // Table might not exist yet, which is okay
        console.warn('LinkedIn profile not available:', linkedinError.message)
      }
      if (analyticsError && analyticsError.code !== 'PGRST116') {
        // Table might not exist yet, which is okay
        console.warn('LinkedIn analytics not available:', analyticsError.message)
      }

      // If no profile found, return null (new users may not have a profile yet)
      if (!profileData) {
        return null
      }

      // Combine all data with proper type casting
      const fullProfile: UserProfileWithLinkedIn = {
        id: profileData.id,
        full_name: profileData.full_name,
        name: profileData.full_name, // Alias for compatibility
        avatar_url: profileData.avatar_url,
        email: profileData.email,
        created_at: profileData.created_at,
        linkedin_access_token: profileData.linkedin_access_token,
        linkedin_user_id: profileData.linkedin_user_id,
        linkedin_connected_at: profileData.linkedin_connected_at,
        linkedin_token_expires_at: profileData.linkedin_token_expires_at,
        linkedin_avatar_url: profileData.linkedin_avatar_url ?? null,
        linkedin_headline: profileData.linkedin_headline ?? null,
        linkedin_profile_url: profileData.linkedin_profile_url ?? null,
        company_onboarding_completed: profileData.company_onboarding_completed ?? false,
        company_name: profileData.company_name ?? null,
        company_website: profileData.company_website ?? null,
        onboarding_completed: profileData.onboarding_completed ?? false,
        onboarding_current_step: profileData.onboarding_current_step ?? 1,
        dashboard_tour_completed: profileData.dashboard_tour_completed ?? false,
        onboarding_type: profileData.onboarding_type ?? null,
        extension_logged_in: profileData.extension_logged_in ?? false,
        extension_last_active_at: profileData.extension_last_active_at ?? null,
        linkedin_profile: linkedinProfile ? {
          ...linkedinProfile,
          raw_data: linkedinProfile.raw_data as LinkedInProfile['raw_data'],
        } : null,
        linkedin_analytics: linkedinAnalytics ? {
          ...linkedinAnalytics,
          raw_data: linkedinAnalytics.raw_data as LinkedInAnalytics['raw_data'],
          top_posts: linkedinAnalytics.top_posts as unknown[],
        } : null,
      }

      return fullProfile
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }, [supabase])

  /**
   * Safe profile setter — NEVER downgrades profile with LinkedIn data to null.
   * If a fetch fails and returns null, we keep the existing profile rather than
   * wiping out the user's avatar, headline, and other LinkedIn data.
   * @param newProfile - New profile data (may be null on fetch failure)
   */
  const safeSetProfile = useCallback((newProfile: UserProfileWithLinkedIn | null, intentionalClear?: boolean) => {
    setProfile(prev => {
      // If new profile is null but we already have one, keep the existing data
      // unless this is an intentional clear (e.g. profile deletion)
      if (!newProfile && prev && !intentionalClear) {
        // Blocked null profile downgrade — keeping existing profile
        return prev
      }
      // If we have an existing profile with LinkedIn data and new one lacks it,
      // merge to preserve LinkedIn data (fetch may have partially failed)
      if (prev?.linkedin_profile && newProfile && !newProfile.linkedin_profile) {
        // Preserving LinkedIn data from existing profile
        return {
          ...newProfile,
          linkedin_profile: prev.linkedin_profile,
          linkedin_analytics: prev.linkedin_analytics ?? newProfile.linkedin_analytics,
        }
      }
      return newProfile
    })
  }, [])

  /**
   * Check if the Chrome extension is installed
   */
  const checkExtension = useCallback(async () => {
    const installed = await detectExtension(true)
    setExtensionInstalled(installed)
    // After detection, read the cached status (populated by the PING response)
    const status = getCachedExtensionStatus()
    setExtensionStatus(status)
  }, [])

  /**
   * Refresh the current user's profile (safe — never wipes existing data)
   */
  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) return
    const newProfile = await fetchProfile(currentUser.id)
    safeSetProfile(newProfile)
  }, [fetchProfile, safeSetProfile])

  /**
   * Sign out the current user and redirect to login page
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Only on explicit sign out do we clear everything (bypass safeSetProfile)
    setUser(null)
    setProfile(null)
    setSession(null)
    // Redirect to login page
    window.location.href = '/login'
  }, [supabase])

  /**
   * Initialize auth state and listen for changes
   * Uses onAuthStateChange as the primary source of truth for session state
   * getSession() is called to trigger the INITIAL_SESSION event
   */
  useEffect(() => {
    let isMounted = true
    let hasInitialized = false
    let currentFetchId = 0 // Track fetch requests to cancel stale ones
    let lastProfileFetchTime = 0 // Track when profile was last fetched
    const abortController = new AbortController()

    /**
     * Fetch profile with timeout safety and cancellation support
     */
    const fetchProfileWithTimeout = async (
      userId: string,
      fetchId: number
    ): Promise<UserProfileWithLinkedIn | null> => {
      // Check if the effect has been cleaned up
      if (abortController.signal.aborted) return null

      try {
        const timeoutId = setTimeout(() => {
          if (fetchId === currentFetchId) {
            // Only cancel if this is still the active fetch
          }
        }, 5000) // 5s timeout

        const profilePromise = fetchProfile(userId)
        const result = await Promise.race([
          profilePromise,
          new Promise<null>((resolve) => {
            const onAbort = () => resolve(null)
            abortController.signal.addEventListener('abort', onAbort)
            setTimeout(() => {
              abortController.signal.removeEventListener('abort', onAbort)
              resolve(null)
            }, 5000)
          }),
        ])

        clearTimeout(timeoutId)

        // Check if this fetch is still valid (not superseded by a newer one)
        if (fetchId !== currentFetchId || abortController.signal.aborted) {
          return null
        }

        lastProfileFetchTime = Date.now()
        return result
      } catch (err) {
        // Only log if this is still the current fetch, not aborted, and it's a real error
        if (
          fetchId === currentFetchId &&
          !abortController.signal.aborted &&
          err instanceof Error &&
          err.message !== 'Profile fetch timeout' &&
          err.message !== 'Profile fetch aborted'
        ) {
          console.error('[AuthProvider] Profile fetch error:', err)
        }
        return null
      }
    }

    // Listen for ALL auth state changes including INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {

        if (!isMounted || abortController.signal.aborted) return

        // Handle different auth events appropriately
        if (event === 'SIGNED_OUT') {
          // Only clear state on explicit sign out
          setUser(null)
          setProfile(null)
          setSession(null)
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token refresh — update session but ONLY update user if ID changed.
          // Supabase token refreshes should not cause profile re-renders because
          // the user object changes reference but contains the same data.
          if (newSession?.user) {
            setSession(newSession)
            // Only update user state if user ID actually changed (prevents
            // unnecessary re-renders of all context consumers)
            setUser(prev => {
              if (prev?.id === newSession.user.id) return prev
              return newSession.user
            })
          }
          return
        }

        // For other events (INITIAL_SESSION, SIGNED_IN, USER_UPDATED, PASSWORD_RECOVERY)
        if (newSession?.user) {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            // If SIGNED_IN fires right after INITIAL_SESSION and we already have
            // a valid profile that was fetched recently (within 60s), skip re-fetching
            // to avoid the race condition where the duplicate fetch might timeout or fail.
            const profileAge = Date.now() - lastProfileFetchTime
            const isProfileFresh = profileAge < 60000 // 60 seconds
            if (event === 'SIGNED_IN' && profileRef.current?.id === newSession.user.id && isProfileFresh) {
              setSession(newSession)
              setUser(prev => prev?.id === newSession.user.id ? prev : newSession.user)
              if (!hasInitialized) {
                hasInitialized = true
                if (isMounted) setIsLoading(false)
              }
              return
            }

            // Fetch profile BEFORE setting user/session so all state updates
            // are batched into a single render — avoids the flash where name
            // shows but avatar/headline are missing.
            const fetchId = ++currentFetchId
            const userProfile = await fetchProfileWithTimeout(newSession.user.id, fetchId)
            if (isMounted && fetchId === currentFetchId && !abortController.signal.aborted) {
              // React 18 batches these synchronous set* calls into one render
              setSession(newSession)
              setUser(newSession.user)
              // Use safeSetProfile to prevent null downgrades on fetch failure
              if (userProfile) {
                setProfile(userProfile)
              } else if (!profileRef.current) {
                // Only set null if we truly have no profile yet (first load)
                setProfile(null)
              }
              // If userProfile is null but we already have a profile, keep existing
            }
          } else {
            // For USER_UPDATED, PASSWORD_RECOVERY — no profile re-fetch needed
            setSession(newSession)
            setUser(newSession.user)
          }

          // Mark initialization complete AFTER the profile fetch so downstream
          // consumers see the profile data when isLoading becomes false
          if (event === 'INITIAL_SESSION' || !hasInitialized) {
            hasInitialized = true
            if (isMounted) {
              setIsLoading(false)
            }
          }
        } else if (event === 'INITIAL_SESSION') {
          // Only clear on INITIAL_SESSION with no user (truly not logged in)
          setUser(null)
          setProfile(null)

          if (!hasInitialized) {
            hasInitialized = true
            if (isMounted) {
              setIsLoading(false)
            }
          }
        }
        // For other events without a session, keep existing state (don't clear)
      }
    )

    // Call getSession to trigger the INITIAL_SESSION event
    // This is required to kick off the auth state detection
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // If there's no session and we haven't initialized, set loading to false
      // (onAuthStateChange should have fired INITIAL_SESSION, but this is a fallback)
      if (!session && !hasInitialized && isMounted) {
        hasInitialized = true
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
      currentFetchId++ // Cancel any pending fetches
      abortController.abort() // Abort any in-flight fetch operations
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check extension status when user becomes authenticated,
  // re-check on tab focus, and listen for real-time auth state changes
  useEffect(() => {
    if (!user) return

    // Initial check
    if (extensionInstalled === null) {
      checkExtension()
    }

    // Re-check on tab focus so status updates after extension login/logout
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExtension()
      }
    }

    // Listen for real-time auth state changes from the extension
    // (instant updates when user signs in/out of the extension)
    const removeAuthListener = onExtensionAuthStateChange(async (status) => {
      setExtensionStatus(status)
      setExtensionInstalled(status.installed)
      // Re-fetch profile when extension logs in — picks up linkedin_profile
      // and extension_logged_in changes without requiring a page reload
      if (status.platformLoggedIn && user) {
        const updated = await fetchProfile(user.id)
        if (updated) {
          setProfile(updated)
        }
      }
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      removeAuthListener()
    }
  }, [user, extensionInstalled, checkExtension])

  // Auto-push session to extension when user is logged in but extension is not
  useEffect(() => {
    if (!session || !user) return
    if (!extensionStatus?.installed) return
    if (extensionStatus.platformLoggedIn) return // Already logged in
    // Don't push if extension has a different user
    if (extensionStatus.extensionUserEmail && extensionStatus.extensionUserEmail !== user.email) return

    const timer = setTimeout(async () => {
      console.log('[AuthProvider] Auto-pushing session to extension for:', user.email)
      const accepted = await pushSessionToExtension(session)
      if (accepted) {
        console.log('[AuthProvider] Session auto-push accepted by extension')
        checkExtension()
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [session, user, extensionStatus?.installed, extensionStatus?.platformLoggedIn, extensionStatus?.extensionUserEmail, checkExtension])

  // Re-fetch profile after a delay if LinkedIn data is missing.
  // This handles the race condition where the extension sync writes to
  // linkedin_profiles AFTER the auth provider's initial profile fetch.
  useEffect(() => {
    if (!user || isLoading) return
    // If we have a user but no LinkedIn profile data, the extension may still be syncing
    if (profile && !profile.linkedin_profile) {
      const timer = setTimeout(async () => {
        const updated = await fetchProfile(user.id)
        if (updated?.linkedin_profile) {
          setProfile(updated)
        }
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [user, isLoading, profile?.linkedin_profile, fetchProfile])

  // Realtime subscription: auto-refresh profile when extension syncs LinkedIn data.
  // Listens for INSERT/UPDATE on linkedin_profiles for the current user so the UI
  // updates immediately without requiring a manual page reload.
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`linkedin-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'linkedin_profiles',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const updated = await fetchProfile(user.id)
          if (updated) {
            setProfile(updated)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          // Only re-fetch if LinkedIn-related fields changed
          const newRecord = payload.new as Record<string, unknown>
          if (newRecord.linkedin_connected_at || newRecord.extension_logged_in) {
            const updated = await fetchProfile(user.id)
            if (updated) {
              setProfile(updated)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase, fetchProfile])

  /**
   * Memoize the context value to prevent unnecessary re-renders of consumers.
   * Without this, every AuthProvider render creates a new value object, causing
   * ALL useAuthContext() consumers to re-render even if no auth data changed.
   */
  const value: AuthContextType = useMemo(() => ({
    user,
    profile,
    session,
    isLoading,
    isAuthenticated: !!user,
    hasCompletedCompanyOnboarding: profile?.company_onboarding_completed ?? false,
    hasCompletedOnboarding: profile?.onboarding_completed ?? false,
    currentOnboardingStep: profile?.onboarding_current_step ?? 1,
    extensionInstalled,
    extensionStatus,
    checkExtension,
    signOut,
    refreshProfile,
  }), [user, profile, session, isLoading, extensionInstalled, extensionStatus, checkExtension, signOut, refreshProfile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuthContext hook
 * @returns Auth context value
 * Returns safe defaults if used outside AuthProvider (e.g. during SSR)
 * @example
 * const { user, profile, signOut } = useAuthContext()
 * // Access LinkedIn data
 * const headline = profile?.linkedin_profile?.headline
 * const impressions = profile?.linkedin_analytics?.impressions
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    // Return safe defaults during SSR/static prerendering when AuthProvider is not mounted
    return {
      user: null,
      profile: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      hasCompletedCompanyOnboarding: false,
      hasCompletedOnboarding: false,
      currentOnboardingStep: 1,
      extensionInstalled: null,
      extensionStatus: null,
      checkExtension: async () => {},
      signOut: async () => {},
      refreshProfile: async () => {},
    }
  }
  return context
}
