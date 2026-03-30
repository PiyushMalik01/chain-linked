"use client"

/**
 * Post Series Composer
 * @description Two-column layout for creating a series of related LinkedIn posts.
 * Left: AI chat for series planning. Right: carousel of generated posts.
 * @module components/features/compose/post-series-composer
 */

import * as React from "react"
import { motion } from "framer-motion"
import {
  IconSparkles,
  IconPlus,
  IconX,
  IconCopy,
  IconCheck,
  IconCalendar,
  IconBrandLinkedin,
  IconFile,
  IconLoader2,
  IconSend,
  IconDeviceFloppy,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fadeSlideUpVariants } from "@/lib/animations"
import { useConversationPersistence } from "@/hooks/use-conversation-persistence"
import { useApiKeys } from "@/hooks/use-api-keys"
import { showSuccess } from "@/lib/toast-utils"
import { ComposeSeriesMode } from "./compose-series-mode"
import { SeriesPostCarousel } from "./series-post-carousel"
import type { SeriesPost } from "@/types/compose"
import type { UIMessage } from "ai"

/**
 * Props for PostSeriesComposer
 */
interface PostSeriesComposerProps {
  /** User profile for LinkedIn preview */
  userProfile: {
    name: string
    headline: string
    avatarUrl?: string
  }
  /** Callback when user wants to schedule the series */
  onScheduleConfirm?: (posts: SeriesPost[]) => void
  /** Whether user has API key configured */
  hasApiKey?: boolean
}

/**
 * Post Series Composer — two-column layout for creating LinkedIn post series
 * @param props - Component props
 * @returns Series composer JSX element
 */
