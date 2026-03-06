/**
 * Settings Hook
 * @description Fetches and manages user settings from Supabase
 * @module hooks/use-settings
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

/**
 * User profile data for settings
 */
export interface UserProfile {
  /** User's display name */
  name: string
  /** User's email address */
  email: string
  /** Optional avatar image URL */
  avatarUrl?: string
  /** LinkedIn profile URL if connected */
  linkedinProfileUrl?: string
}

/**
 * Team member data for settings
 */
export interface TeamMember {
  /** Unique identifier for the team member */
  id: string
  /** Display name of the team member */
  name: string
  /** Email address of the team member */
  email: string
  /** Role within the team */
  role: 'owner' | 'admin' | 'member'
  /** Optional avatar image URL */
  avatarUrl?: string
}

/**
 * Extension settings data
 */
export interface ExtensionSettings {
  /** Auto-capture enabled */
  autoCaptureEnabled: boolean
  /** Capture feed posts */
  captureFeed: boolean
  /** Capture analytics */
  captureAnalytics: boolean
  /** Capture profile */
  captureProfile: boolean
  /** Capture messaging */
  captureMessaging: boolean
  /** Sync enabled */
  syncEnabled: boolean
  /** Sync interval in minutes */
  syncInterval: number
  /** Dark mode preference */
  darkMode: boolean
  /** Notifications enabled */
  notificationsEnabled: boolean
  /** Raw settings JSON */
  rawSettings?: Record<string, unknown>
}

/**
 * Hook return type for settings data
 */
interface UseSettingsReturn {
  /** User profile data */
  user: UserProfile | null
  /** Whether LinkedIn is connected */
  linkedinConnected: boolean
  /** LinkedIn profile data */
  linkedinProfile: Tables<'linkedin_profiles'> | null
  /** Team members */
  teamMembers: TeamMember[]
  /** Extension settings */
  extensionSettings: ExtensionSettings | null
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Refetch settings */
  refetch: () => Promise<void>
  /** Update user profile */
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>
  /** Update team member role */
  updateTeamMemberRole: (memberId: string, role: 'admin' | 'member') => Promise<boolean>
  /** Update extension settings */
  updateExtensionSettings: (updates: Partial<ExtensionSettings>) => Promise<boolean>
}

/**
 * Default extension settings
 */
const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  autoCaptureEnabled: true,
  captureFeed: true,
  captureAnalytics: true,
  captureProfile: true,
  captureMessaging: false,
  syncEnabled: true,
  syncInterval: 30,
  darkMode: false,
  notificationsEnabled: true,
}

/**
 * Hook to fetch and manage user settings from Supabase
 * @returns Settings data, loading state, and update functions
 * @example
 * const { user, teamMembers, isLoading, updateProfile } = useSettings()
 */
