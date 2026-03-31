/**
 * @fileoverview OpenAI connection status API endpoint.
 * @route GET /api/auth/openai/status
 * @description Returns the current OpenAI connection status for the authenticated user.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Check the current OpenAI connection status.
 *
 * @returns JSON with connection details:
 *   - `{ connected: false }` if no active connection.
 *   - `{ connected: true, method, email, planType }` if connected.
 */
export async function GET() {
  try {
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

    const { data: connection } = await supabase
      .from('openai_connections')
      .select('auth_method, email, plan_type, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      method: connection.auth_method,
      email: connection.email,
      planType: connection.plan_type,
    })
  } catch (err) {
    console.error('[auth/openai/status] Error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
