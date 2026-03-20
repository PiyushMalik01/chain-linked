/**
 * Default Hashtags Editor Component
 * @description UI for managing default hashtags that can be quickly added to posts.
 * Hashtags are stored in localStorage under the key `chainlinked-user-hashtags`.
 * @module components/features/default-hashtags-editor
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { IconHash, IconPlus, IconX } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for persisting user hashtags */
const STORAGE_KEY = 'chainlinked-user-hashtags'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Reads saved hashtags from localStorage
 * @returns Array of hashtag strings (without #)
 */
export function getSavedHashtags(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Persists hashtags to localStorage
 * @param hashtags - Array of hashtag strings to save
 */
function saveHashtags(hashtags: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hashtags))
}

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the DefaultHashtagsEditor component
 */
export interface DefaultHashtagsEditorProps {
  /** Additional CSS class */
  className?: string
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Default Hashtags Editor
 *
 * Allows users to manage a list of default hashtags that can be quickly
 * appended to any post via the post composer.
 *
 * @param props - Component props
 * @returns Default hashtags editor JSX
 * @example
 * <DefaultHashtagsEditor />
 */
export function DefaultHashtagsEditor({ className }: DefaultHashtagsEditorProps) {
  const [hashtags, setHashtags] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')

  /** Load hashtags from localStorage on mount */
  useEffect(() => {
    setHashtags(getSavedHashtags())
  }, [])

  /**
   * Normalises and adds a hashtag to the list
   */
  const addHashtag = useCallback(() => {
    const raw = inputValue.trim().replace(/^#+/, '').trim()
    if (!raw) return

    // Only allow word characters (letters, numbers, underscores)
    const cleaned = raw.replace(/[^\w]/g, '')
    if (!cleaned) {
      toast.error('Invalid hashtag')
      return
    }

    if (hashtags.some(h => h.toLowerCase() === cleaned.toLowerCase())) {
      toast.error('Hashtag already exists')
      setInputValue('')
      return
    }

    const updated = [...hashtags, cleaned]
    setHashtags(updated)
    saveHashtags(updated)
    setInputValue('')
    toast.success(`#${cleaned} added`)
  }, [inputValue, hashtags])

  /**
   * Removes a hashtag by index
   */
  const removeHashtag = useCallback((index: number) => {
    const updated = hashtags.filter((_, i) => i !== index)
    setHashtags(updated)
    saveHashtags(updated)
  }, [hashtags])

  /**
   * Handles Enter key to add a hashtag
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addHashtag()
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Input row */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a hashtag and press Enter..."
          className="flex-1"
        />
        <Button
          onClick={addHashtag}
          disabled={!inputValue.trim()}
          size="sm"
        >
          <IconPlus className="size-4" />
          Add
        </Button>
      </div>

      {/* Hashtag pills */}
      {hashtags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {hashtags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium group"
            >
              <IconHash className="size-3.5" />
              {tag}
              <button
                type="button"
                onClick={() => removeHashtag(index)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                aria-label={`Remove hashtag ${tag}`}
              >
                <IconX className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="rounded-full bg-muted/60 p-3 mx-auto w-fit mb-3">
            <IconHash className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No default hashtags yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add hashtags above to quickly insert them into your posts
          </p>
        </div>
      )}
    </div>
  )
}
