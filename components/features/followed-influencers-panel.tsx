'use client'

/**
 * Followed Influencers Panel Component
 * @description Collapsible panel showing the list of followed LinkedIn influencers.
 * Allows unfollowing and adding new influencers via a dialog.
 * @module components/features/followed-influencers-panel
 */

import * as React from 'react'
import {
  IconUsers,
  IconUserMinus,
  IconUserPlus,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
} from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, getInitials } from '@/lib/utils'
import { FollowInfluencerDialog } from '@/components/features/follow-influencer-dialog'
import type { FollowedInfluencer } from '@/hooks/use-followed-influencers'

/**
 * Props for the FollowedInfluencersPanel component
 */
export interface FollowedInfluencersPanelProps {
  /** List of followed influencers */
  influencers: FollowedInfluencer[]
  /** Whether the data is loading */
  isLoading?: boolean
  /**
   * Callback to follow a new influencer
   * @param url - LinkedIn profile URL
   */
  onFollow: (url: string) => Promise<void>
  /**
   * Callback to unfollow an influencer
   * @param id - Record ID to unfollow
   */
  onUnfollow: (id: string) => Promise<void>
  /** Additional CSS classes */
  className?: string
}

/**
 * Single influencer row in the panel list
 */
function InfluencerRow({
  influencer,
  onUnfollow,
}: {
  influencer: FollowedInfluencer
  onUnfollow: (id: string) => Promise<void>
}) {
  const [isUnfollowing, setIsUnfollowing] = React.useState(false)

  const handleUnfollow = React.useCallback(async () => {
    setIsUnfollowing(true)
    try {
      await onUnfollow(influencer.id)
    } finally {
      setIsUnfollowing(false)
    }
  }, [influencer.id, onUnfollow])

  const displayName = influencer.author_name ?? influencer.linkedin_username ?? 'Unknown'
  const headline = influencer.author_headline

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 group"
    >
      <Avatar className="size-8 shrink-0 ring-1 ring-border">
        {influencer.author_profile_picture && (
          <AvatarImage
            src={influencer.author_profile_picture}
            alt={displayName}
          />
        )}
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-xs font-medium">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        {headline && (
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
            {headline}
          </p>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'size-7 shrink-0 text-muted-foreground transition-all duration-200',
              'opacity-0 group-hover:opacity-100',
              'hover:text-destructive hover:bg-destructive/10',
            )}
            onClick={handleUnfollow}
            disabled={isUnfollowing}
            aria-label={`Unfollow ${displayName}`}
          >
            {isUnfollowing ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconUserMinus className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Unfollow {displayName}</p>
        </TooltipContent>
      </Tooltip>
    </motion.div>
  )
}

/**
 * Collapsible panel showing followed LinkedIn influencers with follow/unfollow actions.
 * Includes a button to open the FollowInfluencerDialog for adding new influencers.
 *
 * @example
 * <FollowedInfluencersPanel
 *   influencers={influencers}
 *   isLoading={isLoading}
 *   onFollow={followInfluencer}
 *   onUnfollow={unfollowInfluencer}
 * />
 */
export function FollowedInfluencersPanel({
  influencers,
  isLoading = false,
  onFollow,
  onUnfollow,
  className,
}: FollowedInfluencersPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const toggleExpanded = React.useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  return (
    <>
      <Card className={cn(
        'border-border/50 bg-gradient-to-br from-card via-card to-primary/5',
        'transition-all duration-300',
        className,
      )}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <IconUsers className="size-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-medium">Following</CardTitle>
              {influencers.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                  {influencers.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsDialogOpen(true)}
                    aria-label="Follow new influencer"
                  >
                    <IconUserPlus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Follow new influencer</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={toggleExpanded}
                aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <IconChevronUp className="size-3.5" />
                ) : (
                  <IconChevronDown className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="panel-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <CardContent className="px-4 pb-4 pt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : influencers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      No influencers followed yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      onClick={() => setIsDialogOpen(true)}
                    >
                      <IconUserPlus className="size-3" />
                      Follow someone
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <AnimatePresence mode="popLayout">
                      {influencers.map(influencer => (
                        <InfluencerRow
                          key={influencer.id}
                          influencer={influencer}
                          onUnfollow={onUnfollow}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <FollowInfluencerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onFollow={onFollow}
      />
    </>
  )
}
