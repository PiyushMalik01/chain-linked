/**
 * Team Search Component
 * @description Debounced search for discoverable teams with result list.
 * Used in the member onboarding join flow.
 * @module components/features/team-search
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  IconSearch,
  IconLoader2,
  IconUsers,
  IconBuilding,
  IconUserPlus,
} from '@tabler/icons-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

/**
 * A team result from the search API
 */
export interface TeamSearchResult {
  id: string
  name: string
  logo_url: string | null
  member_count: number
  company_name: string | null
}

/**
 * Props for the TeamSearch component
 */
export interface TeamSearchProps {
  /** Callback when user clicks "Request to Join" on a result */
  onSelectTeam: (team: TeamSearchResult) => void
  /** Additional CSS class */
  className?: string
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Team Search
 *
 * Provides a debounced search input that queries `/api/teams/search`.
 * Shows a results list with team name, company, member count, and a join button.
 *
 * @param props - Component props
 * @returns Team search UI JSX
 * @example
 * <TeamSearch onSelectTeam={(team) => handleSelectTeam(team)} />
 */
export function TeamSearch({ onSelectTeam, className }: TeamSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TeamSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Search teams with debounce
   */
  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    try {
      setIsSearching(true)
      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json() as { teams: TeamSearchResult[] }
      setResults(data.teams || [])
      setHasSearched(true)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, performSearch])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search input */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for your organization..."
          className="pl-9"
        />
        {isSearching && (
          <IconLoader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No organizations found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map(team => (
              <div
                key={team.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
              >
                <Avatar className="size-10 shrink-0">
                  {team.logo_url && <AvatarImage src={team.logo_url} alt={team.name} />}
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{team.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {team.company_name && (
                      <span className="flex items-center gap-1 truncate">
                        <IconBuilding className="size-3 shrink-0" />
                        {team.company_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 shrink-0">
                      <IconUsers className="size-3" />
                      {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg shrink-0"
                  onClick={() => onSelectTeam(team)}
                >
                  <IconUserPlus className="size-3.5 mr-1.5" />
                  Request to Join
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
