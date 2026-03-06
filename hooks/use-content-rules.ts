"use client"

/**
 * Content Rules Hook
 * @description React hook for managing AI content rules - personal and team-level
 * @module hooks/use-content-rules
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

/**
 * A single content rule
 */
export interface ContentRule {
  /** Unique rule ID */
  id: string
  /** User who owns the rule */
  user_id: string
  /** Team ID if this is a team rule; null for personal rules */
  team_id: string | null
  /** Category/type of the rule */
  rule_type: string
  /** The rule text injected into AI prompts */
  rule_text: string
  /** Whether the rule is currently active */
  is_active: boolean
  /** Priority order (higher = first in prompt) */
  priority: number
  /** When the rule was created */
  created_at: string
  /** When the rule was last updated */
  updated_at: string
}

/**
 * Payload for adding a new rule
 */
export interface AddRulePayload {
  /** Rule text */
  rule_text: string
  /** Rule type/category */
  rule_type?: string
  /** Team ID for team rules */
  team_id?: string | null
}

/**
 * Payload for updating an existing rule
 */
export interface UpdateRulePayload {
  /** New rule text */
  rule_text?: string
  /** New active state */
  is_active?: boolean
  /** New priority */
  priority?: number
}

/**
 * Return type of the useContentRules hook
 */
export interface UseContentRulesReturn {
  /** List of content rules */
  rules: ContentRule[]
  /** Whether rules are loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /**
   * Add a new content rule
   * @param payload - Rule data
   * @returns Created rule or null on error
   */
  addRule: (payload: AddRulePayload) => Promise<ContentRule | null>
  /**
   * Update an existing rule
   * @param id - Rule ID
   * @param updates - Fields to update
   * @returns Updated rule or null on error
   */
  updateRule: (id: string, updates: UpdateRulePayload) => Promise<ContentRule | null>
  /**
   * Delete a rule
   * @param id - Rule ID
   * @returns Whether deletion was successful
   */
  deleteRule: (id: string) => Promise<boolean>
  /**
   * Toggle a rule's active state
   * @param id - Rule ID
   * @returns Whether toggle was successful
   */
  toggleRule: (id: string) => Promise<boolean>
  /** Refetch rules from database */
  refetch: () => Promise<void>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to manage AI content rules for a user or team
 *
 * Queries the `content_rules` table filtered by scope:
 * - `personal`: rules where team_id IS NULL
 * - `team`: rules belonging to the specified teamId
 *
 * @param scope - Whether to fetch personal or team rules
 * @param teamId - Required when scope is 'team'
 * @returns Content rules state and CRUD operations
 * @example
 * // Personal rules
 * const { rules, addRule, toggleRule, deleteRule } = useContentRules({ scope: 'personal' })
 *
 * // Team rules
 * const { rules, addRule } = useContentRules({ scope: 'team', teamId: 'team-uuid' })
 */
export function useContentRules({
  scope,
  teamId,
}: {
  scope: 'personal' | 'team'
  teamId?: string | null
}): UseContentRulesReturn {
  const [rules, setRules] = useState<ContentRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch rules from the database
   */
  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRules([])
        return
      }

      let query = supabase
        .from('content_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (scope === 'personal') {
        query = query.is('team_id', null)
      } else if (scope === 'team' && teamId) {
        query = query.eq('team_id', teamId)
      } else {
        setRules([])
        setIsLoading(false)
        return
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      setRules((data as ContentRule[]) || [])
    } catch (err) {
      console.error('[useContentRules] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load content rules')
    } finally {
      setIsLoading(false)
    }
  }, [scope, teamId])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  /**
   * Add a new content rule
   */
  const addRule = useCallback(async (payload: AddRulePayload): Promise<ContentRule | null> => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertError } = await supabase
        .from('content_rules')
        .insert({
          user_id: user.id,
          team_id: payload.team_id ?? (scope === 'team' ? teamId : null),
          rule_type: payload.rule_type ?? 'custom',
          rule_text: payload.rule_text,
          is_active: true,
          priority: 0,
        })
        .select()
        .single()

      if (insertError) throw insertError

      const newRule = data as ContentRule
      setRules(prev => [...prev, newRule])
      return newRule
    } catch (err) {
      console.error('[useContentRules] addRule error:', err)
      toast.error('Failed to add rule')
      return null
    }
  }, [scope, teamId])

  /**
   * Update an existing rule
   */
  const updateRule = useCallback(async (id: string, updates: UpdateRulePayload): Promise<ContentRule | null> => {
    try {
      const supabase = createClient()

      const { data, error: updateError } = await supabase
        .from('content_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      const updated = data as ContentRule
      setRules(prev => prev.map(r => r.id === id ? updated : r))
      return updated
    } catch (err) {
      console.error('[useContentRules] updateRule error:', err)
      toast.error('Failed to update rule')
      return null
    }
  }, [])

  /**
   * Delete a rule
   */
  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const supabase = createClient()

      const { error: deleteError } = await supabase
        .from('content_rules')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setRules(prev => prev.filter(r => r.id !== id))
      return true
    } catch (err) {
      console.error('[useContentRules] deleteRule error:', err)
      toast.error('Failed to delete rule')
      return false
    }
  }, [])

  /**
   * Toggle a rule's active state
   */
  const toggleRule = useCallback(async (id: string): Promise<boolean> => {
    const rule = rules.find(r => r.id === id)
    if (!rule) return false

    const updated = await updateRule(id, { is_active: !rule.is_active })
    return updated !== null
  }, [rules, updateRule])

  return {
    rules,
    isLoading,
    error,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    refetch: fetchRules,
  }
}
