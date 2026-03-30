/**
 * Invitation Acceptance Page
 * @description Public page for accepting team invitations
 * @module app/invite/[token]
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconLink,
  IconLoader2,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useInvitations, type AcceptInvitationResult } from '@/hooks/use-invitations'
import type { TeamInvitationWithInviter } from '@/types/database'
import { getInitials } from '@/lib/utils'

/**
 * Invitation status types
 */
type InvitationPageStatus =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'already_accepted'
  | 'email_mismatch'
  | 'not_authenticated'
  | 'ready'
  | 'accepting'
  | 'success'
  | 'error'

/**
 * Invitation Acceptance Page Component
 *
 * Public page that handles team invitation acceptance.
 * Flow:
 * 1. Load invitation by token
 * 2. If not logged in, redirect to login with return URL
 * 3. If logged in with matching email, show accept button
 * 4. On accept, add user to team and redirect to dashboard
 *
 * @returns Invitation acceptance page JSX
 */
export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const { acceptInvitation } = useInvitations()

  const [status, setStatus] = useState<InvitationPageStatus>('loading')
  const [invitation, setInvitation] = useState<TeamInvitationWithInviter | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [existingTeamName, setExistingTeamName] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Load invitation and check auth status
  useEffect(() => {
    const loadInvitation = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        setUserEmail(user?.email || null)

        // Check if user is already in a team (to show warning)
        if (user) {
          const { data: currentMemberships } = await supabase
            .from('team_members')
            .select('team_id, teams(name)')
            .eq('user_id', user.id)
            .limit(1)

          if (currentMemberships && currentMemberships.length > 0) {
            const teamData = currentMemberships[0].teams as unknown as { name: string } | null
            setExistingTeamName(teamData?.name || 'your current team')
          }
        }

        // Fetch invitation via API (bypasses RLS for unauthenticated users)
        const res = await fetch(`/api/teams/accept-invite?token=${encodeURIComponent(token)}`)
        if (!res.ok) {
          setStatus('invalid')
          return
        }

        const data = await res.json()
        const inv = data.invitation
        if (!inv) {
          setStatus('invalid')
          return
        }

        // Build invitation data for display
        const invitationData: TeamInvitationWithInviter = {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          team_id: '',
          token: token,
          invited_by: null,
          accepted_at: null,
          inviter: data.inviter ? {
            name: data.inviter.name,
            email: data.inviter.email || '',
            avatar_url: data.inviter.avatar_url,
          } : undefined,
          team: data.team ? {
            name: data.team.name,
            company: data.company ? {
              name: data.company.name,
              logo_url: data.company.logo_url,
            } : undefined,
          } : undefined,
        }

        setInvitation(invitationData)

        // Check invitation status
        if (inv.status === 'accepted') {
          setStatus('already_accepted')
          return
        }

        if (inv.status === 'cancelled') {
          setStatus('invalid')
          setErrorMessage('This invitation has been cancelled.')
          return
        }

        if (inv.status === 'expired') {
          setStatus('expired')
          return
        }

        // Check expiration
        if (new Date(inv.expires_at) < new Date()) {
          setStatus('expired')
          return
        }

        // If not authenticated, redirect directly to signup with invite token
        if (!user) {
          sessionStorage.setItem('pendingInviteToken', token)
          router.push(`/signup?invite=${encodeURIComponent(token)}&redirect=${encodeURIComponent(`/invite/${token}`)}`)
          return
        }

        // Ready to accept (email match is checked server-side on accept)
        setStatus('ready')
      } catch (err) {
        console.error('Load invitation error:', err)
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load invitation')
      }
    }

    loadInvitation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  /**
   * Handle accepting the invitation
   */
  const handleAccept = async () => {
    setStatus('accepting')
    setErrorMessage(null)

    const result = await acceptInvitation(token)

    if (result.success) {
      setStatus('success')
      // Redirect to dashboard after brief delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } else {
      setStatus('error')
      setErrorMessage(result.error || 'Failed to accept invitation')
    }
  }

  /**
   * Handle login redirect
   */
  const handleLogin = () => {
    // Store invitation token in session storage for post-login handling
    sessionStorage.setItem('pendingInviteToken', token)
    router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)
  }

  /**
   * Handle signup redirect
   */
  const handleSignup = () => {
    sessionStorage.setItem('pendingInviteToken', token)
    router.push(`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`)
  }

  // Render different states
  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </div>
        )

      case 'invalid':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <IconX className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Invalid Invitation</h3>
              <p className="text-muted-foreground mt-1">
                {errorMessage || 'This invitation link is not valid or has been removed.'}
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        )

      case 'expired':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <IconClock className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Invitation Expired</h3>
              <p className="text-muted-foreground mt-1">
                This invitation has expired. Please ask the team admin to send a new invitation.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        )

      case 'already_accepted':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <IconCheck className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Already Joined</h3>
              <p className="text-muted-foreground mt-1">
                You have already accepted this invitation and joined the team.
              </p>
            </div>
            <Button asChild className="mt-4">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        )

      case 'email_mismatch':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <IconAlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Email Mismatch</h3>
              <p className="text-muted-foreground mt-1">
                This invitation was sent to <strong>{invitation?.email}</strong>,
                but you are logged in as <strong>{userEmail}</strong>.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Please log out and sign in with the correct email address.
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button onClick={async () => {
                await supabase.auth.signOut()
                handleLogin()
              }}>
                Sign Out & Login
              </Button>
            </div>
          </div>
        )

      case 'not_authenticated':
        return (
          <div className="space-y-6">
            {/* Invitation Details */}
            {invitation?.team && (
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                {invitation.team.company?.logo_url ? (
                  <div className="size-12 rounded-lg overflow-hidden border bg-background">
                    <Image
                      src={invitation.team.company.logo_url}
                      alt={invitation.team.company.name}
                      width={48}
                      height={48}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconUserPlus className="size-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{invitation.team.company?.name || invitation.team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Team: {invitation.team.name}
                  </p>
                </div>
              </div>
            )}

            {/* Inviter Info */}
            {invitation?.inviter && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Avatar className="size-6">
                  {invitation.inviter.avatar_url ? (
                    <AvatarImage src={invitation.inviter.avatar_url} alt={invitation.inviter.name || ''} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getInitials(invitation.inviter.name || invitation.inviter.email)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  Invited by {invitation.inviter.name || invitation.inviter.email}
                </span>
              </div>
            )}

            <p className="text-center text-muted-foreground">
              Sign in or create an account to join this team.
            </p>

            <div className="flex flex-col gap-3">
              <Button onClick={() => router.push(`/signup?invite=${token}`)} className="w-full h-11">
                <IconUserPlus className="mr-2 h-4 w-4" />
                Create Account
              </Button>
              <Button onClick={() => router.push(`/login?redirect=/invite/${token}`)} variant="outline" className="w-full h-11">
                Already have an account? Sign In
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Make sure to use the email address <strong>{invitation?.email}</strong>
            </p>
          </div>
        )

      case 'ready':
        return (
          <div className="space-y-6">
            {/* Invitation Details */}
            {invitation?.team && (
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                {invitation.team.company?.logo_url ? (
                  <div className="size-12 rounded-lg overflow-hidden border bg-background">
                    <Image
                      src={invitation.team.company.logo_url}
                      alt={invitation.team.company.name}
                      width={48}
                      height={48}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconUserPlus className="size-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{invitation.team.company?.name || invitation.team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Team: {invitation.team.name}
                  </p>
                </div>
              </div>
            )}

            {/* Inviter Info */}
            {invitation?.inviter && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Avatar className="size-6">
                  {invitation.inviter.avatar_url ? (
                    <AvatarImage src={invitation.inviter.avatar_url} alt={invitation.inviter.name || ''} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getInitials(invitation.inviter.name || invitation.inviter.email)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  Invited by {invitation.inviter.name || invitation.inviter.email}
                </span>
              </div>
            )}

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                You will join as <strong>{invitation?.role === 'admin' ? 'Admin' : 'Member'}</strong>
              </p>
            </div>

            {existingTeamName && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <IconAlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    You are currently a member of <strong>{existingTeamName}</strong>.
                    Accepting this invitation will remove you from that team.
                  </p>
                </div>
              </div>
            )}

            <Button onClick={handleAccept} className="w-full h-11">
              <IconCheck className="mr-2 h-4 w-4" />
              {existingTeamName ? 'Leave Old Team & Accept' : 'Accept Invitation'}
            </Button>
          </div>
        )

      case 'accepting':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining team...</p>
          </div>
        )

      case 'success':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <IconCheck className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Welcome to the team!</h3>
              <p className="text-muted-foreground mt-1">
                You have successfully joined {invitation?.team?.name || 'the team'}.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </div>
        )

      case 'error':
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <IconX className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Something went wrong</h3>
              <p className="text-muted-foreground mt-1">
                {errorMessage || 'Failed to accept the invitation. Please try again.'}
              </p>
            </div>
            <Button onClick={() => setStatus('ready')} variant="outline" className="mt-4">
              Try Again
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <IconLink className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {status === 'success' ? 'Welcome!' : 'Team Invitation'}
            </CardTitle>
            {status !== 'loading' && status !== 'success' && (
              <CardDescription className="mt-2">
                You have been invited to join a team on ChainLinked
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  )
}
