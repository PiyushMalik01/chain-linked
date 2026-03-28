/**
 * Company Hook
 * @description React hook for company CRUD operations and state management
 * @module hooks/use-company
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Company,
  CompanyInsert,
  CompanyUpdate,
  CompanyWithTeam,
  Team,
  TeamMember,
} from '@/types/database'

/**
 * Hook return type for company operations
 */
interface UseCompanyReturn {
  /** Current user's company */
  company: CompanyWithTeam | null
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Create a new company */
  createCompany: (data: CreateCompanyInput) => Promise<CompanyWithTeam | null>
  /** Update company details */
  updateCompany: (id: string, data: CompanyUpdate) => Promise<Company | null>
  /** Get company by ID */
  getCompany: (id: string) => Promise<CompanyWithTeam | null>
  /** Check if user has a company */
  hasCompany: boolean
  /** Refetch company data */
  refetch: () => Promise<void>
}

/**
 * Input type for creating a company
 */
export interface CreateCompanyInput {
  /** Company name */
  name: string
  /** Company logo URL (optional) */
  logoUrl?: string
}

/**
 * Generate URL-friendly slug from company name
 * @param name - Company name to convert
 * @returns URL-friendly slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50) // Limit length
}

/**
 * Generate unique slug by appending random suffix if needed
 * @param baseSlug - Base slug to make unique
 * @returns Unique slug with random suffix
 */
function makeUniqueSlug(baseSlug: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `${baseSlug}-${randomSuffix}`
}

/**
 * Hook to manage company operations
 * Fetches current user's company and provides CRUD operations
 * @returns Company data and operations
 * @example
 * const { company, isLoading, createCompany, hasCompany } = useCompany()
 *
 * // Create a new company
 * const newCompany = await createCompany({ name: 'Acme Inc', logoUrl: 'https://...' })
 */
export function useCompany(): UseCompanyReturn {
  const [company, setCompany] = useState<CompanyWithTeam | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch current user's company with team data
   */
  const fetchUserCompany = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCompany(null)
        setIsLoading(false)
        return
      }

      // First check if user is part of a team
      const { data: teamMembership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!teamMembership) {
        // User has no team membership - check if they own a company
        const { data: ownedCompany } = await supabase
          .from('companies')
          .select('*')
          .eq('owner_id', user.id)
          .single()

        if (ownedCompany) {
          // Fetch associated team
          const { data: team } = await supabase
            .from('teams')
            .select('*')
            .eq('company_id', ownedCompany.id)
            .single()

          let members: TeamMember[] = []
          if (team && team.id) {
            const { data: teamMembers } = await supabase
              .from('team_members')
              .select('*')
              .eq('team_id', team.id)
            members = (teamMembers || []) as TeamMember[]
          }

          setCompany({
            ...ownedCompany,
            team: team || null,
            team_members: members,
          })
        } else {
          setCompany(null)
        }
        setIsLoading(false)
        return
      }

      // User is part of a team - fetch the team and company
      const { data: team } = await supabase
        .from('teams')
        .select('*, company_id')
        .eq('id', teamMembership.team_id)
        .single()

      if (!team?.company_id) {
        setCompany(null)
        setIsLoading(false)
        return
      }

      // Fetch company
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', team.company_id)
        .single()

      if (!companyData) {
        setCompany(null)
        setIsLoading(false)
        return
      }

      // Fetch team members
      const { data: members } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', team.id)

      setCompany({
        ...companyData,
        team: team,
        team_members: members || [],
      })
    } catch (err) {
      console.error('Company fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch company')
      setCompany(null)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  /**
   * Create a new company with default team
   * @param data - Company creation data
   * @returns Created company with team or null on error
   */
  const createCompany = useCallback(async (data: CreateCompanyInput): Promise<CompanyWithTeam | null> => {
    try {
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to create a company')
        return null
      }

      // Generate unique slug
      const baseSlug = generateSlug(data.name)
      let slug = baseSlug

      // Check if slug exists and make unique if needed
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('slug')
        .eq('slug', baseSlug)
        .single()

      if (existingCompany) {
        slug = makeUniqueSlug(baseSlug)
      }

      // Create company
      const companyInsert: CompanyInsert = {
        name: data.name,
        slug,
        logo_url: data.logoUrl || null,
        owner_id: user.id,
        settings: {},
      }

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert(companyInsert)
        .select()
        .single()

      if (companyError) {
        console.error('Company creation error:', companyError)
        setError(companyError.message)
        return null
      }

      // Create default team for the company
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: `${data.name} Team`,
          owner_id: user.id,
          company_id: newCompany.id,
          logo_url: data.logoUrl || null,
        })
        .select()
        .single()

      if (teamError) {
        console.error('Team creation error:', teamError)
        // Rollback company creation
        await supabase.from('companies').delete().eq('id', newCompany.id)
        setError(teamError.message)
        return null
      }

      // Add user as team owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) {
        console.error('Team member creation error:', memberError)
        // Rollback
        await supabase.from('teams').delete().eq('id', newTeam.id)
        await supabase.from('companies').delete().eq('id', newCompany.id)
        setError(memberError.message)
        return null
      }

      const companyWithTeam: CompanyWithTeam = {
        ...newCompany,
        team: newTeam,
        team_members: [{
          id: '', // Will be assigned by DB
          team_id: newTeam.id,
          user_id: user.id,
          role: 'owner',
          joined_at: new Date().toISOString(),
        }],
      }

      setCompany(companyWithTeam)
      return companyWithTeam
    } catch (err) {
      console.error('Create company error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create company')
      return null
    }
  }, [supabase])

  /**
   * Update company details
   * @param id - Company ID
   * @param data - Update data
   * @returns Updated company or null on error
   */
  const updateCompany = useCallback(async (id: string, data: CompanyUpdate): Promise<Company | null> => {
    try {
      setError(null)

      const { data: updatedCompany, error: updateError } = await supabase
        .from('companies')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Company update error:', updateError)
        setError(updateError.message)
        return null
      }

      // Update local state if this is the current company
      if (company?.id === id) {
        setCompany(prev => prev ? { ...prev, ...updatedCompany } : null)
      }

      return updatedCompany
    } catch (err) {
      console.error('Update company error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update company')
      return null
    }
  }, [supabase, company?.id])

  /**
   * Get company by ID with team data
   * @param id - Company ID
   * @returns Company with team data or null
   */
  const getCompany = useCallback(async (id: string): Promise<CompanyWithTeam | null> => {
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()

      if (companyError || !companyData) {
        return null
      }

      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('company_id', id)
        .single()

      let members: TeamMember[] = []
      if (team && team.id) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', team.id)
        members = (teamMembers || []) as TeamMember[]
      }

      return {
        ...companyData,
        team: team || null,
        team_members: members,
      }
    } catch (err) {
      console.error('Get company error:', err)
      return null
    }
  }, [supabase])

  // Fetch company on mount
  useEffect(() => {
    fetchUserCompany()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    company,
    isLoading,
    error,
    createCompany,
    updateCompany,
    getCompany,
    hasCompany: company !== null,
    refetch: fetchUserCompany,
  }
}
