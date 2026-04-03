/**
 * Post Scheduled Email Template
 * @description React Email template sent when a post is scheduled for future publishing
 * @module components/emails/post-scheduled
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
  card,
  divider,
  footer,
  colors,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

/**
 * Props for the PostScheduledEmail component
 */
export interface PostScheduledEmailProps {
  /** Name of the user who authored the post */
  userName: string
  /** First 200 characters of the post content */
  contentPreview: string
  /** Formatted scheduled date (e.g. "April 5, 2026") */
  scheduledDate: string
  /** Formatted scheduled time (e.g. "9:00 AM") */
  scheduledTime: string
  /** Timezone display string (e.g. "EST") */
  timezone: string
  /** URL to view the scheduled post in the dashboard */
  viewPostUrl: string
  /** URL to edit the scheduled post */
  editPostUrl: string
}

/**
 * Post Scheduled Email Component
 *
 * Email template notifying users when their post has been
 * successfully scheduled for future publishing on LinkedIn.
 * Uses React Email components for cross-client compatibility.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <PostScheduledEmail
 *   userName="Jane Smith"
 *   contentPreview="Excited to share our latest product launch..."
 *   scheduledDate="April 5, 2026"
 *   scheduledTime="9:00 AM"
 *   timezone="EST"
 *   viewPostUrl="https://app.chainlinked.io/dashboard/queue/abc123"
 *   editPostUrl="https://app.chainlinked.io/dashboard/compose/abc123"
 * />
 */
export function PostScheduledEmail({
  userName,
  contentPreview,
  scheduledDate,
  scheduledTime,
  timezone,
  viewPostUrl,
  editPostUrl,
}: PostScheduledEmailProps) {
  const previewText = `Your post is scheduled for ${scheduledDate} at ${scheduledTime} ${timezone}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_BRAND)}>
            <Img src={LOGO_URL} width="48" height="48" alt="ChainLinked" style={headerLogo} />
            <Text style={headerHeading}>Your post is queued</Text>
            <Text style={headerSubtext}>
              It will be published to LinkedIn on the date and time below.
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{userName}</strong>, your post has been scheduled
              and will go live automatically.
            </Text>

            {/* Scheduled status badge */}
            <Section style={scheduledBadgeContainer}>
              <Text style={scheduledBadge}>
                <span style={greenDot}>{'\u25CF'}</span> Scheduled
              </Text>
            </Section>

            {/* Post preview card */}
            <Section style={previewCard}>
              <Text style={previewLabel}>Post Preview</Text>
              <Text style={previewContent}>{contentPreview}</Text>
            </Section>

            {/* Schedule details card */}
            <Section style={card.neutral}>
              <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={detailLabel}>Date</td>
                    <td style={detailValue}>{scheduledDate}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>Time</td>
                    <td style={detailValue}>{scheduledTime} {timezone}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>Platform</td>
                    <td style={detailValue}>LinkedIn</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* CTA buttons */}
            <Section style={buttons.section}>
              <Button style={buttons.primary} href={viewPostUrl}>
                View Post
              </Button>
            </Section>

            <Section style={{ textAlign: 'center' as const, margin: '12px 0 0' }}>
              <Button style={buttons.secondary} href={editPostUrl}>
                Edit Post
              </Button>
            </Section>

            <Text style={tipText}>
              <strong>Tip:</strong> Engage with comments in the first hour
              after posting to boost your reach by up to 3x.
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
export default PostScheduledEmail

// Template-specific styles
const scheduledBadgeContainer = {
  margin: '0 0 20px',
}

const scheduledBadge = {
  display: 'inline-block' as const,
  backgroundColor: '#ECFDF5',
  color: '#059669',
  fontSize: '12px',
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  padding: '6px 14px',
  borderRadius: '20px',
  border: '1px solid #A7F3D0',
  margin: '0',
}

const greenDot = {
  color: '#059669',
  marginRight: '6px',
  fontSize: '10px',
}

const previewCard = {
  backgroundColor: colors.surfaceBg,
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 20px',
  border: `1px solid ${colors.border}`,
}

const previewLabel = {
  color: colors.brand,
  fontSize: '11px',
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 10px',
}

const previewContent = {
  color: colors.body,
  fontSize: '14px',
  lineHeight: '1.7',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
}

const detailLabel = {
  color: colors.muted,
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  padding: '8px 0',
  width: '100px',
  verticalAlign: 'top' as const,
}

const detailValue = {
  color: colors.heading,
  fontSize: '14px',
  fontWeight: '600' as const,
  padding: '8px 0',
  verticalAlign: 'top' as const,
}

const tipText = {
  color: colors.muted,
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '24px 0 0',
  textAlign: 'center' as const,
}
