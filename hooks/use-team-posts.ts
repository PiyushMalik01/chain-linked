/**
 * Team Posts Hook
 * @description Fetches posts from all team members via Supabase
 * @module hooks/use-team-posts
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { Tables } from '@/types/database'
import type { TeamActivityItem } from '@/components/features/team-activity-feed'


/**
 * Hook return type for team posts
 */
interface UseTeamPostsReturn {
  /** Formatted posts for the activity feed */
  posts: TeamActivityItem[]
  /** Raw post data from database */
  rawPosts: Tables<'my_posts'>[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Refetch posts */
  refetch: () => Promise<void>
}

/**
 * Map media type to post type
 */
function mapMediaToPostType(mediaType: string | null): TeamActivityItem['postType'] {
  if (!mediaType) return 'text'
  const type = mediaType.toLowerCase()
  if (type.includes('image')) return 'image'
  if (type.includes('video')) return 'video'
  if (type.includes('article')) return 'article'
  if (type.includes('poll')) return 'poll'
  return 'text'
}

/**
 * Hook to fetch team activity posts from all team members
 * @param limit - Maximum number of posts to fetch
 * @param teamId - Team ID to fetch posts for (avoids ambiguity when user is in multiple teams)
 * @returns Team posts data and loading state
 * @example
 * const { posts, isLoading, error } = useTeamPosts(20, currentTeam?.id)
 */
export function useTeamPosts(limit: number = 20, teamId?: string | null): UseTeamPostsReturn {
  const { user, isLoading: authLoading } = useAuthContext()

  const [posts, setPosts] = useState<TeamActivityItem[]>([])
  const [rawPosts, setRawPosts] = useState<Tables<'my_posts'>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch posts from all team members
   */
  const fetchPosts = useCallback(async () => {
    if (authLoading) return

    if (!user) {
      setPosts([])
      setRawPosts([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Step 1: Get team member IDs — use provided teamId, or fall back to first membership
      let teamMemberIds: string[] = [user.id]

      try {
        let resolvedTeamId = teamId

        if (!resolvedTeamId) {
          // Fall back: pick the first team membership (order by joined_at)
          const { data: firstMembership } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user.id)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          resolvedTeamId = firstMembership?.team_id
        }

        if (resolvedTeamId) {
          const { data: teamMembersData, error: membersError } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', resolvedTeamId)

          if (!membersError && teamMembersData && teamMembersData.length > 0) {
            teamMemberIds = teamMembersData.map(m => m.user_id)
          }
        }
      } catch {
        console.info('Team members table unavailable, using solo mode')
      }

      // Step 3: Fetch profile info for all team members
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, linkedin_avatar_url')
        .in('id', teamMemberIds)

      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      )

      // Step 4: Fetch LinkedIn profiles for headline info
      const { data: linkedinProfiles } = await supabase
        .from('linkedin_profiles')
        .select('user_id, headline')
        .in('user_id', teamMemberIds)

      const headlineMap = new Map(
        (linkedinProfiles || []).map(p => [p.user_id, p.headline])
      )

      // Step 5: Fetch posts created by team members
      const { data: postsData, error: fetchError } = await supabase
        .from('my_posts')
        .select('*')
        .in('user_id', teamMemberIds)
        .not('content', 'is', null)
        .not('posted_at', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(limit)

      if (fetchError) {
        console.warn('Team posts fetch warning:', fetchError.message)
        setPosts([])
        setRawPosts([])
        setIsLoading(false)
        return
      }

      if (!postsData || postsData.length === 0) {
        setPosts([])
        setRawPosts([])
        setIsLoading(false)
        return
      }

      // Step 6: Transform to TeamActivityItem format with correct author per post
      const transformedPosts: TeamActivityItem[] = postsData.map((post) => {
        const profile = profileMap.get(post.user_id)
        const headline = headlineMap.get(post.user_id)

        return {
          id: post.id,
          author: {
            name: profile?.full_name || profile?.email?.split('@')[0] || 'Unknown User',
            headline: headline || profile?.email || '',
            avatar: profile?.linkedin_avatar_url || profile?.avatar_url || null,
          },
          content: post.content || '',
          metrics: {
            impressions: post.impressions || 0,
            reactions: post.reactions || 0,
            comments: post.comments || 0,
            reposts: post.reposts || 0,
          },
          postedAt: post.posted_at || post.created_at || new Date().toISOString(),
          postType: mapMediaToPostType(post.media_type),
          mediaUrls: post.media_urls || null,
        }
      })

      setPosts(transformedPosts)
      setRawPosts(postsData)
    } catch (err) {
      console.error('Team posts fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch posts')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, limit, user, authLoading, teamId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const combinedLoading = authLoading || isLoading

  return {
    posts,
    rawPosts,
    isLoading: combinedLoading,
    error,
    refetch: fetchPosts,
  }
}
