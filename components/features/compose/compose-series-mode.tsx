"use client"

/**
 * Compose Series Mode
 * @description Chat interface for generating a series of related posts.
 * Uses useChat with the compose-series API endpoint and tools.
 * @module components/features/compose/compose-series-mode
 */

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconSend,
  IconSparkles,
  IconLoader2,
  IconCheck,
  IconMessageChatbot,
  IconChevronDown,
  IconPencil,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ComposeToneSelector } from "./compose-tone-selector"
import {
  chatMessageVariants,
  mcqOptionVariants,
  staggerFastContainerVariants,
} from "@/lib/animations"
import type { McqOption, SeriesPost } from "@/types/compose"

/**
 * Props for ComposeSeriesMode
 */
interface ComposeSeriesModeProps {
  /** Callback when series is generated */
  onSeriesGenerated: (posts: SeriesPost[]) => void
  /** Whether user has API key */
  hasApiKey: boolean
  /** Persisted messages from database */
  persistedMessages?: UIMessage[]
  /** Current conversation ID (used to detect "New Chat" resets) */
  conversationId?: string | null
  /** Callback when messages change */
  onMessagesChange?: (messages: UIMessage[]) => void
  /** Callback to start new chat */
  onNewChat?: () => void
}

/**
 * Extracts text content from a UIMessage's parts array
 */
function getTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('')
}

/**
 * Slidable series preview card shown in the chat
 * Displays one post at a time with navigation dots
 */
