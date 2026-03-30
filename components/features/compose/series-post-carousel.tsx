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
  IconBold,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconHash,
  IconItalic,
  IconList,
  IconMoodSmile,
  IconPhoto,
  IconWorld,
  IconX,
  IconThumbUp,
  IconMessageCircle,
  IconRepeat,
  IconSend,
  IconPencil,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmojiPicker } from "@/components/features/emoji-picker"
import { FontPicker } from "@/components/features/font-picker"
import type { UnicodeFontStyle } from "@/lib/unicode-fonts"
import { transformSelection } from "@/lib/unicode-fonts"
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
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false)
  const [activeFontStyle, setActiveFontStyle] = React.useState<UnicodeFontStyle>('normal')
  /** Per-post media files stored by post index */
  const [postMedia, setPostMedia] = React.useState<Record<number, { name: string; url: string; type: 'image' | 'document' }[]>>({})

  const currentPost = posts[currentIndex]

  /** Apply unicode font transform to selected text */
  const applyUnicodeFont = React.useCallback((style: UnicodeFontStyle) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const post = posts[currentIndex]
    if (!post) return
    const result = transformSelection(post.post, start, end, style)
    onContentChange(currentIndex, result.text)
    setActiveFontStyle(style)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start, result.newEnd) }, 0)
  }, [posts, currentIndex, onContentChange])

  /** Insert text at cursor position */
  const insertAtCursor = React.useCallback((insert: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const post = posts[currentIndex]
    if (!post) return
    onContentChange(currentIndex, post.post.slice(0, start) + insert + post.post.slice(start))
    const newPos = start + insert.length
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newPos, newPos) }, 0)
  }, [posts, currentIndex, onContentChange])

  /** Handle file attachment for the current post */
  const handleFileAttach = React.useCallback((files: FileList, type: 'image' | 'document') => {
    const newFiles = Array.from(files).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type,
    }))
    setPostMedia((prev) => ({
      ...prev,
      [currentIndex]: [...(prev[currentIndex] || []), ...newFiles],
    }))
  }, [currentIndex])

  /** Remove a media file from the current post */
  const handleRemoveMedia = React.useCallback((mediaIndex: number) => {
    setPostMedia((prev) => {
      const current = [...(prev[currentIndex] || [])]
      if (current[mediaIndex]) {
        URL.revokeObjectURL(current[mediaIndex].url)
        current.splice(mediaIndex, 1)
      }
      return { ...prev, [currentIndex]: current }
    })
  }, [currentIndex])

  const currentMedia = postMedia[currentIndex] || []

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
              <div>
                <textarea
                  ref={textareaRef}
                  value={currentPost.post}
                  onChange={(e) => onContentChange(currentIndex, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                  className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none min-h-[300px] max-h-[600px] overflow-y-auto"
                  autoFocus
                />
              </div>
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

          {/* Formatting Toolbar — visible only in edit mode, matches single post toolbar */}
          {isEditing && (
            <div className="flex flex-wrap items-center gap-1 border-t px-4 py-2">
              {/* Bold */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeFontStyle === 'bold' || activeFontStyle === 'boldItalic' ? "secondary" : "ghost"}
                    size="icon"
                    className="size-7"
                    onMouseDown={(e) => { e.preventDefault(); applyUnicodeFont('bold') }}
                    aria-label="Bold"
                  >
                    <IconBold className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold (Ctrl+B)</TooltipContent>
              </Tooltip>

              {/* Italic */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeFontStyle === 'italic' || activeFontStyle === 'boldItalic' ? "secondary" : "ghost"}
                    size="icon"
                    className="size-7"
                    onMouseDown={(e) => { e.preventDefault(); applyUnicodeFont('italic') }}
                    aria-label="Italic"
                  >
                    <IconItalic className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic (Ctrl+I)</TooltipContent>
              </Tooltip>

              {/* List */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onMouseDown={(e) => { e.preventDefault(); insertAtCursor('\n- ') }}
                    aria-label="List"
                  >
                    <IconList className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List item</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Hashtag */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onMouseDown={(e) => { e.preventDefault(); insertAtCursor('#') }}
                    aria-label="Hashtag"
                  >
                    <IconHash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add hashtag</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Unicode Font Picker */}
              <FontPicker
                activeFontStyle={activeFontStyle}
                onFontSelect={(style) => applyUnicodeFont(style)}
              />

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Emoji Picker */}
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onOpenChange={setShowEmojiPicker}
                onSelect={(emoji) => {
                  insertAtCursor(emoji)
                  setShowEmojiPicker(false)
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Add emoji"
                  onClick={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker) }}
                >
                  <IconMoodSmile className="size-4" />
                </Button>
              </EmojiPicker>

              {/* Image Attachment */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Add image"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"
                      input.multiple = true
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files) handleFileAttach(files, 'image')
                      }
                      input.click()
                    }}
                  >
                    <IconPhoto className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add image</TooltipContent>
              </Tooltip>

              {/* Document Attachment */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Add document"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = ".pdf,.doc,.docx"
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files) handleFileAttach(files, 'document')
                      }
                      input.click()
                    }}
                  >
                    <IconFile className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add document</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Media Attachment Buttons — always visible when not editing */}
          {!isEditing && (
            <div className="flex items-center gap-1 border-t px-4 py-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Add image"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"
                      input.multiple = true
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files) handleFileAttach(files, 'image')
                      }
                      input.click()
                    }}
                  >
                    <IconPhoto className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add image</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Add document"
                    onClick={() => {
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = ".pdf,.doc,.docx"
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files) handleFileAttach(files, 'document')
                      }
                      input.click()
                    }}
                  >
                    <IconFile className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add document</TooltipContent>
              </Tooltip>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Double-click to edit text
              </span>
            </div>
          )}

          {/* Media Preview — matches single post LinkedIn-style layout */}
          {currentMedia.length > 0 && (() => {
            const imageMedia = currentMedia.filter((m) => m.type === 'image')
            const docMedia = currentMedia.filter((m) => m.type === 'document')

            return (
              <div className="group/media">
                {/* Clear all — own row above media */}
                {currentMedia.length > 1 && (
                  <div className="flex justify-end px-4 py-1.5 border-t">
                    <button
                      onClick={() => {
                        currentMedia.forEach((m) => URL.revokeObjectURL(m.url))
                        setPostMedia((prev) => ({ ...prev, [currentIndex]: [] }))
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <IconX className="size-3" />
                      Clear all
                    </button>
                  </div>
                )}

                {/* Document preview — full-width card like single post */}
                {docMedia.length > 0 && imageMedia.length === 0 && (
                  <div className="group/doc relative border-t bg-muted/50">
                    <div className="flex items-center gap-3 px-4 py-4">
                      <div className="flex size-12 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                        <IconFile className="size-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{docMedia[0].name}</p>
                        <p className="text-xs text-muted-foreground">Document</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(currentMedia.indexOf(docMedia[0]))}
                      className="absolute right-2 top-2 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 shadow-md transition-opacity group-hover/doc:opacity-100"
                      aria-label="Remove"
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                )}

                {/* Single image — full-width */}
                {imageMedia.length === 1 && (
                  <div className="group/img relative">
                    <div className="relative aspect-[4/3] w-full overflow-hidden border-t">
                      <img src={imageMedia[0].url} alt={imageMedia[0].name} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(currentMedia.indexOf(imageMedia[0]))}
                      className="absolute right-2 top-3 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                      aria-label="Remove"
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                )}

                {/* Multiple images — grid */}
                {imageMedia.length >= 2 && (
                  <div className={cn("grid gap-0.5 border-t", imageMedia.length === 2 ? "grid-cols-2" : "grid-cols-2")}>
                    {imageMedia.map((media, i) => (
                      <div key={i} className={cn("group/img relative overflow-hidden", imageMedia.length === 3 && i === 0 ? "row-span-2" : "aspect-square")} style={imageMedia.length === 3 && i === 0 ? { minHeight: '16rem' } : undefined}>
                        <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveMedia(currentMedia.indexOf(media))}
                          className="absolute right-1 top-1 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 shadow-md transition-opacity group-hover/img:opacity-100"
                          aria-label="Remove"
                        >
                          <IconX className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents below images (when both exist) */}
                {docMedia.length > 0 && imageMedia.length > 0 && docMedia.map((media, i) => (
                  <div key={i} className="group/doc relative border-t bg-muted/50">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                        <IconFile className="size-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{media.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(currentMedia.indexOf(media))}
                      className="absolute right-2 top-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 shadow-md transition-opacity group-hover/doc:opacity-100"
                      aria-label="Remove"
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}

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
