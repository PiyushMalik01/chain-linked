/**
 * @fileoverview OpenAI device code polling API endpoint.
 * @route POST /api/auth/openai/poll
 * @description Polls the active device code session. When the user has authorized
 * on OpenAI's side, exchanges the code for tokens and stores credentials.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  pollDeviceToken,
  exchangeCodeForTokens,
  parseOpenAIAuthClaims,
} from '@/lib/auth/openai-oauth'

export const dynamic = 'force-dynamic'

/**
 * Poll the active OpenAI device code session for authorization status.
 *
 * @returns JSON with one of:
 *   - `{ status: "pending" }` - User has not yet authorized.
 *   - `{ status: "expired" }` - Device code session expired.
 *   - `{ status: "authorized", email, planType }` - Successfully authorized.
 *   - `{ error: string }` with status 404 if no active session, or 500 on error.
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

    // Find the active device session for this user
    const { data: session, error: fetchError } = await supabase
      .from('openai_device_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'No active device code session' },
        { status: 404 }
      )
    }

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('openai_device_sessions')
        .delete()
        .eq('user_id', user.id)

      return NextResponse.json({ status: 'expired' })
    }

    // Poll OpenAI
    const result = await pollDeviceToken(
      session.device_auth_id,
      session.user_code
    )

    if (result.status === 'pending') {
      return NextResponse.json({ status: 'pending' })
    }

    if (result.status === 'expired') {
      await supabase
        .from('openai_device_sessions')
        .delete()
        .eq('user_id', user.id)

      return NextResponse.json({ status: 'expired' })
    }

    // Authorized - exchange for tokens
    if (
      result.status === 'authorized' &&
      result.authorizationCode &&
      result.codeVerifier
    ) {
      const tokens = await exchangeCodeForTokens(
        result.authorizationCode,
        result.codeVerifier
      )

      // Parse JWT to get user info
      const claims = parseOpenAIAuthClaims(tokens.idToken)
      const email = (claims.email as string) || null
      const accountId = (claims.chatgpt_account_id as string) || null
      const planType = (claims.chatgpt_plan_type as string) || null

      const tokenExpiresAt = new Date(
        Date.now() + tokens.expiresIn * 1000
      ).toISOString()

      // Upsert connection with OAuth tokens
      const { error: upsertError } = await supabase
        .from('openai_connections')
        .upsert(
          {
            user_id: user.id,
            auth_method: 'oauth-device',
            api_key: tokens.accessToken,
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            id_token: tokens.idToken,
            token_expires_at: tokenExpiresAt,
            email,
            account_id: accountId,
            plan_type: planType,
            is_active: true,
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        console.error(
          '[auth/openai/poll] Connection upsert error:',
          upsertError
        )
        return NextResponse.json(
          { error: 'Failed to store OAuth tokens' },
          { status: 500 }
        )
      }

      // Clean up device session
      await supabase
        .from('openai_device_sessions')
        .delete()
        .eq('user_id', user.id)

      return NextResponse.json({
        status: 'authorized',
        email,
        planType,
      })
    }

    return NextResponse.json({ status: 'pending' })
  } catch (err) {
    console.error('[auth/openai/poll] Error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
