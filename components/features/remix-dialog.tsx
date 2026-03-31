"use client"

/**
 * Remix Dialog Component
 * @description Modal for remixing posts with AI using user's content style and context.
 * On successful remix, automatically navigates to the Composer with the content loaded.
 * @module components/features/remix-dialog
 */

import * as React from "react"
import {
  IconSparkles,
  IconLoader2,
  IconX,
  IconInfoCircle,
  IconWand,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Settings the user chose when remixing, passed to Composer for pre-filling
 */
export interface RemixSettings {
  /** Tone/style selected */
  tone: string
  /** Length selected */
  length: string
  /** Custom instructions provided */
  customInstructions: string
  /** AI metadata for tracking token usage, model, and cost */
  aiMetadata?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    model: string
    estimated_cost: number
    prompt_snapshot: Record<string, unknown>
  }
}

/**
 * Props for RemixDialog
 */
export interface RemixDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** Original post content to remix */
  originalContent: string
  /** Original post author (for display) */
  originalAuthor?: string
  /** Callback when content is remixed successfully — auto-redirects to Composer */
  onRemixed: (content: string, settings: RemixSettings) => void
  /** Whether user has an API key configured (for showing warning) */
  hasApiKey?: boolean
}

/**
 * Tone options for post remix
 */
const TONE_OPTIONS = [
  {
    value: 'match-my-style',
    label: 'Match My Style',
    description: 'Analyze your posts and match your voice',
    icon: IconWand,
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Authoritative and industry-focused',
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Conversational and relatable',
  },
  {
    value: 'inspiring',
    label: 'Inspiring',
    description: 'Motivational and uplifting',
  },
  {
    value: 'educational',
    label: 'Educational',
    description: 'Informative how-to content',
  },
  {
    value: 'thought-provoking',
    label: 'Thought-Provoking',
    description: 'Challenges conventional thinking',
  },
]

/**
 * Length options for post remix
 */
const LENGTH_OPTIONS = [
  {
    value: 'short',
    label: 'Short',
    description: '400-700 chars',
    emoji: '⚡',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '1200-1800 chars',
    emoji: '📝',
  },
  {
    value: 'long',
    label: 'Long',
    description: '2200-2900 chars',
    emoji: '📚',
  },
]

/**
 * Remix Dialog for transforming posts with AI.
 * On successful generation, automatically calls onRemixed and navigates to Composer.
 *
 * @example
 * ```tsx
 * <RemixDialog
 *   isOpen={showRemix}
 *   onClose={() => setShowRemix(false)}
 *   originalContent={selectedPost}
 *   onRemixed={(content) => {
 *     loadForRemix(postId, content)
 *     router.push('/dashboard/compose')
 *   }}
 *   hasApiKey={hasApiKey}
 * />
 * ```
 */
export function RemixDialog({
  isOpen,
  onClose,
  originalContent,
  originalAuthor,
  onRemixed,
  hasApiKey = true,
}: RemixDialogProps) {
  const [tone, setTone] = React.useState('match-my-style')
  const [length, setLength] = React.useState<'short' | 'medium' | 'long'>('medium')
  const [customInstructions, setCustomInstructions] = React.useState('')
  const [isRemixing, setIsRemixing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  /**
   * Resets form when dialog closes
   */
  React.useEffect(() => {
    if (!isOpen) {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
      resetTimerRef.current = setTimeout(() => {
        setCustomInstructions('')
        setError(null)
        resetTimerRef.current = null
      }, 300)
    }
  }, [isOpen])

  /**
   * Handles the remix button click.
   * On success, auto-redirects by calling onRemixed + onClose immediately.
   */
  const handleRemix = async () => {
    if (!originalContent.trim()) {
      setError('No content to remix')
      return
    }

    setIsRemixing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          originalContent: originalContent.trim(),
          tone,
          length,
          customInstructions: customInstructions.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remix post')
      }

      // Auto-redirect: load content into Composer with settings (includes AI metadata)
      onRemixed(data.content, { tone, length, customInstructions: customInstructions.trim(), aiMetadata: data.aiMetadata || undefined })
      onClose()
    } catch (err) {
      console.error('Remix error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to remix post.'
      if (msg.includes('API key') || msg.includes('api_key') || msg.includes('Invalid')) {
        setError('AI service unavailable. Please check your API key in Settings or try again later.')
      } else {
        setError(msg)
      }
      setIsRemixing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-hidden !flex !flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="size-5 text-primary" />
            Remix Post with AI
          </DialogTitle>
          <DialogDescription>
            Transform this post into your own voice. You&apos;ll be taken to the Composer to edit and publish.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-4 pb-4">
            {/* Original Post Preview */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                Original Post
                {originalAuthor && (
                  <span className="normal-case text-foreground font-medium">
                    by {originalAuthor}
                  </span>
                )}
              </Label>
              <div className="bg-muted/50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto border">
                <p className="whitespace-pre-wrap leading-relaxed">{originalContent}</p>
              </div>
            </div>

            {/* Tone Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="tone" className="flex items-center gap-1.5">
                Remix Style
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconInfoCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      &ldquo;Match My Style&rdquo; analyzes your previous posts to match your unique voice
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select value={tone} onValueChange={setTone} disabled={isRemixing}>
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1.5">
                          {option.icon && <option.icon className="size-3.5" />}
                          {option.label}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Length Selection */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">Post Length</Label>
              <div className="grid grid-cols-3 gap-2">
                {LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLength(option.value as 'short' | 'medium' | 'long')}
                    disabled={isRemixing}
                    className={cn(
                      'border-input bg-background ring-offset-background flex flex-col items-center gap-0.5 rounded-lg border p-2.5 text-center transition-all',
                      'hover:border-primary hover:bg-accent',
                      'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      'disabled:pointer-events-none disabled:opacity-50',
                      length === option.value &&
                        'border-primary bg-primary/5 ring-primary ring-1'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-base">{option.emoji}</span>
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-1.5">
              <Label htmlFor="instructions" className="flex items-center gap-1.5">
                Custom Instructions
                <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Textarea
                id="instructions"
                placeholder="e.g., 'Add a personal story' or 'Focus on actionable takeaways'"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="min-h-[60px] resize-none"
                disabled={isRemixing}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border border-destructive/20 p-3 text-sm">
                <IconX className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* No API Key Warning */}
            {!hasApiKey && !error && (
              <div className="bg-primary/10 text-primary flex items-start gap-2 rounded-lg border border-primary/20 p-3 text-sm">
                <IconInfoCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  You need to add your OpenAI API key in{' '}
                  <strong>Settings → API Keys</strong> to use AI remix.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isRemixing}>
            Cancel
          </Button>
          <Button onClick={handleRemix} disabled={isRemixing || !hasApiKey}>
            {isRemixing ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Remixing...
              </>
            ) : (
              <>
                <IconSparkles className="size-4" />
                Remix &amp; Compose
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
