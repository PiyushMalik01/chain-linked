/**
 * Template Library Constants
 * @description Shared constants for the template library feature
 * @module components/features/template-library/constants
 */

import * as React from "react"
import {
  IconBulb,
  IconListNumbers,
  IconMessageChatbot,
  IconRoute,
} from "@tabler/icons-react"

import type { AITemplateCategory, TemplateFormData, TemplateSortBy } from "./types"

/**
 * Initial form state for creating a new template
 */
export const INITIAL_FORM_DATA: TemplateFormData = {
  name: "",
  content: "",
  category: "",
  tags: "",
  isPublic: false,
}

/**
 * Default AI suggestion context mapped by template category.
 * Used to pre-fill the AI generation panel when a template is used.
 */
export const CATEGORY_AI_DEFAULTS: Record<string, { topic: string; tone: string }> = {
  "Thought Leadership": {
    topic: "Share an expert insight about [your field]",
    tone: "thought-provoking",
  },
  "Personal Story": {
    topic: "Tell a personal story about [your experience]",
    tone: "inspiring",
  },
  "How-To": {
    topic: "Teach your audience how to [achieve a specific result]",
    tone: "educational",
  },
  "Engagement": {
    topic: "Start a conversation about [a trending topic in your industry]",
    tone: "casual",
  },
  "Sales": {
    topic: "Highlight the value of [your product/service]",
    tone: "professional",
  },
}

/**
 * Color configuration for each category
 * Includes border, badge, gradient, dot, and filter-active classes
 */
export interface CategoryColorConfig {
  /** 2px top border color class */
  border: string
  /** Badge background color class */
  badgeBg: string
  /** Badge text color class */
  badgeText: string
  /** Card gradient background */
  gradient: string
  /** Small dot color */
  dot: string
  /** Active filter pill color */
  filterActive: string
}

/**
 * Color map for the 5 default categories
 */
const CATEGORY_COLORS: Record<string, CategoryColorConfig> = {
  "Thought Leadership": {
    border: "border-t-blue-500/60",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-700 dark:text-blue-400",
    gradient: "from-blue-500/8 via-transparent to-transparent",
    dot: "bg-blue-500",
    filterActive: "bg-blue-500 text-white",
  },
  "Personal Story": {
    border: "border-t-violet-500/60",
    badgeBg: "bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-400",
    gradient: "from-violet-500/8 via-transparent to-transparent",
    dot: "bg-violet-500",
    filterActive: "bg-violet-500 text-white",
  },
  "How-To": {
    border: "border-t-emerald-500/60",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-400",
    gradient: "from-emerald-500/8 via-transparent to-transparent",
    dot: "bg-emerald-500",
    filterActive: "bg-emerald-500 text-white",
  },
  "Engagement": {
    border: "border-t-amber-500/60",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-700 dark:text-amber-400",
    gradient: "from-amber-500/8 via-transparent to-transparent",
    dot: "bg-amber-500",
    filterActive: "bg-amber-500 text-white",
  },
  "Sales": {
    border: "border-t-rose-500/60",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-700 dark:text-rose-400",
    gradient: "from-rose-500/8 via-transparent to-transparent",
    dot: "bg-rose-500",
    filterActive: "bg-rose-500 text-white",
  },
}

/**
 * Palette of colors for custom categories, assigned by deterministic hash
 */
