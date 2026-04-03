/**
 * Saved Drafts Hook
 * @description Fetches and manages saved drafts from generated_posts (status=draft).
 * Includes generation context (topic, tone, additional context) for compose-originated drafts.
 * @module hooks/use-drafts
 */

'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToTables } from '@/lib/supabase/realtime'
import { toast } from 'sonner'
import { parseDraftState, type DraftState } from '@/types/draft-state'

/**
 * The source from which a draft originated
 */
export type DraftSource = 'compose' | 'swipe' | 'discover' | 'inspiration' | 'research' | 'carousel' | 'series' | 'scheduled'

/**
 * Unified draft item combining data from multiple Supabase tables
 */
export interface SavedDraft {
  /** Unique identifier */
  id: string
  /** Post content text */
  content: string
  /** Where the draft originated from */
  source: DraftSource
  /** The underlying table this draft is stored in */
  table: 'generated_posts' | 'scheduled_posts'
  /** Post type (thought-leadership, storytelling, etc.) */
  postType: string | null
  /** Category tag */
  category: string | null
  /** Word count of the content */
  wordCount: number
  /** The topic used for AI generation (from hook field) */
  topic: string | null
  /** The tone used for AI generation (from cta field) */
  tone: string | null
  /** Additional context provided during generation (from source_snippet field) */
  additionalContext: string | null
  /** When the draft was created */
  createdAt: string
  /** When the draft was last updated */
  updatedAt: string
  /** Type-specific draft state (carousel, series, compose, remix, swipe) */
  draftState: DraftState | null
}

/**
 * Sort options for draft listings
 */
export type DraftSortBy = 'newest' | 'oldest' | 'longest' | 'shortest'

/**
 * Return type for the useDrafts hook
 */
export interface UseDraftsReturn {
  /** All unified drafts */
  drafts: SavedDraft[]
  /** Whether the initial fetch is loading */
  isLoading: boolean
  /** Error message if any operation failed */
  error: string | null
  /** Delete a draft by ID and table */
  deleteDraft: (id: string, table: SavedDraft['table']) => Promise<boolean>
  /** Bulk delete multiple drafts */
  bulkDeleteDrafts: (items: Array<{ id: string; table: SavedDraft['table'] }>) => Promise<boolean>
  /** Refetch all drafts */
  refetch: () => Promise<void>
  /** Total number of drafts */
  totalCount: number
}

/**
 * Count words in a string
 * @param text - Input text
 * @returns Number of words
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Map a source column value to a valid DraftSource
 * @param source - The source column value from generated_posts
 * @returns A valid DraftSource label
 */
function parseDraftSource(source: string | null): DraftSource {
  const validSources: DraftSource[] = ['compose', 'swipe', 'discover', 'inspiration', 'research', 'carousel', 'series']
  if (source && validSources.includes(source as DraftSource)) {
    return source as DraftSource
  }
  return 'compose'
}

/**
 * Hook to fetch and manage saved drafts from multiple Supabase tables.
 * Fetches from generated_posts (status=draft)
 * into a unified list. Includes generation context for compose-originated drafts.
 *
 * @returns Draft data, loading states, and management functions
 *
 * @example
 * ```tsx
 * const { drafts, isLoading, deleteDraft, refetch } = useDrafts()
 *
 * // Delete a draft
 * await deleteDraft(draft.id, draft.table)
 *
 * // Refetch all drafts
 * await refetch()
 * ```
 */
