/**
 * Templates API Route
 * @description Handles post template CRUD operations
 * @module app/api/templates
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET templates
 * @returns User's templates and public templates
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const includePublic = searchParams.get('public') !== 'false'

  let query = supabase
    .from('templates')
    .select('*')
    .or(`user_id.eq.${user.id}${includePublic ? ',is_public.eq.true' : ''}`)
    .order('usage_count', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data: templates, error } = await query

  if (error) {
    console.error('Templates fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }

  return NextResponse.json({ templates })
}

/**
 * POST create new template
 * @param request - Template data
 * @returns Created template
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, content, category, tags, is_public } = body

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 })
    }

    const { data: template, error: insertError } = await supabase
      .from('templates')
      .insert({
        user_id: user.id,
        name,
        content,
        category: category || null,
        tags: tags || [],
        is_public: is_public || false,
        usage_count: 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * PATCH update template
 * @param request - Template updates
 * @returns Updated template
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name, content, category, tags, is_public, increment_usage } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (content !== undefined) updates.content = content
    if (category !== undefined) updates.category = category
    if (tags !== undefined) updates.tags = tags
    if (is_public !== undefined) updates.is_public = is_public

    let query = supabase.from('templates')

    if (increment_usage) {
      // Fetch the template to check ownership or public status
      const { data: template } = await supabase
        .from('templates')
        .select('is_public, user_id, usage_count')
        .eq('id', id)
        .single()

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      // Only allow usage increment if template is public or owned by user
      if (!template.is_public && template.user_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to use this template' }, { status: 403 })
      }

      const newUsageCount = (template.usage_count || 0) + 1

      // Only update usage_count when incrementing — ignore any other fields in the request
      const updateQuery = template.is_public && template.user_id !== user.id
        ? supabase.from('templates').update({ usage_count: newUsageCount }).eq('id', id)
        : supabase.from('templates').update({ usage_count: newUsageCount }).eq('id', id).eq('user_id', user.id)

      const { data: updatedTemplate, error: updateError } = await updateQuery.select().single()

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
      }

      return NextResponse.json({ template: updatedTemplate })
    }

    const { data: updatedTemplate, error: updateError } = await query
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Only owner can update
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template: updatedTemplate })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE template
 * @param request - Template ID to delete
 * @returns Success message
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const templateId = searchParams.get('id')

  if (!templateId) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Delete error:', deleteError)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
