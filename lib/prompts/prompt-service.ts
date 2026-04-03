/**
 * Prompt Service
 * @description Core service for fetching, caching, and managing prompts.
 * Provides a unified interface for all prompt operations with automatic
 * fallback to hardcoded defaults when database prompts are unavailable.
 * @module lib/prompts/prompt-service
 */

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PromptCache } from './prompt-cache'
import { getDefaultPromptContent } from './prompt-defaults'
import {
  type PromptType,
  type SystemPrompt,
  type PromptVersion,
  type SavePromptInput,
  type PromptUsageInput,
  type UsageFilter,
  type UsageAnalytics,
  type PromptWithVersions,
  type SystemPromptRow,
  type PromptVersionRow,
  type PromptFeature,
  mapRowToSystemPrompt,
  mapRowToPromptVersion,
} from './prompt-types'

/**
 * Helper type to access tables not yet in the generated Database type.
 * Once the migration is applied and types are regenerated, this can be removed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, 'public', any>

/**
 * Error class for prompt service operations
 */
export class PromptServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'PromptServiceError'
  }
}

/**
 * Core prompt service for fetching, caching, and managing prompts.
 *
 * Features:
 * - In-memory caching with 5-minute TTL
 * - Automatic fallback to hardcoded defaults
 * - Version tracking and rollback support
 * - Usage logging for analytics
 *
 * @example
 * // Get a prompt with automatic fallback
 * const content = await PromptService.getPromptWithFallback(PromptType.REMIX_PROFESSIONAL)
 *
 * // Save a new prompt
 * const prompt = await PromptService.savePrompt({
 *   type: PromptType.REMIX_PROFESSIONAL,
 *   name: 'Custom Professional Remix',
 *   content: '...',
 * })
 *
 * // Log usage for analytics
 * await PromptService.logUsage({
 *   promptType: PromptType.REMIX_PROFESSIONAL,
 *   promptVersion: 1,
 *   feature: 'remix',
 *   success: true,
 * })
 */
