"use client"

/**
 * Swipe Card Component
 * @description Tinder-style swipe card for AI-generated post suggestions with rich animations
 * @module components/features/swipe-card
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconSparkles,
  IconChartBar,
  IconFlame,
  IconTrendingUp,
  IconCircleCheck,
  IconX,
  IconWand,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Represents a single AI-generated post suggestion for the swipe card
 */
export interface SwipeCardData {
  /** Unique identifier for the suggestion */
  id: string
  /** The post content text */
  content: string
  /** Category/topic of the post (e.g., "Leadership", "Tech Tips") */
  category: string
  /** Predicted engagement score (0-100) */
  estimatedEngagement?: number
  /** Author information (optional, for inspiration posts) */
  author?: {
    name: string
    headline?: string
  }
  /** Post type (e.g., "Story", "Listicle", "How-To") */
  postType?: string
  /** Whether this is a personalized suggestion */
  isPersonalized?: boolean
}

/**
 * Props for the SwipeCard component
 */
export interface SwipeCardProps {
  /** The suggestion data to display */
  data: SwipeCardData
  /** Current horizontal offset from center (in pixels) */
  offsetX?: number
  /** Whether the card is currently being dragged */
  isDragging?: boolean
  /** Whether the card is animating out */
  isExiting?: boolean
  /** Exit direction for animation */
  exitDirection?: "left" | "right" | null
  /** Z-index for stacking */
  zIndex?: number
  /** Scale factor for background cards */
  scale?: number
  /** Vertical offset for stacked appearance */
  stackOffset?: number
  /** Rotation for stacked appearance (degrees) */
  stackRotation?: number
  /** Opacity for background cards */
  opacity?: number
  /** Additional CSS classes */
  className?: string
  /** Counter text (e.g., "5 remaining") */
  counterText?: string
}

/** Threshold for showing swipe direction indicator */
const DIRECTION_THRESHOLD = 30

/**
 * Returns the engagement level label and styling based on score
 * @param score - Engagement score from 0-100
 * @returns Object with label, color class, and icon
 */
function getEngagementInfo(score: number): {
  label: string
  colorClass: string
  bgClass: string
  Icon: React.ElementType
} {
  if (score >= 85) {
    return {
      label: "Viral Potential",
      colorClass: "text-orange-600 dark:text-orange-400",
      bgClass: "bg-orange-100 dark:bg-orange-950",
      Icon: IconFlame,
    }
  }
  if (score >= 70) {
    return {
      label: "High Engagement",
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-100 dark:bg-green-950",
      Icon: IconTrendingUp,
    }
  }
  if (score >= 50) {
    return {
      label: "Good",
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-100 dark:bg-blue-950",
      Icon: IconChartBar,
    }
  }
  return {
    label: "Moderate",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    Icon: IconChartBar,
  }
}

/**
 * Get category badge color based on category type
 */
function getCategoryStyle(category: string): string {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-')

  switch (normalizedCategory) {
    case 'leadership':
    case 'thought-leadership':
      return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
    case 'tech-tips':
    case 'tech-trends':
    case 'industry-news':
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
    case 'career-growth':
    case 'career-advice':
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
    case 'productivity':
    case 'how-to':
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
    case 'personal-stories':
      return "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
    case 'engagement-hooks':
      return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
    case 'sales-biz-dev':
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"
    default:
      return "bg-secondary text-secondary-foreground"
  }
}

/**
 * SwipeCard displays a single suggestion card with swipe feedback and rich animations.
 *
 * Features:
 * - Framer Motion for smooth, physics-based animations
 * - Visual feedback for swipe direction (SAVED / SKIP overlays)
 * - Engagement score indicator with appropriate icon
 * - Category badge with color coding
 * - Support for stacked appearance (scale, offset, opacity)
 * - Smooth rotation and translation based on drag position
 * - Gradient styling matching design system
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SwipeCard
 *   data={{
 *     id: "1",
 *     content: "Post content here...",
 *     category: "Leadership",
 *     estimatedEngagement: 85
 *   }}
 * />
 *
 * // With swipe feedback
 * <SwipeCard
 *   data={suggestion}
 *   offsetX={swipeOffset}
 *   isDragging={isDragging}
 * />
 *
 * // Background card in stack
 * <SwipeCard
 *   data={suggestion}
 *   scale={0.97}
 *   stackOffset={8}
 *   opacity={0.8}
 *   zIndex={1}
 * />
 * ```
 */
