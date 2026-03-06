/**
 * Prompt System Types
 * @description TypeScript types for the unified prompt management system
 * @module lib/prompts/prompt-types
 */

/**
 * All available prompt types in the system
 * Maps to the prompt_type ENUM in the database
 */
export enum PromptType {
  // Remix tones - used for post remixing with different styles
  REMIX_PROFESSIONAL = 'remix_professional',
  REMIX_CASUAL = 'remix_casual',
  REMIX_INSPIRING = 'remix_inspiring',
  REMIX_EDUCATIONAL = 'remix_educational',
  REMIX_THOUGHT_PROVOKING = 'remix_thought_provoking',
  REMIX_MATCH_STYLE = 'remix_match_style',

  // Post types - used for generating new posts
  POST_STORY = 'post_story',
  POST_LISTICLE = 'post_listicle',
  POST_HOW_TO = 'post_how_to',
  POST_CONTRARIAN = 'post_contrarian',
  POST_CASE_STUDY = 'post_case_study',
  POST_REFLECTION = 'post_reflection',
  POST_DATA_DRIVEN = 'post_data_driven',
  POST_QUESTION = 'post_question',
  POST_CAROUSEL = 'post_carousel',

  // Carousel specific prompts
  CAROUSEL_SYSTEM = 'carousel_system',
  CAROUSEL_USER_TEMPLATE = 'carousel_user_template',

  // Shared prompts used across multiple features
  BASE_RULES = 'base_rules',
}

/**
 * String literal union of all prompt type values
 * Useful for type guards and database queries
 */
export type PromptTypeValue = `${PromptType}`

/**
 * All valid prompt type values as an array
 * Used for validation and iteration
 */
export const PROMPT_TYPE_VALUES = Object.values(PromptType) as PromptTypeValue[]

/**
 * Variable definition for dynamic prompt content
 * Variables can be substituted at runtime with actual values
 */
export interface PromptVariable {
  /** Unique key for the variable (e.g., "user_industry") */
  key: string
  /** Human-readable description of what this variable represents */
  description: string
  /** Default value if not provided at runtime */
  defaultValue?: string
  /** Whether this variable must be provided */
  required: boolean
}

/**
 * System prompt as stored in the database
 * Maps to the system_prompts table
 */
export interface SystemPrompt {
  /** Unique identifier (UUID) */
  id: string
  /** The type of prompt (e.g., remix_professional, post_story) */
  type: PromptType
  /** Human-readable name for the prompt */
  name: string
  /** Optional description of the prompt's purpose */
  description: string | null
  /** The actual prompt content with optional variable placeholders */
  content: string
  /** Variables that can be substituted in the content */
  variables: PromptVariable[]
  /** Current version number (increments on each edit) */
  version: number
  /** Whether this prompt is currently active for its type */
  isActive: boolean
  /** Whether this is the default/fallback prompt for its type */
  isDefault: boolean
  /** User ID of the creator */
  createdBy: string | null
  /** User ID of the last updater */
  updatedBy: string | null
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
}

/**
 * Database row representation of system_prompts
 * Uses snake_case to match PostgreSQL conventions
 */