export class PromptService {
  /**
   * Get the active prompt for a given type.
   * Returns null if no active prompt exists (caller should use fallback).
   *
   * @param type - The prompt type to retrieve
   * @returns The active SystemPrompt or null if not found
   * @example
   * const prompt = await PromptService.getActivePrompt(PromptType.REMIX_PROFESSIONAL)
   * if (prompt) {
   *   console.log('Using database prompt:', prompt.name)
   * }
   */
  static async getActivePrompt(type: PromptType): Promise<SystemPrompt | null> {
    // 1. Check cache first
    const cached = PromptCache.get(type)
    if (cached) {
      return cached
    }

    try {
      // 2. Query database for active prompt of this type
      const supabase = (await createClient()) as AnySupabaseClient

      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .single()

      if (error) {
        // PGRST116 = no rows found - this is expected when no active prompt exists
        // 42P01 = table does not exist - return null and use fallback
        if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
          return null
        }
        console.error('[PromptService] Error fetching active prompt:', error)
        return null
      }

      if (!data) {
        return null
      }

      // 3. Map row to TypeScript object and cache
      const prompt = mapRowToSystemPrompt(data as SystemPromptRow)
      PromptCache.set(type, prompt)

      return prompt
    } catch (error) {
      console.error('[PromptService] Unexpected error in getActivePrompt:', error)
      return null
    }
  }

  /**
   * Get prompt content with automatic fallback to hardcoded defaults.
   * This is the primary method AI routes should use to fetch prompts.
   *
   * Behavior:
   * 1. Attempts to fetch active prompt from database (with caching)
   * 2. Falls back to hardcoded default if database query fails or returns null
   * 3. Never throws - always returns a valid prompt string
   *
   * @param type - The prompt type to retrieve
   * @returns The prompt content string (never null, never throws)
   * @example
   * // In an API route:
   * const systemPrompt = await PromptService.getPromptWithFallback(PromptType.REMIX_PROFESSIONAL)
   * // systemPrompt is guaranteed to be a valid string
   */
  static async getPromptWithFallback(type: PromptType): Promise<string> {
    try {
      // Try to get active prompt from database
      const activePrompt = await this.getActivePrompt(type)

      if (activePrompt && activePrompt.content) {
        return activePrompt.content
      }

      // Fallback to hardcoded default
      return getDefaultPromptContent(type)
    } catch (error) {
      // Log error but don't throw - return default instead
      console.error(
        '[PromptService] Error in getPromptWithFallback, using default:',
        error
      )
      return getDefaultPromptContent(type)
    }
  }

  /**
   * Get a specific prompt by its ID.
   *
   * @param id - The UUID of the prompt
   * @returns The SystemPrompt or null if not found
   * @example
   * const prompt = await PromptService.getPromptById('uuid-here')
   */
  static async getPromptById(id: string): Promise<SystemPrompt | null> {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw new PromptServiceError(
          'Failed to fetch prompt by ID',
          'FETCH_ERROR',
          error
        )
      }

      return data ? mapRowToSystemPrompt(data as SystemPromptRow) : null
    } catch (error) {
      if (error instanceof PromptServiceError) throw error
      console.error('[PromptService] Error in getPromptById:', error)
      return null
    }
  }

  /**
   * List all prompts with optional filters.
   *
   * @param filters - Optional filters for type, active status, and default status
   * @returns Array of SystemPrompt objects
   * @example
   * // Get all active prompts
   * const activePrompts = await PromptService.listPrompts({ isActive: true })
   *
   * // Get all remix prompts
   * const remixPrompts = await PromptService.listPrompts({ type: PromptType.REMIX_PROFESSIONAL })
   */
  static async listPrompts(filters?: {
    type?: PromptType
    isActive?: boolean
    isDefault?: boolean
  }): Promise<SystemPrompt[]> {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      let query = supabase
        .from('system_prompts')
        .select('*')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false })

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      }

      if (filters?.isDefault !== undefined) {
        query = query.eq('is_default', filters.isDefault)
      }

      const { data, error } = await query

      if (error) {
        // Handle ALL database errors gracefully - table may not exist yet
        // Common codes: 42P01 (table doesn't exist), PGRST (PostgREST errors)
        console.warn('[PromptService] Database error in listPrompts, returning empty array:', error.code, error.message)
        return []
      }

      return (data ?? []).map((row) =>
        mapRowToSystemPrompt(row as SystemPromptRow)
      )
    } catch (error) {
      // Catch ALL errors and return empty array - prompts system is optional
      console.warn('[PromptService] Error in listPrompts, returning empty array:', error)
      return []
    }
  }

  /**
   * Save a new prompt or update an existing one.
   * Automatically handles versioning via database triggers.
   *
   * @param data - The prompt data to save
   * @returns The created/updated SystemPrompt
   * @throws PromptServiceError if save fails
   * @example
   * // Create a new prompt
   * const newPrompt = await PromptService.savePrompt({
   *   type: PromptType.REMIX_PROFESSIONAL,
   *   name: 'Custom Professional',
   *   content: 'You are an expert...',
   *   setActive: true,
   * })
   *
   * // Update existing prompt
   * const updated = await PromptService.savePrompt({
   *   id: existingPrompt.id,
   *   type: existingPrompt.type,
   *   name: existingPrompt.name,
   *   content: 'Updated content...',
   *   changeNotes: 'Improved hook section',
   * })
   */
  static async savePrompt(data: SavePromptInput): Promise<SystemPrompt> {
    const supabase = (await createClient()) as AnySupabaseClient

    // Get current user for audit trail
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    if (data.id) {
      // Update existing prompt
      const existingPrompt = await this.getPromptById(data.id)
      if (!existingPrompt) {
        throw new PromptServiceError(
          'Prompt not found for update',
          'NOT_FOUND',
          { id: data.id }
        )
      }

      // Check if content changed to increment version
      const contentChanged = existingPrompt.content !== data.content
      const variablesChanged =
        JSON.stringify(existingPrompt.variables) !==
        JSON.stringify(data.variables ?? existingPrompt.variables)

      const updateData: Record<string, unknown> = {
        name: data.name,
        description: data.description ?? existingPrompt.description,
        content: data.content,
        variables: data.variables ?? existingPrompt.variables,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }

      // Increment version if content or variables changed
      if (contentChanged || variablesChanged) {
        updateData.version = existingPrompt.version + 1
      }

      // Handle activation
      if (data.setActive) {
        updateData.is_active = true
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('system_prompts')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single()

      if (updateError) {
        throw new PromptServiceError(
          'Failed to update prompt',
          'UPDATE_ERROR',
          updateError
        )
      }

      // Invalidate cache for this type
      PromptCache.invalidate(data.type)

      return mapRowToSystemPrompt(updatedData as SystemPromptRow)
    } else {
      // Create new prompt
      const insertData = {
        type: data.type,
        name: data.name,
        description: data.description ?? null,
        content: data.content,
        variables: data.variables ?? [],
        version: 1,
        is_active: data.setActive ?? false,
        is_default: false,
        created_by: userId,
        updated_by: userId,
      }

      const { data: insertedData, error: insertError } = await supabase
        .from('system_prompts')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        throw new PromptServiceError(
          'Failed to create prompt',
          'INSERT_ERROR',
          insertError
        )
      }

      // Create initial version entry
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: insertedData.id,
          version: 1,
          content: data.content,
          variables: data.variables ?? [],
          change_notes: data.changeNotes ?? 'Initial version',
          created_by: userId,
        })

      if (versionError) {
        console.error(
          '[PromptService] Warning: Failed to create initial version:',
          versionError
        )
        // Don't throw - the prompt was created successfully
      }

      // Invalidate cache for this type if activated
      if (data.setActive) {
        PromptCache.invalidate(data.type)
      }

      return mapRowToSystemPrompt(insertedData as SystemPromptRow)
    }
  }

  /**
   * Activate a prompt (deactivates others of the same type).
   * Uses database trigger for atomic deactivation of other prompts.
   *
   * @param promptId - The UUID of the prompt to activate
   * @throws PromptServiceError if activation fails
   * @example
   * await PromptService.activatePrompt('uuid-of-prompt')
   */
  static async activatePrompt(promptId: string): Promise<void> {
    const prompt = await this.getPromptById(promptId)
    if (!prompt) {
      throw new PromptServiceError(
        'Prompt not found for activation',
        'NOT_FOUND',
        { id: promptId }
      )
    }

    const supabase = (await createClient()) as AnySupabaseClient

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('system_prompts')
      .update({
        is_active: true,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId)

    if (error) {
      throw new PromptServiceError(
        'Failed to activate prompt',
        'ACTIVATION_ERROR',
        error
      )
    }

    // Invalidate cache for this type
    PromptCache.invalidate(prompt.type)
  }

  /**
   * Deactivate a prompt.
   *
   * @param promptId - The UUID of the prompt to deactivate
   * @throws PromptServiceError if deactivation fails
   * @example
   * await PromptService.deactivatePrompt('uuid-of-prompt')
   */
  static async deactivatePrompt(promptId: string): Promise<void> {
    const prompt = await this.getPromptById(promptId)
    if (!prompt) {
      throw new PromptServiceError(
        'Prompt not found for deactivation',
        'NOT_FOUND',
        { id: promptId }
      )
    }

    const supabase = (await createClient()) as AnySupabaseClient

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('system_prompts')
      .update({
        is_active: false,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId)

    if (error) {
      throw new PromptServiceError(
        'Failed to deactivate prompt',
        'DEACTIVATION_ERROR',
        error
      )
    }

    // Invalidate cache for this type
    PromptCache.invalidate(prompt.type)
  }

  /**
   * Delete a prompt.
   * Note: This is a hard delete. Versions are cascade deleted.
   *
   * @param promptId - The UUID of the prompt to delete
   * @throws PromptServiceError if deletion fails
   * @example
   * await PromptService.deletePrompt('uuid-of-prompt')
   */
  static async deletePrompt(promptId: string): Promise<void> {
    const prompt = await this.getPromptById(promptId)
    if (!prompt) {
      throw new PromptServiceError(
        'Prompt not found for deletion',
        'NOT_FOUND',
        { id: promptId }
      )
    }

    // Don't allow deleting default prompts
    if (prompt.isDefault) {
      throw new PromptServiceError(
        'Cannot delete default prompts',
        'DELETE_DENIED',
        { id: promptId }
      )
    }

    const supabase = (await createClient()) as AnySupabaseClient

    const { error } = await supabase
      .from('system_prompts')
      .delete()
      .eq('id', promptId)

    if (error) {
      throw new PromptServiceError(
        'Failed to delete prompt',
        'DELETE_ERROR',
        error
      )
    }

    // Invalidate cache for this type
    PromptCache.invalidate(prompt.type)
  }

  /**
   * Rollback a prompt to a specific version.
   * Creates a new version with the old content (doesn't actually go back in time).
   *
   * @param promptId - The UUID of the prompt to rollback
   * @param version - The version number to rollback to
   * @returns The updated SystemPrompt
   * @throws PromptServiceError if rollback fails
   * @example
   * const restored = await PromptService.rollbackToVersion('uuid', 2)
   */
  static async rollbackToVersion(
    promptId: string,
    version: number
  ): Promise<SystemPrompt> {
    // Get the version record
    const versionRecord = (await this.getVersionHistory(promptId)).find(
      (v) => v.version === version
    )

    if (!versionRecord) {
      throw new PromptServiceError(
        'Version not found for rollback',
        'VERSION_NOT_FOUND',
        { promptId, version }
      )
    }

    const currentPrompt = await this.getPromptById(promptId)
    if (!currentPrompt) {
      throw new PromptServiceError(
        'Prompt not found for rollback',
        'NOT_FOUND',
        { id: promptId }
      )
    }

    // Update the prompt with the version's content (this creates a new version via trigger)
    return this.savePrompt({
      id: promptId,
      type: currentPrompt.type,
      name: currentPrompt.name,
      content: versionRecord.content,
      variables: versionRecord.variables,
      changeNotes: `Rollback to version ${version}`,
    })
  }

  /**
   * Get version history for a prompt.
   *
   * @param promptId - The UUID of the prompt
   * @returns Array of PromptVersion objects, ordered by version descending
   * @example
   * const versions = await PromptService.getVersionHistory('uuid')
   * console.log(`Found ${versions.length} versions`)
   */
  static async getVersionHistory(promptId: string): Promise<PromptVersion[]> {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('prompt_id', promptId)
        .order('version', { ascending: false })

      if (error) {
        throw new PromptServiceError(
          'Failed to fetch version history',
          'FETCH_ERROR',
          error
        )
      }

      return (data ?? []).map((row) =>
        mapRowToPromptVersion(row as PromptVersionRow)
      )
    } catch (error) {
      if (error instanceof PromptServiceError) throw error
      console.error('[PromptService] Error in getVersionHistory:', error)
      return []
    }
  }

  /**
   * Get a prompt with all its versions.
   *
   * @param promptId - The UUID of the prompt
   * @returns PromptWithVersions object or null if not found
   * @example
   * const promptWithVersions = await PromptService.getPromptWithVersions('uuid')
   */
  static async getPromptWithVersions(
    promptId: string
  ): Promise<PromptWithVersions | null> {
    const prompt = await this.getPromptById(promptId)
    if (!prompt) {
      return null
    }

    const versions = await this.getVersionHistory(promptId)

    return {
      ...prompt,
      versions,
    }
  }

  /**
   * Log prompt usage for analytics.
   * This method never throws - usage logging should not break the main flow.
   *
   * @param data - Usage data to log
   * @example
   * await PromptService.logUsage({
   *   promptId: prompt.id,
   *   promptType: PromptType.REMIX_PROFESSIONAL,
   *   promptVersion: prompt.version,
   *   userId: user.id,
   *   feature: 'remix',
   *   totalTokens: 1500,
   *   model: 'gpt-4o-mini',
   *   success: true,
   * })
   */
  static async logUsage(data: PromptUsageInput): Promise<void> {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      const { error } = await supabase.from('prompt_usage_logs').insert({
        prompt_id: data.promptId ?? null,
        prompt_type: data.promptType,
        prompt_version: data.promptVersion,
        user_id: data.userId ?? null,
        feature: data.feature,
        input_tokens: data.inputTokens ?? null,
        output_tokens: data.outputTokens ?? null,
        total_tokens: data.totalTokens ?? null,
        model: data.model ?? null,
        response_time_ms: data.responseTimeMs ?? null,
        success: data.success,
        error_message: data.errorMessage ?? null,
        estimated_cost: data.estimatedCost ?? null,
        metadata: data.metadata ?? {},
      })

      if (error) {
        console.error('[PromptService] Failed to log usage:', error)
        // Don't throw - usage logging failure shouldn't break main flow
      }
    } catch (error) {
      console.error('[PromptService] Unexpected error in logUsage:', error)
      // Don't throw - usage logging failure shouldn't break main flow
    }
  }

  /**
   * Get usage analytics for a prompt or type.
   *
   * @param filter - Filters for the analytics query
   * @returns Aggregated usage analytics
   * @example
   * const analytics = await PromptService.getUsageAnalytics({
   *   promptType: PromptType.REMIX_PROFESSIONAL,
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-31',
   * })
   */
  static async getUsageAnalytics(filter: UsageFilter): Promise<UsageAnalytics> {
    const defaultAnalytics: UsageAnalytics = {
      totalUsages: 0,
      totalTokens: 0,
      avgTokens: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 0,
      avgResponseTimeMs: 0,
      byFeature: {
        remix: 0,
        compose: 0,
        carousel: 0,
        playground: 0,
        "edit-selection": 0,
        "carousel-caption": 0,
        "analyze-company": 0,
        "compose-series": 0,
        pipeline: 0,
      },
      byModel: {},
      dailyUsage: [],
    }

    try {
      const supabase = (await createClient()) as AnySupabaseClient

      // Build query with filters
      let query = supabase.from('prompt_usage_logs').select('*')

      if (filter.promptId) {
        query = query.eq('prompt_id', filter.promptId)
      }

      if (filter.promptType) {
        query = query.eq('prompt_type', filter.promptType)
      }

      if (filter.feature) {
        query = query.eq('feature', filter.feature)
      }

      if (filter.userId) {
        query = query.eq('user_id', filter.userId)
      }

      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate)
      }

      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate)
      }

      query = query.order('created_at', { ascending: false })

      if (filter.limit) {
        query = query.limit(filter.limit)
      }

      if (filter.offset) {
        query = query.range(
          filter.offset,
          filter.offset + (filter.limit ?? 100) - 1
        )
      }

      const { data, error } = await query

      if (error) {
        console.error('[PromptService] Error fetching usage analytics:', error)
        return defaultAnalytics
      }

      if (!data || data.length === 0) {
        return defaultAnalytics
      }

      // Aggregate the data
      const totalUsages = data.length
      let totalTokens = 0
      let successCount = 0
      let totalResponseTime = 0
      let responseTimeCount = 0
      const byFeature: Record<PromptFeature, number> = {
        remix: 0,
        compose: 0,
        carousel: 0,
        playground: 0,
        "edit-selection": 0,
        "carousel-caption": 0,
        "analyze-company": 0,
        "compose-series": 0,
        pipeline: 0,
      }
      const byModel: Record<string, number> = {}
      const dailyMap = new Map<string, { count: number; tokens: number }>()

      for (const row of data) {
        // Totals
        totalTokens += row.total_tokens ?? 0
        if (row.success) successCount++

        // Response time
        if (row.response_time_ms) {
          totalResponseTime += row.response_time_ms
          responseTimeCount++
        }

        // By feature
        const feature = row.feature as PromptFeature
        if (feature in byFeature) {
          byFeature[feature]++
        }

        // By model
        if (row.model) {
          byModel[row.model] = (byModel[row.model] ?? 0) + 1
        }

        // Daily usage
        const date = new Date(row.created_at).toISOString().split('T')[0]
        const existing = dailyMap.get(date) ?? { count: 0, tokens: 0 }
        dailyMap.set(date, {
          count: existing.count + 1,
          tokens: existing.tokens + (row.total_tokens ?? 0),
        })
      }

      // Sort daily usage by date
      const dailyUsage = Array.from(dailyMap.entries())
        .map(([date, { count, tokens }]) => ({ date, count, tokens }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        totalUsages,
        totalTokens,
        avgTokens: totalUsages > 0 ? Math.round(totalTokens / totalUsages) : 0,
        successCount,
        errorCount: totalUsages - successCount,
        successRate:
          totalUsages > 0
            ? Math.round((successCount / totalUsages) * 100)
            : 0,
        avgResponseTimeMs:
          responseTimeCount > 0
            ? Math.round(totalResponseTime / responseTimeCount)
            : 0,
        byFeature,
        byModel,
        dailyUsage,
      }
    } catch (error) {
      console.error('[PromptService] Unexpected error in getUsageAnalytics:', error)
      return defaultAnalytics
    }
  }

  /**
   * Save a test result from the playground.
   * Used to track prompt experiments and their outcomes.
   *
   * @param data - Test result data to save
   * @example
   * await PromptService.saveTestResult({
   *   promptId: prompt.id,
   *   promptVersion: prompt.version,
   *   userId: user.id,
   *   systemPrompt: 'You are...',
   *   userPrompt: 'Write a post about...',
   *   variables: { industry: 'SaaS' },
   *   model: 'gpt-4o-mini',
   *   temperature: 0.7,
   *   responseContent: 'Generated post...',
   *   tokensUsed: 500,
   *   rating: 4,
   * })
   */
  static async saveTestResult(data: {
    promptId?: string
    promptVersion: number
    userId: string
    systemPrompt: string
    userPrompt: string
    variables: Record<string, string>
    model: string
    temperature?: number
    maxTokens?: number
    responseContent: string
    tokensUsed?: number
    estimatedCost?: number
    rating?: number
    notes?: string
  }): Promise<void> {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      const { error } = await supabase.from('prompt_test_results').insert({
        prompt_id: data.promptId ?? null,
        prompt_version: data.promptVersion,
        user_id: data.userId,
        system_prompt: data.systemPrompt,
        user_prompt: data.userPrompt,
        variables: data.variables,
        model: data.model,
        temperature: data.temperature ?? null,
        max_tokens: data.maxTokens ?? null,
        response_content: data.responseContent,
        tokens_used: data.tokensUsed ?? null,
        estimated_cost: data.estimatedCost ?? null,
        rating: data.rating ?? null,
        notes: data.notes ?? null,
      })

      if (error) {
        throw new PromptServiceError(
          'Failed to save test result',
          'SAVE_ERROR',
          error
        )
      }
    } catch (error) {
      if (error instanceof PromptServiceError) throw error
      console.error('[PromptService] Error in saveTestResult:', error)
      throw new PromptServiceError(
        'Unexpected error saving test result',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Get test results for a prompt or user.
   *
   * @param filters - Filters for the query
   * @returns Array of test results
   */
  static async getTestResults(filters: {
    promptId?: string
    userId?: string
    limit?: number
  }): Promise<
    Array<{
      id: string
      promptVersion: number
      systemPrompt: string
      userPrompt: string
      variables: Record<string, string>
      model: string
      temperature: number | null
      responseContent: string
      tokensUsed: number | null
      rating: number | null
      notes: string | null
      createdAt: string
    }>
  > {
    try {
      const supabase = (await createClient()) as AnySupabaseClient

      let query = supabase
        .from('prompt_test_results')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.promptId) {
        query = query.eq('prompt_id', filters.promptId)
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('[PromptService] Error fetching test results:', error)
        return []
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        promptVersion: row.prompt_version,
        systemPrompt: row.system_prompt,
        userPrompt: row.user_prompt,
        variables: row.variables ?? {},
        model: row.model,
        temperature: row.temperature,
        responseContent: row.response_content,
        tokensUsed: row.tokens_used,
        rating: row.rating,
        notes: row.notes,
        createdAt: row.created_at,
      }))
    } catch (error) {
      console.error('[PromptService] Unexpected error in getTestResults:', error)
      return []
    }
  }
}
