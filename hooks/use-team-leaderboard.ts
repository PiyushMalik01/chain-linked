/**
 * Team Leaderboard Hook
 * @description Fetches and calculates team member statistics for the leaderboard
 * @module hooks/use-team-leaderboard
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { TeamMemberStats, LeaderboardTimeRange } from '@/components/features/team-leaderboard'

/**
 * Hook return type for team leaderboard
 */
interface UseTeamLeaderboardReturn {
  /** Team member statistics for leaderboard */
  members: TeamMemberStats[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Currently selected time range */
  timeRange: LeaderboardTimeRange
  /** Update the time range */
  setTimeRange: (range: LeaderboardTimeRange) => void
  /** Refetch leaderboard data */
  refetch: () => Promise<void>
  /** Current user ID for highlighting */
  currentUserId: string | null
}

/**
 * Get start date for time range filter
 * @param range - Time range to calculate
 * @returns ISO date string for start of period
 */
function getStartDate(range: LeaderboardTimeRange): string {
  const now = new Date()
  switch (range) {
    case 'week':
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 7)
      return weekStart.toISOString()
    case 'month':
      const monthStart = new Date(now)
      monthStart.setMonth(now.getMonth() - 1)
      return monthStart.toISOString()
    case 'all-time':
    default:
      return new Date(0).toISOString()
  }
}


/**
 * Hook to fetch team leaderboard data
 * Aggregates post counts and engagement metrics per team member
 * @param teamId - Team ID to fetch leaderboard for (avoids ambiguity when user is in multiple teams)
 * @returns Team leaderboard data and controls
 * @example
 * const { members, isLoading, timeRange, setTimeRange } = useTeamLeaderboard(currentTeam?.id)
 */
export function useTeamLeaderboard(teamId?: string | null): UseTeamLeaderboardReturn {
  // Get auth state from context
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization
  const [members, setMembers] = useState<TeamMemberStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<LeaderboardTimeRange>('week')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch leaderboard data from database
   */
  const fetchLeaderboard = useCallback(async () => {
    if (authLoading) return

    if (!user) {
      setMembers([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      let teamMemberIds: string[] = [user.id]

      try {
        let resolvedTeamId = teamId

        if (!resolvedTeamId) {
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

      // Get user profiles for team members (include linkedin_avatar_url)
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, linkedin_avatar_url')
        .in('id', teamMemberIds)

      if (!usersData || usersData.length === 0) {
        setMembers([])
        setIsLoading(false)
        return
      }

      // Get LinkedIn profiles for headline and profile picture
      const { data: profilesData } = await supabase
        .from('linkedin_profiles')
        .select('user_id, headline, profile_picture_url')
        .in('user_id', teamMemberIds)

      // Fetch ALL posts for team members, then filter client-side for each time range
      const { data: allPostsData } = await supabase
        .from('my_posts')
        .select('user_id, posted_at, reactions, comments, reposts, impressions')
        .in('user_id', teamMemberIds)
        .not('posted_at', 'is', null)

      // Aggregate stats per user, filtered by selected time range
      const userStatsMap = new Map<string, {
        postsThisWeek: number
        postsThisMonth: number
        postsAllTime: number
        totalEngagement: number
        totalImpressions: number
        totalReactions: number
        totalComments: number
      }>()

      // Initialize all users
      teamMemberIds.forEach(id => {
        userStatsMap.set(id, {
          postsThisWeek: 0,
          postsThisMonth: 0,
          postsAllTime: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          totalReactions: 0,
          totalComments: 0,
        })
      })

      // Calculate stats from posts — engagement metrics scoped to same time range as post count
      if (allPostsData) {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        allPostsData.forEach(post => {
          const stats = userStatsMap.get(post.user_id)
          if (!stats) return

          const postDate = new Date(post.posted_at!)
          const reactions = post.reactions || 0
          const comments = post.comments || 0
          const reposts = post.reposts || 0
          const impressions = post.impressions || 0

          // Always count all-time posts
          stats.postsAllTime++

          // Count posts per time range
          if (postDate >= weekAgo) {
            stats.postsThisWeek++
          }
          if (postDate >= monthAgo) {
            stats.postsThisMonth++
          }

          // Engagement metrics scoped to the currently selected time range
          const inRange = timeRange === 'week'
            ? postDate >= weekAgo
            : timeRange === 'month'
              ? postDate >= monthAgo
              : true
          if (inRange) {
            stats.totalEngagement += reactions + comments + reposts
            stats.totalImpressions += impressions
            stats.totalReactions += reactions
            stats.totalComments += comments
          }
        })
      }

      // Build leaderboard entries
      const leaderboardEntries: TeamMemberStats[] = usersData.map(userData => {
        const profile = profilesData?.find(p => p.user_id === userData.id)
        const stats = userStatsMap.get(userData.id) || {
          postsThisWeek: 0,
          postsThisMonth: 0,
          postsAllTime: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          totalReactions: 0,
          totalComments: 0,
        }

        // Prefer LinkedIn avatar: linkedin_profiles.profile_picture_url → profiles.linkedin_avatar_url → profiles.avatar_url
        const avatarUrl = profile?.profile_picture_url
          || userData.linkedin_avatar_url
          || userData.avatar_url
          || undefined

        // Calculate engagement rate (engagement / impressions * 100)
        const engagementRate = stats.totalImpressions > 0
          ? (stats.totalEngagement / stats.totalImpressions) * 100
          : 0

        return {
          id: userData.id,
          name: userData.full_name || userData.email?.split('@')[0] || 'Unknown User',
          avatarUrl,
          role: profile?.headline || 'Team Member',
          postsThisWeek: stats.postsThisWeek,
          postsThisMonth: stats.postsThisMonth,
          postsAllTime: stats.postsAllTime,
          totalEngagement: stats.totalEngagement,
          engagementRate: Math.round(engagementRate * 10) / 10,
          rank: 0, // Will be calculated below
          rankChange: 0, // Would need historical data to calculate
          totalReactions: stats.totalReactions,
          totalComments: stats.totalComments,
          totalImpressions: stats.totalImpressions,
        }
      })

      // Sort by impressions (descending) and assign ranks
      const sortedEntries = [...leaderboardEntries].sort((a, b) => {
        if (b.totalImpressions !== a.totalImpressions) {
          return b.totalImpressions - a.totalImpressions
        }
        return b.totalEngagement - a.totalEngagement
      })

      sortedEntries.forEach((entry, index) => {
        entry.rank = index + 1
      })

      setMembers(sortedEntries)
    } catch (err) {
      console.error('Team leaderboard fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, timeRange, user, authLoading, teamId])

  // Fetch when auth state changes or on mount
  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Combined loading state
  const combinedLoading = authLoading || isLoading

  return {
    members,
    isLoading: combinedLoading,
    error,
    timeRange,
    setTimeRange,
    refetch: fetchLeaderboard,
    currentUserId: user?.id || null,
  }
}
