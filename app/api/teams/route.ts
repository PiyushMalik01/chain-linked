/**
 * Teams API Route
 * @description Handles team CRUD operations
 * @module app/api/teams
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET teams
 * @description Fetch current user's teams with member count
 * @returns User's teams with role and member information
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get teams where user is a member
    const { data: memberships, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)

    if (membershipError) {
      console.error('Membership fetch error:', membershipError)
      return NextResponse.json({ error: 'Failed to fetch memberships' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ teams: [] })
    }

    // Get team details
    const teamIds = memberships.map(m => m.team_id)
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, logo_url, owner_id, company_id, created_at')
      .in('id', teamIds)

    if (teamsError) {
      console.error('Teams fetch error:', teamsError)
      return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
    }

    // Get member counts for all teams in a single query
    const { data: memberCountData } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds)

    // Build count map client-side from the single query result
    const countMap = new Map<string, number>()
    if (memberCountData) {
      for (const row of memberCountData) {
        countMap.set(row.team_id, (countMap.get(row.team_id) || 0) + 1)
      }
    }

    // Get company info for teams
    const companyIds = [...new Set(teams?.map(t => t.company_id).filter(Boolean))]
    let companies: Record<string, { id: string; name: string; logo_url: string | null }> = {}

    if (companyIds.length > 0) {
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .in('id', companyIds as string[])

      companies = (companiesData || []).reduce((acc, c) => {
        acc[c.id] = c
        return acc
      }, {} as Record<string, { id: string; name: string; logo_url: string | null }>)
    }

    // Build response
    const roleMap = new Map(memberships.map(m => [m.team_id, m.role]))
    const enrichedTeams = (teams || []).map(team => ({
      id: team.id,
      name: team.name,
      logo_url: team.logo_url,
      owner_id: team.owner_id,
      created_at: team.created_at,
      role: roleMap.get(team.id) || 'member',
      member_count: countMap.get(team.id) || 0,
      company: team.company_id ? companies[team.company_id] || null : null,
    }))

    return NextResponse.json({ teams: enrichedTeams })
  } catch (err) {
    console.error('Teams fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
  }
}

/**
 * POST create new team
 * @description Create a new team (admin function)
 * @param request - Team data
 * @returns Created team
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, company_id, logo_url } = body

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    // If company_id provided, verify user owns or is admin of the company
    if (company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('owner_id')
        .eq('id', company_id)
        .single()

      if (!company || company.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to create team for this company' }, { status: 403 })
      }
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        owner_id: user.id,
        company_id: company_id || null,
        logo_url: logo_url || null,
      })
      .select()
      .single()

    if (teamError) {
      console.error('Team creation error:', teamError)
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('Member creation error:', memberError)
      // Rollback team creation
      const { error: rollbackError } = await supabase.from('teams').delete().eq('id', team.id)
      if (rollbackError) {
        console.error('Rollback failed - orphaned team:', team.id, rollbackError)
      }
      return NextResponse.json({ error: 'Failed to add owner to team' }, { status: 500 })
    }

    return NextResponse.json({
      team: {
        ...team,
        role: 'owner',
        member_count: 1,
      },
    })
  } catch (err) {
    console.error('Team creation error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * PATCH update team
 * @description Update team details (owner/admin only)
 * @param request - Team updates
 * @returns Updated team
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, name, logo_url } = body

    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
    }

    // Check user has permission (owner or admin)
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized to update team' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) updates.name = name
    if (logo_url !== undefined) updates.logo_url = logo_url

    // Update team
    const { data: team, error: updateError } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Team update error:', updateError)
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 })
    }

    return NextResponse.json({ team })
  } catch (err) {
    console.error('Team update error:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE team
 * @description Delete a team (owner only)
 * @param request - Request with team ID
 * @returns Success message
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('id')

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
  }

  // Check user is owner
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (!team || team.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the team owner can delete the team' }, { status: 403 })
  }

  // Delete team members first
  const { error: membersError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)

  if (membersError) {
    console.error('Team members deletion error:', membersError)
    return NextResponse.json({ error: 'Failed to remove team members' }, { status: 500 })
  }

  // Delete invitations
  const { error: invitationsError } = await supabase
    .from('team_invitations')
    .delete()
    .eq('team_id', teamId)

  if (invitationsError) {
    console.error('Team invitations deletion error:', invitationsError)
    return NextResponse.json({ error: 'Failed to remove team invitations' }, { status: 500 })
  }

  // Delete join requests
  const { error: joinRequestsError } = await supabase
    .from('team_join_requests')
    .delete()
    .eq('team_id', teamId)

  if (joinRequestsError) {
    console.error('Team join requests deletion error:', joinRequestsError)
    return NextResponse.json({ error: 'Failed to remove team join requests' }, { status: 500 })
  }

  // Delete team
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)

  if (deleteError) {
    console.error('Team deletion error:', deleteError)
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
