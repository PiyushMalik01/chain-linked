'use client'

/**
 * Follow Influencer Dialog Component
 * @description Modal dialog for following a new LinkedIn influencer by URL.
 * Validates the URL format and shows loading/error states.
 * @module components/features/follow-influencer-dialog
 */

import * as React from 'react'
import { IconUserPlus, IconBrandLinkedin, IconLoader2 } from '@tabler/icons-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Props for the FollowInfluencerDialog component
 */
export interface FollowInfluencerDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /**
   * Callback fired when form is submitted with a valid URL.
   * @param url - Validated LinkedIn profile URL
   */
  onFollow: (url: string) => Promise<void>
}

/**
 * Dialog component for following a new LinkedIn influencer by entering their profile URL.
 * Validates that the URL contains linkedin.com/in/ before submitting.
 *
 * @example
 * <FollowInfluencerDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onFollow={async (url) => { await followInfluencer(url) }}
 * />
 */
export function FollowInfluencerDialog({
  open,
  onOpenChange,
  onFollow,
}: FollowInfluencerDialogProps) {
  const [url, setUrl] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)

  /** Reset state when dialog closes */
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setUrl('')
      setValidationError(null)
      setIsSubmitting(false)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  /**
   * Validates the URL client-side before calling onFollow.
   */
  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = url.trim()

    if (!trimmed) {
      setValidationError('Please enter a LinkedIn profile URL.')
      return
    }

    if (!trimmed.includes('linkedin.com/in/')) {
      setValidationError('URL must be a LinkedIn profile (e.g. linkedin.com/in/username).')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)

    try {
      await onFollow(trimmed)
      handleOpenChange(false)
    } catch {
      // Errors are handled in the hook via toast
    } finally {
      setIsSubmitting(false)
    }
  }, [url, onFollow, handleOpenChange])

  /** Clear validation error on input change */
  const handleUrlChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    if (validationError) setValidationError(null)
  }, [validationError])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <IconUserPlus className="size-4 text-primary" />
            </div>
            <DialogTitle>Follow Influencer</DialogTitle>
          </div>
          <DialogDescription>
            Enter a LinkedIn profile URL to start tracking posts from this influencer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
            <div className="relative">
              <IconBrandLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="linkedin-url"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={url}
                onChange={handleUrlChange}
                className="pl-9"
                disabled={isSubmitting}
                autoFocus
                aria-describedby={validationError ? 'url-error' : undefined}
                aria-invalid={!!validationError}
              />
            </div>
            {validationError && (
              <p id="url-error" className="text-xs text-destructive" role="alert">
                {validationError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Example: https://www.linkedin.com/in/satyanadella
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !url.trim()} className="gap-2">
              {isSubmitting ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Following...
                </>
              ) : (
                <>
                  <IconUserPlus className="size-4" />
                  Follow
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
