'use client'

/**
 * Followed Influencers Hook
 * @description Manages followed LinkedIn influencers for the Inspiration section.
 * Provides follow/unfollow actions, state management, and URL-based lookup.
 * @module hooks/use-followed-influencers
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'

/**
 * A followed LinkedIn influencer record
 */
export interface FollowedInfluencer {
  /** Unique record ID */
  id: string
  /** User who followed this influencer */
  user_id: string
  /** Full LinkedIn profile URL */
  linkedin_url: string
  /** LinkedIn username extracted from URL */
  linkedin_username: string | null
  /** Display name of the influencer */
  author_name: string | null
  /** Professional headline */
  author_headline: string | null
  /** Profile picture URL */
  author_profile_picture: string | null
  /** Status of the follow (active/inactive) */
  status: string
  /** Number of posts tracked */
  posts_count: number
  /** When the record was created */
  created_at: string
  /** When the record was last updated */
  updated_at: string
  /** When the user last viewed this influencer's posts */
  last_seen_at: string | null
  /** Number of new posts since last seen */
  new_post_count: number
}

/**
 * Return type for the useFollowedInfluencers hook
 */
interface UseFollowedInfluencersReturn {
  /** List of followed influencers */
  influencers: FollowedInfluencer[]
  /** Whether the list is loading */
  isLoading: boolean
  /**
   * Follow a new influencer by LinkedIn URL
   * @param url - LinkedIn profile URL (must contain linkedin.com/in/)
   * @param authorName - Optional display name
   * @param headline - Optional professional headline
   * @param avatar - Optional profile picture URL
   */
  followInfluencer: (url: string, authorName?: string, headline?: string, avatar?: string) => Promise<void>
  /**
   * Unfollow an influencer by record ID
   * @param id - The followed_influencers record ID
   */
  unfollowInfluencer: (id: string) => Promise<void>
  /**
   * Check whether a LinkedIn profile URL is already followed
   * @param authorUrl - The LinkedIn profile URL to check
   * @returns true if followed
   */
  isFollowing: (authorUrl: string) => boolean
  /** Refetch the list from the server */
  refetch: () => Promise<void>
  /**
   * Mark an influencer as seen, resetting new_post_count to 0
   * @param influencerId - The followed_influencers record ID
   */
  markAsSeen: (influencerId: string) => Promise<void>
  /**
   * Trigger a fetch of latest posts for an influencer
   * @param influencerId - The followed_influencers record ID
   */
  fetchLatestPosts: (influencerId: string) => Promise<void>
}

/**
 * Extracts the LinkedIn username from a profile URL.
 * Supports formats like:
 *   - https://www.linkedin.com/in/username/
 *   - linkedin.com/in/username
 * @param url - LinkedIn profile URL
 * @returns Extracted username, or null if not parseable
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Normalizes a LinkedIn URL for consistent comparison.
 * Strips trailing slashes and lowercases.
 * @param url - Raw LinkedIn URL
 * @returns Normalized URL string
 */
function normalizeLinkedInUrl(url: string): string {
  return url.trim().split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '')
}

/**
 * Hook to manage followed LinkedIn influencers.
 * Uses the Supabase browser client directly for reads,
 * and the /api/influencers API route for mutations.
 * @returns Influencer state and follow/unfollow actions
 * @example
 * const { influencers, isFollowing, followInfluencer, unfollowInfluencer } = useFollowedInfluencers()
 */
