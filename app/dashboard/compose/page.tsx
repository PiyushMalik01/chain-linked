"use client"

/**
 * Compose Page
 * @description Post composer interface for creating and editing LinkedIn content.
 * Supports auto-saving drafts to Supabase when navigating away or after AI generation.
 * @module app/dashboard/compose/page
 */

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconChevronDown, IconChevronUp, IconCheck, IconLoader2 } from "@tabler/icons-react"
import { PageContent } from "@/components/shared/page-content"
import { ErrorBoundary } from "@/components/error-boundary"
import { PostComposer } from "@/components/features/post-composer"
import { PostSeriesComposer } from "@/components/features/compose/post-series-composer"
import { RemixPostButton } from "@/components/features/remix-post-button"
import { type MediaFile } from "@/components/features/media-upload"
import { type GenerationContext } from "@/components/features/ai-inline-panel"
import { ComposeSkeleton } from "@/components/skeletons/page-skeletons"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { useDraft } from "@/lib/store/draft-context"
import { createClient } from "@/lib/supabase/client"
import { usePageMeta } from "@/lib/dashboard-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { ComposeTab } from "@/types/compose"

/** localStorage key for suppressing tab switch warning */
const TAB_SWITCH_WARN_KEY = 'chainlinked_suppress_tab_switch_warning'

/**
 * Data structure for editing a scheduled post
 */
interface EditingPost {
  id: string
  content: string
  scheduledFor: string
}

/**
 * Compose page content component
 * @returns Compose content with auto-save draft functionality
 */
