/**
 * Team Invitation Email Template
 * @description React Email template for team invitations
 * @module components/emails/team-invitation
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
  colors,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

/**
 * Props for the TeamInvitationEmail component
 */
export interface TeamInvitationEmailProps {
  /** Name of the person who sent the invitation */
  inviterName: string
  /** Email of the inviter (fallback if name not available) */
  inviterEmail: string
  /** Name of the team */
  teamName: string
  /** Name of the company (optional) */
  companyName?: string
  /** Company logo URL (optional) */
  companyLogoUrl?: string
  /** Role being offered */
  role: 'admin' | 'member'
  /** Full invitation link */
  inviteLink: string
  /** Expiration date string */
  expiresAt: string
}

/**
 * Team Invitation Email Component
 *
 * Email template for inviting users to join a team.
 * Uses React Email components for cross-client compatibility.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <TeamInvitationEmail
 *   inviterName="John Doe"
 *   inviterEmail="john@example.com"
 *   teamName="Marketing Team"
 *   companyName="Acme Inc"
 *   role="member"
 *   inviteLink="https://app.chainlinked.io/invite/abc123"
 *   expiresAt="February 1, 2025"
 * />
 */
export function TeamInvitationEmail({
  inviterName,
  inviterEmail,
  teamName,
  companyName,
  companyLogoUrl,
  role,
  inviteLink,
  expiresAt,
}: TeamInvitationEmailProps) {
  const previewText = `${inviterName || inviterEmail} invited you to join ${teamName} on ChainLinked`
  const displayName = inviterName || inviterEmail
  const roleDescription =
    role === 'admin'
      ? 'You will be able to invite members, manage team settings, and access all team features.'
      : 'You will be able to collaborate on content, view analytics, and participate in team activities.'

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
            <Text style={headerHeading}>
              You&apos;re invited to join {teamName}
            </Text>
            <Text style={headerSubtext}>
              <strong>{displayName}</strong> wants you on the team
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              <strong>{displayName}</strong> has invited you to join{' '}
              <strong>{teamName}</strong>
              {companyName && companyName !== teamName && (
                <>
                  {' '}
                  at <strong>{companyName}</strong>
                </>
              )}{' '}
              on ChainLinked — the LinkedIn content platform for teams.
            </Text>

            <Section style={roleCard}>
              <Text style={roleBadge}>
                {role === 'admin' ? 'Admin' : 'Member'}
              </Text>
              <Text style={card.description}>{roleDescription}</Text>
            </Section>

            <Section style={buttons.section}>
              <Button style={acceptButton} href={inviteLink}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={content.paragraphSmall}>
              This invitation expires on <strong>{expiresAt}</strong>.
            </Text>

            <Text style={content.paragraphSmall}>
              If you were not expecting this invitation, you can safely ignore
              this email.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer.section}>
            <Text style={footer.text}>
              This email was sent by ChainLinked on behalf of {displayName}.
            </Text>
            <Text style={footer.text}>
              If you have questions, please contact the person who invited you.
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
export default TeamInvitationEmail

// Template-specific styles
const roleCard = {
  backgroundColor: colors.infoBg,
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '24px 0',
  border: `1px solid ${colors.infoBorder}`,
}

const roleBadge = {
  color: colors.brand,
  fontSize: '13px',
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}

const acceptButton = {
  backgroundColor: colors.brand,
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
