/**
 * Inspiration Hook
 * @description Fetches and manages inspiration posts from linkedin_research_posts table
 * with filtering, pagination, personalization, and save functionality.
 * Uses real viral posts from LinkedIn influencers.
 * @module hooks/use-inspiration
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/lib/auth/auth-provider'
import type { InspirationPost, InspirationCategory } from '@/components/features/inspiration-feed'
import type { PostSuggestion } from '@/components/features/swipe-interface'

/** Number of posts per page for pagination */
const PAGE_SIZE = 24

/**
 * Raw research post from linkedin_research_posts table
 */
interface LinkedInResearchPost {
  id: string
  activity_urn: string | null
  text: string | null
  url: string | null
  post_type: string | null
  posted_date: string | null
  author_first_name: string | null
  author_last_name: string | null
  author_headline: string | null
  author_username: string | null
  author_profile_url: string | null
  author_profile_picture: string | null
  total_reactions: number | null
  likes: number | null
  comments: number | null
  reposts: number | null
  created_at: string | null
}


/** All available niches for content personalization */
export const AVAILABLE_NICHES = [
  'technology',
  'marketing',
  'sales',
  'leadership',
  'entrepreneurship',
  'finance',
  'healthcare',
  'education',
  'real-estate',
  'consulting',
  'hr',
  'product-management',
  'engineering',
  'design',
  'general',
] as const

/** Niche type derived from available niches */
export type InspirationNiche = (typeof AVAILABLE_NICHES)[number]

/**
 * Filter options for inspiration posts
 */
export interface InspirationFilters {
  /** Category filter - 'all' or specific category */
  category: InspirationCategory | 'all'
  /** Niche filter - 'all' or specific niche */
  niche: InspirationNiche | 'all'
  /** Search query for content/author */
  searchQuery: string
  /** Show only saved posts */
  savedOnly: boolean
  /** Show only posts from followed influencers */
  followingOnly: boolean
}

/**
 * Pagination state
 */
export interface PaginationState {
  /** Current page (0-indexed) */
  page: number
  /** Total number of posts */
  totalCount: number
  /** Whether there are more posts to load */
  hasMore: boolean
  /** Whether currently loading more */
  isLoadingMore: boolean
}

/**
 * Hook return type for inspiration data
 */
interface UseInspirationReturn {
  /** Formatted inspiration posts for the feed */
  posts: InspirationPost[]
  /** Formatted suggestions for swipe interface */
  suggestions: PostSuggestion[]
  /** Raw data from database */
  rawPosts: LinkedInResearchPost[]
  /** Set of saved post IDs */
  savedPostIds: Set<string>
  /** User's niches for personalization */
  userNiches: string[]
  /** Current filters */
  filters: InspirationFilters
  /** Pagination state */
  pagination: PaginationState
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Update filters */
  setFilters: (filters: Partial<InspirationFilters>) => void
  /** Load more posts (pagination) */
  loadMore: () => Promise<void>
  /** Refetch posts */
  refetch: () => Promise<void>
  /** Save swipe preference for AI learning */
  saveSwipePreference: (postId: string, action: 'like' | 'dislike', content?: string) => Promise<void>
  /** Save/bookmark a post */
  savePost: (postId: string) => Promise<void>
  /** Unsave/remove bookmark from a post */
  unsavePost: (postId: string) => Promise<void>
  /** Check if a post is saved */
  isPostSaved: (postId: string) => boolean
  /** Get a single post by ID */
  getPostById: (postId: string) => InspirationPost | undefined
  /** Metadata from AI-powered smart search, null when not using smart search */
  searchMeta: {
    searchTerms: string[]
    clusters: string[]
    tags: string[]
    intent: string
  } | null
}

/**
 * Default filters
 */
const defaultFilters: InspirationFilters = {
  category: 'all',
  niche: 'all',
  searchQuery: '',
  savedOnly: false,
  followingOnly: false,
}

/**
 * Hook to fetch and manage inspiration posts from Supabase
 * @param initialLimit - Initial number of posts to fetch (default: PAGE_SIZE)
 * @param filterByInfluencerId - Optional influencer ID to filter posts by a specific influencer
 * @returns Inspiration data, loading state, filters, and actions
 * @example
 * const { posts, filters, setFilters, loadMore, savePost } = useInspiration()
 * // Filter by a specific influencer
 * const { posts } = useInspiration(PAGE_SIZE, 'influencer-id')
 */
