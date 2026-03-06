"use client"

/**
 * Onboarding Join Pending Page
 * @description Polling waiting screen shown after submitting a join request.
 * Auto-redirects to dashboard when the request is approved.
 * @module app/onboarding/join/pending/page
 */

import { Loader2 } from 'lucide-react'

import { PendingApprovalScreen } from '@/components/features/pending-approval-screen'
import { useJoinRequests } from '@/hooks/use-join-requests'

/**
 * Join pending page component
 * @returns Pending approval screen or loading state
 */
export default function JoinPendingPage() {
  const { myPendingRequest, isLoading, cancelRequest } = useJoinRequests()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!myPendingRequest) {
    // No pending request found - redirect handled by PendingApprovalScreen's poll
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <PendingApprovalScreen
        request={myPendingRequest}
        onCancel={cancelRequest}
      />
    </div>
  )
}
