/**
 * Settings Component
 * @description Comprehensive user settings panel with tabs for profile, account,
 * LinkedIn connection, team management, notifications, and appearance preferences.
 * @module components/features/settings
 */

"use client"

import Image from "next/image"

import * as React from "react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import {
  IconAlertCircle,
  IconBell,
  IconBrandLinkedin,
  IconBriefcase,
  IconBuilding,
  IconCamera,
  IconCheck,
  IconCloudCheck,
  IconCookie,
  IconDeviceDesktop,
  IconExternalLink,
  IconKey,
  IconLink,
  IconLoader2,
  IconMail,
  IconMapPin,
  IconMoon,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconSchool,
  IconSun,
  IconTrash,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"

import type { BrandKit as SavedBrandKit } from "@/types/brand-kit"
import { trackSettingsChanged, trackLinkedInAction } from "@/lib/analytics"
import { ApiKeySettings } from "@/components/features/api-key-settings"
import { LinkedInStatusBadge } from "@/components/features/linkedin-status-badge"

import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Team member role type
 */
type TeamMemberRole = "owner" | "admin" | "member"

/**
 * Team member data structure
 */
interface TeamMember {
  /** Unique identifier for the team member */
  id: string
  /** Display name of the team member */
  name: string
  /** Email address of the team member */
  email: string
  /** Role within the team */
  role: TeamMemberRole
  /** Optional avatar image URL */
  avatarUrl?: string
}

/**
 * User profile data structure
 */
interface UserProfile {
  /** User's display name */
  name: string
  /** User's email address */
  email: string
  /** Optional avatar image URL */
  avatarUrl?: string
}

/**
 * LinkedIn profile data structure for settings display
 */
export interface LinkedInProfileData {
  /** LinkedIn profile name */
  name?: string
  /** LinkedIn headline (job title) */
  headline?: string
  /** LinkedIn profile URL */
  profileUrl?: string
  /** Location */
  location?: string
  /** Industry */
  industry?: string
  /** About/Summary */
  about?: string
  /** Avatar URL */
  avatarUrl?: string
  /** Background image URL */
  backgroundImageUrl?: string
  /** Followers count */
  followersCount?: number
  /** Connections count */
  connectionsCount?: number
  /** Current company */
  currentCompany?: string
  /** Education */
  education?: string
  /** Last synced timestamp */
  lastSynced?: string
}

/**
 * Props for the Settings component
 */
export interface SettingsProps {
  /** Current user profile information */
  user?: UserProfile
  /** Whether LinkedIn account is connected */
  linkedinConnected?: boolean
  /** LinkedIn profile data for display */
  linkedinProfile?: LinkedInProfileData
  /** List of team members */
  teamMembers?: TeamMember[]
  /** Callback fired when settings are saved with the settings object */
  onSave?: (settings: Record<string, unknown>) => void
}

/**
 * Default user profile when none is provided
 */
const DEFAULT_USER: UserProfile = {
  name: "",
  email: "",
  avatarUrl: undefined,
}

/**
 * Default team members when none are provided
 */
const DEFAULT_TEAM_MEMBERS: TeamMember[] = []

/**
 * Notification preferences state structure
 */
interface NotificationPreferences {
  emailNotifications: boolean
  postPublished: boolean
  postScheduled: boolean
  weeklyDigest: boolean
  teamActivity: boolean
  systemUpdates: boolean
}

/**
 * Editable brand kit fields for local state
 */
interface BrandKitFormState {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  fontPrimary: string
  fontSecondary: string
  logoUrl: string
  websiteUrl: string
}

/**
 * Maps role to badge variant and display text
 * @param role - Team member role
 * @returns Object with variant and label
 */
function getRoleBadgeProps(role: TeamMemberRole): {
  variant: "default" | "secondary" | "outline"
  label: string
} {
  switch (role) {
    case "owner":
      return { variant: "default", label: "Owner" }
    case "admin":
      return { variant: "secondary", label: "Admin" }
    case "member":
      return { variant: "outline", label: "Member" }
  }
}

