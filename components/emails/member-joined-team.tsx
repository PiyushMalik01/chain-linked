/**
 * Member Joined Team Email Template
 * @description React Email template sent to team owner when a new member joins
 * @module components/emails/member-joined-team
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

/**
 * Props for the MemberJoinedTeamEmail component
 */
export interface MemberJoinedTeamEmailProps {
  /** Name of the member who joined */
  memberName: string
  /** Email of the member who joined */
  memberEmail: string
  /** Name of the team */
  teamName: string
  /** Name of the company (optional) */
  companyName?: string
  /** Company logo URL (optional) */
  companyLogoUrl?: string
  /** Role assigned to the new member */
  role: 'admin' | 'member'
  /** URL to the team dashboard */
  dashboardUrl: string
}

/**
 * Member Joined Team Email Component
 *
 * Email template notifying team owners when a new member joins their team.
 * Uses React Email components for cross-client compatibility.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <MemberJoinedTeamEmail
 *   memberName="Jane Smith"
 *   memberEmail="jane@example.com"
 *   teamName="Marketing Team"
 *   companyName="Acme Inc"
 *   role="member"
 *   dashboardUrl="https://app.chainlinked.io/dashboard"
 * />
 */
export function MemberJoinedTeamEmail({
  memberName,
  memberEmail,
  teamName,
  companyName,
  companyLogoUrl,
  role,
  dashboardUrl,
}: MemberJoinedTeamEmailProps) {
  const previewText = `${memberName || memberEmail} has joined ${teamName} on ChainLinked`
  const displayName = memberName || memberEmail
  const roleLabel = role === 'admin' ? 'Admin' : 'Member'

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={logoSection}>
            {companyLogoUrl ? (
              <Img
                src={companyLogoUrl}
                width="60"
                height="60"
                alt={companyName || teamName}
                style={companyLogo}
              />
            ) : (
              <div style={logoPlaceholder}>
                <Text style={logoPlaceholderText}>
                  {(companyName || teamName).charAt(0).toUpperCase()}
                </Text>
              </div>
            )}
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={heading}>
              New team member joined
            </Heading>

            <Text style={paragraph}>
              <strong>{displayName}</strong> has joined{' '}
              <strong>{teamName}</strong>
              {companyName && companyName !== teamName && (
                <> at <strong>{companyName}</strong></>
              )}{' '}
              as a {roleLabel}.
            </Text>

            <Section style={buttonSection}>
              <Button style={button} href={dashboardUrl}>
                Go to Dashboard
              </Button>
            </Section>

            <Text style={paragraphSmall}>
              You are receiving this because you are the owner of {teamName}.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by ChainLinked.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://chainlinked.io" style={link}>
                ChainLinked
              </Link>
              {' | '}
              <Link href="https://chainlinked.io/privacy" style={link}>
                Privacy Policy
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
export default MemberJoinedTeamEmail

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

const companyLogo = {
  borderRadius: '8px',
  margin: '0 auto',
}

const logoPlaceholder = {
  width: '60px',
  height: '60px',
  borderRadius: '8px',
  backgroundColor: '#0077b5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
}

const logoPlaceholderText = {
  color: '#ffffff',
  fontSize: '24px',
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
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '16px 0 24px',
  textAlign: 'center' as const,
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}

const paragraphSmall = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px',
  textAlign: 'center' as const,
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
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
  margin: '32px 0',
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
