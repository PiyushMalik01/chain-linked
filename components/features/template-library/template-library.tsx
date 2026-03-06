"use client"

/**
 * Template Library
 * @description Redesigned template library matching the saved drafts page UX —
 * dual grid/list views, search + category filter pills + sort, bulk select,
 * Framer Motion animations, and kebab action menus.
 * @module components/features/template-library/template-library
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  IconArrowRight,
  IconClipboardCopy,
  IconDots,
  IconEdit,
  IconEye,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSelectAll,
  IconSparkles,
  IconSquare,
  IconSquareCheck,
  IconTemplate,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { trackTemplateAction } from "@/lib/analytics"
import { useDraft } from "@/lib/store/draft-context"
import { type AISuggestion } from "@/lib/store/draft-context"
import { templateToast } from "@/lib/toast-utils"
import { cn } from "@/lib/utils"
import { useTemplateCategories } from "@/hooks/use-template-categories"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"

import { CATEGORY_AI_DEFAULTS, getCategoryColor, SORT_OPTIONS } from "./constants"
import { AITemplatesSection } from "./ai-templates-section"
import { TemplateCard } from "./template-card"
import { TemplateFormDialog } from "./template-form-dialog"
import { TemplatePreviewDialog } from "./template-preview-dialog"
import type { AITemplate, Template, TemplateFormData, TemplateLibraryProps, TemplateSortBy } from "./types"

// ============================================================================
// Types
// ============================================================================

/** View mode for the template display */
type ViewMode = "grid" | "list"

// ============================================================================
// Category Badge (shared by card + row)
// ============================================================================

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

// ============================================================================
// Template Row (List View)
// ============================================================================

/**
 * Compact list row for templates, matching the drafts list row design
 */
