/**
 * Draft State Types
 * @description Discriminated union types for type-specific draft metadata
 * stored in the `draft_state` JSONB column of `generated_posts`.
 * @module types/draft-state
 */

/**
 * Carousel draft state — stores full editor state for perfect restoration
 */
export interface CarouselDraftState {
  type: 'carousel'
  /** Full CanvasSlide[] serialized */
  slides: unknown[]
  /** Applied template ID */
  templateId?: string
  /** Applied template name */
  templateName?: string
  /** Whether brand kit was applied */
  brandKitApplied?: boolean
  /** Brand colors from template/kit */
  brandColors?: string[]
  /** Fonts from template/kit */
  fonts?: string[]
  /** AI-generated caption */
  generatedCaption?: string
  /** Which slide the user was viewing */
  currentSlideIndex?: number
  /** Total number of slides */
  slideCount?: number
}

/**
 * Series draft state — stores multi-post series structure
 */
export interface SeriesDraftState {
  type: 'series'
  /** Array of posts in the series */
  posts: Array<{ subtopic: string; summary: string; post: string }>
  /** Which post the user was viewing */
  currentPostIndex?: number
  /** Overall series topic/theme */
  seriesTopic?: string
  /** FK to compose_conversations for chat history */
  conversationId?: string
}

/**
 * Compose draft state — stores editor metadata for normal compose
 */
export interface ComposeDraftState {
  type: 'compose'
  /** Unicode font style applied (e.g. 'bold_italic') */
  fontStyle?: string
  /** Scheduled publish date (ISO string) */
  scheduledFor?: string
  /** AI generation context */
  generationContext?: { topic?: string; tone?: string; length?: string }
  /** FK to compose_conversations for chat history */
  conversationId?: string
}

/**
 * Remix draft state — stores original post context for traceability
 */
export interface RemixDraftState {
  type: 'remix'
  /** Original post ID that was remixed */
  sourcePostId?: string
  /** Original post author */
  sourceAuthor?: string
  /** Tone used for the remix */
  remixTone?: string
  /** Length used for the remix */
  remixLength?: string
  /** Custom instructions provided */
  customInstructions?: string
  /** First 200 chars of original content */
  originalContentPreview?: string
}

/**
 * Swipe draft state — stores source suggestion metadata
 */
export interface SwipeDraftState {
  type: 'swipe'
  /** Source suggestion ID */
  sourceSuggestionId?: string
  /** Category/topic of the suggestion */
  category?: string
  /** Estimated engagement score (0-100) */
  estimatedEngagement?: number
}

/**
 * Discriminated union of all draft state types
 */
export type DraftState =
  | CarouselDraftState
  | SeriesDraftState
  | ComposeDraftState
  | RemixDraftState
  | SwipeDraftState

/**
 * Type guard for CarouselDraftState
 */
export function isCarouselDraftState(s: unknown): s is CarouselDraftState {
  return typeof s === 'object' && s !== null && (s as Record<string, unknown>).type === 'carousel'
}

/**
 * Type guard for SeriesDraftState
 */
export function isSeriesDraftState(s: unknown): s is SeriesDraftState {
  return typeof s === 'object' && s !== null && (s as Record<string, unknown>).type === 'series'
}

/**
 * Type guard for ComposeDraftState
 */
export function isComposeDraftState(s: unknown): s is ComposeDraftState {
  return typeof s === 'object' && s !== null && (s as Record<string, unknown>).type === 'compose'
}

/**
 * Type guard for RemixDraftState
 */
export function isRemixDraftState(s: unknown): s is RemixDraftState {
  return typeof s === 'object' && s !== null && (s as Record<string, unknown>).type === 'remix'
}

/**
 * Type guard for SwipeDraftState
 */
export function isSwipeDraftState(s: unknown): s is SwipeDraftState {
  return typeof s === 'object' && s !== null && (s as Record<string, unknown>).type === 'swipe'
}

/**
 * Parse a raw JSON value into a typed DraftState, returning null if invalid
 */
export function parseDraftState(raw: unknown): DraftState | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (
    obj.type === 'carousel' ||
    obj.type === 'series' ||
    obj.type === 'compose' ||
    obj.type === 'remix' ||
    obj.type === 'swipe'
  ) {
    return raw as DraftState
  }
  return null
}
