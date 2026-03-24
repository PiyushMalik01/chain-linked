"use client"

/**
 * Saved Drafts Page
 * @description Drafts manager with card/list views, source-colored badges,
 * search, filtering, sorting, and bulk select/delete.
 * @module app/dashboard/drafts/page
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  IconArrowRight,
  IconClipboardCopy,
  IconClock,
  IconFileText,
  IconSearch,
  IconTrash,
  IconAlertCircle,
  IconRefresh,
  IconNotebook,
  IconPencil,
  IconX,
  IconDots,
  IconLayoutGrid,
  IconList,
  IconSquareCheck,
  IconSquare,
  IconSelectAll,
} from "@tabler/icons-react"
import { PageContent } from "@/components/shared/page-content"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { usePageMeta } from "@/lib/dashboard-context"
import { useDraft } from "@/lib/store/draft-context"
import { useDrafts, type SavedDraft, type DraftSource, type DraftSortBy } from "@/hooks/use-drafts"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { RemixPostButton } from "@/components/features/remix-post-button"

// ============================================================================
// Source Color System
// ============================================================================

/**
 * Color configuration for each draft source
 */
const SOURCE_STYLES: Record<DraftSource, {
  label: string
  badge: string
  gradient: string
  dot: string
  filterActive: string
}> = {
  compose: {
    label: "Compose",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    gradient: "from-blue-500/8 via-transparent to-transparent",
    dot: "bg-blue-500",
    filterActive: "bg-blue-500 text-white",
  },
  swipe: {
    label: "Swipe",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    gradient: "from-rose-500/8 via-transparent to-transparent",
    dot: "bg-rose-500",
    filterActive: "bg-rose-500 text-white",
  },
  discover: {
    label: "Discover",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    gradient: "from-amber-500/8 via-transparent to-transparent",
    dot: "bg-amber-500",
    filterActive: "bg-amber-500 text-white",
  },
  inspiration: {
    label: "Inspiration",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    gradient: "from-violet-500/8 via-transparent to-transparent",
    dot: "bg-violet-500",
    filterActive: "bg-violet-500 text-white",
  },
  research: {
    label: "Research",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    gradient: "from-emerald-500/8 via-transparent to-transparent",
    dot: "bg-emerald-500",
    filterActive: "bg-emerald-500 text-white",
  },
  carousel: {
    label: "Carousel",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    gradient: "from-teal-500/8 via-transparent to-transparent",
    dot: "bg-teal-500",
    filterActive: "bg-teal-500 text-white",
  },
  series: {
    label: "Series",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    gradient: "from-orange-500/8 via-transparent to-transparent",
    dot: "bg-orange-500",
    filterActive: "bg-orange-500 text-white",
  },
  scheduled: {
    label: "Scheduled",
    badge: "bg-green-500/15 text-green-700 dark:text-green-400",
    gradient: "from-green-500/8 via-transparent to-transparent",
    dot: "bg-green-500",
    filterActive: "bg-green-500 text-white",
  },
}

/** Sort options */
const SORT_OPTIONS: { value: DraftSortBy; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "longest", label: "Longest" },
  { value: "shortest", label: "Shortest" },
]

/** Filter options */
const FILTER_OPTIONS: { value: DraftSource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "compose", label: "Compose" },
  { value: "scheduled", label: "Scheduled" },
  { value: "series", label: "Series" },
  { value: "swipe", label: "Swipe" },
  { value: "discover", label: "Discover" },
  { value: "inspiration", label: "Inspiration" },
  { value: "research", label: "Research" },
  { value: "carousel", label: "Carousel" },
]

/** View mode type */
type ViewMode = "grid" | "list"

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format date to relative or short absolute
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

/**
 * Format post type for display
 */
function formatPostType(postType: string): string {
  return postType
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Get the first meaningful line of content as a title
 */
function extractTitle(content: string): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0)?.trim() || ""
  if (firstLine.length <= 80) return firstLine
  return firstLine.slice(0, 77).trimEnd() + "..."
}

// ============================================================================
// Source Badge
// ============================================================================

/**
 * Colored source badge component
 */
