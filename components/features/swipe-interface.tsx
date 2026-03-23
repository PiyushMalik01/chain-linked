/**
 * Swipe Interface Component
 * @description Tinder-style card swipe interface for quickly reviewing post suggestions,
 * allowing users to like, skip, remix, or save posts with gesture or button controls.
 * @module components/features/swipe-interface
 */

"use client"

import * as React from "react"
import {
  IconX,
  IconHeart,
  IconPencil,
  IconSparkles,
  IconMoodEmpty,
  IconChartBar,
  IconWand,
} from "@tabler/icons-react"

import { trackSwipeAction } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Represents a single AI-generated post suggestion
 */
export interface PostSuggestion {
  /** Unique identifier for the suggestion */
  id: string
  /** The post content text */
  content: string
  /** Category/topic of the post (e.g., "Leadership", "Tech Tips") */
  category: string
  /** Predicted engagement score (0-100) */
  estimatedEngagement?: number
}

/**
 * Props for the SwipeInterface component
 */
export interface SwipeInterfaceProps {
  /** Array of post suggestions to display in the card stack */
  suggestions?: PostSuggestion[]
  /** Callback fired when a card is swiped */
  onSwipe?: (id: string, direction: "left" | "right") => void
  /** Callback fired when user wants to post a suggestion (right swipe or post button) */
  onPost?: (suggestion: PostSuggestion) => void
  /** Callback fired when user wants to remix a suggestion with AI */
  onRemix?: (suggestion: PostSuggestion) => void
  /** Shows loading skeleton when true */
  isLoading?: boolean
}

/** Threshold in pixels for swipe to be considered a decision */
const SWIPE_THRESHOLD = 100

/**
 * Returns the engagement level label and color based on score
 * @param score - Engagement score from 0-100
 * @returns Object with label and color class
 */
function getEngagementLevel(score: number): { label: string; colorClass: string } {
  if (score >= 85) return { label: "High", colorClass: "text-green-600 dark:text-green-400" }
  if (score >= 70) return { label: "Good", colorClass: "text-blue-600 dark:text-blue-400" }
  if (score >= 50) return { label: "Moderate", colorClass: "text-yellow-600 dark:text-yellow-400" }
  return { label: "Low", colorClass: "text-muted-foreground" }
}

/**
 * Loading skeleton for the swipe interface
 */
function SwipeInterfaceSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-[520px] w-full max-w-lg">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-14 w-36 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Empty state displayed when no more swipe suggestions are available
 * @returns JSX element with illustration and encouraging message
 */
function EmptyState() {
  return (
    <div className="flex h-[520px] w-full max-w-lg flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-gradient-to-br from-muted/30 to-primary/5 p-8 text-center">
      <div className="rounded-full bg-gradient-to-br from-primary/15 to-secondary/10 p-5 mb-4">
        <IconMoodEmpty className="size-10 text-muted-foreground/60" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No more suggestions</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Check back later for fresh AI-generated post ideas tailored to your audience.
      </p>
    </div>
  )
}

/**
 * Tinder-style swipe interface for AI-generated post suggestions.
 *
 * Features a stack of cards that users can swipe left (dislike) or right (like)
 * to review AI-generated post suggestions. Supports both touch/drag gestures
 * and keyboard navigation (left/right arrow keys).
 *
 * @example
 * ```tsx
 * // Basic usage with default sample data
 * <SwipeInterface />
 *
 * // With custom data and callbacks
 * <SwipeInterface
 *   suggestions={mySuggestions}
 *   onSwipe={(id, direction) => console.log(`Swiped ${direction} on ${id}`)}
 *   onPost={(suggestion) => handlePost(suggestion)}
 * />
 *
 * // Loading state
 * <SwipeInterface isLoading />
 * ```
 */
