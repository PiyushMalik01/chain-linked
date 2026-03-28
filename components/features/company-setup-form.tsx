/**
 * Company Setup Form Component
 * @description Form for creating a new company during onboarding.
 * Detects duplicate companies and offers to send a join request instead.
 * @module components/features/company-setup-form
 */

'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  IconBuilding,
  IconCamera,
  IconCheck,
  IconLoader2,
  IconSend,
  IconUsers,
  IconX,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCompany, type CreateCompanyInput, type ExistingCompanyMatch } from '@/hooks/use-company'
import { useJoinRequests } from '@/hooks/use-join-requests'
import type { CompanyWithTeam } from '@/types/database'

/**
 * Props for the CompanySetupForm component
 */
export interface CompanySetupFormProps {
  /** Callback fired when company is created successfully */
  onComplete: (company: CompanyWithTeam) => void
  /** Callback fired when a join request is sent successfully */
  onJoinRequestSent?: () => void
  /** Callback fired when user chooses to skip (optional) */
  onSkip?: () => void
  /** Whether to show skip button */
  showSkip?: boolean
  /** Custom class name */
  className?: string
}

/**
 * Maximum file size for logo upload (2MB)
 */
const MAX_LOGO_SIZE = 2 * 1024 * 1024

/**
 * Allowed logo file types
 */
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

/**
 * Company Setup Form Component
 *
 * A form for creating a new company with name and optional logo.
 * Used during the onboarding flow when a user doesn't have a company yet.
 *
 * Features:
 * - Company name input with validation
 * - Logo upload with preview (drag & drop support)
 * - Auto-generated slug from company name
 * - Loading state during creation
 * - Error handling with user feedback
 *
 * @param props - Component props
 * @returns Company setup form JSX
 * @example
 * ```tsx
 * <CompanySetupForm
 *   onComplete={(company) => router.push('/onboarding/invite')}
 *   onSkip={() => router.push('/dashboard')}
 *   showSkip={false}
 * />
 * ```
 */