function SourceBadge({ source }: { source: DraftSource }) {
  const style = SOURCE_STYLES[source]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md",
        style.badge
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

// ============================================================================
// Kebab Menu
// ============================================================================

/**
 * Action menu shared by card and list row
 */
function DraftActions({
  draft,
  onEdit,
  onDelete,
  onCopy,
  triggerClassName,
}: {
  draft: SavedDraft
  onEdit: (d: SavedDraft) => void
  onDelete: (d: SavedDraft) => void
  onCopy: (d: SavedDraft) => void
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted transition-all",
            triggerClassName
          )}
        >
          <IconDots className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => onEdit(draft)}>
          <IconArrowRight className="size-3.5 mr-2" />
          Continue editing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopy(draft)}>
          <IconClipboardCopy className="size-3.5 mr-2" />
          Copy text
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(draft)}
          className="text-destructive focus:text-destructive"
        >
          <IconTrash className="size-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================================================
// Selection Checkbox
// ============================================================================

/**
 * Selection checkbox overlay for cards and rows
 */
function SelectionCheckbox({
  checked,
  onToggle,
  selectMode,
  className,
}: {
  checked: boolean
  onToggle: () => void
  selectMode: boolean
  className?: string
}) {
  if (!selectMode) return null

  return (
    <div
      className={cn("z-10", className)}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Checkbox
        checked={checked}
        className="size-4 border-2"
      />
    </div>
  )
}

// ============================================================================
// Draft Card (Grid View)
// ============================================================================

/**
 * Draft card with colored gradient, extracted title, and optional selection
 */