/**
 * A comprehensive settings screen with tabbed navigation for managing
 * user profile, LinkedIn connection, API keys, brand kit, team, and notifications.
 *
 * Features:
 * - 6 organized tabs for different setting categories
 * - Profile management with avatar upload placeholder
 * - LinkedIn connection status and refresh functionality
 * - Secure API key management with masked input
 * - Brand kit customization with color pickers
 * - Team member management with role assignment
 * - Notification toggle preferences
 *
 * @example
 * ```tsx
 * // Basic usage with defaults
 * <Settings />
 *
 * // With user data and callbacks
 * <Settings
 *   user={{
 *     name: "Jane Doe",
 *     email: "jane@example.com",
 *     avatarUrl: "/avatars/jane.jpg"
 *   }}
 *   linkedinConnected={true}
 *   teamMembers={[
 *     { id: "1", name: "Jane Doe", email: "jane@example.com", role: "owner" }
 *   ]}
 *   onSave={(settings) => console.log("Settings saved:", settings)}
 * />
 * ```
 */
export function Settings({
  user = DEFAULT_USER,
  linkedinConnected = false,
  linkedinProfile,
  teamMembers = DEFAULT_TEAM_MEMBERS,
  onSave,
}: SettingsProps) {
  // Profile state
  const [profileName, setProfileName] = React.useState(user.name)
  const [profileEmail, setProfileEmail] = React.useState(user.email)

  // LinkedIn state
  const [isRefreshingLinkedIn, setIsRefreshingLinkedIn] = React.useState(false)
  const [cookieStatus, setCookieStatus] = React.useState<"valid" | "expired" | "missing">(
    linkedinConnected ? "valid" : "missing"
  )

  // Brand Kit state
  const [savedBrandKit, setSavedBrandKit] = React.useState<SavedBrandKit | null>(null)
  const [brandKitLoading, setBrandKitLoading] = React.useState(true)
  const [brandKit, setBrandKit] = React.useState<BrandKitFormState>({
    primaryColor: "#0066cc",
    secondaryColor: "#4D94DB",
    accentColor: "#00A3E0",
    backgroundColor: "#FFFFFF",
    textColor: "#1A1A1A",
    fontPrimary: "",
    fontSecondary: "",
    logoUrl: "",
    websiteUrl: "",
  })

  // Team state
  const [members, setMembers] = React.useState<TeamMember[]>(teamMembers)

  // Notifications state
  const [notifications, setNotifications] = React.useState<NotificationPreferences>({
    emailNotifications: true,
    postPublished: true,
    postScheduled: true,
    weeklyDigest: false,
    teamActivity: true,
    systemUpdates: true,
  })

  // Saving state
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup save status timer on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Fetch saved brand kit on mount
  React.useEffect(() => {
    async function fetchBrandKit() {
      try {
        const res = await fetch('/api/brand-kit')
        if (!res.ok) {
          setBrandKitLoading(false)
          return
        }
        const data = await res.json()
        const kits: SavedBrandKit[] = data.brandKits || []
        const activeKit = kits.find(k => k.isActive) || kits[0]
        if (activeKit) {
          setSavedBrandKit(activeKit)
          setBrandKit({
            primaryColor: activeKit.primaryColor || "#0066cc",
            secondaryColor: activeKit.secondaryColor || "#4D94DB",
            accentColor: activeKit.accentColor || "#00A3E0",
            backgroundColor: activeKit.backgroundColor || "#FFFFFF",
            textColor: activeKit.textColor || "#1A1A1A",
            fontPrimary: activeKit.fontPrimary || "",
            fontSecondary: activeKit.fontSecondary || "",
            logoUrl: activeKit.logoUrl || "",
            websiteUrl: activeKit.websiteUrl || "",
          })
        }
      } catch (error) {
        console.error('Failed to fetch brand kit:', error)
      } finally {
        setBrandKitLoading(false)
      }
    }
    fetchBrandKit()
  }, [])

  /**
   * Handles connecting/refreshing the LinkedIn connection via OAuth
   */
  const handleConnectLinkedIn = () => {
    setIsRefreshingLinkedIn(true)
    trackLinkedInAction("connected")
    // Redirect to OAuth connect endpoint
    window.location.href = '/api/linkedin/connect'
  }

  /**
   * Handles disconnecting LinkedIn account
   */
  const handleDisconnectLinkedIn = async () => {
    try {
      const response = await fetch('/api/linkedin/disconnect', { method: 'POST' })
      if (response.ok) {
        trackLinkedInAction("disconnected")
        setCookieStatus("missing")
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to disconnect LinkedIn:', error)
    }
  }

  /**
   * Handles updating a team member's role
   */
  const handleUpdateRole = (memberId: string, newRole: TeamMemberRole) => {
    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, role: newRole } : member
      )
    )
  }

  /**
   * Handles saving all settings
   * @param section - The settings section being saved
   */
  const handleSave = async (section: string) => {
    setIsSaving(true)
    setSaveStatus('saving')

    const settings: Record<string, unknown> = {
      section,
      timestamp: new Date().toISOString(),
    }

    try {
      switch (section) {
        case "profile":
          settings.profile = { name: profileName, email: profileEmail }
          await new Promise((resolve) => setTimeout(resolve, 800))
          break
        case "linkedin":
          settings.linkedin = { connected: linkedinConnected, cookieStatus }
          await new Promise((resolve) => setTimeout(resolve, 800))
          break
        case "brandKit": {
          if (!savedBrandKit?.id) break
          const res = await fetch('/api/brand-kit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: savedBrandKit.id,
              primaryColor: brandKit.primaryColor,
              secondaryColor: brandKit.secondaryColor,
              accentColor: brandKit.accentColor,
              backgroundColor: brandKit.backgroundColor,
              textColor: brandKit.textColor,
              fontPrimary: brandKit.fontPrimary || null,
              fontSecondary: brandKit.fontSecondary || null,
            }),
          })
          if (!res.ok) throw new Error('Failed to save brand kit')
          const data = await res.json()
          if (data.brandKit) setSavedBrandKit(data.brandKit)
          settings.brandKit = brandKit
          break
        }
        case "team":
          settings.team = { members }
          await new Promise((resolve) => setTimeout(resolve, 800))
          break
        case "notifications":
          settings.notifications = notifications
          await new Promise((resolve) => setTimeout(resolve, 800))
          break
      }

      trackSettingsChanged(section)
      onSave?.(settings)
      setSaveStatus('saved')
    } catch (error) {
      console.error(`Failed to save ${section}:`, error)
      setSaveStatus('idle')
    } finally {
      setIsSaving(false)
      // Auto-hide the "Saved" indicator after 3 seconds
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
        saveTimerRef.current = null
      }, 3000)
    }
  }

  return (
    <motion.div
      className="w-full max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 mb-6 p-1">
          <TabsTrigger value="profile" className="gap-1.5 text-xs">
            <IconUser className="size-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="gap-1.5 text-xs">
            <IconBrandLinkedin className="size-3.5" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5 text-xs">
            <IconKey className="size-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="brand-kit" className="gap-1.5 text-xs">
            <IconPalette className="size-3.5" />
            Brand Kit
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs">
            <IconUsers className="size-3.5" />
            Team
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs">
            <IconBell className="size-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5 text-xs">
            <IconPalette className="size-3.5" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Profile Settings</CardTitle>
                  <CardDescription>
                    Manage your personal information and avatar
                  </CardDescription>
                </div>
                {saveStatus !== 'idle' && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
                    saveStatus === 'saving' && "bg-muted text-muted-foreground",
                    saveStatus === 'saved' && "bg-primary/10 text-primary"
                  )}>
                    {saveStatus === 'saving' ? (
                      <>
                        <IconLoader2 className="size-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <IconCloudCheck className="size-3" />
                        Saved
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
                <Avatar className="size-20 ring-2 ring-border/50 shadow-sm">
                  {(user.avatarUrl || linkedinProfile?.avatarUrl) ? (
                    <AvatarImage src={user.avatarUrl || linkedinProfile?.avatarUrl} alt={profileName} />
                  ) : null}
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(profileName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  {(user.avatarUrl || linkedinProfile?.avatarUrl) ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <IconBrandLinkedin className="size-4 text-[#0A66C2]" />
                      <span>Synced from LinkedIn</span>
                    </div>
                  ) : (
                    <>
                      <Button variant="outline" size="sm">
                        <IconCamera className="size-4" />
                        Upload Photo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG or GIF. Max size 2MB.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="profile-name">Display Name</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email Address</Label>
                <div className="relative">
                  <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSave("profile")} disabled={isSaving}>
                  {isSaving ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconCheck className="size-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LinkedIn Tab */}
        <TabsContent value="linkedin">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">LinkedIn Connection</CardTitle>
                  <CardDescription>
                    Manage your LinkedIn account connection and authentication
                  </CardDescription>
                </div>
                {saveStatus !== 'idle' && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
                    saveStatus === 'saving' && "bg-muted text-muted-foreground",
                    saveStatus === 'saved' && "bg-primary/10 text-primary"
                  )}>
                    {saveStatus === 'saving' ? (
                      <>
                        <IconLoader2 className="size-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <IconCloudCheck className="size-3" />
                        Saved
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-10 rounded-full flex items-center justify-center shadow-sm",
                      linkedinConnected ? "bg-[#0077b5]" : "bg-muted"
                    )}
                  >
                    <IconBrandLinkedin
                      className={cn(
                        "size-6",
                        linkedinConnected ? "text-white" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <p className="font-medium">LinkedIn Account</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={linkedinConnected ? "default" : "destructive"}
                      >
                        {linkedinConnected ? "Connected" : "Not Connected"}
                      </Badge>
                      {linkedinConnected && linkedinProfile?.lastSynced && (
                        <span className="text-xs text-muted-foreground">
                          since {new Date(linkedinProfile.lastSynced).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={linkedinConnected ? "outline" : "default"}
                    onClick={handleConnectLinkedIn}
                    disabled={isRefreshingLinkedIn}
                  >
                    {isRefreshingLinkedIn ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconRefresh className="size-4" />
                    )}
                    {linkedinConnected ? "Refresh" : "Connect"}
                  </Button>
                  {linkedinConnected && (
                    <Button
                      variant="ghost"
                      onClick={handleDisconnectLinkedIn}
                      className="text-destructive hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>

              {/* Live OAuth Status Badge */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <IconKey className="size-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">OAuth Token Status</p>
                    <p className="text-xs text-muted-foreground">
                      Real-time connection and token validity
                    </p>
                  </div>
                </div>
                <LinkedInStatusBadge variant="badge" showReconnect />
              </div>

              {/* Token Expiry Warning */}
              {linkedinConnected && linkedinProfile?.lastSynced && (() => {
                const lastSync = new Date(linkedinProfile.lastSynced)
                const now = new Date()
                const daysSinceSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24))
                const daysUntilExpiry = 60 - daysSinceSync

                if (daysSinceSync >= 60) {
                  return (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/50 bg-destructive/5">
                      <IconAlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-destructive">LinkedIn Token Expired</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your LinkedIn connection expired {daysSinceSync - 60} days ago. Please reconnect to continue posting.
                        </p>
                      </div>
                      <Button size="sm" onClick={handleConnectLinkedIn}>
                        Reconnect
                      </Button>
                    </div>
                  )
                } else if (daysUntilExpiry <= 7) {
                  return (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/50 bg-yellow-500/5">
                      <IconAlertCircle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-600">Token Expiring Soon</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your LinkedIn connection will expire in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. Refresh now to avoid interruption.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleConnectLinkedIn}>
                        Refresh
                      </Button>
                    </div>
                  )
                }
                return null
              })()}

              {/* Connection Permissions Info */}
              {linkedinConnected && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
                  <IconKey className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Granted Permissions</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      • Post on behalf of your account<br />
                      • Access basic profile information<br />
                      • View connection count and followers
                    </p>
                  </div>
                </div>
              )}

              {/* LinkedIn Profile Information */}
              {linkedinConnected && linkedinProfile && (
                <div className="space-y-4">
                  {/* Profile Header with Background */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Background Image */}
                    {linkedinProfile.backgroundImageUrl && (
                      <div className="h-24 relative">
                        <Image
                          src={linkedinProfile.backgroundImageUrl}
                          alt="Profile background"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    {/* Profile Info */}
                    <div className={cn("p-4", linkedinProfile.backgroundImageUrl && "-mt-10")}>
                      <div className="flex items-start gap-4">
                        <Avatar className={cn("size-20 border-4 border-background", linkedinProfile.backgroundImageUrl && "mt-0")}>
                          {linkedinProfile.avatarUrl ? (
                            <AvatarImage src={linkedinProfile.avatarUrl} alt={linkedinProfile.name || "Profile"} />
                          ) : null}
                          <AvatarFallback className="text-xl bg-primary/10 text-primary">
                            {getInitials(linkedinProfile.name || "LI")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 pt-2">
                          <h3 className="font-semibold text-lg">{linkedinProfile.name}</h3>
                          {linkedinProfile.headline && (
                            <p className="text-muted-foreground">{linkedinProfile.headline}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Location */}
                    {linkedinProfile.location && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-muted to-muted/50 p-2 shrink-0">
                          <IconMapPin className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p className="font-medium text-sm">{linkedinProfile.location}</p>
                        </div>
                      </div>
                    )}

                    {/* Industry */}
                    {linkedinProfile.industry && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-muted to-muted/50 p-2 shrink-0">
                          <IconBriefcase className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Industry</p>
                          <p className="font-medium text-sm">{linkedinProfile.industry}</p>
                        </div>
                      </div>
                    )}

                    {/* Current Company */}
                    {linkedinProfile.currentCompany && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-muted to-muted/50 p-2 shrink-0">
                          <IconBuilding className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Company</p>
                          <p className="font-medium text-sm">{linkedinProfile.currentCompany}</p>
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    {linkedinProfile.education && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-muted to-muted/50 p-2 shrink-0">
                          <IconSchool className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Education</p>
                          <p className="font-medium text-sm">{linkedinProfile.education}</p>
                        </div>
                      </div>
                    )}

                    {/* Followers */}
                    {linkedinProfile.followersCount !== undefined && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2 shrink-0">
                          <IconUsersGroup className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Followers</p>
                          <p className="font-medium text-sm">{linkedinProfile.followersCount.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {/* Connections */}
                    {linkedinProfile.connectionsCount !== undefined && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border transition-colors">
                        <div className="rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-500/5 p-2 shrink-0">
                          <IconUsers className="size-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Connections</p>
                          <p className="font-medium text-sm">{linkedinProfile.connectionsCount.toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* About Section */}
                  {linkedinProfile.about && (
                    <div className="p-4 rounded-xl border border-border/50">
                      <h4 className="font-medium text-sm mb-2">About</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed">
                        {linkedinProfile.about}
                      </p>
                    </div>
                  )}

                  {/* Profile URL */}
                  {linkedinProfile.profileUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                      <IconLink className="size-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">LinkedIn URL</p>
                        <a
                          href={linkedinProfile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline truncate block"
                        >
                          {linkedinProfile.profileUrl}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Last Synced */}
                  {linkedinProfile.lastSynced && (
                    <p className="text-xs text-muted-foreground text-right">
                      Last synced: {new Date(linkedinProfile.lastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Cookie Status */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center">
                    <IconCookie className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Authentication Cookie</p>
                    <p className="text-sm text-muted-foreground">
                      Required for posting to LinkedIn
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    cookieStatus === "valid"
                      ? "default"
                      : cookieStatus === "expired"
                      ? "secondary"
                      : "destructive"
                  }
                  className={cn(cookieStatus === "valid" && "bg-green-600 hover:bg-green-600")}
                >
                  {cookieStatus === "valid"
                    ? "Valid"
                    : cookieStatus === "expired"
                    ? "Expired"
                    : "Missing"}
                </Badge>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSave("linkedin")} disabled={isSaving}>
                  {isSaving ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconCheck className="size-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <ApiKeySettings
            onSave={() => onSave?.({ section: "apiKeys", apiKeyConfigured: true })}
            onDelete={() => onSave?.({ section: "apiKeys", apiKeyConfigured: false })}
          />
        </TabsContent>

        {/* Brand Kit Tab */}
        <TabsContent value="brand-kit">
          {brandKitLoading ? (
            <Card className="border-border/50">
              <CardContent className="flex items-center justify-center py-16">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : !savedBrandKit ? (
            /* Empty state — no brand kit saved yet */
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="size-16 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                  <IconPalette className="size-8 text-primary/60" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">No Brand Kit Found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Extract your brand colors, fonts, and logo from your website to keep your LinkedIn posts on-brand.
                  </p>
                </div>
                <Button asChild>
                  <a href="/onboarding/step3">
                    <IconPalette className="size-4" />
                    Extract Brand Kit
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Brand Kit</CardTitle>
                    <CardDescription>
                      Customize your brand colors, fonts, and logo for consistent posts
                    </CardDescription>
                  </div>
                  {saveStatus !== 'idle' && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
                      saveStatus === 'saving' && "bg-muted text-muted-foreground",
                      saveStatus === 'saved' && "bg-primary/10 text-primary"
                    )}>
                      {saveStatus === 'saving' ? (
                        <>
                          <IconLoader2 className="size-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <IconCloudCheck className="size-3" />
                          Saved
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Source URL */}
                {brandKit.websiteUrl && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconLink className="size-4 shrink-0" />
                    <span>Extracted from:</span>
                    <a
                      href={brandKit.websiteUrl.startsWith('http') ? brandKit.websiteUrl : `https://${brandKit.websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {brandKit.websiteUrl}
                      <IconExternalLink className="size-3" />
                    </a>
                  </div>
                )}

                {/* All 5 Color Pickers */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Colors</Label>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      { key: 'primaryColor' as const, label: 'Primary' },
                      { key: 'secondaryColor' as const, label: 'Secondary' },
                      { key: 'accentColor' as const, label: 'Accent' },
                      { key: 'backgroundColor' as const, label: 'Background' },
                      { key: 'textColor' as const, label: 'Text' },
                    ]).map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`brand-${key}`} className="text-xs text-muted-foreground">{label}</Label>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-9 rounded-lg border border-border/50 shadow-sm shrink-0 ring-1 ring-black/5"
                            style={{ backgroundColor: brandKit[key] }}
                          />
                          <Input
                            id={`brand-${key}`}
                            type="color"
                            value={brandKit[key]}
                            onChange={(e) => setBrandKit(prev => ({ ...prev, [key]: e.target.value }))}
                            className="h-9 w-14 p-0.5 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={brandKit[key]}
                            onChange={(e) => setBrandKit(prev => ({ ...prev, [key]: e.target.value }))}
                            className="flex-1 font-mono uppercase text-xs h-9"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Typography</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="font-primary" className="text-xs text-muted-foreground">Primary Font</Label>
                      <Input
                        id="font-primary"
                        placeholder="e.g. Inter, Roboto"
                        value={brandKit.fontPrimary}
                        onChange={(e) => setBrandKit(prev => ({ ...prev, fontPrimary: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="font-secondary" className="text-xs text-muted-foreground">Secondary Font</Label>
                      <Input
                        id="font-secondary"
                        placeholder="e.g. Georgia, Merriweather"
                        value={brandKit.fontSecondary}
                        onChange={(e) => setBrandKit(prev => ({ ...prev, fontSecondary: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Logo */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Brand Logo</Label>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-border/50">
                    {brandKit.logoUrl ? (
                      <Image
                        src={brandKit.logoUrl}
                        alt="Brand logo"
                        width={64}
                        height={64}
                        className="size-16 object-contain rounded"
                        unoptimized
                      />
                    ) : (
                      <div className="size-16 rounded bg-muted flex items-center justify-center">
                        <IconPalette className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-1">
                      {brandKit.logoUrl ? (
                        <p className="text-sm text-muted-foreground">
                          Logo extracted from your website
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No logo was detected during extraction
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Preview</Label>
                  <div
                    className="p-5 rounded-xl border border-border/50 overflow-hidden shadow-sm"
                    style={{ backgroundColor: brandKit.backgroundColor, color: brandKit.textColor }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {brandKit.logoUrl && (
                          <Image
                            src={brandKit.logoUrl}
                            alt="Logo"
                            width={28}
                            height={28}
                            className="size-7 object-contain rounded"
                            unoptimized
                          />
                        )}
                        <span
                          className="font-semibold text-sm"
                          style={{ fontFamily: brandKit.fontPrimary || undefined }}
                        >
                          Sample Post Header
                        </span>
                      </div>
                      <p
                        className="text-sm opacity-80"
                        style={{ fontFamily: brandKit.fontSecondary || brandKit.fontPrimary || undefined }}
                      >
                        This is how your brand colors and typography will look in generated content.
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <div
                          className="h-9 px-4 rounded-md flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: brandKit.primaryColor }}
                        >
                          Primary
                        </div>
                        <div
                          className="h-9 px-4 rounded-md flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: brandKit.secondaryColor }}
                        >
                          Secondary
                        </div>
                        <div
                          className="h-9 px-4 rounded-md flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: brandKit.accentColor }}
                        >
                          Accent
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Re-extract link */}
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="ghost" size="sm" asChild>
                    <a href="/onboarding/step3">
                      <IconRefresh className="size-4" />
                      Re-extract from website
                    </a>
                  </Button>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => handleSave("brandKit")} disabled={isSaving}>
                    {isSaving ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconCheck className="size-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Members</CardTitle>
                <CardDescription>Manage your team and their permissions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus !== 'idle' && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
                    saveStatus === 'saving' && "bg-muted text-muted-foreground",
                    saveStatus === 'saved' && "bg-primary/10 text-primary"
                  )}>
                    {saveStatus === 'saving' ? (
                      <>
                        <IconLoader2 className="size-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <IconCloudCheck className="size-3" />
                        Saved
                      </>
                    )}
                  </div>
                )}
                <Button>
                  <IconPlus className="size-4" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Team Members List */}
              {members.map((member) => {
                const { variant, label } = getRoleBadgeProps(member.role)
                const isOwner = member.role === "owner"

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {member.avatarUrl ? (
                          <AvatarImage src={member.avatarUrl} alt={member.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOwner ? (
                        <Badge variant={variant}>{label}</Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(value: TeamMemberRole) =>
                            handleUpdateRole(member.id, value)
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {!isOwner && (
                        <Button variant="ghost" size="icon-sm">
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSave("team")} disabled={isSaving}>
                  {isSaving ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconCheck className="size-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose what notifications you want to receive
                  </CardDescription>
                </div>
                {saveStatus !== 'idle' && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
                    saveStatus === 'saving' && "bg-muted text-muted-foreground",
                    saveStatus === 'saved' && "bg-primary/10 text-primary"
                  )}>
                    {saveStatus === 'saving' ? (
                      <>
                        <IconLoader2 className="size-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <IconCloudCheck className="size-3" />
                        Saved
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications Master Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconMail className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, emailNotifications: checked }))
                  }
                />
              </div>

              {/* Individual Notification Toggles */}
              <div className="space-y-4">
                <NotificationToggle
                  title="Post Published"
                  description="Get notified when your post is published to LinkedIn"
                  checked={notifications.postPublished}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, postPublished: checked }))
                  }
                  disabled={!notifications.emailNotifications}
                />

                <NotificationToggle
                  title="Post Scheduled"
                  description="Get notified when a post is scheduled"
                  checked={notifications.postScheduled}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, postScheduled: checked }))
                  }
                  disabled={!notifications.emailNotifications}
                />

                <NotificationToggle
                  title="Weekly Digest"
                  description="Receive a weekly summary of your post performance"
                  checked={notifications.weeklyDigest}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, weeklyDigest: checked }))
                  }
                  disabled={!notifications.emailNotifications}
                />

                <NotificationToggle
                  title="Team Activity"
                  description="Get notified about team member actions"
                  checked={notifications.teamActivity}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, teamActivity: checked }))
                  }
                  disabled={!notifications.emailNotifications}
                />

                <NotificationToggle
                  title="System Updates"
                  description="Receive updates about new features and improvements"
                  checked={notifications.systemUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({ ...prev, systemUpdates: checked }))
                  }
                  disabled={!notifications.emailNotifications}
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSave("notifications")} disabled={isSaving}>
                  {isSaving ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconCheck className="size-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

/**
 * Appearance settings component with theme selection
 */
function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      description: "Classic light theme",
      icon: IconSun,
    },
    {
      value: "dark",
      label: "Dark",
      description: "Easy on the eyes",
      icon: IconMoon,
    },
    {
      value: "system",
      label: "System",
      description: "Match your device",
      icon: IconDeviceDesktop,
    },
  ]

  if (!mounted) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconPalette className="size-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how ChainLinked looks on your device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border-2 border-border/50 bg-muted animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <IconPalette className="size-5" />
          Appearance
        </CardTitle>
        <CardDescription>
          Customize how ChainLinked looks on your device
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Theme</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const isSelected = theme === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
                    "hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 bg-card hover:bg-accent/50"
                  )}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                        <IconCheck className="size-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "p-3 rounded-full transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-6" />
                  </div>

                  {/* Label and description */}
                  <div className="text-center">
                    <p className={cn(
                      "font-medium",
                      isSelected && "text-primary"
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Color Accent Preview */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-medium">Color Palette</Label>
          <p className="text-sm text-muted-foreground">
            ChainLinked uses a carefully crafted Sage Green & Terracotta color palette.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary shadow-sm" />
              <span className="text-sm">Sage Green (Primary)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-secondary shadow-sm" />
              <span className="text-sm">Terracotta (Secondary)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-accent shadow-sm" />
              <span className="text-sm">Accent</span>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-medium">Preview</Label>
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 dark:to-primary/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                <IconUser className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Sample Post Preview</p>
                <p className="text-xs text-muted-foreground">This is how your content looks</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Your theme preference will be applied across the entire application,
              including all dashboards, analytics views, and content editors.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">Leadership</Badge>
              <Badge variant="outline">85% engagement</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Props for the NotificationToggle component
 */
interface NotificationToggleProps {
  /** Title of the notification setting */
  title: string
  /** Description of what the notification does */
  description: string
  /** Whether the toggle is checked */
  checked: boolean
  /** Callback when the toggle changes */
  onCheckedChange: (checked: boolean) => void
  /** Whether the toggle is disabled */
  disabled?: boolean
}

/**
 * A reusable notification toggle row component
 */
function NotificationToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: NotificationToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3.5 px-1 border-b border-border/40 last:border-b-0 transition-opacity",
        disabled && "opacity-40"
      )}
    >
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