export function SwipeCard({
  data,
  offsetX = 0,
  isDragging = false,
  isExiting = false,
  exitDirection = null,
  zIndex = 1,
  scale = 1,
  stackOffset = 0,
  stackRotation = 0,
  opacity = 1,
  className,
  counterText,
}: SwipeCardProps) {
  // Calculate rotation: drag-based for top card, stack-based for background cards
  const rotation = offsetX * 0.05 + stackRotation

  // Determine swipe direction for visual feedback
  const swipeDirection: "left" | "right" | null =
    offsetX > DIRECTION_THRESHOLD
      ? "right"
      : offsetX < -DIRECTION_THRESHOLD
        ? "left"
        : null

  // Get engagement info if score exists
  const engagementInfo = data.estimatedEngagement
    ? getEngagementInfo(data.estimatedEngagement)
    : null

  // Calculate indicator opacity based on offset
  const rightIndicatorOpacity = Math.min(Math.max(offsetX / 100, 0), 1)
  const leftIndicatorOpacity = Math.min(Math.max(-offsetX / 100, 0), 1)

  return (
    <motion.div
      className={cn(
        "absolute inset-0",
        isDragging && "cursor-grabbing",
        !isDragging && scale === 1 && "cursor-grab",
        className
      )}
      style={{ zIndex }}
      initial={false}
      animate={{
        x: isExiting ? (exitDirection === "right" ? 600 : -600) : offsetX,
        rotate: isExiting ? (exitDirection === "right" ? 25 : -25) : rotation,
        scale: isExiting ? 0.9 : scale,
        y: stackOffset,
        opacity: isExiting ? 0 : opacity,
      }}
      transition={
        isExiting
          ? { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }
          : isDragging
            ? { type: "tween", duration: 0 }
            : { type: "spring", stiffness: 250, damping: 22 }
      }
    >
      <Card className={cn(
        "h-full overflow-hidden border-border/50",
        "!bg-background dark:!bg-zinc-900",
        isDragging && "shadow-2xl border-primary/30",
        !isDragging && "transition-shadow duration-200 hover:shadow-lg"
      )}>
        <CardContent className="relative flex h-full flex-col p-6 bg-gradient-to-br from-transparent via-transparent to-primary/5 dark:to-primary/10">
          {/* Swipe Direction Indicators with Framer Motion */}
          <AnimatePresence>
            {swipeDirection === "right" && !isExiting && (
              <motion.div
                key="right-indicator"
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: rightIndicatorOpacity }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-500/5 border-4 border-green-500 rounded-xl" />
                <motion.div
                  className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-xl font-bold text-white shadow-lg flex items-center gap-2"
                  initial={{ scale: 0.8, rotate: -5 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <IconCircleCheck className="size-6" />
                  DRAFT
                </motion.div>
              </motion.div>
            )}
            {swipeDirection === "left" && !isExiting && (
              <motion.div
                key="left-indicator"
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: leftIndicatorOpacity }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-500/5 border-4 border-red-500 rounded-xl" />
                <motion.div
                  className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-xl font-bold text-white shadow-lg flex items-center gap-2"
                  initial={{ scale: 0.8, rotate: 5 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <IconX className="size-6" />
                  SKIP
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header: Category, Post Type, and Engagement */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Personalized Badge */}
              {data.isPersonalized && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-primary/50 bg-primary/5 text-primary text-xs"
                >
                  <IconWand className="size-3" />
                  <span className="hidden xs:inline">Personalized</span>
                </Badge>
              )}

              {/* Category Badge */}
              <Badge
                variant="secondary"
                className={cn("shrink-0 gap-1 shadow-sm", getCategoryStyle(data.category))}
              >
                <IconSparkles className="size-3" />
                {data.category}
              </Badge>

              {/* Post Type Badge */}
              {data.postType && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs border-border/50"
                >
                  {data.postType}
                </Badge>
              )}
            </div>

            {engagementInfo && (
              <motion.div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm shrink-0",
                  engagementInfo.bgClass,
                  engagementInfo.colorClass
                )}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
              >
                <engagementInfo.Icon className="size-3.5" />
                <span className="tabular-nums">{data.estimatedEngagement}%</span>
                <span className="hidden sm:inline">{engagementInfo.label}</span>
              </motion.div>
            )}
          </div>

          {/* Author Info (if available) */}
          {data.author && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{data.author.name}</span>
              {data.author.headline && (
                <span className="block truncate">{data.author.headline}</span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">
              {data.content}
            </p>
          </div>

          {/* Footer: Counter */}
          {counterText && (
            <motion.div
              className="mt-4 pt-3 border-t border-border/50 text-center text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <IconSparkles className="size-3 text-primary" />
                {counterText}
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * SwipeCardStack renders multiple cards in a stacked deck appearance.
 * Background cards are slightly scaled down, offset vertically, and tilted
 * to create a natural "deck of cards" look. When the top card is swiped
 * away, the next card smoothly animates into position via spring physics.
 *
 * Uses `exitingCardId` instead of a boolean `isExiting` so that exit
 * animations are always scoped to a specific card. When that card is
 * removed from the list, the next card won't accidentally inherit
 * the exiting state.
 *
 * @example
 * ```tsx
 * <SwipeCardStack
 *   cards={suggestions.slice(0, 3)}
 *   topCardOffset={swipeOffset}
 *   isDragging={isDragging}
 *   exitingCardId={exitingCardId}
 *   exitDirection={exitDirection}
 * />
 * ```
 */
export function SwipeCardStack({
  cards,
  topCardOffset = 0,
  isDragging = false,
  exitingCardId = null,
  exitDirection = null,
  className,
}: {
  cards: SwipeCardData[]
  topCardOffset?: number
  isDragging?: boolean
  /** ID of the card currently exiting (null if none) */
  exitingCardId?: string | null
  exitDirection?: "left" | "right" | null
  className?: string
}) {
  // Show at most 3 cards in the stack
  const visibleCards = cards.slice(0, 3)

  return (
    <motion.div
      className={cn("relative h-[520px] w-full max-w-lg", className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Subtle shadow underneath stack */}
      <div className="absolute inset-x-4 bottom-0 h-4 rounded-full bg-black/5 blur-xl dark:bg-black/20" />

      {/* Background cards (rendered first, lower z-index) */}
      {visibleCards
        .slice(1)
        .reverse()
        .map((card, index) => {
          const stackIndex = visibleCards.length - 2 - index
          const cardScale = 1 - (stackIndex + 1) * 0.04
          const cardOffset = (stackIndex + 1) * 10
          const cardRotation = (stackIndex + 1) * -1.5
          const cardOpacity = Math.max(0.5, 1 - stackIndex * 0.15)

          return (
            <SwipeCard
              key={card.id}
              data={card}
              scale={cardScale}
              stackOffset={cardOffset}
              stackRotation={cardRotation}
              opacity={cardOpacity}
              zIndex={index}
            />
          )
        })}

      {/* Top card — only apply exit animation if this specific card is exiting */}
      {visibleCards.length > 0 && (
        <SwipeCard
          key={visibleCards[0].id}
          data={visibleCards[0]}
          offsetX={topCardOffset}
          isDragging={isDragging}
          isExiting={visibleCards[0].id === exitingCardId}
          exitDirection={visibleCards[0].id === exitingCardId ? exitDirection : null}
          zIndex={visibleCards.length}
          counterText={`${cards.length} suggestion${cards.length !== 1 ? 's' : ''} remaining`}
        />
      )}
    </motion.div>
  )
}

/**
 * Empty state for when no cards are available
 */
export function SwipeCardEmpty() {
  return (
    <motion.div
      className="relative h-[520px] w-full max-w-lg flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="w-full h-full border-border/50 !bg-background dark:!bg-zinc-900">
        <CardContent className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-br from-transparent via-transparent to-primary/5 dark:to-primary/10">
          <motion.div
            className="rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 p-4 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          >
            <IconSparkles className="size-8 text-primary" />
          </motion.div>
          <motion.h3
            className="text-lg font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            All caught up!
          </motion.h3>
          <motion.p
            className="text-sm text-muted-foreground max-w-[250px] mt-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            You've reviewed all suggestions. Check back later for new content ideas.
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
