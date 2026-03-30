"use client"

/**
 * Compose Advanced Mode
 * @description Conversation-first chat interface for AI post generation.
 * Uses useChat from @ai-sdk/react for streaming, renders tool call results
 * as MCQ options and post preview cards.
 * @module components/features/compose/compose-advanced-mode
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
  IconPlus,
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
import type { McqOption } from "@/types/compose"

/**
 * Props for ComposeAdvancedMode
 */
interface ComposeAdvancedModeProps {
  /** Callback when a post is generated and user wants to use it */
  onGenerated: (content: string) => void
  /** Whether the user has an API key configured */
  hasApiKey: boolean
  /** Persisted messages from database (for conversation persistence) */
  persistedMessages?: UIMessage[]
  /** Current conversation ID */
  conversationId?: string | null
  /** Callback when messages change (for persistence) */
  onMessagesChange?: (messages: UIMessage[]) => void
  /** Callback to start a new chat */
  onNewChat?: () => void
}

/**
 * Extracts text content from a UIMessage's parts array
 * @param parts - The message parts array
 * @returns Combined text content
 */
function getTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('')
}

/**
 * Advanced compose mode with a streaming chat interface.
 * AI asks contextual MCQ questions via tool calls before generating a post.
 * @param props - Component props
 * @returns Advanced mode chat JSX element
 */
