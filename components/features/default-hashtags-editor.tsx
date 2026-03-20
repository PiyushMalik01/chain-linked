/**
 * Default Hashtags Editor Component
 * @description UI for managing default hashtags that can be quickly added to posts.
 * Hashtags are persisted in Supabase (user_default_hashtags table) with
 * localStorage as a fast read cache.
 * @module components/features/default-hashtags-editor
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { IconHash, IconPlus, IconX, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createClient> & { from: (table: string) => any }

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for caching hashtags locally */
const CACHE_KEY = 'chainlinked-user-hashtags'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Reads saved hashtags — tries localStorage cache first, falls back to empty.
 * The component itself loads from Supabase on mount and updates the cache.
 * @returns Array of hashtag strings (without #)
 */
export function getSavedHashtags(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Updates the localStorage cache
 */
function updateCache(hashtags: string[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(hashtags))
  } catch { /* noop */ }
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
 * appended to any post via the post composer. Persisted in Supabase.
 *
 * @param props - Component props
 * @returns Default hashtags editor JSX
 * @example
 * <DefaultHashtagsEditor />
 */
export function DefaultHashtagsEditor({ className }: DefaultHashtagsEditorProps) {
  const { user } = useAuthContext()
  const [hashtags, setHashtags] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  /** Load hashtags from Supabase on mount, fall back to cache */
  useEffect(() => {
    if (!user) {
      setHashtags(getSavedHashtags())
      setIsLoading(false)
      return
    }

    const load = async () => {
      const supabase = createClient() as unknown as SupabaseAny
      const { data, error } = await supabase
        .from('user_default_hashtags')
        .select('hashtags')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Failed to load hashtags:', error)
        setHashtags(getSavedHashtags())
      } else if (data?.hashtags) {
        setHashtags(data.hashtags as string[])
        updateCache(data.hashtags as string[])
      } else {
        // No row yet — check if localStorage has data to migrate
        const cached = getSavedHashtags()
        if (cached.length > 0) {
          await supabase
            .from('user_default_hashtags')
            .upsert({ user_id: user.id, hashtags: cached }, { onConflict: 'user_id' })
          setHashtags(cached)
        }
      }
      setIsLoading(false)
    }

    load()
  }, [user])

  /**
   * Persist hashtags to Supabase and update cache
   */
  const persistHashtags = useCallback(async (updated: string[]) => {
    updateCache(updated)
    if (!user) return

    setIsSaving(true)
    const supabase = createClient() as unknown as SupabaseAny
    const { error } = await supabase
      .from('user_default_hashtags')
      .upsert(
        { user_id: user.id, hashtags: updated, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Failed to save hashtags:', error)
      toast.error('Failed to save hashtag')
    }
    setIsSaving(false)
  }, [user])

  /**
   * Normalises and adds a hashtag to the list
   */
  const addHashtag = useCallback(async () => {
    const raw = inputValue.trim().replace(/^#+/, '').trim()
    if (!raw) return

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
    setInputValue('')
    toast.success(`#${cleaned} added`)
    await persistHashtags(updated)
  }, [inputValue, hashtags, persistHashtags])

  /**
   * Removes a hashtag by index
   */
  const removeHashtag = useCallback(async (index: number) => {
    const updated = hashtags.filter((_, i) => i !== index)
    setHashtags(updated)
    await persistHashtags(updated)
  }, [hashtags, persistHashtags])

  /**
   * Handles Enter key to add a hashtag
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addHashtag()
    }
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
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
          disabled={!inputValue.trim() || isSaving}
          size="sm"
        >
          {isSaving ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconPlus className="size-4" />
          )}
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
