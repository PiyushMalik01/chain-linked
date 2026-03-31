"use client"

/**
 * Compose Basic Mode
 * @description Simplified one-shot post generation panel. Provides tone, length,
 * topic, and additional context fields with a Generate button.
 * Calls POST /api/ai/generate for generation.
 * @module components/features/compose/compose-basic-mode
 */

import * as React from "react"
import { IconSparkles, IconLoader2, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ComposeToneSelector } from "./compose-tone-selector"
import type { PostTypeId } from "@/lib/ai/post-types"

/**
 * Length options for inline selection
 */
const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', emoji: '\u26A1' },
  { value: 'medium', label: 'Medium', emoji: '\uD83D\uDCDD' },
  { value: 'long', label: 'Long', emoji: '\uD83D\uDCDA' },
]

/**
 * Generation context exposed to the parent
 */
export interface BasicModeGenerationContext {
  /** Topic used for generation */
  topic: string
  /** Tone selected */
  tone: string
  /** Length selected */
  length: string
  /** Additional context */
  context: string
  /** Post type */
  postType?: string
}

/**
 * Props for ComposeBasicMode
 */
interface ComposeBasicModeProps {
  /** Callback when content is generated */
  onGenerated: (content: string) => void
  /** Whether the user has an API key configured */
  hasApiKey: boolean
  /** Post type for generation */
  defaultPostType?: PostTypeId
  /** Callback to expose generation context */
  onGenerationContext?: (ctx: BasicModeGenerationContext) => void
  /** Initial topic value */
  initialTopic?: string
  /** Initial tone value */
  initialTone?: string
  /** Initial length value */
  initialLength?: string
  /** Initial context value */
  initialContext?: string
  /** Increment to reset all fields */
  resetKey?: number
}

/**
 * Basic mode panel for one-shot AI post generation.
 * Layout: Tone selector, length toggle, topic textarea, context textarea, generate button.
 * @param props - Component props
 * @returns Basic mode JSX element
 */
export function ComposeBasicMode({
  onGenerated,
  hasApiKey,
  defaultPostType,
  onGenerationContext,
  initialTopic,
  initialTone,
  initialLength,
  initialContext,
  resetKey,
}: ComposeBasicModeProps) {
  const STORAGE_KEY = 'chainlinked-compose-basic-fields'

  /** Load persisted fields from localStorage (only if no initial values provided) */
  const loadPersistedFields = React.useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }, [])

  const persisted = React.useMemo(() => loadPersistedFields(), [loadPersistedFields])

  const [topic, setTopic] = React.useState(initialTopic ?? persisted?.topic ?? '')
  const [tone, setTone] = React.useState(initialTone ?? persisted?.tone ?? 'professional')
  const [length, setLength] = React.useState(initialLength ?? persisted?.length ?? 'medium')
  const [context, setContext] = React.useState(initialContext ?? persisted?.context ?? '')
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset all fields when resetKey changes
  React.useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setTopic('')
      setTone('professional')
      setLength('medium')
      setContext('')
      setError(null)
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  /** Persist field values to localStorage on change */
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ topic, tone, length, context }))
    } catch {
      // Silently fail
    }
  }, [topic, tone, length, context])

  /** Sync initial values when they change (e.g. template loaded) */
  React.useEffect(() => {
    if (initialTopic) setTopic(initialTopic)
  }, [initialTopic])

  React.useEffect(() => {
    if (initialTone) setTone(initialTone)
  }, [initialTone])

  React.useEffect(() => {
    if (initialLength) setLength(initialLength)
  }, [initialLength])

  React.useEffect(() => {
    if (initialContext) setContext(initialContext)
  }, [initialContext])

  /**
   * Handles the generate button click
   */
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic for your post')
      return
    }

    // API key check removed — server falls back to OPENROUTER_API_KEY env var
    // if user doesn't have their own key configured

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          tone,
          length,
          context: context.trim() || undefined,
          postType: defaultPostType || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate post')
      }

      onGenerated(data.content)

      if (onGenerationContext) {
        onGenerationContext({
          topic: topic.trim(),
          tone,
          length,
          context: context.trim(),
          postType: defaultPostType || undefined,
        })
      }
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tone */}
      <ComposeToneSelector
        value={tone}
        onValueChange={setTone}
        disabled={isGenerating}
      />

      {/* Length */}
      <div className="space-y-1.5">
        <Label className="text-xs">Length</Label>
        <ToggleGroup
          type="single"
          value={length}
          onValueChange={(v) => v && setLength(v)}
          className="flex gap-1"
          spacing={1}
        >
          {LENGTH_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              size="sm"
              className="text-xs px-3 py-1 h-7 rounded-full"
              disabled={isGenerating}
            >
              {opt.emoji} {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Topic */}
      <div className="space-y-1.5">
        <Label htmlFor="basic-topic" className="text-xs">
          What should the post be about? <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="basic-topic"
          placeholder="e.g. 'Lessons from scaling a remote team to 50 people, include a personal story and actionable tips'"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value)
            if (error) setError(null)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.max(100, e.target.scrollHeight)}px`
          }}
          style={{ overflow: 'hidden' }}
          className="min-h-[100px] resize-none text-sm"
          disabled={isGenerating}
        />
      </div>

      {/* Additional context */}
      <div className="space-y-1.5">
        <Label htmlFor="basic-context" className="text-xs text-muted-foreground">
          Additional instructions (optional)
        </Label>
        <Textarea
          id="basic-context"
          placeholder="e.g. 'Mention my experience at TechCorp, include a stat about remote work'"
          value={context}
          onChange={(e) => {
            setContext(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.max(48, e.target.scrollHeight)}px`
          }}
          style={{ overflow: 'hidden' }}
          className="min-h-[48px] resize-none text-sm"
          disabled={isGenerating}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
          <IconX className="size-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !hasApiKey}
        className="w-full gap-1.5"
      >
        {isGenerating ? (
          <>
            <IconLoader2 className="size-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <IconSparkles className="size-4" />
            Generate Post
          </>
        )}
      </Button>
    </div>
  )
}