export function ComposeAdvancedMode({
  onGenerated,
  hasApiKey,
  persistedMessages: persistedMsgs,
  conversationId,
  onMessagesChange,
  onNewChat,
}: ComposeAdvancedModeProps) {
  const [tone, setTone] = React.useState('professional')
  const [showToneSelector, setShowToneSelector] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [customInputId, setCustomInputId] = React.useState<string | null>(null)
  const [customInputValue, setCustomInputValue] = React.useState('')
  const [hasGeneratedPost, setHasGeneratedPost] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const customInputRef = React.useRef<HTMLTextAreaElement>(null)

  const transport = React.useMemo(
    () => new DefaultChatTransport({
      api: '/api/ai/compose-chat',
      body: { tone },
    }),
    [tone]
  )

  const defaultGreeting = React.useMemo<UIMessage[]>(() => [
    {
      id: 'greeting',
      role: 'assistant',
      parts: [{ type: 'text', text: 'What do you want to post about today?' }],
    },
  ], [])

  // Capture initial messages once so useChat isn't reset on re-renders
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

  /** Undo last user message and AI response */
  const handleUndo = React.useCallback(() => {
    if (messages.length <= 1) return
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx > 0) {
      setMessages(messages.slice(0, lastUserIdx))
    }
  }, [messages, setMessages])

  /** Restore chat messages when persisted data loads asynchronously (e.g. route change) */
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

  /** Track previous conversationId to detect "New Chat" resets from parent */
  const prevConversationIdRef = React.useRef(conversationId)

  React.useEffect(() => {
    const wasActive = prevConversationIdRef.current !== undefined && prevConversationIdRef.current !== null
    const isNowCleared = conversationId === null || conversationId === undefined
    if (wasActive && isNowCleared) {
      setMessages(defaultGreeting)
      setHasGeneratedPost(false)
      setInput('')
      setCustomInputId(null)
      setCustomInputValue('')
      hasRestoredRef.current = false
    }
    prevConversationIdRef.current = conversationId
  }, [conversationId, defaultGreeting, setMessages])

  /** Notify parent when messages change (for persistence) */
  const onMessagesChangeRef = React.useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange

  /** Track last notified message count + last ID to prevent redundant notifications */
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

  /** Detect when a post has been generated */
  const prevHasGeneratedRef = React.useRef(false)
  React.useEffect(() => {
    const hasPost = messages.some((m) =>
      m.parts?.some((p) => {
        const part = p as { type: string; state?: string }
        return part.type === 'tool-generatePost' && part.state === 'output-available'
      })
    )
    if (hasPost !== prevHasGeneratedRef.current) {
      prevHasGeneratedRef.current = hasPost
      setHasGeneratedPost(hasPost)
    }
  }, [messages])

  /** Auto-scroll to bottom when messages change */
  React.useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  /** Handle MCQ option selection */
  const handleOptionSelect = (option: McqOption) => {
    setCustomInputId(null)
    setCustomInputValue('')
    sendMessage({ text: option.label })
  }

  /** Handle "Type your own" button click — shows inline text input */
  const handleTypeYourOwn = (toolCallId: string) => {
    setCustomInputId(toolCallId)
    setCustomInputValue('')
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  /** Handle custom input submission */
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customInputValue.trim() || status !== 'ready') return
    sendMessage({ text: customInputValue.trim() })
    setCustomInputId(null)
    setCustomInputValue('')
  }

  /** Handle "Use This Post" button click */
  const handleUsePost = (postContent: string) => {
    onGenerated(postContent)
  }

  /** Handle form submit */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status !== 'ready') return
    sendMessage({ text: input.trim() })
    setInput('')
    // Reset textarea height after submit
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '350px', maxHeight: '600px' }}>
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
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-sm">
                  {textContent}
                </div>
              </motion.div>
            )
          }

          if (message.role === 'assistant') {
            return (
              <div key={message.id} className="space-y-2">
                {/* Render message parts */}
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
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/50 border px-3.5 py-2.5 text-sm">
                          <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                            <IconMessageChatbot className="size-3" />
                            <span>AI</span>
                          </div>
                          {part.text}
                        </div>
                      </motion.div>
                    )
                  }

                  // Tool parts rendered by type name: 'tool-presentOptions' or 'tool-generatePost'
                  // Per AI SDK v6 docs, tool part.type is `tool-${toolName}`, with
                  // part.state, part.input, part.output directly on the part object.
                  // States: input-streaming → input-available → output-available | output-error
                  if (part.type === 'tool-presentOptions' || part.type === 'tool-generatePost') {
                    const toolPart = part as { type: string; state: string; input?: unknown; output?: unknown; toolCallId: string }

                    // presentOptions — MCQ pill buttons + "Type your own" option
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
                                  "rounded-full border border-destructive/30 bg-destructive/5 px-3.5 py-2 text-sm",
                                  "hover:bg-destructive/10 hover:border-destructive/50 transition-colors",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  "text-left"
                                )}
                              >
                                <span className="font-medium">{option.label}</span>
                                {option.description && (
                                  <span className="block text-xs text-muted-foreground mt-0.5">
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
                                "rounded-full border border-dashed border-muted-foreground/40 bg-transparent px-3.5 py-2 text-sm",
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

                    // generatePost — post preview card
                    if (part.type === 'tool-generatePost' && toolPart.state === 'output-available') {
                      const result = toolPart.output as {
                        post: string
                        summary: string
                      }
                      return (
                        <motion.div
                          key={`${message.id}-tool-${partIndex}`}
                          variants={chatMessageVariants}
                          initial="initial"
                          animate="animate"
                          className="rounded-lg border border-destructive/20 bg-background p-4 space-y-3"
                        >
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <IconSparkles className="size-3.5 text-destructive" />
                            <span>{result.summary}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                            {result.post}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUsePost(result.post)}
                              className="gap-1.5 bg-destructive hover:bg-destructive/90"
                            >
                              <IconCheck className="size-3.5" />
                              Use This Post
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setHasGeneratedPost(false)
                                sendMessage({ text: 'Generate another version with the same approach' })
                              }}
                              disabled={status !== 'ready'}
                              className="gap-1.5"
                            >
                              <IconRefresh className="size-3.5" />
                              Try Again
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setHasGeneratedPost(false)
                                setInput('')
                                setCustomInputId(null)
                                setCustomInputValue('')
                                setMessages(defaultGreeting)
                                if (onNewChat) onNewChat()
                              }}
                              className="gap-1.5 text-muted-foreground"
                            >
                              <IconPlus className="size-3.5" />
                              New Topic
                            </Button>
                          </div>
                        </motion.div>
                      )
                    }

                    // Loading state while tool is executing
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
                            {part.type === 'tool-generatePost' ? 'Writing your post...' : 'Thinking...'}
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

        {/* Loading indicator when waiting for stream to start */}
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
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive mb-3">
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

      {/* Chat input — always visible so user can iterate after generation */}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            // Auto-resize textarea
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
            hasGeneratedPost
              ? "Ask to adjust tone, length, add a hook..."
              : "Type your message... (Shift+Enter for new line)"
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