export function useSettings(): UseSettingsReturn {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinProfile, setLinkedinProfile] = useState<Tables<'linkedin_profiles'> | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [extensionSettings, setExtensionSettings] = useState<ExtensionSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  /**
   * Fetch all settings data from database
   */
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        setLinkedinConnected(false)
        setLinkedinProfile(null)
        setTeamMembers([])
        setExtensionSettings(null)
        setIsLoading(false)
        return
      }

      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', authUser.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Error fetching profile:', profileError)
      }

      // Set user profile from profiles table
      if (profileData) {
        setUser({
          name: profileData.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: profileData.email || authUser.email || '',
          avatarUrl: profileData.avatar_url || undefined,
          linkedinProfileUrl: undefined, // Not stored in profiles table
        })
      } else {
        // Fallback to auth user metadata
        setUser({
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          avatarUrl: authUser.user_metadata?.avatar_url || undefined,
        })
      }

      // Fetch LinkedIn profile
      const { data: linkedinData, error: linkedinError } = await supabase
        .from('linkedin_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      if (linkedinError && linkedinError.code !== 'PGRST116') {
        console.warn('Error fetching LinkedIn profile:', linkedinError)
      }

      setLinkedinProfile(linkedinData || null)
      setLinkedinConnected(!!linkedinData)

      // Update user avatar with LinkedIn profile picture if profiles table avatar is missing
      if (linkedinData?.profile_picture_url) {
        setUser(prev => prev ? {
          ...prev,
          avatarUrl: prev.avatarUrl || linkedinData.profile_picture_url || undefined,
        } : prev)
      }

      // Fetch team members - first get user's team(s)
      // Handle gracefully if table doesn't exist or RLS blocks access
      let teamMemberData: { team_id: string }[] | null = null
      try {
        const { data, error: teamMemberError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', authUser.id)
          .limit(1)

        // Only log non-standard errors (not 406/table issues or PGRST116/not found)
        if (teamMemberError && teamMemberError.code !== 'PGRST116' && !teamMemberError.message?.includes('406')) {
          console.warn('Error fetching team membership:', teamMemberError)
        }
        teamMemberData = data
      } catch {
        // Table might not exist, continue without team data
      }

      if (teamMemberData && teamMemberData.length > 0) {
        const teamId = teamMemberData[0].team_id

        // Fetch all team members then look up profiles separately
        // (no direct FK from team_members to profiles for PostgREST join)
        const { data: membersData, error: membersError } = await supabase
          .from('team_members')
          .select('id, role, user_id')
          .eq('team_id', teamId)

        if (membersError) {
          console.warn('Error fetching team members:', membersError)
        }

        if (membersData && membersData.length > 0) {
          // Fetch profiles for all team member user_ids
          const memberUserIds = membersData.map(m => m.user_id)
          const [{ data: profilesData }, { data: teamData }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, email, avatar_url')
              .in('id', memberUserIds),
            supabase
              .from('teams')
              .select('owner_id')
              .eq('id', teamId)
              .single(),
          ])

          const profileMap = new Map(
            (profilesData ?? []).map(p => [p.id, p])
          )

          const transformedMembers: TeamMember[] = membersData.map((member) => {
            const profile = profileMap.get(member.user_id)
            const isOwner = teamData?.owner_id === member.user_id
            return {
              id: member.id,
              name: profile?.full_name || profile?.email?.split('@')[0] || 'Unknown',
              email: profile?.email || '',
              role: isOwner ? 'owner' : (member.role as 'admin' | 'member'),
              avatarUrl: profile?.avatar_url || undefined,
            }
          })

          setTeamMembers(transformedMembers)
        }
      } else {
        // No team - just show current user as owner
        setTeamMembers([{
          id: authUser.id,
          name: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: profileData?.email || authUser.email || '',
          role: 'owner',
          avatarUrl: profileData?.avatar_url || undefined,
        }])
      }

      // Fetch extension settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('extension_settings')
        .select('auto_capture_enabled, capture_feed, capture_analytics, capture_profile, capture_messaging, sync_enabled, sync_interval, dark_mode, notifications_enabled, raw_settings')
        .eq('user_id', authUser.id)
        .single()

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.warn('Error fetching extension settings:', settingsError)
      }

      if (settingsData) {
        setExtensionSettings({
          autoCaptureEnabled: settingsData.auto_capture_enabled ?? DEFAULT_EXTENSION_SETTINGS.autoCaptureEnabled,
          captureFeed: settingsData.capture_feed ?? DEFAULT_EXTENSION_SETTINGS.captureFeed,
          captureAnalytics: settingsData.capture_analytics ?? DEFAULT_EXTENSION_SETTINGS.captureAnalytics,
          captureProfile: settingsData.capture_profile ?? DEFAULT_EXTENSION_SETTINGS.captureProfile,
          captureMessaging: settingsData.capture_messaging ?? DEFAULT_EXTENSION_SETTINGS.captureMessaging,
          syncEnabled: settingsData.sync_enabled ?? DEFAULT_EXTENSION_SETTINGS.syncEnabled,
          syncInterval: settingsData.sync_interval ?? DEFAULT_EXTENSION_SETTINGS.syncInterval,
          darkMode: settingsData.dark_mode ?? DEFAULT_EXTENSION_SETTINGS.darkMode,
          notificationsEnabled: settingsData.notifications_enabled ?? DEFAULT_EXTENSION_SETTINGS.notificationsEnabled,
          rawSettings: settingsData.raw_settings as Record<string, unknown> | undefined,
        })
      } else {
        setExtensionSettings(DEFAULT_EXTENSION_SETTINGS)
      }

    } catch (err) {
      console.error('Settings fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setError('You must be logged in to update profile')
        return false
      }

      const dbUpdates: Partial<Tables<'profiles'>> = {}
      if (updates.name !== undefined) dbUpdates.full_name = updates.name
      if (updates.email !== undefined) dbUpdates.email = updates.email
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', authUser.id)

      if (updateError) {
        throw updateError
      }

      // Update local state
      if (user) {
        setUser({ ...user, ...updates })
      }

      return true
    } catch (err) {
      console.error('Profile update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      return false
    }
  }, [supabase, user])

  /**
   * Update team member role
   */
  const updateTeamMemberRole = useCallback(async (memberId: string, role: 'admin' | 'member'): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId)

      if (updateError) {
        throw updateError
      }

      // Update local state
      setTeamMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role } : m
      ))

      return true
    } catch (err) {
      console.error('Role update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update role')
      return false
    }
  }, [supabase])

  /**
   * Update extension settings
   */
  const updateExtensionSettings = useCallback(async (updates: Partial<ExtensionSettings>): Promise<boolean> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setError('You must be logged in to update settings')
        return false
      }

      const dbUpdates: Partial<Tables<'extension_settings'>> = {}
      if (updates.autoCaptureEnabled !== undefined) dbUpdates.auto_capture_enabled = updates.autoCaptureEnabled
      if (updates.captureFeed !== undefined) dbUpdates.capture_feed = updates.captureFeed
      if (updates.captureAnalytics !== undefined) dbUpdates.capture_analytics = updates.captureAnalytics
      if (updates.captureProfile !== undefined) dbUpdates.capture_profile = updates.captureProfile
      if (updates.captureMessaging !== undefined) dbUpdates.capture_messaging = updates.captureMessaging
      if (updates.syncEnabled !== undefined) dbUpdates.sync_enabled = updates.syncEnabled
      if (updates.syncInterval !== undefined) dbUpdates.sync_interval = updates.syncInterval
      if (updates.darkMode !== undefined) dbUpdates.dark_mode = updates.darkMode
      if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled

      const { error: updateError } = await supabase
        .from('extension_settings')
        .upsert({
          user_id: authUser.id,
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })

      if (updateError) {
        throw updateError
      }

      // Update local state
      if (extensionSettings) {
        setExtensionSettings({ ...extensionSettings, ...updates })
      }

      return true
    } catch (err) {
      console.error('Settings update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      return false
    }
  }, [supabase, extensionSettings])

  // Fetch on mount
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return {
    user,
    linkedinConnected,
    linkedinProfile,
    teamMembers,
    extensionSettings,
    isLoading,
    error,
    refetch: fetchSettings,
    updateProfile,
    updateTeamMemberRole,
    updateExtensionSettings,
  }
}
