/**
 * Password Reset Email Template
 * @description React Email template for password reset requests
 * @module components/emails/password-reset
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
  GRADIENT_WARNING,
  content,
  buttons,
  linkBox,
  card,
  divider,
  footer,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

/**
 * Props for the PasswordResetEmail component
 */
export interface PasswordResetEmailProps {
  /** User's email address */
  email: string
  /** Full password reset link */
  resetLink: string
  /** Expiration time in hours */
  expiresInHours?: number
}

/**
 * Password Reset Email Component
 * @param props - Email template props
 * @returns Email template JSX
 */
export function PasswordResetEmail({
  email,
  resetLink,
  expiresInHours = 1,
}: PasswordResetEmailProps) {
  const previewText = 'Reset your ChainLinked password'
  const displayName = email.split('@')[0]

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_WARNING)}>
            <Img src={LOGO_URL} width="48" height="48" alt="ChainLinked" style={headerLogo} />
            <Text style={headerHeading}>Reset your password</Text>
            <Text style={headerSubtext}>
              Follow the link below to set a new password
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{displayName}</strong>,
            </Text>

            <Text style={content.paragraph}>
              We received a request to reset your password for your ChainLinked
              account. Click the button below to set a new password.
            </Text>

            <Section style={buttons.section}>
              <Button style={buttons.primary} href={resetLink}>
                Reset Password
              </Button>
            </Section>

            <Section style={card.warning}>
              <Text style={card.title}>
                Link expires in {expiresInHours} hour
                {expiresInHours > 1 ? 's' : ''}
              </Text>
              <Text style={card.description}>
                For security, this reset link can only be used once and will
                expire shortly.
              </Text>
            </Section>

            <Section style={linkBox.container}>
              <Text style={linkBox.label}>Or copy and paste this link</Text>
              <Text style={linkBox.url}>{resetLink}</Text>
            </Section>

            <Text style={content.paragraphSmall}>
              If you did not request a password reset, you can safely ignore
              this email. Your password will remain unchanged.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer.section}>
            <Text style={footer.text}>
              This email was sent to {email} because a password reset was
              requested for your ChainLinked account.
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

export default PasswordResetEmail
