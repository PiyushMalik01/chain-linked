"use client"

/**
 * AI Inline Panel Component
 * @description Collapsible inline panel for AI post generation that replaces
 * the modal-based AI generation dialog in the compose section.
 * Provides quick access to topic, tone, and length options without
 * leaving the editor context.
 * @module components/features/ai-inline-panel
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconSparkles,
  IconLoader2,
  IconX,
  IconSettings,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { type PostTypeId } from "@/lib/ai/post-types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { scalePopVariants } from "@/lib/animations"

/**
 * Data structure for generation context captured from the AI inline panel
 */
export interface GenerationContext {
  /** The topic used for generation */
  topic: string
  /** The tone selected for generation */
  tone: string
  /** The length selected for generation */
  length: string
  /** Additional context provided by the user */
  context: string
  /** The post type used for generation */
  postType?: string
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
 * Props for AIInlinePanel component
 */
export interface AIInlinePanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean
  /** Toggle expand/collapse */
  onToggle: () => void
  /** Callback when content is generated */
  onGenerated: (content: string) => void
  /** Whether the user has an API key configured */
  hasApiKey: boolean
  /** Post type derived from goal selector */
  defaultPostType?: PostTypeId
  /** Selected goal label for display */
  selectedGoal?: string
  /** Callback to open the full advanced dialog */
  onAdvancedClick?: () => void
  /** Callback to expose generation context (topic, tone, etc.) when a post is generated */
  onGenerationContext?: (ctx: GenerationContext) => void
  /** Whether to persist topic/context fields after generation (default: false) */
  persistFields?: boolean
  /** Initial topic value (e.g. from template AI suggestion) */
  initialTopic?: string
  /** Initial tone value (e.g. from template AI suggestion) */
  initialTone?: string
  /** Initial length value (e.g. from remix settings) */
  initialLength?: string
  /** Initial context value (e.g. from template AI suggestion) */
  initialContext?: string
  /** Custom label for the topic/prompt field */
  topicLabel?: string
  /** Hidden system context sent to API but not shown in UI */
  systemContext?: string
  /** Increment to reset all fields (topic, tone, length, context) */
  resetKey?: number
}

/**
 * Tone options for inline selection
 */
const TONE_OPTIONS = [
  { value: 'match-my-style', label: 'Match My Style' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'inspiring', label: 'Inspiring' },
  { value: 'educational', label: 'Educational' },
  { value: 'thought-provoking', label: 'Thought-Provoking' },
]

/**
 * Length options for inline selection
 */
const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', emoji: '\u26A1' },
  { value: 'medium', label: 'Medium', emoji: '\uD83D\uDCDD' },
  { value: 'long', label: 'Long', emoji: '\uD83D\uDCDA' },
]

/**
 * Collapsible inline panel for AI post generation.
 *
 * Collapsed state: A dashed-border button with sparkles icon.
 * Expanded state: Inline form with topic, tone, length, and context fields.
 *
 * @param props - Component props
 * @returns AIInlinePanel JSX element
 *
 * @example
 * <AIInlinePanel
 *   isExpanded={showAI}
 *   onToggle={() => setShowAI(v => !v)}
 *   onGenerated={(content) => setContent(content)}
 *   hasApiKey={true}
 * />
 */
