/**
 * Discover Posts API Route
 * @description Fetches curated/scraped industry posts for the Discover tab
 * @module app/api/discover/posts
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Valid sort options for discover posts
 */
type SortOption = "engagement" | "recent" | "viral"

/**
 * GET /api/discover/posts
 * @description Fetches discover posts with filtering, sorting, and pagination
 * @param request - Incoming request with query params: topic, page, limit, sort, search
 * @returns Paginated list of discover posts
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const topic = searchParams.get("topic") || ""
  const page = Math.min(1000, Math.max(1, parseInt(searchParams.get("page") || "1", 10)))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)))
  const sort = (searchParams.get("sort") || "engagement") as SortOption
  const search = searchParams.get("search") || ""
  const cluster = searchParams.get("cluster") || ""
  const tagsParam = searchParams.get("tags") || ""

  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from("discover_posts")
      .select("*", { count: "exact" })

    // Filter by topic if provided (topics is a text[] column)
    if (topic) {
      query = query.contains("topics", [topic])
    }

    // Filter by primary_cluster if provided
    if (cluster) {
      query = query.eq("primary_cluster", cluster)
    }

    // Filter by tags if provided (comma-separated, uses array overlap)
    if (tagsParam) {
      const tagsArray = tagsParam.split(",").map((t: string) => t.trim()).filter(Boolean)
      if (tagsArray.length > 0) {
        query = query.overlaps("tags", tagsArray)
      }
    }

    // Search in content and author name with sanitized input
    if (search) {
      const sanitizedSearch = search
        .replace(/[%_\\.,()]/g, '')
        .trim()
        .slice(0, 100)

      if (sanitizedSearch.length > 0) {
        query = query.or(
          `content.ilike.%${sanitizedSearch}%,author_name.ilike.%${sanitizedSearch}%`
        )
      }
    }

    // Apply sorting
    switch (sort) {
      case "engagement":
        query = query.order("engagement_rate", {
          ascending: false,
          nullsFirst: false,
        })
        break
      case "recent":
        query = query.order("posted_at", { ascending: false })
        break
      case "viral":
        query = query
          .eq("is_viral", true)
          .order("likes_count", { ascending: false })
        break
      default:
        query = query.order("engagement_rate", {
          ascending: false,
          nullsFirst: false,
        })
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: posts, error: queryError, count } = await query

    if (queryError) {
      // If table doesn't exist yet, return empty with a flag
      if (
        queryError.code === "42P01" ||
        queryError.message?.includes("does not exist")
      ) {
        return NextResponse.json({
          posts: [],
          pagination: {
            page,
            limit,
            total: 0,
            hasMore: false,
          },
          fallback: true,
        })
      }
      throw queryError
    }

    const total = count ?? 0

    return NextResponse.json({
      posts: posts || [],
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
      fallback: false,
    })
  } catch (error) {
    console.error("Error fetching discover posts:", error)
    return NextResponse.json(
      { error: "Failed to fetch discover posts" },
      { status: 500 }
    )
  }
}