function DraftCard({
  draft,
  onEdit,
  onDelete,
  onCopy,
  selectMode,
  selected,
  onToggleSelect,
}: {
  draft: SavedDraft
  onEdit: (d: SavedDraft) => void
  onDelete: (d: SavedDraft) => void
  onCopy: (d: SavedDraft) => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const style = SOURCE_STYLES[draft.source]
  const title = draft.topic || extractTitle(draft.content)
  const preview = draft.topic ? draft.content : draft.content.split("\n").slice(1).join("\n").trim() || draft.content

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect()
    } else {
      onEdit(draft)
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      className={cn(
        "text-left h-[210px] flex flex-col rounded-xl border overflow-hidden cursor-pointer",
        "bg-gradient-to-br",
        style.gradient,
        "transition-all hover:shadow-lg hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group w-full relative",
        selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-border/40 hover:border-border/80"
      )}
    >
      {/* Selection checkbox */}
      <SelectionCheckbox
        checked={selected}
        onToggle={onToggleSelect}
        selectMode={selectMode}
        className="absolute top-3 right-3"
      />

      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-2 min-h-0">
        {/* Top row: badges + kebab */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <SourceBadge source={draft.source} />
            {draft.postType && draft.postType !== "general" && (
              <span className="truncate text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {formatPostType(draft.postType)}
              </span>
            )}
          </div>
          {!selectMode && (
            <DraftActions
              draft={draft}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopy={onCopy}
              triggerClassName="opacity-0 group-hover:opacity-100"
            />
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
          {title}
        </h3>

        {/* Content preview */}
        <p className="flex-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4 overflow-hidden">
          {preview}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between bg-muted/30">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <IconClock className="size-3" />
          {formatDate(draft.updatedAt)}
          <span className="text-border/60">&middot;</span>
          <IconFileText className="size-3" />
          {draft.wordCount}w
        </span>
        {!selectMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <RemixPostButton
              postId={draft.id}
              content={draft.content}
              className="h-6 px-2 py-0 text-[11px]"
            />
            <span className="text-[11px] text-primary font-medium flex items-center gap-0.5">
              Edit
              <IconArrowRight className="size-3" />
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================================
// Draft Row (List/Table View)
// ============================================================================

/**
 * Compact list row with optional selection
 */
function DraftRow({
  draft,
  onEdit,
  onDelete,
  onCopy,
  selectMode,
  selected,
  onToggleSelect,
}: {
  draft: SavedDraft
  onEdit: (d: SavedDraft) => void
  onDelete: (d: SavedDraft) => void
  onCopy: (d: SavedDraft) => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const style = SOURCE_STYLES[draft.source]
  const title = draft.topic || extractTitle(draft.content)

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect()
    } else {
      onEdit(draft)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border",
        "bg-gradient-to-r",
        style.gradient,
        "hover:shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group",
        selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-border/40 hover:border-border/80"
      )}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div onClick={(e) => { e.stopPropagation(); onToggleSelect() }}>
          <Checkbox checked={selected} className="size-4 border-2" />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground truncate max-w-2xl">
          {draft.content.replace(/\n/g, " ").slice(0, 120)}
        </p>
      </div>

      {/* Source badge */}
      <div className="hidden sm:block shrink-0">
        <SourceBadge source={draft.source} />
      </div>

      {/* Post type */}
      {draft.postType && draft.postType !== "general" && (
        <span className="hidden md:block shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
          {formatPostType(draft.postType)}
        </span>
      )}

      {/* Word count */}
      <span className="hidden lg:flex shrink-0 text-[11px] text-muted-foreground items-center gap-1">
        <IconFileText className="size-3" />
        {draft.wordCount}w
      </span>

      {/* Date */}
      <span className="shrink-0 text-[11px] text-muted-foreground flex items-center gap-1 w-16 justify-end">
        <IconClock className="size-3" />
        {formatDate(draft.updatedAt)}
      </span>

      {/* Actions */}
      {!selectMode && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <RemixPostButton
            postId={draft.id}
            content={draft.content}
            className="h-7 px-2 py-0 text-[11px]"
          />
          <DraftActions
            draft={draft}
            onEdit={onEdit}
            onDelete={onDelete}
            onCopy={onCopy}
          />
        </div>
      )}
    </button>
  )
}

// ============================================================================
// View Toggle
// ============================================================================

/**
 * Animated toggle between grid and list views
 */
function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode
  onChange: (v: ViewMode) => void
}) {
  return (
    <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
      {([
        { value: "grid" as ViewMode, icon: IconLayoutGrid, label: "Grid view" },
        { value: "list" as ViewMode, icon: IconList, label: "List view" },
      ]).map(({ value, icon: Icon, label }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "relative p-1.5 rounded-md transition-colors",
                view === value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {view === value && (
                <motion.div
                  layoutId="view-toggle-bg"
                  className="absolute inset-0 bg-background border border-border/60 rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                />
              )}
              <Icon className="size-3.5 relative z-10" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

// ============================================================================
// Bulk Actions Bar
// ============================================================================

/**
 * Floating bar that appears when items are selected
 */
function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  isDeleting,
}: {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="sticky bottom-4 z-30 mx-auto w-fit"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
        >
          <IconSelectAll className="size-3.5 mr-1" />
          {selectedCount === totalCount ? "Deselect all" : "Select all"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onDeselectAll}
        >
          Clear
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <IconTrash className="size-3.5" />
          {isDeleting ? "Deleting..." : `Delete ${selectedCount}`}
        </Button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Loading Skeleton
// ============================================================================

/**
 * Loading skeleton matching the page layout
 */
function DraftsSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-4 md:gap-6 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-1.5" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-8 flex-1 max-w-xs rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[210px] rounded-xl border border-border/40 bg-card overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-24 rounded-md" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
            <div className="mt-auto px-4 py-2 border-t border-border/30">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Empty State
// ============================================================================

/**
 * Empty state with contextual messaging
 */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const router = useRouter()

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-2xl bg-muted/50 p-6 mb-5">
        <IconNotebook className="h-12 w-12 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {hasFilters ? "No matching drafts" : "No drafts yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {hasFilters
          ? "Try adjusting your search or filter."
          : "Drafts are auto-saved when you generate posts or navigate away from the composer."}
      </p>
      {!hasFilters && (
        <Button
          size="sm"
          onClick={() => router.push("/dashboard/compose")}
          className="gap-1.5"
        >
          <IconPencil className="size-3.5" />
          Start composing
        </Button>
      )}
    </motion.div>
  )
}

// ============================================================================
// Main Content
// ============================================================================

/**
 * Drafts page content with filtering, sorting, card/list toggle, and bulk selection
 */
function DraftsContent() {
  const router = useRouter()
  const { loadSavedDraft } = useDraft()
  const { drafts, isLoading, error, deleteDraft, bulkDeleteDrafts, refetch } = useDrafts()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState<DraftSource | "all">("all")
  const [sortBy, setSortBy] = React.useState<DraftSortBy>("newest")
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid"
    try {
      return (localStorage.getItem("chainlinked_drafts_view") as ViewMode) || "grid"
    } catch {
      return "grid"
    }
  })

  /** Persist view preference */
  const handleViewChange = React.useCallback((v: ViewMode) => {
    setViewMode(v)
    try {
      localStorage.setItem("chainlinked_drafts_view", v)
    } catch {
      // noop
    }
  }, [])

  /** Filtered and sorted drafts */
  const filteredDrafts = React.useMemo(() => {
    let result = [...drafts]

    if (sourceFilter !== "all") {
      result = result.filter((d) => d.source === sourceFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.content.toLowerCase().includes(q) ||
          (d.postType && d.postType.toLowerCase().includes(q)) ||
          (d.topic && d.topic.toLowerCase().includes(q)) ||
          (d.additionalContext && d.additionalContext.toLowerCase().includes(q))
      )
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case "oldest":
        result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        break
      case "longest":
        result.sort((a, b) => b.wordCount - a.wordCount)
        break
      case "shortest":
        result.sort((a, b) => a.wordCount - b.wordCount)
        break
    }

    return result
  }, [drafts, searchQuery, sourceFilter, sortBy])

  /** Source counts for filter pills */
  const sourceCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: drafts.length }
    for (const d of drafts) counts[d.source] = (counts[d.source] || 0) + 1
    return counts
  }, [drafts])

  const hasFilters = searchQuery.trim() !== "" || sourceFilter !== "all"

  /** Toggle selection for a single draft */
  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /** Select all currently visible drafts */
  const selectAllVisible = React.useCallback(() => {
    setSelectedIds(new Set(filteredDrafts.map((d) => d.id)))
  }, [filteredDrafts])

  /** Clear selection and exit select mode */
  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }, [])

  /** Toggle select mode */
  const toggleSelectMode = React.useCallback(() => {
    if (selectMode) {
      clearSelection()
    } else {
      setSelectMode(true)
    }
  }, [selectMode, clearSelection])

  /** Bulk delete selected drafts */
  const handleBulkDelete = React.useCallback(async () => {
    const count = selectedIds.size
    const confirmed = await confirm({
      title: `Delete ${count} draft${count !== 1 ? "s" : ""}?`,
      description: "This cannot be undone.",
      variant: "destructive",
      confirmText: `Delete ${count}`,
    })

    if (!confirmed) return

    setIsDeleting(true)
    const items = filteredDrafts
      .filter((d) => selectedIds.has(d.id))
      .map((d) => ({ id: d.id, table: d.table }))

    const success = await bulkDeleteDrafts(items)
    setIsDeleting(false)

    if (success) {
      clearSelection()
    }
  }, [selectedIds, filteredDrafts, confirm, bulkDeleteDrafts, clearSelection])

  /** Load draft into composer or carousel editor */
  const handleEdit = React.useCallback(
    (d: SavedDraft) => {
      // Carousel drafts: restore slide data and navigate to carousel editor
      if (d.source === "carousel" && d.additionalContext) {
        try {
          const slides = JSON.parse(d.additionalContext)
          if (Array.isArray(slides) && slides.length > 0) {
            localStorage.setItem("chainlinked-carousel-draft", d.additionalContext)
            toast.success("Carousel loaded into editor")
            router.push("/dashboard/carousels")
            return
          }
        } catch {
          // Fall through to compose if slide data is invalid
        }
      }

      // Scheduled drafts: navigate to compose in edit mode
      if (d.source === "scheduled") {
        sessionStorage.setItem('editScheduledPost', JSON.stringify({
          id: d.id,
          content: d.content,
          scheduledFor: d.additionalContext,
        }))
        toast.success("Scheduled post loaded for editing")
        router.push(`/dashboard/compose?edit=${d.id}`)
        return
      }

      // Series drafts: restore series data and navigate to series tab
      if (d.source === "series" && d.additionalContext) {
        try {
          const seriesData = JSON.parse(d.additionalContext)
          if (seriesData?.type === "series" && Array.isArray(seriesData.posts)) {
            localStorage.setItem("chainlinked-series-draft", d.additionalContext)
            toast.success("Series loaded into editor")
            router.push("/dashboard/compose?tab=series")
            return
          }
        } catch {
          // Fall through to single post compose
        }
      }

      loadSavedDraft(d.id, d.content, {
        topic: d.topic,
        tone: d.tone,
        additionalContext: d.additionalContext,
      })
      toast.success("Draft loaded into composer")
      router.push(`/dashboard/compose?draftId=${d.id}`)
    },
    [loadSavedDraft, router]
  )

  /** Copy draft content */
  const handleCopy = React.useCallback(async (draft: SavedDraft) => {
    try {
      await navigator.clipboard.writeText(draft.content)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }, [])

  /** Delete single draft with confirmation */
  const handleDelete = React.useCallback(
    async (draft: SavedDraft) => {
      const confirmed = await confirm({
        title: "Delete draft?",
        description: "This cannot be undone.",
        variant: "destructive",
        confirmText: "Delete",
      })
      if (confirmed) await deleteDraft(draft.id, draft.table)
    },
    [confirm, deleteDraft]
  )

  if (error && !isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <div className="rounded-lg bg-destructive/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <IconAlertCircle className="h-4 w-4" />
            <span>Failed to load drafts</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <IconRefresh className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) return <DraftsSkeleton />

  return (
    <PageContent>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Saved Drafts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {drafts.length > 0
              ? `${drafts.length} draft${drafts.length !== 1 ? "s" : ""} saved`
              : "Auto-saved from compose and swipe"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Select mode toggle */}
          {drafts.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectMode ? "default" : "ghost"}
                  size="icon"
                  onClick={toggleSelectMode}
                  className={cn("h-8 w-8", !selectMode && "text-muted-foreground")}
                >
                  {selectMode ? <IconSquareCheck className="size-4" /> : <IconSquare className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{selectMode ? "Cancel selection" : "Select drafts"}</TooltipContent>
            </Tooltip>
          )}

          <ViewToggle view={viewMode} onChange={handleViewChange} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={refetch} className="text-muted-foreground h-8 w-8">
                <IconRefresh className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh drafts</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Search + filter pills */}
      {(drafts.length > 0 || hasFilters) && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search drafts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3" />
              </button>
            )}
          </div>

          {/* Source filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_OPTIONS.filter(
              (o) => o.value === "all" || (sourceCounts[o.value] || 0) > 0
            ).map((option) => {
              const isActive = sourceFilter === option.value
              const sourceStyle = option.value !== "all" ? SOURCE_STYLES[option.value as DraftSource] : null

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSourceFilter(option.value)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full transition-all",
                    isActive && sourceStyle
                      ? sourceStyle.filterActive
                      : isActive
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                  {sourceCounts[option.value] ? (
                    <span className="ml-1 opacity-70">{sourceCounts[option.value]}</span>
                  ) : null}
                </button>
              )
            })}

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label} &#8595;
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(
                      "text-xs",
                      sortBy === option.value && "font-medium"
                    )}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Content: Grid, List, or Empty State */}
      {filteredDrafts.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : viewMode === "grid" ? (
        <div
          key={`grid-${sourceFilter}-${sortBy}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredDrafts.map((draft, idx) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.25, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <DraftCard
                draft={draft}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopy={handleCopy}
                selectMode={selectMode}
                selected={selectedIds.has(draft.id)}
                onToggleSelect={() => toggleSelect(draft.id)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div
          key={`list-${sourceFilter}-${sortBy}`}
          className="flex flex-col gap-2"
        >
          {filteredDrafts.map((draft, idx) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: { duration: 0.2, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <DraftRow
                draft={draft}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopy={handleCopy}
                selectMode={selectMode}
                selected={selectedIds.has(draft.id)}
                onToggleSelect={() => toggleSelect(draft.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          totalCount={filteredDrafts.length}
          onSelectAll={selectAllVisible}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      )}

      <ConfirmDialogComponent />
    </PageContent>
  )
}

// ============================================================================
// Page Export
// ============================================================================

/**
 * Saved Drafts page
 * @returns Drafts page with card/list views, bulk select, search, and filtering
 */
export default function DraftsPage() {
  usePageMeta({ title: "Drafts" })
  const { isLoading: authLoading } = useAuthContext()

  return authLoading ? <DraftsSkeleton /> : <DraftsContent />
}
