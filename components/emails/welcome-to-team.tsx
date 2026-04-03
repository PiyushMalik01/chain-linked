/**
 * Welcome to Team Email Template
 * @description React Email template sent after accepting team invitation
 * @module components/emails/welcome-to-team
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
  GRADIENT_TEAM,
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
 * Props for the WelcomeToTeamEmail component
 */
export interface WelcomeToTeamEmailProps {
  /** Name of the new team member */
  memberName: string
  /** Email of the new team member (fallback) */
  memberEmail: string
  /** Name of the team */
  teamName: string
  /** Name of the company (optional) */
  companyName?: string
  /** Company logo URL (optional) */
  companyLogoUrl?: string
  /** Role assigned */
  role: 'admin' | 'member'
  /** Dashboard URL */
  dashboardUrl: string
}

/**
 * Welcome to Team Email Component
 *
 * Email template sent to users after they accept a team invitation.
 * Provides onboarding information and next steps.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <WelcomeToTeamEmail
 *   memberName="Jane Smith"
 *   memberEmail="jane@example.com"
 *   teamName="Marketing Team"
 *   companyName="Acme Inc"
 *   role="member"
 *   dashboardUrl="https://app.chainlinked.io/dashboard"
 * />
 */
export function WelcomeToTeamEmail({
  memberName,
  memberEmail,
  teamName,
  companyName,
  companyLogoUrl,
  role,
  dashboardUrl,
}: WelcomeToTeamEmailProps) {
  const displayName = memberName || memberEmail.split('@')[0]
  const previewText = `Welcome to ${teamName} on ChainLinked!`

  const nextSteps = [
    {
      title: 'Explore the Dashboard',
      description:
        'Get familiar with analytics, scheduling, and content tools.',
    },
    {
      title: 'Connect Your LinkedIn',
      description:
        'Link your LinkedIn account to start posting and tracking performance.',
    },
    {
      title: 'Check Team Activity',
      description:
        "See what your teammates are posting and how content is performing.",
    },
  ]

  if (role === 'admin') {
    nextSteps.push({
      title: 'Invite More Teammates',
      description: 'Help grow your team by inviting colleagues to join.',
    })
  }

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_TEAM)}>
            <Img
              src={companyLogoUrl || LOGO_URL}
              width="48"
              height="48"
              alt={companyLogoUrl ? (companyName || teamName) : 'ChainLinked'}
              style={headerLogo}
            />
            <Text style={headerHeading}>Welcome to {teamName}!</Text>
            <Text style={headerSubtext}>
              You&apos;re now part of the team
            </Text>
          </Section>

          {/* Welcome message */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{displayName}</strong>,
            </Text>

            <Text style={content.paragraph}>
              You have successfully joined <strong>{teamName}</strong>
              {companyName && companyName !== teamName && (
                <>
                  {' '}
                  at <strong>{companyName}</strong>
                </>
              )}
              ! You can now collaborate on LinkedIn content with your team.
            </Text>

            <Section style={roleCard}>
              <Text style={roleBadge}>
                {role === 'admin' ? 'Admin' : 'Member'}
              </Text>
              <Text style={card.description}>
                {role === 'admin'
                  ? 'You can invite new members, manage team settings, and access all team features.'
                  : 'You can collaborate on content, view analytics, and participate in team activities.'}
              </Text>
            </Section>
          </Section>

          {/* Next steps */}
          <Section style={steps.section}>
            <Text style={steps.title}>Get Started</Text>
            {nextSteps.map((step, index) => (
              <Section key={index} style={steps.item}>
                <Text style={teamStepNumber}>{index + 1}</Text>
                <div style={steps.content}>
                  <Text style={steps.itemTitle}>{step.title}</Text>
                  <Text style={steps.itemDescription}>
                    {step.description}
                  </Text>
                </div>
              </Section>
            ))}
          </Section>

          {/* CTA Button */}
          <Section style={buttons.section}>
            <Button style={teamButton} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Section style={{ padding: '16px 0' }} />

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer.section}>
            <Text style={footer.text}>
              Need help? Check out our{' '}
              <Link href={`${SITE_URL}/help`} style={footer.link}>
                Help Center
              </Link>{' '}
              or reach out to your team admin.
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
export default WelcomeToTeamEmail

// Template-specific styles
const roleCard = {
  backgroundColor: '#F5F3FF',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '24px 0',
  border: '1px solid #DDD6FE',
}

const roleBadge = {
  color: '#7C3AED',
  fontSize: '13px',
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}

const teamStepNumber = {
  backgroundColor: '#7C3AED',
  color: '#FFFFFF',
  borderRadius: '50%',
  width: '28px',
  height: '28px',
  fontSize: '13px',
  fontWeight: '700' as const,
  textAlign: 'center' as const,
  lineHeight: '28px',
  marginRight: '14px',
  display: 'inline-block',
  verticalAlign: 'top',
}

const teamButton = {
  backgroundColor: '#7C3AED',
  borderRadius: '10px',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 36px',
  letterSpacing: '0.2px',
}