const CUSTOM_PALETTES: CategoryColorConfig[] = [
  {
    border: "border-t-cyan-500/60",
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-700 dark:text-cyan-400",
    gradient: "from-cyan-500/8 via-transparent to-transparent",
    dot: "bg-cyan-500",
    filterActive: "bg-cyan-500 text-white",
  },
  {
    border: "border-t-pink-500/60",
    badgeBg: "bg-pink-500/15",
    badgeText: "text-pink-700 dark:text-pink-400",
    gradient: "from-pink-500/8 via-transparent to-transparent",
    dot: "bg-pink-500",
    filterActive: "bg-pink-500 text-white",
  },
  {
    border: "border-t-orange-500/60",
    badgeBg: "bg-orange-500/15",
    badgeText: "text-orange-700 dark:text-orange-400",
    gradient: "from-orange-500/8 via-transparent to-transparent",
    dot: "bg-orange-500",
    filterActive: "bg-orange-500 text-white",
  },
  {
    border: "border-t-teal-500/60",
    badgeBg: "bg-teal-500/15",
    badgeText: "text-teal-700 dark:text-teal-400",
    gradient: "from-teal-500/8 via-transparent to-transparent",
    dot: "bg-teal-500",
    filterActive: "bg-teal-500 text-white",
  },
  {
    border: "border-t-indigo-500/60",
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-700 dark:text-indigo-400",
    gradient: "from-indigo-500/8 via-transparent to-transparent",
    dot: "bg-indigo-500",
    filterActive: "bg-indigo-500 text-white",
  },
  {
    border: "border-t-lime-500/60",
    badgeBg: "bg-lime-500/15",
    badgeText: "text-lime-700 dark:text-lime-400",
    gradient: "from-lime-500/8 via-transparent to-transparent",
    dot: "bg-lime-500",
    filterActive: "bg-lime-500 text-white",
  },
  {
    border: "border-t-fuchsia-500/60",
    badgeBg: "bg-fuchsia-500/15",
    badgeText: "text-fuchsia-700 dark:text-fuchsia-400",
    gradient: "from-fuchsia-500/8 via-transparent to-transparent",
    dot: "bg-fuchsia-500",
    filterActive: "bg-fuchsia-500 text-white",
  },
]

/**
 * Simple string hash for deterministic color assignment
 * @param str - String to hash
 * @returns Positive integer hash
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Get the color configuration for a category name.
 * Returns a known color for default categories, or a deterministic hash-based
 * color for custom categories.
 * @param name - Category name
 * @returns Color configuration object
 */
export function getCategoryColor(name: string): CategoryColorConfig {
  if (CATEGORY_COLORS[name]) {
    return CATEGORY_COLORS[name]
  }
  const index = hashString(name) % CUSTOM_PALETTES.length
  return CUSTOM_PALETTES[index]
}

/**
 * Sentinel value used in the category Select to trigger "Create New Category" flow
 */
export const CREATE_NEW_CATEGORY_VALUE = "__create_new__"

/**
 * Sort options for templates
 */
export const SORT_OPTIONS: { value: TemplateSortBy; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most-used", label: "Most Used" },
  { value: "az", label: "A → Z" },
]

/**
 * Pre-built AI template suggestions organized by category
 */
