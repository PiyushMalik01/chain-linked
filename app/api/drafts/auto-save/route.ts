/**
 * Auto-Save Draft API Route
 * @description Handles auto-saving drafts when the user navigates away from the compose page.
 * Designed to work with navigator.sendBeacon() for reliable saves on page unload.
 * @module app/api/drafts/auto-save/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/** Convenience alias for the generated_posts Insert type */
type GeneratedPostInsert = Database['public']['Tables']['generated_posts']['Insert']
/** Convenience alias for the generated_posts Update type */
type GeneratedPostUpdate = Database['public']['Tables']['generated_posts']['Update']

/**
 * Request body schema for auto-saving a draft
 */
interface AutoSaveDraftRequest {
  /** The post content to save */
  content: string
  /** The post type (e.g., 'thought-leadership', 'storytelling', 'general') */
  postType?: string
  /** Where the draft originated from (compose, swipe, inspiration, carousel, discover, research) */
  source?: string
  /** The topic used for AI generation */
  topic?: string | null
  /** The tone used for AI generation */
  tone?: string | null
  /** Additional context provided by the user */
  context?: string | null
  /** Word count of the content */
  wordCount?: number
  /** Existing draft row ID — when provided, updates in place instead of inserting */
  draftId?: string
  /** AI metadata for tracking token usage, model, and cost */
  aiMetadata?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    model?: string
    estimated_cost?: number
    prompt_snapshot?: Record<string, unknown>
  } | null
  /** Compose conversation ID (FK to compose_conversations) */
  conversationId?: string | null
}

/**
 * POST /api/drafts/auto-save
 * Auto-saves a draft to the generated_posts table.
 * Uses the hook field for topic, cta for tone, and source_snippet for additional context.
 * @param request - The auto-save request with content and generation context
 * @returns Success or error response
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body - handle both JSON and text (sendBeacon sends text/plain)
    let body: AutoSaveDraftRequest
    try {
      const text = await request.text()
      body = JSON.parse(text) as AutoSaveDraftRequest
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { content, postType, source, topic, tone, context, wordCount, draftId, aiMetadata, conversationId } = body

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const trimmedContent = content.trim()
    const computedWordCount = wordCount || trimmedContent.split(/\s+/).filter(Boolean).length

    // If we have an existing draft ID, update it in place
    if (draftId) {
      const updatePayload: GeneratedPostUpdate = {
          content: trimmedContent,
          post_type: postType || 'general',
          hook: topic || null,
          cta: tone || null,
          source_snippet: context || null,
          word_count: computedWordCount,
          updated_at: new Date().toISOString(),
        }

      // Include AI metadata fields if provided (only on first save, avoid overwriting)
      if (aiMetadata) {
        if (aiMetadata.prompt_tokens != null) updatePayload.prompt_tokens = aiMetadata.prompt_tokens
        if (aiMetadata.completion_tokens != null) updatePayload.completion_tokens = aiMetadata.completion_tokens
        if (aiMetadata.total_tokens != null) updatePayload.total_tokens = aiMetadata.total_tokens
        if (aiMetadata.model) updatePayload.model = aiMetadata.model
        if (aiMetadata.estimated_cost != null) updatePayload.estimated_cost = aiMetadata.estimated_cost
        if (aiMetadata.prompt_snapshot) updatePayload.prompt_snapshot = aiMetadata.prompt_snapshot as Database['public']['Tables']['generated_posts']['Update']['prompt_snapshot']
      }
      if (conversationId) updatePayload.conversation_id = conversationId

      const { data: updated, error: updateError } = await supabase
        .from('generated_posts')
        .update(updatePayload)
        .eq('id', draftId)
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .select('id')
        .single()

      if (!updateError && updated) {
        return NextResponse.json({
          success: true,
          id: updated.id,
        })
      }
      // If the update failed (e.g. draft was archived/deleted), fall through to insert
    }

    // Check for duplicate draft (same content already saved as a draft)
    const { data: existingDraft } = await supabase
      .from('generated_posts')
      .select('id')
      .eq('user_id', user.id)
      .eq('content', trimmedContent)
      .eq('status', 'draft')
      .limit(1)

    if (existingDraft && existingDraft.length > 0) {
      // Update the timestamp so it surfaces as recently edited
      await supabase
        .from('generated_posts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingDraft[0].id)

      return NextResponse.json({
        success: true,
        message: 'Draft already exists',
        id: existingDraft[0].id,
      })
    }

    // Insert new draft into generated_posts
    const insertPayload: GeneratedPostInsert = {
      user_id: user.id,
      content: trimmedContent,
      post_type: postType || 'general',
      source: source || 'compose',
      hook: topic || null,
      cta: tone || null,
      source_snippet: context || null,
      word_count: computedWordCount,
      status: 'draft',
    }

    // Include AI metadata fields if provided
    if (aiMetadata) {
      if (aiMetadata.prompt_tokens != null) insertPayload.prompt_tokens = aiMetadata.prompt_tokens
      if (aiMetadata.completion_tokens != null) insertPayload.completion_tokens = aiMetadata.completion_tokens
      if (aiMetadata.total_tokens != null) insertPayload.total_tokens = aiMetadata.total_tokens
      if (aiMetadata.model) insertPayload.model = aiMetadata.model
      if (aiMetadata.estimated_cost != null) insertPayload.estimated_cost = aiMetadata.estimated_cost
      if (aiMetadata.prompt_snapshot) insertPayload.prompt_snapshot = aiMetadata.prompt_snapshot as Database['public']['Tables']['generated_posts']['Insert']['prompt_snapshot']
    }
    if (conversationId) insertPayload.conversation_id = conversationId

    const { data, error } = await supabase
      .from('generated_posts')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) {
      console.error('Failed to auto-save draft:', error)
      return NextResponse.json(
        { error: 'Failed to save draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    })
  } catch (error) {
    console.error('Auto-save draft error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