export function SwipeInterface({
  suggestions = [],
  onSwipe,
  onPost,
  onRemix,
  isLoading = false,
}: SwipeInterfaceProps) {
  // Card stack state (reversed so first item is on top visually)
  const [cards, setCards] = React.useState<PostSuggestion[]>([...suggestions].reverse())

  // Swipe interaction state
  const [swipeOffset, setSwipeOffset] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)
  const [exitDirection, setExitDirection] = React.useState<"left" | "right" | null>(null)

  // Refs for drag handling
  const containerRef = React.useRef<HTMLDivElement>(null)
  const startXRef = React.useRef(0)

  // Sync cards when suggestions prop changes
  React.useEffect(() => {
    setCards([...suggestions].reverse())
  }, [suggestions])

  // Current card is the last in the array (top of stack)
  const currentCard = cards.length > 0 ? cards[cards.length - 1] : null

  /**
   * Handles the swipe action (removes card and triggers callbacks)
   */
  const handleSwipe = React.useCallback(
    (direction: "left" | "right") => {
      if (!currentCard || isAnimatingOut) return

      // Trigger exit animation
      setIsAnimatingOut(true)
      setExitDirection(direction)

      // After animation, remove card and reset state
      setTimeout(() => {
        setCards((prev) => prev.slice(0, -1))
        setSwipeOffset(0)
        setIsAnimatingOut(false)
        setExitDirection(null)

        // Fire callbacks
        trackSwipeAction(direction, currentCard.id)
        onSwipe?.(currentCard.id, direction)
        if (direction === "right") {
          onPost?.(currentCard)
        }
      }, 300)
    },
    [currentCard, isAnimatingOut, onSwipe, onPost]
  )

  /**
   * Mouse/touch event handlers for drag interaction
   */
  const handleDragStart = React.useCallback(
    (clientX: number) => {
      if (isAnimatingOut) return
      setIsDragging(true)
      startXRef.current = clientX
    },
    [isAnimatingOut]
  )

  const handleDragMove = React.useCallback(
    (clientX: number) => {
      if (!isDragging) return
      const deltaX = clientX - startXRef.current
      setSwipeOffset(deltaX)
    },
    [isDragging]
  )

  const handleDragEnd = React.useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      handleSwipe(swipeOffset > 0 ? "right" : "left")
    } else {
      // Snap back to center
      setSwipeOffset(0)
    }
  }, [isDragging, swipeOffset, handleSwipe])

  // Mouse event handlers
  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX)
  const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX)
  const onMouseUp = () => handleDragEnd()
  const onMouseLeave = () => {
    if (isDragging) handleDragEnd()
  }

  // Touch event handlers
  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX)
  const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX)
  const onTouchEnd = () => handleDragEnd()

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handleSwipe("left")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleSwipe("right")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSwipe])

  // Calculate visual feedback values
  const rotation = swipeOffset * 0.05
  // Opacity calculation available for future use if needed
  const swipeDirection: "left" | "right" | null =
    swipeOffset > 30 ? "right" : swipeOffset < -30 ? "left" : null

  // Loading state
  if (isLoading) {
    return <SwipeInterfaceSkeleton />
  }

  // Empty state
  if (!currentCard) {
    return (
      <div className="flex flex-col items-center gap-6">
        <EmptyState />
        <div className="flex gap-4">
          <Button variant="outline" size="icon-lg" className="rounded-full opacity-50" disabled>
            <IconX className="size-6" />
          </Button>
          <Button variant="outline" size="icon-lg" className="rounded-full opacity-50" disabled>
            <IconHeart className="size-6" />
          </Button>
          <Button variant="outline" className="rounded-full opacity-50" disabled>
            <IconPencil className="size-5" />
            Edit & Post
          </Button>
        </div>
      </div>
    )
  }

  const engagementInfo = currentCard.estimatedEngagement
    ? getEngagementLevel(currentCard.estimatedEngagement)
    : null

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card Stack Container */}
      <div
        ref={containerRef}
        className="relative h-[520px] w-full max-w-lg select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Background cards (stacked effect) */}
        {cards.slice(0, -1).map((card, index) => {
          const stackIndex = cards.length - 2 - index
          const scale = 1 - stackIndex * 0.03
          const translateY = stackIndex * 8

          return (
            <Card
              key={card.id}
              className="absolute inset-0 cursor-default"
              style={{
                transform: `scale(${scale}) translateY(${translateY}px)`,
                zIndex: index,
                opacity: Math.max(0.3, 1 - stackIndex * 0.2),
              }}
            >
              <CardContent className="flex h-full flex-col p-6">
                <Badge variant="secondary" className="mb-4 w-fit">
                  <IconSparkles className="size-3" />
                  {card.category}
                </Badge>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-6">
                  {card.content}
                </p>
              </CardContent>
            </Card>
          )
        })}

        {/* Current (top) card */}
        <Card
          className={cn(
            "absolute inset-0 cursor-grab transition-shadow active:cursor-grabbing border-border/60 dark:border-border",
            isDragging && "shadow-xl",
            isAnimatingOut && "transition-all duration-300 ease-out"
          )}
          style={{
            transform: isAnimatingOut
              ? `translateX(${exitDirection === "right" ? 500 : -500}px) rotate(${exitDirection === "right" ? 20 : -20}deg)`
              : `translateX(${swipeOffset}px) rotate(${rotation}deg)`,
            opacity: isAnimatingOut ? 0 : 1,
            zIndex: cards.length,
          }}
        >
          <CardContent className="relative flex h-full flex-col p-6">
            {/* Swipe direction indicators */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-4 border-green-500 bg-green-500/10 transition-opacity duration-150",
                swipeDirection === "right" ? "opacity-100" : "opacity-0"
              )}
            >
              <div className="rounded-lg bg-green-500 px-4 py-2 text-lg font-bold text-white">
                EDIT & SAVE
              </div>
            </div>
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-4 border-red-500 bg-red-500/10 transition-opacity duration-150",
                swipeDirection === "left" ? "opacity-100" : "opacity-0"
              )}
            >
              <div className="rounded-lg bg-red-500 px-4 py-2 text-lg font-bold text-white">
                SKIP
              </div>
            </div>

            {/* Card content */}
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="w-fit">
                <IconSparkles className="size-3" />
                {currentCard.category}
              </Badge>
              {engagementInfo && (
                <div className="flex items-center gap-1.5 text-xs">
                  <IconChartBar className="size-3.5 text-muted-foreground" />
                  <span className={engagementInfo.colorClass}>
                    {currentCard.estimatedEngagement}% {engagementInfo.label}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {currentCard.content}
              </p>
            </div>

            {/* Card counter */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {cards.length} suggestion{cards.length !== 1 ? "s" : ""} remaining
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          className="rounded-full border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:border-red-700 dark:hover:bg-red-950"
          onClick={() => handleSwipe("left")}
          disabled={isAnimatingOut}
          aria-label="Dislike suggestion"
        >
          <IconX className="size-6" />
        </Button>

        <Button
          variant="outline"
          size="icon-lg"
          className="rounded-full border-green-200 text-green-500 hover:border-green-300 hover:bg-green-50 hover:text-green-600 dark:border-green-800 dark:hover:border-green-700 dark:hover:bg-green-950"
          onClick={() => handleSwipe("right")}
          disabled={isAnimatingOut}
          aria-label="Like suggestion"
        >
          <IconHeart className="size-6" />
        </Button>

        <Button
          variant="outline"
          className="rounded-full border-primary/30 text-primary hover:border-primary hover:bg-primary/10"
          onClick={() => {
            if (currentCard) {
              onRemix?.(currentCard)
            }
          }}
          disabled={isAnimatingOut}
          aria-label="Remix suggestion with AI"
        >
          <IconWand className="size-4" />
          Remix
        </Button>

        <Button
          variant="default"
          className="rounded-full"
          onClick={() => {
            if (currentCard) {
              onPost?.(currentCard)
            }
          }}
          disabled={isAnimatingOut}
        >
          <IconPencil className="size-4" />
          Edit & Save
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground">
        Use <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">←</kbd>{" "}
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">→</kbd> arrow
        keys to swipe
      </p>
    </div>
  )
}