function ComposeContent() {
  const { user, profile } = useAuthContext()
  const supabaseRef = React.useRef(createClient())
  const supabase = supabaseRef.current
  const searchParams = useSearchParams()
  const router = useRouter()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const { draft, updateDraft } = useDraft()

  // Tab state for single/series mode — check URL param for series tab
  const [composeTab, setComposeTab] = React.useState<ComposeTab>(
    () => (searchParams.get('tab') === 'series' ? 'series' : 'single')
  )

  // State for editing an existing scheduled post
  const [editingPost, setEditingPost] = React.useState<EditingPost | null>(null)

  // State for "Remix from my posts" collapsible section
  const [remixSectionOpen, setRemixSectionOpen] = React.useState(false)
  const [recentPosts, setRecentPosts] = React.useState<{ id: string; content: string }[]>([])
  const [recentPostsLoading, setRecentPostsLoading] = React.useState(false)

  /**
   * Fetch the user's 10 most recent posts for the remix section when opened
   */
  React.useEffect(() => {
    if (!remixSectionOpen || recentPosts.length > 0 || !user) return

    const fetchRecentPosts = async () => {
      setRecentPostsLoading(true)
      try {
        const { data } = await supabase
          .from("my_posts")
          .select("id, content")
          .eq("user_id", user.id)
          .not("content", "is", null)
          .order("posted_at", { ascending: false })
          .limit(10)

        setRecentPosts(
          (data || [])
            .filter((p) => (p.content?.length ?? 0) > 20)
            .map((p) => ({ id: p.id, content: p.content! }))
        )
      } catch (err) {
        console.error("Failed to fetch recent posts for remix:", err)
      } finally {
        setRecentPostsLoading(false)
      }
    }

    fetchRecentPosts()
  }, [remixSectionOpen, recentPosts.length, user, supabase])

  // Parse schedule date from query params (from dashboard calendar click)
  const initialScheduleDate = React.useMemo(() => {
    const dateParam = searchParams.get('scheduleDate')
    if (!dateParam) return undefined
    const date = new Date(dateParam)
    return isNaN(date.getTime()) ? undefined : date
  }, [searchParams])

  // Track the latest generation context (topic, tone, context, etc.)
  const generationContextRef = React.useRef<GenerationContext | null>(null)

  // Track whether draft has already been saved to avoid double-saves
  const draftSavedRef = React.useRef(false)

  // Track whether the current content is saved as a draft
  const [draftStatus, setDraftStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle')

  // Track the Supabase row ID of the current draft for in-place updates
  const savedDraftIdRef = React.useRef<string | undefined>(draft.savedDraftId)

  // Track user in a ref so cleanup effects always have the current value
  const userRef = React.useRef(user)
  userRef.current = user

  // Track the current content for auto-save (via ref to avoid stale closures)
  const contentRef = React.useRef(draft.content || "")

  /**
   * Update contentRef whenever draft content changes
   */
  React.useEffect(() => {
    contentRef.current = draft.content || ""
  }, [draft.content])

  // Check for edit mode on mount
  React.useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      // Try to get the post data from sessionStorage
      const storedData = sessionStorage.getItem('editScheduledPost')
      if (storedData) {
        try {
          const postData = JSON.parse(storedData) as EditingPost
          if (postData.id === editId) {
            setEditingPost(postData)
            // Clear sessionStorage after reading
            sessionStorage.removeItem('editScheduledPost')
          }
        } catch (e) {
          console.error('Failed to parse edit post data:', e)
        }
      }
    }
  }, [searchParams])

  /**
   * Handle generation context from the AI inline panel.
   * Stores the context so it can be included with auto-saved drafts.
   * @param ctx - The generation context data
   */
  const handleGenerationContext = React.useCallback((ctx: GenerationContext) => {
    generationContextRef.current = ctx
  }, [])

  // Populate generation context from remix metadata (carries AI tracking fields)
  React.useEffect(() => {
    if (draft.remixMeta?.aiMetadata && !generationContextRef.current?.aiMetadata) {
      generationContextRef.current = {
        topic: draft.remixMeta.originalContent?.slice(0, 100) || '',
        tone: draft.remixMeta.tone,
        length: draft.remixMeta.length,
        context: draft.remixMeta.customInstructions || '',
        aiMetadata: draft.remixMeta.aiMetadata,
      }
    }
  }, [draft.remixMeta])

  /**
   * Auto-save draft on browser close/refresh (beforeunload)
   */
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const currentContent = contentRef.current.trim()
      if (!currentContent || draftSavedRef.current || !user) return

      // Use sendBeacon for reliable save on page unload
      const ctx = generationContextRef.current
      const wordCount = currentContent.split(/\s+/).filter(Boolean).length

      const payload = JSON.stringify({
        content: currentContent,
        postType: ctx?.postType || 'general',
        topic: ctx?.topic || null,
        tone: ctx?.tone || null,
        context: ctx?.context || null,
        wordCount,
        draftId: savedDraftIdRef.current || undefined,
        aiMetadata: ctx?.aiMetadata || null,
      })

      navigator.sendBeacon('/api/drafts/auto-save', payload)
      draftSavedRef.current = true
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user])

  /**
   * Auto-save draft on Next.js route change (component unmount).
   * This fires when the user navigates to a different dashboard page.
   * Uses userRef.current to avoid stale closure over user.
   */
  React.useEffect(() => {
    return () => {
      const currentContent = contentRef.current.trim()
      if (currentContent && !draftSavedRef.current && userRef.current) {
        // Fire-and-forget save on unmount
        const ctx = generationContextRef.current
        const wordCount = currentContent.split(/\s+/).filter(Boolean).length

        // Use sendBeacon as a reliable fallback for component unmount
        const payload = JSON.stringify({
          content: currentContent,
          postType: ctx?.postType || 'general',
          topic: ctx?.topic || null,
          tone: ctx?.tone || null,
          context: ctx?.context || null,
          wordCount,
          draftId: savedDraftIdRef.current || undefined,
          aiMetadata: ctx?.aiMetadata || null,
        })

        navigator.sendBeacon('/api/drafts/auto-save', payload)
        draftSavedRef.current = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Reset draftSavedRef when content changes (new content = new potential draft)
   */
  React.useEffect(() => {
    if (draft.content) {
      draftSavedRef.current = false
      setDraftStatus('idle')
    } else {
      // Draft was cleared — reset the saved draft ID for a fresh session
      savedDraftIdRef.current = undefined
    }
  }, [draft.content])

  // Keep savedDraftIdRef in sync with context (e.g. when loaded from drafts page)
  React.useEffect(() => {
    if (draft.savedDraftId) {
      savedDraftIdRef.current = draft.savedDraftId
    }
  }, [draft.savedDraftId])

  /**
   * Check on mount if current content is already saved as a draft
   */
  React.useEffect(() => {
    const checkExistingDraft = async () => {
      const currentContent = contentRef.current.trim()
      if (!currentContent || !user) return

      // If we already have a savedDraftId from context, just verify it exists
      if (savedDraftIdRef.current) {
        setDraftStatus('saved')
        draftSavedRef.current = true
        return
      }

      try {
        const { data } = await supabase
          .from('generated_posts')
          .select('id')
          .eq('user_id', user.id)
          .eq('content', currentContent)
          .eq('status', 'draft')
          .limit(1)

        if (data && data.length > 0) {
          savedDraftIdRef.current = data[0].id
          updateDraft({ savedDraftId: data[0].id })
          setDraftStatus('saved')
          draftSavedRef.current = true
        }
      } catch {
        // Silently fail
      }
    }

    checkExistingDraft()
  }, [user, supabase, updateDraft])

  /**
   * Periodic auto-save every 30 seconds as a safety net.
   * Uses fetch (more reliable than sendBeacon) since the page is still active.
   */
  React.useEffect(() => {
    /** Track the last content we successfully saved to avoid redundant saves */
    let lastSavedContent = ""

    const interval = setInterval(async () => {
      const currentContent = contentRef.current.trim()
      if (
        !currentContent ||
        draftSavedRef.current ||
        !user ||
        currentContent === lastSavedContent
      ) return

      const ctx = generationContextRef.current
      setDraftStatus('saving')
      try {
        const res = await fetch("/api/drafts/auto-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: currentContent,
            postType: ctx?.postType || "general",
            topic: ctx?.topic || null,
            tone: ctx?.tone || null,
            context: ctx?.context || null,
            wordCount: currentContent.split(/\s+/).filter(Boolean).length,
            draftId: savedDraftIdRef.current || undefined,
            aiMetadata: ctx?.aiMetadata || null,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.id) {
            savedDraftIdRef.current = data.id
            updateDraft({ savedDraftId: data.id })
          }
          lastSavedContent = currentContent
          setDraftStatus('saved')
        } else {
          setDraftStatus('idle')
        }
      } catch {
        setDraftStatus('idle')
        // Silently fail — will retry on next interval
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [user])

  /**
   * Extract user profile data for the post composer preview
   * Prioritizes LinkedIn profile data, falls back to profiles table, then user metadata
   */
  const userProfile = React.useMemo(() => {
    // Get LinkedIn profile data (from linkedin_profiles table)
    const linkedinProfile = profile?.linkedin_profile
    const rawData = linkedinProfile?.raw_data as Record<string, unknown> | null

    // Get name: LinkedIn raw_data > linkedin_profiles > profiles.full_name > user metadata > email
    const linkedInName = rawData?.name as string | undefined
    const linkedInProfileName = linkedinProfile?.first_name && linkedinProfile?.last_name
      ? `${linkedinProfile.first_name} ${linkedinProfile.last_name}`
      : linkedinProfile?.first_name || undefined
    const profilesFullName = profile?.full_name // From profiles table
    const metadataName = user?.user_metadata?.name || user?.user_metadata?.full_name
    const emailName = user?.email?.split('@')[0]
    const name = linkedInName || linkedInProfileName || profilesFullName || metadataName || emailName || 'Your Name'

    // Get headline from LinkedIn profile or profiles table
    const headline = linkedinProfile?.headline ||
      (rawData?.headline as string | undefined) ||
      profile?.linkedin_headline || // From profiles table
      'Your Professional Headline'

    // Get avatar: LinkedIn > profiles.linkedin_avatar_url > profiles.avatar_url > user metadata
    const linkedInAvatar = (rawData?.profilePhotoUrl as string | undefined) ||
      linkedinProfile?.profile_picture_url ||
      profile?.linkedin_avatar_url // From profiles table (saved during OAuth)
    const profilesAvatar = profile?.avatar_url // From profiles table
    const metadataAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
    const avatarUrl = linkedInAvatar || profilesAvatar || metadataAvatar || undefined

    return {
      name: name as string,
      headline: headline as string,
      avatarUrl: avatarUrl as string | undefined,
    }
  }, [user, profile])

  /**
   * Convert a File to a base64 data URL string
   * @param file - File object to convert
   * @returns Base64-encoded string (without data URL prefix)
   */
  const fileToBase64 = React.useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  /**
   * Handle posting to LinkedIn
   * Calls the /api/linkedin/post endpoint
   * Returns the API response data (may include draft: true when posting is disabled)
   */
  const handlePost = React.useCallback(async (content: string, mediaFiles?: MediaFile[]) => {
    // Mark as saved to prevent auto-save on unmount after posting
    draftSavedRef.current = true
    // Clear contentRef to prevent unmount effect from saving stale content
    contentRef.current = ""

    // Build request body
    const body: Record<string, unknown> = {
      content,
      visibility: 'PUBLIC',
    }

    // If media files are provided, convert to base64 and include
    if (mediaFiles && mediaFiles.length > 0) {
      const imageFiles = mediaFiles.filter((f) => f.type === 'image')
      const docFiles = mediaFiles.filter((f) => f.type === 'document')

      if (imageFiles.length > 0) {
        const mediaBase64 = await Promise.all(
          imageFiles.map(async (mf) => ({
            data: await fileToBase64(mf.file),
            contentType: mf.file.type || 'image/jpeg',
          }))
        )
        body.mediaBase64 = mediaBase64
      }

      // Send the first document file (LinkedIn supports one document per post)
      if (docFiles.length > 0) {
        const docFile = docFiles[0]
        body.documentBase64 = {
          data: await fileToBase64(docFile.file),
          contentType: docFile.file.type || 'application/pdf',
          title: docFile.file.name.replace(/\.[^.]+$/, '') || 'Document',
        }
      }
    }

    const response = await fetch('/api/linkedin/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      draftSavedRef.current = false
      throw new Error(data.error || data.message || 'Failed to post to LinkedIn')
    }

    // Return data so PostComposer can detect draft responses
    return data
  }, [fileToBase64])

  /**
   * Handle scheduling a post
   * Saves to scheduled_posts table (insert for new, update for edit)
   */
  const handleSchedule = React.useCallback(async (content: string, scheduledFor: Date, timezone: string) => {
    if (!user) {
      throw new Error('Please log in to schedule posts')
    }

    // The scheduledFor Date was constructed in browser local time using the
    // hour/minute the user picked. We need to reinterpret those values as
    // being in the *selected* timezone so the stored UTC value is correct.
    const browserOffset = scheduledFor.getTimezoneOffset() // minutes (inverted sign)
    const targetDate = new Date(scheduledFor.toLocaleString('en-US', { timeZone: timezone }))
    const targetOffset = targetDate.getTimezoneOffset()
    const offsetDiff = (browserOffset - targetOffset) * 60 * 1000
    const correctedDate = new Date(scheduledFor.getTime() + offsetDiff)

    // Mark as saved to prevent auto-save on unmount after scheduling
    draftSavedRef.current = true

    // If editing an existing post, update it
    if (editingPost) {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({
          content,
          scheduled_for: correctedDate.toISOString(),
          status: 'pending',
        })
        .eq('id', editingPost.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to update scheduled post:', error)
        draftSavedRef.current = false
        throw new Error(error.message || 'Failed to update scheduled post')
      }

      // Clear editing state after successful update
      setEditingPost(null)
      toast.success('Post updated', {
        description: 'Your scheduled post has been updated.',
      })
      return
    }

    // Insert new post
    const { error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: user.id,
        content,
        scheduled_for: correctedDate.toISOString(),
        status: 'pending',
        visibility: 'PUBLIC',
      })

    if (error) {
      console.error('Failed to schedule post:', error)
      draftSavedRef.current = false
      throw new Error(error.message || 'Failed to schedule post')
    }

    // Update existing draft to "scheduled" source if it was saved as a draft
    if (savedDraftIdRef.current) {
      await supabase
        .from('generated_posts')
        .update({ source: 'scheduled' })
        .eq('id', savedDraftIdRef.current)
        .eq('user_id', user.id)
    }
  }, [user, supabase, editingPost])

  /**
   * Handle saving edits to a scheduled post without re-picking the time
   */
  const handleSaveEdit = React.useCallback(async (content: string) => {
    if (!user || !editingPost) return

    draftSavedRef.current = true

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ content })
      .eq('id', editingPost.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to save edit:', error)
      draftSavedRef.current = false
      throw new Error(error.message || 'Failed to save changes')
    }

    setEditingPost(null)
    toast.success('Post saved', {
      description: 'Your scheduled post has been updated.',
    })
    router.push('/dashboard/schedule')
  }, [user, supabase, editingPost, router])

  return (
    <PageContent>
      {/* Compose Tabs: Single Post vs Post Series */}
      <Tabs value={composeTab} onValueChange={async (v) => {
        if (v !== composeTab && draft.content?.trim()) {
          try {
            if (localStorage.getItem(TAB_SWITCH_WARN_KEY) === 'true') {
              setComposeTab(v as ComposeTab)
              return
            }
          } catch { /* ignore */ }
          const confirmed = await confirm({
            title: "Switch tab?",
            description: "Your current content will be preserved, but unsaved AI chat progress may be lost.",
            confirmText: "Switch",
            cancelText: "Stay",
            variant: "warning",
            dontAskAgainKey: TAB_SWITCH_WARN_KEY,
          })
          if (!confirmed) return
        }
        setComposeTab(v as ComposeTab)
      }}>
        <TabsList className="mb-4">
          <TabsTrigger value="single">Single Post</TabsTrigger>
          <TabsTrigger value="series">Post Series</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4 mt-0" forceMount style={{ display: composeTab === 'single' ? undefined : 'none' }}>
          {/* Show edit mode indicator */}
          {editingPost && (
            <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Editing scheduled post</p>
                <p className="text-xs text-muted-foreground">
                  Make your changes and reschedule when ready
                </p>
              </div>
              <button
                onClick={() => setEditingPost(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel edit
              </button>
            </div>
          )}
          {/* Draft save status indicator */}
          {draftStatus !== 'idle' && draft.content?.trim() && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {draftStatus === 'saving' ? (
                <>
                  <IconLoader2 className="size-3 animate-spin" />
                  <span>Saving draft…</span>
                </>
              ) : (
                <>
                  <IconCheck className="size-3 text-green-500" />
                  <span>Saved</span>
                </>
              )}
            </div>
          )}

          <ErrorBoundary>
            <PostComposer
              key={editingPost?.id || searchParams.get('draftId') || `new-${draft._loadId || 0}`}
              initialContent={editingPost?.content}
              userProfile={userProfile}
              onPost={handlePost}
              onScheduleConfirm={handleSchedule}
              onGenerationContext={handleGenerationContext}
              initialScheduleDate={initialScheduleDate}
              isEditingScheduledPost={!!editingPost}
              onSaveEdit={editingPost ? handleSaveEdit : undefined}
            />
          </ErrorBoundary>

          {/* Remix from my posts */}
          <Card className="border-border/50">
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setRemixSectionOpen((prev) => !prev)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/40 rounded-t-xl transition-colors"
              >
                <span>Remix from my posts</span>
                {remixSectionOpen ? (
                  <IconChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <IconChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>

            {remixSectionOpen && (
              <CardContent className="px-4 pb-4 pt-0">
                {recentPostsLoading ? (
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : recentPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground pt-2">
                    No posts found. Publish some LinkedIn posts to remix them here.
                  </p>
                ) : (
                  <div className="space-y-2 pt-2">
                    {recentPosts.map((post) => {
                      const firstLine = post.content.split("\n").find((l) => l.trim().length > 0)?.trim() || ""
                      const title = firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine
                      const preview = post.content.slice(0, 100).replace(/\n/g, " ")

                      return (
                        <div
                          key={post.id}
                          className={cn(
                            "flex items-start justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5",
                            "hover:border-border/70 hover:bg-muted/30 transition-colors"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{title}</p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{preview}</p>
                          </div>
                          <RemixPostButton
                            postId={post.id}
                            content={post.content}
                            className="shrink-0 h-7 px-2 text-[11px]"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="series" className="mt-0" forceMount style={{ display: composeTab === 'series' ? undefined : 'none' }}>
          <ErrorBoundary>
            <PostSeriesComposer
              userProfile={userProfile}
            />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
      <ConfirmDialogComponent />
    </PageContent>
  )
}

/**
 * Compose page component
 * @returns Compose page with post composer for creating LinkedIn content
 */
export default function ComposePage() {
  usePageMeta({ title: "Compose" })
  const { isLoading: authLoading } = useAuthContext()

  return authLoading ? <ComposeSkeleton /> : <ComposeContent />
}
