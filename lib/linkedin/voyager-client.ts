/**
 * Voyager API Client
 * @description Core HTTP client for LinkedIn's internal Voyager API
 * @module lib/linkedin/voyager-client
 */

import { createClient } from '@/lib/supabase/server'
import {
  VOYAGER_BASE_URL,
  getVoyagerHeaders,
  DEFAULT_USER_AGENT,
  REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_CONFIG,
  VOYAGER_ERROR_CODES,
  LINKEDIN_COOKIE_NAMES,
  MIN_REQUEST_DELAY_MS,
  MAX_REQUEST_DELAY_MS,
  RATE_LIMITS,
} from './voyager-constants'
import type {
  LinkedInCredentials,
  VoyagerRequestOptions,
  VoyagerResponse,
  VoyagerError,
  RetryConfig,
  RateLimitState,
  CookieValidationResult,
} from './voyager-types'

/**
 * Module-level lazy-initialized Supabase client for lightweight DB writes
 * (e.g., updateLastUsed). Avoids creating a new client on every request.
 */
let _supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null
async function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = await createClient()
  }
  return _supabaseClient
}

/**
 * In-memory rate limit tracking
 * Key: userId:endpoint
 *
 * TODO: This Map resets on every serverless cold start, so rate limits are
 * effectively per-instance and short-lived. For durable rate limiting,
 * migrate to Redis/Upstash or use the `last_used_at` column on the
 * `linkedin_credentials` table (already updated by `updateLastUsed()`)
 * as a simple cross-invocation throttle.
 */
const rateLimitStore = new Map<string, RateLimitState>()

/**
 * Sleep for a given number of milliseconds
 * @param ms - Milliseconds to sleep
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate random delay to mimic human behavior
 * @returns Random delay in milliseconds
 */
