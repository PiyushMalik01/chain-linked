/**
 * App Sidebar Component
 * @description Main navigation sidebar for the ChainLinked application
 * Clean minimal design with collapsible sections and tree connectors
 * @module components/app-sidebar
 */

"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconArticle,
  IconBulb,
  IconChartBar,
  IconChevronRight,
  IconDashboard,
  IconPencil,
  IconPresentation,
  IconTemplate,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"
// LinkedInStatusBadge removed from sidebar — status is shown in settings page

// ============================================================================
// Animation Configuration
// ============================================================================

const smoothEase = [0.16, 1, 0.3, 1] as const

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  title: string
  url: string
  icon: Icon
  exact?: boolean
  /** Key matching sidebar_sections table for visibility control */
  sectionKey: string
}

interface SidebarSection {
  key: string
  enabled: boolean
  sort_order: number
}

// Simple in-memory cache for sidebar sections
let sectionsCache: { data: SidebarSection[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchSidebarSections(): Promise<SidebarSection[]> {
  if (sectionsCache && Date.now() - sectionsCache.timestamp < CACHE_TTL) {
    return sectionsCache.data
  }

  try {
    const supabase = createClient()
    // Cast needed: sidebar_sections table may not be in generated types yet
    const { data, error } = await (supabase as any)
      .from("sidebar_sections")
      .select("key, enabled, sort_order")
      .order("sort_order") as { data: SidebarSection[] | null; error: any }

    if (error || !data) return []

    sectionsCache = { data, timestamp: Date.now() }
    return data
  } catch {
    return []
  }
}

// ============================================================================
// Navigation Configuration
// ============================================================================

const allNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
    exact: true,
    sectionKey: "dashboard",
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: IconChartBar,
    sectionKey: "analytics",
  },
  {
    title: "Team Activity",
    url: "/dashboard/team",
    icon: IconUsers,
    sectionKey: "team_activity",
  },
  {
    title: "Saved Drafts",
    url: "/dashboard/drafts",
    icon: IconArticle,
    sectionKey: "saved_drafts",
  },
  {
    title: "Inspiration",
    url: "/dashboard/inspiration",
    icon: IconBulb,
    sectionKey: "inspiration",
  },
  {
    title: "Create Carousel",
    url: "/dashboard/carousels",
    icon: IconPresentation,
    sectionKey: "create_carousel",
  },
  {
    title: "Template Library",
    url: "/dashboard/templates",
    icon: IconTemplate,
    sectionKey: "template_library",
  },
]

