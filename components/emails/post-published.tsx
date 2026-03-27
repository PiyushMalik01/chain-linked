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
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

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
  const previewText = `Your scheduled post is now live on LinkedIn`
  const ctaHref = linkedinUrl || dashboardUrl
  const ctaLabel = linkedinUrl ? 'View on LinkedIn' : 'Go to Dashboard'

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with ChainLinked logo placeholder */}
          <Section style={logoSection}>
            <div style={logoPlaceholder}>
              <Text style={logoPlaceholderText}>C</Text>
            </div>
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={heading}>
              Your post is live!
            </Heading>

            <Text style={paragraph}>
              Hi {userName}, your scheduled post was published on LinkedIn.
            </Text>

            {/* Content preview box */}
            <Section style={previewBox}>
              <Text style={previewText_style}>{contentPreview}</Text>
              <Text style={previewTimestamp}>Published on {publishedAt}</Text>
            </Section>

            <Section style={buttonSection}>
              <Button style={button} href={ctaHref}>
                {ctaLabel}
              </Button>
            </Section>
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
export default PostPublishedEmail

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

const previewBox = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
}

const previewText_style = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 8px',
  whiteSpace: 'pre-wrap' as const,
}

const previewTimestamp = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: 0,
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
