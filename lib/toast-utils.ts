/**
 * Toast Utility Functions
 * @description Consistent toast messaging helpers wrapping the Sonner library
 * @module lib/toast-utils
 */

import { toast } from "sonner"

/**
 * Show a success toast message.
 * @param message - The success message to display
 * @param description - Optional description for more details
 */
export function showSuccess(message: string, description?: string) {
  toast.success(message, { description })
}

/**
 * Show an error toast message.
 * @param message - The error message to display
 * @param description - Optional description with error details
 */
export function showError(message: string, description?: string) {
  toast.error(message, { description })
}

/**
 * Show an info toast message.
 * @param message - The info message to display
 * @param description - Optional description for more details
 */
export function showInfo(message: string, description?: string) {
  toast.info(message, { description })
}

/**
 * Show a warning toast message.
 * @param message - The warning message to display
 * @param description - Optional description for more details
 */
export function showWarning(message: string, description?: string) {
  toast.warning(message, { description })
}

/**
 * Show a loading toast that can be updated.
 * @param message - The loading message to display
 * @returns Toast ID that can be used to dismiss or update the toast
 */
export function showLoading(message: string) {
  return toast.loading(message)
}

/**
 * Dismiss a specific toast or all toasts.
 * @param toastId - Optional toast ID to dismiss. If not provided, dismisses all toasts.
 */
export function dismissToast(toastId?: string | number) {
  toast.dismiss(toastId)
}

/**
 * Show a toast with an undo action button.
 * Useful for destructive actions that can be reversed.
 * @param message - The message to display
 * @param onUndo - Callback function when undo is clicked
 * @param duration - How long to show the toast (default: 5000ms)
 */
export function showUndo(
  message: string,
  onUndo: () => void,
  duration: number = 5000
) {
  toast(message, {
    action: {
      label: "Undo",
      onClick: onUndo,
    },
    duration,
  })
}

/**
 * Show a promise toast that updates based on promise state.
 * @param promise - The promise to track
 * @param messages - Messages for loading, success, and error states
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }
) {
  return toast.promise(promise, messages)
}

/**
 * Show a toast for post-related actions.
 */
export const postToast = {
  scheduled: (date: string) =>
    showSuccess("Post scheduled", `Your post will be published on ${date}`),

  published: () =>
    showSuccess("Post published", "Your post is now live on LinkedIn"),

  saved: () =>
    showSuccess("Draft saved", "Your draft has been saved"),

  mediaSaved: () =>
    showSuccess("Media added", "Your file has been attached"),

  mediaRemoved: () =>
    showInfo("Media removed", "File has been detached"),

  deleted: (onUndo?: () => void) => {
    if (onUndo) {
      showUndo("Post deleted", onUndo)
    } else {
      showSuccess("Post deleted")
    }
  },

  failed: (reason?: string) =>
    showError("Failed to publish", reason || "Please try again"),
}

/**
 * Show a toast for template-related actions.
 */
export const templateToast = {
  created: (name: string) =>
    showSuccess("Template created", `"${name}" is now available`),

  updated: (name: string) =>
    showSuccess("Template updated", `"${name}" has been saved`),

  deleted: (name: string, onUndo?: () => void) => {
    if (onUndo) {
      showUndo(`Template "${name}" deleted`, onUndo)
    } else {
      showSuccess("Template deleted")
    }
  },

  applied: (name: string) =>
    showInfo("Template applied", `"${name}" loaded into composer`),
}

/**
 * Show a toast for inspiration/remix actions.
 */
export const inspirationToast = {
  remixed: () =>
    showSuccess("Remixed post loaded", "Opening in Composer — edit and publish"),

  saved: () =>
    showSuccess("Inspiration saved", "Added to your saved posts"),
}

/**
 * Show a toast for AI remix actions.
 */
export const remixToast = {
  generating: () =>
    showLoading("Generating remix..."),

  success: () =>
    showSuccess("Remix generated", "Your AI-rewritten post is ready"),

  copied: () =>
    showSuccess("Copied to clipboard", "Remixed content copied"),

  loadedToComposer: () =>
    showInfo("Loaded to composer", "Edit and publish your remixed post"),

  error: (message?: string) =>
    showError("Remix failed", message || "Please try again"),

  noApiKey: () =>
    showWarning("API key required", "Add your OpenAI API key in Settings"),

  invalidApiKey: () =>
    showError("Invalid API key", "Please update your OpenAI API key in Settings"),

  rateLimited: () =>
    showWarning("Rate limited", "Please wait a moment and try again"),

  quotaExceeded: () =>
    showError("Quota exceeded", "Check your OpenAI billing"),
}

/**
 * Show a toast for swipe interface actions.
 */
export const swipeToast = {
  liked: () =>
    showSuccess("Added to liked", "This preference helps improve suggestions"),

  skipped: () =>
    showInfo("Skipped", "We'll use this to refine your suggestions"),

  editAndPost: () =>
    showInfo("Opening composer", "Edit the suggestion and make it yours"),

  batchComplete: (count: number) =>
    showSuccess(`Reviewed ${count} suggestions`, "Great work! Check back for more"),

  preferenceSaved: () =>
    showSuccess("Preference saved", "Your feedback improves future suggestions"),

  loadError: () =>
    showError("Failed to load suggestions", "Please try again"),
}
