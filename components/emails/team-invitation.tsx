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
  headerHeading,
  headerSubtext,
  GRADIENT_TEAM,
  content,
  card,
  buttons,
  divider,
  footer,
  colors,
  SITE_URL,
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
          <Section style={headerStyle(GRADIENT_TEAM)}>
            {companyLogoUrl ? (
              <Img
                src={companyLogoUrl}
                width="48"
                height="48"
                alt={companyName || teamName}
                style={companyLogoStyle}
              />
            ) : (
              <div style={teamLogoPlaceholder}>
                <Text style={teamLogoText}>
                  {(companyName || teamName).charAt(0).toUpperCase()}
                </Text>
              </div>
            )}
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
const companyLogoStyle = {
  borderRadius: '12px',
  margin: '0 auto 16px',
  border: '2px solid rgba(255, 255, 255, 0.3)',
}

const teamLogoPlaceholder = {
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  margin: '0 auto 16px',
  lineHeight: '48px',
  textAlign: 'center' as const,
}

const teamLogoText = {
  color: '#FFFFFF',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  margin: '0',
  lineHeight: '48px',
  textAlign: 'center' as const,
}

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

const acceptButton = {
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
