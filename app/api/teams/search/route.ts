/**
 * Team Search API Route
 * @description Search for discoverable teams by name
 * @module app/api/teams/search
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    // Search discoverable teams by name
    const { data: teams, error: searchError } = await supabase
      .from('teams')
      .select('id, name, logo_url, company_id')
      .eq('discoverable', true)
      .ilike('name', `%${q}%`)
      .limit(10)

    if (searchError) {
      console.error('[team search] search error:', searchError)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    if (!teams || teams.length === 0) {
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

    const results = teams.map(team => ({
      id: team.id,
      name: team.name,
      logo_url: team.logo_url,
      member_count: countMap.get(team.id) || 0,
      company_name: team.company_id ? (companyMap.get(team.company_id) ?? null) : null,
    }))

    return NextResponse.json({ teams: results })
  } catch (err) {
    console.error('[team search] error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
