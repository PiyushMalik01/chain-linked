/**
 * AI Template Card
 * @description Redesigned AI template card matching the user template card style —
 * gradient background, category badge with dot, kebab menu, fixed height.
 * @module components/features/template-library/ai-template-card
 */

import {
  IconClipboardCopy,
  IconDots,
  IconPlus,
  IconSparkles,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { getCategoryColor } from "./constants"
import type { AITemplate } from "./types"

/**
 * Props for the AITemplateCard component
 */
interface AITemplateCardProps {
  /** The AI template data */
  template: AITemplate
  /** Top border accent color class (unused in new design, kept for API compat) */
  borderColor: string
  /** Callback when using this template */
  onUse: (template: AITemplate) => void
  /** Callback when saving this template to library */
  onSave: (template: AITemplate) => void
}

/**
 * Colored category badge with dot indicator
 */
function CategoryBadge({ category }: { category: string }) {
  const colors = getCategoryColor(category)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md",
        colors.badgeBg,
        colors.badgeText
      )}
    >
      <span className={cn("size-1.5 rounded-full", colors.dot)} />
      {category}
    </span>
  )
}

/**
 * AI template card with gradient background, category badge, and kebab actions
 * @param props - Component props
 * @returns A polished AI template card matching the user template card design
 */
export function AITemplateCard({
  template,
  onUse,
  onSave,
}: AITemplateCardProps) {
  const colors = getCategoryColor(template.category)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.content)
      toast.success("Template copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <div
      className={cn(
        "h-[210px] flex flex-col rounded-xl border overflow-hidden cursor-pointer",
        "bg-gradient-to-br",
        colors.gradient,
        "transition-all hover:shadow-lg hover:-translate-y-0.5",
        "group w-full relative",
        "border-border/40 hover:border-border/80"
      )}
      onClick={() => onUse(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onUse(template)
        }
      }}
    >
      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-2 min-h-0">
        {/* Top row: category badge + AI sparkle + kebab */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CategoryBadge category={template.category} />
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
              <IconSparkles className="size-2.5" />
              AI
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
              >
                <IconDots className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onUse(template)}>
                <IconSparkles className="size-3.5 mr-2" />
                Create Post
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSave(template)}>
                <IconPlus className="size-3.5 mr-2" />
                Save to Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <IconClipboardCopy className="size-3.5 mr-2" />
                Copy text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Template name */}
        <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
          {template.name}
        </h3>

        {/* Content preview */}
        <p className="flex-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4 overflow-hidden">
          {template.content}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between bg-muted/30">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[9px] font-normal px-1 py-0 h-4">
              {tag}
            </Badge>
          ))}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            className="text-[11px] text-muted-foreground font-medium flex items-center gap-0.5 cursor-pointer hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onSave(template)
            }}
          >
            <IconPlus className="size-3" />
            Save
          </span>
          <span className="text-[11px] text-primary font-medium flex items-center gap-0.5">
            <IconSparkles className="size-3" />
            Use
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * AI template list row for list view
 * @param props - Component props
 * @returns Compact row matching the user template row design
 */
export function AITemplateRow({
  template,
  onUse,
  onSave,
}: {
  template: AITemplate
  onUse: (template: AITemplate) => void
  onSave: (template: AITemplate) => void
}) {
  const colors = getCategoryColor(template.category)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.content)
      toast.success("Template copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <button
      type="button"
      onClick={() => onUse(template)}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border",
        "bg-gradient-to-r",
        colors.gradient,
        "hover:shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group",
        "border-border/40 hover:border-border/80"
      )}
    >
      {/* Content area */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">
          {template.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate max-w-2xl">
          {template.content.replace(/\n/g, " ").slice(0, 120)}
        </p>
      </div>

      {/* Category badge */}
      <div className="hidden sm:block shrink-0">
        <CategoryBadge category={template.category} />
      </div>

      {/* AI badge */}
      <span className="hidden md:flex shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 items-center gap-0.5">
        <IconSparkles className="size-2.5" />
        AI
      </span>

      {/* Tags */}
      <div className="hidden xl:flex shrink-0 items-center gap-1">
        {template.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          className="h-7 px-2 text-[11px] rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            onSave(template)
          }}
        >
          <IconPlus className="size-3" />
          Save
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted transition-all"
            >
              <IconDots className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onUse(template)}>
              <IconSparkles className="size-3.5 mr-2" />
              Create Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(template)}>
              <IconPlus className="size-3.5 mr-2" />
              Save to Library
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <IconClipboardCopy className="size-3.5 mr-2" />
              Copy text
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </button>
  )
}