function TemplateRow({
  template,
  onEdit,
  onDelete,
  onPreview,
  onUseTemplate,
  selectMode,
  selected,
  onToggleSelect,
}: {
  template: Template
  onEdit: (t: Template) => void
  onDelete: (id: string) => void
  onPreview: (t: Template) => void
  onUseTemplate: (t: Template) => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const colors = getCategoryColor(template.category)

  const handleClick = () => {
    if (selectMode) {
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
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border",
        "bg-gradient-to-r",
        colors.gradient,
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

      {/* Usage count */}
      {template.usageCount > 0 && (
        <span className="hidden lg:flex shrink-0 text-[11px] text-muted-foreground items-center gap-1 tabular-nums">
          {template.usageCount}×
        </span>
      )}

      {/* Tags */}
      <div className="hidden xl:flex shrink-0 items-center gap-1">
        {template.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Actions */}
      {!selectMode && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation()
              onUseTemplate(template)
            }}
          >
            <IconSparkles className="size-3 mr-1" />
            Use
          </Button>
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
                  layoutId="templates-view-toggle-bg"
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
// Empty State
// ============================================================================

/**
 * Empty state with contextual messaging
 */
function EmptyState({
  hasFilters,
  onCreateNew,
}: {
  hasFilters: boolean
  onCreateNew: () => void
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-2xl bg-muted/50 p-6 mb-5">
        <IconTemplate className="h-12 w-12 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {hasFilters ? "No matching templates" : "No templates yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {hasFilters
          ? "Try adjusting your search or filter."
          : "Templates help you create consistent, high-quality posts faster. Create your first one or browse AI suggestions below."}
      </p>
      {!hasFilters && (
        <Button size="sm" onClick={onCreateNew} className="gap-1.5">
          <IconPlus className="size-3.5" />
          Create Template
        </Button>
      )}
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Full template library UI with grid/list views, search, category filters,
 * sort, bulk select, and AI templates section.
 *
 * @param props - Component props
 * @returns Redesigned template library page
 */
export function TemplateLibrary({
  templates = [],
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onUseTemplate,
  isLoading = false,
}: TemplateLibraryProps) {
  const router = useRouter()
  const { loadTemplate } = useDraft()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  // Category management
  const {
    allCategories,
    isSaving: isCategorySaving,
    fetchCategories,
    createCategory,
    deleteCategory,
  } = useTemplateCategories()

  React.useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Local state
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<TemplateSortBy>("newest")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<Template | null>(null)
  const [previewTemplate, setPreviewTemplate] = React.useState<Template | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid"
    try {
      return (localStorage.getItem("chainlinked_templates_view") as ViewMode) || "grid"
    } catch {
      return "grid"
    }
  })

  /** Persist view preference */
  const handleViewChange = React.useCallback((v: ViewMode) => {
    setViewMode(v)
    try {
      localStorage.setItem("chainlinked_templates_view", v)
    } catch {
      // noop
    }
  }, [])

  /**
   * Split templates into user-created and AI-generated
   */
  const { userTemplates, aiGeneratedTemplates } = React.useMemo(() => {
    const user: Template[] = []
    const ai: Template[] = []
    for (const t of templates) {
      if (t.isAiGenerated) {
        ai.push(t)
      } else {
        user.push(t)
      }
    }
    return { userTemplates: user, aiGeneratedTemplates: ai }
  }, [templates])

  /**
   * Filtered and sorted user templates
   */
  const filteredTemplates = React.useMemo(() => {
    let result = [...userTemplates]

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case "most-used":
        result.sort((a, b) => b.usageCount - a.usageCount)
        break
      case "az":
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return result
  }, [userTemplates, searchQuery, categoryFilter, sortBy])

  /** Category counts for filter pills */
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: userTemplates.length }
    for (const t of userTemplates) {
      counts[t.category] = (counts[t.category] ?? 0) + 1
    }
    return counts
  }, [userTemplates])

  const hasFilters = searchQuery.trim() !== "" || categoryFilter !== "all"

  // ---- Selection handlers ----

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = React.useCallback(() => {
    setSelectedIds(new Set(filteredTemplates.map((t) => t.id)))
  }, [filteredTemplates])

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }, [])

  const toggleSelectMode = React.useCallback(() => {
    if (selectMode) clearSelection()
    else setSelectMode(true)
  }, [selectMode, clearSelection])

  // ---- CRUD handlers ----

  const handleCreateNew = () => {
    setEditingTemplate(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleFormSubmit = (data: TemplateFormData, editingId: string | null) => {
    const templateData = {
      name: data.name.trim(),
      content: data.content.trim(),
      category: data.category,
      tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      isPublic: data.isPublic,
    }
    if (editingId) {
      trackTemplateAction("edited", editingId)
      onEditTemplate?.(editingId, templateData)
    } else {
      trackTemplateAction("created", "new")
      onCreateTemplate?.(templateData)
    }
  }

  const buildAISuggestion = (category: string, templateName: string): AISuggestion => {
    const defaults = CATEGORY_AI_DEFAULTS[category] ?? {
      topic: "Write a LinkedIn post about [your topic]",
      tone: "professional",
    }
    return {
      topic: defaults.topic,
      tone: defaults.tone,
      context: `Using the "${templateName}" template as a starting point. Fill in the bracketed placeholders with your own content.`,
    }
  }

  const handleUseTemplate = (template: Template) => {
    trackTemplateAction("used", template.id)
    const aiSuggestion = buildAISuggestion(template.category, template.name)
    loadTemplate(template.id, template.content, aiSuggestion)
    onUseTemplate?.(template.id)
    templateToast.applied(template.name)
    router.push("/dashboard/compose")
  }

  const handleUseAITemplate = (template: AITemplate) => {
    const aiSuggestion = buildAISuggestion(template.category, template.name)
    loadTemplate(template.id, template.content, aiSuggestion)
    templateToast.applied(template.name)
    router.push("/dashboard/compose")
  }

  const handleSaveAITemplate = (template: AITemplate) => {
    onCreateTemplate?.({
      name: template.name,
      content: template.content,
      category: template.category,
      tags: template.tags,
      isPublic: false,
    })
  }

  const handleDelete = async (id: string) => {
    const templateToDelete = templates.find((t) => t.id === id)
    const confirmed = await confirm({
      title: "Delete Template?",
      description: `Are you sure you want to delete "${templateToDelete?.name ?? "this template"}"? This action cannot be undone.`,
      variant: "destructive",
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (confirmed) {
      trackTemplateAction("deleted", id)
      onDeleteTemplate?.(id)
      templateToast.deleted(templateToDelete?.name ?? "Template")
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    const confirmed = await confirm({
      title: `Delete ${count} template${count !== 1 ? "s" : ""}?`,
      description: "This cannot be undone.",
      variant: "destructive",
      confirmText: `Delete ${count}`,
    })
    if (!confirmed) return

    setIsDeleting(true)
    for (const id of selectedIds) {
      onDeleteTemplate?.(id)
    }
    setIsDeleting(false)
    clearSelection()
    toast.success(`Deleted ${count} template${count !== 1 ? "s" : ""}`)
  }

  // ---- Filter pill data ----

  const filterOptions = React.useMemo(() => {
    const cats: { value: string; label: string }[] = [{ value: "all", label: "All" }]
    for (const cat of allCategories) {
      if ((categoryCounts[cat.name] ?? 0) > 0) {
        cats.push({ value: cat.name, label: cat.name })
      }
    }
    return cats
  }, [allCategories, categoryCounts])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Template Library</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {userTemplates.length > 0
              ? `${userTemplates.length} template${userTemplates.length !== 1 ? "s" : ""} saved`
              : "Create reusable post templates"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Create button */}
          <Button size="sm" onClick={handleCreateNew} className="gap-1.5 h-8">
            <IconPlus className="size-3.5" />
            Create
          </Button>

          {/* Select mode toggle */}
          {userTemplates.length > 0 && (
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
              <TooltipContent side="bottom">{selectMode ? "Cancel selection" : "Select templates"}</TooltipContent>
            </Tooltip>
          )}

          <ViewToggle view={viewMode} onChange={handleViewChange} />
        </div>
      </div>

      {/* Search + filter pills + sort */}
      {(userTemplates.length > 0 || hasFilters) && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
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

          {/* Category filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {filterOptions.map((option) => {
              const isActive = categoryFilter === option.value
              const colors = option.value !== "all" ? getCategoryColor(option.value) : null

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategoryFilter(option.value)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full transition-all",
                    isActive && colors
                      ? colors.filterActive
                      : isActive
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                  {categoryCounts[option.value] ? (
                    <span className="ml-1 opacity-70">{categoryCounts[option.value]}</span>
                  ) : null}
                </button>
              )
            })}

            {/* Sort dropdown */}
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
                    className={cn("text-xs", sortBy === option.value && "font-medium")}
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
      {filteredTemplates.length === 0 && !isLoading ? (
        <EmptyState hasFilters={hasFilters} onCreateNew={handleCreateNew} />
      ) : viewMode === "grid" ? (
        <div
          key={`grid-${categoryFilter}-${sortBy}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredTemplates.map((template, idx) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.25, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <TemplateCard
                template={template}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPreview={(t) => {
                  setPreviewTemplate(t)
                  setIsPreviewOpen(true)
                }}
                onUseTemplate={handleUseTemplate}
                selectMode={selectMode}
                selected={selectedIds.has(template.id)}
                onToggleSelect={() => toggleSelect(template.id)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div
          key={`list-${categoryFilter}-${sortBy}`}
          className="flex flex-col gap-2"
        >
          {filteredTemplates.map((template, idx) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: { duration: 0.2, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <TemplateRow
                template={template}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPreview={(t) => {
                  setPreviewTemplate(t)
                  setIsPreviewOpen(true)
                }}
                onUseTemplate={handleUseTemplate}
                selectMode={selectMode}
                selected={selectedIds.has(template.id)}
                onToggleSelect={() => toggleSelect(template.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          totalCount={filteredTemplates.length}
          onSelectAll={selectAllVisible}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      )}

      {/* Separator */}
      <Separator />

      {/* AI Templates section */}
      <AITemplatesSection
        onUseAITemplate={handleUseAITemplate}
        onSaveAITemplate={handleSaveAITemplate}
        dynamicTemplates={aiGeneratedTemplates}
        viewMode={viewMode}
      />

      {/* Create/Edit Dialog */}
      <TemplateFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingTemplate={editingTemplate}
        allCategories={allCategories}
        onSubmit={handleFormSubmit}
        onCreateCategory={createCategory}
      />

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onUseTemplate={handleUseTemplate}
        onEditTemplate={handleEdit}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialogComponent />
    </div>
  )
}
