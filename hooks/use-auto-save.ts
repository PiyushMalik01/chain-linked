"use client"

/**
 * Auto-Save Hook
 * @description Debounced auto-save with real persistence feedback
 * @module hooks/use-auto-save
 */

import * as React from "react"

/**
 * Callback type for the actual save operation
 * @returns Promise that resolves to true if save succeeded, false otherwise
 */
type SaveFn = () => Promise<boolean>

/**
 * Hook to provide auto-save functionality with real persistence feedback.
 * Debounces value changes and invokes a save callback, reporting actual success/failure.
 *
 * @param value - The value to monitor for changes
 * @param saveFn - Async function that performs the actual save. Must return true on success.
 * @param delay - Debounce delay in milliseconds (default: 1500ms)
 * @returns Object with isSaving status, lastSaved timestamp, and hasChanges flag
 *
 * @example
 * ```tsx
 * const { isSaving, lastSaved } = useAutoSave(
 *   content,
 *   async () => {
 *     const res = await fetch('/api/drafts/auto-save', { method: 'POST', body: ... })
 *     return res.ok
 *   },
 *   2000
 * )
 *
 * return (
 *   <div>
 *     {isSaving ? "Saving..." : lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : null}
 *   </div>
 * )
 * ```
 */
export function useAutoSave(value: unknown, saveFn?: SaveFn | null, delay: number = 1500) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saveError, setSaveError] = React.useState(false)
  const previousValueRef = React.useRef<unknown>(value)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef = React.useRef(saveFn)

  // Keep saveFn ref up to date without triggering effect re-runs
  React.useEffect(() => {
    saveFnRef.current = saveFn
  }, [saveFn])

  React.useEffect(() => {
    // Check if value has changed
    const valueStr = JSON.stringify(value)
    const prevValueStr = JSON.stringify(previousValueRef.current)

    if (valueStr !== prevValueStr) {
      setHasChanges(true)
      setSaveError(false)

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounce: wait for user to stop typing, then perform the actual save
      timeoutRef.current = setTimeout(async () => {
        if (saveFnRef.current) {
          setIsSaving(true)
          try {
            const success = await saveFnRef.current()
            if (success) {
              setLastSaved(new Date())
              setHasChanges(false)
              setSaveError(false)
            } else {
              setSaveError(true)
            }
          } catch {
            setSaveError(true)
          } finally {
            setIsSaving(false)
          }
        } else {
          // No save function provided — act as a change indicator only
          setLastSaved(new Date())
          setHasChanges(false)
        }
      }, delay)

      previousValueRef.current = value
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])

  return { isSaving, lastSaved, hasChanges, saveError }
}

/**
 * Format a relative time string for display
 * @param date - The date to format
 * @returns A human-readable relative time string
 */
export function formatLastSaved(date: Date | null): string {
  if (!date) return ""

  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 5000) {
    return "Just now"
  }
  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000)
    return `${seconds}s ago`
  }
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