function getRandomDelay(): number {
  return Math.floor(
    Math.random() * (MAX_REQUEST_DELAY_MS - MIN_REQUEST_DELAY_MS) + MIN_REQUEST_DELAY_MS
  )
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current retry attempt number
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Create a VoyagerError object
 * @param code - Error code
 * @param message - Error message
 * @param status - HTTP status code
 * @param retryable - Whether the error is retryable
 * @param details - Additional error details
 * @returns VoyagerError object
 */
function createVoyagerError(
  code: string,
  message: string,
  status: number,
  retryable: boolean,
  details?: Record<string, unknown>
): VoyagerError {
  return {
    code,
    message,
    status,
    retryable,
    details,
  }
}

/**
 * Get rate limit category for an endpoint
 * @param endpoint - API endpoint path
 * @returns Rate limit category key
 */
function getRateLimitCategory(endpoint: string): keyof typeof RATE_LIMITS {
  if (endpoint.includes('Share') || endpoint.includes('ugcPost')) {
    return 'posts'
  }
  if (endpoint.includes('profile') || endpoint.includes('identity')) {
    return 'profile'
  }
  if (endpoint.includes('analytics')) {
    return 'analytics'
  }
  if (endpoint.includes('feed')) {
    return 'feed'
  }
  return 'default'
}

/**
 * Check if request is rate limited
 * @param userId - User ID
 * @param endpoint - API endpoint
 * @returns Whether request is rate limited
 */
function isRateLimited(userId: string, endpoint: string): boolean {
  const category = getRateLimitCategory(endpoint)
  const key = `${userId}:${category}`
  const state = rateLimitStore.get(key)

  if (!state) {
    return false
  }

  const { windowMs } = RATE_LIMITS[category]
  const now = Date.now()

  // Check if window has expired
  if (now - state.windowStart > windowMs) {
    rateLimitStore.delete(key)
    return false
  }

  return state.isLimited
}

/**
 * Track request for rate limiting
 * @param userId - User ID
 * @param endpoint - API endpoint
 */
function trackRequest(userId: string, endpoint: string): void {
  const category = getRateLimitCategory(endpoint)
  const config = RATE_LIMITS[category]
  const key = `${userId}:${category}`
  const now = Date.now()

  let state = rateLimitStore.get(key)

  if (!state || now - state.windowStart > config.windowMs) {
    state = {
      endpoint: category,
      requestCount: 1,
      windowStart: now,
      isLimited: false,
      resetAt: null,
    }
  } else {
    state.requestCount++
    if (state.requestCount >= config.maxRequests) {
      state.isLimited = true
      state.resetAt = state.windowStart + config.windowMs
    }
  }

  rateLimitStore.set(key, state)
}

/**
 * Voyager API Client class
 * Handles authenticated requests to LinkedIn's Voyager API
 */
export class VoyagerClient {
  private credentials: LinkedInCredentials | null = null
  private userId: string
  private retryConfig: RetryConfig

  /**
   * Create a new VoyagerClient instance
   * @param userId - Supabase user ID
   * @param retryConfig - Optional retry configuration
   */
  constructor(userId: string, retryConfig?: Partial<RetryConfig>) {
    this.userId = userId
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  /**
   * Load credentials from Supabase
   * @returns Promise resolving to credentials or null
   */
  async loadCredentials(): Promise<LinkedInCredentials | null> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('linkedin_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_valid', true)
        .single()

      if (error || !data) {
        console.error('Failed to load LinkedIn credentials:', error)
        return null
      }

      this.credentials = data as unknown as LinkedInCredentials
      return this.credentials
    } catch (err) {
      console.error('Error loading credentials:', err)
      return null
    }
  }

  /**
   * Validate stored credentials
   * @returns Cookie validation result
   */
  async validateCredentials(): Promise<CookieValidationResult> {
    if (!this.credentials) {
      await this.loadCredentials()
    }

    if (!this.credentials) {
      return {
        isValid: false,
        expiresIn: null,
        needsRefresh: true,
        error: 'No credentials found',
      }
    }

    // Check if credentials have an expiration date
    if (this.credentials.expires_at) {
      const expiresAt = new Date(this.credentials.expires_at).getTime()
      const now = Date.now()
      const expiresIn = expiresAt - now

      if (expiresIn <= 0) {
        return {
          isValid: false,
          expiresIn: 0,
          needsRefresh: true,
          error: 'Credentials have expired',
        }
      }

      // Warn if expiring within 24 hours
      const needsRefresh = expiresIn < 24 * 60 * 60 * 1000

      return {
        isValid: true,
        expiresIn,
        needsRefresh,
        error: null,
      }
    }

    // Make a test request to verify credentials
    try {
      const response = await this.request({
        method: 'GET',
        endpoint: '/me',
        timeout: 10000,
      })

      return {
        isValid: response.success,
        expiresIn: null,
        needsRefresh: false,
        error: response.error?.message || null,
      }
    } catch {
      return {
        isValid: false,
        expiresIn: null,
        needsRefresh: true,
        error: 'Failed to validate credentials',
      }
    }
  }

  /**
   * Build request headers with authentication
   * @param additionalHeaders - Optional additional headers
   * @returns Headers object
   */
  private buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    if (!this.credentials) {
      throw new Error('Credentials not loaded')
    }

    const csrfToken = this.credentials.csrf_token || this.credentials.jsessionid.replace(/"/g, '')

    return {
      ...getVoyagerHeaders(),
      'csrf-token': csrfToken,
      'cookie': this.buildCookieString(),
      'user-agent': this.credentials.user_agent || DEFAULT_USER_AGENT,
      ...additionalHeaders,
    }
  }

  /**
   * Build cookie string for request
   * @returns Cookie header string
   */
  private buildCookieString(): string {
    if (!this.credentials) {
      throw new Error('Credentials not loaded')
    }

    const cookies: string[] = [
      `${LINKEDIN_COOKIE_NAMES.SESSION_TOKEN}=${this.credentials.li_at}`,
      `${LINKEDIN_COOKIE_NAMES.CSRF_TOKEN}=${this.credentials.jsessionid}`,
    ]

    if (this.credentials.liap) {
      cookies.push(`${LINKEDIN_COOKIE_NAMES.APP_TOKEN}=${this.credentials.liap}`)
    }

    return cookies.join('; ')
  }

  /**
   * Make a request to the Voyager API
   * @param options - Request options
   * @returns Promise resolving to VoyagerResponse
   */
  async request<T = unknown>(options: VoyagerRequestOptions): Promise<VoyagerResponse<T>> {
    // Ensure credentials are loaded
    if (!this.credentials) {
      await this.loadCredentials()
    }

    if (!this.credentials) {
      return {
        success: false,
        data: null,
        error: createVoyagerError(
          VOYAGER_ERROR_CODES.INVALID_CREDENTIALS,
          'LinkedIn credentials not found or invalid',
          401,
          false
        ),
        statusCode: 401,
        headers: {},
      }
    }

    // Check rate limits
    if (isRateLimited(this.userId, options.endpoint)) {
      return {
        success: false,
        data: null,
        error: createVoyagerError(
          VOYAGER_ERROR_CODES.RATE_LIMITED,
          'Rate limit exceeded for this endpoint',
          429,
          true
        ),
        statusCode: 429,
        headers: {},
      }
    }

    // Add random delay to mimic human behavior
    await sleep(getRandomDelay())

    return this.executeWithRetry<T>(options)
  }

  /**
   * Execute request with retry logic
   * @param options - Request options
   * @param attempt - Current attempt number
   * @returns Promise resolving to VoyagerResponse
   */
  private async executeWithRetry<T>(
    options: VoyagerRequestOptions,
    attempt: number = 0
  ): Promise<VoyagerResponse<T>> {
    try {
      const url = `${VOYAGER_BASE_URL}${options.endpoint}`
      const headers = this.buildHeaders(options.headers)

      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || REQUEST_TIMEOUT_MS
      )

      const fetchOptions: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      }

      if (options.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
        fetchOptions.body = JSON.stringify(options.body)
        headers['content-type'] = 'application/json'
      }

      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      // Track this request for rate limiting
      trackRequest(this.userId, options.endpoint)

      // Update last used timestamp
      this.updateLastUsed()

      // Parse response
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      if (!response.ok) {
        const error = this.handleErrorResponse(response.status, await response.text())

        // Retry if retryable and within limits
        if (error.retryable && attempt < this.retryConfig.maxRetries) {
          const delay = calculateBackoffDelay(attempt, this.retryConfig)
          await sleep(delay)
          return this.executeWithRetry<T>(options, attempt + 1)
        }

        // Mark credentials as invalid if unauthorized
        if (response.status === 401) {
          this.invalidateCredentials()
        }

        return {
          success: false,
          data: null,
          error,
          statusCode: response.status,
          headers: responseHeaders,
        }
      }

      // Parse successful response
      let data: T | null = null
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json') || contentType?.includes('linkedin.normalized')) {
        const jsonResponse = await response.json()
        data = this.normalizeResponse<T>(jsonResponse)
      }

      return {
        success: true,
        data,
        error: null,
        statusCode: response.status,
        headers: responseHeaders,
      }
    } catch (err) {
      // Handle network errors and timeouts
      const error = err instanceof Error ? err : new Error('Unknown error')
      const isTimeout = error.name === 'AbortError'

      const voyagerError = createVoyagerError(
        isTimeout ? VOYAGER_ERROR_CODES.TIMEOUT : VOYAGER_ERROR_CODES.NETWORK_ERROR,
        isTimeout ? 'Request timed out' : error.message,
        0,
        true
      )

      // Retry network errors
      if (attempt < this.retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(attempt, this.retryConfig)
        await sleep(delay)
        return this.executeWithRetry<T>(options, attempt + 1)
      }

      return {
        success: false,
        data: null,
        error: voyagerError,
        statusCode: 0,
        headers: {},
      }
    }
  }

  /**
   * Handle error response and create appropriate error object
   * @param status - HTTP status code
   * @param body - Response body
   * @returns VoyagerError object
   */
  private handleErrorResponse(status: number, body: string): VoyagerError {
    let details: Record<string, unknown> | undefined

    try {
      details = JSON.parse(body)
    } catch {
      details = { rawBody: body }
    }

    switch (status) {
      case 401:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.UNAUTHORIZED,
          'Authentication failed - session may have expired',
          status,
          false,
          details
        )
      case 403:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.FORBIDDEN,
          'Access denied - account may be restricted',
          status,
          false,
          details
        )
      case 404:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.NOT_FOUND,
          'Resource not found',
          status,
          false,
          details
        )
      case 429:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.RATE_LIMITED,
          'Rate limit exceeded by LinkedIn',
          status,
          true,
          details
        )
      case 500:
      case 502:
      case 503:
      case 504:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.SERVER_ERROR,
          'LinkedIn server error',
          status,
          true,
          details
        )
      default:
        return createVoyagerError(
          VOYAGER_ERROR_CODES.INVALID_RESPONSE,
          `Unexpected response: ${status}`,
          status,
          false,
          details
        )
    }
  }

  /**
   * Normalize LinkedIn's nested response format
   * @param response - Raw API response
   * @returns Normalized data
   */
  private normalizeResponse<T>(response: Record<string, unknown>): T {
    // LinkedIn often wraps data in 'elements' or 'data' arrays
    if (response.elements && Array.isArray(response.elements)) {
      return response.elements as T
    }
    if (response.data && typeof response.data === 'object') {
      return response.data as T
    }
    if (response.included && Array.isArray(response.included)) {
      // Handle normalized+json format
      return {
        data: response.data,
        included: response.included,
      } as T
    }
    return response as T
  }

  /**
   * Update last used timestamp in database.
   * Uses a module-level cached Supabase client to avoid creating a new one each call.
   */
  private async updateLastUsed(): Promise<void> {
    try {
      const supabase = await getSupabaseClient()
      await supabase
        .from('linkedin_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', this.userId)
    } catch (err) {
      console.error('Failed to update last used timestamp:', err)
    }
  }

  /**
   * Mark credentials as invalid in database
   */
  private async invalidateCredentials(): Promise<void> {
    try {
      const supabase = await createClient()
      await supabase
        .from('linkedin_credentials')
        .update({ is_valid: false })
        .eq('user_id', this.userId)

      this.credentials = null
    } catch (err) {
      console.error('Failed to invalidate credentials:', err)
    }
  }

  /**
   * Check if client has valid credentials loaded
   * @returns Whether credentials are available
   */
  hasCredentials(): boolean {
    return this.credentials !== null && this.credentials.is_valid
  }

  /**
   * Get current user ID
   * @returns User ID
   */
  getUserId(): string {
    return this.userId
  }
}

/**
 * Create a VoyagerClient instance for a user
 * @param userId - Supabase user ID
 * @returns Promise resolving to initialized VoyagerClient
 * @example
 * const client = await createVoyagerClient(userId)
 * const response = await client.request({ method: 'GET', endpoint: '/me' })
 */
export async function createVoyagerClient(userId: string): Promise<VoyagerClient> {
  const client = new VoyagerClient(userId)
  await client.loadCredentials()
  return client
}
