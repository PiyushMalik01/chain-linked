/**
 * Welcome Email Template
 * @description React Email template sent to new users after signup
 * @module components/emails/welcome
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

/**
 * Props for the WelcomeEmail component
 */
export interface WelcomeEmailProps {
  /** User's name */
  userName: string
  /** User's email address */
  email: string
  /** Dashboard URL */
  dashboardUrl: string
}

/**
 * Welcome Email Component
 *
 * Sent to new users after signup. Provides onboarding steps
 * to get started with ChainLinked.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <WelcomeEmail
 *   userName="John"
 *   email="john@example.com"
 *   dashboardUrl="https://app.chainlinked.io/dashboard"
 * />
 */
export function WelcomeEmail({
  userName,
  email,
  dashboardUrl,
}: WelcomeEmailProps) {
  const displayName = userName || email.split('@')[0]
  const previewText = `Welcome to ChainLinked, ${displayName}! Let's get you set up.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={logoSection}>
            <div style={logoPlaceholder}>
              <Text style={logoPlaceholderText}>CL</Text>
            </div>
          </Section>

          {/* Welcome message */}
          <Section style={contentSection}>
            <Heading style={heading}>
              Welcome to ChainLinked!
            </Heading>

            <Text style={paragraph}>
              Hi <strong>{displayName}</strong>,
            </Text>

            <Text style={paragraph}>
              Thanks for joining ChainLinked — your all-in-one platform for creating,
              scheduling, and analyzing LinkedIn content. We are excited to have you on board!
            </Text>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Your account is ready</Text>
              <Text style={highlightDescription}>
                No verification needed — you can dive right in and start creating content.
              </Text>
            </Section>
          </Section>

          {/* Getting started steps */}
          <Section style={stepsSection}>
            <Text style={stepsTitle}>Get started in 3 steps</Text>

            <Section style={stepItem}>
              <Text style={stepNumber}>1</Text>
              <Section style={stepContent}>
                <Text style={stepItemTitle}>Complete Onboarding</Text>
                <Text style={stepItemDescription}>
                  Set up your brand kit, connect your LinkedIn profile, and configure your preferences.
                </Text>
              </Section>
            </Section>

            <Section style={stepItem}>
              <Text style={stepNumber}>2</Text>
              <Section style={stepContent}>
                <Text style={stepItemTitle}>Create Your First Post</Text>
                <Text style={stepItemDescription}>
                  Use our AI-powered composer to draft engaging LinkedIn content in seconds.
                </Text>
              </Section>
            </Section>

            <Section style={stepItem}>
              <Text style={stepNumber}>3</Text>
              <Section style={stepContent}>
                <Text style={stepItemTitle}>Invite Your Team</Text>
                <Text style={stepItemDescription}>
                  Collaborate with teammates on content strategy and track performance together.
                </Text>
              </Section>
            </Section>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent to {email} because you signed up for ChainLinked.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://omrajpal.tech" style={link}>
                ChainLinked
              </Link>
              {' | '}
              <Link href="https://omrajpal.tech/privacy" style={link}>
                Privacy Policy
              </Link>
              {' | '}
              <Link href="https://omrajpal.tech/terms" style={link}>
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
export default WelcomeEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  maxWidth: '600px',
}

const logoSection = {
  padding: '32px 40px 0',
  textAlign: 'center' as const,
}

const logoPlaceholder = {
  width: '60px',
  height: '60px',
  borderRadius: '12px',
  backgroundColor: '#0077b5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
}

const logoPlaceholderText = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: 0,
  lineHeight: '60px',
  textAlign: 'center' as const,
}

const contentSection = {
  padding: '24px 40px',
}

const heading = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '16px 0 24px',
  textAlign: 'center' as const,
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const highlightBox = {
  backgroundColor: '#e8f5e9',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
  borderLeft: '4px solid #4caf50',
}

const highlightTitle = {
  color: '#2e7d32',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const highlightDescription = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: 0,
}

const stepsSection = {
  padding: '0 40px 24px',
}

const stepsTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
}

const stepItem = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '16px',
}

const stepNumber = {
  backgroundColor: '#0077b5',
  color: '#ffffff',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  fontSize: '12px',
  fontWeight: '600',
  textAlign: 'center' as const,
  lineHeight: '24px',
  marginRight: '12px',
  flexShrink: 0,
}

const stepContent = {
  flex: 1,
}

const stepItemTitle = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 2px',
}

const stepItemDescription = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.4',
  margin: 0,
}

const buttonSection = {
  textAlign: 'center' as const,
  padding: '0 40px 32px',
}

const button = {
  backgroundColor: '#0077b5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '0 40px 32px',
}

const footer = {
  padding: '0 40px',
}

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}

const link = {
  color: '#0077b5',
  textDecoration: 'underline',
}
