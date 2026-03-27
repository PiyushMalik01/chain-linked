/**
 * Signup Page
 * @description User registration page with email/password
 * @module app/signup
 */

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { IconBrandGoogle, IconLoader2, IconUserPlus, IconSparkles } from '@tabler/icons-react'
import { toast } from 'sonner'

/**
 * Signup form component with email/password registration
 * @returns Signup form JSX
 */
function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

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

  /**
   * Validate password strength
   * @param pwd - Password to validate
   * @returns true if password meets requirements
   */
  const validatePassword = (pwd: string): boolean => {
    if (pwd.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return false
    }
    return true
  }

  const passwordStrength = getPasswordStrength(password)

  /**
   * Handle email/password signup
   */
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter your email and password')
      return
    }

    if (!validatePassword(password)) {
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      // Create user via server-side admin API (auto-confirmed, no email verification)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || email.split('@')[0] }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to create account')
        setIsLoading(false)
        return
      }

      // User created and auto-confirmed — sign in immediately
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('Auto sign-in error:', signInError)
        toast.error('Account created! Please sign in manually.')
        router.push('/login')
        return
      }

      toast.success('Account created successfully!')
      router.push(inviteToken ? `/onboarding?invite=${inviteToken}` : '/onboarding')
      router.refresh()
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  /**
   * Handle Google OAuth signup
   */
  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    const supabase = createClient()

    try {
      const callbackUrl = inviteToken
        ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(`/onboarding?invite=${inviteToken}`)}`
        : `${window.location.origin}/api/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('OAuth error:', error)
        toast.error('Failed to sign up with Google')
        setIsGoogleLoading(false)
      }
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('An unexpected error occurred')
      setIsGoogleLoading(false)
    }
  }

  return (
    <CardContent className="space-y-8 px-8 pb-8">
      {/* Email/Password Form */}
      <motion.form
        onSubmit={handleEmailSignup}
        className="space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            autoComplete="name"
            className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || isGoogleLoading}
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
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            autoComplete="new-password"
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
              <IconUserPlus className="mr-2 h-4 w-4" />
            )}
            Create Account
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
          onClick={handleGoogleSignup}
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

      {/* Login link */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
      >
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium transition-colors">
          Sign in
        </Link>
      </motion.p>

      <motion.p
        className="text-xs text-center text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      >
        By creating an account, you agree to our Terms of Service and Privacy Policy.
      </motion.p>
    </CardContent>
  )
}

/**
 * Signup form loading skeleton
 * @returns Loading skeleton JSX
 */
function SignupFormSkeleton() {
  return (
    <CardContent className="space-y-8 px-8 pb-8">
      <div className="space-y-5">
        <Skeleton className="w-full h-11" />
        <Skeleton className="w-full h-11" />
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
 * Signup page component
 * @returns Signup page JSX
 */
export default function SignupPage() {
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
                Create an account
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 400 }}
                >
                  <IconSparkles className="size-5 text-primary" />
                </motion.span>
              </CardTitle>
              <CardDescription className="mt-2">
                Get started with ChainLinked for your team
              </CardDescription>
            </motion.div>
          </CardHeader>
          <Suspense fallback={<SignupFormSkeleton />}>
            <SignupForm />
          </Suspense>
        </Card>
      </motion.div>
    </div>
  )
}
