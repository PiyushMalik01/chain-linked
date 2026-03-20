"use client"

/**
 * Series Post Carousel
 * @description Carousel component for navigating and editing posts in a series.
 * Shows a LinkedIn preview card for the current post with left/right navigation.
 * @module components/features/compose/series-post-carousel
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconChevronLeft,
  IconChevronRight,
  IconWorld,
  IconThumbUp,
  IconMessageCircle,
  IconRepeat,
  IconSend,
  IconPencil,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SeriesPost } from "@/types/compose"

/**
 * Props for SeriesPostCarousel
 */
interface SeriesPostCarouselProps {
  /** Array of series posts */
  posts: SeriesPost[]
  /** Current post index */
  currentIndex: number
  /** Callback when index changes */
  onIndexChange: (index: number) => void
  /** Callback when post content is edited */
  onContentChange: (index: number, content: string) => void
  /** User profile for preview */
  userProfile: {
    name: string
    headline: string
    avatarUrl?: string
  }
}

/**
 * Carousel for navigating and editing series posts with LinkedIn preview
 * @param props - Component props
 * @returns Series post carousel JSX element
 */
export function SeriesPostCarousel({
  posts,
  currentIndex,
  onIndexChange,
  onContentChange,
  userProfile,
}: SeriesPostCarouselProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [direction, setDirection] = React.useState(0)

  const currentPost = posts[currentIndex]
  if (!currentPost) return null

  const goToPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1)
      setIsEditing(false)
      onIndexChange(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < posts.length - 1) {
      setDirection(1)
      setIsEditing(false)
      onIndexChange(currentIndex + 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrev()
    if (e.key === 'ArrowRight') goToNext()
  }

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
      opacity: 0,
    }),
  }

  return (
    <div
      className="space-y-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Post series"
    >
      {/* Navigation + indicator */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="size-8"
          aria-label="Previous post"
        >
          <IconChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentIndex ? 1 : -1)
                setIsEditing(false)
                onIndexChange(i)
              }}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === currentIndex
                  ? "bg-destructive"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to post ${i + 1}`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          disabled={currentIndex === posts.length - 1}
          className="size-8"
          aria-label="Next post"
        >
          <IconChevronRight className="size-4" />
        </Button>
      </div>

      {/* Subtopic label */}
      <div className="text-center">
        <span className="text-xs font-medium text-destructive">
          Post {currentIndex + 1}: {currentPost.subtopic}
        </span>
      </div>

      {/* LinkedIn Preview Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="rounded-lg border bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-700/60 overflow-hidden"
        >
          {/* Profile Header */}
          <div className="flex items-start gap-3 p-4 pb-3">
            <Avatar className="size-10 ring-1 ring-border/50">
              {userProfile.avatarUrl ? (
                <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {userProfile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold leading-tight text-sm">{userProfile.name}</h4>
              <p className="text-muted-foreground text-xs leading-tight mt-0.5 line-clamp-1">
                {userProfile.headline}
              </p>
              <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                <span>Just now</span>
                <span>&#183;</span>
                <IconWorld className="size-3" />
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div className="px-4 pb-3">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={currentPost.post}
                onChange={(e) => onContentChange(currentIndex, e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none min-h-[300px] max-h-[600px] overflow-y-auto"
                autoFocus
              />
            ) : (
              <div
                className="group relative cursor-text min-h-[300px]"
                onDoubleClick={() => setIsEditing(true)}
                role="button"
                tabIndex={0}
                aria-label="Double-click to edit"
              >
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed max-h-[600px] overflow-y-auto">
                  {currentPost.post}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-muted/30 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                  <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm flex items-center gap-1.5">
                    <IconPencil className="size-3" />
                    Double-click to edit
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="text-muted-foreground flex items-center px-4 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex -space-x-1">
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#378FE9] text-[8px] text-white ring-1 ring-white dark:ring-zinc-900">&#128077;</span>
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#DF704D] text-[8px] text-white ring-1 ring-white dark:ring-zinc-900">&#10084;</span>
              </span>
              <span className="tabular-nums">0</span>
            </span>
            <span className="ml-auto flex items-center gap-2 tabular-nums">
              <span>0 comments</span>
              <span>&#183;</span>
              <span>0 reposts</span>
            </span>
          </div>

          {/* LinkedIn Action Buttons */}
          <div className="flex items-center justify-around border-t py-0.5 px-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground flex-1 gap-1.5 text-xs" disabled>
              <IconThumbUp className="size-4" /> Like
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground flex-1 gap-1.5 text-xs" disabled>
              <IconMessageCircle className="size-4" /> Comment
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground flex-1 gap-1.5 text-xs" disabled>
              <IconRepeat className="size-4" /> Repost
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground flex-1 gap-1.5 text-xs" disabled>
              <IconSend className="size-4" /> Send
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Summary */}
      <p className="text-xs text-muted-foreground text-center italic">
        {currentPost.summary}
      </p>
    </div>
  )
}
