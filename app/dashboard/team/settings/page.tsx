/**
 * Team Settings Redirect
 * @description Redirects to the main settings page with the team section active.
 * All team management is now consolidated in /dashboard/settings.
 * @module app/dashboard/team/settings
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Team Settings page redirect
 * @description Redirects users to /dashboard/settings?section=team
 * @returns null (redirects immediately)
 */
export default function TeamSettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/settings?section=team')
  }, [router])

  return null
}
