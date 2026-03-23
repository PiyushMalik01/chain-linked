/**
 * Nav Content Component
 * @description Collapsible sidebar navigation group that renders a list of
 * content-related links with active-state highlighting based on the current route.
 * @module components/nav-content
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconChevronRight, type Icon } from "@tabler/icons-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * Navigation item for the collapsible content section.
 */
export interface NavContentItem {
  /** Display title for the navigation item */
  title: string
  /** URL path for the navigation item */
  url: string
  /** Tabler icon component to display */
  icon: Icon
}

/**
 * Props for the NavContent component.
 */
export interface NavContentProps {
  /** Array of navigation items to display in the collapsible section */
  items: NavContentItem[]
  /** Label for the collapsible section */
  label?: string
  /** Whether the section is initially open */
  defaultOpen?: boolean
}

/**
 * Collapsible navigation section for content-related items.
 * Displays a list of navigation links within an expandable/collapsible group.
 *
 * @example
 * ```tsx
 * <NavContent
 *   label="Content"
 *   items={[
 *     { title: "Templates", url: "/templates", icon: IconTemplate },
 *     { title: "Carousels", url: "/carousels", icon: IconPresentation },
 *   ]}
 *   defaultOpen={true}
 * />
 * ```
 */
export function NavContent({
  items,
  label = "Content",
  defaultOpen = true,
}: NavContentProps) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
            <span>{label}</span>
            <IconChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}
