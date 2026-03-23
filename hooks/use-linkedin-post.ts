/**
 * LinkedIn Post Hook
 * @description React hook for posting to LinkedIn and checking connection status
 * @module hooks/use-linkedin-post
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import type { LinkedInVisibility, LinkedInConnectionStatus } from '@/lib/linkedin/types'

/**
 * Post to LinkedIn request options
 */
interface PostToLinkedInOptions {
  content: string
  visibility?: LinkedInVisibility
  mediaUrls?: string[]
  scheduledPostId?: string
}

/**
 * Post to LinkedIn response
 */
interface PostToLinkedInResponse {
  success: boolean
  postId?: string
  linkedinPostUrn?: string
  message?: string
  error?: string
}

/**
 * Hook return type for LinkedIn posting
 */
interface UseLinkedInPostReturn {
  /** Post content to LinkedIn */
  postToLinkedIn: (options: PostToLinkedInOptions) => Promise<PostToLinkedInResponse>
  /** Connect LinkedIn account (initiates OAuth) */
  connectLinkedIn: () => void
  /** Disconnect LinkedIn account */
  disconnectLinkedIn: () => Promise<boolean>
  /** Refresh connection status */
  refreshStatus: () => Promise<void>
  /** Whether a post is currently being submitted */
  isPosting: boolean
  /** Whether the connection status is loading */
  isLoading: boolean
  /** Whether the user has a connected LinkedIn account */
  isConnected: boolean
  /** Current error message if any */
  error: string | null
  /** LinkedIn connection details */
  connectionStatus: LinkedInConnectionStatus | null
}

/**
 * Hook for posting to LinkedIn and managing connection
 * @returns LinkedIn posting functions and state
 * @example
 * const { postToLinkedIn, isPosting, isConnected, error } = useLinkedInPost()
 *
 * // Post to LinkedIn
 * const result = await postToLinkedIn({
 *   content: "Hello LinkedIn!",
 *   visibility: "PUBLIC"
 * })
 *
 * // Connect LinkedIn (redirects to OAuth)
 * connectLinkedIn()
 */
export function useLinkedInPost(): UseLinkedInPostReturn {
  const [isPosting, setIsPosting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<LinkedInConnectionStatus | null>(null)

  /**
   * Fetch LinkedIn connection status
   */
  const fetchConnectionStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/linkedin/status')

      if (!response.ok) {
        if (response.status === 401) {
          setConnectionStatus({ connected: false, expiresAt: null, profileName: null, needsReconnect: false })
          return
        }
        throw new Error('Failed to fetch connection status')
      }

      const status: LinkedInConnectionStatus = await response.json()
      setConnectionStatus(status)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch LinkedIn status:', err)
      setConnectionStatus({ connected: false, expiresAt: null, profileName: null, needsReconnect: false })
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Refresh connection status
   */
  const refreshStatus = useCallback(async () => {
    await fetchConnectionStatus()
  }, [fetchConnectionStatus])

  /**
   * Post content to LinkedIn
   */
  const postToLinkedIn = useCallback(async (
    options: PostToLinkedInOptions
  ): Promise<PostToLinkedInResponse> => {
    try {
      setIsPosting(true)
      setError(null)

      const response = await fetch('/api/linkedin/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.message || data.error || 'Failed to post to LinkedIn'
        setError(errorMessage)
        return {
          success: false,
          error: errorMessage,
        }
      }

      return {
        success: true,
        postId: data.postId,
        linkedinPostUrn: data.linkedinPostUrn,
        message: data.message,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to post to LinkedIn'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsPosting(false)
    }
  }, [])

  /**
   * Initiate LinkedIn OAuth connection
   */
  const connectLinkedIn = useCallback(() => {
    // Redirect to connect endpoint which handles OAuth
    window.location.href = '/api/linkedin/connect'
  }, [])

  /**
   * Disconnect LinkedIn account
   */
  const disconnectLinkedIn = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/linkedin/disconnect', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect LinkedIn')
      }

      setConnectionStatus({ connected: false, expiresAt: null, profileName: null, needsReconnect: false })
      setError(null)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect'
      setError(errorMessage)
      return false
    }
  }, [])

  // Fetch status on mount
  useEffect(() => {
    fetchConnectionStatus()
  }, [fetchConnectionStatus])

  return {
    postToLinkedIn,
    connectLinkedIn,
    disconnectLinkedIn,
    refreshStatus,
    isPosting,
    isLoading,
    isConnected: connectionStatus?.connected ?? false,
    error,
    connectionStatus,
  }
}
