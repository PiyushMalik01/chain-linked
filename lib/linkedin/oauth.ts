/**
 * LinkedIn OAuth Module
 * @description Handles LinkedIn OAuth 2.0 authentication flow
 * @module lib/linkedin/oauth
 */

import {
  LINKEDIN_API,
  LINKEDIN_API_VERSION,
  getLinkedInScopes,
  type LinkedInTokenResponse,
  type LinkedInUserInfo,
  type LinkedInMeResponse,
  type LinkedInTokenData,
} from './types'

/**
 * LinkedIn OAuth configuration
 */
interface LinkedInOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Get LinkedIn OAuth configuration from environment
 * @param origin - Optional origin URL to construct redirect_uri dynamically
 * @returns LinkedIn OAuth configuration
 * @throws Error if environment variables are not set
 */
export function getLinkedInConfig(origin?: string): LinkedInOAuthConfig {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  // Use dynamic origin-based redirect_uri if provided, otherwise fall back to env var
  let redirectUri = process.env.LINKEDIN_REDIRECT_URI
  if (origin) {
    redirectUri = `${origin}/api/linkedin/callback`
  }

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'LinkedIn OAuth configuration is incomplete. ' +
      'Please set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI environment variables.'
    )
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  }
}

/**
 * Generate a cryptographically secure state parameter
 * @returns Random state string for CSRF protection
 */
export function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate LinkedIn OAuth authorization URL
 *
 * NOTE: This function calls `getLinkedInConfig()` without an `origin`, so it
 * relies on the `LINKEDIN_REDIRECT_URI` environment variable being set correctly
 * for each deployment environment (local dev, preview deploys, production, etc.).
 * Make sure the env var matches the redirect URI registered in your LinkedIn
 * Developer Portal for the corresponding environment.
 *
 * @param state - CSRF protection state parameter
 * @returns Authorization URL to redirect user to
 * @example
 * const state = generateState()
 * const authUrl = generateAuthUrl(state)
 * // Store state in session, then redirect to authUrl
 */
export function generateAuthUrl(state: string): string {
  const config = getLinkedInConfig()
  const scopes = getLinkedInScopes()
  const scope = scopes.join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope,
  })

  return `${LINKEDIN_API.AUTHORIZATION}?${params.toString()}`
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param code - Authorization code from LinkedIn callback
 * @returns Token response with access_token, refresh_token, and expiry
 * @throws Error if token exchange fails
 * @example
 * const tokens = await exchangeCodeForTokens(code)
 * // Store tokens securely in database
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<LinkedInTokenResponse> {
  const config = getLinkedInConfig()

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch(LINKEDIN_API.ACCESS_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('LinkedIn token exchange error:', errorText)
    throw new Error(`Failed to exchange authorization code: ${response.status}`)
  }

  const data = await response.json() as LinkedInTokenResponse
  return data
}

/**
 * Refresh an expired access token
 * @param refreshToken - The refresh token to use
 * @returns New token response with fresh access_token
 * @throws Error if refresh fails (user needs to re-authenticate)
 * @example
 * try {
 *   const newTokens = await refreshAccessToken(existingRefreshToken)
 * } catch {
 *   // Redirect user to re-authenticate
 * }
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<LinkedInTokenResponse> {
  const config = getLinkedInConfig()

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch(LINKEDIN_API.ACCESS_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('LinkedIn token refresh error:', errorText)
    throw new Error(`Failed to refresh access token: ${response.status}`)
  }

  const data = await response.json() as LinkedInTokenResponse
  return data
}

/**
 * Revoke LinkedIn access token (disconnect user)
 * @param accessToken - The access token to revoke
 * @returns True if revocation succeeded
 * @example
 * await revokeToken(accessToken)
 * // Delete token from database
 */
export async function revokeToken(accessToken: string): Promise<boolean> {
  const config = getLinkedInConfig()

  const params = new URLSearchParams({
    token: accessToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  // LinkedIn uses the introspection endpoint for revocation
  const response = await fetch('https://www.linkedin.com/oauth/v2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  // LinkedIn returns 200 even if token was already revoked
  return response.ok
}

/**
 * Get LinkedIn user info using access token
 * Uses /v2/userinfo endpoint (OpenID Connect)
 *
 * IMPORTANT: The /v2/me endpoint is DEPRECATED. You must enable
 * "Sign In with LinkedIn using OpenID Connect" in LinkedIn Developer Portal.
 *
 * @param accessToken - Valid LinkedIn access token with openid scope
 * @returns User info including LinkedIn member ID (sub)
 * @throws Error if user info fetch fails
 */
export async function getLinkedInUserInfo(
  accessToken: string
): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_API.USERINFO, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': LINKEDIN_API_VERSION,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('LinkedIn userinfo error response:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    })

    // Try to parse error as JSON for more details
    let errorDetails = ''
    try {
      const errorJson = JSON.parse(errorText)
      errorDetails = errorJson.message || errorJson.error_description || errorJson.error || ''
      console.error('LinkedIn error details:', errorJson)
    } catch {
      errorDetails = errorText.substring(0, 200)
    }

    if (response.status === 403) {
      throw new Error(
        `LinkedIn API access forbidden (403). ${errorDetails ? `Details: ${errorDetails}. ` : ''}` +
        'Please verify: 1) "Sign In with LinkedIn using OpenID Connect" product is ADDED (not just requested) ' +
        'in your LinkedIn Developer Portal (https://www.linkedin.com/developers/apps). ' +
        '2) Wait 5-10 minutes after enabling for LinkedIn to provision access. ' +
        '3) The app may need to be verified if requesting sensitive scopes.'
      )
    }

    if (response.status === 401) {
      throw new Error(
        `LinkedIn authentication failed (401). ${errorDetails ? `Details: ${errorDetails}. ` : ''}` +
        'The access token may be invalid or expired.'
      )
    }

    throw new Error(`Failed to get LinkedIn user info: ${response.status}${errorDetails ? ` - ${errorDetails}` : ''}`)
  }

  const userInfo = await response.json() as LinkedInUserInfo
  return userInfo
}

