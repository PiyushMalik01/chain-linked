"use client"

import * as React from "react"

/**
 * Represents a media file attached to a draft
 */
export interface MediaFile {
  /** Unique identifier for the file */
  id: string
  /** File name */
  name: string
  /** MIME type of the file */
  type: string
  /** File size in bytes */
  size: number
  /** Preview URL (object URL or data URL) */
  previewUrl: string
  /** Uploaded file URL (after upload to server) */
  uploadedUrl?: string
}

/**
 * AI suggestion context passed from templates to the compose page
 */
export interface AISuggestion {
  /** Suggested topic for AI generation */
  topic: string
  /** Suggested tone for AI generation */
  tone: string
  /** Suggested length for AI generation */
  length?: string
  /** Additional context for AI generation */
  context: string
}

/**
 * Remix settings carried from the remix dialog to the compose page
 */
export interface RemixMeta {
  /** Tone/style used for the remix */
  tone: string
  /** Length option used for the remix */
  length: string
  /** Custom instructions given for the remix */
  customInstructions: string
  /** The original prompt/content that was remixed */
  originalContent: string
}

/**
 * Represents the state of a post draft
 */
export interface DraftState {
  /** Post content text */
  content: string
  /** Attached media files */
  mediaFiles: MediaFile[]
  /** Scheduled date/time for the post */
  scheduledFor?: Date
  /** ID of the template used (if any) */
  templateId?: string
  /** ID of the source post if remixing */
  sourcePostId?: string
  /** Author name for remixed posts */
  sourceAuthor?: string
  /** AI suggestion context from template selection */
  aiSuggestion?: AISuggestion
  /** Remix settings from the remix dialog */
  remixMeta?: RemixMeta
  /** Supabase row ID of the saved draft (for updating instead of inserting) */
  savedDraftId?: string
  /** Last modified timestamp */
  lastModified: number
}

/**
 * Context value interface
 */
interface DraftContextValue {
  /** Current draft state */
  draft: DraftState
  /** Update the draft content */
  setContent: (content: string) => void
  /** Update the draft with partial values */
  updateDraft: (updates: Partial<DraftState>) => void
  /** Add media files to the draft */
  addMediaFiles: (files: MediaFile[]) => void
  /** Remove a media file by ID */
  removeMediaFile: (id: string) => void
  /** Clear all media files */
  clearMediaFiles: () => void
  /** Set scheduled date */
  setScheduledFor: (date: Date | undefined) => void
  /** Load a template into the draft, optionally with AI suggestion context */
  loadTemplate: (templateId: string, content: string, aiSuggestion?: AISuggestion) => void
  /** Load content for remixing, optionally with AI suggestion context and remix settings */
  loadForRemix: (postId: string, content: string, authorName?: string, aiSuggestion?: AISuggestion, remixMeta?: RemixMeta) => void
  /** Clear the entire draft */
  clearDraft: () => void
  /** Check if draft has unsaved content */
  hasContent: boolean
  /** Check if draft has any changes */
  isDirty: boolean
}

const DRAFT_STORAGE_KEY = "chainlinked-draft"

/**
 * Initial empty draft state
 */
const initialDraftState: DraftState = {
  content: "",
  mediaFiles: [],
  scheduledFor: undefined,
  templateId: undefined,
  sourcePostId: undefined,
  sourceAuthor: undefined,
  aiSuggestion: undefined,
  remixMeta: undefined,
  savedDraftId: undefined,
  lastModified: Date.now(),
}

/**
 * Load draft from localStorage
 */
function loadDraftFromStorage(): DraftState {
  if (typeof window === "undefined") return initialDraftState

  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return initialDraftState

    const parsed = JSON.parse(stored)
    return {
      ...initialDraftState,
      ...parsed,
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : undefined,
      lastModified: parsed.lastModified || Date.now(),
    }
  } catch {
    return initialDraftState
  }
}

/**
 * Save draft to localStorage
 */
