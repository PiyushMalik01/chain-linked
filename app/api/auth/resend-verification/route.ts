/**
 * Resend Verification Email API Route
 * @description Generates a verification link via Supabase admin and sends
 * the email via Resend with a custom branded template.
 * @module app/api/auth/resend-verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import { EmailVerificationEmail } from '@/components/emails/email-verification'

/**
 * Create a Supabase admin client that can generate auth links
 * @returns Admin Supabase client
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * POST handler for resending verification email
 * Uses Supabase Admin API to generate the link, then Resend to send the email
 * @param request - Request with email in body
 * @returns JSON response with success status
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chainlinked.ai'

    // Generate a magic link (acts as email verification) via Supabase admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback`,
      },
    })

    if (error) {
      console.error('Generate verification link error:', error)

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a few minutes before trying again.' },
          { status: 429 }
        )
      }

      if (error.message.includes('not found') || error.message.includes('Invalid')) {
        // Always return success to prevent user enumeration
        return NextResponse.json({
          success: true,
          message: 'If an account exists with this email, a verification link has been sent.',
        })
      }

      return NextResponse.json(
        { error: 'Failed to resend verification email. Please try again later.' },
        { status: 500 }
      )
    }

    if (!data?.properties?.action_link) {
      return NextResponse.json(
        { error: 'Failed to generate verification link.' },
        { status: 500 }
      )
    }

    // Send the verification email via Resend
    const userName = email.split('@')[0]
    const emailResult = await sendEmail({
      to: email,
      subject: 'Verify your ChainLinked email',
      react: EmailVerificationEmail({
        userName,
        email,
        verificationLink: data.properties.action_link,
        expiresInHours: 24,
      }),
    })

    if (!emailResult.success) {
      console.error('Verification email send error:', emailResult.error)
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    })
  } catch (err) {
    console.error('Resend verification exception:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
