/**
 * Team Hook
 * @description React hook for team state management and operations
 * @module hooks/use-team
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Team, TeamMemberRole } from '@/types/database'

/**
 * Team with member count and user role
 */
export interface TeamWithMeta extends Team {
  /** User's role in this team */
  role: TeamMemberRole
  /** Number of members in the team */
  member_count: number
  /** Associated company info */
  company?: {
    id: string
    name: string
    logo_url: string | null
  } | null
}

/**
 * Team member with user profile
 */
export interface TeamMemberWithUser {
  /** Member record ID */
  id: string
  /** User ID */
  user_id: string
  /** Role in team */
  role: TeamMemberRole
  /** When user joined */
  joined_at: string
  /** User profile info */
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
    headline: string | null
    followers_count: number
    connections_count: number
  }
}

/**
 * Hook return type for team operations
 */
interface UseTeamReturn {
  /** List of user's teams */
  teams: TeamWithMeta[]
  /** Currently selected team */
  currentTeam: TeamWithMeta | null
  /** Members of current team */
  members: TeamMemberWithUser[]
  /** Loading state for teams */
  isLoadingTeams: boolean
  /** Loading state for members */
  isLoadingMembers: boolean
  /** Error message if any */
  error: string | null
  /** Current user's role in the team */
  currentUserRole: TeamMemberRole | null
  /** Select a team as current */
  setCurrentTeam: (team: TeamWithMeta | null) => void
  /** Fetch members for a team */
  fetchMembers: (teamId: string) => Promise<void>
  /** Update team details */
  updateTeam: (id: string, data: { name?: string; logo_url?: string }) => Promise<Team | null>
  /** Remove a member from the team */
  removeMember: (teamId: string, userId: string) => Promise<boolean>
  /** Update a member's role */
  updateMemberRole: (teamId: string, userId: string, role: TeamMemberRole) => Promise<boolean>
  /** Refetch teams */
  refetchTeams: () => Promise<void>
  /** Create a new team */
  createTeam: (data: { name: string; company_id?: string; logo_url?: string }) => Promise<TeamWithMeta | null>
}

/**
 * Hook to manage team state and operations
 * @returns Team data and operations
 * @example
 * const { teams, currentTeam, members, updateTeam, removeMember } = useTeam()
 *
 * // Remove a member
 * await removeMember(teamId, userId)
 *
 * // Update team name
 * await updateTeam(teamId, { name: 'New Name' })
 */
export function useTeam(): UseTeamReturn {
  const [teams, setTeams] = useState<TeamWithMeta[]>([])
  const [currentTeam, setCurrentTeam] = useState<TeamWithMeta | null>(null)
  const [members, setMembers] = useState<TeamMemberWithUser[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(true)
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<TeamMemberRole | null>(null)

  // Ref to avoid stale closure in fetchTeams when checking currentTeam
  const currentTeamRef = useRef(currentTeam)
  currentTeamRef.current = currentTeam

  /**
   * Fetch user's teams from API
   */
  const fetchTeams = useCallback(async () => {
    try {
      setIsLoadingTeams(true)
      setError(null)

      const response = await fetch('/api/teams')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch teams')
      }

      setTeams(data.teams || [])

      // Auto-select first team if no current team
      if (!currentTeamRef.current && data.teams?.length > 0) {
        setCurrentTeam(data.teams[0])
      }
    } catch (err) {
      console.error('Teams fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch teams')
    } finally {
      setIsLoadingTeams(false)
    }
  }, [])

  /**
   * Fetch members for a specific team
   * @param teamId - Team ID to fetch members for
   */
  const fetchMembers = useCallback(async (teamId: string) => {
    try {
      setIsLoadingMembers(true)
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/members`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch members')
      }

      setMembers(data.members || [])
      setCurrentUserRole(data.current_user_role || null)
    } catch (err) {
      console.error('Members fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch members')
    } finally {
      setIsLoadingMembers(false)
    }
  }, [])

  /**
   * Update team details
   * @param id - Team ID
   * @param data - Update data
   * @returns Updated team or null on error
   */
  const updateTeam = useCallback(async (
    id: string,
    data: { name?: string; logo_url?: string }
  ): Promise<Team | null> => {
    try {
      setError(null)

      const response = await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update team')
      }

      // Update local state
      setTeams(prev =>
        prev.map(team =>
          team.id === id ? { ...team, ...result.team } : team
        )
      )

      if (currentTeam?.id === id) {
        setCurrentTeam(prev => prev ? { ...prev, ...result.team } : null)
      }

      return result.team
    } catch (err) {
      console.error('Team update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update team')
      return null
    }
  }, [currentTeam?.id])

  /**
   * Remove a member from the team
   * @param teamId - Team ID
   * @param userId - User ID to remove
   * @returns Whether removal was successful
   */
  const removeMember = useCallback(async (teamId: string, userId: string): Promise<boolean> => {
    try {
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      // Update local state
      setMembers(prev => prev.filter(m => m.user_id !== userId))

      // Update team member count
      setTeams(prev =>
        prev.map(team =>
          team.id === teamId
            ? { ...team, member_count: Math.max(0, team.member_count - 1) }
            : team
        )
      )

      return true
    } catch (err) {
      console.error('Remove member error:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove member')
      return false
    }
  }, [])

  /**
   * Update a member's role
   * @param teamId - Team ID
   * @param userId - User ID
   * @param role - New role
   * @returns Whether update was successful
   */
  const updateMemberRole = useCallback(async (
    teamId: string,
    userId: string,
    role: TeamMemberRole
  ): Promise<boolean> => {
    try {
      setError(null)

      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update role')
      }

      // Update local state
      setMembers(prev =>
        prev.map(m =>
          m.user_id === userId ? { ...m, role } : m
        )
      )

      return true
    } catch (err) {
      console.error('Update role error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update role')
      return false
    }
  }, [])

  /**
   * Create a new team
   * @param data - Team creation data
   * @returns Created team or null on error
   */
  const createTeam = useCallback(async (
    data: { name: string; company_id?: string; logo_url?: string }
  ): Promise<TeamWithMeta | null> => {
    try {
      setError(null)

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create team')
      }

      const newTeam = result.team as TeamWithMeta
      setTeams(prev => [...prev, newTeam])

      return newTeam
    } catch (err) {
      console.error('Create team error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create team')
      return null
    }
  }, [])

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch members when current team changes
  useEffect(() => {
    if (currentTeam?.id) {
      fetchMembers(currentTeam.id)
    } else {
      setMembers([])
      setCurrentUserRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeam?.id])

  return {
    teams,
    currentTeam,
    members,
    isLoadingTeams,
    isLoadingMembers,
    error,
    currentUserRole,
    setCurrentTeam,
    fetchMembers,
    updateTeam,
    removeMember,
    updateMemberRole,
    refetchTeams: fetchTeams,
    createTeam,
  }
}
