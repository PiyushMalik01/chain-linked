/**
 * Swipe Suggestion Generation API Route
 * @description POST endpoint to trigger AI suggestion generation for swipe feature
 * @module app/api/swipe/generate/route
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

/** Maximum number of active suggestions a user can have */
const MAX_ACTIVE_SUGGESTIONS = 10

/**
 * POST /api/swipe/generate
 * Triggers generation of new AI suggestions for the swipe feature
 * @returns JSON response with runId and status
 */
/**
 * DELETE /api/swipe/generate
 * Cancels an active suggestion generation run
 * @returns JSON response with success status and runId
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: activeRun, error: findError } = await supabase
      .from('suggestion_generation_runs')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'generating'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (findError || !activeRun) {
      return NextResponse.json(
        { error: 'No active generation to cancel' },
        { status: 404 }
      )
    }

    await supabase
      .from('suggestion_generation_runs')
      .update({ status: 'cancelled', error_message: 'Cancelled by user' })
      .eq('id', activeRun.id)

    return NextResponse.json({ success: true, runId: activeRun.id })
  } catch (error) {
    console.error('[API] Cancel generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const supabase = await createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has completed company onboarding via company_context table
    const { data: companyCtx, error: ctxError } = await supabase
      .from('company_context')
      .select('id, company_name, status, company_summary, value_proposition, products_and_services, target_audience')
      .eq('user_id', user.id)
      .single()

    if (ctxError && ctxError.code !== 'PGRST116') {
      console.error('[API] Error fetching company context:', ctxError)
      return NextResponse.json(
        { error: 'Failed to verify onboarding status' },
        { status: 500 }
      )
    }

    // Check if company context exists with actual data
    const hasCompanyData = companyCtx?.company_name && (
      companyCtx?.company_summary ||
      companyCtx?.value_proposition ||
      companyCtx?.products_and_services ||
      companyCtx?.target_audience
    )

    if (!companyCtx || !hasCompanyData) {
      return NextResponse.json(
        {
          error: 'Company context required',
          message: 'Please complete company onboarding with your company details before generating suggestions. Go to Settings > Company to add your company information.',
          redirectTo: '/onboarding/company-context'
        },
        { status: 400 }
      )
    }

    // Check active suggestion count (reject if >= 10)
    const { count: activeCount, error: countError } = await supabase
      .from('generated_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (countError) {
      console.error('[API] Error counting active suggestions:', countError)
      return NextResponse.json(
        { error: 'Failed to check suggestion count' },
        { status: 500 }
      )
    }

    if ((activeCount ?? 0) >= MAX_ACTIVE_SUGGESTIONS) {
      return NextResponse.json(
        {
          error: 'Maximum suggestions reached',
          message: `You already have ${activeCount} active suggestions. Please review them before generating more.`,
          activeCount
        },
        { status: 400 }
      )
    }

    // Check for existing pending/generating run (reject if exists)
    const { data: existingRun, error: runError } = await supabase
      .from('suggestion_generation_runs')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'generating'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (runError && runError.code !== 'PGRST116') {
      console.error('[API] Error checking existing runs:', runError)
      return NextResponse.json(
        { error: 'Failed to check generation status' },
        { status: 500 }
      )
    }

    if (existingRun) {
      return NextResponse.json(
        {
          error: 'Generation in progress',
          message: 'A suggestion generation is already in progress. Please wait for it to complete.',
          runId: existingRun.id,
          status: existingRun.status
        },
        { status: 409 }
      )
    }

    // Calculate how many suggestions to generate (up to MAX_ACTIVE_SUGGESTIONS)
    const suggestionsToGenerate = MAX_ACTIVE_SUGGESTIONS - (activeCount ?? 0)

    // Create generation_run record with status 'pending'
    const { data: newRun, error: insertError } = await supabase
      .from('suggestion_generation_runs')
      .insert({
        user_id: user.id,
        status: 'pending',
        suggestions_requested: suggestionsToGenerate,
        suggestions_generated: 0,
        company_context_id: null // Using profile data instead
      })
      .select()
      .single()

    if (insertError || !newRun) {
      console.error('[API] Error creating generation run:', insertError)
      return NextResponse.json(
        { error: 'Failed to start generation' },
        { status: 500 }
      )
    }

    // Trigger Inngest event 'swipe/generate-suggestions'
    try {
      await inngest.send({
        name: 'swipe/generate-suggestions',
        data: {
          userId: user.id,
          runId: newRun.id,
          suggestionsToGenerate,
        }
      })
    } catch (inngestError) {
      console.error('[API] Error triggering Inngest event:', inngestError)

      // Mark run as failed if we couldn't trigger the event
      await supabase
        .from('suggestion_generation_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to trigger generation workflow'
        })
        .eq('id', newRun.id)

      return NextResponse.json(
        { error: 'Failed to start generation workflow' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      runId: newRun.id,
      status: 'pending',
      message: `Generating ${suggestionsToGenerate} suggestions...`,
      suggestionsRequested: suggestionsToGenerate
    })
  } catch (error) {
    console.error('[API] Swipe generate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