export function PostSeriesComposer({
  userProfile,
  onScheduleConfirm,
  hasApiKey: hasApiKeyProp,
}: PostSeriesComposerProps) {
  const [posts, setPosts] = React.useState<SeriesPost[]>(() => {
    // Restore series draft from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('chainlinked-series-draft')
        if (raw) {
          localStorage.removeItem('chainlinked-series-draft')
          const data = JSON.parse(raw)
          if (data?.type === 'series' && Array.isArray(data.posts)) {
            return data.posts as SeriesPost[]
          }
        }
      } catch { /* ignore */ }
    }
    return []
  })
  const [currentPostIndex, setCurrentPostIndex] = React.useState(0)
  const { status: apiKeyStatus } = useApiKeys()
  const hasApiKey = hasApiKeyProp ?? (apiKeyStatus?.hasKey ?? false)

  // Conversation persistence for series mode
  const {
    persistedMessages,
    conversationId,
    saveMessages,
    clearConversation,
    isLoading: convoLoading,
  } = useConversationPersistence('series')

  /**
   * Restore generated posts from persisted messages on load
   * Extracts the last generateSeries tool output from the chat history
   */
  React.useEffect(() => {
    if (persistedMessages.length === 0 || posts.length > 0) return

    // Find the last generateSeries output in persisted messages
    for (let i = persistedMessages.length - 1; i >= 0; i--) {
      const msg = persistedMessages[i]
      if (msg.role !== 'assistant' || !msg.parts) continue

      for (const part of msg.parts) {
        const p = part as { type: string; state?: string; output?: unknown }
        if (p.type === 'tool-generateSeries' && p.state === 'output-available' && p.output) {
          const result = p.output as { posts?: SeriesPost[] }
          if (result.posts && result.posts.length > 0) {
            setPosts(result.posts)
            setCurrentPostIndex(0)
            return
          }
        }
      }
    }
  }, [persistedMessages, posts.length])

  /**
   * Handle series generation from AI
   */
  const handleSeriesGenerated = React.useCallback((generatedPosts: SeriesPost[]) => {
    setPosts(generatedPosts)
    setCurrentPostIndex(0)
  }, [])

  /** Memoized callback for passing messages to persistence */
  const handleMessagesChange = React.useCallback(
    (msgs: UIMessage[]) => {
      saveMessages(msgs as unknown as Array<{ id: string; role: string; parts: Array<{ type: string; text?: string; [key: string]: unknown }> }>)
    },
    [saveMessages]
  )

  /**
   * Handle content change for a specific post
   */
  const handleContentChange = React.useCallback((index: number, newContent: string) => {
    setPosts((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], post: newContent }
      return updated
    })
  }, [])

  /**
   * Handle new chat
   */
  const handleNewChat = React.useCallback(async () => {
    await clearConversation()
    setPosts([])
    setCurrentPostIndex(0)
  }, [clearConversation])

  const [isSavingDraft, setIsSavingDraft] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  /**
   * Copy the current post to clipboard
   */
  const handleCopyCurrentPost = React.useCallback(async () => {
    const currentPost = posts[currentPostIndex]
    if (!currentPost) return
    try {
      await navigator.clipboard.writeText(currentPost.post)
      setCopied(true)
      showSuccess("Post copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error("Failed to copy")
    }
  }, [posts, currentPostIndex])

  /**
   * Copy all posts in the series to clipboard
   */
  const handleCopyAllPosts = React.useCallback(async () => {
    if (posts.length === 0) return
    try {
      const allText = posts
        .map((p, i) => `--- Post ${i + 1}: ${p.subtopic} ---\n\n${p.post}`)
        .join("\n\n\n")
      await navigator.clipboard.writeText(allText)
      setCopied(true)
      showSuccess(`All ${posts.length} posts copied to clipboard!`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error("Failed to copy")
    }
  }, [posts])

  /**
   * Save the entire series as a single draft with structured JSON
   */
  const handleSaveDrafts = React.useCallback(async () => {
    if (posts.length === 0) return

    setIsSavingDraft(true)
    try {
      // Build a readable preview for the content field
      const preview = posts
        .map((p, i) => `[Post ${i + 1}: ${p.subtopic}]\n${p.post}`)
        .join('\n\n---\n\n')

      // Store the full series data as JSON in source_snippet for restoring later
      const seriesData = JSON.stringify({
        type: 'series',
        posts: posts.map(p => ({
          subtopic: p.subtopic,
          summary: p.summary,
          post: p.post,
        })),
      })

      const res = await fetch('/api/drafts/auto-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: preview,
          postType: 'series',
          source: 'series',
          context: seriesData,
        }),
      })

      if (res.ok) {
        showSuccess(`Series with ${posts.length} posts saved as draft!`)
      }
    } catch (err) {
      console.error('Failed to save drafts:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }, [posts])

  /**
   * Copy current post and open LinkedIn
   */
  const handleCopyAndOpenLinkedIn = React.useCallback(async () => {
    await handleCopyCurrentPost()
    window.open("https://www.linkedin.com/feed/", "_blank")
    showSuccess("LinkedIn opened! Paste your post (Ctrl+V)")
  }, [handleCopyCurrentPost])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left Column — Series Chat */}
      <motion.div
        variants={fadeSlideUpVariants}
        initial="initial"
        animate="animate"
      >
        <Card className="relative flex flex-col overflow-hidden border-destructive/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconSparkles className="size-4 text-destructive" />
                <CardTitle>Post Series</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="text-xs text-muted-foreground gap-1"
              >
                <IconPlus className="size-3" />
                New Chat
              </Button>
            </div>
            <CardDescription>
              Create a series of related posts around a central theme
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col">
            <ComposeSeriesMode
              onSeriesGenerated={handleSeriesGenerated}
              hasApiKey={hasApiKey}
              persistedMessages={persistedMessages.length > 0 ? persistedMessages as unknown as UIMessage[] : undefined}
              conversationId={conversationId}
              onMessagesChange={handleMessagesChange}
              onNewChat={handleNewChat}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Right Column — Series Post Carousel */}
      <motion.div
        variants={fadeSlideUpVariants}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.1 }}
      >
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Series Preview
              {posts.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {posts.length} post{posts.length !== 1 ? 's' : ''}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {posts.length === 0
                ? "Your post series will appear here"
                : `Viewing post ${currentPostIndex + 1} of ${posts.length}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1">
            {posts.length > 0 ? (
              <SeriesPostCarousel
                posts={posts}
                currentIndex={currentPostIndex}
                onIndexChange={setCurrentPostIndex}
                onContentChange={handleContentChange}
                userProfile={userProfile}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted/60 p-4 mb-3">
                  <IconSparkles className="size-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Chat with AI to generate your post series
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your series of 2-5 related posts will appear here
                </p>
              </div>
            )}
          </CardContent>

          {/* Action Buttons — only shown when posts exist */}
          {posts.length > 0 && (
            <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCurrentPost}
                  className="gap-1.5 text-xs"
                >
                  {copied ? (
                    <IconCheck className="size-3.5 text-green-500" />
                  ) : (
                    <IconCopy className="size-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy Post"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveDrafts}
                  disabled={isSavingDraft}
                  className="gap-1.5 text-xs"
                >
                  {isSavingDraft ? (
                    <IconLoader2 className="size-3.5 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="size-3.5" />
                  )}
                  {isSavingDraft ? "Saving..." : "Save Drafts"}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyAndOpenLinkedIn}
                  className="gap-1.5 bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  <IconSend className="size-3.5" />
                  Post Now
                </Button>
                {onScheduleConfirm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onScheduleConfirm(posts)}
                    className="gap-1.5"
                  >
                    <IconCalendar className="size-3.5" />
                    Schedule Series
                  </Button>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
