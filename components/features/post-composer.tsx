/**
 * Post Composer Component
 * @description Rich text editor for composing LinkedIn posts with formatting toolbar,
 * AI assistance, emoji picker, media upload, LinkedIn preview, and scheduling support.
 * @module components/features/post-composer
 */

"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconAlertTriangle,
  IconBold,
  IconBrandLinkedin,
  IconCalendar,
  IconCheck,
  IconDeviceFloppy,
  IconFile,
  IconHash,
  IconItalic,
  IconList,
  IconLoader2,
  IconMessageCircle,
  IconMoodSmile,
  IconPencil,
  IconPhoto,
  IconRepeat,
  IconSend,
  IconThumbUp,
  IconWorld,
  IconX,
} from "@tabler/icons-react"

import { trackPostCreated, trackPostScheduled, trackFeatureUsed } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { type PostTypeId } from "@/lib/ai/post-types"
import { type GoalCategory, GOAL_LABELS } from "@/lib/ai/post-types"
import { type UnicodeFontStyle, transformSelection, convertMarkdownToUnicode, stripUnicodeFont, isTextStyled } from "@/lib/unicode-fonts"
import { useDraft } from "@/lib/store/draft-context"
import { toast } from "sonner"
import { postToast, showSuccess } from "@/lib/toast-utils"
import { useAutoSave, formatLastSaved } from "@/hooks/use-auto-save"
import { fadeSlideUpVariants } from "@/lib/animations"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EmojiPicker } from "./emoji-picker"
import { type MediaFile } from "./media-upload"
import { ScheduleModal } from "./schedule-modal"
import { AIGenerationDialog } from "./ai-generation-dialog"
import { AIInlinePanel, type GenerationContext } from "./ai-inline-panel"
import { getSavedHashtags } from "./default-hashtags-editor"
import { PostActionsMenu } from "./post-actions-menu"
import { PostGoalSelector } from "./post-goal-selector"
import { FontPicker } from "./font-picker"
import { MentionPopover, type MentionSuggestion } from "./mention-popover"
import { CarouselDocumentPreview } from "./carousel-document-preview"
import { usePostingConfig } from "@/hooks/use-posting-config"
import { useApiKeys } from "@/hooks/use-api-keys"
import { buildMentionToken, countCharactersWithMentions } from "@/lib/linkedin/mentions"
import { useComposeMode } from "@/hooks/use-compose-mode"
import { useTextSelectionPopup } from "@/hooks/use-text-selection-popup"
import { useConversationPersistence } from "@/hooks/use-conversation-persistence"
import { ComposeModeToggle } from "./compose/compose-mode-toggle"
import { ComposeGradientBackdrop } from "./compose/compose-gradient-backdrop"
import { ComposeBasicMode } from "./compose/compose-basic-mode"
import { ComposeAdvancedMode } from "./compose/compose-advanced-mode"
import { EditWithAIPopup } from "./compose/edit-with-ai-popup"
import { InlineDiffView } from "./compose/inline-diff-view"
import { ErrorBoundary } from "@/components/error-boundary"

/**
 * Props for the PostComposer component
 */
export interface PostComposerProps {
  /** Initial content to populate the editor with */
  initialContent?: string
  /** Callback fired when the "Post Now" button is clicked */
  onPost?: (content: string, mediaFiles?: MediaFile[]) => Promise<unknown>
  /** Callback fired when the "Schedule" button is clicked (after modal confirms) */
  onSchedule?: (content: string) => void
  /** Callback fired when schedule is confirmed with date - used to save to database */
  onScheduleConfirm?: (content: string, scheduledFor: Date, timezone: string) => Promise<void>
  /** Maximum character limit for the post (defaults to 3000 for LinkedIn) */
  maxLength?: number
  /** User profile information for the preview */
  userProfile?: {
    name: string
    headline: string
    avatarUrl?: string
  }
  /** Callback fired when AI generates a post, providing the generation context */
  onGenerationContext?: (ctx: GenerationContext) => void
  /** Initial date to pre-fill in the schedule modal (e.g. from calendar click) */
  initialScheduleDate?: Date
  /** Whether the composer is in edit mode for a scheduled post */
  isEditingScheduledPost?: boolean
  /** Callback to save edits to a scheduled post without re-picking time */
  onSaveEdit?: (content: string) => Promise<void>
}

/** Default LinkedIn character limit */
const DEFAULT_MAX_LENGTH = 3000

/** Default user profile for preview */
const DEFAULT_USER_PROFILE = {
  name: "Your Name",
  headline: "Your Professional Headline",
  avatarUrl: undefined,
}

/**
 * Parses text for preview rendering.
 * Since bold/italic are now Unicode characters (rendered natively),
 * this handles: @mentions, - list items, #hashtags, and line breaks.
 * @param text - The raw text content to parse
 * @returns Parsed text with HTML elements
 */
function parseMarkdownLikeSyntax(text: string): React.ReactNode[] {
  if (!text) return []

  const lines = text.split("\n")
  const elements: React.ReactNode[] = []

  lines.forEach((line, lineIndex) => {
    // Parse mentions and hashtags within a line
    const parseInlineFormatting = (content: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = []
      let remaining = content
      let keyIndex = 0

      while (remaining.length > 0) {
        // Find the next mention or hashtag (whichever comes first)
        const mentionMatch = remaining.match(/@\[([^\]]+)\]\((urn:li:(?:person|organization):[^)]+)\)/)
        const hashtagMatch = remaining.match(/#(\w+)/)

        const mentionIdx = mentionMatch?.index ?? Infinity
        const hashtagIdx = hashtagMatch?.index ?? Infinity

        if (mentionIdx === Infinity && hashtagIdx === Infinity) {
          if (remaining) parts.push(remaining)
          break
        }

        if (mentionIdx <= hashtagIdx && mentionMatch) {
          // Mention comes first
          if (mentionIdx > 0) {
            parts.push(remaining.slice(0, mentionIdx))
          }
          parts.push(
            <span
              key={`mention-${lineIndex}-${keyIndex++}`}
              className="text-[#0A66C2] font-semibold"
            >
              {mentionMatch[1]}
            </span>
          )
          remaining = remaining.slice(mentionIdx + mentionMatch[0].length)
        } else if (hashtagMatch) {
          // Hashtag comes first
          if (hashtagIdx > 0) {
            parts.push(remaining.slice(0, hashtagIdx))
          }
          parts.push(
            <span
              key={`hashtag-${lineIndex}-${keyIndex++}`}
              className="text-primary font-medium"
            >
              #{hashtagMatch[1]}
            </span>
          )
          remaining = remaining.slice(hashtagIdx + hashtagMatch[0].length)
        }
      }

      return parts
    }

    // Check if line is a list item
    if (line.trim().startsWith("- ")) {
      const content = line.trim().slice(2)
      elements.push(
        <div key={`line-${lineIndex}`} className="flex items-start gap-2">
          <span className="text-muted-foreground mt-1.5">*</span>
          <span>{parseInlineFormatting(content)}</span>
        </div>
      )
    } else if (line.trim() === "") {
      elements.push(<br key={`line-${lineIndex}`} />)
    } else {
      elements.push(
        <p key={`line-${lineIndex}`} className="mb-2">
          {parseInlineFormatting(line)}
        </p>
      )
    }
  })

  return elements
}

