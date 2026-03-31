/**
 * @fileoverview OpenAI OAuth initiation API endpoint.
 * @route POST /api/auth/openai
 * @description Initiates OpenAI authentication via either the device code OAuth flow
 * or manual API key validation. Requires authenticated Supabase user.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  requestDeviceCode,
  validateOpenAIKey,
} from '@/lib/auth/openai-oauth'

export const dynamic = 'force-dynamic'

/**
 * Initiate OpenAI authentication.
 *
 * @param request - The incoming request.
 *   Request body (JSON) - One of:
 *   - `{ mode: "device-code" }` - Starts the OAuth device code flow.
 *   - `{ apiKey: "sk-..." }` - Validates and stores a manual API key.
 * @returns JSON response with flow data or error.
 */
export async function POST(request: Request) {
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

    const body = await request.json()

    // -----------------------------------------------------------------------
    // Device Code Flow
    // -----------------------------------------------------------------------
    if (body.mode === 'device-code') {
      const deviceCode = await requestDeviceCode()

      // Upsert device session (one per user)
      const { error: sessionError } = await supabase
        .from('openai_device_sessions')
        .upsert(
          {
            user_id: user.id,
            device_auth_id: deviceCode.deviceAuthId,
            user_code: deviceCode.userCode,
            verification_url: deviceCode.verificationUrl,
            expires_at: new Date(
              Date.now() + deviceCode.expiresIn * 1000
            ).toISOString(),
            poll_interval: deviceCode.interval,
            status: 'pending',
          },
          { onConflict: 'user_id' }
        )

      if (sessionError) {
        console.error('[auth/openai] Session upsert error:', sessionError)
        return NextResponse.json(
          { error: 'Failed to store device session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        userCode: deviceCode.userCode,
        verificationUrl: deviceCode.verificationUrl,
        expiresIn: deviceCode.expiresIn,
        interval: deviceCode.interval,
      })
    }

    // -----------------------------------------------------------------------
    // Manual API Key
    // -----------------------------------------------------------------------
    if (body.apiKey) {
      const validation = await validateOpenAIKey(body.apiKey)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Invalid API key' },
          { status: 400 }
        )
      }

      // Upsert connection as manual method
      const { error: upsertError } = await supabase
        .from('openai_connections')
        .upsert(
          {
            user_id: user.id,
            auth_method: 'manual',
            api_key: body.apiKey,
            access_token: null,
            refresh_token: null,
            id_token: null,
            token_expires_at: null,
            email: null,
            account_id: null,
            plan_type: null,
            is_active: true,
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        console.error('[auth/openai] Connection upsert error:', upsertError)
        return NextResponse.json(
          { error: 'Failed to store API key' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, method: 'manual' })
    }

    return NextResponse.json(
      {
        error:
          'Invalid request. Provide { mode: "device-code" } or { apiKey: "sk-..." }',
      },
      { status: 400 }
    )
  } catch (err) {
    console.error('[auth/openai] Error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