function SeriesPreviewSlider({
  result,
  onUse,
  onRetry,
  isReady,
}: {
  result: { posts: SeriesPost[]; seriesTheme: string }
  onUse: () => void
  onRetry: () => void
  isReady: boolean
}) {
  const [slideIndex, setSlideIndex] = React.useState(0)
  const post = result.posts[slideIndex]

  return (
    <motion.div
      variants={chatMessageVariants}
      initial="initial"
      animate="animate"
      className="rounded-lg border border-destructive/20 bg-background p-3 space-y-2"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <IconSparkles className="size-3.5 text-destructive" />
        <span>Series: {result.seriesTheme} ({result.posts.length} posts)</span>
      </div>

      {/* Slidable post card */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
            disabled={slideIndex === 0}
          >
            <IconChevronLeft className="size-3.5" />
          </Button>

          <div className="flex-1 rounded-md border border-border/50 p-2.5 min-h-[60px] max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin">
            <p className="text-[11px] font-medium text-destructive mb-1">
              Post {slideIndex + 1}: {post?.subtopic}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {post?.summary}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 whitespace-pre-wrap leading-relaxed">
              {post?.post}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => setSlideIndex(Math.min(result.posts.length - 1, slideIndex + 1))}
            disabled={slideIndex === result.posts.length - 1}
          >
            <IconChevronRight className="size-3.5" />
          </Button>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5">
          {result.posts.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === slideIndex
                  ? "bg-destructive"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to post ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={onUse}
          className="gap-1.5 bg-destructive hover:bg-destructive/90 h-7 text-xs"
        >
          <IconCheck className="size-3" />
          Use These Posts
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={!isReady}
          className="gap-1.5 h-7 text-xs"
        >
          <IconRefresh className="size-3" />
          Try Again
        </Button>
      </div>
    </motion.div>
  )
}

/**
 * Series mode chat interface with streaming AI conversation
 * @param props - Component props
 * @returns Series mode chat JSX element
 */
export function ComposeSeriesMode({
  onSeriesGenerated,
  hasApiKey,
  persistedMessages: persistedMsgs,
  conversationId,
  onMessagesChange,
  onNewChat,
}: ComposeSeriesModeProps) {
  const [tone, setTone] = React.useState('professional')
  const [showToneSelector, setShowToneSelector] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [customInputId, setCustomInputId] = React.useState<string | null>(null)
  const [customInputValue, setCustomInputValue] = React.useState('')
  const [hasGeneratedSeries, setHasGeneratedSeries] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const customInputRef = React.useRef<HTMLTextAreaElement>(null)

  const transport = React.useMemo(
    () => new DefaultChatTransport({
      api: '/api/ai/compose-series',
      body: { tone },
    }),
    [tone]
  )

  const defaultGreeting = React.useMemo<UIMessage[]>(() => [
    {
      id: 'greeting',
      role: 'assistant',
      parts: [{ type: 'text', text: 'What theme would you like your post series to cover?' }],
    },
  ], [])

  const initialMessagesRef = React.useRef(
    persistedMsgs && persistedMsgs.length > 0 ? persistedMsgs : defaultGreeting
  )

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    stop,
  } = useChat({
    transport,
    messages: initialMessagesRef.current,
  })

  /** Restore chat messages when persisted data loads asynchronously */
  const hasRestoredRef = React.useRef(
    !!(persistedMsgs && persistedMsgs.length > 0)
  )
  React.useEffect(() => {
    if (hasRestoredRef.current) return
    if (persistedMsgs && persistedMsgs.length > 0) {
      hasRestoredRef.current = true
      setMessages(persistedMsgs)
    }
  }, [persistedMsgs, setMessages])

  /** Detect "New Chat" resets from parent via conversationId transition */
  const prevConversationIdRef = React.useRef(conversationId)
  React.useEffect(() => {
    const wasActive = prevConversationIdRef.current !== undefined && prevConversationIdRef.current !== null
    const isNowCleared = conversationId === null || conversationId === undefined
    if (wasActive && isNowCleared) {
      setMessages(defaultGreeting)
      setHasGeneratedSeries(false)
      setInput('')
      setCustomInputId(null)
      setCustomInputValue('')
      hasRestoredRef.current = false
    }
    prevConversationIdRef.current = conversationId
  }, [conversationId, defaultGreeting, setMessages])

  /** Auto-scroll to bottom */
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  /** Notify parent — guarded to prevent redundant calls */
  const onMessagesChangeRef = React.useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange

  const lastNotifiedRef = React.useRef<{ length: number; lastId: string | null }>({
    length: 0,
    lastId: null,
  })

  React.useEffect(() => {
    if (!onMessagesChangeRef.current || messages.length <= 1) return
    const lastId = messages[messages.length - 1]?.id ?? null
    const prev = lastNotifiedRef.current
    if (prev.length === messages.length && prev.lastId === lastId) return
    lastNotifiedRef.current = { length: messages.length, lastId }
    onMessagesChangeRef.current(messages)
  }, [messages])

  /** Detect series generation — guarded */
  const prevHasSeriesRef = React.useRef(false)
  React.useEffect(() => {
    const hasSeries = messages.some((m) =>
      m.parts?.some((p) => {
        const part = p as { type: string; state?: string }
        return part.type === 'tool-generateSeries' && part.state === 'output-available'
      })
    )
    if (hasSeries !== prevHasSeriesRef.current) {
      prevHasSeriesRef.current = hasSeries
      setHasGeneratedSeries(hasSeries)
    }
  }, [messages])

  const handleOptionSelect = (option: McqOption) => {
    setCustomInputId(null)
    setCustomInputValue('')
    sendMessage({ text: option.label })
  }

  const handleTypeYourOwn = (toolCallId: string) => {
    setCustomInputId(toolCallId)
    setCustomInputValue('')
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customInputValue.trim() || status !== 'ready') return
    sendMessage({ text: customInputValue.trim() })
    setCustomInputId(null)
    setCustomInputValue('')
  }

  const handleUseSeries = (seriesPosts: SeriesPost[]) => {
    onSeriesGenerated(seriesPosts)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status !== 'ready') return
    sendMessage({ text: input.trim() })
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  /** Undo last user message and AI response */
  const handleUndo = React.useCallback(() => {
    if (messages.length <= 1) return
    // Find last user message index and remove everything from there
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx > 0) {
      setMessages(messages.slice(0, lastUserIdx))
    }
  }, [messages, setMessages])

  return (
    <div className="flex flex-col flex-1" style={{ minHeight: '300px', maxHeight: '480px' }}>
      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-2 mb-2 scrollbar-thin"
      >
        {messages.map((message) => {
          if (message.role === 'user') {
            const textContent = message.parts
              ? getTextFromParts(message.parts as Array<{ type: string; text?: string }>)
              : ''
            if (!textContent) return null
            return (
              <motion.div
                key={message.id}
                variants={chatMessageVariants}
                initial="initial"
                animate="animate"
                className="flex justify-end"
              >
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm">
                  {textContent}
                </div>
              </motion.div>
            )
          }

          if (message.role === 'assistant') {
            return (
              <div key={message.id} className="space-y-2">
                {message.parts?.map((part, partIndex) => {
                  if (part.type === 'text' && part.text) {
                    return (
                      <motion.div
                        key={`${message.id}-text-${partIndex}`}
                        variants={chatMessageVariants}
                        initial="initial"
                        animate="animate"
                        className="flex justify-start"
                      >
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/50 border px-3 py-2 text-sm">
                          <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                            <IconMessageChatbot className="size-3" />
                            <span>AI</span>
                          </div>
                          {part.text}
                        </div>
                      </motion.div>
                    )
                  }

                  // Tool parts
                  if (part.type === 'tool-presentOptions' || part.type === 'tool-generateSeries') {
                    const toolPart = part as { type: string; state: string; input?: unknown; output?: unknown; toolCallId: string }

                    // presentOptions — MCQ pill buttons
                    if (part.type === 'tool-presentOptions' && toolPart.state === 'output-available') {
                      const result = toolPart.output as {
                        question: string
                        options: McqOption[]
                      }
                      const isCustomOpen = customInputId === toolPart.toolCallId
                      return (
                        <div key={`${message.id}-tool-${partIndex}`} className="space-y-2">
                          <motion.p
                            variants={chatMessageVariants}
                            initial="initial"
                            animate="animate"
                            className="text-sm text-muted-foreground px-1"
                          >
                            {result.question}
                          </motion.p>
                          <motion.div
                            variants={staggerFastContainerVariants}
                            initial="initial"
                            animate="animate"
                            className="flex flex-wrap gap-2"
                          >
                            {result.options.map((option) => (
                              <motion.button
                                key={option.id}
                                variants={mcqOptionVariants}
                                onClick={() => handleOptionSelect(option)}
                                disabled={status !== 'ready'}
                                className={cn(
                                  "rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs",
                                  "hover:bg-destructive/10 hover:border-destructive/50 transition-colors",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  "text-left"
                                )}
                              >
                                <span className="font-medium">{option.label}</span>
                                {option.description && (
                                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                                    {option.description}
                                  </span>
                                )}
                              </motion.button>
                            ))}
                            {/* Type your own option */}
                            <motion.button
                              variants={mcqOptionVariants}
                              onClick={() => handleTypeYourOwn(toolPart.toolCallId)}
                              disabled={status !== 'ready'}
                              className={cn(
                                "rounded-full border border-dashed border-muted-foreground/40 bg-transparent px-3 py-1.5 text-xs",
                                "hover:bg-muted/50 hover:border-muted-foreground/60 transition-colors",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "text-left",
                                isCustomOpen && "hidden"
                              )}
                            >
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <IconPencil className="size-3" />
                                Type your own
                              </span>
                            </motion.button>
                          </motion.div>
                          {/* Inline custom input */}
                          <AnimatePresence>
                            {isCustomOpen && (
                              <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleCustomSubmit}
                                className="flex items-end gap-2"
                              >
                                <textarea
                                  ref={customInputRef}
                                  value={customInputValue}
                                  onChange={(e) => {
                                    setCustomInputValue(e.target.value)
                                    e.target.style.height = 'auto'
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`
                                  }}
                                  placeholder="Type your answer... (Shift+Enter for new line)"
                                  disabled={status !== 'ready'}
                                  rows={1}
                                  className={cn(
                                    "flex-1 rounded-2xl border border-destructive/30 bg-background px-3.5 py-2 text-sm resize-none",
                                    "placeholder:text-muted-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive/50",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                  )}
                                  style={{ overflow: 'hidden' }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleCustomSubmit(e as unknown as React.FormEvent)
                                    }
                                    if (e.key === 'Escape') {
                                      setCustomInputId(null)
                                      setCustomInputValue('')
                                    }
                                  }}
                                />
                                <Button
                                  type="submit"
                                  size="icon"
                                  disabled={status !== 'ready' || !customInputValue.trim()}
                                  className="shrink-0 rounded-full bg-destructive hover:bg-destructive/90 size-8"
                                >
                                  <IconSend className="size-3.5" />
                                </Button>
                              </motion.form>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    }

                    // generateSeries — series preview slider
                    if (part.type === 'tool-generateSeries' && toolPart.state === 'output-available') {
                      const result = toolPart.output as {
                        posts: SeriesPost[]
                        seriesTheme: string
                      }
                      return (
                        <SeriesPreviewSlider
                          key={`${message.id}-tool-${partIndex}`}
                          result={result}
                          onUse={() => handleUseSeries(result.posts)}
                          onRetry={() => {
                            setHasGeneratedSeries(false)
                            sendMessage({ text: 'Generate another version of the series with the same theme' })
                          }}
                          isReady={status === 'ready'}
                        />
                      )
                    }

                    // Loading state
                    if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
                      return (
                        <motion.div
                          key={`${message.id}-tool-${partIndex}`}
                          variants={chatMessageVariants}
                          initial="initial"
                          animate="animate"
                          className="flex items-center gap-2 text-sm text-muted-foreground px-1"
                        >
                          <IconLoader2 className="size-3.5 animate-spin" />
                          <span>
                            {part.type === 'tool-generateSeries' ? 'Creating your series...' : 'Thinking...'}
                          </span>
                        </motion.div>
                      )
                    }
                  }

                  return null
                })}
              </div>
            )
          }

          return null
        })}

        {/* Loading indicator */}
        {status === 'submitted' && (
          <motion.div
            variants={chatMessageVariants}
            initial="initial"
            animate="animate"
            className="flex items-center gap-2 text-sm text-muted-foreground px-1"
          >
            <IconLoader2 className="size-3.5 animate-spin" />
            <span>Thinking...</span>
          </motion.div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive mb-3">
          <span>{error.message || 'Something went wrong. Please try again.'}</span>
        </div>
      )}

      {/* Tone selector (collapsible) */}
      <div className="mb-3">
        <button
          onClick={() => setShowToneSelector(!showToneSelector)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              showToneSelector && "rotate-180"
            )}
          />
          <span>Tone: {tone.replace(/-/g, ' ')}</span>
        </button>
        <AnimatePresence>
          {showToneSelector && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-2"
            >
              <ComposeToneSelector
                value={tone}
                onValueChange={setTone}
                disabled={status !== 'ready'}
                compact
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat controls — stop & undo */}
      {(status !== 'ready' || messages.length > 1) && (
        <div className="flex items-center gap-2 mb-2">
          {status !== 'ready' && (
            <Button
              variant="outline"
              size="sm"
              onClick={stop}
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
            >
              <IconX className="size-3" />
              Stop
            </Button>
          )}
          {messages.length > 1 && status === 'ready' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <IconRefresh className="size-3" />
              Undo
            </Button>
          )}
        </div>
      )}

      {/* Chat input */}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (input.trim() && status === 'ready') {
                onSubmit(e as unknown as React.FormEvent)
              }
            }
          }}
          placeholder={
            hasGeneratedSeries
              ? "Adjust tone, length, examples..."
              : "Describe your series theme..."
          }
          disabled={status !== 'ready'}
          rows={1}
          className={cn(
            "flex-1 rounded-2xl border border-destructive/30 bg-background px-4 py-2.5 text-sm resize-none",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
          style={{ overflow: 'hidden' }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={status !== 'ready' || !input.trim()}
          className="shrink-0 rounded-full bg-destructive hover:bg-destructive/90 size-10"
        >
          {status !== 'ready' ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconSend className="size-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
