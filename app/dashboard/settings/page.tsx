"use client"

/**
 * Settings Page
 * @description Redesigned settings page with sidebar navigation, section cards,
 * and framer-motion transitions. Covers Profile, LinkedIn, Brand Kit / AI Context,
 * Team, Notifications, and Account sections.
 * @module app/dashboard/settings/page
 */

import * as React from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import {
  IconAlertCircle,
  IconBell,
  IconBrandLinkedin,
  IconBriefcase,
  IconBuilding,
  IconCamera,
  IconCheck,
  IconCloudCheck,
  IconDeviceDesktop,
  IconDownload,
  IconExternalLink,
  IconHash,
  IconKey,
  IconLink,
  IconLoader2,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMoon,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconRuler,
  IconSchool,
  IconSettings,
  IconShield,
  IconSun,
  IconTrash,
  IconUpload,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"

import type { BrandKit as SavedBrandKit } from "@/types/brand-kit"
import { trackSettingsChanged, trackLinkedInAction } from "@/lib/analytics"
import { ApiKeySettings } from "@/components/features/api-key-settings"
import { ChatGPTConnection } from "@/components/features/settings/chatgpt-connection"
import { LinkedInStatusBadge } from "@/components/features/linkedin-status-badge"
import { SettingsSkeleton } from "@/components/skeletons/page-skeletons"

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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

import { usePageMeta } from "@/lib/dashboard-context"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { useSettings } from "@/hooks/use-settings"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { CompanyContextEditor } from "@/components/features/company-context-editor"
import { ContentRulesEditor } from "@/components/features/content-rules-editor"
import { DefaultHashtagsEditor } from "@/components/features/default-hashtags-editor"
import { TeamManagement } from "@/components/features/team-management"
import { TeamSettingsPanel } from "@/components/features/team-settings-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTeam } from "@/hooks/use-team"

/* =============================================================================
   TYPES
   ============================================================================= */

/** Identifier for each settings section */
type SettingsSection =
  | "profile"
  | "linkedin"
  | "brand-kit"
  | "content-rules"
  | "team"
  | "notifications"
  | "account"

/** Navigation item displayed in the sidebar */
interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

/** Team member role type */
type TeamMemberRole = "owner" | "admin" | "member"

/** Notification preferences */
interface NotificationPreferences {
  emailNotifications: boolean
  postPublished: boolean
  postScheduled: boolean
  weeklyDigest: boolean
  teamActivity: boolean
  systemUpdates: boolean
}

/** Brand kit form state */
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

/* =============================================================================
   CONSTANTS
   ============================================================================= */

/** Sidebar navigation items for the settings page */
const NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: IconUser,
    description: "Personal information",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: IconBrandLinkedin,
    description: "Connection status",
  },
  {
    id: "brand-kit",
    label: "Brand Kit & AI",
    icon: IconPalette,
    description: "Colors, fonts, context",
  },
  {
    id: "content-rules",
    label: "Content Rules",
    icon: IconRuler,
    description: "AI writing guidelines",
  },
  {
    id: "team",
    label: "Team",
    icon: IconUsers,
    description: "Members & roles",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: IconBell,
    description: "Alert preferences",
  },
  {
    id: "account",
    label: "Account",
    icon: IconSettings,
    description: "Security & data",
  },
]

/** Animation for section content transitions */
const sectionVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
}

/* =============================================================================
   HELPERS
   ============================================================================= */


/**
 * Maps role to badge variant
 * @param role - Team member role
 * @returns Badge variant and display label
 */
