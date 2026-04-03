/**
 * Mention Popover Component
 * @description Floating autocomplete dropdown for @mentioning people and companies
 * in the post composer. Appears when user types "@" and filters as they continue
 * typing. Supports keyboard navigation (up/down/enter/escape).
 * Company results are visually distinguished with a building icon and rounded-square avatar.
 * @module components/features/mention-popover
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { IconLoader2, IconAt, IconBuilding, IconUser } from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { searchLinkedInViaExtension } from '@/lib/extension/linkedin-search'

/**
 * Mentionable person or company from the search API
 */
export interface MentionSuggestion {
  /** Display name */
  name: string
  /** LinkedIn URN (urn:li:person:xxx or urn:li:organization:xxx) */
  urn: string
  /** Professional headline (person) or tagline/industry (company) */
  headline: string | null
  /** Profile picture or company logo URL */
  avatarUrl: string | null
  /** Entity type — person or company/page */
  type?: 'person' | 'company'
}

/**
 * Props for the MentionPopover component
 */
interface MentionPopoverProps {
  /** Whether the popover is visible */
  isOpen: boolean
  /** Search query (text after @) */
  query: string
  /** Position relative to the textarea */
  position: { top: number; left: number }
  /** Callback when a suggestion is selected */
  onSelect: (suggestion: MentionSuggestion) => void
  /** Callback when the popover should close */
  onClose: () => void
}

/**
 * Mention Popover
 *
 * Floating dropdown showing matching people and companies for @mention autocomplete.
 * Searches via extension first (all LinkedIn users and pages), falls back to local connections API.
 *
 * @param props - Component props
 * @returns Mention popover JSX
 */
export function MentionPopover({
  isOpen,
  query,
  position,
  onSelect,
  onClose,
}: MentionPopoverProps) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const popoverRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /**
   * Fetch suggestions from the API with debouncing
   */
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([])
      setActiveIndex(0)
      return
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Only fetch when there's a query (need at least 1 char for LinkedIn search)
    if (!query) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        // Try extension-based search first (searches ALL LinkedIn users,
        // cookies stay in the extension and never reach our server)
        const extensionResults = await searchLinkedInViaExtension(query)
        if (extensionResults && extensionResults.length > 0) {
          setSuggestions(extensionResults)
          setActiveIndex(0)
          return
        }

        // Fall back to server API (searches local connections only)
        const res = await fetch(`/api/mentions/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.results || [])
          setActiveIndex(0)
        }
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [isOpen, query])

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
        case 'Tab':
          if (suggestions.length > 0) {
            e.preventDefault()
            onSelect(suggestions[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [isOpen, suggestions, activeIndex, onSelect, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Scroll active item into view
  useEffect(() => {
    if (!popoverRef.current) return
    const active = popoverRef.current.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-72 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <IconAt className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {query ? `Searching "${query}"` : 'Type a name to mention'}
        </span>
      </div>

      {/* Content */}
      <div className="max-h-52 overflow-y-auto">
        {!query ? (
          <div className="py-5 text-center text-sm text-muted-foreground">
            Start typing to search people &amp; companies
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            <span className="text-sm">Searching LinkedIn...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-5 text-center text-sm text-muted-foreground">
            No people or companies found for &quot;{query}&quot;
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={suggestion.urn}
              data-active={index === activeIndex}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                index === activeIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => onSelect(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <Avatar className={cn(
                "size-8 shrink-0",
                suggestion.type === 'company' && "rounded-md"
              )}>
                {suggestion.avatarUrl && (
                  <AvatarImage src={suggestion.avatarUrl} alt={suggestion.name} />
                )}
                <AvatarFallback className={cn(
                  "text-xs font-semibold",
                  suggestion.type === 'company'
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md"
                    : "bg-primary/10 text-primary"
                )}>
                  {suggestion.type === 'company' ? (
                    <IconBuilding className="size-4" />
                  ) : (
                    suggestion.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium leading-tight truncate">
                    {suggestion.name}
                  </p>
                  {suggestion.type === 'company' ? (
                    <IconBuilding className="size-3 shrink-0 text-blue-500" />
                  ) : (
                    <IconUser className="size-3 shrink-0 text-muted-foreground/50" />
                  )}
                </div>
                {suggestion.headline ? (
                  <p className="text-xs text-muted-foreground leading-tight truncate mt-0.5">
                    {suggestion.headline}
                  </p>
                ) : suggestion.type === 'company' ? (
                  <p className="text-xs text-blue-500/70 leading-tight mt-0.5">
                    Company
                  </p>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
