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
  GRADIENT_SUCCESS,
  content,
  card,
  buttons,
  steps,
  divider,
  footer,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

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
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_SUCCESS)}>
            <Img src={LOGO_URL} width="48" height="48" alt="ChainLinked" style={headerLogo} />
            <Text style={headerHeading}>Welcome to ChainLinked!</Text>
            <Text style={headerSubtext}>
              Your LinkedIn content platform is ready
            </Text>
          </Section>

          {/* Welcome message */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{displayName}</strong>,
            </Text>

            <Text style={content.paragraph}>
              Thanks for joining ChainLinked — your all-in-one platform for
              creating, scheduling, and analyzing LinkedIn content. We are
              excited to have you on board!
            </Text>

            <Section style={card.success}>
              <Text style={card.title}>Your account is ready</Text>
              <Text style={card.description}>
                No verification needed — you can dive right in and start
                creating content.
              </Text>
            </Section>
          </Section>

          {/* Getting started steps */}
          <Section style={steps.section}>
            <Text style={steps.title}>Get started in 3 steps</Text>

            <Section style={steps.item}>
              <Text style={steps.number}>1</Text>
              <div style={steps.content}>
                <Text style={steps.itemTitle}>Complete Onboarding</Text>
                <Text style={steps.itemDescription}>
                  Set up your brand kit, connect your LinkedIn profile, and
                  configure your preferences.
                </Text>
              </div>
            </Section>

            <Section style={steps.item}>
              <Text style={steps.number}>2</Text>
              <div style={steps.content}>
                <Text style={steps.itemTitle}>Create Your First Post</Text>
                <Text style={steps.itemDescription}>
                  Use our AI-powered composer to draft engaging LinkedIn content
                  in seconds.
                </Text>
              </div>
            </Section>

            <Section style={steps.item}>
              <Text style={steps.number}>3</Text>
              <div style={steps.content}>
                <Text style={steps.itemTitle}>Invite Your Team</Text>
                <Text style={steps.itemDescription}>
                  Collaborate with teammates on content strategy and track
                  performance together.
                </Text>
              </div>
            </Section>
          </Section>

          {/* CTA Button */}
          <Section style={buttons.section}>
            <Button style={buttons.primary} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Section style={{ padding: '16px 0' }} />

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
export default WelcomeEmail