export function useInspiration(initialLimit = PAGE_SIZE, filterByInfluencerId?: string): UseInspirationReturn {
  // Get auth state from context
  const { user, isLoading: authLoading } = useAuthContext()

  // State initialization
  const [posts, setPosts] = useState<InspirationPost[]>([])
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([])
  const [rawPosts, setRawPosts] = useState<LinkedInResearchPost[]>([])
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set())
  const [userNiches, setUserNiches] = useState<string[]>([])
  const [filters, setFiltersState] = useState<InspirationFilters>(defaultFilters)
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    totalCount: 0,
    hasMore: false,
    isLoadingMore: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Metadata returned by the AI-powered smart search endpoint */
  const [searchMeta, setSearchMeta] = useState<{
    searchTerms: string[]
    clusters: string[]
    tags: string[]
    intent: string
  } | null>(null)
  // Track if we've already attempted to fetch user-specific data (to avoid repeated 404s)
  // Using ref to avoid triggering re-renders or effect dependencies
  const hasAttemptedUserDataFetchRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /**
   * Fetch user's saved inspiration posts
   * Gracefully handles missing table (404) since it may not be created yet
   */
  const fetchSavedPosts = useCallback(async (userId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('saved_inspirations')
        .select('inspiration_post_id')
        .eq('user_id', userId)

      if (fetchError) {
        // 404 means table doesn't exist - this is expected if migrations haven't run
        // PGRST116 = row not found, 42P01 = relation doesn't exist
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          // Table doesn't exist yet - silently skip
          return
        }
        // Only log unexpected errors
        console.warn('Saved posts not available:', fetchError.message)
        return
      }

      if (data) {
        setSavedPostIds(new Set(data.map(item => item.inspiration_post_id)))
      }
    } catch (err) {
      // Network errors or other issues - don't spam console
      console.warn('Saved posts fetch skipped:', err instanceof Error ? err.message : 'Unknown error')
    }
  }, [supabase])

  /**
   * Fetch user's niches for personalization
   * Gracefully handles missing table (404) since it may not be created yet
   */
  const fetchUserNiches = useCallback(async (userId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_niches')
        .select('niche, confidence')
        .eq('user_id', userId)
        .order('confidence', { ascending: false })

      if (fetchError) {
        // 404 means table doesn't exist - this is expected if migrations haven't run
        // PGRST116 = row not found, 42P01 = relation doesn't exist
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          // Table doesn't exist yet - silently skip
          return
        }
        // Only log unexpected errors
        console.warn('User niches not available:', fetchError.message)
        return
      }

      if (data && data.length > 0) {
        setUserNiches(data.map(item => item.niche))
      }
    } catch (err) {
      // Network errors or other issues - don't spam console
      console.warn('User niches fetch skipped:', err instanceof Error ? err.message : 'Unknown error')
    }
  }, [supabase])

  /**
   * Infer category from post content or type
   */
  const inferCategory = useCallback((post: LinkedInResearchPost): string => {
    const text = (post.text || '').toLowerCase()
    const headline = (post.author_headline || '').toLowerCase()

    // Check for common themes in content and headline
    if (text.includes('marketing') || headline.includes('marketing')) return 'marketing'
    if (text.includes('sales') || headline.includes('sales')) return 'sales'
    if (text.includes('leadership') || headline.includes('ceo') || headline.includes('founder')) return 'leadership'
    if (text.includes('ai') || text.includes('tech') || headline.includes('engineer')) return 'technology'
    if (text.includes('growth') || headline.includes('growth')) return 'growth'
    if (text.includes('startup') || headline.includes('startup')) return 'entrepreneurship'
    if (text.includes('product') || headline.includes('product')) return 'product-management'
    if (text.includes('design') || headline.includes('design')) return 'design'

    return 'general'
  }, [])

  /**
   * Transform raw post data to InspirationPost format
   */
  const transformPost = useCallback((post: LinkedInResearchPost): InspirationPost => {
    const authorName = [post.author_first_name, post.author_last_name]
      .filter(Boolean)
      .join(' ') || 'Unknown Author'

    return {
      id: post.id,
      author: {
        name: authorName,
        headline: post.author_headline || '',
        avatar: post.author_profile_picture || undefined,
      },
      authorUrl: post.author_profile_url || undefined,
      content: post.text || '',
      category: inferCategory(post),
      metrics: {
        reactions: post.total_reactions || 0,
        comments: post.comments || 0,
        reposts: post.reposts || 0,
      },
      postedAt: post.posted_date || post.created_at || new Date().toISOString(),
    }
  }, [inferCategory])

  /**
   * Transform raw post data to PostSuggestion format
   */
  const transformToSuggestion = useCallback((post: LinkedInResearchPost): PostSuggestion => ({
    id: post.id,
    content: post.text || '',
    category: inferCategory(post),
    estimatedEngagement: post.total_reactions || undefined,
  }), [inferCategory])

  /**
   * Fetch inspiration posts from database
   */
  const fetchPosts = useCallback(async (
    page: number = 0,
    append: boolean = false
  ) => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      return
    }

    try {
      if (!append) {
        setIsLoading(true)
      } else {
        setPagination(prev => ({ ...prev, isLoadingMore: true }))
      }
      setError(null)

      // Handle "Following" filter - fetch from influencer posts API
      if (filters.followingOnly) {
        try {
          const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
          if (filterByInfluencerId) params.set('influencer_id', filterByInfluencerId)
          if (filters.category !== 'all') params.set('cluster', filters.category)
          const res = await fetch(`/api/influencers/posts?${params}`)
          if (!res.ok) throw new Error('Failed to fetch influencer posts')

          const { posts: influencerPosts, totalCount } = await res.json()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformed: InspirationPost[] = (influencerPosts || []).map((post: any) => ({
            id: post.id,
            author: {
              name: post.followed_influencers?.author_name || 'Unknown',
              headline: post.followed_influencers?.author_headline || '',
              avatar: post.followed_influencers?.author_profile_picture || undefined,
            },
            authorUrl: post.followed_influencers?.linkedin_url || undefined,
            content: post.content || '',
            category: post.primary_cluster?.toLowerCase() || 'general',
            tags: post.tags || [],
            primaryCluster: post.primary_cluster || null,
            metrics: {
              reactions: post.likes_count || 0,
              comments: post.comments_count || 0,
              reposts: post.reposts_count || 0,
            },
            postedAt: post.posted_at || new Date().toISOString(),
          }))

          if (append) {
            setPosts(prev => [...prev, ...transformed])
          } else {
            setPosts(transformed)
            setSuggestions([])
            setRawPosts([])
          }

          setPagination({
            page,
            totalCount,
            hasMore: (page + 1) * PAGE_SIZE < totalCount,
            isLoadingMore: false,
          })

          setIsLoading(false)
          return
        } catch (err) {
          console.error('Influencer posts fetch error:', err)
          setError('Failed to fetch influencer posts')
          setIsLoading(false)
          return
        }
      }

      // Build query - now using linkedin_research_posts table with viral content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('linkedin_research_posts')
        .select('id, activity_urn, text, url, post_type, posted_date, author_first_name, author_last_name, author_headline, author_username, author_profile_url, author_profile_picture, total_reactions, likes, comments, reposts, created_at', { count: 'exact' })

      // Apply search filter
      if (filters.searchQuery.trim()) {
        const searchTerm = `%${filters.searchQuery.trim()}%`
        query = query.or(`text.ilike.${searchTerm},author_first_name.ilike.${searchTerm},author_last_name.ilike.${searchTerm},author_headline.ilike.${searchTerm}`)
      }

      // If showing only saved posts, filter by saved IDs
      if (filters.savedOnly && savedPostIds.size > 0) {
        query = query.in('id', Array.from(savedPostIds))
      } else if (filters.savedOnly && savedPostIds.size === 0) {
        // No saved posts, show empty state
        setPosts([])
        setSuggestions([])
        setRawPosts([])
        setPagination({
          page: 0,
          totalCount: 0,
          hasMore: false,
          isLoadingMore: false,
        })
        setIsLoading(false)
        return
      }

      // Filter out posts with no content
      query = query.not('text', 'is', null)

      // Order by total reactions (engagement) - most viral first
      query = query
        .order('total_reactions', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data: postsData, error: fetchError, count } = await query

      // If table doesn't exist or error, return empty state
      if (fetchError) {
        console.warn('Inspiration fetch warning:', fetchError.message)
        if (!append) {
          setPosts([])
          setSuggestions([])
          setRawPosts([])
        }
        setPagination(prev => ({
          ...prev,
          hasMore: false,
          isLoadingMore: false,
        }))
        setIsLoading(false)
        return
      }

      if (!postsData || postsData.length === 0) {
        // No data - return empty state
        if (!append) {
          setPosts([])
          setSuggestions([])
          setRawPosts([])
        }
        setPagination(prev => ({
          ...prev,
          hasMore: false,
          isLoadingMore: false,
        }))
        setIsLoading(false)
        return
      }

      // Transform posts (cast to our interface)
      const typedPosts = postsData as LinkedInResearchPost[]
      const transformedPosts = typedPosts.map(transformPost)

      // Apply category filter (categories are inferred, so filter after transform)
      const filteredPosts = filters.category === 'all'
        ? transformedPosts
        : transformedPosts.filter(post => post.category === filters.category)

      // Apply niche filter (niches map to categories in our current model)
      const nicheFilteredPosts = filters.niche === 'all'
        ? filteredPosts
        : filteredPosts.filter(post => post.category === filters.niche)

      const transformedSuggestions = typedPosts.slice(0, 10).map(transformToSuggestion)

      if (append) {
        setPosts(prev => [...prev, ...nicheFilteredPosts])
        setRawPosts(prev => [...prev, ...typedPosts])
      } else {
        setPosts(nicheFilteredPosts)
        setSuggestions(transformedSuggestions)
        setRawPosts(typedPosts)
      }

      // Update pagination
      const totalCount = count || 0
      setPagination({
        page,
        totalCount,
        hasMore: (page + 1) * PAGE_SIZE < totalCount,
        isLoadingMore: false,
      })

      // Fetch user data if authenticated, on first page, and haven't attempted yet
      // This prevents repeated 404 errors when tables don't exist
      if (user && page === 0) {
        // Reset flag if user changed
        if (lastUserIdRef.current !== user.id) {
          lastUserIdRef.current = user.id
          hasAttemptedUserDataFetchRef.current = false
        }

        if (!hasAttemptedUserDataFetchRef.current) {
          hasAttemptedUserDataFetchRef.current = true
          await Promise.all([
            fetchSavedPosts(user.id),
            fetchUserNiches(user.id),
          ])
        }
      }
    } catch (err) {
      console.error('Inspiration fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch posts')
    } finally {
      setIsLoading(false)
      setPagination(prev => ({ ...prev, isLoadingMore: false }))
    }
  }, [supabase, filters, savedPostIds, userNiches, user, authLoading, filterByInfluencerId, transformPost, transformToSuggestion, fetchSavedPosts, fetchUserNiches])

  /**
   * Update filters
   */
  const setFilters = useCallback((newFilters: Partial<InspirationFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
    // Reset pagination when filters change
    setPagination(prev => ({ ...prev, page: 0 }))
  }, [])

  /**
   * Load more posts (pagination)
   */
  const loadMore = useCallback(async () => {
    if (pagination.isLoadingMore || !pagination.hasMore) return
    await fetchPosts(pagination.page + 1, true)
  }, [pagination, fetchPosts])

  /**
   * Save swipe preference to database for AI learning
   */
  const saveSwipePreference = useCallback(async (
    postId: string,
    action: 'like' | 'dislike',
    content?: string
  ) => {
    if (!user) {
      console.warn('User not authenticated, cannot save swipe preference')
      return
    }

    try {
      const { error: insertError } = await supabase
        .from('swipe_preferences')
        .insert({
          user_id: user.id,
          post_id: postId,
          suggestion_content: content || null,
          action: action,
        })

      if (insertError) {
        console.error('Error saving swipe preference:', insertError)
      }
    } catch (err) {
      console.error('Swipe preference save error:', err)
    }
  }, [supabase, user])

  /**
   * Save/bookmark a post
   * Creates a draft in generated_posts AND bookmarks in saved_inspirations.
   * Draft save fires independently so it succeeds even if bookmark fails.
   */
  const savePost = useCallback(async (postId: string) => {
    if (!user) {
      console.warn('User not authenticated, cannot save post')
      return
    }

    // 1. Fire-and-forget: create a draft via auto-save API (independent of bookmark)
    const post = posts.find(p => p.id === postId)
    if (post?.content) {
      fetch('/api/drafts/auto-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: post.content,
          postType: post.category || 'general',
          source: 'inspiration',
        }),
      }).catch(err => {
        console.warn('Auto-save draft from inspiration failed:', err)
      })
    }

    // 2. Bookmark in saved_inspirations for the "Saved Only" filter
    try {
      const { error: insertError } = await supabase
        .from('saved_inspirations')
        .insert({
          user_id: user.id,
          inspiration_post_id: postId,
        })

      if (insertError) {
        if (insertError.code === '23505') {
          console.warn('Post already saved')
        } else {
          console.error('Error saving post:', insertError)
        }
      }

      // Update local state regardless (optimistic)
      setSavedPostIds(prev => new Set(prev).add(postId))
    } catch (err) {
      console.error('Save post error:', err)
      // Still update local state so UI shows saved state
      setSavedPostIds(prev => new Set(prev).add(postId))
    }
  }, [supabase, user, posts])

  /**
   * Unsave/remove bookmark from a post
   */
  const unsavePost = useCallback(async (postId: string) => {
    if (!user) {
      console.warn('User not authenticated, cannot unsave post')
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('saved_inspirations')
        .delete()
        .eq('user_id', user.id)
        .eq('inspiration_post_id', postId)

      if (deleteError) {
        console.error('Error unsaving post:', deleteError)
        return
      }

      // Update local state
      setSavedPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    } catch (err) {
      console.error('Unsave post error:', err)
    }
  }, [supabase, user])

  /**
   * Check if a post is saved
   */
  const isPostSaved = useCallback((postId: string): boolean => {
    return savedPostIds.has(postId)
  }, [savedPostIds])

  /**
   * Get a single post by ID
   */
  const getPostById = useCallback((postId: string): InspirationPost | undefined => {
    return posts.find(post => post.id === postId)
  }, [posts])

  /**
   * Refetch posts with current filters
   */
  const refetch = useCallback(async () => {
    await fetchPosts(0, false)
  }, [fetchPosts])

  // Fetch posts when auth state changes or filters change
  useEffect(() => {
    if (!authLoading) {
      fetchPosts(0, false)
    }
  }, [authLoading, filters.category, filters.niche, filters.savedOnly, filters.followingOnly, filterByInfluencerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Smart search with debounce
  useEffect(() => {
    if (authLoading) return
    if (!filters.searchQuery || filters.searchQuery.trim().length < 3) {
      setSearchMeta(null)
      if (filters.searchQuery === '') {
        fetchPosts(0, false)
      }
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({
          q: filters.searchQuery.trim(),
          page: '0',
          limit: String(PAGE_SIZE),
        })

        const res = await fetch(`/api/inspiration/search?${params}`)
        if (!res.ok) throw new Error('Search failed')

        const { posts: searchPosts, totalCount, searchMeta: meta } = await res.json()

        setSearchMeta(meta)

        // Transform search results to InspirationPost format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformed: InspirationPost[] = (searchPosts || []).map((post: any) => ({
          id: post.id,
          author: post.author || { name: 'Unknown', headline: '' },
          authorUrl: post.authorUrl || undefined,
          content: post.content || '',
          category: post.category || post.primaryCluster?.toLowerCase() || 'general',
          tags: post.tags || [],
          primaryCluster: post.primaryCluster || null,
          metrics: post.metrics || { reactions: 0, comments: 0, reposts: 0 },
          postedAt: post.postedAt || new Date().toISOString(),
        }))

        setPosts(transformed)
        setSuggestions([])
        setRawPosts([])
        setPagination({
          page: 0,
          totalCount,
          hasMore: PAGE_SIZE < totalCount,
          isLoadingMore: false,
        })
      } catch (err) {
        console.error('Smart search error:', err)
        // Fallback to basic search
        fetchPosts(0, false)
      } finally {
        setIsLoading(false)
      }
    }, 400) // Slightly longer debounce for AI search

    return () => clearTimeout(timeoutId)
  }, [filters.searchQuery, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Combined loading state
  const combinedLoading = authLoading || isLoading

  return {
    posts,
    suggestions,
    rawPosts,
    savedPostIds,
    userNiches,
    filters,
    pagination,
    isLoading: combinedLoading,
    error,
    setFilters,
    loadMore,
    refetch,
    saveSwipePreference,
    savePost,
    unsavePost,
    isPostSaved,
    getPostById,
    searchMeta,
  }
}
