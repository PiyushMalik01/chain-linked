/**
 * Content Rules Editor Component
 * @description UI for managing AI content rules - adding, toggling, and removing rules.
 * Rules are injected into AI prompts as mandatory writing guidelines.
 * @module components/features/content-rules-editor
 */

'use client'

import { useState, useCallback } from 'react'
import {
  IconPlus,
  IconTrash,
  IconLoader2,
  IconRuler,
  IconBulb,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useContentRules } from '@/hooks/use-content-rules'
import type { ContentRule } from '@/hooks/use-content-rules'

// ============================================================================
// Constants
// ============================================================================

/**
 * Pre-defined rule suggestions shown as quick-add chips
 */
const SUGGESTED_RULES: { text: string; type: string }[] = [
  { text: 'Always use formal professional tone', type: 'tone' },
  { text: 'Never use emojis', type: 'formatting' },
  { text: 'Always include 3-5 relevant hashtags', type: 'formatting' },
  { text: 'Keep posts under 1500 characters', type: 'length' },
  { text: 'Always end with a call-to-action', type: 'structure' },
  { text: 'Avoid jargon and acronyms', type: 'tone' },
]

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ContentRulesEditor component
 */
export interface ContentRulesEditorProps {
  /**
   * Whether these are personal rules or team rules
   * - 'personal': rules where team_id IS NULL
   * - 'team': rules for a specific team
   */
  scope: 'personal' | 'team'
  /** Required when scope is 'team' */
  teamId?: string | null
  /** Additional CSS class */
  className?: string
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * A single rule row with toggle and delete
 * @param props.rule - The rule to display
 * @param props.onToggle - Callback when toggle is flipped
 * @param props.onDelete - Callback when delete is clicked
 */
function RuleRow({
  rule,
  onToggle,
  onDelete,
}: {
  rule: ContentRule
  onToggle: () => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 px-1 border-b border-border/40 last:border-b-0 transition-opacity',
        !rule.is_active && 'opacity-50'
      )}
    >
      <Switch
        checked={rule.is_active}
        onCheckedChange={onToggle}
        aria-label={`Toggle rule: ${rule.rule_text}`}
      />
      <span className={cn(
        'flex-1 text-sm',
        rule.is_active ? 'text-foreground' : 'text-muted-foreground line-through'
      )}>
        {rule.rule_text}
      </span>
      {rule.rule_type && rule.rule_type !== 'custom' && (
        <Badge variant="outline" className="text-xs capitalize shrink-0">
          {rule.rule_type}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete rule"
      >
        {deleting ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconTrash className="size-3.5" />
        )}
      </Button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Content Rules Editor
 *
 * Allows users to manage AI content rules:
 * - Quick-add from suggested rules list
 * - Custom rule input
 * - Toggle rules on/off
 * - Delete rules
 *
 * Rules are scoped to either personal use or a specific team.
 *
 * @param props - Component props
 * @returns Content rules editor JSX
 * @example
 * // Personal rules in settings
 * <ContentRulesEditor scope="personal" />
 *
 * // Team rules in team settings
 * <ContentRulesEditor scope="team" teamId={currentTeam.id} />
 */
export function ContentRulesEditor({ scope, teamId, className }: ContentRulesEditorProps) {
  const { rules, isLoading, addRule, toggleRule, deleteRule } = useContentRules({ scope, teamId })
  const [customRule, setCustomRule] = useState('')
  const [adding, setAdding] = useState(false)

  const existingTexts = new Set(rules.map(r => r.rule_text.toLowerCase()))

  const handleAddCustomRule = useCallback(async () => {
    const text = customRule.trim()
    if (!text) return

    setAdding(true)
    const result = await addRule({ rule_text: text, rule_type: 'custom', team_id: teamId })
    if (result) {
      setCustomRule('')
      toast.success('Rule added')
    }
    setAdding(false)
  }, [customRule, addRule, teamId])

  const handleAddSuggested = useCallback(async (text: string, type: string) => {
    setAdding(true)
    const result = await addRule({ rule_text: text, rule_type: type, team_id: teamId })
    if (result) {
      toast.success('Rule added')
    }
    setAdding(false)
  }, [addRule, teamId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddCustomRule()
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Active rules list */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <div className="rounded-full bg-muted/60 p-3 mx-auto w-fit mb-3">
              <IconRuler className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No content rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add rules below to guide AI-generated content
            </p>
          </div>
        ) : (
          <div>
            {rules.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={() => toggleRule(rule.id)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Custom rule input */}
      <div className="flex gap-2">
        <Input
          value={customRule}
          onChange={e => setCustomRule(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a custom rule..."
          className="flex-1"
          disabled={adding}
        />
        <Button
          onClick={handleAddCustomRule}
          disabled={!customRule.trim() || adding}
          size="sm"
        >
          {adding ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconPlus className="size-4" />
          )}
          Add
        </Button>
      </div>

      {/* Suggested rules */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <IconBulb className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Suggested Rules
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_RULES.map(suggestion => {
            const alreadyAdded = existingTexts.has(suggestion.text.toLowerCase())
            return (
              <button
                key={suggestion.text}
                type="button"
                disabled={alreadyAdded || adding}
                onClick={() => handleAddSuggested(suggestion.text, suggestion.type)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs border transition-colors',
                  alreadyAdded
                    ? 'border-primary/30 bg-primary/5 text-primary cursor-default'
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/60 cursor-pointer'
                )}
              >
                {alreadyAdded ? '✓ ' : '+ '}
                {suggestion.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