/** Keys that belong to the Overview group */
const overviewKeys = new Set(["dashboard", "analytics", "team_activity"])
/** Keys that belong to the Content group */
const contentKeys = new Set(["saved_drafts", "inspiration", "create_carousel", "template_library"])

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChainLinked Application Sidebar Component
 *
 * Clean minimal design with:
 * - Collapsible sections with smooth animations
 * - Tree connector lines showing hierarchy
 * - Compact layout for better navigation
 *
 * @param props - Standard React component props extending Sidebar component props
 * @returns The rendered sidebar component with full navigation structure
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, profile, signOut, isLoading } = useAuthContext()
  const pathname = usePathname()

  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    content: true,
  })

  // Prevent hydration mismatch with Radix IDs
  const [mounted, setMounted] = useState(false)

  // Sidebar sections from database — controls visibility and sort order
  const [sidebarSections, setSidebarSections] = useState<SidebarSection[]>([])

  useEffect(() => {
    setMounted(true)
    // Fetch sidebar sections on mount
    fetchSidebarSections().then(setSidebarSections)
  }, [])

  /**
   * Filter and sort nav items based on sidebar_sections config.
   * If no sections are loaded yet (first render or fetch failure), show all items.
   */
  const getVisibleItems = (groupKeys: Set<string>): NavItem[] => {
    const groupItems = allNavItems.filter((item) => groupKeys.has(item.sectionKey))

    // If sections haven't loaded, show all items in default order
    if (sidebarSections.length === 0) return groupItems

    // Build a lookup of enabled sections with their sort_order
    const sectionMap = new Map(
      sidebarSections.map((s) => [s.key, s])
    )

    return groupItems
      .filter((item) => {
        const section = sectionMap.get(item.sectionKey)
        // If no matching section in DB, show item by default
        return section ? section.enabled : true
      })
      .sort((a, b) => {
        const aOrder = sectionMap.get(a.sectionKey)?.sort_order ?? 999
        const bOrder = sectionMap.get(b.sectionKey)?.sort_order ?? 999
        return aOrder - bOrder
      })
  }

  const overviewNavItems = getVisibleItems(overviewKeys)
  const contentNavItems = getVisibleItems(contentKeys)

  // Auto-open sections based on current path
  useEffect(() => {
    if (pathname === '/dashboard' ||
        pathname?.includes('/dashboard/analytics') ||
        pathname?.includes('/dashboard/team')) {
      setOpenSections(prev => ({ ...prev, overview: true }))
    }
    if (pathname?.includes('/dashboard/drafts') ||
        pathname?.includes('/dashboard/templates') ||
        pathname?.includes('/dashboard/inspiration') ||
        pathname?.includes('/dashboard/carousels')) {
      setOpenSections(prev => ({ ...prev, content: true }))
    }
  }, [pathname])

  /**
   * Check if a path is currently active
   */
  const isActive = (path: string, exact = false) => {
    if (exact) return pathname === path
    return pathname?.startsWith(path)
  }

  /**
   * Toggle a collapsible section
   */
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  /**
   * Derive user display data from auth context.
   * Handles multiple data sources: LinkedIn profile (extension sync),
   * profiles table, and Supabase auth metadata.
   */
  const userData = useMemo(() => {
    if (!user) {
      return {
        name: "Guest",
        email: "",
        avatar: "",
        headline: undefined,
      }
    }

    // Name: prioritize LinkedIn profile → profiles table → auth metadata
    const linkedInFirstLast = profile?.linkedin_profile?.first_name && profile?.linkedin_profile?.last_name
      ? `${profile.linkedin_profile.first_name} ${profile.linkedin_profile.last_name}`
      : null
    const linkedInRawName = profile?.linkedin_profile?.raw_data?.full_name ||
                            profile?.linkedin_profile?.raw_data?.name
    const profileFullName = profile?.full_name
    const profileName = profile?.name
    const metadataName = user.user_metadata?.name || user.user_metadata?.full_name
    const emailName = user.email?.split('@')[0] || 'User'

    const name = linkedInFirstLast || linkedInRawName || profileFullName || profileName || metadataName || emailName

    // Avatar: prioritize LinkedIn profile_picture_url → profiles table → auth metadata
    const linkedInAvatar = profile?.linkedin_profile?.profile_picture_url ||
                          profile?.linkedin_profile?.raw_data?.profilePhotoUrl ||
                          profile?.linkedin_avatar_url
    const profileAvatar = profile?.avatar_url
    const metadataAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture

    const avatar = linkedInAvatar || profileAvatar || metadataAvatar || ""

    // Headline: prioritize linkedin_profiles column → raw_data → profiles table
    const headline = profile?.linkedin_profile?.headline ||
                     profile?.linkedin_profile?.raw_data?.headline ||
                     profile?.linkedin_headline

    return {
      name: name as string,
      email: user.email || "",
      avatar: avatar as string,
      headline: headline as string | undefined,
    }
  }, [user, profile])

  // ============================================================================
  // Nav Link Components
  // ============================================================================

  /**
   * Sub-navigation link with tree connectors
   */
  const SubNavLink = ({ item, isLast }: { item: NavItem; isLast: boolean }) => {
    const active = isActive(item.url, item.exact)

    return (
      <div className="relative">
        {/* Tree connector lines */}
        <div className={cn(
          "absolute left-[11px] top-0 w-px",
          isLast ? "h-[14px]" : "h-full",
          active ? "bg-primary/40" : "bg-border"
        )} />
        <div className={cn(
          "absolute left-[11px] top-[14px] w-2 h-px",
          active ? "bg-primary/40" : "bg-border"
        )} />

        <Link
          href={item.url}
          className={cn(
            "block pl-6 pr-2.5 py-1 text-sm transition-colors duration-150 rounded-md mx-0.5",
            active
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground font-normal"
          )}
        >
          {item.title}
        </Link>
      </div>
    )
  }

  /**
   * Section header with collapse control
   */
  const SectionHeader = ({
    label,
    isOpen,
  }: {
    label: string
    isOpen: boolean
  }) => (
    <CollapsibleTrigger
      className="flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-150"
    >
      <span className="flex-1 text-left">{label}</span>
      <IconChevronRight
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-90"
        )}
      />
    </CollapsibleTrigger>
  )

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Sidebar Header - Company Branding */}
      <SidebarHeader className="px-3 py-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <Image src="/logo.png" alt="ChainLinked" width={20} height={20} className="size-5 rounded-sm object-contain" />
                <span className="text-base font-semibold">ChainLinked</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Create Post Button */}
      <div className="px-3 pt-2 pb-1" data-tour="quick-create">
        <Button asChild className="w-full gap-2" size="sm">
          <Link href="/dashboard/compose">
            <IconPencil className="size-4" />
            Create Post
          </Link>
        </Button>
      </div>

      {/* Sidebar Content - Navigation Groups */}
      <SidebarContent className="px-2 py-2">
        {/* Overview Section - Collapsible */}
        {mounted ? (
          <Collapsible
            open={openSections.overview}
            onOpenChange={() => toggleSection('overview')}
            data-tour="sidebar-overview"
          >
            <SectionHeader
              label="Overview"
              isOpen={openSections.overview}
            />
            <AnimatePresence initial={false}>
              {openSections.overview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: smoothEase }}
                  className="overflow-hidden mt-1 ml-1"
                >
                  {overviewNavItems.map((item, idx) => (
                    <SubNavLink
                      key={item.url}
                      item={item}
                      isLast={idx === overviewNavItems.length - 1}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        ) : (
          /* Static server-side render to prevent hydration mismatch */
          <div>
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Overview</span>
              <IconChevronRight className="ml-auto size-3.5" />
            </div>
            <div className="mt-1 ml-1">
              {overviewNavItems.map((item, idx) => (
                <SubNavLink key={item.url} item={item} isLast={idx === overviewNavItems.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* Content Section - Collapsible */}
        {mounted ? (
          <Collapsible
            open={openSections.content}
            onOpenChange={() => toggleSection('content')}
            data-tour="sidebar-content"
          >
            <SectionHeader
              label="Content"
              isOpen={openSections.content}
            />
            <AnimatePresence initial={false}>
              {openSections.content && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: smoothEase }}
                  className="overflow-hidden mt-1 ml-1"
                >
                  {contentNavItems.map((item, idx) => (
                    <SubNavLink
                      key={item.url}
                      item={item}
                      isLast={idx === contentNavItems.length - 1}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        ) : (
          /* Static server-side render to prevent hydration mismatch */
          <div>
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Content</span>
              <IconChevronRight className="ml-auto size-3.5" />
            </div>
            <div className="mt-1 ml-1">
              {contentNavItems.map((item, idx) => (
                <SubNavLink key={item.url} item={item} isLast={idx === contentNavItems.length - 1} />
              ))}
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarSeparator />

      {/* Sidebar Footer - User profile and actions */}
      <SidebarFooter className="px-3 py-2">
        <NavUser user={userData} onSignOut={signOut} />
      </SidebarFooter>
    </Sidebar>
  )
}
