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

    // Use a hidden mirror element to measure exact selection position
    // This accounts for font size, line wrapping, padding, and scroll
    const textareaRect = textarea.getBoundingClientRect()
    const parentRect = textarea.parentElement?.getBoundingClientRect()
    if (!parentRect) return

    // Create a temporary mirror div matching the textarea's styling
    const mirror = document.createElement('div')
    const computed = getComputedStyle(textarea)
    const mirrorStyles = [
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'word-spacing', 'white-space', 'word-wrap', 'overflow-wrap',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'box-sizing', 'width',
    ] as const
    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordWrap = 'break-word'
    for (const prop of mirrorStyles) {
      mirror.style.setProperty(prop, computed.getPropertyValue(prop))
    }

    // Fill mirror with text up to selection start, then a marker span
    const textBefore = content.slice(0, start)
    const beforeNode = document.createTextNode(textBefore)
    const marker = document.createElement('span')
    marker.textContent = '|'
    mirror.appendChild(beforeNode)
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const markerRect = marker.getBoundingClientRect()
    const mirrorRect = mirror.getBoundingClientRect()

    // Calculate position relative to the parent container (which has position: relative)
    const top = markerRect.top - mirrorRect.top - textarea.scrollTop - 28 // 28px above the line
    const left = Math.min(markerRect.left - mirrorRect.left, parentRect.width - 140)

    document.body.removeChild(mirror)

    // Clamp: don't let popup go above the textarea (top < 0) or too far left
    const clampedTop = Math.max(0, top)
    const clampedLeft = Math.max(0, left)

    setState({
      showPopup: true,
      popupPosition: { top: clampedTop, left: clampedLeft },
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
