/**
 * Resend Email Client
 * @description Centralized email sending functionality using Resend
 * @module lib/email/resend
 */

import type React from 'react'
import { Resend } from 'resend'

/**
 * Default email configuration
 */
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'team@omrajpal.tech'
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'ChainLinked'

/**
 * Constructs the "from" email address
 * @returns Formatted from address
 */
export function getFromAddress(): string {
  return `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`
}

/**
 * Email sending options
 */
export interface SendEmailOptions {
  /** Recipient email address(es) */
  to: string | string[]
  /** Email subject line */
  subject: string
  /** React component for email body (React.ReactNode per Resend v6) */
  react?: React.ReactNode
  /** HTML content (alternative to react) */
  html?: string
  /** Plain text content (fallback) */
  text?: string
  /** Reply-to address (optional) */
  replyTo?: string
  /** CC recipients (optional) */
  cc?: string[]
  /** BCC recipients (optional) */
  bcc?: string[]
}

/**
 * Email send result
 */
export interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: boolean
  /** Message ID from Resend (if successful) */
  messageId?: string
  /** Error message (if failed) */
  error?: string
}

/**
 * Send an email using Resend
 * @param options - Email sending options
 * @returns Result of the send operation
 * @example
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome to ChainLinked',
 *   react: WelcomeEmail({ name: 'John' }),
 * })
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, react, html, text, replyTo, cc, bcc } = options

  if (!react && !html && !text) {
    return {
      success: false,
      error: 'Email must have react, html, or text content',
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY is not set')
    return { success: false, error: 'RESEND_API_KEY is not configured' }
  }

  const fromAddr = getFromAddress()
  const recipients = Array.isArray(to) ? to : [to]

  console.log(`[Email] Sending to: ${recipients.join(', ')} | Subject: ${subject}`)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const base = {
      from: fromAddr,
      to: recipients,
      subject,
      ...(replyTo ? { replyTo } : {}),
      ...(cc?.length ? { cc } : {}),
      ...(bcc?.length ? { bcc } : {}),
    }

    // Resend v6 uses a discriminated union — pass exactly one content type
    const { data, error } = react
      ? await resend.emails.send({ ...base, react })
      : html
        ? await resend.emails.send({ ...base, html })
        : await resend.emails.send({ ...base, text: text! })

    if (error) {
      console.error('[Email] Resend API error:', JSON.stringify(error, null, 2))
      return { success: false, error: error.message }
    }

    console.log(`[Email] Sent successfully! Message ID: ${data?.id}`)
    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('[Email] Exception during send:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending email',
    }
  }
}

/**
 * Send multiple emails in batch
 * @param emails - Array of email options
 * @returns Array of results for each email
 */
export async function sendBatchEmails(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
  return Promise.all(emails.map(sendEmail))
}
