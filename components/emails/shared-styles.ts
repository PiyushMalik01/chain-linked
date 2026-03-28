/**
 * Shared Email Design System
 * @description Centralized styles and layout primitives for all email templates
 * @module components/emails/shared-styles
 */

// ============================================================================
// Brand Colors
// ============================================================================

export const colors = {
  /** ChainLinked primary brand blue */
  brand: '#0A66C2',
  /** Darker brand for hover/emphasis */
  brandDark: '#004182',
  /** Light brand tint for backgrounds */
  brandLight: '#E7F0FE',

  /** Heading text */
  heading: '#111827',
  /** Body text */
  body: '#374151',
  /** Secondary/muted text */
  muted: '#6B7280',
  /** Footer text */
  footerText: '#9CA3AF',

  /** Page background */
  pageBg: '#F3F4F6',
  /** Card/container background */
  cardBg: '#FFFFFF',
  /** Subtle box backgrounds */
  surfaceBg: '#F9FAFB',
  /** Border/divider color */
  border: '#E5E7EB',

  /** Success green */
  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',

  /** Warning amber */
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',

  /** Info blue */
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
} as const

// ============================================================================
// Layout
// ============================================================================

export const layout = {
  main: {
    backgroundColor: colors.pageBg,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    backgroundColor: colors.cardBg,
    margin: '0 auto',
    marginTop: '40px',
    marginBottom: '40px',
    borderRadius: '16px',
    maxWidth: '560px',
    overflow: 'hidden' as const,
    border: `1px solid ${colors.border}`,
  },
} as const

// ============================================================================
// Header (gradient banner with logo)
// ============================================================================

/**
 * Creates a gradient header style for the email banner
 * @param gradient - CSS gradient string
 * @returns Style object for the header section
 */
export function headerStyle(gradient: string) {
  return {
    background: gradient,
    padding: '40px 40px 32px',
    textAlign: 'center' as const,
  }
}

/** Default blue gradient for most emails */
export const GRADIENT_BRAND = 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)'
/** Green gradient for success/welcome emails */
export const GRADIENT_SUCCESS = 'linear-gradient(135deg, #059669 0%, #047857 100%)'
/** Amber gradient for alerts/security */
export const GRADIENT_WARNING = 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
/** Purple gradient for team/collaboration */
export const GRADIENT_TEAM = 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'

export const headerLogo = {
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  margin: '0 auto 16px',
  lineHeight: '48px',
  textAlign: 'center' as const,
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#FFFFFF',
  letterSpacing: '1px',
}

export const headerHeading = {
  color: '#FFFFFF',
  fontSize: '24px',
  fontWeight: '700' as const,
  lineHeight: '1.3',
  margin: '0',
  letterSpacing: '-0.3px',
}

export const headerSubtext = {
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '8px 0 0',
}

// ============================================================================
// Content
// ============================================================================

export const content = {
  section: {
    padding: '32px 40px',
  },
  heading: {
    color: colors.heading,
    fontSize: '20px',
    fontWeight: '600' as const,
    lineHeight: '1.3',
    margin: '0 0 16px',
  },
  paragraph: {
    color: colors.body,
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0 0 16px',
  },
  paragraphSmall: {
    color: colors.muted,
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 12px',
    textAlign: 'center' as const,
  },
} as const

// ============================================================================
// Buttons
// ============================================================================

export const buttons = {
  primary: {
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
  },
  secondary: {
    backgroundColor: colors.surfaceBg,
    borderRadius: '10px',
    color: colors.brand,
    fontSize: '15px',
    fontWeight: '600' as const,
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 36px',
    border: `1px solid ${colors.border}`,
  },
  section: {
    textAlign: 'center' as const,
    margin: '28px 0 8px',
  },
} as const

// ============================================================================
// Cards / Boxes
// ============================================================================

export const card = {
  /** Neutral info box */
  neutral: {
    backgroundColor: colors.surfaceBg,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '24px 0',
    border: `1px solid ${colors.border}`,
  },
  /** Success callout */
  success: {
    backgroundColor: colors.successBg,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '24px 0',
    border: `1px solid ${colors.successBorder}`,
  },
  /** Warning callout */
  warning: {
    backgroundColor: colors.warningBg,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '24px 0',
    border: `1px solid ${colors.warningBorder}`,
  },
  /** Blue info callout */
  info: {
    backgroundColor: colors.infoBg,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '24px 0',
    border: `1px solid ${colors.infoBorder}`,
  },
  title: {
    color: colors.heading,
    fontSize: '14px',
    fontWeight: '600' as const,
    margin: '0 0 4px',
  },
  description: {
    color: colors.body,
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0',
  },
} as const

// ============================================================================
// Link Box (copy-paste fallback)
// ============================================================================

export const linkBox = {
  container: {
    backgroundColor: colors.surfaceBg,
    borderRadius: '10px',
    padding: '14px 20px',
    margin: '20px 0',
    border: `1px solid ${colors.border}`,
  },
  label: {
    color: colors.muted,
    fontSize: '11px',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 6px',
    textAlign: 'center' as const,
  },
  url: {
    color: colors.brand,
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '0',
    textAlign: 'center' as const,
    wordBreak: 'break-all' as const,
  },
} as const

// ============================================================================
// Steps (numbered list)
// ============================================================================

export const steps = {
  section: {
    padding: '0 40px 8px',
  },
  title: {
    color: colors.heading,
    fontSize: '16px',
    fontWeight: '600' as const,
    margin: '0 0 20px',
  },
  item: {
    marginBottom: '20px',
  },
  number: {
    backgroundColor: colors.brand,
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
  },
  content: {
    display: 'inline-block',
    verticalAlign: 'top',
    width: 'calc(100% - 44px)',
  },
  itemTitle: {
    color: colors.heading,
    fontSize: '14px',
    fontWeight: '600' as const,
    margin: '4px 0 2px',
  },
  itemDescription: {
    color: colors.muted,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0',
  },
} as const

// ============================================================================
// Divider
// ============================================================================

export const divider = {
  borderColor: colors.border,
  margin: '0 40px',
}

// ============================================================================
// Footer
// ============================================================================

export const footer = {
  section: {
    padding: '24px 40px 32px',
  },
  text: {
    color: colors.footerText,
    fontSize: '12px',
    lineHeight: '1.6',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  },
  links: {
    color: colors.footerText,
    fontSize: '12px',
    lineHeight: '1.6',
    margin: '12px 0 0',
    textAlign: 'center' as const,
  },
  link: {
    color: colors.muted,
    textDecoration: 'none',
  },
  separator: ' \u00B7 ',
} as const

/** Base URL for ChainLinked website links */
export const SITE_URL = 'https://chainlinked.io'
