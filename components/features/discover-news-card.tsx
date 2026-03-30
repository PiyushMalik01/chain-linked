/**
 * Discover News Card Component
 * @description Renders a Perplexity-sourced news article in compact or featured variant
 * for the news-style discover feed. Cards are clickable to open a detail dialog.
 * @module components/features/discover-news-card
 */

"use client"

import * as React from "react"
import {
  IconClock,
  IconExternalLink,
  IconSparkles,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NewsArticle } from "@/hooks/use-discover-news"

/**
 * Props for DiscoverNewsCard
 * @param article - The news article data to display
 * @param onRemix - Callback when remix button is clicked
 * @param onClick - Callback when the card itself is clicked (opens detail dialog)
 * @param variant - Display variant: 'compact' for list items, 'featured' for top stories
 */
interface DiscoverNewsCardProps {
  article: NewsArticle
  onRemix: (article: NewsArticle) => void
  onClick: (article: NewsArticle) => void
  variant: "compact" | "featured"
}

/**
 * Format a relative time string from an ISO date
 * @param dateStr - ISO date string
 * @returns Human-readable relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Compact news card for the main feed list
 * Single-row layout with source, headline, time, tags, and action icons.
 * The entire row is clickable to open the article detail dialog.
 * @param props - Component props
 * @param props.article - The news article to display
 * @param props.onRemix - Callback when the remix button is clicked
 * @param props.onClick - Callback when the card row is clicked
 * @returns Rendered compact news card
 */
function CompactNewsCard({
  article,
  onRemix,
  onClick,
}: Omit<DiscoverNewsCardProps, "variant">) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
        "border-b border-border/50 last:border-b-0",
        "hover:bg-muted/50"
      )}
      onClick={() => onClick(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(article)
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
          {article.headline}
        </h3>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {article.sourceName}
          </span>
          <span className="flex items-center gap-0.5">
            <IconClock className="size-3" />
            {formatRelativeTime(article.publishedDate || article.createdAt)}
          </span>
          {article.relevanceTags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {article.relevanceTags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 font-normal"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div
        className={cn(
          "flex items-center gap-1 shrink-0 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onRemix(article)
          }}
        >
          <IconSparkles className="size-3" />
          Remix
        </Button>
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <IconExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

/**
 * Featured news card for the top stories section
 * Larger layout with headline, summary, source, relevance tags, and actions.
 * The entire card is clickable to open the article detail dialog.
 * A green dot indicator appears next to the source name when the article freshness is 'new'.
 * @param props - Component props
 * @param props.article - The news article to display
 * @param props.onRemix - Callback when the remix button is clicked
 * @param props.onClick - Callback when the card is clicked
 * @returns Rendered featured news card
 */
function FeaturedNewsCard({
  article,
  onRemix,
  onClick,
}: Omit<DiscoverNewsCardProps, "variant">) {
  const isNew = article.freshness === "new"

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex flex-col gap-3 p-4 rounded-lg transition-all cursor-pointer",
        "border border-border/50 bg-card",
        "hover:shadow-md hover:border-border hover:-translate-y-0.5"
      )}
      onClick={() => onClick(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(article)
        }
      }}
    >
      {/* Source + Date Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
          {isNew && (
            <span
              className="inline-block size-2 rounded-full bg-green-500 shrink-0"
              aria-label="New article"
            />
          )}
          {article.sourceName}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <IconClock className="size-3" />
          {formatRelativeTime(article.publishedDate || article.createdAt)}
        </span>
      </div>

      {/* Headline */}
      <h3 className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {article.headline}
      </h3>

      {/* Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
        {article.summary}
      </p>

      {/* Tags + Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1 flex-wrap overflow-hidden max-h-[22px]">
          {article.relevanceTags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 truncate max-w-[120px]"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <IconExternalLink className="size-3" />
            Read Source
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onRemix(article)
            }}
          >
            <IconSparkles className="size-3" />
            Remix
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Discover News Card component
 * Renders either a compact list item or featured card based on variant prop.
 * Both variants are fully clickable, delegating to the onClick callback
 * so the parent can open a detail dialog.
 * @param props - Component props
 * @param props.article - The news article to render
 * @param props.onRemix - Callback when remix is requested
 * @param props.onClick - Callback when the card is clicked (for opening detail dialog)
 * @param props.variant - Display variant: 'compact' or 'featured'
 * @returns Rendered news card in the specified variant
 * @example
 * <DiscoverNewsCard
 *   article={article}
 *   onRemix={handleRemix}
 *   onClick={handleCardClick}
 *   variant="featured"
 * />
 */
export function DiscoverNewsCard({
  article,
  onRemix,
  onClick,
  variant,
}: DiscoverNewsCardProps) {
  if (variant === "featured") {
    return (
      <FeaturedNewsCard
        article={article}
        onRemix={onRemix}
        onClick={onClick}
      />
    )
  }
  return (
    <CompactNewsCard article={article} onRemix={onRemix} onClick={onClick} />
  )
}
