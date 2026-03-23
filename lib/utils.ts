/**
 * General Utility Functions
 * @description Shared utility helpers used across the ChainLinked application
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names using clsx and tailwind-merge for conflict resolution
 * @param inputs - Class values to merge (strings, objects, arrays)
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get initials from a full name
 * @param name - Full name string
 * @returns Up to 2 character initials
 */
export function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Formats a number into a compact, human-readable string with K/M suffixes
 * @param num - The number to format
 * @returns Formatted string (e.g., "1.2K", "3.4M")
 */
export function formatMetricNumber(num: number | null | undefined): string {
  if (num == null) return "0"
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  }
  return num.toString()
}
