/**
 * LinkedIn Connection Status Route Handler
 * @description Returns the current LinkedIn connection status for the user,
 * including token validity, profile name, and reconnection requirements.
 * @module app/api/linkedin/status
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isTokenExpired, type LinkedInConnectionStatus } from '@/lib/linkedin'

/** Number of days before expiry to trigger a needsReconnect warning */
const RECONNECT_WARNING_DAYS = 7

/**
 * GET - Check LinkedIn connection status
 * @returns {LinkedInConnectionStatus} Connection status including expiry and profile information
 */
export async function GET() {
  const supabase = await createClient()

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Default disconnected status
  const disconnected: LinkedInConnectionStatus = {
    connected: false,
    expiresAt: null,
    profileName: null,
    needsReconnect: false,
  }

  try {
    // Check linkedin_tokens table for token data
    const { data: tokenData, error: tokenError } = await supabase
      .from('linkedin_tokens')
      .select('linkedin_urn, expires_at, updated_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      // Also check the profiles table as a fallback
      const { data: profileData } = await supabase
        .from('profiles')
        .select('linkedin_access_token, linkedin_token_expires_at, linkedin_connected_at')
        .eq('id', user.id)
        .single()

      if (profileData?.linkedin_access_token) {
        const expiresAt = profileData.linkedin_token_expires_at
        const expired = expiresAt ? isTokenExpired(expiresAt, 0) : false
        const nearExpiry = expiresAt
          ? isTokenExpired(expiresAt, RECONNECT_WARNING_DAYS * 24 * 60)
          : false

        return NextResponse.json({
          connected: !expired,
          expiresAt: expiresAt || null,
          profileName: null,
          needsReconnect: expired || nearExpiry,
        } satisfies LinkedInConnectionStatus)
      }

      // Check linkedin_profiles table as a third fallback (extension syncs here)
      const { data: linkedinProfile } = await supabase
        .from('linkedin_profiles')
        .select('first_name, last_name, profile_urn, updated_at')
        .eq('user_id', user.id)
        .single()

      if (linkedinProfile && (linkedinProfile.profile_urn || linkedinProfile.first_name)) {
        const parts = [linkedinProfile.first_name, linkedinProfile.last_name].filter(Boolean)
        const profileName = parts.length > 0 ? parts.join(' ') : null

        return NextResponse.json({
          connected: true,
          expiresAt: null,
          profileName,
          needsReconnect: false,
        } satisfies LinkedInConnectionStatus)
      }

      // Also check if linkedin_connected_at is set on profiles (OAuth connected but token expired/removed)
      if (profileData?.linkedin_connected_at) {
        return NextResponse.json({
          connected: true,
          expiresAt: null,
          profileName: null,
          needsReconnect: true,
        } satisfies LinkedInConnectionStatus)
      }

      return NextResponse.json(disconnected)
    }

    // Determine token validity
    const expired = isTokenExpired(tokenData.expires_at, 0)
    const nearExpiry = isTokenExpired(
      tokenData.expires_at,
      RECONNECT_WARNING_DAYS * 24 * 60
    )

    // Fetch profile name from linkedin_profiles table
    let profileName: string | null = null
    try {
      const { data: profileData } = await supabase
        .from('linkedin_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single()

      if (profileData) {
        const parts = [profileData.first_name, profileData.last_name].filter(Boolean)
        profileName = parts.length > 0 ? parts.join(' ') : null
      }
    } catch {
      // Profile lookup is non-critical
    }

    const status: LinkedInConnectionStatus = {
      connected: !expired,
      expiresAt: tokenData.expires_at || null,
      profileName,
      needsReconnect: expired || nearExpiry,
    }

    return NextResponse.json(status)
  } catch {
    // Table doesn't exist or other error
    return NextResponse.json(disconnected)
  }
}

/**
 * DELETE - Disconnect LinkedIn account
 * @returns Success status
 */
export async function DELETE() {
  const supabase = await createClient()

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Delete LinkedIn tokens - handle gracefully if table doesn't exist
  try {
    const { error: deleteError } = await supabase
      .from('linkedin_tokens')
      .delete()
      .eq('user_id', user.id)

    if (deleteError && deleteError.code !== 'PGRST205') {
      // Only error if it's not a "table doesn't exist" error
      console.error('Failed to delete LinkedIn tokens:', deleteError)
      return NextResponse.json(
        { error: 'Failed to disconnect LinkedIn' },
        { status: 500 }
      )
    }
  } catch {
    // Table doesn't exist, which is fine
  }

  return NextResponse.json({
    success: true,
    message: 'LinkedIn disconnected successfully',
  })
}
