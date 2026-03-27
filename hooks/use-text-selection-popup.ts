/**
 * Text Selection Popup Hook
 * @description Detects text selection in a textarea and provides position/state
 * for rendering a floating "Edit with AI" popup.
 * @module hooks/use-text-selection-popup
 */

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react'

interface SelectionPopupState {
  showPopup: boolean
  popupPosition: { top: number; left: number }
  selectedText: string
  selectionRange: { start: number; end: number }
}

interface SelectionPopupReturn extends SelectionPopupState {
  /** Ref to attach to the popup container so clicks on it don't dismiss the popup */
  popupRef: RefObject<HTMLDivElement | null>
  /** Manually dismiss the popup */
  dismiss: () => void
}

/**
 * Hook for detecting text selection in a textarea and calculating popup position
 * @param textareaRef - Ref to the textarea element
 * @param content - Current textarea content (to track changes)
 * @param enabled - Whether the textarea is currently mounted/visible (pass isEditing)
 * @returns Selection state including popup visibility, position, selected text, range, and popupRef
 */
export function useTextSelectionPopup(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  content: string,
  enabled: boolean = true
): SelectionPopupReturn {
  const [state, setState] = useState<SelectionPopupState>({
    showPopup: false,
    popupPosition: { top: 0, left: 0 },
    selectedText: '',
    selectionRange: { start: 0, end: 0 },
  })

  const popupRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef(content)
  const isInitialMount = useRef(true)

  const dismiss = useCallback(() => {
    setState(prev => prev.showPopup ? { ...prev, showPopup: false } : prev)
  }, [])

  const checkSelection = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start === end || start === undefined || end === undefined) {
      setState(prev => prev.showPopup ? { ...prev, showPopup: false } : prev)
      return
    }

    const selected = content.slice(start, end)
    if (!selected.trim()) {
      setState(prev => prev.showPopup ? { ...prev, showPopup: false } : prev)
      return
    }

    // Calculate position using line/column heuristic (same pattern as detectMention)
    const lineHeight = 24
    const charWidth = 8
    const textBeforeSelection = content.slice(0, start)
    const lines = textBeforeSelection.split('\n')
    const currentLine = lines.length - 1
    const col = lines[lines.length - 1].length

    // Position popup below the selection start, accounting for scroll offset
    const scrollTop = textarea.scrollTop || 0
    const top = (currentLine + 1) * lineHeight + 8 - scrollTop
    const left = Math.min(col * charWidth, 250)

    setState({
      showPopup: true,
      popupPosition: { top, left },
      selectedText: selected,
      selectionRange: { start, end },
    })
  }, [textareaRef, content])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Track whether a drag started inside the textarea
    let isDraggingInTextarea = false

    const handleMouseDown = (e: MouseEvent) => {
      if (textarea.contains(e.target as Node)) {
        isDraggingInTextarea = true
      }
    }

    // Listen on document so we catch mouseup even if drag ends outside textarea
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as Node

      if (isDraggingInTextarea) {
        // Drag started in textarea — check selection after it finalizes
        isDraggingInTextarea = false
        setTimeout(checkSelection, 10)
        return
      }

      // Click outside both textarea and popup — dismiss
      if (
        !textarea.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setState(prev => prev.showPopup ? { ...prev, showPopup: false } : prev)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check selection on shift+arrow keys
      if (e.shiftKey) {
        setTimeout(checkSelection, 10)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    textarea.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      textarea.removeEventListener('keyup', handleKeyUp)
    }
  }, [textareaRef, checkSelection, enabled])

  // Hide popup when content changes externally (not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      contentRef.current = content
      return
    }
    // Only dismiss if content actually changed (avoids re-render flicker)
    if (contentRef.current !== content) {
      contentRef.current = content
      setState(prev => prev.showPopup ? { ...prev, showPopup: false } : prev)
    }
  }, [content])

  return { ...state, popupRef, dismiss }
}