export function useFollowedInfluencers(): UseFollowedInfluencersReturn {
  const { user, isLoading: authLoading } = useAuthContext()
  const [influencers, setInfluencers] = useState<FollowedInfluencer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetches followed influencers from Supabase for the current user.
   */
  const fetchInfluencers = useCallback(async () => {
    if (!user) {
      setInfluencers([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('followed_influencers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          // Table not yet created - silently skip
          setInfluencers([])
          return
        }
        console.warn('Followed influencers fetch error:', error.message)
        setInfluencers([])
        return
      }

      // Count new posts per influencer (posts created after last_seen_at)
      const influencerData = (data as FollowedInfluencer[]) ?? []
      const enrichedInfluencers = await Promise.all(
        influencerData.map(async (inf) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = (supabase as any)
              .from('influencer_posts')
              .select('id', { count: 'exact', head: true })
              .eq('influencer_id', inf.id)
              .eq('quality_status', 'approved')

            if (inf.last_seen_at) {
              query = query.gt('created_at', inf.last_seen_at)
            }

            const { count } = await query
            return { ...inf, new_post_count: count || 0 }
          } catch {
            return { ...inf, new_post_count: 0 }
          }
        })
      )
      setInfluencers(enrichedInfluencers)
    } catch (err) {
      console.warn('Followed influencers fetch skipped:', err instanceof Error ? err.message : 'Unknown error')
      setInfluencers([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user])

  /**
   * Follow a new influencer by LinkedIn profile URL.
   * Validates the URL and calls the API route to upsert the record.
   */
  const followInfluencer = useCallback(async (
    url: string,
    authorName?: string,
    headline?: string,
    avatar?: string,
  ) => {
    if (!url || !url.includes('linkedin.com/in/')) {
      toast.error('Invalid LinkedIn URL. Must include linkedin.com/in/')
      return
    }

    const normalizedUrl = normalizeLinkedInUrl(url)

    // Check if already following (client-side dedup)
    const alreadyFollowing = influencers.some(
      inf => normalizeLinkedInUrl(inf.linkedin_url) === normalizedUrl
    )
    if (alreadyFollowing) {
      toast.info('You are already following this influencer.')
      return
    }

    try {
      const response = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: url,
          author_name: authorName ?? null,
          author_headline: headline ?? null,
          author_profile_picture: avatar ?? null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? 'Failed to follow influencer')
      }

      const { influencer } = await response.json()

      // Optimistic update
      setInfluencers(prev => [influencer as FollowedInfluencer, ...prev])
      toast.success(`Now following ${authorName ?? extractLinkedInUsername(url) ?? 'influencer'}`)
    } catch (err) {
      console.error('Follow influencer error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to follow influencer')
    }
  }, [influencers])

  /**
   * Unfollow an influencer by record ID.
   * Calls the API route to delete the record and updates local state.
   */
  const unfollowInfluencer = useCallback(async (id: string) => {
    const influencer = influencers.find(inf => inf.id === id)

    // Optimistic removal
    setInfluencers(prev => prev.filter(inf => inf.id !== id))

    try {
      const response = await fetch('/api/influencers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        // Rollback on failure
        if (influencer) {
          setInfluencers(prev => [influencer, ...prev])
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? 'Failed to unfollow influencer')
      }

      toast.success(`Unfollowed ${influencer?.author_name ?? 'influencer'}`)
    } catch (err) {
      console.error('Unfollow influencer error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to unfollow influencer')
    }
  }, [influencers])

  /**
   * Mark an influencer as seen, updating last_seen_at and resetting new_post_count.
   * Performs an optimistic update and then persists to the database.
   * @param influencerId - The followed_influencers record ID
   */
  const markAsSeen = useCallback(async (influencerId: string) => {
    if (!user) return

    // Optimistic update
    setInfluencers(prev => prev.map(inf =>
      inf.id === influencerId
        ? { ...inf, last_seen_at: new Date().toISOString(), new_post_count: 0 }
        : inf
    ))

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('followed_influencers')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', influencerId)
        .eq('user_id', user.id)
    } catch (err) {
      console.warn('Failed to update last_seen_at:', err)
    }
  }, [supabase, user])

  /**
   * Trigger a fetch of the latest posts for a given influencer via the API.
   * @param influencerId - The followed_influencers record ID
   */
  const fetchLatestPosts = useCallback(async (influencerId: string) => {
    const influencer = influencers.find(inf => inf.id === influencerId)
    if (!influencer) return

    try {
      const response = await fetch('/api/influencers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer_id: influencerId }),
      })

      if (!response.ok) {
        throw new Error('Failed to trigger fetch')
      }

      toast.success('Fetching latest posts... This may take a moment.')
    } catch (err) {
      console.error('Fetch latest posts error:', err)
      toast.error('Failed to trigger post fetch')
    }
  }, [influencers])

  /**
   * Returns true if the given LinkedIn profile URL is in the followed list.
   */
  const isFollowing = useCallback((authorUrl: string): boolean => {
    if (!authorUrl) return false
    const normalized = normalizeLinkedInUrl(authorUrl)
    return influencers.some(
      inf => normalizeLinkedInUrl(inf.linkedin_url) === normalized
    )
  }, [influencers])

  // Fetch on mount and when user changes
  useEffect(() => {
    if (!authLoading) {
      fetchInfluencers()
    }
  }, [authLoading, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    influencers,
    isLoading,
    followInfluencer,
    unfollowInfluencer,
    isFollowing,
    refetch: fetchInfluencers,
    markAsSeen,
    fetchLatestPosts,
  }
}
