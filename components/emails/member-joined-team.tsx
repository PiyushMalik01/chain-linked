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
  card,
  buttons,
  divider,
  footer,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

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
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_BRAND)}>
            <Img
              src={companyLogoUrl || LOGO_URL}
              width="48"
              height="48"
              alt={companyLogoUrl ? (companyName || teamName) : 'ChainLinked'}
              style={headerLogo}
            />
            <Text style={headerHeading}>New team member!</Text>
            <Text style={headerSubtext}>
              Your team is growing
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              <strong>{displayName}</strong> has joined{' '}
              <strong>{teamName}</strong>
              {companyName && companyName !== teamName && (
                <>
                  {' '}
                  at <strong>{companyName}</strong>
                </>
              )}.
            </Text>

            <Section style={card.info}>
              <Text style={memberInfoRow}>
                <strong>Name:</strong> {displayName}
              </Text>
              <Text style={memberInfoRow}>
                <strong>Email:</strong> {memberEmail}
              </Text>
              <Text style={{ ...memberInfoRow, margin: '0' }}>
                <strong>Role:</strong> {roleLabel}
              </Text>
            </Section>

            <Section style={buttons.section}>
              <Button style={buttons.primary} href={dashboardUrl}>
                View Team
              </Button>
            </Section>

            <Text style={content.paragraphSmall}>
              You are receiving this because you are the owner of {teamName}.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer.section}>
            <Text style={footer.text}>
              This email was sent by ChainLinked.
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
export default MemberJoinedTeamEmail

// Template-specific styles
const memberInfoRow = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}
