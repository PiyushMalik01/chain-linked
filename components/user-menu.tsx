/**
 * User Menu Component
 * @description Dropdown menu showing user info with logout option
 * @module components/user-menu
 */

'use client'

import { useAuthContext } from '@/lib/auth/auth-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLogout, IconSettings, IconUser, IconMoon, IconSun } from '@tabler/icons-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { getInitials } from '@/lib/utils'

/**
 * User Menu component with avatar and dropdown
 * @returns User menu JSX or login button if not authenticated
 */
export function UserMenu() {
  const { user, profile, isLoading, isAuthenticated, signOut } = useAuthContext()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  if (!isAuthenticated || !user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Sign In</Link>
      </Button>
    )
  }

  const displayName = profile?.name || user.user_metadata?.full_name || user.email
  const avatarUrl = profile?.linkedin_profile?.profile_picture_url
    || profile?.linkedin_avatar_url
    || profile?.avatar_url
    || user.user_metadata?.avatar_url
  const isDark = mounted && theme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} alt={displayName || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(profile?.name || user.email || 'U')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer">
            <IconUser className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer">
            <IconSettings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? (
            <>
              <IconSun className="mr-2 h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <IconMoon className="mr-2 h-4 w-4" />
              Dark Mode
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => signOut()}
        >
          <IconLogout className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
