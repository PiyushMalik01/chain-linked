// TODO: Add rate limiting (e.g., Upstash Redis or next-rate-limit)

/**
 * Team Search API Route
 * @description Search for discoverable teams by name
 * @module app/api/teams/search
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Escape PostgREST special pattern characters to prevent filter injection
 * @param str - Raw user input string
 * @returns Escaped string safe for use in .ilike() patterns
 */
function escapePostgrestPattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

/**
 * GET /api/teams/search?q=searchterm
 * @description Search teams by name (case-insensitive). Only returns teams with discoverable=true.
 * @returns Matching teams with id, name, member_count, company_name, logo_url
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ teams: [] })
  }

  try {
    // Escape special PostgREST pattern characters before building ILIKE filters
    const safeQ = escapePostgrestPattern(q)
    // Strip spaces for fuzzy matching (e.g. "Hire Ops" -> "HireOps" matches "HigherOps")
    const normalizedQ = escapePostgrestPattern(q.replace(/\s+/g, ''))

    // Search teams by name: exact ILIKE + trigram similarity for fuzzy matches
    const { data: teamsByName, error: nameError } = await supabase
      .from('teams')
      .select('id, name, logo_url, company_id, discoverable')
      .eq('discoverable', true)
      .or(`name.ilike.%${safeQ}%,name.ilike.%${normalizedQ}%`)
      .limit(10)

    if (nameError) {
      console.error('[team search] name search error:', nameError)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    // Also search companies by name and find their teams
    const { data: matchingCompanies } = await supabase
      .from('companies')
      .select('id, name')
      .or(`name.ilike.%${safeQ}%,name.ilike.%${normalizedQ}%`)
      .limit(10)

    let teamsByCompany: typeof teamsByName = []
    if (matchingCompanies && matchingCompanies.length > 0) {
      const companyIds = matchingCompanies.map(c => c.id)
      const { data: companyTeams } = await supabase
        .from('teams')
        .select('id, name, logo_url, company_id, discoverable')
        .eq('discoverable', true)
        .in('company_id', companyIds)
        .limit(10)
      teamsByCompany = companyTeams || []
    }

    // If still no results, try trigram similarity search via RPC
    let teamsByTrigram: typeof teamsByName = []
    if ((!teamsByName || teamsByName.length === 0) && (!teamsByCompany || teamsByCompany.length === 0)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: trigramResults } = await (supabase.rpc as any)('search_teams_fuzzy', {
        search_term: q,
        similarity_threshold: 0.2,
      })
      teamsByTrigram = (trigramResults as typeof teamsByName) || []
    }

    // Merge, deduplicate, and filter to discoverable teams only
    const teamMap = new Map<string, (typeof teamsByName)[number]>()
    for (const team of [...(teamsByName || []), ...teamsByCompany, ...teamsByTrigram]) {
      if (!teamMap.has(team.id) && team.discoverable) {
        teamMap.set(team.id, team)
      }
    }
    const teams = Array.from(teamMap.values())

    if (teams.length === 0) {
      return NextResponse.json({ teams: [] })
    }

    // Get member counts
    const teamIds = teams.map(t => t.id)
    const { data: memberCounts } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds)

    const countMap = new Map<string, number>()
    if (memberCounts) {
      for (const row of memberCounts) {
        countMap.set(row.team_id, (countMap.get(row.team_id) || 0) + 1)
      }
    }

    // Get company names
    const companyIds = [...new Set(teams.map(t => t.company_id).filter(Boolean))]
    const companyMap = new Map<string, string>()

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds as string[])

      if (companies) {
        for (const c of companies) {
          companyMap.set(c.id, c.name)
        }
      }
    }

    // Sort: discoverable teams first
    const results = teams
      .map(team => ({
        id: team.id,
        name: team.name,
        logo_url: team.logo_url,
        member_count: countMap.get(team.id) || 0,
        company_name: team.company_id ? (companyMap.get(team.company_id) ?? null) : null,
        discoverable: team.discoverable ?? false,
      }))
      .sort((a, b) => (b.discoverable ? 1 : 0) - (a.discoverable ? 1 : 0))

    return NextResponse.json({ teams: results })
  } catch (err) {
    console.error('[team search] error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