export function AIInlinePanel({
  isExpanded,
  onToggle,
  onGenerated,
  hasApiKey,
  defaultPostType,
  selectedGoal,
  onAdvancedClick,
  onGenerationContext,
  persistFields = false,
  initialTopic,
  initialTone,
  initialLength,
  initialContext,
  topicLabel,
  systemContext,
  resetKey,
}: AIInlinePanelProps) {
  const [topic, setTopic] = React.useState(initialTopic ?? '')
  const [tone, setTone] = React.useState(initialTone ?? 'professional')
  const [length, setLength] = React.useState(initialLength ?? 'medium')
  const [context, setContext] = React.useState(initialContext ?? '')

  // Reset all fields when resetKey changes
  React.useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setTopic(initialTopic ?? '')
      setTone(initialTone ?? 'professional')
      setLength(initialLength ?? 'medium')
      setContext(initialContext ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const topicRef = React.useRef<HTMLTextAreaElement>(null)
  const contextRef = React.useRef<HTMLTextAreaElement>(null)

  /** Auto-resize a textarea to fit its content */
  const autoResize = React.useCallback((el: HTMLTextAreaElement | null, minHeight: number) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
  }, [])

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  /**
   * Sync initial values when they change (e.g. template loaded)
   */
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
   * Reset form when panel collapses (unless persistFields is enabled)
   */
  React.useEffect(() => {
    if (!isExpanded && !persistFields) {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
      resetTimerRef.current = setTimeout(() => {
        setTopic('')
        setContext('')
        setError(null)
        resetTimerRef.current = null
      }, 300)
    }
  }, [isExpanded, persistFields])

  /**
   * Handles the generate button click
   */
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a prompt describing your post topic')
      return
    }

    if (!hasApiKey) {
      setError('API key required. Add it in Settings → API Keys.')
      return
    }

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
          context: [systemContext, context.trim()].filter(Boolean).join('\n\n') || undefined,
          postType: defaultPostType || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate post')
      }

      onGenerated(data.content)

      // Expose generation context to parent component (includes AI metadata for tracking)
      if (onGenerationContext) {
        onGenerationContext({
          topic: topic.trim(),
          tone,
          length,
          context: context.trim(),
          postType: defaultPostType || undefined,
          aiMetadata: data.aiMetadata || undefined,
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
    <div className="space-y-0">
      {/* Collapsed trigger */}
      <AnimatePresence mode="wait">
        {!isExpanded && (
          <motion.div
            key="trigger"
            variants={scalePopVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Button
              variant="outline"
              onClick={onToggle}
              className="w-full justify-start gap-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
            >
              <div className="rounded-md bg-primary/10 p-1">
                <IconSparkles className="size-3.5 text-primary" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Generate with AI</span>
                <span className="text-xs text-muted-foreground">
                  Create a post using AI assistance
                </span>
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconSparkles className="size-4 text-primary" />
                  <span className="text-sm font-semibold">AI Generate</span>
                  {selectedGoal && (
                    <span className="text-xs text-muted-foreground">
                      — {selectedGoal}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggle}
                  aria-label="Close AI panel"
                >
                  <IconX className="size-4" />
                </Button>
              </div>

              {/* Topic / Prompt */}
              <div className="space-y-1.5">
                <Label htmlFor="ai-topic" className="text-xs">
                  {topicLabel ?? 'Prompt for the topic'} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  ref={topicRef}
                  id="ai-topic"
                  placeholder="e.g. 'Write a post about lessons from scaling a remote team to 50 people, include a personal story and actionable tips'"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value)
                    if (error) setError(null)
                    autoResize(e.target, 100)
                  }}
                  style={{ overflow: 'hidden' }}
                  className="min-h-[100px] resize-none text-sm"
                  disabled={isGenerating}
                />
              </div>

              {/* Tone */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tone</Label>
                <ToggleGroup
                  type="single"
                  value={tone}
                  onValueChange={(v) => v && setTone(v)}
                  className="flex flex-wrap gap-1"
                  spacing={1}
                >
                  {TONE_OPTIONS.map((opt) => (
                    <ToggleGroupItem
                      key={opt.value}
                      value={opt.value}
                      size="sm"
                      className="text-xs px-2.5 py-1 h-7 rounded-full"
                      disabled={isGenerating}
                    >
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

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

              {/* Context (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="ai-context" className="text-xs text-muted-foreground">
                  Additional Context (optional)
                </Label>
                <Textarea
                  ref={contextRef}
                  id="ai-context"
                  placeholder="e.g. 'Mention my experience at TechCorp, include a stat about remote work'"
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value)
                    autoResize(e.target, 48)
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

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !hasApiKey}
                  size="sm"
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <IconLoader2 className="size-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <IconSparkles className="size-3.5" />
                      Generate Post
                    </>
                  )}
                </Button>

                {onAdvancedClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAdvancedClick}
                    className="text-xs text-muted-foreground gap-1"
                    disabled={isGenerating}
                  >
                    <IconSettings className="size-3" />
                    Advanced...
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
