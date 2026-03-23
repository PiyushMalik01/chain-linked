/**
 * Reset Password Page
 * @description Password reset form for users arriving via the recovery link.
 * Receives a token_hash query param and uses verifyOtp to establish a session,
 * then allows the user to set a new password.
 * @module app/reset-password
 */

'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconLoader2, IconLink, IconLock, IconCheck } from '@tabler/icons-react'
import { toast } from 'sonner'

/**
 * Inner reset password form that uses useSearchParams
 * @returns Reset password form JSX
 */
function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * Calculate password strength
   * @param pwd - Password to evaluate
   * @returns strength score (0-4) and label
   */
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' }

    let score = 0

    // Length check
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++

    // Has uppercase and lowercase
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++

    // Has numbers
    if (/\d/.test(pwd)) score++

    // Has special characters
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    // Map score to strength label
    const strengthMap = {
      0: { label: '', color: '' },
      1: { label: 'Weak', color: 'bg-destructive' },
      2: { label: 'Fair', color: 'bg-yellow-500' },
      3: { label: 'Good', color: 'bg-primary' },
      4: { label: 'Strong', color: 'bg-green-600' },
      5: { label: 'Very Strong', color: 'bg-green-600' },
    }

    return { score, ...strengthMap[Math.min(score, 5) as keyof typeof strengthMap] }
  }

  const passwordStrength = getPasswordStrength(password)

  // Verify the recovery token from the URL and establish a session.
  // Falls back to checking an existing session (e.g. if the user was
  // already redirected via the auth callback).
  useEffect(() => {
    const supabase = createClient()
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    const verifyToken = async () => {
      // If we have a token_hash in the URL, verify it to establish a session
      if (tokenHash && type === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })

        if (error) {
          console.error('[ResetPassword] Token verification failed:', error.message)
          setIsCheckingSession(false)
          return
        }

        setHasSession(true)
        setIsCheckingSession(false)
        return
      }

      // Fallback: check for an existing session (e.g. from auth callback flow)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setHasSession(true)
      }
      setIsCheckingSession(false)
    }

    verifyToken()
  }, [searchParams])

  /**
   * Handle password update
   */
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      toast.error('Please enter a new password')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        console.error('Password update error:', error)
        toast.error(error.message || 'Failed to update password')
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
      toast.success('Password updated successfully')
    } catch (error) {
      console.error('Password update error:', error)
      toast.error('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 p-4">
        <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center space-y-4 px-8 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
              <IconCheck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Password updated</CardTitle>
              <CardDescription className="mt-2">
                Your password has been successfully updated
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Button
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
              onClick={() => router.push('/login')}
            >
              Continue to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show a loading spinner while verifying the session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 p-4">
        <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center space-y-4 px-8 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
              <IconLoader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Verifying reset link</CardTitle>
              <CardDescription className="mt-2">
                Please wait while we verify your password reset link...
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 p-4">
        <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center space-y-4 px-8 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 shadow-sm">
              <IconLock className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Invalid or expired link</CardTitle>
              <CardDescription className="mt-2">
                This password reset link is invalid or has expired
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-8 pb-8">
            <Link href="/forgot-password" className="block">
              <Button className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm">
                Request a new reset link
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full h-11 border-border/50 hover:bg-accent/50 transition-all duration-200">
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 p-4">
      {/* Prevent referrer leakage of reset token in URL */}
      <meta name="referrer" content="no-referrer" />
      <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
        <CardHeader className="text-center space-y-4 px-8 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
            <IconLink className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
            <CardDescription className="mt-2">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <form onSubmit={handlePasswordUpdate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
                minLength={6}
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
              {password && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength.score
                            ? passwordStrength.color
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.label && (
                    <p className="text-xs text-muted-foreground">
                      Password strength: <span className="font-medium">{passwordStrength.label}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconLock className="mr-2 h-4 w-4" />
              )}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Reset password page component
 * Wraps the form in Suspense for useSearchParams compatibility
 * @returns Reset password page JSX
 */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
