/**
 * @fileoverview OpenAI disconnect API endpoint.
 * @route POST /api/auth/openai/disconnect
 * @description Removes the OpenAI connection and any active device sessions
 * for the authenticated user.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Disconnect the user's OpenAI account.
 *
 * Deletes both the connection record and any active device sessions.
 *
 * @returns JSON with `{ success: true }` or error.
 */
export async function POST() {
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

    // Delete connection and device sessions in parallel
    const [connectionResult, sessionResult] = await Promise.all([
      supabase
        .from('openai_connections')
        .delete()
        .eq('user_id', user.id),
      supabase
        .from('openai_device_sessions')
        .delete()
        .eq('user_id', user.id),
    ])

    if (connectionResult.error) {
      console.error(
        '[auth/openai/disconnect] Connection delete error:',
        connectionResult.error
      )
    }
    if (sessionResult.error) {
      console.error(
        '[auth/openai/disconnect] Session delete error:',
        sessionResult.error
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/openai/disconnect] Error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
