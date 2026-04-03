/**
 * Single Draft API Route
 * @description Fetches a single draft by ID for restoring carousel data
 * @module app/api/drafts/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/drafts/:id
 * Fetches a single draft from the generated_posts table.
 * Returns the draft data including source_snippet for carousel restoration.
 * @param request - The incoming request
 * @param context - Route context containing the draft ID
 * @returns The draft data or an error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

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

    const { data, error } = await supabase
      .from('generated_posts')
      .select('id, content, post_type, source, source_snippet, draft_state, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch draft error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
