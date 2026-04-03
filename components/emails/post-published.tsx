/**
 * Post Published Email Template
 * @description React Email template sent when a scheduled post is published on LinkedIn
 * @module components/emails/post-published
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
  buttons,
  divider,
  footer,
  colors,
  SITE_URL,
  LOGO_URL,
} from './shared-styles'

/**
 * Props for the PostPublishedEmail component
 */
export interface PostPublishedEmailProps {
  /** Name of the user who authored the post */
  userName: string
  /** First 200 characters of the post content */
  contentPreview: string
  /** Formatted date when the post was published */
  publishedAt: string
  /** Link to the post on LinkedIn (optional) */
  linkedinUrl?: string
  /** URL to the ChainLinked dashboard */
  dashboardUrl: string
}

/**
 * Post Published Email Component
 *
 * Email template notifying users when their scheduled post has been
 * successfully published on LinkedIn.
 * Uses React Email components for cross-client compatibility.
 *
 * @param props - Email template props
 * @returns Email template JSX
 * @example
 * <PostPublishedEmail
 *   userName="Jane Smith"
 *   contentPreview="Excited to share our latest product launch..."
 *   publishedAt="March 28, 2026 at 9:00 AM"
 *   linkedinUrl="https://linkedin.com/feed/update/urn:li:activity:123"
 *   dashboardUrl="https://app.chainlinked.io/dashboard"
 * />
 */
export function PostPublishedEmail({
  userName,
  contentPreview,
  publishedAt,
  linkedinUrl,
  dashboardUrl,
}: PostPublishedEmailProps) {
  const previewText = 'Your scheduled post is now live on LinkedIn'
  const ctaHref = linkedinUrl || dashboardUrl
  const ctaLabel = linkedinUrl ? 'View on LinkedIn' : 'Go to Dashboard'

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={layout.main}>
        <Container style={layout.container}>
          {/* Gradient header */}
          <Section style={headerStyle(GRADIENT_SUCCESS)}>
            <Img src={LOGO_URL} width="48" height="48" alt="ChainLinked" style={headerLogo} />
            <Text style={headerHeading}>Your post is live!</Text>
            <Text style={headerSubtext}>
              Successfully published on LinkedIn
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content.section}>
            <Text style={content.paragraph}>
              Hi <strong>{userName}</strong>, your scheduled post was published
              on LinkedIn.
            </Text>

            {/* Content preview box */}
            <Section style={previewBox}>
              <Text style={previewLabel}>Post Preview</Text>
              <Text style={previewContent}>{contentPreview}</Text>
              <Text style={previewTimestamp}>Published on {publishedAt}</Text>
            </Section>

            <Section style={buttons.section}>
              <Button style={successButton} href={ctaHref}>
                {ctaLabel}
              </Button>
            </Section>
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
export default PostPublishedEmail

// Template-specific styles
const previewBox = {
  backgroundColor: colors.successBg,
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '24px 0',
  border: `1px solid ${colors.successBorder}`,
}

const previewLabel = {
  color: colors.success,
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
  margin: '0 0 12px',
  whiteSpace: 'pre-wrap' as const,
}

const previewTimestamp = {
  color: colors.muted,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0',
  borderTop: `1px solid ${colors.successBorder}`,
  paddingTop: '10px',
}

const successButton = {
  backgroundColor: '#059669',
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