/**
 * Decode a JWT ID token without verification
 * LinkedIn ID tokens are JWTs that contain user info in the payload
 *
 * @param idToken - The JWT ID token from LinkedIn
 * @returns Decoded payload with user info, or null if decoding fails
 */
export function decodeIdToken(idToken: string): LinkedInUserInfo | null {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) {
      console.error('Invalid ID token format: expected 3 parts')
      return null
    }

    // Decode the payload (second part)
    const payload = parts[1]
    // Handle URL-safe base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    const claims = JSON.parse(decoded)

    // Map JWT claims to LinkedInUserInfo
    return {
      sub: claims.sub,
      name: claims.name,
      given_name: claims.given_name,
      family_name: claims.family_name,
      picture: claims.picture,
      email: claims.email,
      email_verified: claims.email_verified,
      locale: claims.locale,
    }
  } catch (error) {
    console.error('Failed to decode ID token:', error)
    return null
  }
}

/**
 * Get LinkedIn user info from ID token or userinfo endpoint
 * Tries ID token first (more reliable), falls back to userinfo endpoint
 *
 * @param accessToken - Valid LinkedIn access token
 * @param idToken - Optional ID token from token exchange
 * @returns User info including LinkedIn member ID (sub)
 */
export async function getLinkedInUserInfoFromTokens(
  accessToken: string,
  idToken?: string
): Promise<LinkedInUserInfo> {
  // Try to decode ID token first - this is more reliable
  if (idToken) {
    const userInfo = decodeIdToken(idToken)
    if (userInfo && userInfo.sub) {
      return userInfo
    }
  }

  // Fall back to userinfo endpoint
  return getLinkedInUserInfo(accessToken)
}

/**
 * Check if a token is expired or about to expire
 * @param expiresAt - Token expiration timestamp (ISO string)
 * @param bufferMinutes - Minutes before expiry to consider "expired" (default: 5)
 * @returns True if token needs refresh
 * @example
 * if (isTokenExpired(tokenData.expires_at)) {
 *   const newTokens = await refreshAccessToken(tokenData.refresh_token)
 * }
 */
export function isTokenExpired(expiresAt: string, bufferMinutes: number = 5): boolean {
  const expiryTime = new Date(expiresAt).getTime()
  const bufferMs = bufferMinutes * 60 * 1000
  const now = Date.now()

  return now >= expiryTime - bufferMs
}

/**
 * Calculate token expiration timestamp
 * @param expiresIn - Seconds until token expires
 * @returns ISO timestamp string of expiration
 */
export function calculateExpiresAt(expiresIn: number): string {
  const expiryTime = Date.now() + expiresIn * 1000
  return new Date(expiryTime).toISOString()
}

/**
 * Validate and get valid tokens, refreshing if needed
 * @param tokenData - Stored token data from database
 * @param updateTokens - Callback to update tokens in database
 * @returns Valid access token
 * @throws Error if tokens cannot be refreshed
 */
export async function getValidAccessToken(
  tokenData: LinkedInTokenData,
  updateTokens: (newTokenData: Partial<LinkedInTokenData>) => Promise<void>
): Promise<string> {
  // Check if token is still valid
  if (!isTokenExpired(tokenData.expires_at)) {
    return tokenData.access_token
  }

  // Token is expired, try to refresh
  if (!tokenData.refresh_token) {
    throw new Error('Token expired and no refresh token available. Please re-authenticate.')
  }

  try {
    const newTokens = await refreshAccessToken(tokenData.refresh_token)

    // Update stored tokens
    await updateTokens({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: calculateExpiresAt(newTokens.expires_in),
      updated_at: new Date().toISOString(),
    })

    return newTokens.access_token
  } catch (error) {
    console.error('Failed to refresh LinkedIn token:', error)
    throw new Error('Failed to refresh LinkedIn token. Please re-authenticate.')
  }
}
