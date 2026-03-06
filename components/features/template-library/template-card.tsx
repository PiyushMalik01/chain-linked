/**
 * Template Card
 * @description Redesigned template card inspired by the drafts page — gradient
 * backgrounds, category badge, kebab menu, and fixed height.
 * @module components/features/template-library/template-card
 */

import {
  IconArrowRight,
  IconClipboardCopy,
  IconDots,
  IconEdit,
  IconEye,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { getCategoryColor } from "./constants"
import type { Template } from "./types"

/**
 * Props for the TemplateCard component
 */
interface TemplateCardProps {
  /** Template data to display */
  template: Template
  /** Callback when editing this template */
  onEdit: (template: Template) => void
  /** Callback when deleting this template */
  onDelete: (id: string) => void
  /** Callback when previewing this template */
  onPreview: (template: Template) => void
  /** Callback when using this template to create a post */
  onUseTemplate: (template: Template) => void
  /** Whether bulk select mode is active */
  selectMode?: boolean
  /** Whether this card is selected */
  selected?: boolean
  /** Callback to toggle selection */
  onToggleSelect?: () => void
}

/**
 * Colored category badge with dot indicator
 * @param props - Component props
 * @returns Inline badge element
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
 * Format date to relative or short absolute
 * @param dateString - ISO date string
 * @returns Human-readable date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 1) return "Today"
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

/**
 * A polished template card with gradient background, category badge, and kebab actions
 * @param props - Component props
 * @returns Template card matching the drafts page design
 */
export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onPreview,
  onUseTemplate,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: TemplateCardProps) {
  const colors = getCategoryColor(template.category)

  const handleClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect()
    } else {
      onPreview(template)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.content)
      toast.success("Template copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        "text-left h-[210px] flex flex-col rounded-xl border overflow-hidden cursor-pointer",
        "bg-gradient-to-br",
        colors.gradient,
        "transition-all hover:shadow-lg hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group w-full relative",
        selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-border/40 hover:border-border/80"
      )}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div
          className="absolute top-3 right-3 z-10"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect?.()
          }}
        >
          <Checkbox checked={selected} className="size-4 border-2" />
        </div>
      )}

      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-2 min-h-0">
        {/* Top row: category badge + visibility + kebab */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CategoryBadge category={template.category} />
            {template.isPublic && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                Public
              </span>
            )}
          </div>
          {!selectMode && (
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
              <DropdownMenuContent
                align="end"
                className="w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={() => onUseTemplate(template)}>
                  <IconSparkles className="size-3.5 mr-2" />
                  Create Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPreview(template)}>
                  <IconEye className="size-3.5 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(template)}>
                  <IconEdit className="size-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy}>
                  <IconClipboardCopy className="size-3.5 mr-2" />
                  Copy text
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(template.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash className="size-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
          {template.usageCount > 0 && (
            <>
              <span className="tabular-nums">Used {template.usageCount}×</span>
              <span className="text-border/60">&middot;</span>
            </>
          )}
          {formatDate(template.createdAt)}
          {template.tags.length > 0 && (
            <>
              <span className="text-border/60">&middot;</span>
              {template.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[9px] font-normal px-1 py-0 h-4">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 2 && (
                <span className="text-[10px]">+{template.tags.length - 2}</span>
              )}
            </>
          )}
        </span>
        {!selectMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span
              className="text-[11px] text-primary font-medium flex items-center gap-0.5 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onUseTemplate(template)
              }}
            >
              <IconSparkles className="size-3" />
              Use
            </span>
            <span
              className="text-[11px] text-muted-foreground font-medium flex items-center gap-0.5 cursor-pointer hover:text-foreground ml-1"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(template)
              }}
            >
              Edit
              <IconArrowRight className="size-3" />
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
