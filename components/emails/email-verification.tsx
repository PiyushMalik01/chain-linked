/**
 * Email Verification Email Template
 * @description React Email template for account verification
 * @module components/emails/email-verification
 */

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import {
  layout,
  headerStyle,
  headerLogo,
  headerHeading,
  headerSubtext,
  GRADIENT_BRAND,
  content,
  buttons,
  linkBox,
  divider,
  footer,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

/**
 * Props for the EmailVerificationEmail component
 */
export interface EmailVerificationEmailProps {
  /** User's name (optional) */
  userName?: string
  /** User's email address */
  email: string
  /** Full verification link */
  verificationLink: string
  /** Expiration time in hours */
  expiresInHours?: number
}

/**
 * Email Verification Email Component
 *
 * Email template for verifying user email addresses.
 * Uses React Email components for cross-client compatibility.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <EmailVerificationEmail
 *   userName="John"
 *   email="john@example.com"
 *   verificationLink="https://app.chainlinked.io/api/auth/callback?code=abc123"
 *   expiresInHours={24}
 * />
 */
export function EmailVerificationEmail({
  userName,
  email,
  verificationLink,
  expiresInHours = 24,
}: EmailVerificationEmailProps) {
  const previewText = 'Verify your email address for ChainLinked'
  const displayName = userName || email.split('@')[0]

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_BRAND)}>
            <Img src={LOGO_URL} width="48" height="48" alt="ChainLinked" style={headerLogo} />
            <Text style={headerHeading}>Verify your email</Text>
            <Text style={headerSubtext}>One quick step to get started</Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{displayName}</strong>,
            </Text>

            <Text style={content.paragraph}>
              Thanks for signing up for ChainLinked! Please verify your email
              address by clicking the button below.
            </Text>

            <Section style={buttons.section}>
              <Button style={buttons.primary} href={verificationLink}>
                Verify Email Address
              </Button>
            </Section>

            <Text style={content.paragraphSmall}>
              This link will expire in <strong>{expiresInHours} hours</strong>.
            </Text>

            <Section style={linkBox.container}>
              <Text style={linkBox.label}>Or copy and paste this link</Text>
              <Text style={linkBox.url}>{verificationLink}</Text>
            </Section>

            <Text style={content.paragraphSmall}>
              If you did not create an account with ChainLinked, you can safely
              ignore this email.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer.section}>
            <Text style={footer.text}>
              This email was sent to {email} because you signed up for
              ChainLinked.
            </Text>
            <Text style={footer.links}>
              <Link href={SITE_URL} style={footer.link}>
                ChainLinked
              </Link>
              {footer.separator}
              <Link href={`${SITE_URL}/privacy`} style={footer.link}>
                Privacy Policy
              </Link>
              {footer.separator}
              <Link href={`${SITE_URL}/terms`} style={footer.link}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/**
 * Default export for Resend compatibility
 */
export default EmailVerificationEmail