export function CompanySetupForm({
  onComplete,
  onJoinRequestSent,
  onSkip,
  showSkip = false,
  className,
}: CompanySetupFormProps) {
  const { createCompany, checkExistingCompany, isLoading: isCreating, error: createError } = useCompany()
  const { submitRequest } = useJoinRequests()

  // Form state
  const [companyName, setCompanyName] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // Duplicate company state
  const [existingMatch, setExistingMatch] = React.useState<ExistingCompanyMatch | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = React.useState(false)
  const [isSendingRequest, setIsSendingRequest] = React.useState(false)
  const [joinRequestSent, setJoinRequestSent] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  /**
   * Validate company name
   * @param name - Company name to validate
   * @returns Error message or null if valid
   */
  const validateCompanyName = (name: string): string | null => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return 'Company name is required'
    }
    if (trimmedName.length < 2) {
      return 'Company name must be at least 2 characters'
    }
    if (trimmedName.length > 100) {
      return 'Company name must be less than 100 characters'
    }
    return null
  }

  /**
   * Handle file selection for logo
   * @param file - Selected file
   */
  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setValidationError('Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)')
      return
    }

    // Validate file size
    if (file.size > MAX_LOGO_SIZE) {
      setValidationError('Logo must be less than 2MB')
      return
    }

    setValidationError(null)
    setLogoFile(file)

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setLogoUrl(previewUrl)

    // TODO: In production, upload to Supabase Storage here
    // For now, we just show the preview
    // setIsUploading(true)
    // const uploadedUrl = await uploadToStorage(file)
    // setLogoUrl(uploadedUrl)
    // setIsUploading(false)
  }

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Handle drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  /**
   * Handle drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  /**
   * Handle drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Remove selected logo
   */
  const handleRemoveLogo = () => {
    if (logoUrl) {
      URL.revokeObjectURL(logoUrl)
    }
    setLogoUrl(null)
    setLogoFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * Handle sending a join request to the existing company's team
   */
  const handleSendJoinRequest = async () => {
    if (!existingMatch?.team) return

    setIsSendingRequest(true)
    setValidationError(null)

    const request = await submitRequest(existingMatch.team.id)

    if (request) {
      setJoinRequestSent(true)
      onJoinRequestSent?.()
    }

    setIsSendingRequest(false)
  }

  /**
   * Reset duplicate state and allow creating a new company anyway
   */
  const handleCreateAnyway = async () => {
    setExistingMatch(null)

    const input: CreateCompanyInput = {
      name: companyName.trim(),
      logoUrl: logoUrl || undefined,
    }

    const company = await createCompany(input)

    if (company) {
      onComplete(company)
    }
  }

  /**
   * Handle form submission — checks for duplicate first
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate company name
    const nameError = validateCompanyName(companyName)
    if (nameError) {
      setValidationError(nameError)
      return
    }

    setValidationError(null)

    // Check for existing company with same name
    setIsCheckingDuplicate(true)
    const match = await checkExistingCompany(companyName.trim())
    setIsCheckingDuplicate(false)

    if (match) {
      // Company exists — show the duplicate state
      setExistingMatch(match)
      return
    }

    // No duplicate — create the company
    const input: CreateCompanyInput = {
      name: companyName.trim(),
      logoUrl: logoUrl || undefined,
    }

    const company = await createCompany(input)

    if (company) {
      onComplete(company)
    }
  }

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (logoUrl && logoFile) {
        URL.revokeObjectURL(logoUrl)
      }
    }
  }, [logoUrl, logoFile])

  const isSubmitting = isCreating || isUploading || isCheckingDuplicate
  const displayError = validationError || createError

  // If join request was sent successfully, show confirmation
  if (joinRequestSent && existingMatch) {
    return (
      <Card className={cn('w-full max-w-lg', className)}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
            <IconCheck className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Request Sent</CardTitle>
            <CardDescription className="mt-2">
              Your request to join <strong>{existingMatch.company.name}</strong> has been sent.
              The team admin will review your request and you&apos;ll be notified once approved.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {showSkip && onSkip && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onSkip}
              >
                Continue to Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // If a duplicate company was found, show the duplicate state
  if (existingMatch) {
    return (
      <Card className={cn('w-full max-w-lg', className)}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <IconUsers className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Company Already Exists</CardTitle>
            <CardDescription className="mt-2">
              A company named <strong>{existingMatch.company.name}</strong> is already on ChainLinked.
              {existingMatch.team
                ? ' You can send a request to join their team.'
                : ' However, they don\'t have a team set up yet.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Existing company info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                {existingMatch.company.logo_url ? (
                  <Image
                    src={existingMatch.company.logo_url}
                    alt={existingMatch.company.name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <IconBuilding className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{existingMatch.company.name}</p>
                {existingMatch.team && (
                  <p className="text-xs text-muted-foreground truncate">
                    Team: {existingMatch.team.name}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {displayError && (
              <p className="text-sm text-destructive" role="alert">
                {displayError}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-2">
              {existingMatch.team && (
                <Button
                  className="w-full h-11"
                  onClick={handleSendJoinRequest}
                  disabled={isSendingRequest}
                >
                  {isSendingRequest ? (
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <IconSend className="mr-2 h-4 w-4" />
                  )}
                  {isSendingRequest ? 'Sending Request...' : 'Send Join Request'}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCreateAnyway}
                disabled={isCreating}
              >
                {isCreating ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconBuilding className="mr-2 h-4 w-4" />
                )}
                {isCreating ? 'Creating...' : 'Create as New Company Anyway'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setExistingMatch(null)
                  setCompanyName('')
                }}
              >
                Go Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full max-w-lg', className)}>
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <IconBuilding className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Create your company</CardTitle>
          <CardDescription className="mt-2">
            Set up your company to start collaborating with your team
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name Input */}
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              type="text"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value)
                setValidationError(null)
              }}
              disabled={isSubmitting}
              autoComplete="organization"
              autoFocus
              className={cn(displayError && 'border-destructive')}
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Company Logo (optional)</Label>
            <div
              className={cn(
                'relative flex flex-col items-center justify-center gap-4 p-6 rounded-lg border-2 border-dashed transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                isSubmitting && 'opacity-50 pointer-events-none'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {logoUrl ? (
                <div className="relative">
                  <div className="relative size-24 rounded-lg overflow-hidden border bg-muted">
                    <Image
                      src={logoUrl}
                      alt="Company logo preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 size-6"
                    onClick={handleRemoveLogo}
                    disabled={isSubmitting}
                  >
                    <IconX className="size-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="size-16 rounded-lg bg-muted flex items-center justify-center">
                    <IconCamera className="size-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                    >
                      <IconCamera className="size-4" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Drag and drop or click to upload
                      <br />
                      PNG, JPG, GIF, WebP, or SVG (max 2MB)
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(',')}
                onChange={handleFileInputChange}
                className="sr-only"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Error Message */}
          {displayError && (
            <p className="text-sm text-destructive" role="alert">
              {displayError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isSubmitting || !companyName.trim()}
            >
              {isCheckingDuplicate ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isCreating ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconCheck className="mr-2 h-4 w-4" />
              )}
              {isCheckingDuplicate ? 'Checking...' : isCreating ? 'Creating...' : 'Create Company'}
            </Button>

            {showSkip && onSkip && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onSkip}
                disabled={isSubmitting}
              >
                Skip for now
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