/**
 * Extracts hashtags from text content
 * @param text - The text to extract hashtags from
 * @returns Array of unique hashtags without the # symbol
 */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g)
  if (!matches) return []
  return [...new Set(matches.map((tag) => tag.slice(1)))]
}

/**
 * A rich text editor for composing LinkedIn posts with AI generation and live preview.
 *
 * Features:
 * - Two-column layout: left = AI generation, right = editable LinkedIn preview
 * - Double-click preview to enter inline edit mode with formatting toolbar
 * - Goal-based post type selection (Tell a Story, Teach, Engage, Visual)
 * - Always-expanded AI generation panel with tone and length controls
 * - Unicode font picker for LinkedIn-compatible text styling
 * - Rich text formatting via markdown-like syntax (bold, italic, lists)
 * - Real-time character counter with code-point-aware LinkedIn limit
 * - Emoji picker, media attachments, scheduling
 * - Framer Motion animations throughout
 *
 * @example
 * ```tsx
 * <PostComposer
 *   onPost={async (content) => await publishToLinkedIn(content)}
 *   onSchedule={(content) => openScheduleDialog(content)}
 * />
 * ```
 */
export function PostComposer({
  initialContent = "",
  onPost,
  onSchedule,
  onScheduleConfirm,
  maxLength = DEFAULT_MAX_LENGTH,
  userProfile = DEFAULT_USER_PROFILE,
  onGenerationContext,
  initialScheduleDate,
  isEditingScheduledPost,
  onSaveEdit,
}: PostComposerProps) {
  const router = useRouter()
  const { isPostingEnabled, disabledMessage } = usePostingConfig()
  const { draft, setContent: setDraftContent, setScheduledFor, clearDraft, updateDraft } = useDraft()
  const { mode: composeMode, setMode: setComposeMode, theme: composeTheme } = useComposeMode()

  const [content, setContent] = React.useState(() => {
    // When editing a scheduled post, always use initialContent (the scheduled post's content)
    if (isEditingScheduledPost && initialContent) return initialContent
    return draft.content || initialContent
  })
  const [isPosting, setIsPosting] = React.useState(false)
  const [isScheduling, setIsScheduling] = React.useState(false)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)
  const [showScheduleModal, setShowScheduleModal] = React.useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false)
  const [showAIDialog, setShowAIDialog] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(!!isEditingScheduledPost)
  const [aiResetKey, setAiResetKey] = React.useState(0)
  const [mediaFiles, setMediaFiles] = React.useState<MediaFile[]>(() => {
    // Restore media from draft context if available (for tab switch persistence)
    if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      return draft.mediaFiles.map((m) => ({
        id: m.id,
        file: new File([], m.name, { type: m.type }),
        type: (m.type.startsWith('image/') ? 'image' : m.type.startsWith('video/') ? 'video' : 'document') as 'image' | 'video' | 'document',
        previewUrl: m.previewUrl,
        uploadProgress: 100,
        status: 'complete' as const,
      }))
    }
    return []
  })
  const { status: apiKeyStatus } = useApiKeys()
  const hasApiKey = apiKeyStatus?.hasKey ?? false
  const [selectedGoal, setSelectedGoal] = React.useState<GoalCategory | undefined>(undefined)
  const [selectedFormat, setSelectedFormat] = React.useState<PostTypeId | undefined>(undefined)
  const [activeFontStyle, setActiveFontStyle] = React.useState<UnicodeFontStyle>('normal')
  const [carouselSlideImages, setCarouselSlideImages] = React.useState<string[]>([])
  const [savedHashtags, setSavedHashtags] = React.useState<string[]>([])

  /** Track the latest AI generation context for auto-save metadata */
  const generationContextRef = React.useRef<GenerationContext | null>(null)

  /**
   * Wraps the parent onGenerationContext callback to also store the context locally
   * so the debounced auto-save can include AI metadata in draft persistence.
   */
  const handleGenerationContext = React.useCallback((ctx: GenerationContext) => {
    generationContextRef.current = ctx
    onGenerationContext?.(ctx)
  }, [onGenerationContext])

  /** Load user's saved default hashtags from localStorage on mount */
  React.useEffect(() => {
    setSavedHashtags(getSavedHashtags())
  }, [])

  const [mentionOpen, setMentionOpen] = React.useState(false)
  const [mentionQuery, setMentionQuery] = React.useState("")
  const [mentionPosition, setMentionPosition] = React.useState({ top: 0, left: 0 })
  const mentionStartRef = React.useRef<number>(-1)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const editingZoneRef = React.useRef<HTMLDivElement>(null)
  const cursorPositionRef = React.useRef({ start: 0, end: 0 })
  /** Pending scroll + selection restore after formatting state updates */
  const pendingScrollRestore = React.useRef<{
    scrollTop: number
    selectionStart: number
    selectionEnd: number
  } | null>(null)

  // Restore scroll position and selection after React re-renders from formatting operations.
  // useLayoutEffect fires synchronously after DOM mutations but before browser paint,
  // ensuring scroll position is restored before the user sees any jump.
  React.useLayoutEffect(() => {
    const pending = pendingScrollRestore.current
    if (!pending) return
    pendingScrollRestore.current = null

    const textarea = textareaRef.current
    if (textarea) {
      textarea.scrollTop = pending.scrollTop
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(pending.selectionStart, pending.selectionEnd)
      textarea.scrollTop = pending.scrollTop
    }
  })

  // Capture AI suggestion from draft (set by template library) and clear after consuming
  const [aiSuggestion] = React.useState(() => draft.aiSuggestion)
  // Capture remix metadata from draft (set by discover/swipe remix) and clear after consuming
  const [remixMeta] = React.useState(() => draft.remixMeta)
  const [showRemixBanner, setShowRemixBanner] = React.useState(() => !!draft.remixMeta)
  React.useEffect(() => {
    if (draft.aiSuggestion) {
      updateDraft({ aiSuggestion: undefined })
    }
    if (draft.remixMeta) {
      updateDraft({ remixMeta: undefined })
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Edit with AI popup state
  const selectionPopup = useTextSelectionPopup(textareaRef, content, isEditing)
  const [isEditingWithAI, setIsEditingWithAI] = React.useState(false)
  const [pendingSuggestion, setPendingSuggestion] = React.useState<{
    suggestion: string
    selectionStart: number
    selectionEnd: number
  } | null>(null)

  // Conversation persistence for advanced mode
  const {
    persistedMessages,
    conversationId: persistedConvoId,
    saveMessages: saveConvoMessages,
    clearConversation: clearConvo,
    isLoading: convoLoading,
  } = useConversationPersistence('advanced')

  // Save Draft button state
  const [isSavingDraft, setIsSavingDraft] = React.useState(false)
  const [draftSaved, setDraftSaved] = React.useState(false)

  // Auto-save: debounce content changes and persist to /api/drafts/auto-save
  const savedDraftIdRef = React.useRef(draft.savedDraftId)
  React.useEffect(() => { savedDraftIdRef.current = draft.savedDraftId }, [draft.savedDraftId])

  const autoSaveFn = React.useCallback(async (): Promise<boolean> => {
    const trimmed = content.trim()
    if (!trimmed) return false
    try {
      const ctx = generationContextRef.current
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length
      const res = await fetch('/api/drafts/auto-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          postType: ctx?.postType || 'general',
          topic: ctx?.topic || null,
          tone: ctx?.tone || null,
          context: ctx?.context || null,
          wordCount,
          draftId: savedDraftIdRef.current || undefined,
          aiMetadata: ctx?.aiMetadata || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.id) {
          savedDraftIdRef.current = data.id
          updateDraft({ savedDraftId: data.id })
        }
        return true
      }
      const errData = await res.json().catch(() => null)
      console.warn('[AutoSave] Failed:', res.status, errData?.error || 'Unknown error')
      if (res.status === 500 && savedDraftIdRef.current) {
        savedDraftIdRef.current = undefined
        updateDraft({ savedDraftId: undefined })
      }
      return false
    } catch (err) {
      console.warn('[AutoSave] Network error:', err)
      return false
    }
  }, [content, updateDraft])

  // Disable auto-save when editing a scheduled post (uses its own save flow via onSaveEdit)
  const { lastSaved, saveError } = useAutoSave(
    content,
    isEditingScheduledPost ? null : autoSaveFn,
    2000
  )

  // Show save status as toast — keeps the card UI clean
  const prevSaveErrorRef = React.useRef(false)
  const prevLastSavedRef = React.useRef<Date | null>(null)
  React.useEffect(() => {
    if (saveError && !prevSaveErrorRef.current) {
      toast.error("Auto-save failed", { description: "Your content is safe. Will retry on next change.", duration: 3000 })
    }
    prevSaveErrorRef.current = saveError
  }, [saveError])
  React.useEffect(() => {
    if (lastSaved && lastSaved !== prevLastSavedRef.current && prevSaveErrorRef.current) {
      toast.success("Draft saved", { duration: 2000 })
    }
    prevLastSavedRef.current = lastSaved
  }, [lastSaved])

  // Click-outside detection for edit mode
  React.useEffect(() => {
    if (!isEditing) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      // Don't exit if clicking inside any Radix popover/portal (FontPicker, EmojiPicker)
      // or inside the mention popover
      if (
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('[data-radix-menu-content]') ||
        target.closest('[role="dialog"]')
      ) return
      // Don't exit if clicking buttons/actions inside the same card (Save Draft, Schedule, etc.)
      if (target.closest('button') || target.closest('[role="button"]')) return
      if (editingZoneRef.current && !editingZoneRef.current.contains(target)) {
        setMentionOpen(false)
        setIsEditing(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Don't close edit mode if a popover/dialog is open — let it handle Escape first
      if (e.key === 'Escape') {
        const hasOpenPopover = document.querySelector(
          '[data-radix-popper-content-wrapper], [data-radix-menu-content], [role="dialog"][data-state="open"]'
        )
        if (hasOpenPopover) return
        setIsEditing(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEditing])

  // Auto-resize textarea when in edit mode
  React.useEffect(() => {
    if (!isEditing) return
    const textarea = textareaRef.current
    if (!textarea) return

    function resize() {
      if (!textarea) return
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }

    resize()
    textarea.addEventListener('input', resize)
    return () => {
      textarea.removeEventListener('input', resize)
    }
  }, [isEditing, content])

  // Sync media files to draft context for persistence across tab switches
  React.useEffect(() => {
    if (mediaFiles.length > 0) {
      const draftMedia = mediaFiles.map((f) => ({
        id: f.id,
        name: f.file.name,
        type: f.file.type || (f.type === 'image' ? 'image/png' : f.type === 'document' ? 'application/pdf' : 'video/mp4'),
        size: f.file.size,
        previewUrl: f.previewUrl,
      }))
      updateDraft({ mediaFiles: draftMedia })
    } else if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      updateDraft({ mediaFiles: [] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFiles])

  // Focus textarea when entering edit mode
  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Sync content with draft context (when loaded from template, remix, or saved draft).
  // Skip when editing a scheduled post — initialContent is the source of truth.
  // We include draft._loadId so that loading a new draft always triggers a sync,
  // even if the content string is identical to the current local state.
  // We intentionally exclude 'content' from deps to prevent infinite loops.
  React.useEffect(() => {
    if (isEditingScheduledPost) return
    if (draft.content !== undefined && draft.content !== content) {
      setContent(draft.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.content, draft._loadId])

  // Track media files in a ref for cleanup on unmount
  const mediaFilesRef = React.useRef<MediaFile[]>(mediaFiles)
  React.useEffect(() => {
    mediaFilesRef.current = mediaFiles
  }, [mediaFiles])

  // Revoke all media object URLs on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      mediaFilesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl))
    }
  }, [])

  /**
   * Saves the current textarea cursor position to cursorPositionRef.
   * Called on select/click/keyup so we always have the latest position,
   * even after focus moves to a popover.
   */
  const saveCursorPosition = () => {
    const textarea = textareaRef.current
    if (textarea) {
      cursorPositionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      }
    }
  }

  /**
   * Memoized callback for passing messages to conversation persistence (advanced mode)
   */
  const handleAdvancedMessagesChange = React.useCallback(
    (msgs: import("ai").UIMessage[]) => {
      saveConvoMessages(msgs as unknown as Array<{ id: string; role: string; parts: Array<{ type: string; text?: string; [key: string]: unknown }> }>)
    },
    [saveConvoMessages]
  )

  /**
   * Detect @mention trigger in the textarea.
   * Called on every content change and cursor move while editing.
   * Opens the mention popover when "@" is typed, closes when the trigger disappears.
   */
  const detectMention = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBefore = textarea.value.slice(0, cursorPos)

    // Find the last @ that isn't part of an existing mention token
    const lastAt = textBefore.lastIndexOf('@')
    if (lastAt === -1) {
      setMentionOpen(false)
      return
    }

    // Check that this @ is not inside an existing @[Name](urn) token
    const afterAt = textarea.value.slice(lastAt)
    const existingMentionCheck = /^@\[[^\]]*\]\([^)]*\)/.test(afterAt)
    if (existingMentionCheck) {
      setMentionOpen(false)
      return
    }

    // The character before @ should be start of text, whitespace, or newline
    const charBefore = lastAt > 0 ? textBefore[lastAt - 1] : ' '
    if (!/[\s\n]/.test(charBefore) && lastAt !== 0) {
      setMentionOpen(false)
      return
    }

    // Extract the query (text between @ and cursor)
    const query = textBefore.slice(lastAt + 1)

    // If query contains whitespace beyond one word split (allow "John Sm" but not newlines)
    if (query.includes('\n')) {
      setMentionOpen(false)
      return
    }

    mentionStartRef.current = lastAt

    // Calculate popover position relative to textarea
    const lineHeight = 24
    const charWidth = 8
    const textBeforeAt = textBefore.slice(0, lastAt)
    const lines = textBeforeAt.split('\n')
    const currentLine = lines.length - 1
    const col = lines[lines.length - 1].length

    setMentionPosition({
      top: (currentLine + 1) * lineHeight + 4,
      left: Math.min(col * charWidth, 250),
    })
    setMentionQuery(query)
    setMentionOpen(true)
  }, [])

  /**
   * Handle selecting a mention suggestion.
   * Replaces the @query text with a mention token.
   */
  const handleMentionSelect = React.useCallback(
    (suggestion: MentionSuggestion) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = mentionStartRef.current
      if (start === -1) return

      const cursorPos = textarea.selectionStart
      const token = buildMentionToken(suggestion.name, suggestion.urn)

      // Replace @query with the mention token
      const before = content.slice(0, start)
      const after = content.slice(cursorPos)
      const newContent = before + token + ' ' + after
      setContent(newContent)
      setDraftContent(newContent)

      // Close popover
      setMentionOpen(false)
      mentionStartRef.current = -1

      // Set cursor after the inserted token
      const newCursorPos = start + token.length + 1
      cursorPositionRef.current = { start: newCursorPos, end: newCursorPos }

      setTimeout(() => {
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    },
    [content, setDraftContent]
  )

  // Undo history for Ctrl+Z support
  const undoStackRef = React.useRef<{ text: string; cursorStart: number; cursorEnd: number }[]>([])
  const isUndoingRef = React.useRef(false)

  // Update draft when content changes
  const handleContentChange = (newContent: string) => {
    // Push to undo stack (unless this change is from an undo operation)
    if (!isUndoingRef.current) {
      undoStackRef.current.push({
        text: content,
        cursorStart: cursorPositionRef.current.start,
        cursorEnd: cursorPositionRef.current.end,
      })
      // Cap undo stack at 50 entries
      if (undoStackRef.current.length > 50) {
        undoStackRef.current.shift()
      }
    }
    setContent(newContent)
    setDraftContent(newContent)
  }

  /**
   * Handles keyboard shortcuts and auto-list creation in the textarea.
   * - Ctrl/Cmd + B: Toggle bold
   * - Ctrl/Cmd + I: Toggle italic
   * - Ctrl/Cmd + Z: Undo last change
   * - Enter after a "- " list item: auto-create next list item
   */
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMod = e.metaKey || e.ctrlKey

    // Ctrl/Cmd + B: Bold
    if (isMod && e.key === 'b') {
      e.preventDefault()
      saveCursorPosition()
      applyUnicodeFont('bold')
      return
    }

    // Ctrl/Cmd + I: Italic
    if (isMod && e.key === 'i') {
      e.preventDefault()
      saveCursorPosition()
      applyUnicodeFont('italic')
      return
    }

    // Ctrl/Cmd + Z: Undo
    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      const stack = undoStackRef.current
      if (stack.length === 0) return
      const prev = stack.pop()!
      isUndoingRef.current = true
      setContent(prev.text)
      setDraftContent(prev.text)
      isUndoingRef.current = false
      cursorPositionRef.current = { start: prev.cursorStart, end: prev.cursorEnd }
      setTimeout(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(prev.cursorStart, prev.cursorEnd)
        }
      }, 0)
      return
    }

    // Enter: Auto-create list item when previous line starts with "- "
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
      const textarea = e.currentTarget
      const cursorPos = textarea.selectionStart
      const textBefore = content.slice(0, cursorPos)
      const lastNewline = textBefore.lastIndexOf('\n')
      const currentLine = textBefore.slice(lastNewline + 1)

      if (currentLine.trimStart().startsWith('- ')) {
        // If the line is just "- " with nothing after, remove the bullet and add a blank line
        const lineContent = currentLine.trimStart().slice(2)
        if (lineContent.trim() === '') {
          e.preventDefault()
          const lineStart = lastNewline + 1
          const newContent = content.slice(0, lineStart) + '\n' + content.slice(cursorPos)
          handleContentChange(newContent)
          const newPos = lineStart + 1
          cursorPositionRef.current = { start: newPos, end: newPos }
          setTimeout(() => {
            textareaRef.current?.setSelectionRange(newPos, newPos)
          }, 0)
        } else {
          // Continue the list with a new "- "
          e.preventDefault()
          const indent = currentLine.match(/^(\s*)/)?.[1] ?? ''
          const insertion = '\n' + indent + '- '
          const newContent = content.slice(0, cursorPos) + insertion + content.slice(cursorPos)
          handleContentChange(newContent)
          const newPos = cursorPos + insertion.length
          cursorPositionRef.current = { start: newPos, end: newPos }
          setTimeout(() => {
            textareaRef.current?.setSelectionRange(newPos, newPos)
          }, 0)
        }
      }
    }
  }

  // Code-point-aware character counting (mention tokens count as display name only)
  const characterCount = countCharactersWithMentions(content)
  const isOverLimit = characterCount > maxLength
  const hashtags = extractHashtags(content)
  const characterPercentage = Math.min((characterCount / maxLength) * 100, 100)

  /**
   * Applies a Unicode font style to the selected text, or sets it for future typing.
   * Supports toggle: if the selection is already in the target style, it strips back to normal.
   * Uses cursorPositionRef so it works reliably even if focus has shifted.
   */
  const applyUnicodeFont = (style: UnicodeFontStyle) => {
    const { start, end } = cursorPositionRef.current
    if (start === end) {
      // No selection — toggle for future typing
      setActiveFontStyle((prev) => prev === style ? 'normal' : style)
      return
    }

    const selectedText = content.slice(start, end)
    const alreadyStyled = isTextStyled(selectedText, style)

    // Toggle: if already styled, strip back to normal; otherwise apply the style
    const targetStyle = alreadyStyled ? 'normal' : style
    const result = transformSelection(content, start, end, targetStyle)

    // Schedule scroll + selection restore for after React re-renders
    pendingScrollRestore.current = {
      scrollTop: textareaRef.current?.scrollTop ?? 0,
      selectionStart: start,
      selectionEnd: result.newEnd,
    }

    handleContentChange(result.text)
    setActiveFontStyle(targetStyle)
    cursorPositionRef.current = { start, end: result.newEnd }
  }

  /**
   * Handles the Post Now / Save as Draft button click
   */
  const handlePost = async () => {
    if (!onPost || isOverLimit || !content.trim()) return

    // Validate media: LinkedIn doesn't support mixing images and documents in one post
    if (mediaFiles.length > 1) {
      const hasImage = mediaFiles.some((f) => f.type === "image")
      const hasDocument = mediaFiles.some((f) => f.type === "document")
      if (hasImage && hasDocument) {
        toast.error("LinkedIn only supports an image or a document, not both. Please remove one.")
        return
      }
    }

    setIsPosting(true)
    try {
      const result = await onPost(content, mediaFiles.length > 0 ? mediaFiles : undefined)
      // Handle draft response when posting is disabled
      if (result && typeof result === 'object' && 'draft' in result && (result as { draft?: boolean }).draft) {
        toast.info("Saved as draft", {
          description: (result as { message?: string }).message || disabledMessage,
        })
        clearDraft()
        setContent("")
      } else {
        trackPostCreated("text", "manual")
        clearDraft()
        setContent("")
        postToast.published()
      }
    } catch (error) {
      console.error("Failed to post:", error)
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again."
      postToast.failed(message)
    } finally {
      setIsPosting(false)
    }
  }

  /**
   * Opens the schedule modal
   */
  const handleScheduleClick = () => {
    if (isOverLimit || !content.trim()) return
    setShowScheduleModal(true)
  }

  /**
   * Saves edits to a scheduled post without re-picking time
   */
  const handleSaveEdit = async () => {
    if (!onSaveEdit || !content.trim() || isOverLimit) return
    setIsSavingEdit(true)
    try {
      await onSaveEdit(content)
    } catch (err) {
      console.error('Failed to save edit:', err)
    } finally {
      setIsSavingEdit(false)
    }
  }

  /**
   * Handles the schedule confirmation from the modal
   */
  const handleScheduleConfirm = async (scheduledFor: Date, timezone: string) => {
    setIsScheduling(true)
    try {
      if (onScheduleConfirm) {
        await onScheduleConfirm(content, scheduledFor, timezone)
      }

      trackPostScheduled(scheduledFor.toISOString())
      setScheduledFor(scheduledFor)

      if (onSchedule) {
        onSchedule(content)
      }

      setShowScheduleModal(false)
      const formattedDate = scheduledFor.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      postToast.scheduled(formattedDate)

      clearDraft()
      setContent("")
      router.push("/dashboard/schedule")
    } catch (error) {
      console.error("Failed to schedule post:", error)
      postToast.failed(error instanceof Error ? error.message : "Failed to schedule post")
    } finally {
      setIsScheduling(false)
    }
  }

  /**
   * Inserts formatting syntax at the saved cursor position.
   * Uses cursorPositionRef so it works even when focus has moved to a popover.
   * @param prefix - The prefix to insert (e.g., "**" for bold)
   * @param suffix - The suffix to insert (e.g., "**" for bold)
   */
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const { start, end } = cursorPositionRef.current
    const clampedStart = Math.min(start, content.length)
    const clampedEnd = Math.min(end, content.length)
    const selectedText = content.slice(clampedStart, clampedEnd)

    const newContent =
      content.slice(0, clampedStart) + prefix + selectedText + suffix + content.slice(clampedEnd)

    const newPosition = selectedText
      ? clampedStart + prefix.length + selectedText.length + suffix.length
      : clampedStart + prefix.length

    // Schedule scroll + selection restore for after React re-renders
    pendingScrollRestore.current = {
      scrollTop: textareaRef.current?.scrollTop ?? 0,
      selectionStart: newPosition,
      selectionEnd: newPosition,
    }

    handleContentChange(newContent)
    cursorPositionRef.current = { start: newPosition, end: newPosition }
  }

  /**
   * Inserts an emoji at the saved cursor position.
   * Uses cursorPositionRef so it works even when focus has moved to the emoji popover.
   * @param emoji - The emoji to insert
   */
  const insertEmoji = (emoji: string) => {
    const { start, end } = cursorPositionRef.current
    const clampedStart = Math.min(start, content.length)
    const clampedEnd = Math.min(end, content.length)

    const newContent = content.slice(0, clampedStart) + emoji + content.slice(clampedEnd)

    const newPosition = clampedStart + emoji.length

    // Schedule scroll + selection restore for after React re-renders
    pendingScrollRestore.current = {
      scrollTop: textareaRef.current?.scrollTop ?? 0,
      selectionStart: newPosition,
      selectionEnd: newPosition,
    }

    handleContentChange(newContent)
    cursorPositionRef.current = { start: newPosition, end: newPosition }

    // Ensure we're in edit mode so the textarea is mounted
    if (!isEditing) setIsEditing(true)
  }

  /**
   * Handles file selection from the toolbar buttons
   */
  const handleFileSelect = (files: FileList, type: "image" | "document") => {
    const newMediaFiles: MediaFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const mediaFile: MediaFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        type: type === "image" ? "image" : "document",
        previewUrl: URL.createObjectURL(file),
        uploadProgress: 100,
        status: "complete",
      }
      newMediaFiles.push(mediaFile)
    }

    setMediaFiles((prev) => [...prev, ...newMediaFiles])
    postToast.mediaSaved()
  }

  /**
   * Removes a media file from the list
   */
  const handleRemoveMedia = (id: string) => {
    // Clear carousel previews when removing a carousel document
    if (id.startsWith('carousel-')) {
      setCarouselSlideImages([])
    }
    setMediaFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.previewUrl)
      }
      return prev.filter((f) => f.id !== id)
    })
  }

  /**
   * Handles AI editing of selected text.
   * Sends selected text + instruction to /api/ai/edit-selection, replaces selection with result.
   * @param instruction - The user's editing instruction
   */
  const handleEditWithAI = async (instruction: string) => {
    const { selectedText, selectionRange } = selectionPopup
    if (!selectedText.trim()) return

    setIsEditingWithAI(true)
    try {
      const res = await fetch('/api/ai/edit-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText,
          instruction,
          fullPostContent: content,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to edit selection')
      }

      const { editedText } = await res.json()

      // Preserve leading/trailing whitespace from original selection
      const leadingWS = selectedText.match(/^(\s*)/)?.[1] || ''
      const trailingWS = selectedText.match(/(\s*)$/)?.[1] || ''
      const trimmedEdit = editedText.trim()
      const preservedEdit = leadingWS + trimmedEdit + trailingWS

      // Store suggestion for inline diff preview instead of applying immediately
      setPendingSuggestion({
        suggestion: preservedEdit,
        selectionStart: selectionRange.start,
        selectionEnd: selectionRange.end,
      })
      selectionPopup.dismiss()
    } catch (err) {
      console.error('Edit with AI error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to edit selection')
    } finally {
      setIsEditingWithAI(false)
    }
  }

  /** Accept the AI suggestion and apply it to the content */
  const handleAcceptSuggestion = () => {
    if (!pendingSuggestion) return
    const { suggestion, selectionStart, selectionEnd } = pendingSuggestion
    const newContent =
      content.slice(0, selectionStart) +
      suggestion +
      content.slice(selectionEnd)
    handleContentChange(newContent)
    setPendingSuggestion(null)
    showSuccess('AI edit applied')
  }

  /** Reject the AI suggestion and go back to editing */
  const handleRejectSuggestion = () => {
    setPendingSuggestion(null)
  }

  /**
   * Saves the current content as a draft to Supabase
   */
  const handleSaveDraft = async () => {
    if (!content.trim()) return
    setIsSavingDraft(true)
    setDraftSaved(false)

    try {
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length
      const res = await fetch('/api/drafts/auto-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          postType: 'general',
          wordCount,
          draftId: draft.savedDraftId || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.id) {
          updateDraft({ savedDraftId: data.id })
        }
        setDraftSaved(true)
        showSuccess('Draft saved')
        // Reset saved indicator after 3 seconds
        setTimeout(() => setDraftSaved(false), 3000)
      } else {
        toast.error('Failed to save draft')
      }
    } catch {
      toast.error('Failed to save draft')
    } finally {
      setIsSavingDraft(false)
    }
  }

  /**
   * Enters edit mode on the right-side preview
   */
  const enterEditMode = () => {
    setIsEditing(true)
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column — Dual-Mode AI Generation */}
        <motion.div
          variants={fadeSlideUpVariants}
          initial="initial"
          animate="animate"
        >
          <Card className={cn(
            "relative flex flex-col overflow-hidden transition-colors duration-500",
            composeTheme.borderColor
          )}>
            <ComposeGradientBackdrop mode={composeMode} />

            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">AI Generation</CardTitle>
                <div className="flex items-center gap-2">
                  <ComposeModeToggle mode={composeMode} onModeChange={(newMode) => {
                    if (content.trim() && newMode !== composeMode) {
                      toast.info("Your content has been preserved across the mode switch.", { duration: 3000 })
                    }
                    setComposeMode(newMode)
                  }} />
                </div>
              </div>
              <CardDescription className="flex items-center justify-between">
                <span>
                  {composeMode === 'basic'
                    ? 'Generate post content with AI assistance'
                    : 'Chat with AI to craft your post'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearConvo()
                    handleContentChange('')
                    setIsEditing(false)
                    setMediaFiles([])
                    setAiResetKey((k) => k + 1)
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {composeMode === 'advanced' ? 'New Chat' : 'Start Over'}
                </button>
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3">
              {/* Posting Disabled Warning */}
              {!isPostingEnabled && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <IconAlertTriangle className="size-4 shrink-0" />
                  <span>{disabledMessage}</span>
                </div>
              )}

              {/* Remix Info Banner — shown when content was remixed from discover/swipe */}
              {showRemixBanner && remixMeta && (
                <div className="relative rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                  <button
                    onClick={() => setShowRemixBanner(false)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-3.5" />
                  </button>
                  <div className="flex items-center gap-2 mb-2">
                    <IconRepeat className="size-4 text-purple-500" />
                    <span className="text-sm font-medium">Remixed Post</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5">
                      Style: <span className="font-medium text-foreground capitalize">{remixMeta.tone.replace(/-/g, ' ')}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5">
                      Length: <span className="font-medium text-foreground capitalize">{remixMeta.length}</span>
                    </span>
                    {remixMeta.customInstructions && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 max-w-full">
                        Instructions: <span className="font-medium text-foreground truncate max-w-[200px]">{remixMeta.customInstructions}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Mode content — both mounted, inactive hidden to preserve chat state */}
              <div style={{ display: composeMode === 'basic' ? undefined : 'none' }}>
                <ComposeBasicMode
                  onGenerated={(generatedContent) => {
                    handleContentChange(convertMarkdownToUnicode(generatedContent))
                    trackFeatureUsed("ai_generation_basic")
                    showSuccess('Post generated!')
                    setIsEditing(false)
                  }}
                  hasApiKey={hasApiKey}
                  defaultPostType={selectedFormat}
                  onGenerationContext={handleGenerationContext}
                  initialTopic={aiSuggestion?.topic || (remixMeta ? remixMeta.originalContent : undefined)}
                  initialTone={remixMeta?.tone || aiSuggestion?.tone}
                  initialLength={remixMeta?.length || aiSuggestion?.length}
                  initialContext={remixMeta?.customInstructions || aiSuggestion?.context}
                  resetKey={aiResetKey}
                />
              </div>
              <div style={{ display: composeMode === 'advanced' ? undefined : 'none' }}>
                <ErrorBoundary
                  fallback={
                    <div className="flex flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      <p className="mb-2 font-medium text-foreground">Something went wrong with the AI chat.</p>
                      <p>Please try refreshing the page or switch to Basic mode.</p>
                    </div>
                  }
                >
                  <ComposeAdvancedMode
                    onGenerated={(generatedContent) => {
                      handleContentChange(convertMarkdownToUnicode(generatedContent))
                      trackFeatureUsed("ai_generation_advanced")
                      showSuccess('Post generated!')
                      setIsEditing(false)
                    }}
                    hasApiKey={hasApiKey}
                    persistedMessages={persistedMessages.length > 0 ? persistedMessages as unknown as import("ai").UIMessage[] : undefined}
                    conversationId={persistedConvoId}
                    onMessagesChange={handleAdvancedMessagesChange}
                    onNewChat={clearConvo}
                  />
                </ErrorBoundary>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column — Editable Preview + Toolbar + Actions */}
        <motion.div
          variants={fadeSlideUpVariants}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.1 }}
        >
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <IconBrandLinkedin className="size-4 text-[#0A66C2]" />
                LinkedIn Preview
              </CardTitle>
              <CardDescription>
                {isEditing
                  ? "Editing — click outside or press Escape to finish"
                  : "Double-click the content area to edit"}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-3">
              {/* LinkedIn Post Preview Card */}
              <div className="rounded-lg border bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-700/60 overflow-hidden">
                {/* Profile Header */}
                <div className="flex items-start gap-3 p-4 pb-3">
                  <Avatar className="size-12 ring-1 ring-border/50">
                    {userProfile.avatarUrl ? (
                      <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {userProfile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold leading-tight text-sm">{userProfile.name}</h4>
                    <p className="text-muted-foreground text-xs leading-tight mt-0.5 line-clamp-1">
                      {userProfile.headline}
                    </p>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <span>Just now</span>
                      <span className="leading-none">&#183;</span>
                      <IconWorld className="size-3" />
                    </p>
                  </div>
                </div>

                {/* Editing Zone — wraps content + toolbar + media buttons */}
                <div ref={editingZoneRef}>
                  {/* Post Content — dual mode */}
                  <div className="px-4 pb-3">
                    {pendingSuggestion ? (
                      /* Inline diff view: show AI suggestion with accept/reject */
                      <InlineDiffView
                        content={content}
                        selectionStart={pendingSuggestion.selectionStart}
                        selectionEnd={pendingSuggestion.selectionEnd}
                        suggestion={pendingSuggestion.suggestion}
                        onAccept={handleAcceptSuggestion}
                        onReject={handleRejectSuggestion}
                      />
                    ) : isEditing ? (
                      /* Edit mode: borderless textarea styled to match preview */
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => {
                            handleContentChange(e.target.value)
                            saveCursorPosition()
                            // Defer mention detection to after state update
                            setTimeout(detectMention, 0)
                          }}
                          onSelect={() => {
                            saveCursorPosition()
                            detectMention()
                          }}
                          onKeyDown={handleTextareaKeyDown}
                          onKeyUp={(e) => {
                            saveCursorPosition()
                            // Close mention on space after @-only trigger
                            if (e.key === 'Escape' && mentionOpen) {
                              setMentionOpen(false)
                            }
                          }}
                          onClick={saveCursorPosition}
                          placeholder="What do you want to talk about?"
                          className={cn(
                            "w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground",
                            "min-h-[120px]",
                            isOverLimit && "text-destructive"
                          )}
                          aria-label="Post content"
                          aria-describedby="character-count"
                        />
                        <MentionPopover
                          isOpen={mentionOpen}
                          query={mentionQuery}
                          position={mentionPosition}
                          onSelect={handleMentionSelect}
                          onClose={() => setMentionOpen(false)}
                        />
                        {/* Edit with AI floating popup */}
                        <EditWithAIPopup
                          isVisible={selectionPopup.showPopup && !mentionOpen}
                          position={selectionPopup.popupPosition}
                          selectedText={selectionPopup.selectedText}
                          onSubmit={handleEditWithAI}
                          isLoading={isEditingWithAI}
                          onClose={selectionPopup.dismiss}
                          popupRef={selectionPopup.popupRef}
                        />
                      </div>
                    ) : (
                      /* Preview mode: rendered content with double-click to edit */
                      <div
                        className="group relative cursor-text min-h-[120px]"
                        onDoubleClick={enterEditMode}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') enterEditMode()
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label="Double-click to edit post content"
                      >
                        {content.trim() ? (
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {parseMarkdownLikeSyntax(content)}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="rounded-full bg-muted/60 p-3 mb-2">
                              <IconPencil className="size-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-muted-foreground text-sm italic">
                              Your post content will appear here...
                            </p>
                          </div>
                        )}
                        {/* Double-click hint on hover */}
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-muted/30 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                          <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                            Double-click to edit
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Formatting Toolbar — visible only in edit mode */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap items-center gap-1 border-t px-4 py-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={activeFontStyle === 'bold' || activeFontStyle === 'boldItalic' ? "secondary" : "ghost"}
                                size="icon-sm"
                                onClick={() => {
                                  saveCursorPosition()
                                  applyUnicodeFont('bold')
                                }}
                                aria-label="Bold"
                              >
                                <IconBold className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bold ({typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '\u2318' : 'Ctrl'}+B)</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={activeFontStyle === 'italic' || activeFontStyle === 'boldItalic' ? "secondary" : "ghost"}
                                size="icon-sm"
                                onClick={() => {
                                  saveCursorPosition()
                                  applyUnicodeFont('italic')
                                }}
                                aria-label="Italic"
                              >
                                <IconItalic className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Italic ({typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '\u2318' : 'Ctrl'}+I)</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => insertFormatting("\n- ", "")}
                                aria-label="List"
                              >
                                <IconList className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>List item (- text)</TooltipContent>
                          </Tooltip>

                          <Separator orientation="vertical" className="mx-1 h-6" />

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => insertFormatting("#")}
                                aria-label="Hashtag"
                              >
                                <IconHash className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add hashtag</TooltipContent>
                          </Tooltip>

                          <Separator orientation="vertical" className="mx-1 h-6" />

                          {/* Unicode Font Picker */}
                          <FontPicker
                            activeFontStyle={activeFontStyle}
                            onFontSelect={(style) => applyUnicodeFont(style)}
                          />

                          <Separator orientation="vertical" className="mx-1 h-6" />

                          {/* Emoji Picker */}
                          <EmojiPicker
                            isOpen={showEmojiPicker}
                            onClose={() => setShowEmojiPicker(false)}
                            onOpenChange={setShowEmojiPicker}
                            onSelect={(emoji) => {
                              insertEmoji(emoji)
                              setShowEmojiPicker(false)
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Add emoji"
                              title="Add emoji"
                              onClick={(e) => {
                                e.preventDefault()
                                saveCursorPosition()
                                setShowEmojiPicker(!showEmojiPicker)
                              }}
                            >
                              <IconMoodSmile className="size-4" />
                            </Button>
                          </EmojiPicker>

                          {/* Image Attachment */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Add image"
                                onClick={() => {
                                  const input = document.createElement("input")
                                  input.type = "file"
                                  input.accept = "image/*"
                                  input.multiple = true
                                  input.onchange = (e) => {
                                    const files = (e.target as HTMLInputElement).files
                                    if (files) handleFileSelect(files, "image")
                                  }
                                  input.click()
                                }}
                              >
                                <IconPhoto className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add image</TooltipContent>
                          </Tooltip>

                          {/* Document Attachment */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Add document"
                                onClick={() => {
                                  const input = document.createElement("input")
                                  input.type = "file"
                                  input.accept = ".pdf,.doc,.docx"
                                  input.onchange = (e) => {
                                    const files = (e.target as HTMLInputElement).files
                                    if (files) handleFileSelect(files, "document")
                                  }
                                  input.click()
                                }}
                              >
                                <IconFile className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add document</TooltipContent>
                          </Tooltip>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Media Attachment Buttons — always visible, not gated by edit mode */}
                {!isEditing && (
                  <div className="flex items-center gap-1 border-t px-4 py-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Add image"
                          onClick={() => {
                            const input = document.createElement("input")
                            input.type = "file"
                            input.accept = "image/*"
                            input.multiple = true
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files
                              if (files) handleFileSelect(files, "image")
                            }
                            input.click()
                          }}
                        >
                          <IconPhoto className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add image</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Add document"
                          onClick={() => {
                            const input = document.createElement("input")
                            input.type = "file"
                            input.accept = ".pdf,.doc,.docx"
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files
                              if (files) handleFileSelect(files, "document")
                            }
                            input.click()
                          }}
                        >
                          <IconFile className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add document</TooltipContent>
                    </Tooltip>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Double-click preview to edit text
                    </span>
                  </div>
                )}

                {/* Media Preview — LinkedIn-style */}
                {mediaFiles.length > 0 && (() => {
                  const imageFiles = mediaFiles.filter((f) => f.type === "image")
                  const docFiles = mediaFiles.filter((f) => f.type === "document")
                  const hasCarousel = carouselSlideImages.length > 0

                  return (
                    <div className="group/media">
                      {/* Clear all button — separate row above media */}
                      {mediaFiles.length > 1 && (
                        <div className="flex justify-end px-4 py-1.5 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 rounded-full text-xs text-muted-foreground hover:text-destructive gap-1"
                            onClick={() => {
                              mediaFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl))
                              setMediaFiles([])
                              setCarouselSlideImages([])
                            }}
                          >
                            <IconX className="size-3" />
                            Clear all
                          </Button>
                        </div>
                      )}

                      {/* Carousel / Document preview */}
                      {hasCarousel ? (
                        <CarouselDocumentPreview
                          slideImages={carouselSlideImages}
                          onRemove={() => {
                            mediaFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl))
                            setMediaFiles([])
                            setCarouselSlideImages([])
                          }}
                        />
                      ) : docFiles.length > 0 && imageFiles.length === 0 ? (
                        /* Document-only: full-width card */
                        <div className="group/doc relative border-t bg-muted/50">
                          <div className="flex items-center gap-3 px-4 py-4">
                            <div className="flex size-12 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                              <IconFile className="size-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{docFiles[0].file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(docFiles[0].file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-2 size-6 rounded-full opacity-0 shadow-md transition-opacity group-hover/doc:opacity-100"
                            onClick={() => handleRemoveMedia(docFiles[0].id)}
                            aria-label={`Remove ${docFiles[0].file.name}`}
                          >
                            <IconX className="size-3" />
                          </Button>
                        </div>
                      ) : imageFiles.length === 1 ? (
                        /* Single image — full-width like LinkedIn */
                        <div className="group/img relative">
                          <div className="relative aspect-[4/3] w-full overflow-hidden border-t">
                            <Image
                              src={imageFiles[0].previewUrl}
                              alt={imageFiles[0].file.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-3 size-6 rounded-full opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                            onClick={() => handleRemoveMedia(imageFiles[0].id)}
                            aria-label={`Remove ${imageFiles[0].file.name}`}
                          >
                            <IconX className="size-3" />
                          </Button>
                        </div>
                      ) : imageFiles.length === 2 ? (
                        /* Two images — side by side */
                        <div className="grid grid-cols-2 gap-0.5 border-t">
                          {imageFiles.map((file) => (
                            <div key={file.id} className="group/img relative aspect-square overflow-hidden">
                              <Image
                                src={file.previewUrl}
                                alt={file.file.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute right-1 top-1 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                                onClick={() => handleRemoveMedia(file.id)}
                                aria-label={`Remove ${file.file.name}`}
                              >
                                <IconX className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : imageFiles.length === 3 ? (
                        /* Three images — one large left, two stacked right */
                        <div className="grid grid-cols-2 gap-0.5 border-t">
                          <div className="group/img relative row-span-2 aspect-auto overflow-hidden" style={{ minHeight: '16rem' }}>
                            <Image
                              src={imageFiles[0].previewUrl}
                              alt={imageFiles[0].file.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute right-1 top-1 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                              onClick={() => handleRemoveMedia(imageFiles[0].id)}
                              aria-label={`Remove ${imageFiles[0].file.name}`}
                            >
                              <IconX className="size-3" />
                            </Button>
                          </div>
                          {imageFiles.slice(1).map((file) => (
                            <div key={file.id} className="group/img relative aspect-square overflow-hidden">
                              <Image
                                src={file.previewUrl}
                                alt={file.file.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute right-1 top-1 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                                onClick={() => handleRemoveMedia(file.id)}
                                aria-label={`Remove ${file.file.name}`}
                              >
                                <IconX className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : imageFiles.length >= 4 ? (
                        /* Four+ images — 2x2 grid, +N overlay on last */
                        <div className="grid grid-cols-2 gap-0.5 border-t">
                          {imageFiles.slice(0, 4).map((file, idx) => (
                            <div key={file.id} className="group/img relative aspect-square overflow-hidden">
                              <Image
                                src={file.previewUrl}
                                alt={file.file.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              {idx === 3 && imageFiles.length > 4 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <span className="text-2xl font-semibold text-white">+{imageFiles.length - 4}</span>
                                </div>
                              )}
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute right-1 top-1 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                                onClick={() => handleRemoveMedia(file.id)}
                                aria-label={`Remove ${file.file.name}`}
                              >
                                <IconX className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Documents below images (when both exist) */}
                      {docFiles.length > 0 && imageFiles.length > 0 && docFiles.map((file) => (
                        <div key={file.id} className="group/doc relative border-t bg-muted/50">
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="flex size-10 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                              <IconFile className="size-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{file.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-2 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/doc:opacity-100"
                            onClick={() => handleRemoveMedia(file.id)}
                            aria-label={`Remove ${file.file.name}`}
                          >
                            <IconX className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Engagement Stats (LinkedIn preview mock) */}
                <div className="text-muted-foreground flex items-center px-4 py-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-flex -space-x-1">
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#378FE9] text-[8px] text-white ring-1 ring-white dark:ring-zinc-900">&#128077;</span>
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#DF704D] text-[8px] text-white ring-1 ring-white dark:ring-zinc-900">&#10084;</span>
                    </span>
                  </span>
                </div>

                {/* LinkedIn Action Buttons */}
                <div className="flex items-center justify-around border-t py-0.5 px-1">
                  {[
                    { icon: IconThumbUp, label: "Like" },
                    { icon: IconMessageCircle, label: "Comment" },
                    { icon: IconRepeat, label: "Repost" },
                    { icon: IconSend, label: "Send" },
                  ].map(({ icon: Icon, label }) => (
                    <Button
                      key={label}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground flex-1 gap-1 text-[11px] font-medium px-1"
                      disabled
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>

                {/* Post Now — inside preview card */}
                <div className="border-t px-4 py-3">
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || isScheduling || isOverLimit || !content.trim()}
                    variant={isPostingEnabled ? "default" : "secondary"}
                    className="w-full"
                  >
                    {isPosting ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : isPostingEnabled ? (
                      <IconSend className="size-4" />
                    ) : (
                      <IconFile className="size-4" />
                    )}
                    {isPostingEnabled ? "Post Now" : "Save as Draft"}
                  </Button>
                </div>
              </div>

              {/* Character Counter — always visible below preview card */}
              <div id="character-count" className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 flex-1 overflow-hidden rounded-full bg-muted",
                    isOverLimit && "bg-destructive/20"
                  )}
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      isOverLimit ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${characterPercentage}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm tabular-nums whitespace-nowrap",
                    isOverLimit
                      ? "text-destructive font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {characterCount.toLocaleString()}/{maxLength.toLocaleString()}
                </span>
              </div>

              {/* Hashtag Display — always visible when hashtags exist */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Hashtags:</span>
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Add My Hashtags — only visible when user has saved default hashtags */}
              {savedHashtags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => {
                    const existing = extractHashtags(content)
                    const existingLower = new Set(existing.map(t => t.toLowerCase()))
                    const newTags = savedHashtags.filter(t => !existingLower.has(t.toLowerCase()))
                    if (newTags.length === 0) {
                      toast.info('All your default hashtags are already in the post')
                      return
                    }
                    const hashtagString = newTags.map(t => `#${t}`).join(' ')
                    const separator = content.trim() ? '\n\n' : ''
                    handleContentChange(content.trimEnd() + separator + hashtagString)
                    toast.success(`Added ${newTags.length} hashtag${newTags.length > 1 ? 's' : ''}`)
                  }}
                >
                  <IconHash className="size-3.5" />
                  Add My Hashtags
                </Button>
              )}
            </CardContent>

            {/* Action Buttons */}
            <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <div className="flex items-center gap-2 shrink-0">
                <PostActionsMenu content={content} variant="ghost" />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || !content.trim()}
                  className="gap-1.5"
                >
                  {isSavingDraft ? (
                    <IconLoader2 className="size-3.5 animate-spin" />
                  ) : draftSaved ? (
                    <IconCheck className="size-3.5 text-green-500" />
                  ) : (
                    <IconFile className="size-3.5" />
                  )}
                  {draftSaved ? 'Saved' : 'Save Draft'}
                </Button>
                {isEditingScheduledPost && onSaveEdit && (
                  <Button
                    variant="default"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || isOverLimit || !content.trim()}
                    className="gap-1.5"
                  >
                    {isSavingEdit ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconDeviceFloppy className="size-4" />
                    )}
                    Save
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleScheduleClick}
                  disabled={isScheduling || isPosting || isOverLimit || !content.trim()}
                >
                  {isScheduling ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconCalendar className="size-4" />
                  )}
                  Schedule
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleConfirm}
        postPreview={{
          content,
          mediaCount: mediaFiles.length,
          userProfile,
        }}
        defaultDate={initialScheduleDate}
        isSubmitting={isScheduling}
      />

      {/* AI Generation Dialog (Advanced fallback) */}
      <AIGenerationDialog
        isOpen={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onGenerated={(generatedContent) => {
          handleContentChange(convertMarkdownToUnicode(generatedContent))
          trackFeatureUsed("ai_generation_dialog")
          showSuccess('Post generated successfully!')
          setIsEditing(false)
        }}
        hasApiKey={hasApiKey}
        defaultPostType={selectedFormat}
      />
    </TooltipProvider>
  )
}