export const AI_TEMPLATE_CATEGORIES: AITemplateCategory[] = [
  {
    id: "hooks",
    name: "Hook Templates",
    icon: React.createElement(IconBulb, { className: "size-4" }),
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    borderColor: "border-t-amber-500/50",
    templates: [
      {
        id: "ai-hook-1",
        name: "Contrarian Take",
        content: "Unpopular opinion:\n\n[Your contrarian take here]\n\nHere's why most people get this wrong:\n\n1. [Reason 1]\n2. [Reason 2]\n3. [Reason 3]\n\nThe truth is [your insight].\n\nAgree or disagree? Let me know below.",
        category: "Engagement",
        tags: ["hook", "contrarian", "engagement"],
      },
      {
        id: "ai-hook-2",
        name: "Bold Statement",
        content: "I've spent [X years] in [industry].\n\nHere's the one thing nobody tells you:\n\n[Bold statement]\n\nLet me explain...\n\n[Your explanation with evidence]\n\nSave this for when you need a reminder.",
        category: "Thought Leadership",
        tags: ["hook", "bold", "expertise"],
      },
      {
        id: "ai-hook-3",
        name: "Pattern Interrupt",
        content: "Stop scrolling.\n\nThis might change how you think about [topic].\n\n[Your insight or discovery]\n\nHere's what I learned:\n\n[Key takeaway 1]\n[Key takeaway 2]\n[Key takeaway 3]\n\nRepost if this resonated.",
        category: "Engagement",
        tags: ["hook", "pattern-interrupt", "viral"],
      },
    ],
  },
  {
    id: "storytelling",
    name: "Storytelling",
    icon: React.createElement(IconRoute, { className: "size-4" }),
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    borderColor: "border-t-violet-500/50",
    templates: [
      {
        id: "ai-story-1",
        name: "Failure to Success",
        content: "3 years ago, I [describe failure].\n\nEveryone told me to [common advice].\n\nInstead, I [what you actually did].\n\nThe result?\n\n[Impressive outcome]\n\nHere's what I wish I knew back then:\n\n1. [Lesson 1]\n2. [Lesson 2]\n3. [Lesson 3]\n\nYour setback is your setup.",
        category: "Personal Story",
        tags: ["storytelling", "failure", "growth"],
      },
      {
        id: "ai-story-2",
        name: "Behind the Scenes",
        content: "What nobody sees behind [your achievement]:\n\n- [Hidden effort 1]\n- [Hidden effort 2]\n- [Hidden effort 3]\n- [Hidden effort 4]\n\nSuccess isn't overnight.\n\nIt's [timeframe] of [consistent action].\n\nWhat's your behind-the-scenes story?",
        category: "Personal Story",
        tags: ["storytelling", "authenticity", "transparency"],
      },
    ],
  },
  {
    id: "howto",
    name: "How-To Guides",
    icon: React.createElement(IconMessageChatbot, { className: "size-4" }),
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    borderColor: "border-t-emerald-500/50",
    templates: [
      {
        id: "ai-howto-1",
        name: "Step-by-Step Guide",
        content: "How to [achieve result] in [timeframe]:\n\n(A thread for [target audience])\n\nStep 1: [Action]\n- [Detail]\n- [Detail]\n\nStep 2: [Action]\n- [Detail]\n- [Detail]\n\nStep 3: [Action]\n- [Detail]\n- [Detail]\n\nStep 4: [Action]\n- [Detail]\n- [Detail]\n\nStep 5: [Action]\n- [Detail]\n- [Detail]\n\nBookmark this for later.\nFollow me for more [topic] tips.",
        category: "How-To",
        tags: ["howto", "guide", "actionable"],
      },
      {
        id: "ai-howto-2",
        name: "Common Mistakes",
        content: "[X] mistakes killing your [goal]:\n\n(And how to fix each one)\n\nMistake 1: [Description]\nFix: [Solution]\n\nMistake 2: [Description]\nFix: [Solution]\n\nMistake 3: [Description]\nFix: [Solution]\n\nMistake 4: [Description]\nFix: [Solution]\n\nMistake 5: [Description]\nFix: [Solution]\n\nWhich one are you guilty of?",
        category: "How-To",
        tags: ["howto", "mistakes", "tips"],
      },
    ],
  },
  {
    id: "lists",
    name: "List Posts",
    icon: React.createElement(IconListNumbers, { className: "size-4" }),
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    borderColor: "border-t-sky-500/50",
    templates: [
      {
        id: "ai-list-1",
        name: "Tools & Resources",
        content: "[X] tools that changed how I [activity]:\n\n1. [Tool] - [What it does]\n2. [Tool] - [What it does]\n3. [Tool] - [What it does]\n4. [Tool] - [What it does]\n5. [Tool] - [What it does]\n6. [Tool] - [What it does]\n7. [Tool] - [What it does]\n\nBonus: [Extra tool or tip]\n\nWhich ones are you using?",
        category: "Engagement",
        tags: ["list", "tools", "resources"],
      },
      {
        id: "ai-list-2",
        name: "Lessons Learned",
        content: "[X] things I learned in [timeframe/experience]:\n\n1. [Lesson] - [Brief explanation]\n2. [Lesson] - [Brief explanation]\n3. [Lesson] - [Brief explanation]\n4. [Lesson] - [Brief explanation]\n5. [Lesson] - [Brief explanation]\n\nThe biggest surprise? Number [X].\n\nWhat would you add to this list?",
        category: "Thought Leadership",
        tags: ["list", "lessons", "reflection"],
      },
    ],
  },
]
