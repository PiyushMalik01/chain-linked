/**
 * Login Page
 * @description Authentication page with email/password and Google OAuth sign-in
 * @module app/login
 */

'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { IconBrandGoogle, IconLoader2, IconMail, IconSparkles } from '@tabler/icons-react'
import { toast } from 'sonner'

/**
 * Sanitize a redirect URL to prevent open redirect attacks.
 * Only allows internal paths that start with "/" and are not protocol-relative.
 * @param url - The redirect URL to validate
 * @returns A safe redirect path, defaulting to "/dashboard"
 */
function sanitizeRedirect(url: string): string {
  if (url && url.startsWith('/') && !url.startsWith('//')) {
    return url
  }
  return '/dashboard'
}

/**
 * Login form component with email/password and Google OAuth
 * @returns Login form JSX
 */
function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = sanitizeRedirect(searchParams.get('redirect') || '/dashboard')
  const errorParam = searchParams.get('error')
  const successParam = searchParams.get('success')

  // Check if error is related to expired/verification issues
  const showResendOption = errorParam && (
    errorParam.toLowerCase().includes('expired') ||
    errorParam.toLowerCase().includes('verification') ||
    errorParam.toLowerCase().includes('verify')
  )

  // Show error or success message from URL params on mount
  // Redirect to verify-email page if error is about email verification
  useEffect(() => {
    if (errorParam) {
      const isVerificationError =
        errorParam.toLowerCase().includes('email not confirmed') ||
        errorParam.toLowerCase().includes('not verified')
      if (isVerificationError) {
        router.replace(`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ''}`)
        return
      }
      toast.error(errorParam)
    }
    if (successParam) {
      toast.success(successParam)
    }
  }, [errorParam, successParam, router])

  /**
   * Handle resending verification email via API
   */
  const handleResendVerification = async () => {
    const userEmail = email || window.prompt('Enter your email address:')
    if (!userEmail) return

    setIsResendingEmail(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to resend verification email')
      } else {
        toast.success(data.message || 'Verification email sent! Please check your inbox.')
      }
    } catch (err) {
      console.error('Resend verification error:', err)
      toast.error('Failed to resend verification email')
    } finally {
      setIsResendingEmail(false)
    }
  }

  /**
   * Handle email/password sign in
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter your email and password')
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Sign in error:', error)
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password')
        } else if (error.message.includes('Email not confirmed')) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`)
          return
        } else {
          toast.error(error.message || 'Failed to sign in')
        }
        setIsLoading(false)
        return
      }

      if (data.user) {
        toast.success('Signed in successfully')
        router.push(redirectTo)
        router.refresh()
      }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  /**
   * Handle Google OAuth sign in
   */
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('OAuth error:', error)
        toast.error('Failed to sign in with Google')
        setIsGoogleLoading(false)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('An unexpected error occurred')
      setIsGoogleLoading(false)
    }
  }

  return (
    <CardContent className="space-y-8 px-8 pb-8">
      {/* Email/Password Form */}
      <motion.form
        onSubmit={handleEmailSignIn}
        className="space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            autoComplete="email"
            required
            className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            autoComplete="current-password"
            required
            className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconMail className="mr-2 h-4 w-4" />
            )}
            Sign in with Email
          </Button>
        </motion.div>
      </motion.form>

      {/* Divider */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </motion.div>

      {/* Google OAuth */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Button
          variant="outline"
          className="w-full h-11 border-border/50 hover:bg-accent/50 transition-all duration-200"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <IconBrandGoogle className="mr-2 h-4 w-4" />
          )}
          Continue with Google
        </Button>
      </motion.div>

      {/* Resend verification email */}
      {showResendOption && (
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.3 }}
        >
          <Button
            variant="link"
            className="text-sm text-primary hover:underline"
            onClick={handleResendVerification}
            disabled={isResendingEmail}
          >
            {isResendingEmail ? (
              <>
                <IconLoader2 className="mr-2 h-3 w-3 animate-spin" />
                Sending...
              </>
            ) : (
              'Resend verification email'
            )}
          </Button>
        </motion.div>
      )}

      {/* Sign up link */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
      >
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary hover:underline font-medium transition-colors">
          Create account
        </Link>
      </motion.p>

      <motion.p
        className="text-xs text-center text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      >
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </motion.p>
    </CardContent>
  )
}

/**
 * Login form loading skeleton
 * @returns Loading skeleton JSX
 */
function LoginFormSkeleton() {
  return (
    <CardContent className="space-y-8 px-8 pb-8">
      <div className="space-y-5">
        <Skeleton className="w-full h-11" />
        <Skeleton className="w-full h-11" />
        <Skeleton className="w-full h-11" />
      </div>
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-full h-11" />
    </CardContent>
  )
}

/**
 * Login page component with email/password and Google OAuth
 * @returns Login page JSX
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-secondary/10 via-transparent to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center space-y-4 px-8 pb-2">
            <motion.div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              <Image src="/logo.png" alt="ChainLinked" width={32} height={32} className="size-8" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                Welcome back
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 400 }}
                >
                  <IconSparkles className="size-5 text-primary" />
                </motion.span>
              </CardTitle>
              <CardDescription className="mt-2">
                Sign in to your ChainLinked account
              </CardDescription>
            </motion.div>
          </CardHeader>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </Card>
      </motion.div>
    </div>
  )
}