export function useDrafts(): UseDraftsReturn {
  const [drafts, setDrafts] = useState<SavedDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch drafts from all sources and unify them
   */
  const fetchDrafts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setDrafts([])
        setUserId(null)
        return
      }
      setUserId(user.id)

      // Fetch drafts from generated_posts
      const { data, error: fetchError } = await supabase
        .from('generated_posts')
        .select('id, content, post_type, source, discover_post_id, research_session_id, hook, cta, source_snippet, draft_state, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching drafts:', fetchError)
      }

      const unified: SavedDraft[] = (data || []).map((row) => ({
        id: row.id,
        content: row.content,
        source: parseDraftSource(row.source),
        table: 'generated_posts' as const,
        postType: row.post_type,
        category: null,
        wordCount: countWords(row.content),
        topic: row.hook || null,
        tone: row.cta || null,
        additionalContext: row.source_snippet || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        draftState: parseDraftState(row.draft_state),
      }))

      // Also fetch scheduled posts as a "scheduled" draft source
      const { data: scheduledData } = await supabase
        .from('scheduled_posts')
        .select('id, content, scheduled_for, status, created_at, updated_at')
        .eq('user_id', user.id)
        .in('status', ['pending'])
        .order('scheduled_for', { ascending: true })

      const scheduledDrafts: SavedDraft[] = (scheduledData || []).map((row) => ({
        id: row.id,
        content: row.content,
        source: 'scheduled' as DraftSource,
        table: 'scheduled_posts' as const,
        postType: 'scheduled',
        category: null,
        wordCount: countWords(row.content),
        topic: null,
        tone: null,
        additionalContext: row.scheduled_for,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        draftState: null,
      }))

      setDrafts([...unified, ...scheduledDrafts])
    } catch (err) {
      console.error('Fetch drafts error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch drafts')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  /**
   * Delete a draft from its source table
   * @param id - Draft ID
   * @param table - The Supabase table to delete from
   */
  const deleteDraft = useCallback(async (id: string, table: SavedDraft['table']): Promise<boolean> => {
    const originalDrafts = drafts
    // Determine the source of the draft being deleted
    const draftToDelete = drafts.find(d => d.id === id)

    try {
      setError(null)

      // Optimistic removal
      setDrafts(prev => prev.filter(d => d.id !== id))

      if (draftToDelete?.source === 'scheduled') {
        // Scheduled drafts live in the scheduled_posts table
        const { error: deleteError } = await supabase
          .from('scheduled_posts')
          .update({ status: 'failed' })
          .eq('id', id)

        if (deleteError) throw new Error(deleteError.message)
      } else {
        const { error: deleteError } = await supabase
          .from('generated_posts')
          .update({ status: 'archived' })
          .eq('id', id)

        if (deleteError) throw new Error(deleteError.message)
      }

      toast.success('Draft deleted')
      return true
    } catch (err) {
      console.error('Delete draft error:', err)
      setDrafts(originalDrafts)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete draft'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    }
  }, [drafts, supabase])

  /**
   * Bulk delete multiple drafts via the API route
   * @param items - Array of draft IDs and their source tables
   * @returns Whether all deletes succeeded
   */
  const bulkDeleteDrafts = useCallback(async (
    items: Array<{ id: string; table: SavedDraft['table'] }>
  ): Promise<boolean> => {
    if (items.length === 0) return true

    const originalDrafts = drafts
    const idsToDelete = new Set(items.map(i => i.id))

    try {
      setError(null)

      // Optimistic removal
      setDrafts(prev => prev.filter(d => !idsToDelete.has(d.id)))

      const response = await fetch('/api/drafts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete drafts')
      }

      const result = await response.json()
      toast.success(`${result.deleted} draft${result.deleted !== 1 ? 's' : ''} deleted`)

      if (result.errors > 0) {
        toast.warning(`${result.errors} draft${result.errors !== 1 ? 's' : ''} failed to delete`)
      }

      return true
    } catch (err) {
      console.error('Bulk delete drafts error:', err)
      setDrafts(originalDrafts)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete drafts'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    }
  }, [drafts])

  /**
   * Refetch all drafts
   */
  const refetch = useCallback(async () => {
    await fetchDrafts()
  }, [fetchDrafts])

  const totalCount = useMemo(() => drafts.length, [drafts])

  // Initial fetch
  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Real-time subscriptions: auto-refetch when drafts or scheduled posts change
  useEffect(() => {
    if (!userId) return

    const channel = subscribeToTables(
      supabase,
      `drafts-rt-${userId}`,
      [
        { table: 'generated_posts', filter: `user_id=eq.${userId}` },
        { table: 'scheduled_posts', filter: `user_id=eq.${userId}` },
      ],
      () => { fetchDrafts() }
    )

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, fetchDrafts])

  return {
    drafts,
    isLoading,
    error,
    deleteDraft,
    bulkDeleteDrafts,
    refetch,
    totalCount,
  }
}