export interface SystemPromptRow {
  id: string
  type: PromptTypeValue
  name: string
  description: string | null
  content: string
  variables: PromptVariable[]
  version: number
  is_active: boolean
  is_default: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Prompt version for audit trail and rollback
 * Maps to the prompt_versions table
 */
export interface PromptVersion {
  /** Unique identifier (UUID) */
  id: string
  /** Foreign key to the parent prompt */
  promptId: string
  /** Version number for this snapshot */
  version: number
  /** The prompt content at this version */
  content: string
  /** Variables at this version */
  variables: PromptVariable[]
  /** Optional notes about what changed in this version */
  changeNotes: string | null
  /** User ID of who created this version */
  createdBy: string | null
  /** ISO timestamp of when this version was created */
  createdAt: string
}

/**
 * Database row representation of prompt_versions
 */
export interface PromptVersionRow {
  id: string
  prompt_id: string
  version: number
  content: string
  variables: PromptVariable[]
  change_notes: string | null
  created_by: string | null
  created_at: string
}

/**
 * Usage log entry for analytics
 * Maps to the prompt_usage_logs table
 */
export interface PromptUsageLog {
  /** Unique identifier (UUID) */
  id: string
  /** Foreign key to the prompt used (null if using fallback) */
  promptId: string | null
  /** The type of prompt used */
  promptType: PromptType
  /** Version number of the prompt used */
  promptVersion: number
  /** User ID who triggered this usage */
  userId: string | null
  /** Feature that used the prompt */
  feature: PromptFeature
  /** Number of input tokens consumed */
  inputTokens: number | null
  /** Number of output tokens generated */
  outputTokens: number | null
  /** Total tokens (input + output) */
  totalTokens: number | null
  /** AI model used (e.g., "gpt-4o-mini") */
  model: string | null
  /** Response time in milliseconds */
  responseTimeMs: number | null
  /** Whether the generation was successful */
  success: boolean
  /** Error message if generation failed */
  errorMessage: string | null
  /** Additional metadata as JSON */
  metadata: Record<string, unknown>
  /** ISO timestamp of when this usage occurred */
  createdAt: string
}

/**
 * Database row representation of prompt_usage_logs
 */
export interface PromptUsageLogRow {
  id: string
  prompt_id: string | null
  prompt_type: PromptTypeValue
  prompt_version: number
  user_id: string | null
  feature: PromptFeature
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  model: string | null
  response_time_ms: number | null
  success: boolean
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Features that use the prompt system
 */
export type PromptFeature = 'remix' | 'compose' | 'carousel' | 'playground'

/**
 * Test result from playground experimentation
 * Maps to the prompt_test_results table
 */
export interface PromptTestResult {
  /** Unique identifier (UUID) */
  id: string
  /** Foreign key to the prompt being tested (null for custom prompts) */
  promptId: string | null
  /** Version of the prompt tested */
  promptVersion: number
  /** User who ran the test */
  userId: string | null
  /** The system prompt used */
  systemPrompt: string
  /** The user prompt/input used */
  userPrompt: string
  /** Variables used in the test */
  variables: Record<string, string>
  /** AI model used */
  model: string
  /** Temperature setting used */
  temperature: number | null
  /** Max tokens setting used */
  maxTokens: number | null
  /** The generated response content */
  responseContent: string
  /** Total tokens consumed */
  tokensUsed: number | null
  /** Estimated cost in USD */
  estimatedCost: number | null
  /** User rating (1-5) */
  rating: number | null
  /** User notes about the result */
  notes: string | null
  /** ISO timestamp of when the test was run */
  createdAt: string
}

/**
 * Database row representation of prompt_test_results
 */
export interface PromptTestResultRow {
  id: string
  prompt_id: string | null
  prompt_version: number
  user_id: string | null
  system_prompt: string
  user_prompt: string
  variables: Record<string, string>
  model: string
  temperature: number | null
  max_tokens: number | null
  response_content: string
  tokens_used: number | null
  estimated_cost: number | null
  rating: number | null
  notes: string | null
  created_at: string
}

/**
 * Input for creating or updating a prompt
 */
export interface SavePromptInput {
  /** Prompt ID for updates, omit for new prompts */
  id?: string
  /** The type of prompt */
  type: PromptType
  /** Human-readable name */
  name: string
  /** Description of the prompt's purpose */
  description?: string
  /** The prompt content */
  content: string
  /** Variables that can be substituted */
  variables?: PromptVariable[]
  /** Notes about what changed (for version history) */
  changeNotes?: string
  /** Whether to set this as the active prompt for its type */
  setActive?: boolean
}

/**
 * Input for logging prompt usage
 */
export interface PromptUsageInput {
  /** The prompt ID used (null if using fallback) */
  promptId?: string
  /** The type of prompt used */
  promptType: PromptType
  /** Version of the prompt used */
  promptVersion: number
  /** User ID who triggered the usage */
  userId?: string
  /** Feature that used the prompt */
  feature: PromptFeature
  /** Token usage details */
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** AI model used */
  model?: string
  /** Response time in milliseconds */
  responseTimeMs?: number
  /** Whether the generation was successful */
  success: boolean
  /** Error message if failed */
  errorMessage?: string
  /** Estimated cost in USD for this LLM call */
  estimatedCost?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Filter options for querying usage analytics
 */
export interface UsageFilter {
  /** Filter by specific prompt ID */
  promptId?: string
  /** Filter by prompt type */
  promptType?: PromptType
  /** Filter by feature */
  feature?: PromptFeature
  /** Filter by user ID */
  userId?: string
  /** Start of date range (inclusive) */
  startDate?: string
  /** End of date range (inclusive) */
  endDate?: string
  /** Maximum number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Aggregated usage analytics response
 */
export interface UsageAnalytics {
  /** Total number of usages */
  totalUsages: number
  /** Total tokens consumed */
  totalTokens: number
  /** Average tokens per usage */
  avgTokens: number
  /** Total successful usages */
  successCount: number
  /** Total failed usages */
  errorCount: number
  /** Success rate as percentage (0-100) */
  successRate: number
  /** Average response time in milliseconds */
  avgResponseTimeMs: number
  /** Usage breakdown by feature */
  byFeature: Record<PromptFeature, number>
  /** Usage breakdown by model */
  byModel: Record<string, number>
  /** Daily usage counts */
  dailyUsage: Array<{
    date: string
    count: number
    tokens: number
  }>
}

/**
 * System prompt with its version history
 */
export interface PromptWithVersions extends SystemPrompt {
  /** All versions of this prompt, ordered by version descending */
  versions: PromptVersion[]
}

/**
 * Converts a database row to the TypeScript interface
 * @param row - Database row from system_prompts table
 * @returns SystemPrompt object with camelCase properties
 */
export function mapRowToSystemPrompt(row: SystemPromptRow): SystemPrompt {
  return {
    id: row.id,
    type: row.type as PromptType,
    name: row.name,
    description: row.description,
    content: row.content,
    variables: row.variables ?? [],
    version: row.version,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Converts a database row to the TypeScript interface
 * @param row - Database row from prompt_versions table
 * @returns PromptVersion object with camelCase properties
 */
export function mapRowToPromptVersion(row: PromptVersionRow): PromptVersion {
  return {
    id: row.id,
    promptId: row.prompt_id,
    version: row.version,
    content: row.content,
    variables: row.variables ?? [],
    changeNotes: row.change_notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

/**
 * Converts a database row to the TypeScript interface
 * @param row - Database row from prompt_usage_logs table
 * @returns PromptUsageLog object with camelCase properties
 */
export function mapRowToPromptUsageLog(row: PromptUsageLogRow): PromptUsageLog {
  return {
    id: row.id,
    promptId: row.prompt_id,
    promptType: row.prompt_type as PromptType,
    promptVersion: row.prompt_version,
    userId: row.user_id,
    feature: row.feature,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    model: row.model,
    responseTimeMs: row.response_time_ms,
    success: row.success,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

/**
 * Converts a database row to the TypeScript interface
 * @param row - Database row from prompt_test_results table
 * @returns PromptTestResult object with camelCase properties
 */
export function mapRowToPromptTestResult(row: PromptTestResultRow): PromptTestResult {
  return {
    id: row.id,
    promptId: row.prompt_id,
    promptVersion: row.prompt_version,
    userId: row.user_id,
    systemPrompt: row.system_prompt,
    userPrompt: row.user_prompt,
    variables: row.variables ?? {},
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    responseContent: row.response_content,
    tokensUsed: row.tokens_used,
    estimatedCost: row.estimated_cost,
    rating: row.rating,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

/**
 * Type guard to check if a value is a valid PromptType
 * @param value - Value to check
 * @returns True if the value is a valid PromptType
 */
export function isValidPromptType(value: unknown): value is PromptType {
  return typeof value === 'string' && PROMPT_TYPE_VALUES.includes(value as PromptTypeValue)
}

/**
 * Type guard to check if a value is a valid PromptFeature
 * @param value - Value to check
 * @returns True if the value is a valid PromptFeature
 */
export function isValidPromptFeature(value: unknown): value is PromptFeature {
  return (
    typeof value === 'string' &&
    ['remix', 'compose', 'carousel', 'playground'].includes(value)
  )
}
