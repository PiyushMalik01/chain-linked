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
 * Formats a number with locale-aware comma separators
 * @param num - The number to format
 * @returns Formatted string (e.g., "1,469", "9,554")
 */
export function formatMetricNumber(num: number | null | undefined): string {
  if (num == null) return "0"
  return Math.round(num).toLocaleString()
}
