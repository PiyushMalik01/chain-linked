'use client'

/**
 * React hook for managing OpenAI ChatGPT connection state.
 *
 * Provides methods to connect via device code OAuth flow or manual API key,
 * check connection status, and disconnect.
 *
 * @module hooks/use-openai-connection
 * @example
 * const { status, startDeviceFlow, disconnect, saveApiKey } = useOpenAIConnection()
 */

import { useState, useCallback, useEffect, useRef } from 'react'

/** Connection status returned by the status endpoint. */
interface ConnectionStatus {
  connected: boolean
  method?: string
  email?: string
  planType?: string
}

/** Device flow state while waiting for user authorization. */
interface DeviceFlowState {
  userCode: string
  verificationUrl: string
  expiresIn: number
  interval: number
}

/** Return type of the useOpenAIConnection hook. */
interface UseOpenAIConnectionReturn {
  /** Current connection status. */
  status: ConnectionStatus | null
  /** Whether the status is being loaded. */
  loading: boolean
  /** Whether a device flow is in progress. */
  isPolling: boolean
  /** Device flow data (user code, verification URL) when active. */
  deviceFlow: DeviceFlowState | null
  /** Error message, if any. */
  error: string | null
  /** Fetch the current connection status from the server. */
  fetchStatus: () => Promise<void>
  /** Start the device code OAuth flow. */
  startDeviceFlow: () => Promise<void>
  /** Save a manual API key. */
  saveApiKey: (apiKey: string) => Promise<void>
  /** Disconnect the OpenAI account. */
  disconnect: () => Promise<void>
}

/**
 * Hook for managing the OpenAI/ChatGPT connection lifecycle.
 *
 * Handles device code flow polling, manual API key entry, status checks,
 * and disconnection. Automatically cleans up polling intervals on unmount.
 *
 * @returns Connection state and action methods.
 */
export function useOpenAIConnection(): UseOpenAIConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Stop the polling interval and reset device flow state.
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  /**
   * Fetch the current connection status from the server.
   */
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/auth/openai/status')
      if (!res.ok) {
        throw new Error('Failed to fetch connection status')
      }
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Start the device code OAuth flow and begin polling for authorization.
   */
  const startDeviceFlow = useCallback(async () => {
    try {
      setError(null)
      stopPolling()

      const res = await fetch('/api/auth/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'device-code' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start device flow')
      }

      const data: DeviceFlowState = await res.json()
      setDeviceFlow(data)
      setIsPolling(true)

      // Start polling at the specified interval
      const pollMs = (data.interval || 5) * 1000
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/auth/openai/poll', {
            method: 'POST',
          })

          if (!pollRes.ok) {
            const pollData = await pollRes.json()
            // 404 means no session - stop polling
            if (pollRes.status === 404) {
              stopPolling()
              setDeviceFlow(null)
              setError(pollData.error || 'Device session not found')
              return
            }
            return
          }

          const pollData = await pollRes.json()

          if (pollData.status === 'authorized') {
            stopPolling()
            setDeviceFlow(null)
            setStatus({
              connected: true,
              method: 'oauth-device',
              email: pollData.email,
              planType: pollData.planType,
            })
          } else if (pollData.status === 'expired') {
            stopPolling()
            setDeviceFlow(null)
            setError('Device code expired. Please try again.')
          }
          // 'pending' continues polling
        } catch {
          // Polling errors are non-fatal, will retry on next interval
        }
      }, pollMs)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start device flow'
      )
    }
  }, [stopPolling])

  /**
   * Save a manual API key.
   *
   * @param apiKey - The OpenAI API key to validate and store.
   */
  const saveApiKey = useCallback(
    async (apiKey: string) => {
      try {
        setError(null)
        stopPolling()
        setDeviceFlow(null)

        const res = await fetch('/api/auth/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to save API key')
        }

        setStatus({
          connected: true,
          method: 'manual',
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save API key'
        )
        throw err
      }
    },
    [stopPolling]
  )

  /**
   * Disconnect the OpenAI account.
   */
  const disconnect = useCallback(async () => {
    try {
      setError(null)
      stopPolling()
      setDeviceFlow(null)

      const res = await fetch('/api/auth/openai/disconnect', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to disconnect')
      }

      setStatus({ connected: false })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to disconnect'
      )
    }
  }, [stopPolling])

  // Fetch status on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  return {
    status,
    loading,
    isPolling,
    deviceFlow,
    error,
    fetchStatus,
    startDeviceFlow,
    saveApiKey,
    disconnect,
  }
}
