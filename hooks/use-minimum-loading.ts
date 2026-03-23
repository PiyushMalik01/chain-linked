"use client"

/**
 * Minimum Loading Hook
 * @description Ensures a minimum loading duration for polished UX transitions
 * @module hooks/use-minimum-loading
 */

import { useState, useEffect, useRef } from "react"

/**
 * Hook that ensures a minimum loading time is displayed.
 * Even if data loads instantly, the loading state will persist for the minimum duration.
 * This creates a polished, consistent loading experience.
 *
 * @param minimumMs - Minimum time to show loading state (default: 1000ms)
 * @returns Object with isLoading state and setReady function
 *
 * @example
 * ```tsx
 * const { isLoading, setReady } = useMinimumLoading(1000)
 *
 * useEffect(() => {
 *   fetchData().then(() => setReady())
 * }, [])
 *
 * if (isLoading) return <Skeleton />
 * return <Content />
 * ```
 */
export function useMinimumLoading(minimumMs: number = 1000) {
  const [isLoading, setIsLoading] = useState(true)
  const timerCompleteRef = useRef(false)
  const dataReadyRef = useRef(false)

  // Start the minimum timer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      timerCompleteRef.current = true
      // Only stop loading if data is also ready
      if (dataReadyRef.current) {
        setIsLoading(false)
      }
    }, minimumMs)

    return () => clearTimeout(timer)
  }, [minimumMs])

  const setReady = () => {
    dataReadyRef.current = true
    // Only stop loading if timer is also complete
    if (timerCompleteRef.current) {
      setIsLoading(false)
    }
  }

  return { isLoading, setReady }
}

/**
 * Simpler hook for pages that don't fetch data but still want the loading effect.
 * Shows loading for exactly the specified duration.
 *
 * @param durationMs - Duration to show loading state (default: 1000ms)
 * @returns boolean indicating if still loading
 */
export function usePageLoading(durationMs: number = 1000) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs])

  return isLoading
}