function saveDraftToStorage(draft: DraftState): void {
  if (typeof window === "undefined") return

  try {
    const toStore = {
      ...draft,
      scheduledFor: draft.scheduledFor?.toISOString(),
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toStore))
  } catch (error) {
    console.error("Failed to save draft to storage:", error)
  }
}

const DraftContext = React.createContext<DraftContextValue | undefined>(undefined)

/**
 * Provider component for draft state management.
 * Wraps the application to provide draft state across all pages.
 */
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = React.useState<DraftState>(initialDraftState)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    setDraft(loadDraftFromStorage())
    setIsHydrated(true)
  }, [])

  // Save to localStorage on changes (after hydration)
  React.useEffect(() => {
    if (isHydrated) {
      saveDraftToStorage(draft)
    }
  }, [draft, isHydrated])

  const setContent = React.useCallback((content: string) => {
    setDraft((prev) => ({
      ...prev,
      content,
      lastModified: Date.now(),
    }))
  }, [])

  const updateDraft = React.useCallback((updates: Partial<DraftState>) => {
    setDraft((prev) => ({
      ...prev,
      ...updates,
      lastModified: Date.now(),
    }))
  }, [])

  const addMediaFiles = React.useCallback((files: MediaFile[]) => {
    setDraft((prev) => ({
      ...prev,
      mediaFiles: [...prev.mediaFiles, ...files],
      lastModified: Date.now(),
    }))
  }, [])

  const removeMediaFile = React.useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((f) => f.id !== id),
      lastModified: Date.now(),
    }))
  }, [])

  const clearMediaFiles = React.useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      mediaFiles: [],
      lastModified: Date.now(),
    }))
  }, [])

  const setScheduledFor = React.useCallback((date: Date | undefined) => {
    setDraft((prev) => ({
      ...prev,
      scheduledFor: date,
      lastModified: Date.now(),
    }))
  }, [])

  const loadTemplate = React.useCallback((templateId: string, content: string, aiSuggestion?: AISuggestion) => {
    setDraft({
      content,
      mediaFiles: [],
      scheduledFor: undefined,
      templateId,
      sourcePostId: undefined,
      sourceAuthor: undefined,
      aiSuggestion,
      lastModified: Date.now(),
    })
  }, [])

  const loadForRemix = React.useCallback(
    (postId: string, content: string, authorName?: string, aiSuggestion?: AISuggestion, remixMeta?: RemixMeta) => {
      const remixContent = authorName
        ? `Inspired by ${authorName}:\n\n${content}`
        : content

      setDraft({
        content: remixContent,
        mediaFiles: [],
        scheduledFor: undefined,
        templateId: undefined,
        sourcePostId: postId,
        sourceAuthor: authorName,
        aiSuggestion,
        remixMeta,
        lastModified: Date.now(),
      })
    },
    []
  )

  const clearDraft = React.useCallback(() => {
    setDraft(initialDraftState)
  }, [])

  const hasContent = draft.content.trim().length > 0 || draft.mediaFiles.length > 0
  const isDirty = hasContent || draft.scheduledFor !== undefined

  const value: DraftContextValue = {
    draft,
    setContent,
    updateDraft,
    addMediaFiles,
    removeMediaFile,
    clearMediaFiles,
    setScheduledFor,
    loadTemplate,
    loadForRemix,
    clearDraft,
    hasContent,
    isDirty,
  }

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

/**
 * Hook to access draft state and actions.
 * Must be used within a DraftProvider.
 *
 * @example
 * ```tsx
 * const { draft, setContent, loadTemplate } = useDraft()
 *
 * // Update content
 * setContent("New post content")
 *
 * // Load a template
 * loadTemplate("template-123", "Template content here...")
 *
 * // Access current draft
 * console.log(draft.content)
 * ```
 */
export function useDraft(): DraftContextValue {
  const context = React.useContext(DraftContext)
  if (!context) {
    throw new Error("useDraft must be used within a DraftProvider")
  }
  return context
}
