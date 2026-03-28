/**
 * LinkedIn OAuth Callback Route Handler
 * @description Handles LinkedIn OAuth callback and token exchange
 * @module app/api/linkedin/callback
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  exchangeCodeForTokens,
  getLinkedInUserInfoFromTokens,
  calculateExpiresAt,
  getLinkedInScopes,
} from '@/lib/linkedin'
import { encrypt } from '@/lib/crypto'

/**
 * Creates admin client to bypass RLS for token storage
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('[LinkedIn Callback] Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createAdminSupabase(url, serviceKey)
}

/**
 * Cookie name for storing OAuth state
 */
const STATE_COOKIE_NAME = 'linkedin_oauth_state'

/**
 * Cookie name for storing redirect URL
 */
const REDIRECT_COOKIE_NAME = 'linkedin_oauth_redirect'

/**
 * Handles OAuth callback from LinkedIn
 * @param request - Incoming request with auth code and state
 * @returns Redirect to success or error page
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const cookieStore = await cookies()

  // Get redirect URL from cookie (read early so it's available for error handling)
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value
  const redirectTo = cookieStore.get(REDIRECT_COOKIE_NAME)?.value || '/dashboard/settings'

  // Handle OAuth errors from LinkedIn
  if (error) {
    console.error('LinkedIn OAuth error:', error, errorDescription)
    cookieStore.delete(STATE_COOKIE_NAME)
    cookieStore.delete(REDIRECT_COOKIE_NAME)
    return NextResponse.redirect(
      `${origin}${redirectTo}?linkedin_error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // Verify state parameter for CSRF protection

  if (!state || !storedState || state !== storedState) {
    console.error('LinkedIn OAuth state mismatch')
    return NextResponse.redirect(
      `${origin}${redirectTo}?linkedin_error=${encodeURIComponent('Invalid state parameter')}`
    )
  }

  // Clear the cookies
  cookieStore.delete(STATE_COOKIE_NAME)
  cookieStore.delete(REDIRECT_COOKIE_NAME)

  if (!code || typeof code !== 'string' || code.length > 2000) {
    console.error('LinkedIn OAuth missing or invalid code')
    return NextResponse.redirect(
      `${origin}${redirectTo}?linkedin_error=${encodeURIComponent('Missing or invalid authorization code')}`
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get user info from ID token (preferred) or userinfo endpoint (fallback)
    // The 'sub' field contains the LinkedIn member ID
    const userInfo = await getLinkedInUserInfoFromTokens(tokens.access_token, tokens.id_token)
    const linkedInUrn = `urn:li:person:${userInfo.sub}`

    // Get current user from Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('User not authenticated:', authError)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Please log in first')}`
      )
    }

    // Calculate token expiration
    const expiresAt = calculateExpiresAt(tokens.expires_in)

    // Encrypt tokens before storing in database
    const encryptedAccessToken = encrypt(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null

    // Store tokens in database using admin client to bypass RLS
    // (new users may not have INSERT permission on linkedin_tokens yet)
    const adminClient = getAdminClient()
    const { error: upsertError } = await adminClient
      .from('linkedin_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: expiresAt,
          linkedin_urn: linkedInUrn,
          scopes: getLinkedInScopes(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (upsertError) {
      console.error('Failed to store LinkedIn tokens:', upsertError)
      return NextResponse.redirect(
        `${origin}${redirectTo}?linkedin_error=${encodeURIComponent('Failed to save connection')}`
      )
    }

    // Update user's linkedin_profile with fresh data
    const linkedInFirstName = userInfo.given_name || userInfo.name?.split(' ')[0] || null
    const linkedInLastName = userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || null
    const linkedInPictureUrl = userInfo.picture || null

    // Try to save to linkedin_profiles table
    const { error: profileError } = await supabase
      .from('linkedin_profiles')
      .upsert(
        {
          user_id: user.id,
          linkedin_id: userInfo.sub,
          first_name: linkedInFirstName,
          last_name: linkedInLastName,
          profile_picture_url: linkedInPictureUrl,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (profileError) {
      // Log but don't fail - profile update is not critical
      console.error('Failed to update LinkedIn profile:', profileError)
    }

    // Also update the main profiles table with LinkedIn avatar for easier access
    const { error: mainProfileError } = await supabase
      .from('profiles')
      .update({
        linkedin_avatar_url: linkedInPictureUrl,
        linkedin_connected_at: new Date().toISOString(),
        // Only update name if not already set
        ...(linkedInFirstName && linkedInLastName ? {
          full_name: `${linkedInFirstName} ${linkedInLastName}`.trim() || undefined,
        } : {}),
      })
      .eq('id', user.id)

    if (mainProfileError) {
      console.error('Failed to update main profile with LinkedIn data:', mainProfileError)
    }

    // Redirect back to original page with success message
    return NextResponse.redirect(
      `${origin}${redirectTo}?linkedin_connected=true`
    )

  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      `${origin}${redirectTo}?linkedin_error=${encodeURIComponent(errorMessage)}`
    )
  }
}
