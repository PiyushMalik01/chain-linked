/**
 * useAuth Hook
 * @description Custom hook for managing authentication state
 * @module hooks/use-auth
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Tables } from '@/types/database'

/**
 * Auth state type definition
 */
interface AuthState {
  user: User | null
  profile: Tables<'profiles'> | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

/**
 * useAuth hook return type
 */
interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

/**
 * Custom hook for managing authentication state with Supabase
 * @returns Auth state and methods
 * @example
 * const { user, isAuthenticated, signOut } = useAuth()
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  })
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch user profile from database
   */
  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Profile fetch error:', error)
    }

    return profile
  }, [supabase])

  /**
   * Refresh user profile
   */
  const refreshProfile = useCallback(async () => {
    if (!state.user) return

    const profile = await fetchProfile(state.user.id)
    setState((prev) => ({ ...prev, profile }))
  }, [state.user, fetchProfile])

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    })
    router.push('/login')
  }, [supabase, router])

  /**
   * Initialize auth state and subscribe to changes
   */
  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setState({
          user: session.user,
          profile,
          session,
          isLoading: false,
          isAuthenticated: true,
        })
      } else {
        setState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        })
      }
    }

    initAuth()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id)
          setState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true,
          })
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
          })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setState((prev) => ({
            ...prev,
            session,
          }))
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  return {
    ...state,
    signOut,
    refreshProfile,
  }
}
