/**
 * Google Token Exchange API Route
 * @description Accepts a Google access token (from Chrome extension's chrome.identity.getAuthToken),
 * validates it with Google, finds or creates the Supabase user, and returns a Supabase session.
 * This enables the Chrome extension to sign in with Google without needing a Web Application OAuth client.
 * @module app/api/auth/google-token
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** CORS headers for Chrome extension requests */
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * Helper to return JSON with CORS headers
 */
function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return jsonResponse(null)
}

/**
 * Creates a Supabase admin client with the service role key
 * @returns Supabase client with admin privileges
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * POST handler for Google token exchange
 * Validates a Google access token, finds/creates the user in Supabase,
 * generates a magic link token, and verifies it to produce a session.
 *
 * @param request - Request with google_access_token in body
 * @returns JSON response with Supabase session or error
 */
export async function POST(request: NextRequest) {
  try {
    const { google_access_token } = await request.json()

    if (!google_access_token) {
      return jsonResponse({ error: 'Google access token is required' }, 400)
    }

    // Validate the Google access token and get user info
    const googleResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${google_access_token}` },
    })

    if (!googleResponse.ok) {
      return jsonResponse({ error: 'Invalid or expired Google token' }, 401)
    }

    const googleUser = await googleResponse.json()
    const { email, name, picture, id: googleId } = googleUser

    if (!email) {
      return jsonResponse({ error: 'Could not retrieve email from Google' }, 400)
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Try to create the user first; if they already exist, handle gracefully
    let userId: string

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        avatar_url: picture,
        google_id: googleId,
        provider: 'google',
      },
    })

    if (createError) {
      // User already exists — use generateLink to resolve user by email (O(1), no listUsers scan)
      if (createError.message?.toLowerCase().includes('already') || createError.status === 422) {
        const { data: linkCheck } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
        })

        if (!linkCheck?.user) {
          console.error('[google-token] Could not find existing user for email:', email)
          return jsonResponse({ error: 'Failed to find existing user account' }, 500)
        }

        userId = linkCheck.user.id

        // Update user metadata with latest Google info
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...linkCheck.user.user_metadata,
            full_name: linkCheck.user.user_metadata?.full_name || name,
            avatar_url: linkCheck.user.user_metadata?.avatar_url || picture,
            google_id: googleId,
          },
        })
      } else {
        console.error('[google-token] User creation error:', createError)
        return jsonResponse({ error: 'Failed to create user account' }, 500)
      }
    } else {
      if (!newUser.user) {
        console.error('[google-token] User creation returned no user')
        return jsonResponse({ error: 'Failed to create user account' }, 500)
      }

      userId = newUser.user.id

      // Create profile record for new user
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email,
        full_name: name || email.split('@')[0],
        avatar_url: picture || null,
      }, { onConflict: 'id' })
    }

    // Generate a magic link to create a session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData) {
      console.error('[google-token] Generate link error:', linkError)
      return jsonResponse({ error: 'Failed to generate session' }, 500)
    }

    // Extract the token hash and verify it to get a session
    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) {
      console.error('[google-token] No hashed_token in link data')
      return jsonResponse({ error: 'Failed to generate session token' }, 500)
    }

    // Verify the OTP to get a full session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        token_hash: tokenHash,
      }),
    })

    if (!verifyResponse.ok) {
      const verifyError = await verifyResponse.json().catch(() => ({}))
      console.error('[google-token] Verify error:', verifyError)
      return jsonResponse({ error: 'Failed to create session' }, 500)
    }

    const session = await verifyResponse.json()

    if (!session?.access_token) {
      console.error('[google-token] No access_token in verify response')
      return jsonResponse({ error: 'Failed to establish session' }, 500)
    }

    return jsonResponse({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: session.user,
      },
    })
  } catch (err) {
    console.error('[google-token] Exception:', err)
    return jsonResponse({ error: 'An unexpected error occurred' }, 500)
  }
}