function getRoleBadge(role: TeamMemberRole): {
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

/* =============================================================================
   TEAM SETTINGS SECTION
   ============================================================================= */

/**
 * Full team settings section with members, invitations, and team config
 * @description Replaces the placeholder team section with real team management
 * using TeamManagement and TeamSettingsPanel components in a tabbed layout.
 * @returns Team settings section JSX
 */
function TeamSettingsSection() {
  const {
    currentTeam,
    currentUserRole,
    updateTeam,
    refetchTeams,
  } = useTeam()

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  const handleUpdateTeamName = React.useCallback(async (name: string) => {
    if (!currentTeam) return
    await updateTeam(currentTeam.id, { name })
    await refetchTeams()
  }, [currentTeam, updateTeam, refetchTeams])

  const handleDeleteTeam = React.useCallback(async () => {
    if (!currentTeam) return
    const response = await fetch(`/api/teams?id=${currentTeam.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to delete team')
    }
    await refetchTeams()
  }, [currentTeam, refetchTeams])

  if (!currentTeam) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <IconUsers className="size-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium mb-1">No team yet</p>
            <p className="text-xs">Create or join a team from the Team Activity page to manage settings here.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="members">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="members" className="gap-2">
            <IconUsers className="size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <IconSettings className="size-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="max-w-2xl">
            <TeamSettingsPanel
              team={currentTeam}
              currentUserRole={currentUserRole}
              canManage={canManage}
              onUpdateTeamName={handleUpdateTeamName}
              onDeleteTeam={handleDeleteTeam}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* =============================================================================
   SUB-COMPONENTS
   ============================================================================= */

/**
 * Notification toggle row
 * @param props - Toggle props
 * @returns JSX element for a single notification toggle
 */
function NotificationToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
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

/**
 * Save status indicator pill
 * @param props.status - Current save status
 * @returns JSX element showing save progress or null when idle
 */
function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200",
        status === "saving" && "bg-muted text-muted-foreground",
        status === "saved" && "bg-primary/10 text-primary"
      )}
    >
      {status === "saving" ? (
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
  )
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

/**
 * Settings page content with sidebar navigation and section panels
 * @returns Full settings page JSX
 */
function SettingsContent() {
  const { profile, signOut, user: authUser, refreshProfile } = useAuthContext()
  const {
    user,
    linkedinConnected,
    linkedinProfile: rawLinkedinProfile,
    teamMembers,
    isLoading,
    error,
    refetch,
    updateProfile,
  } = useSettings()

  // Active section - support ?section= URL param for deep linking
  const searchParams = useSearchParams()

  // Refresh auth profile + settings when redirected back from LinkedIn OAuth
  const linkedinJustConnected = searchParams.get("linkedin_connected")
  React.useEffect(() => {
    if (linkedinJustConnected === "true") {
      refreshProfile()
      refetch()
    }
  }, [linkedinJustConnected, refreshProfile, refetch])
  const initialSection = (searchParams.get("section") as SettingsSection) || "profile"
  const [activeSection, setActiveSection] = React.useState<SettingsSection>(
    NAV_ITEMS.some(item => item.id === initialSection) ? initialSection : "profile"
  )

  // Profile state
  const [profileName, setProfileName] = React.useState("")
  const [profileEmail, setProfileEmail] = React.useState("")

  // LinkedIn state
  const [isRefreshingLinkedIn, setIsRefreshingLinkedIn] = React.useState(false)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const [cookieStatus, setCookieStatus] = React.useState<"valid" | "expired" | "missing">("missing")

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

  // Logo upload state
  const [logoUploading, setLogoUploading] = React.useState(false)
  const [logoUrlInput, setLogoUrlInput] = React.useState("")
  const logoFileRef = React.useRef<HTMLInputElement>(null)

  // Notifications state
  const [notifications, setNotifications] = React.useState<NotificationPreferences>({
    emailNotifications: true,
    postPublished: true,
    postScheduled: true,
    weeklyDigest: false,
    teamActivity: true,
    systemUpdates: true,
  })

  // Save state
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle")

  // Company context edit dialog state
  const [showCompanyDialog, setShowCompanyDialog] = React.useState(false)
  const [showCompanyContextEditor, setShowCompanyContextEditor] = React.useState(false)
  const [companyForm, setCompanyForm] = React.useState({
    companyName: "",
    companyWebsite: "",
    companyDescription: "",
    industry: "",
    targetAudience: "",
  })
  const [isLoadingCompanyContext, setIsLoadingCompanyContext] = React.useState(false)
  const [isSavingCompany, setIsSavingCompany] = React.useState(false)
  const [isReanalyzing, setIsReanalyzing] = React.useState(false)

  // Transform LinkedIn profile for display
  const linkedinProfile = React.useMemo(() => {
    if (!rawLinkedinProfile) return undefined
    const rawData = rawLinkedinProfile.raw_data as Record<string, unknown> | null
    return {
      name:
        (rawData?.name as string) ||
        (rawLinkedinProfile.first_name && rawLinkedinProfile.last_name
          ? `${rawLinkedinProfile.first_name} ${rawLinkedinProfile.last_name}`
          : rawLinkedinProfile.first_name || undefined),
      headline: rawLinkedinProfile.headline || (rawData?.headline as string | undefined),
      profileUrl:
        (rawData?.profileUrl as string | undefined) ||
        (rawLinkedinProfile.public_identifier
          ? `https://www.linkedin.com/in/${rawLinkedinProfile.public_identifier}`
          : undefined),
      location: rawLinkedinProfile.location || (rawData?.location as string | undefined),
      industry: rawLinkedinProfile.industry || (rawData?.industry as string | undefined),
      about: rawLinkedinProfile.summary || (rawData?.about as string | undefined),
      avatarUrl:
        rawLinkedinProfile.profile_picture_url ||
        (rawData?.profilePhotoUrl as string | undefined),
      backgroundImageUrl:
        rawLinkedinProfile.background_image_url ||
        (rawData?.backgroundPhotoUrl as string | undefined),
      followersCount: rawLinkedinProfile.followers_count ?? undefined,
      connectionsCount: rawLinkedinProfile.connections_count ?? undefined,
      currentCompany: rawData?.currentCompany as string | undefined,
      education: rawData?.education as string | undefined,
      lastSynced:
        rawLinkedinProfile.updated_at || rawLinkedinProfile.captured_at || undefined,
    }
  }, [rawLinkedinProfile])

  // Sync local state when data arrives
  React.useEffect(() => {
    if (user) {
      setProfileName(user.name)
      setProfileEmail(user.email)
    }
  }, [user])

  React.useEffect(() => {
    setCookieStatus(linkedinConnected ? "valid" : "missing")
  }, [linkedinConnected])

  // Fetch brand kit
  React.useEffect(() => {
    async function fetchBrandKit() {
      try {
        const res = await fetch("/api/brand-kit")
        if (!res.ok) {
          setBrandKitLoading(false)
          return
        }
        const data = await res.json()
        const kits: SavedBrandKit[] = data.brandKits || []
        const activeKit = kits.find((k) => k.isActive) || kits[0]
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
      } catch (err) {
        console.error("Failed to fetch brand kit:", err)
      } finally {
        setBrandKitLoading(false)
      }
    }
    fetchBrandKit()
  }, [])

  /** Handle LinkedIn OAuth connect / refresh */
  const handleConnectLinkedIn = () => {
    setIsRefreshingLinkedIn(true)
    trackLinkedInAction("connected")
    window.location.href = "/api/linkedin/connect"
  }

  /** Handle LinkedIn disconnect */
  const handleDisconnectLinkedIn = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/linkedin/disconnect", { method: "POST" })
      if (response.ok) {
        trackLinkedInAction("disconnected")
        setCookieStatus("missing")
        toast.success("LinkedIn account disconnected")
        await refetch()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error || "Failed to disconnect LinkedIn. Please try again.")
      }
    } catch (err) {
      console.error("Failed to disconnect LinkedIn:", err)
      toast.error("Failed to disconnect LinkedIn. Please try again.")
    } finally {
      setIsDisconnecting(false)
    }
  }

  /**
   * Handles logo file selection from the file picker
   * Validates file type and size, uploads to Supabase Storage, and updates brand kit state
   * @param e - File input change event
   */
  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be under 2MB.")
      return
    }

    setLogoUploading(true)
    try {
      const supabase = createClient()
      const userId = authUser?.id
      if (!userId) throw new Error("User not authenticated")

      const timestamp = Date.now()
      const filePath = `${userId}/${timestamp}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from("brand-logos")
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from("brand-logos")
        .getPublicUrl(filePath)

      setBrandKit((prev) => ({ ...prev, logoUrl: publicUrlData.publicUrl }))
    } catch (err) {
      console.error("Failed to upload logo:", err)
      toast.error("Failed to upload logo. Please try again.")
    } finally {
      setLogoUploading(false)
      if (logoFileRef.current) logoFileRef.current.value = ""
    }
  }

  /**
   * Applies a manually entered URL as the brand logo
   * Validates that the URL starts with http:// or https://
   */
  const handleLogoUrlApply = () => {
    const url = logoUrlInput.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Please enter a valid URL starting with http:// or https://")
      return
    }
    setBrandKit((prev) => ({ ...prev, logoUrl: url }))
    setLogoUrlInput("")
  }

  /** Generic save handler */
  const handleSave = async (section: string) => {
    setIsSaving(true)
    setSaveStatus("saving")
    try {
      switch (section) {
        case "profile":
          await updateProfile({ name: profileName, email: profileEmail })
          break
        case "brandKit": {
          if (!savedBrandKit?.id) break
          const res = await fetch("/api/brand-kit", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: savedBrandKit.id,
              primaryColor: brandKit.primaryColor,
              secondaryColor: brandKit.secondaryColor,
              accentColor: brandKit.accentColor,
              backgroundColor: brandKit.backgroundColor,
              textColor: brandKit.textColor,
              fontPrimary: brandKit.fontPrimary || null,
              fontSecondary: brandKit.fontSecondary || null,
              logoUrl: brandKit.logoUrl || null,
            }),
          })
          if (!res.ok) throw new Error("Failed to save brand kit")
          const data = await res.json()
          if (data.brandKit) setSavedBrandKit(data.brandKit)
          break
        }
        case "notifications":
          await new Promise((r) => setTimeout(r, 800))
          break
        default:
          await new Promise((r) => setTimeout(r, 800))
      }
      trackSettingsChanged(section)
      setSaveStatus("saved")
    } catch (err) {
      console.error(`Failed to save ${section}:`, err)
      setSaveStatus("idle")
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus("idle"), 3000)
    }
  }

  /**
   * Opens the company context edit dialog and loads existing data
   */
  const handleOpenCompanyDialog = React.useCallback(async () => {
    setShowCompanyDialog(true)
    setIsLoadingCompanyContext(true)

    // Pre-fill from profile
    setCompanyForm({
      companyName: profile?.company_name || "",
      companyWebsite: profile?.company_website || "",
      companyDescription: ((profile as unknown as Record<string, unknown>)?.company_description as string) || "",
      industry: "",
      targetAudience: "",
    })

    // Load full company context from database
    try {
      const supabase = createClient()
      const { data: ctx } = await supabase
        .from("company_context")
        .select("company_name, website_url, industry, target_audience_input, company_summary, value_proposition")
        .eq("user_id", authUser?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (ctx) {
        setCompanyForm({
          companyName: ctx.company_name || profile?.company_name || "",
          companyWebsite: ctx.website_url || profile?.company_website || "",
          companyDescription: ctx.company_summary || ctx.value_proposition || "",
          industry: ctx.industry || "",
          targetAudience: ctx.target_audience_input || "",
        })
      }
    } catch {
      // No company context found — keep profile defaults
    } finally {
      setIsLoadingCompanyContext(false)
    }
  }, [profile, authUser?.id])

  /**
   * Save company context changes to both the users table and company_context table
   */
  const handleSaveCompanyContext = React.useCallback(async () => {
    setIsSavingCompany(true)
    try {
      const supabase = createClient()

      // Update users profile
      await supabase
        .from("profiles")
        .update({
          company_name: companyForm.companyName,
          company_website: companyForm.companyWebsite,
        })
        .eq("id", authUser?.id ?? "")

      // Update company_context (upsert the most recent one)
      const { data: existing } = await supabase
        .from("company_context")
        .select("id")
        .eq("user_id", authUser?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from("company_context")
          .update({
            company_name: companyForm.companyName,
            website_url: companyForm.companyWebsite,
            company_summary: companyForm.companyDescription,
            industry: companyForm.industry,
            target_audience_input: companyForm.targetAudience,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      }

      // Refresh the profile in auth context
      await refetch()
      setShowCompanyDialog(false)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (err) {
      console.error("Failed to save company context:", err)
    } finally {
      setIsSavingCompany(false)
    }
  }, [companyForm, authUser?.id, refetch])

  /**
   * Re-analyze company website to refresh AI context
   * Triggers the same Inngest workflow used in onboarding
   */
  const handleReanalyze = React.useCallback(async () => {
    if (!companyForm.companyWebsite || !companyForm.companyName) return

    setIsReanalyzing(true)
    try {
      const res = await fetch("/api/company-context/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyForm.companyName,
          companyLink: companyForm.companyWebsite,
          industry: companyForm.industry,
          targetAudience: companyForm.targetAudience,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to start analysis")
      }

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/company-context/status")
          if (!statusRes.ok) return

          const data = await statusRes.json()
          if (data.status === "completed") {
            clearInterval(pollInterval)
            setIsReanalyzing(false)

            // Reload the context data into the form
            const supabase = createClient()
            const { data: ctx } = await supabase
              .from("company_context")
              .select("company_name, website_url, industry, target_audience_input, company_summary, value_proposition")
              .eq("user_id", authUser?.id ?? "")
              .order("updated_at", { ascending: false })
              .limit(1)
              .single()

            if (ctx) {
              setCompanyForm({
                companyName: ctx.company_name || "",
                companyWebsite: ctx.website_url || "",
                companyDescription: ctx.company_summary || ctx.value_proposition || "",
                industry: ctx.industry || "",
                targetAudience: ctx.target_audience_input || "",
              })
            }
            await refetch()
          } else if (data.status === "failed") {
            clearInterval(pollInterval)
            setIsReanalyzing(false)
          }
        } catch {
          // Continue polling
        }
      }, 3000)

      // Auto-stop polling after 5 min
      setTimeout(() => {
        clearInterval(pollInterval)
        setIsReanalyzing(false)
      }, 300_000)
    } catch (err) {
      console.error("Failed to re-analyze:", err)
      setIsReanalyzing(false)
    }
  }, [companyForm, authUser?.id, refetch])

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertCircle className="h-5 w-5" />
              <span>Failed to load settings: {error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <IconRefresh className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return <SettingsSkeleton />
  }

  /* ---------------------------------------------------------------------------
     SECTION RENDERERS
     --------------------------------------------------------------------------- */

  /** Profile section */
  const renderProfile = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your personal information and avatar</CardDescription>
          </div>
          <SaveIndicator status={saveStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
          <Avatar className="size-20 ring-2 ring-border/50 shadow-sm">
            {(user?.avatarUrl || linkedinProfile?.avatarUrl) ? (
              <AvatarImage
                src={user?.avatarUrl || linkedinProfile?.avatarUrl}
                alt={profileName}
              />
            ) : null}
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {getInitials(profileName || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            {(user?.avatarUrl || linkedinProfile?.avatarUrl) ? (
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
                <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
              </>
            )}
          </div>
        </div>

        {/* Headline from LinkedIn */}
        {(linkedinProfile?.headline || profile?.linkedin_headline) && (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
            <IconBriefcase className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">LinkedIn Headline</p>
              <p className="text-sm font-medium">
                {linkedinProfile?.headline || profile?.linkedin_headline}
              </p>
            </div>
          </div>
        )}

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

        {/* Save */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => handleSave("profile")} disabled={isSaving}>
            {isSaving ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  /** LinkedIn section */
  const renderLinkedIn = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>LinkedIn Connection</CardTitle>
              <CardDescription>
                Manage your LinkedIn account connection and authentication
              </CardDescription>
            </div>
            <SaveIndicator status={saveStatus} />
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
                  <Badge variant={linkedinConnected ? "default" : "destructive"}>
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
                  disabled={isDisconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {isDisconnecting ? (
                    <>
                      <IconLoader2 className="size-4 animate-spin mr-1" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* OAuth Status */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
            <div className="flex items-center gap-3">
              <IconKey className="size-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-sm">OAuth Token Status</p>
                <p className="text-xs text-muted-foreground">
                  Real-time connection and token validity
                </p>
              </div>
            </div>
            <LinkedInStatusBadge variant="badge" showReconnect />
          </div>

          {/* Permissions */}
          {linkedinConnected && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
              <IconKey className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Granted Permissions</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Post on your behalf &middot; Access profile info &middot; View connections & followers
                </p>
              </div>
            </div>
          )}

          {/* Profile card */}
          {linkedinConnected && linkedinProfile && (
            <div className="rounded-xl border border-border/50 overflow-hidden">
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
              <div className={cn("p-4", linkedinProfile.backgroundImageUrl && "-mt-10")}>
                <div className="flex items-start gap-4">
                  <Avatar className="size-20 border-4 border-background">
                    {linkedinProfile.avatarUrl ? (
                      <AvatarImage
                        src={linkedinProfile.avatarUrl}
                        alt={linkedinProfile.name || "Profile"}
                      />
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
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40">
                {[
                  { label: "Location", value: linkedinProfile.location, icon: IconMapPin },
                  { label: "Industry", value: linkedinProfile.industry, icon: IconBriefcase },
                  {
                    label: "Followers",
                    value: linkedinProfile.followersCount?.toLocaleString(),
                    icon: IconUsersGroup,
                  },
                  {
                    label: "Connections",
                    value: linkedinProfile.connectionsCount?.toLocaleString(),
                    icon: IconUsers,
                  },
                ]
                  .filter((s) => s.value)
                  .map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-2 p-3 bg-background"
                    >
                      <stat.icon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                        <p className="text-sm font-medium truncate">{stat.value}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cookie status */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center">
                <IconShield className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Authentication Cookie</p>
                <p className="text-sm text-muted-foreground">Required for posting to LinkedIn</p>
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
              {cookieStatus === "valid" ? "Valid" : cookieStatus === "expired" ? "Expired" : "Missing"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  /** Brand Kit / AI Context section */
  const renderBrandKit = () => (
    <div className="space-y-6">
      {/* API Keys */}
      <ApiKeySettings />

      {/* ChatGPT OAuth Connection */}
      <ChatGPTConnection />

      {/* Brand Kit */}
      {brandKitLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !savedBrandKit ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="size-16 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <IconPalette className="size-8 text-primary/60" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">No Brand Kit Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Extract your brand colors, fonts, and logo from your website to keep posts on-brand.
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Brand Kit</CardTitle>
                <CardDescription>
                  Customize brand colors, fonts, and logo for consistent posts
                </CardDescription>
              </div>
              <SaveIndicator status={saveStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source URL */}
            {brandKit.websiteUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLink className="size-4 shrink-0" />
                <span>Extracted from:</span>
                <a
                  href={
                    brandKit.websiteUrl.startsWith("http")
                      ? brandKit.websiteUrl
                      : `https://${brandKit.websiteUrl}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {brandKit.websiteUrl}
                  <IconExternalLink className="size-3" />
                </a>
              </div>
            )}

            {/* Colors */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Colors</Label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    { key: "primaryColor" as const, label: "Primary" },
                    { key: "secondaryColor" as const, label: "Secondary" },
                    { key: "accentColor" as const, label: "Accent" },
                    { key: "backgroundColor" as const, label: "Background" },
                    { key: "textColor" as const, label: "Text" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`brand-${key}`} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-9 rounded-lg border border-border/50 shadow-sm shrink-0 ring-1 ring-black/5"
                        style={{ backgroundColor: brandKit[key] }}
                      />
                      <Input
                        id={`brand-${key}`}
                        type="color"
                        value={brandKit[key]}
                        onChange={(e) =>
                          setBrandKit((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-9 w-14 p-0.5 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={brandKit[key]}
                        onChange={(e) =>
                          setBrandKit((prev) => ({ ...prev, [key]: e.target.value }))
                        }
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
                  <Label htmlFor="font-primary" className="text-xs text-muted-foreground">
                    Primary Font
                  </Label>
                  <Input
                    id="font-primary"
                    placeholder="e.g. Inter, Roboto"
                    value={brandKit.fontPrimary}
                    onChange={(e) =>
                      setBrandKit((prev) => ({ ...prev, fontPrimary: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="font-secondary" className="text-xs text-muted-foreground">
                    Secondary Font
                  </Label>
                  <Input
                    id="font-secondary"
                    placeholder="e.g. Georgia, Merriweather"
                    value={brandKit.fontSecondary}
                    onChange={(e) =>
                      setBrandKit((prev) => ({ ...prev, fontSecondary: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Brand Logo</Label>
              <div className="flex items-start gap-4">
                {/* Current logo preview */}
                <div className="size-20 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                  {brandKit.logoUrl ? (
                    <Image
                      src={brandKit.logoUrl}
                      alt="Brand logo"
                      width={80}
                      height={80}
                      className="size-full object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <IconPalette className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  {/* File upload */}
                  <div>
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconUpload className="size-4" />
                      )}
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, SVG, or JPG (max 2MB)
                    </p>
                  </div>
                  {/* URL input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or paste a logo URL..."
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoUrlApply}
                      disabled={!logoUrlInput.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                  {/* Remove logo */}
                  {brandKit.logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => {
                        setBrandKit((prev) => ({ ...prev, logoUrl: "" }))
                        setLogoUrlInput("")
                      }}
                    >
                      <IconTrash className="size-4" />
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Re-extract link — brand kit is editable inline above */}

            {/* Save */}
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

      {/* AI Context — full inline editor */}
      {showCompanyContextEditor ? (
        <CompanyContextEditor onClose={() => setShowCompanyContextEditor(false)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>AI Context</CardTitle>
            <CardDescription>
              Company information and tone settings used by AI to generate on-brand content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.company_name && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                <IconBuilding className="size-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="text-sm font-medium">{profile.company_name}</p>
                </div>
              </div>
            )}
            {profile?.company_website && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                <IconLink className="size-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a
                    href={
                      profile.company_website.startsWith("http")
                        ? profile.company_website
                        : `https://${profile.company_website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {profile.company_website}
                    <IconExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={() => setShowCompanyContextEditor(true)}>
              <IconSettings className="size-4" />
              Edit AI Context & Company Info
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )

  /** Team section - real team management with members, invitations, and settings */
  const renderTeam = () => (
    <TeamSettingsSection />
  )

  /** Notifications section */
  const renderNotifications = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose what notifications you want to receive</CardDescription>
          </div>
          <SaveIndicator status={saveStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
              <IconMail className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive notifications via email</p>
            </div>
          </div>
          <Switch
            checked={notifications.emailNotifications}
            onCheckedChange={(checked) =>
              setNotifications((prev) => ({ ...prev, emailNotifications: checked }))
            }
          />
        </div>

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

        {/* Save */}
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
  )

  /** Account section (appearance + danger zone) */
  const renderAccount = () => <AccountSection signOut={signOut} />

  /** Content Rules section */
  const renderContentRules = () => (
    <motion.div
      key="content-rules"
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconRuler className="size-4 text-primary" />
            Personal Content Rules
          </CardTitle>
          <CardDescription>
            Rules applied to all AI-generated content for your account. Toggle rules on or off without deleting them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentRulesEditor scope="personal" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHash className="size-4 text-primary" />
            Default Hashtags
          </CardTitle>
          <CardDescription>
            These hashtags will be available to add to all your posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultHashtagsEditor />
        </CardContent>
      </Card>
    </motion.div>
  )

  /** Map section id to render function */
  const sectionRenderers: Record<SettingsSection, () => React.ReactNode> = {
    profile: renderProfile,
    linkedin: renderLinkedIn,
    "brand-kit": renderBrandKit,
    "content-rules": renderContentRules,
    team: renderTeam,
    notifications: renderNotifications,
    account: renderAccount,
  }

  /* ---------------------------------------------------------------------------
     LAYOUT
     --------------------------------------------------------------------------- */

  return (
    <motion.div
      className="flex flex-col gap-4 p-4 md:gap-6 md:p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Mobile horizontal tabs */}
      <div className="md:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 min-w-max pb-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex gap-6">
        {/* Sidebar (hidden on mobile) */}
        <nav className="hidden md:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">{item.label}</p>
                    <p
                      className={cn(
                        "text-[11px] truncate",
                        isActive ? "text-primary/70" : "text-muted-foreground/60"
                      )}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {sectionRenderers[activeSection]()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* =============================================================================
   ACCOUNT SECTION (separate component for theme hook)
   ============================================================================= */

/**
 * Account section with appearance settings, session management, and danger zone
 * @param props.signOut - Sign out callback from auth context
 * @returns Account settings JSX
 */
function AccountSection({ signOut }: { signOut: () => Promise<void> }) {
  const { theme, setTheme } = useTheme()
  const { user } = useAuthContext()
  const [mounted, setMounted] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  /** Convert an array of objects to CSV string */
  const toCsv = (data: Record<string, unknown>[]): string => {
    if (data.length === 0) return ''
    const headers = Object.keys(data[0])
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h]
        const str = val === null || val === undefined ? '' : String(val)
        return `"${str.replace(/"/g, '""')}"`
      }).join(',')
    )
    return [headers.join(','), ...rows].join('\n')
  }

  /** Handle exporting user data as CSV */
  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const supabase = createClient()
      const userId = user?.id
      if (!userId) {
        toast.error("You must be logged in to export data")
        return
      }

      const [postsRes, analyticsRes, templatesRes, draftsRes] = await Promise.all([
        supabase.from('my_posts').select('*').eq('user_id', userId),
        supabase.from('post_analytics').select('*').eq('user_id', userId),
        supabase.from('templates').select('*').eq('user_id', userId),
        supabase.from('generated_posts').select('*').eq('user_id', userId).eq('status', 'draft'),
      ])

      const sections = [
        { name: 'Posts', data: postsRes.data || [] },
        { name: 'Analytics', data: analyticsRes.data || [] },
        { name: 'Templates', data: templatesRes.data || [] },
        { name: 'Drafts', data: draftsRes.data || [] },
      ]

      const csvParts = sections
        .filter((s) => s.data.length > 0)
        .map((s) => `--- ${s.name} ---\n${toCsv(s.data as Record<string, unknown>[])}`)

      const csvContent = csvParts.join('\n\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chainlinked-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch (err) {
      console.error("Export failed:", err)
      toast.error("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Handle account deletion with API call
   */
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete account")
      }

      // Redirect to login after successful deletion
      window.location.href = "/login"
    } catch (err) {
      console.error("Delete account error:", err)
      setIsDeletingAccount(false)
    }
  }

  const themeOptions = [
    { value: "light", label: "Light", description: "Classic light theme", icon: IconSun },
    { value: "dark", label: "Dark", description: "Easy on the eyes", icon: IconMoon },
    { value: "system", label: "System", description: "Match your device", icon: IconDeviceDesktop },
  ]

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how ChainLinked looks on your device</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mounted ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {themeOptions.map((option) => {
                const isSelected = theme === option.value
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={async (e) => {
                      if (document.startViewTransition) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = rect.left + rect.width / 2
                        const y = rect.top + rect.height / 2
                        const endRadius = Math.hypot(
                          Math.max(x, window.innerWidth - x),
                          Math.max(y, window.innerHeight - y)
                        )
                        const transition = document.startViewTransition(() => {
                          setTheme(option.value)
                        })
                        try {
                          await transition.ready
                          document.documentElement.animate(
                            {
                              clipPath: [
                                `circle(0px at ${x}px ${y}px)`,
                                `circle(${endRadius}px at ${x}px ${y}px)`,
                              ],
                            },
                            {
                              duration: 400,
                              easing: 'ease-in-out',
                              pseudoElement: '::view-transition-new(root)',
                            }
                          )
                        } catch {
                          // View transition API may not be fully supported
                        }
                      } else {
                        setTheme(option.value)
                      }
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
                      "hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 bg-card hover:bg-accent/50"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                          <IconCheck className="size-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
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
                    <div className="text-center">
                      <p className={cn("font-medium", isSelected && "text-primary")}>
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-xl border-2 border-border/50 bg-muted animate-pulse"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or manage your account data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
            <div className="flex items-center gap-3">
              <IconDownload className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Export Data</p>
                <p className="text-xs text-muted-foreground">
                  Download all your posts, analytics, and settings
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} disabled={isExporting}>
              {isExporting ? (
                <>
                  <IconLoader2 className="size-3.5 animate-spin mr-1" />
                  Exporting...
                </>
              ) : (
                "Export"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your account permanently
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
            <div className="flex items-center gap-3">
              <IconLogout className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Sign Out</p>
                <p className="text-xs text-muted-foreground">Sign out of your current session</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <IconTrash className="size-5 text-destructive" />
              <div>
                <p className="font-medium text-sm text-destructive">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              Delete
            </Button>
          </div>

          {/* Delete Account Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={(open) => {
            if (!isDeletingAccount) {
              setShowDeleteDialog(open)
              if (!open) setDeleteConfirmText("")
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                <DialogDescription>
                  This action is permanent and cannot be undone. All your data including
                  posts, analytics, teams, and settings will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono font-semibold">delete my account</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  disabled={isDeletingAccount}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteConfirmText("")
                  }}
                  disabled={isDeletingAccount}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "delete my account" || isDeletingAccount}
                >
                  {isDeletingAccount ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Permanently Delete"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

/* =============================================================================
   PAGE EXPORT
   ============================================================================= */

/**
 * Settings page component
 * @returns Settings page with sidebar navigation and comprehensive settings sections
 */
export default function SettingsPage() {
  usePageMeta({ title: "Settings" })
  return <SettingsContent />
}
