"use client"

/**
 * Edit with AI Popup
 * @description Floating popup that appears near selected text in the post editor.
 * Shows an "Edit with AI" button that expands to an instruction input + send button.
 * @module components/features/compose/edit-with-ai-popup
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconSparkles, IconSend, IconLoader2, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EditWithAIPopupProps {
  /** Whether the popup is visible */
  isVisible: boolean
  /** Position relative to parent container */
  position: { top: number; left: number }
  /** The currently selected text */
  selectedText: string
  /** Callback when user submits an edit instruction */
  onSubmit: (instruction: string) => void
  /** Whether an edit is currently being processed */
  isLoading: boolean
  /** Callback to close the popup */
  onClose: () => void
  /** Ref to attach to the popup container for outside-click detection */
  popupRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Floating popup for AI-powered text editing.
 * Initially shows a compact "Edit with AI" button, expands to input on click.
 * @param props - Component props
 * @returns Floating popup JSX element
 */
export function EditWithAIPopup({
  isVisible,
  position,
  selectedText,
  onSubmit,
  isLoading,
  onClose,
  popupRef,
}: EditWithAIPopupProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [instruction, setInstruction] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset state when popup hides
  React.useEffect(() => {
    if (!isVisible) {
      setIsExpanded(false)
      setInstruction("")
    }
  }, [isVisible])

  // Focus input when expanded
  React.useEffect(() => {
    if (isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isExpanded])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!instruction.trim() || isLoading) return
    onSubmit(instruction.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isExpanded) {
        setIsExpanded(false)
        setInstruction("")
      } else {
        onClose()
      }
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, y: -4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50"
          style={{ top: position.top, left: position.left }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {!isExpanded ? (
            /* Compact "Edit with AI" button */
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsExpanded(true)
              }}
              className="gap-1.5 rounded-full shadow-md border border-border bg-card hover:bg-accent text-xs h-7"
            >
              <IconSparkles className="size-3 text-primary" />
              Edit with AI
            </Button>
          ) : (
            /* Expanded input form */
            <motion.form
              initial={{ width: 160 }}
              animate={{ width: 320 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card shadow-lg px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <IconSparkles className="size-3.5 text-primary shrink-0 ml-1" />
              <input
                ref={inputRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="How should I edit this?"
                disabled={isLoading}
                className={cn(
                  "flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground",
                  "disabled:opacity-50"
                )}
              />
              {isLoading ? (
                <IconLoader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 shrink-0"
                    onClick={() => {
                      setIsExpanded(false)
                      setInstruction("")
                    }}
                  >
                    <IconX className="size-3" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!instruction.trim()}
                    className="size-5 shrink-0 rounded-full bg-primary hover:bg-primary/90"
                  >
                    <IconSend className="size-2.5" />
                  </Button>
                </>
              )}
            </motion.form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
