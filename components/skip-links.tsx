/**
 * Skip Links Component
 * @description Accessibility skip-navigation links that appear on keyboard focus,
 * allowing screen reader and keyboard users to jump directly to main content areas.
 * @module components/skip-links
 */

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Props for the SkipLinks component
 */
export interface SkipLinksProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Skip links for keyboard navigation accessibility.
 * Provides quick navigation to main content areas for screen reader
 * and keyboard users.
 *
 * The links are visually hidden until focused, then appear at the top
 * of the viewport. This follows WCAG 2.1 AA guidelines for bypass blocks.
 *
 * @example
 * ```tsx
 * // In your root layout
 * <body>
 *   <SkipLinks />
 *   <header>...</header>
 *   <main id="main-content">...</main>
 * </body>
 * ```
 */
export function SkipLinks({ className }: SkipLinksProps) {
  return (
    <div className={cn("skip-links", className)}>
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-[100]",
          "focus:rounded-md focus:bg-primary focus:px-4 focus:py-2",
          "focus:text-primary-foreground focus:shadow-lg",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "transition-all"
        )}
      >
        Skip to main content
      </a>
      <a
        href="#sidebar-navigation"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-16 focus:z-[100]",
          "focus:rounded-md focus:bg-secondary focus:px-4 focus:py-2",
          "focus:text-secondary-foreground focus:shadow-lg",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "transition-all"
        )}
      >
        Skip to navigation
      </a>
    </div>
  )
}
