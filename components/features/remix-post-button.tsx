"use client"

/**
 * Remix Post Button Component
 * @description Self-contained button that opens RemixDialog for a given post.
 * On successful remix, loads the result into the draft context and navigates to the Composer.
 * @module components/features/remix-post-button
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconRefresh } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RemixDialog, type RemixSettings } from "@/components/features/remix-dialog"
import { useDraft } from "@/lib/store/draft-context"
import { useApiKeys } from "@/hooks/use-api-keys"

/**
 * Props for RemixPostButton
 */
export interface RemixPostButtonProps {
  /** Unique identifier of the post to remix */
  postId: string
  /** Post content to remix */
  content: string
  /** Author name to attribute (optional) */
  authorName?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Self-contained remix button that manages its own dialog state.
 * Only renders when content is truthy and longer than 20 characters.
 * On successful remix, loads content into the draft context and redirects to Compose.
 *
 * @param props - Component props
 * @param props.postId - ID of the source post
 * @param props.content - Text content of the post to remix
 * @param props.authorName - Display name of the post author
 * @param props.className - Optional extra classes on the button
 * @returns Remix button with attached dialog, or null if content too short
 *
 * @example
 * ```tsx
 * <RemixPostButton
 *   postId={post.id}
 *   content={post.content}
 *   authorName="Jane Doe"
 * />
 * ```
 */
export function RemixPostButton({
  postId,
  content,
  authorName,
  className,
}: RemixPostButtonProps) {
  const router = useRouter()
  const { loadForRemix } = useDraft()
  const { status: apiKeyStatus } = useApiKeys()
  const hasApiKey = apiKeyStatus?.hasKey ?? false

  const [isOpen, setIsOpen] = React.useState(false)

  // Only render if there is meaningful content to remix
  if (!content || content.length <= 20) return null

  /**
   * Handle a successful remix — load into draft and navigate to Compose.
   * @param remixedContent - AI-generated remixed content
   * @param settings - Remix settings chosen by the user
   */
  const handleRemixed = (remixedContent: string, settings: RemixSettings) => {
    loadForRemix(postId, remixedContent, authorName, undefined, {
      tone: settings.tone,
      length: settings.length,
      customInstructions: settings.customInstructions,
      originalContent: content,
    })
    router.push("/dashboard/compose")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5",
          className
        )}
        aria-label="Remix this post with AI"
      >
        <IconRefresh className="size-3.5" />
        Remix
      </Button>

      <RemixDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        originalContent={content}
        originalAuthor={authorName}
        onRemixed={handleRemixed}
        hasApiKey={hasApiKey}
      />
    </>
  )
}
