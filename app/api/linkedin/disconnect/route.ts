/**
 * LinkedIn Disconnect Route Handler
 * @description Disconnects user's LinkedIn account by removing tokens
 * @module app/api/linkedin/disconnect
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revokeToken } from '@/lib/linkedin'
import { safeDecrypt } from '@/lib/crypto'

/**
 * POST - Disconnect LinkedIn account
 * Revokes tokens and removes them from database
 */
export async function POST() {
  const supabase = await createClient()

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get current tokens
    const { data: tokenData } = await supabase
      .from('linkedin_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    // Revoke token with LinkedIn (best effort)
    if (tokenData?.access_token) {
      try {
        await revokeToken(safeDecrypt(tokenData.access_token))
      } catch (error) {
        // Log but don't fail - token might already be invalid
        console.error('Failed to revoke LinkedIn token:', error)
      }
    }

    // Delete tokens from database
    const { error: deleteError } = await supabase
      .from('linkedin_tokens')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete LinkedIn tokens:', deleteError)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account disconnected',
    })

  } catch (error) {
    console.error('LinkedIn disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect LinkedIn' },
      { status: 500 }
    )
  }
}
