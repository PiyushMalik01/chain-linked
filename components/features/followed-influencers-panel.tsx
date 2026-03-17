'use client'

/**
 * Followed Influencers Panel Component
 * @description Instagram Stories-style horizontal avatar feed showing followed
 * LinkedIn influencers. Avatars display a gradient ring when new posts are
 * available and support selection for filtering the inspiration feed.
 * @module components/features/followed-influencers-panel
 */

import * as React from 'react'
import { IconPlus } from '@tabler/icons-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
  /**
   * Callback when an influencer avatar is selected or deselected
   * @param id - The influencer ID, or null to deselect
   */
  onSelectInfluencer?: (id: string | null) => void
  /**
   * Callback to fetch the latest posts for an influencer
   * @param id - The influencer ID
   */
  onFetchLatest?: (id: string) => void
  /**
   * Callback to mark an influencer's new posts as seen
   * @param id - The influencer ID
   */
  onMarkAsSeen?: (id: string) => void
  /** Currently selected influencer ID */
  selectedInfluencerId?: string | null
  /** Additional CSS classes */
  className?: string
}

/**
 * Circular button to open the follow influencer dialog.
 * Displayed as the first item in the horizontal scroll.
 * @param props - Component props
 * @param props.onClick - Click handler to open the dialog
 * @returns A 56px dashed circle button with a "+" icon
 * @example
 * <AddInfluencerButton onClick={() => setIsDialogOpen(true)} />
 */
function AddInfluencerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]"
      aria-label="Follow new influencer"
    >
      <div className="size-14 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors">
        <IconPlus className="size-5 text-muted-foreground" />
      </div>
      <span className="text-[11px] leading-tight text-muted-foreground">
        Follow
      </span>
    </button>
  )
}

/**
 * Single influencer avatar in the horizontal Stories-style feed.
 * Shows a gradient ring (Instagram-style) when the influencer has new posts,
 * a primary ring when selected, or a muted border otherwise.
 * @param props - Component props
 * @param props.influencer - The followed influencer data
 * @param props.isSelected - Whether this influencer is currently selected
 * @param props.onSelect - Callback when the avatar is clicked
 * @param props.onMarkAsSeen - Optional callback to mark new posts as seen
 * @returns A clickable avatar button with name label
 * @example
 * <InfluencerAvatar
 *   influencer={influencer}
 *   isSelected={false}
 *   onSelect={(id) => console.log('Selected', id)}
 * />
 */
function InfluencerAvatar({
  influencer,
  isSelected,
  onSelect,
  onMarkAsSeen,
}: {
  influencer: FollowedInfluencer
  isSelected: boolean
  onSelect: (id: string) => void
  onMarkAsSeen?: (id: string) => void
}) {
  const displayName =
    influencer.author_name ?? influencer.linkedin_username ?? 'Unknown'
  const hasNewPosts = influencer.new_post_count > 0

  /**
   * Handles avatar click: selects the influencer and marks posts as seen
   * if there are new posts available.
   */
  const handleClick = () => {
    onSelect(influencer.id)
    if (hasNewPosts) {
      onMarkAsSeen?.(influencer.id)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center gap-1.5 shrink-0 w-[72px] transition-transform',
        isSelected && 'scale-105',
      )}
      aria-label={`View posts from ${displayName}`}
      aria-pressed={isSelected}
    >
      <div
        className={cn(
          'rounded-full p-[2px]',
          hasNewPosts
            ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
            : isSelected
              ? 'bg-primary'
              : 'bg-border',
        )}
      >
        <div className="rounded-full p-[2px] bg-background">
          <Avatar className="size-14">
            {influencer.author_profile_picture && (
              <AvatarImage
                src={influencer.author_profile_picture}
                alt={displayName}
              />
            )}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-medium">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      <span
        className={cn(
          'text-[11px] leading-tight truncate w-full text-center',
          isSelected
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground',
        )}
      >
        {displayName.split(' ')[0]}
      </span>
    </button>
  )
}

/**
 * Instagram Stories-style horizontal avatar feed for followed LinkedIn influencers.
 * Displays a scrollable row of circular avatars with gradient rings for new posts,
 * a leading "+" button to follow new influencers, and selection support for filtering.
 *
 * @param props - Component props
 * @returns A horizontal scrolling panel of influencer avatars with follow dialog
 * @example
 * <FollowedInfluencersPanel
 *   influencers={influencers}
 *   isLoading={isLoading}
 *   onFollow={followInfluencer}
 *   onUnfollow={unfollowInfluencer}
 *   onSelectInfluencer={setSelectedId}
 *   onMarkAsSeen={markAsSeen}
 *   selectedInfluencerId={selectedId}
 * />
 */
export function FollowedInfluencersPanel({
  influencers,
  isLoading = false,
  onFollow,
  onUnfollow,
  onSelectInfluencer,
  onFetchLatest,
  onMarkAsSeen,
  selectedInfluencerId,
  className,
}: FollowedInfluencersPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  /** Total count of new posts across all followed influencers */
  const totalNewPosts = React.useMemo(
    () =>
      influencers.reduce((sum, inf) => sum + (inf.new_post_count || 0), 0),
    [influencers],
  )

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Header with "Following" label and new-post count badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Following
            </h3>
            {totalNewPosts > 0 && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-pink-500 to-purple-600"
              >
                {totalNewPosts} new
              </Badge>
            )}
          </div>
        </div>

        {/* Horizontal scroll container with hidden scrollbar */}
        <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <AddInfluencerButton onClick={() => setIsDialogOpen(true)} />

          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] animate-pulse"
                >
                  <div className="size-14 rounded-full bg-muted" />
                  <div className="h-3 w-10 rounded bg-muted" />
                </div>
              ))
            : influencers.map((inf) => (
                <InfluencerAvatar
                  key={inf.id}
                  influencer={inf}
                  isSelected={selectedInfluencerId === inf.id}
                  onSelect={(id) => {
                    // Toggle selection: click again to deselect
                    onSelectInfluencer?.(
                      selectedInfluencerId === id ? null : id,
                    )
                  }}
                  onMarkAsSeen={onMarkAsSeen}
                />
              ))}
        </div>
      </div>

      <FollowInfluencerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onFollow={onFollow}
      />
    </>
  )
}
