"use client"

/**
 * Prompt Playground
 * @description Interactive prompt testing surface with variable management,
 * template library, response comparison, model parameter controls, run history,
 * and database integration for prompt versioning and activation.
 * Features raw JSON output view, export functionality, syntax highlighting,
 * and connection to the unified prompt management system.
 * @module components/features/prompt-playground
 */

import * as React from "react"
import {
  IconSparkles,
  IconCopy,
  IconRefresh,
  IconLayoutGrid,
  IconVariable,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconHistory,
  IconSearch,
  IconBookmark,
  IconPlayerPlay,
  IconSettings,
  IconColumns,
  IconX,
  IconClock,
  IconCoin,
  IconLoader2,
  IconDownload,
  IconCode,
  IconFileText,
  IconCheck,
  IconDeviceFloppy,
  IconCircleCheck,
  IconVersions,
  IconArrowBackUp,
  IconPencil,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import { useRouter } from "next/navigation"
import { useDraft } from "@/lib/store/draft-context"
import { trackFeatureUsed, trackAIGeneration } from "@/lib/analytics"
import { TONE_OPTIONS, type RemixTone, getRemixSystemPrompt } from "@/lib/ai/remix-prompts"
import {
  usePromptHistory,
  type PromptHistoryEntry,
} from "@/hooks/use-prompt-history"
import { usePrompts, useActivePrompt } from "@/hooks/use-prompts"
import { usePromptEditor } from "@/hooks/use-prompt-editor"
import { usePromptVersions } from "@/hooks/use-prompt-versions"
import { PromptType, type SystemPrompt, type PromptVariable } from "@/lib/prompts/prompt-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Prompt playground modes */
type PromptMode = "wording" | "carousel"

/** Output view tab type */
type OutputViewTab = "formatted" | "json"

/** API response shape */
interface PlaygroundResponse {
  content: string
  metadata?: {
    model?: string
    tokensUsed?: number
    promptTokens?: number
    completionTokens?: number
    finishReason?: string
    estimatedCost?: number
    temperature?: number
    maxTokens?: number
    topP?: number
  }
}

/** Complete run result for export */
interface PlaygroundRunResult {
  timestamp: string
  systemPrompt: string
  userPrompt: string
  variables: Record<string, string>
  model: string
  temperature: number
  maxTokens: number
  topP: number
  response: {
    content: string
    metadata?: PlaygroundResponse["metadata"]
  }
}

/** A single comparison result */
interface ComparisonResult {
  id: string
  content: string
  metadata?: PlaygroundResponse["metadata"]
  timestamp: string
}

/** Template variable key-value pair */
interface TemplateVariable {
  key: string
  value: string
}

/** Prompt template definition */
interface PromptTemplate {
  id: string
  name: string
  category: string
  description: string
  systemPrompt: string
  userPrompt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VARIABLES_STORAGE_KEY = "chainlinked_prompt_variables"

const DEFAULT_CAROUSEL_SYSTEM_PROMPT = `You are a LinkedIn carousel strategist.
Your task is to produce a concise slide-by-slide outline for a LinkedIn carousel.

Output format:
- Slide 1: Title slide with a bold hook
- Slides 2-6: Content slides with clear, skimmable points
- Final slide: CTA + engagement question

Rules:
- Each slide should have a short title and 2-4 bullet points
- Keep language professional, punchy, and readable
- Avoid emojis and excessive hashtags
- Return plain text only` as const

const DEFAULT_CAROUSEL_USER_TEMPLATE = `Topic: {{topic}}
Audience: LinkedIn professionals
Slide count: {{slide_count}}
Additional instructions: {{instructions}}

Generate the carousel outline now.` as const

/** Default common variables for new users */
const DEFAULT_VARIABLES: TemplateVariable[] = [
  { key: "topic", value: "" },
  { key: "industry", value: "" },
  { key: "tone", value: "professional" },
  { key: "audience", value: "LinkedIn professionals" },
  { key: "word_count", value: "200" },
]

/** Available model options */
const MODEL_OPTIONS = [
  { value: "openai/gpt-5.4", label: "GPT-5.4" },
  { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "openai/gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
] as const

/** Built-in prompt templates */
const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "linkedin-hook",
    name: "LinkedIn Hook Generator",
    category: "Hook Writing",
    description: "Create attention-grabbing opening lines for LinkedIn posts",
    systemPrompt: `You are an expert LinkedIn copywriter specializing in scroll-stopping hooks.
Generate 5 different opening hooks for a LinkedIn post about the given topic.
Each hook should use a different technique: question, bold statement, statistic, story opener, or contrarian take.
Return only the hooks, numbered 1-5.`,
    userPrompt: `Topic: {{topic}}
Industry: {{industry}}
Tone: {{tone}}

Generate 5 LinkedIn hooks now.`,
  },
  {
    id: "linkedin-post",
    name: "Full LinkedIn Post",
    category: "LinkedIn Post",
    description: "Generate a complete LinkedIn post with hook, body, and CTA",
    systemPrompt: `You are a LinkedIn content strategist. Write a complete LinkedIn post that follows best practices:
- Strong opening hook (first line must grab attention)
- Use short paragraphs and white space
- Include a clear call-to-action
- Keep it between {{word_count}} words
- Professional but engaging tone
Return only the post content.`,
    userPrompt: `Topic: {{topic}}
Target audience: {{audience}}
Tone: {{tone}}
Key message or insight to convey: {{instructions}}

Write the LinkedIn post now.`,
  },
  {
    id: "carousel-outline",
    name: "Carousel Outline",
    category: "Carousel",
    description: "Generate a structured carousel outline with slide-by-slide content",
    systemPrompt: DEFAULT_CAROUSEL_SYSTEM_PROMPT,
    userPrompt: DEFAULT_CAROUSEL_USER_TEMPLATE,
  },
  {
    id: "cta-generator",
    name: "CTA Generator",
    category: "CTA",
    description: "Create compelling calls-to-action for LinkedIn posts",
    systemPrompt: `You are a conversion copywriting expert for LinkedIn.
Generate 5 different calls-to-action (CTAs) for a LinkedIn post.
Each CTA should encourage a different engagement type: comment, share, save, follow, or click.
Make each CTA feel natural and non-pushy.
Return only the CTAs, numbered 1-5.`,
    userPrompt: `Post topic: {{topic}}
Industry: {{industry}}
Desired action: Engagement
Audience: {{audience}}

Generate 5 CTAs now.`,
  },
  {
    id: "engagement-question",
    name: "Engagement Questions",
    category: "Engagement",
    description: "Generate discussion-sparking questions to boost post engagement",
    systemPrompt: `You are a LinkedIn engagement strategist.
Generate 5 thought-provoking questions related to the topic that will spark discussion in the comments.
Each question should target a different angle: experience-based, opinion, prediction, challenge, or recommendation.
Return only the questions, numbered 1-5.`,
    userPrompt: `Topic: {{topic}}
Industry: {{industry}}
Audience: {{audience}}

Generate 5 engagement questions now.`,
  },
  {
    id: "remix-professional",
    name: "Professional Remix",
    category: "Remix",
    description: "Rewrite content in a polished, authoritative professional tone",
    systemPrompt: `You are an expert LinkedIn content editor. Rewrite the given content in a professional, authoritative tone.
Maintain the core message but elevate the language, structure, and impact.
Follow LinkedIn best practices for formatting.
Return only the rewritten content.`,
    userPrompt: `Original content:
{{content}}

Additional instructions: {{instructions}}

Rewrite in a professional tone now.`,
  },
  {
    id: "remix-storytelling",
    name: "Storytelling Remix",
    category: "Remix",
    description: "Transform content into a narrative-driven story format",
    systemPrompt: `You are a LinkedIn storytelling expert. Transform the given content into a compelling narrative format.
Use the classic story arc: hook, tension/challenge, resolution, lesson learned.
Make it personal and relatable while keeping the professional context.
Return only the rewritten content.`,
    userPrompt: `Original content:
{{content}}

Audience: {{audience}}
Additional instructions: {{instructions}}

Rewrite as a story now.`,
  },
  {
    id: "listicle",
    name: "Listicle Post",
    category: "LinkedIn Post",
    description: "Create a numbered list post with actionable items",
    systemPrompt: `You are a LinkedIn content creator specializing in list-format posts.
Create a listicle post with a strong hook, numbered items, and a closing CTA.
Each item should be concise but valuable, with a bold title and 1-2 sentence explanation.
Return only the post content.`,
    userPrompt: `Topic: {{topic}}
Number of items: 7
Industry: {{industry}}
Audience: {{audience}}
Tone: {{tone}}

Create the listicle post now.`,
  },
  {
    id: "contrarian-take",
    name: "Contrarian Take",
    category: "Hook Writing",
    description: "Generate a thought-provoking contrarian perspective post",
    systemPrompt: `You are a LinkedIn thought leader known for challenging conventional wisdom.
Write a contrarian take post that respectfully challenges a common belief in the given industry.
Structure: Bold contrarian statement, supporting evidence/reasoning, nuanced conclusion, discussion question.
Return only the post content.`,
    userPrompt: `Industry: {{industry}}
Topic/Common belief to challenge: {{topic}}
Audience: {{audience}}
Tone: {{tone}}

Write the contrarian take now.`,
  },
  {
    id: "value-thread",
    name: "Value Thread",
    category: "LinkedIn Post",
    description: "Create a thread-style educational post packed with value",
    systemPrompt: `You are a LinkedIn educator. Write a thread-style post that delivers maximum value.
Format with clear sections, each starting with a bold statement or emoji marker.
Include practical tips, frameworks, or actionable advice.
End with a strong CTA that encourages saves and shares.
Return only the post content.`,
    userPrompt: `Topic: {{topic}}
Key takeaways to cover: {{instructions}}
Industry: {{industry}}
Target audience: {{audience}}
Approximate word count: {{word_count}}

Write the value thread now.`,
  },
]

/** Unique categories extracted from templates */
const TEMPLATE_CATEGORIES = Array.from(
  new Set(PROMPT_TEMPLATES.map((t) => t.category))
)

/** Prompt type options grouped by category */
const PROMPT_TYPE_OPTIONS = [
  {
    label: "Remix Prompts",
    options: [
      { value: PromptType.REMIX_PROFESSIONAL, label: "Professional" },
      { value: PromptType.REMIX_CASUAL, label: "Casual" },
      { value: PromptType.REMIX_INSPIRING, label: "Inspiring" },
      { value: PromptType.REMIX_EDUCATIONAL, label: "Educational" },
      { value: PromptType.REMIX_THOUGHT_PROVOKING, label: "Thought-Provoking" },
      { value: PromptType.REMIX_MATCH_STYLE, label: "Match Style" },
    ],
  },
  {
    label: "Post Type Prompts",
    options: [
      { value: PromptType.POST_STORY, label: "Story" },
      { value: PromptType.POST_LISTICLE, label: "Listicle" },
      { value: PromptType.POST_HOW_TO, label: "How-To" },
      { value: PromptType.POST_CONTRARIAN, label: "Contrarian" },
      { value: PromptType.POST_CASE_STUDY, label: "Case Study" },
      { value: PromptType.POST_REFLECTION, label: "Reflection" },
      { value: PromptType.POST_DATA_DRIVEN, label: "Data-Driven" },
      { value: PromptType.POST_QUESTION, label: "Question" },
      { value: PromptType.POST_CAROUSEL, label: "Carousel Post" },
    ],
  },
  {
    label: "Carousel Prompts",
    options: [
      { value: PromptType.CAROUSEL_SYSTEM, label: "Carousel System" },
      { value: PromptType.CAROUSEL_USER_TEMPLATE, label: "Carousel User Template" },
    ],
  },
  {
    label: "Shared Prompts",
    options: [
      { value: PromptType.BASE_RULES, label: "Base Rules" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a user prompt by replacing {{placeholder}} tokens with values
 * @param template - Prompt template string
 * @param values - Placeholder replacements
 * @returns Filled user prompt
 */
function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value)
  }, template)
}

/**
 * Loads persisted variables from localStorage
 * @returns Saved variables or default set
 */
function loadVariables(): TemplateVariable[] {
  if (typeof window === "undefined") return DEFAULT_VARIABLES
  try {
    const raw = localStorage.getItem(VARIABLES_STORAGE_KEY)
    if (!raw) return DEFAULT_VARIABLES
    const parsed = JSON.parse(raw) as TemplateVariable[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VARIABLES
  } catch {
    return DEFAULT_VARIABLES
  }
}

/**
 * Saves variables to localStorage
 * @param variables - Variables to persist
 */
function saveVariables(variables: TemplateVariable[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(VARIABLES_STORAGE_KEY, JSON.stringify(variables))
  } catch {
    // silently fail if storage is full
  }
}

/**
 * Formats a cost value as a USD string
 * @param cost - Cost in USD
 * @returns Formatted string like "$0.0012"
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(3)}`
}

/**
 * Formats a date string into a short human-readable form
 * @param iso - ISO date string
 * @returns Short date string
 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Formats JSON with syntax highlighting using CSS classes
 * @param obj - Object to format as JSON
 * @returns Formatted JSON string with HTML markup for highlighting
 */
function formatJsonWithHighlighting(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2)
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span class="text-blue-500 dark:text-blue-400">"$1"</span>:')
    .replace(/: "([^"]*)"(,?)/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>$2')
    .replace(/: (true|false)(,?)/g, ': <span class="text-purple-500 dark:text-purple-400">$1</span>$2')
    .replace(/: (null)(,?)/g, ': <span class="text-gray-500 dark:text-gray-400">$1</span>$2')
    .replace(/: (\d+\.?\d*)(,?)/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>$2')
}

/**
 * Exports run result as a JSON file download
 * @param result - The run result to export
 * @param filename - Optional filename (defaults to timestamped name)
 */
function exportAsJson(result: PlaygroundRunResult, filename?: string): void {
  const jsonString = JSON.stringify(result, null, 2)
  const blob = new Blob([jsonString], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || `prompt-run-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exports run result as a Markdown file download
 * @param result - The run result to export
 * @param filename - Optional filename
 */
function exportAsMarkdown(result: PlaygroundRunResult, filename?: string): void {
  const markdown = `# Prompt Playground Run

## Metadata
- **Timestamp**: ${result.timestamp}
- **Model**: ${result.model}
- **Temperature**: ${result.temperature}
- **Max Tokens**: ${result.maxTokens}
- **Top-P**: ${result.topP}

## System Prompt
\`\`\`
${result.systemPrompt}
\`\`\`

## User Prompt
\`\`\`
${result.userPrompt}
\`\`\`

## Variables
${Object.entries(result.variables).map(([k, v]) => `- **${k}**: ${v}`).join("\n")}

## Response
${result.response.content}

## Token Usage
- Prompt Tokens: ${result.response.metadata?.promptTokens ?? "N/A"}
- Completion Tokens: ${result.response.metadata?.completionTokens ?? "N/A"}
- Total Tokens: ${result.response.metadata?.tokensUsed ?? "N/A"}
- Estimated Cost: ${result.response.metadata?.estimatedCost !== undefined ? formatCost(result.response.metadata.estimatedCost) : "N/A"}
`
  const blob = new Blob([markdown], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || `prompt-run-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Gets display name for a prompt type
 * @param type - The prompt type
 * @returns Human-readable label
 */
function getPromptTypeLabel(type: PromptType): string {
  for (const group of PROMPT_TYPE_OPTIONS) {
    const option = group.options.find((o) => o.value === type)
    if (option) return `${group.label} - ${option.label}`
  }
  return type
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Variable Management Panel - collapsible panel for managing template variables
 * @param props - Component props
 * @param props.variables - Current variables
 * @param props.onChange - Callback when variables change
 * @returns Collapsible panel for managing template variables
 */
function VariablePanel({
  variables,
  onChange,
}: {
  variables: TemplateVariable[]
  onChange: (vars: TemplateVariable[]) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  /**
   * Adds a new empty variable row
   */
  const handleAdd = () => {
    onChange([...variables, { key: "", value: "" }])
  }

  /**
   * Updates a variable at the given index
   * @param index - Variable index
   * @param field - Which field to update
   * @param val - New value
   */
  const handleUpdate = (index: number, field: "key" | "value", val: string) => {
    const updated = variables.map((v, i) =>
      i === index ? { ...v, [field]: val } : v
    )
    onChange(updated)
  }

  /**
   * Removes a variable at the given index
   * @param index - Variable index to remove
   */
  const handleRemove = (index: number) => {
    onChange(variables.filter((_, i) => i !== index))
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <IconVariable className="size-4" />
            Variables
            <Badge variant="secondary" className="text-xs">
              {variables.filter((v) => v.key.trim()).length}
            </Badge>
          </span>
          {isOpen ? (
            <IconChevronDown className="size-4" />
          ) : (
            <IconChevronRight className="size-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          Define variables using {"{{variable_name}}"} syntax in your prompts.
        </p>
        <div className="space-y-2">
          {variables.map((variable, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="key"
                value={variable.key}
                onChange={(e) => handleUpdate(index, "key", e.target.value)}
                className="h-8 flex-1 font-mono text-xs"
              />
              <Input
                placeholder="value"
                value={variable.value}
                onChange={(e) => handleUpdate(index, "value", e.target.value)}
                className="h-8 flex-[2] text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0"
                onClick={() => handleRemove(index)}
              >
                <IconTrash className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
          <IconPlus className="size-3.5" />
          Add Variable
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Template Library Sidebar using a Sheet component
 * @param props - Component props
 * @param props.onSelect - Callback when a template is selected
 * @returns Sheet component with searchable template library
 */
function TemplateLibrary({
  onSelect,
}: {
  onSelect: (template: PromptTemplate) => void
}) {
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState<string>("all")

  const filtered = React.useMemo(() => {
    let list = PROMPT_TEMPLATES
    if (category !== "all") {
      list = list.filter((t) => t.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [search, category])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBookmark className="size-4" />
          Templates
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Prompt Templates</SheetTitle>
          <SheetDescription>
            Pre-built templates for common LinkedIn content tasks.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 px-4">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={category === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory("all")}
            >
              All
            </Badge>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={category === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
        <Separator className="my-3" />
        <ScrollArea className="flex-1 px-4" style={{ height: "calc(100vh - 260px)" }}>
          <div className="space-y-2 pb-4">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No templates found.
              </p>
            )}
            {filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                onClick={() => onSelect(template)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{template.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {template.category}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70 line-clamp-1">
                  {template.userPrompt.slice(0, 80)}...
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Model and parameter controls panel with sliders for temperature, max tokens, and top-p
 * @param props - Component props
 * @returns Collapsible panel with model/parameter sliders
 */
function ModelControls({
  model,
  onModelChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  topP,
  onTopPChange,
}: {
  model: string
  onModelChange: (m: string) => void
  temperature: number
  onTemperatureChange: (t: number) => void
  maxTokens: number
  onMaxTokensChange: (t: number) => void
  topP: number
  onTopPChange: (t: number) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <IconSettings className="size-4" />
            Model &amp; Parameters
            <Badge variant="secondary" className="text-xs">
              {MODEL_OPTIONS.find((m) => m.value === model)?.label ?? "GPT-4.1"}
            </Badge>
          </span>
          {isOpen ? (
            <IconChevronDown className="size-4" />
          ) : (
            <IconChevronRight className="size-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Model</Label>
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Temperature</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[temperature]}
            onValueChange={([v]) => onTemperatureChange(v)}
            min={0}
            max={2}
            step={0.1}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Max Tokens</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {maxTokens}
            </span>
          </div>
          <Slider
            value={[maxTokens]}
            onValueChange={([v]) => onMaxTokensChange(v)}
            min={100}
            max={4000}
            step={100}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Top-p</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {topP.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[topP]}
            onValueChange={([v]) => onTopPChange(v)}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Prompt History panel - shows searchable, collapsible list of past runs
 * @param props - Component props
 * @param props.entries - All history entries
 * @param props.onLoad - Load a history entry config into the editor
 * @param props.onRerun - Re-run a previous prompt
 * @param props.onDelete - Delete a single history entry
 * @param props.onClearAll - Clear all history
 * @returns Collapsible panel showing run history
 */
function HistoryPanel({
  entries,
  onLoad,
  onRerun,
  onDelete,
  onClearAll,
}: {
  entries: PromptHistoryEntry[]
  onLoad: (entry: PromptHistoryEntry) => void
  onRerun: (entry: PromptHistoryEntry) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(
      (e) =>
        e.systemPrompt.toLowerCase().includes(q) ||
        e.userPrompt.toLowerCase().includes(q) ||
        e.response.toLowerCase().includes(q)
    )
  }, [entries, search])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <IconHistory className="size-4" />
            History
            <Badge variant="secondary" className="text-xs">
              {entries.length}
            </Badge>
          </span>
          {isOpen ? (
            <IconChevronDown className="size-4" />
          ) : (
            <IconChevronRight className="size-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {entries.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search history..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={onClearAll}
              >
                Clear all
              </Button>
            </div>
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-2 rounded-md border p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {entry.userPrompt.slice(0, 60)}
                        {entry.userPrompt.length > 60 ? "..." : ""}
                      </p>
                      <p className="mt-0.5 text-muted-foreground truncate">
                        {entry.response.slice(0, 50)}...
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <IconClock className="size-3" />
                          {formatDate(entry.timestamp)}
                        </span>
                        {entry.tokenUsage && (
                          <span>{entry.tokenUsage.totalTokens} tokens</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0"
                        onClick={() => onLoad(entry)}
                        title="Load configuration"
                      >
                        <IconBookmark className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0"
                        onClick={() => onRerun(entry)}
                        title="Re-run prompt"
                      >
                        <IconPlayerPlay className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete(entry.id)}
                        title="Delete entry"
                      >
                        <IconTrash className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No matching entries.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
        {entries.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No history yet. Run a prompt to start recording.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Response Comparison View - side-by-side display of multiple prompt results
 * @param props - Component props
 * @param props.results - Array of comparison results
 * @param props.onRunAgain - Callback to re-run the same prompt
 * @param props.onCopy - Callback to copy a result
 * @param props.onClear - Callback to clear comparison results
 * @param props.isRunning - Whether a run is currently in progress
 * @returns Side-by-side response comparison UI
 */
function ComparisonView({
  results,
  onRunAgain,
  onCopy,
  onClear,
  isRunning,
}: {
  results: ComparisonResult[]
  onRunAgain: () => void
  onCopy: (text: string) => void
  onClear: () => void
  isRunning: boolean
}) {
  if (results.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconColumns className="size-5" />
            Response Comparison
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRunAgain}
              disabled={isRunning}
            >
              <IconRefresh className={cn("size-3.5", isRunning && "animate-spin")} />
              Run Again
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <IconX className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
        <CardDescription>
          {results.length} result{results.length !== 1 ? "s" : ""} generated.
          Run the same prompt multiple times to compare outputs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result, idx) => (
            <div
              key={result.id}
              className="space-y-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  Run {idx + 1}
                </Badge>
                <div className="flex items-center gap-2">
                  {result.metadata?.estimatedCost !== undefined && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <IconCoin className="size-3" />
                      {formatCost(result.metadata.estimatedCost)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0"
                    onClick={() => onCopy(result.content)}
                  >
                    <IconCopy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="max-h-64">
                <p className="whitespace-pre-wrap text-sm">{result.content}</p>
              </ScrollArea>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{formatDate(result.timestamp)}</span>
                {result.metadata?.tokensUsed && (
                  <span>{result.metadata.tokensUsed} tokens</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Token usage display shown after a run
 * @param props - Component props
 * @param props.metadata - Metadata from the API response
 * @returns Inline token usage badges
 */
function TokenUsageDisplay({
  metadata,
}: {
  metadata?: PlaygroundResponse["metadata"]
}) {
  if (!metadata) return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {metadata.model && (
        <Badge variant="outline" className="text-[10px]">
          {metadata.model}
        </Badge>
      )}
      {metadata.promptTokens !== undefined && (
        <span>Prompt: {metadata.promptTokens}</span>
      )}
      {metadata.completionTokens !== undefined && (
        <span>Completion: {metadata.completionTokens}</span>
      )}
      {metadata.tokensUsed !== undefined && (
        <span className="font-medium">Total: {metadata.tokensUsed}</span>
      )}
      {metadata.estimatedCost !== undefined && (
        <span className="flex items-center gap-0.5">
          <IconCoin className="size-3" />
          {formatCost(metadata.estimatedCost)}
        </span>
      )}
    </div>
  )
}

/**
 * JSON output view with syntax highlighting
 * @param props - Component props
 * @param props.data - Object to display as JSON
 * @returns Syntax-highlighted JSON display
 */
function JsonOutputView({ data }: { data: unknown }) {
  const formattedJson = React.useMemo(() => formatJsonWithHighlighting(data), [data])
  const rawJson = React.useMemo(() => JSON.stringify(data, null, 2), [data])
  const [copied, setCopied] = React.useState(false)

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(rawJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-lg border bg-muted/30">
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          onClick={handleCopyJson}
          title="Copy JSON"
        >
          {copied ? (
            <IconCheck className="size-3.5 text-green-500" />
          ) : (
            <IconCopy className="size-3.5" />
          )}
        </Button>
      </div>
      <ScrollArea className="max-h-[400px]">
        <pre
          className="p-4 font-mono text-xs leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formattedJson }}
        />
      </ScrollArea>
    </div>
  )
}

/**
 * Export menu component for downloading run results
 * @param props - Component props
 * @param props.result - The run result to export
 * @param props.disabled - Whether export is disabled
 * @returns Export dropdown menu
 */
function ExportMenu({
  result,
  disabled,
}: {
  result: PlaygroundRunResult | null
  disabled: boolean
}) {
  const handleExportJson = () => {
    if (result) {
      exportAsJson(result)
      toast.success("Exported as JSON")
    }
  }

  const handleExportMarkdown = () => {
    if (result) {
      exportAsMarkdown(result)
      toast.success("Exported as Markdown")
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <IconDownload className="size-4" />
          Export
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Export Run Result</SheetTitle>
          <SheetDescription>
            Download the current prompt run in your preferred format.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            onClick={handleExportJson}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <IconCode className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">JSON</p>
                <p className="text-xs text-muted-foreground">
                  Full structured data, ideal for programmatic use
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            onClick={handleExportMarkdown}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                <IconFileText className="size-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Markdown</p>
                <p className="text-xs text-muted-foreground">
                  Human-readable format for documentation
                </p>
              </div>
            </div>
          </button>
        </div>
        {result && (
          <>
            <Separator className="my-6" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Model: {result.model}
                </p>
                <p className="text-xs text-muted-foreground">
                  Timestamp: {formatDate(result.timestamp)}
                </p>
                <p className="mt-2 text-xs line-clamp-3">
                  {result.response.content.slice(0, 150)}...
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Version History Sheet - shows version history for a database prompt
 * @param props - Component props
 * @param props.promptId - The ID of the prompt to show versions for
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Callback when open state changes
 * @param props.onRollback - Callback when a version is rolled back to
 * @returns Sheet component with version history
 */
function VersionHistorySheet({
  promptId,
  open,
  onOpenChange,
  onRollback,
}: {
  promptId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRollback: () => void
}) {
  const {
    versions,
    isLoading,
    currentVersion,
    promptName,
    rollbackToVersion,
    isRollingBack,
  } = usePromptVersions(promptId)

  const handleRollback = async (version: number) => {
    const success = await rollbackToVersion(version)
    if (success) {
      onRollback()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconVersions className="size-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            {promptName ? (
              <>View and rollback to previous versions of &quot;{promptName}&quot;.</>
            ) : (
              <>View and rollback to previous versions of this prompt.</>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {currentVersion !== null && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">
                Current version: <span className="font-medium text-foreground">{currentVersion}</span>
              </p>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No version history available.
            </p>
          ) : (
            <ScrollArea className="h-[calc(100vh-240px)]">
              <div className="space-y-3 pr-4">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      version.version === currentVersion && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={version.version === currentVersion ? "default" : "secondary"}>
                          v{version.version}
                        </Badge>
                        {version.version === currentVersion && (
                          <Badge variant="outline" className="text-[10px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    {version.changeNotes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {version.changeNotes}
                      </p>
                    )}
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground/70 line-clamp-2">
                      {version.content.slice(0, 150)}...
                    </p>
                    {version.version !== currentVersion && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => handleRollback(version.version)}
                        disabled={isRollingBack}
                      >
                        {isRollingBack ? (
                          <IconLoader2 className="size-3.5 animate-spin" />
                        ) : (
                          <IconArrowBackUp className="size-3.5" />
                        )}
                        Rollback to v{version.version}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Save New Prompt Dialog - dialog for saving a new prompt to the database
 * @param props - Component props
 * @returns Dialog component for creating a new prompt
 */
function SaveNewPromptDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  defaultContent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    type: PromptType
    name: string
    description: string
    content: string
    setActive: boolean
  }) => void
  isSaving: boolean
  defaultContent: string
}) {
  const [promptType, setPromptType] = React.useState<PromptType | "">("")
  const [promptName, setPromptName] = React.useState("")
  const [promptDescription, setPromptDescription] = React.useState("")
  const [setAsActive, setSetAsActive] = React.useState(false)

  const handleSave = () => {
    if (!promptType || !promptName.trim()) {
      toast.error("Please fill in required fields")
      return
    }
    onSave({
      type: promptType as PromptType,
      name: promptName,
      description: promptDescription,
      content: defaultContent,
      setActive: setAsActive,
    })
  }

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setPromptType("")
      setPromptName("")
      setPromptDescription("")
      setSetAsActive(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save New Prompt</DialogTitle>
          <DialogDescription>
            Save your custom prompt to the database for future use.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt-type">Prompt Type *</Label>
            <Select value={promptType} onValueChange={(v) => setPromptType(v as PromptType)}>
              <SelectTrigger id="prompt-type">
                <SelectValue placeholder="Select prompt type..." />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_TYPE_OPTIONS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-name">Name *</Label>
            <Input
              id="prompt-name"
              placeholder="My Custom Prompt"
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-description">Description</Label>
            <Textarea
              id="prompt-description"
              placeholder="Describe what this prompt does..."
              value={promptDescription}
              onChange={(e) => setPromptDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={setAsActive} onCheckedChange={setSetAsActive} />
            <Label className="text-sm font-normal">
              Set as active prompt for this type
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !promptType || !promptName.trim()}>
            {isSaving ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDeviceFloppy className="size-4" />
            )}
            Save Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Database Prompt Selector - dropdown to select a prompt type and load from database
 * @param props - Component props
 * @returns Select component for choosing database prompts
 */
function DatabasePromptSelector({
  selectedType,
  onSelectType,
  isLoading,
  loadedPrompt,
}: {
  selectedType: PromptType | null
  onSelectType: (type: PromptType | null) => void
  isLoading: boolean
  loadedPrompt: SystemPrompt | null
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Load from Database</Label>
        {isLoading && <IconLoader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <Select
        value={selectedType ?? "none"}
        onValueChange={(v) => onSelectType(v === "none" ? null : v as PromptType)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a prompt type to load..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- None (use custom/template) --</SelectItem>
          {PROMPT_TYPE_OPTIONS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {loadedPrompt && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{loadedPrompt.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                v{loadedPrompt.version}
              </Badge>
              {loadedPrompt.isActive && (
                <Badge variant="default" className="text-[10px]">
                  Active
                </Badge>
              )}
            </div>
          </div>
          {loadedPrompt.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {loadedPrompt.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Prompt Playground component
 * @description Full-featured prompt experimentation UI with variable management,
 * template library, response comparison, model controls, run history, and
 * database integration for versioning and activation.
 * @returns Prompt playground UI
 */
export function PromptPlayground() {
  const router = useRouter()
  const { setContent } = useDraft()

  // Mode & content state
  const [mode, setMode] = React.useState<PromptMode>("wording")
  const [source, setSource] = React.useState("")
  const [instructions, setInstructions] = React.useState("")
  const [tone, setTone] = React.useState<RemixTone>("professional")
  const [length, setLength] = React.useState<"short" | "medium" | "long">("medium")
  const [slideCount, setSlideCount] = React.useState("7")

  // Custom prompt state
  const [useCustomPrompt, setUseCustomPrompt] = React.useState(false)
  const [systemPrompt, setSystemPrompt] = React.useState<string>(DEFAULT_CAROUSEL_SYSTEM_PROMPT)
  const [userPrompt, setUserPrompt] = React.useState<string>(DEFAULT_CAROUSEL_USER_TEMPLATE)

  // Output state
  const [output, setOutput] = React.useState("")
  const [lastMetadata, setLastMetadata] = React.useState<PlaygroundResponse["metadata"]>()
  const [isRunning, setIsRunning] = React.useState(false)
  const [outputViewTab, setOutputViewTab] = React.useState<OutputViewTab>("formatted")
  const [lastRunResult, setLastRunResult] = React.useState<PlaygroundRunResult | null>(null)

  // Variables
  const [variables, setVariables] = React.useState<TemplateVariable[]>(DEFAULT_VARIABLES)

  // Model controls
  const [model, setModel] = React.useState("openai/gpt-5.4")
  const [temperature, setTemperature] = React.useState(0.7)
  const [maxTokens, setMaxTokens] = React.useState(1200)
  const [topP, setTopP] = React.useState(1.0)

  // Comparison
  const [comparisonResults, setComparisonResults] = React.useState<ComparisonResult[]>([])
  const [comparisonMode, setComparisonMode] = React.useState(false)

  // History
  const { entries: historyEntries, addEntry, deleteEntry, clearAll } = usePromptHistory()

  // Database prompt integration
  const [selectedPromptType, setSelectedPromptType] = React.useState<PromptType | null>(null)
  const { activePrompt: loadedPrompt, isLoading: isLoadingPrompt, refetch: refetchPrompt } = useActivePrompt(selectedPromptType)

  // Prompt editor for save/activate operations
  const {
    prompt: editorPrompt,
    isDirty: editorIsDirty,
    isSaving,
    savePrompt: saveEditorPrompt,
    saveAsNew,
    activatePrompt,
    loadPrompt,
  } = usePromptEditor({ initialPrompt: loadedPrompt })

  // Version history sheet
  const [showVersionHistory, setShowVersionHistory] = React.useState(false)

  // Save new prompt dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)

  // Hydrate variables from localStorage on mount
  React.useEffect(() => {
    setVariables(loadVariables())
  }, [])

  /**
   * Persists variables to localStorage and updates state
   * @param vars - New variables to save
   */
  const handleVariablesChange = React.useCallback((vars: TemplateVariable[]) => {
    setVariables(vars)
    saveVariables(vars)
  }, [])

  // Update editor when database prompt loads
  React.useEffect(() => {
    if (loadedPrompt && selectedPromptType) {
      setSystemPrompt(loadedPrompt.content)
      setUseCustomPrompt(true)
    }
  }, [loadedPrompt, selectedPromptType])

  // Sync system/user prompts when mode or tone changes (only in non-custom mode and no DB prompt)
  React.useEffect(() => {
    if (useCustomPrompt) return
    if (selectedPromptType && loadedPrompt) return

    if (mode === "carousel") {
      setSystemPrompt(DEFAULT_CAROUSEL_SYSTEM_PROMPT)
      setUserPrompt(DEFAULT_CAROUSEL_USER_TEMPLATE)
      return
    }
    const prompt = getRemixSystemPrompt(tone, instructions)
    setSystemPrompt(prompt)
    setUserPrompt("Rewrite the following content in the selected tone:\n\n{{content}}")
  }, [mode, tone, instructions, useCustomPrompt, selectedPromptType, loadedPrompt])

  /**
   * Handles prompt type selection change
   * @param type - The selected prompt type or null
   */
  const handlePromptTypeChange = (type: PromptType | null) => {
    setSelectedPromptType(type)
    if (!type) {
      // Reset to default mode
      setUseCustomPrompt(false)
    }
  }

  /**
   * Builds the variable map from the current state for template substitution
   * @returns Record of variable key-value pairs
   */
  const buildVariableMap = React.useCallback((): Record<string, string> => {
    const map: Record<string, string> = {
      content: source,
      topic: source,
      instructions: instructions || "None",
      slide_count: slideCount || "7",
    }
    for (const v of variables) {
      if (v.key.trim()) {
        map[v.key.trim()] = v.value
      }
    }
    return map
  }, [source, instructions, slideCount, variables])

  /**
   * Executes a prompt run against the playground API
   * @param overrideSystem - Optional system prompt override
   * @param overrideUser - Optional user prompt override
   * @returns The API response with content and metadata
   */
  const executeRun = React.useCallback(
    async (overrideSystem?: string, overrideUser?: string) => {
      const effectiveSystem = overrideSystem ?? systemPrompt
      const effectiveUser = overrideUser ?? userPrompt
      const variableMap = buildVariableMap()
      const filledUserPrompt = fillTemplate(effectiveUser, variableMap)

      const response = await fetch("/api/ai/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: fillTemplate(effectiveSystem, variableMap),
          userPrompt: filledUserPrompt,
          model,
          temperature,
          maxTokens,
          topP,
        }),
      })

      const data = (await response.json()) as PlaygroundResponse & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to run prompt")
      }

      return data
    },
    [systemPrompt, userPrompt, buildVariableMap, model, temperature, maxTokens, topP]
  )

  /**
   * Runs the selected playground mode and records to history
   */
  const handleRun = async () => {
    if (!source.trim() && !useCustomPrompt) {
      toast.error(mode === "wording" ? "Paste content to enhance" : "Enter a topic")
      return
    }

    setIsRunning(true)
    setOutput("")
    setLastMetadata(undefined)

    try {
      let data: PlaygroundResponse & { error?: string }

      if (mode === "wording" && !useCustomPrompt) {
        const response = await fetch("/api/ai/remix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalContent: source,
            tone,
            length,
            customInstructions: instructions,
          }),
        })
        data = (await response.json()) as PlaygroundResponse & { error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to run prompt")
        }
      } else {
        data = await executeRun()
      }

      setOutput(data.content)
      setLastMetadata(data.metadata)

      // Save last run result for export
      const runResult: PlaygroundRunResult = {
        timestamp: new Date().toISOString(),
        systemPrompt,
        userPrompt,
        variables: buildVariableMap(),
        model,
        temperature,
        maxTokens,
        topP,
        response: {
          content: data.content,
          metadata: data.metadata,
        },
      }
      setLastRunResult(runResult)

      // Add to comparison results if comparison mode is active
      if (comparisonMode) {
        setComparisonResults((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            content: data.content,
            metadata: data.metadata,
            timestamp: new Date().toISOString(),
          },
        ])
      }

      // Record in history
      addEntry({
        systemPrompt,
        userPrompt,
        variables: buildVariableMap(),
        response: data.content,
        model,
        temperature,
        maxTokens,
        topP,
        tokenUsage: data.metadata
          ? {
              promptTokens: data.metadata.promptTokens ?? 0,
              completionTokens: data.metadata.completionTokens ?? 0,
              totalTokens: data.metadata.tokensUsed ?? 0,
            }
          : undefined,
      })

      trackFeatureUsed("prompt_playground")
      trackAIGeneration(mode === "carousel" ? "carousel" : "remix", "openrouter")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsRunning(false)
    }
  }

  /**
   * Handles the "Run Again" action in comparison mode
   */
  const handleRunAgain = async () => {
    if (isRunning) return
    setIsRunning(true)
    try {
      const data = await executeRun()
      setComparisonResults((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: data.content,
          metadata: data.metadata,
          timestamp: new Date().toISOString(),
        },
      ])

      addEntry({
        systemPrompt,
        userPrompt,
        variables: buildVariableMap(),
        response: data.content,
        model,
        temperature,
        maxTokens,
        topP,
        tokenUsage: data.metadata
          ? {
              promptTokens: data.metadata.promptTokens ?? 0,
              completionTokens: data.metadata.completionTokens ?? 0,
              totalTokens: data.metadata.tokensUsed ?? 0,
            }
          : undefined,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsRunning(false)
    }
  }

  /**
   * Copies text to clipboard and shows a toast
   * @param text - Text to copy (defaults to current output)
   */
  const handleCopy = async (text?: string) => {
    const content = text ?? output
    if (!content) return
    await navigator.clipboard.writeText(content)
    toast.success("Copied to clipboard")
  }

  /**
   * Resets prompts to defaults for the current mode
   */
  const handleResetPrompts = () => {
    setSelectedPromptType(null)
    if (mode === "carousel") {
      setSystemPrompt(DEFAULT_CAROUSEL_SYSTEM_PROMPT)
      setUserPrompt(DEFAULT_CAROUSEL_USER_TEMPLATE)
      return
    }
    setSystemPrompt(getRemixSystemPrompt(tone, instructions))
    setUserPrompt("Rewrite the following content in the selected tone:\n\n{{content}}")
  }

  /**
   * Loads a template into the editor, enabling custom prompt mode
   * @param template - Template to load
   */
  const handleLoadTemplate = (template: PromptTemplate) => {
    setSelectedPromptType(null)
    setUseCustomPrompt(true)
    setSystemPrompt(template.systemPrompt)
    setUserPrompt(template.userPrompt)
    toast.success(`Loaded "${template.name}" template`)
  }

  /**
   * Loads a history entry configuration back into the editor
   * @param entry - History entry to restore
   */
  const handleLoadHistory = (entry: PromptHistoryEntry) => {
    setSelectedPromptType(null)
    setUseCustomPrompt(true)
    setSystemPrompt(entry.systemPrompt)
    setUserPrompt(entry.userPrompt)
    setModel(entry.model)
    setTemperature(entry.temperature)
    setMaxTokens(entry.maxTokens)
    setTopP(entry.topP)
    if (entry.variables) {
      const vars = Object.entries(entry.variables).map(([key, value]) => ({
        key,
        value,
      }))
      if (vars.length > 0) handleVariablesChange(vars)
    }
    setOutput(entry.response)
    toast.success("Loaded history entry")
  }

  /**
   * Re-runs a previous prompt from history with its original settings
   * @param entry - History entry to re-run
   */
  const handleRerunHistory = async (entry: PromptHistoryEntry) => {
    setSelectedPromptType(null)
    setUseCustomPrompt(true)
    setSystemPrompt(entry.systemPrompt)
    setUserPrompt(entry.userPrompt)
    setModel(entry.model)
    setTemperature(entry.temperature)
    setMaxTokens(entry.maxTokens)
    setTopP(entry.topP)

    setIsRunning(true)
    setOutput("")
    setLastMetadata(undefined)
    try {
      const data = await executeRun(entry.systemPrompt, entry.userPrompt)
      setOutput(data.content)
      setLastMetadata(data.metadata)

      addEntry({
        systemPrompt: entry.systemPrompt,
        userPrompt: entry.userPrompt,
        variables: entry.variables,
        response: data.content,
        model: entry.model,
        temperature: entry.temperature,
        maxTokens: entry.maxTokens,
        topP: entry.topP,
        tokenUsage: data.metadata
          ? {
              promptTokens: data.metadata.promptTokens ?? 0,
              completionTokens: data.metadata.completionTokens ?? 0,
              totalTokens: data.metadata.tokensUsed ?? 0,
            }
          : undefined,
      })
      toast.success("Re-run complete")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsRunning(false)
    }
  }

  /**
   * Saves the current prompt as a new version in the database
   */
  const handleSaveAsVersion = async () => {
    if (!loadedPrompt) {
      // Open dialog to create new prompt
      setShowSaveDialog(true)
      return
    }

    // Update existing prompt
    const result = await saveEditorPrompt({
      content: systemPrompt,
      changeNotes: `Updated via Prompt Playground at ${new Date().toLocaleString()}`,
    })

    if (result) {
      refetchPrompt()
    }
  }

  /**
   * Handles saving a new prompt to the database
   */
  const handleSaveNewPrompt = async (data: {
    type: PromptType
    name: string
    description: string
    content: string
    setActive: boolean
  }) => {
    const result = await saveAsNew({
      type: data.type,
      name: data.name,
      description: data.description,
      content: data.content,
      setActive: data.setActive,
    })

    if (result) {
      setShowSaveDialog(false)
      setSelectedPromptType(data.type)
    }
  }

  /**
   * Handles activating the current prompt
   */
  const handleActivatePrompt = async () => {
    const success = await activatePrompt()
    if (success) {
      refetchPrompt()
    }
  }

  /**
   * Handles version history rollback
   */
  const handleVersionRollback = () => {
    refetchPrompt()
  }

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run prompt
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleRun()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, mode, useCustomPrompt, systemPrompt, userPrompt, model, temperature, maxTokens, topP])

  return (
    <div className="flex flex-col gap-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                Prompt Playground
              </CardTitle>
              <CardDescription>
                Experiment with prompt strategies for wording and carousel enhancements.
                Press <kbd className="rounded border px-1 py-0.5 text-[10px]">Ctrl</kbd>+
                <kbd className="rounded border px-1 py-0.5 text-[10px]">Enter</kbd> to run.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TemplateLibrary onSelect={handleLoadTemplate} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Database Prompt Selector and Actions */}
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
            <DatabasePromptSelector
              selectedType={selectedPromptType}
              onSelectType={handlePromptTypeChange}
              isLoading={isLoadingPrompt}
              loadedPrompt={loadedPrompt}
            />

            {/* Action buttons for database prompts */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsVersion}
                disabled={isSaving}
              >
                {isSaving ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="size-4" />
                )}
                {loadedPrompt ? "Save as Version" : "Save New Prompt"}
              </Button>

              {loadedPrompt && (
                <>
                  <Button
                    variant={loadedPrompt.isActive ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleActivatePrompt}
                    disabled={loadedPrompt.isActive}
                  >
                    {loadedPrompt.isActive ? (
                      <IconCircleCheck className="size-4" />
                    ) : (
                      <IconCheck className="size-4" />
                    )}
                    {loadedPrompt.isActive ? "Currently Active" : "Set as Active"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVersionHistory(true)}
                  >
                    <IconVersions className="size-4" />
                    Version History
                  </Button>
                </>
              )}

              {loadedPrompt && (
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Version: {loadedPrompt.version}</span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible controls strip: Variables, Model, History */}
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-3">
            <VariablePanel
              variables={variables}
              onChange={handleVariablesChange}
            />
            <Separator />
            <ModelControls
              model={model}
              onModelChange={setModel}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              maxTokens={maxTokens}
              onMaxTokensChange={setMaxTokens}
              topP={topP}
              onTopPChange={setTopP}
            />
            <Separator />
            <HistoryPanel
              entries={historyEntries}
              onLoad={handleLoadHistory}
              onRerun={handleRerunHistory}
              onDelete={deleteEntry}
              onClearAll={clearAll}
            />
          </div>

          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(value) => {
            setMode(value as PromptMode)
            trackFeatureUsed(`prompt_playground_mode_${value}`)
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wording">Wording Enhancement</TabsTrigger>
              <TabsTrigger value="carousel">Carousel Enhancement</TabsTrigger>
            </TabsList>
            <TabsContent value="wording" className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Content to improve</Label>
                  <Textarea
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Paste an existing post or draft..."
                    className="min-h-[160px]"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select
                      value={tone}
                      onValueChange={(value) => setTone(value as RemixTone)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Length</Label>
                    <Select
                      value={length}
                      onValueChange={(value) => setLength(value as typeof length)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select length" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="long">Long</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Custom instructions</Label>
                    <Textarea
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Add optional constraints or goals"
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="carousel" className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Carousel topic</Label>
                  <Input
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="e.g. 5 lessons from scaling a SaaS team"
                  />
                  <div className="space-y-2">
                    <Label>Slide count</Label>
                    <Input
                      value={slideCount}
                      onChange={(event) => setSlideCount(event.target.value)}
                      type="number"
                      min={3}
                      max={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Additional guidance</Label>
                    <Textarea
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Audience, tone, or constraints"
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
                <div className="flex h-full flex-col justify-between rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground">
                      <IconLayoutGrid className="size-4" />
                      Output format
                    </div>
                    <p>
                      Generates a slide-by-slide outline with titles and bullet points
                      that can be pasted into the carousel editor.
                    </p>
                  </div>
                  <div className="mt-6 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Tip
                    </p>
                    <p>
                      Keep slide titles under 8 words for visual clarity.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Custom prompt editor */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch checked={useCustomPrompt} onCheckedChange={setUseCustomPrompt} />
                <div>
                  <p className="text-sm font-medium">Custom prompt mode</p>
                  <p className="text-xs text-muted-foreground">
                    Edit the system and user prompts directly.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleResetPrompts}>
                <IconRefresh className="size-4" />
                Reset
              </Button>
            </div>

            {useCustomPrompt && (
              <>
                {isLoadingPrompt && selectedPromptType ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>System prompt</Label>
                      <Skeleton className="h-[200px] w-full" />
                    </div>
                    <div className="space-y-2">
                      <Label>User prompt</Label>
                      <Skeleton className="h-[200px] w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>System prompt</Label>
                      <Textarea
                        value={systemPrompt}
                        onChange={(event) => setSystemPrompt(event.target.value)}
                        className="min-h-[200px] font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>User prompt</Label>
                      <Textarea
                        value={userPrompt}
                        onChange={(event) => setUserPrompt(event.target.value)}
                        className="min-h-[200px] font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {"{{variable_name}}"} to inject variables. Available:{" "}
                        {variables
                          .filter((v) => v.key.trim())
                          .map((v) => `{{${v.key}}}`)
                          .join(", ") || "none defined"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button onClick={handleRun} disabled={isRunning}>
                {isRunning ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconSparkles className="size-4" />
                )}
                {isRunning ? "Running..." : "Run Prompt"}
              </Button>
              <div className="flex items-center gap-2">
                <Switch
                  checked={comparisonMode}
                  onCheckedChange={setComparisonMode}
                />
                <Label className="text-xs font-normal text-muted-foreground">
                  <IconColumns className="mr-1 inline size-3.5" />
                  Comparison mode
                </Label>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Uses your OpenRouter key if configured in Settings.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison View */}
      {comparisonMode && comparisonResults.length > 0 && (
        <ComparisonView
          results={comparisonResults}
          onRunAgain={handleRunAgain}
          onCopy={(text) => handleCopy(text)}
          onClear={() => setComparisonResults([])}
          isRunning={isRunning}
        />
      )}

      {/* Output Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Output</CardTitle>
              <CardDescription>Review, tweak, and copy the generated result.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {lastMetadata && <TokenUsageDisplay metadata={lastMetadata} />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRunning && !output && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <IconLoader2 className="size-8 animate-spin" />
                <p className="text-sm">Generating response...</p>
              </div>
            </div>
          )}
          {(!isRunning || output) && (
            <Tabs value={outputViewTab} onValueChange={(v) => setOutputViewTab(v as OutputViewTab)}>
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="formatted" className="gap-1.5">
                  <IconFileText className="size-3.5" />
                  Formatted
                </TabsTrigger>
                <TabsTrigger value="json" className="gap-1.5">
                  <IconCode className="size-3.5" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>
              <TabsContent value="formatted" className="mt-4">
                <Textarea
                  value={output}
                  onChange={(event) => setOutput(event.target.value)}
                  placeholder="Generated output will appear here..."
                  className="min-h-[220px]"
                />
              </TabsContent>
              <TabsContent value="json" className="mt-4">
                {lastRunResult ? (
                  <JsonOutputView data={lastRunResult} />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Run a prompt to see the JSON output
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleCopy()} disabled={!output}>
                <IconCopy className="size-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                disabled={!output}
                onClick={() => {
                  setContent(output)
                  toast.success("Loaded into Compose")
                  router.push("/dashboard/compose")
                }}
              >
                <IconPencil className="size-4" />
                Use in Compose
              </Button>
              <ExportMenu result={lastRunResult} disabled={!lastRunResult} />
            </div>
            <span className="text-xs text-muted-foreground">
              {output ? `${output.length} characters` : "Ready when you are"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Version History Sheet */}
      <VersionHistorySheet
        promptId={loadedPrompt?.id ?? null}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRollback={handleVersionRollback}
      />

      {/* Save New Prompt Dialog */}
      <SaveNewPromptDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveNewPrompt}
        isSaving={isSaving}
        defaultContent={systemPrompt}
      />
    </div>
  )
}
