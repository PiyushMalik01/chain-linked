/**
 * Bulk Delete Drafts API
 * @description Soft-deletes multiple drafts from the generated_posts table
 * @module app/api/drafts/bulk-delete/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Request body for bulk delete
 */
interface BulkDeleteRequest {
  /** Draft items to delete, each with id and source table */
  items: Array<{
    id: string
    table: 'generated_posts' | 'scheduled_posts'
  }>
}

/**
 * POST /api/drafts/bulk-delete
 * Soft-deletes multiple drafts by setting status to archived
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BulkDeleteRequest = await request.json()

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    if (body.items.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per request' }, { status: 400 })
    }

    const ids = body.items.map((item) => item.id)

    // Delete from generated_posts
    const { error: genError, count: genCount } = await supabase
      .from('generated_posts')
      .update({ status: 'archived' })
      .in('id', ids)
      .eq('user_id', user.id)

    // Also delete from scheduled_posts (for scheduled drafts)
    const { error: schedError, count: schedCount } = await supabase
      .from('scheduled_posts')
      .update({ status: 'failed' })
      .in('id', ids)
      .eq('user_id', user.id)

    if (genError && schedError) {
      console.error('Bulk delete drafts error:', genError, schedError)
      return NextResponse.json({
        success: false,
        deleted: 0,
        errors: ids.length,
      }, { status: 500 })
    }

    const totalDeleted = (genCount ?? 0) + (schedCount ?? 0)

    return NextResponse.json({
      success: true,
      deleted: totalDeleted || ids.length,
      errors: 0,
    })
  } catch (error) {
    console.error('Bulk delete drafts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
