"use client"

/**
 * Onboarding Services
 * @description Client-side onboarding helpers for ChainLinked
 * @module services/onboarding
 */

import { createClient } from "@/lib/supabase/client"

/**
 * Local storage keys used by onboarding
 */
const STORAGE_KEYS = {
  signup: "onboarding_signup",
  step: "onboarding_current_step",
  completed: "onboarding_completed",
  companyInfo: "onboarding_company_info",
  webhookMarkdown: "webhook_markdown",
  webhookJson: "company_json_data",
  salesMotion: "onboarding_sales_motion",
  framework: "onboarding_sales_framework",
  companyContext: "onboarding_company_context",
} as const

/**
 * Company context data shape for onboarding
 */
export interface CompanyContextData {
  /** Company website URL */
  companyWebsite: string
  /** Company name */
  companyName: string
  /** Company description */
  companyDescription: string
  /** Products and services */
  companyProducts: string
  /** Ideal Customer Profile */
  companyIcp: string
  /** Value propositions */
  companyValueProps: string
}

/**
 * Payload shape for webhook data editing
 */
export interface WebhookDataPayload {
  company_info?: {
    website?: string
    company_name?: string
    value_proposition?: string
  }
  products_and_services?: Array<{ name: string; description?: string } | string>
  ideal_customer_profile?: {
    region?: string
    industry?: string
    tech_stack?: string
    company_size?: string
    sales_motion?: string
  }
  buyer_personas?: Array<{
    name: string
    goals?: string[]
    job_title?: string
    pain_points?: string[]
    responsibilities?: string[]
    decision_influence?: string
    information_sources?: string[]
  }>
  talk_tracks?: Array<string | { text: string }>
  objection_handling?: Array<{
    objection: string
    response: string
  }>
}

/**
 * Returns the current authenticated user's name and email
 * @returns Name + email from Supabase auth metadata
 */
export async function getAuthUserData(): Promise<{ name: string; email: string }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { name: "", email: "" }

    const metadata = user.user_metadata || {}
    const identityData = user.identities?.[0]?.identity_data || {}

    const name =
      metadata.full_name ||
      metadata.name ||
      (metadata.given_name
        ? `${metadata.given_name} ${metadata.family_name || ""}`.trim()
        : identityData.full_name || identityData.name || "")

    const email = user.email || metadata.email || ""
    return { name, email }
  } catch {
    return { name: "", email: "" }
  }
}

/**
 * Updates the user's profile in Supabase (profiles table)
 * @param fullName - Full name to save
 * @param email - Email to save
 */
export async function updateUserProfile(fullName: string, email: string): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: fullName,
          email,
        },
        { onConflict: "id" }
      )
  } catch {
    // best-effort update
  }
}

/**
 * Calls the onboarding webhook to analyze company data
 * @param website - Company website
 * @param companyName - Company name
 */
export async function sendWebsiteToWebhook(
  website: string,
  companyName: string
): Promise<{ success: boolean; markdown?: string; json_val?: WebhookDataPayload }> {
  const webhookUrl = process.env.NEXT_PUBLIC_ONBOARDING_WEBHOOK_URL

  if (!webhookUrl) {
    return { success: false }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website,
        company_name: companyName,
        user_id: user?.id,
      }),
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = (await response.json()) as {
      markdown?: string
      json_val?: WebhookDataPayload
      data?: {
        markdown?: string
        analysis?: WebhookDataPayload
      }
    }

    const markdown = data.data?.markdown || data.markdown
    const json_val = data.data?.analysis || data.json_val

    if (markdown) {
      localStorage.setItem(STORAGE_KEYS.webhookMarkdown, markdown)
    }
    if (json_val) {
      localStorage.setItem(STORAGE_KEYS.webhookJson, JSON.stringify(json_val))
    }

    return { success: true, markdown, json_val }
  } catch (error) {
    console.error("Webhook request failed:", error)
    return { success: false }
  }
}

/**
 * Reads webhook data from localStorage
 */
export async function fetchWebhookData(): Promise<{
  success: boolean
  data?: WebhookDataPayload
  markdown?: string
}> {
  try {
    const markdown = localStorage.getItem(STORAGE_KEYS.webhookMarkdown) || undefined
    const jsonData = localStorage.getItem(STORAGE_KEYS.webhookJson)

    const data = jsonData ? (JSON.parse(jsonData) as WebhookDataPayload) : undefined
    return { success: true, data, markdown }
  } catch (error) {
    console.error("Failed to load webhook data:", error)
    return { success: false }
  }
}

/**
 * Updates webhook data in localStorage
 * @param jsonVal - Updated JSON data
 * @param markdown - Optional markdown update
 */
export async function updateWebhookData(
  jsonVal: WebhookDataPayload,
  markdown?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    localStorage.setItem(STORAGE_KEYS.webhookJson, JSON.stringify(jsonVal))
    if (markdown !== undefined) {
      localStorage.setItem(STORAGE_KEYS.webhookMarkdown, markdown)
    }
    return { success: true }
  } catch (error) {
    console.error("Failed to update webhook data:", error)
    return { success: false, error: "Failed to update webhook data" }
  }
}

/**
 * Updates the current onboarding step
 * @param step - Step number
 */
export async function updateOnboardingStep(step: number): Promise<boolean> {
  try {
    localStorage.setItem(STORAGE_KEYS.step, String(step))
    return true
  } catch (error) {
    console.error("Failed to update onboarding step:", error)
    return false
  }
}

/**
 * Retrieves the current onboarding step
 */
export async function getOnboardingStep(): Promise<number | null> {
  try {
    if (localStorage.getItem(STORAGE_KEYS.completed) === "true") {
      return null
    }
    const stored = localStorage.getItem(STORAGE_KEYS.step)
    return stored ? Number(stored) : 1
  } catch (error) {
    console.error("Failed to get onboarding step:", error)
    return 1
  }
}

/**
 * Marks onboarding as complete
 */
export async function completeOnboarding(): Promise<boolean> {
  try {
    localStorage.setItem(STORAGE_KEYS.completed, "true")
    localStorage.setItem(STORAGE_KEYS.step, "completed")
    return true
  } catch (error) {
    console.error("Failed to complete onboarding:", error)
    return false
  }
}

/**
 * Saves onboarding sales process preferences
 * @param salesMotion - Selected sales motion
 * @param framework - Selected framework
 */
export async function updateSalesProcess(
  salesMotion: string,
  framework: string
): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.salesMotion, salesMotion)
  localStorage.setItem(STORAGE_KEYS.framework, framework)
}

/**
 * Validates onboarding connections
 */
export async function validateConnectedTools(): Promise<boolean> {
  try {
    const apiResponse = await fetch("/api/settings/api-keys", {
      method: "GET",
      credentials: "include",
    })

    const apiData = (await apiResponse.json()) as { hasKey?: boolean }
    if (!apiResponse.ok || !apiData.hasKey) {
      return false
    }

    const linkedinResponse = await fetch("/api/linkedin/status", {
      method: "GET",
      credentials: "include",
    })

    const linkedinData = (await linkedinResponse.json()) as { isConnected?: boolean }
    if (!linkedinResponse.ok || !linkedinData.isConnected) {
      return false
    }

    return true
  } catch (error) {
    console.error("Failed to validate connected tools:", error)
    return false
  }
}

/**
 * Saves company context data to localStorage
 * @param data - Company context data to save
 */
export function saveCompanyContextToStorage(data: CompanyContextData): void {
  try {
    localStorage.setItem(STORAGE_KEYS.companyContext, JSON.stringify(data))
  } catch (error) {
    console.error("Failed to save company context to storage:", error)
  }
}

/**
 * Retrieves company context data from localStorage
 * @returns Company context data or null if not found
 */
export function getCompanyContextFromStorage(): CompanyContextData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.companyContext)
    if (!stored) return null
    return JSON.parse(stored) as CompanyContextData
  } catch (error) {
    console.error("Failed to get company context from storage:", error)
    return null
  }
}

/**
 * Saves company context to the user's profile in Supabase
 * and marks company_onboarding_completed as true
 * @param data - Company context data to save
 * @returns Object with success status and optional error message
 * @example
 * const result = await saveCompanyContext({
 *   companyWebsite: "https://example.com",
 *   companyName: "Example Inc",
 *   companyDescription: "We build amazing products",
 *   companyProducts: "- Product A\n- Product B",
 *   companyIcp: "Mid-market B2B SaaS companies",
 *   companyValueProps: "- Fast implementation\n- Great support"
 * })
 */
export async function saveCompanyContext(
  data: CompanyContextData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Update the profiles table with company context
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          company_website: data.companyWebsite,
          company_name: data.companyName,
          company_description: data.companyDescription,
          company_products: data.companyProducts,
          company_icp: data.companyIcp,
          company_value_props: data.companyValueProps,
          company_onboarding_completed: true,
        },
        { onConflict: "id" }
      )

    if (updateError) {
      console.error("Failed to save company context:", updateError)
      return { success: false, error: updateError.message }
    }

    // Also save to localStorage for persistence
    saveCompanyContextToStorage(data)

    return { success: true }
  } catch (error) {
    console.error("Failed to save company context:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Retrieves company context from the user's profile in Supabase
 * @returns Company context data or null if not found
 */
export async function getCompanyContext(): Promise<CompanyContextData | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "company_website, company_name, company_description, company_products, company_icp, company_value_props"
      )
      .eq("id", user.id)
      .single()

    if (error || !profile) {
      return null
    }

    // Only return if we have at least a company name
    if (!profile.company_name) {
      return null
    }

    return {
      companyWebsite: profile.company_website || "",
      companyName: profile.company_name,
      companyDescription: profile.company_description || "",
      companyProducts: profile.company_products || "",
      companyIcp: profile.company_icp || "",
      companyValueProps: profile.company_value_props || "",
    }
  } catch (error) {
    console.error("Failed to get company context:", error)
    return null
  }
}

/**
 * Checks if the user has completed company onboarding
 * @returns Boolean indicating completion status
 */
export async function hasCompletedCompanyOnboarding(): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return false
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("company_onboarding_completed")
      .eq("id", user.id)
      .single()

    if (error || !profile) {
      return false
    }

    return profile.company_onboarding_completed === true
  } catch (error) {
    console.error("Failed to check company onboarding status:", error)
    return false
  }
}

/**
 * Company onboarding status response type
 */
export interface CompanyOnboardingStatus {
  /** Whether company onboarding is completed */
  completed: boolean
  /** Company name if set */
  companyName: string | null
  /** Company website if set */
  companyWebsite: string | null
}

/**
 * Gets the full company onboarding status including company info
 * @returns Company onboarding status object
 */
export async function getCompanyOnboardingStatus(): Promise<CompanyOnboardingStatus> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { completed: false, companyName: null, companyWebsite: null }
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("company_onboarding_completed, company_name, company_website")
      .eq("id", user.id)
      .single()

    if (error || !profile) {
      console.error("Failed to fetch company onboarding status:", error)
      return { completed: false, companyName: null, companyWebsite: null }
    }

    return {
      completed: profile.company_onboarding_completed ?? false,
      companyName: profile.company_name ?? null,
      companyWebsite: profile.company_website ?? null,
    }
  } catch (error) {
    console.error("Error checking company onboarding status:", error)
    return { completed: false, companyName: null, companyWebsite: null }
  }
}

/**
 * Marks company onboarding as complete in the database
 * @param companyData - Optional company data to save
 * @returns Success status
 */
export async function markCompanyOnboardingComplete(companyData?: {
  companyName?: string
  companyWebsite?: string
  companyDescription?: string
  companyProducts?: string
  companyIcp?: string
  companyValueProps?: string
}): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("No user found when marking company onboarding complete")
      return false
    }

    const updateData: Record<string, unknown> = {
      company_onboarding_completed: true,
    }

    // Add optional company data if provided
    if (companyData?.companyName) {
      updateData.company_name = companyData.companyName
    }
    if (companyData?.companyWebsite) {
      updateData.company_website = companyData.companyWebsite
    }
    if (companyData?.companyDescription) {
      updateData.company_description = companyData.companyDescription
    }
    if (companyData?.companyProducts) {
      updateData.company_products = companyData.companyProducts
    }
    if (companyData?.companyIcp) {
      updateData.company_icp = companyData.companyIcp
    }
    if (companyData?.companyValueProps) {
      updateData.company_value_props = companyData.companyValueProps
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) {
      console.error("Failed to mark company onboarding complete:", error)
      return false
    }

    // Clear local storage onboarding state
    clearCompanyOnboardingLocal()

    return true
  } catch (error) {
    console.error("Error marking company onboarding complete:", error)
    return false
  }
}

/**
 * Resets company onboarding status (for testing or re-onboarding)
 * @returns Success status
 */
export async function resetCompanyOnboarding(): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return false
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        company_onboarding_completed: false,
        company_name: null,
        company_website: null,
        company_description: null,
        company_products: null,
        company_icp: null,
        company_value_props: null,
      })
      .eq("id", user.id)

    if (error) {
      console.error("Failed to reset company onboarding:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error resetting company onboarding:", error)
    return false
  }
}

/** localStorage key for company onboarding in progress */
const COMPANY_ONBOARDING_KEY = "chainlinked_company_onboarding_started"

/**
 * Marks that company onboarding has started (localStorage)
 * Used to prevent redirect loops during the onboarding flow
 */
export function markCompanyOnboardingStarted(): void {
  try {
    localStorage.setItem(COMPANY_ONBOARDING_KEY, "true")
  } catch {
    // Silently ignore localStorage errors
  }
}

/**
 * Checks if company onboarding has been started locally
 * @returns Whether onboarding is in progress
 */
export function isCompanyOnboardingInProgress(): boolean {
  try {
    return localStorage.getItem(COMPANY_ONBOARDING_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Clears company onboarding local state
 * Called when onboarding is completed
 */
export function clearCompanyOnboardingLocal(): void {
  try {
    localStorage.removeItem(COMPANY_ONBOARDING_KEY)
  } catch {
    // Silently ignore localStorage errors
  }
}

/**
 * Updates the current onboarding step in the database
 * Only updates if the new step is greater than or equal to the current step
 * to prevent race conditions with concurrent updates
 * @param step - Step number (1-4)
 * @returns Whether the update was successful
 * @example
 * const success = await updateOnboardingStepInDatabase(3)
 * if (success) {
 *   console.log('Step updated to 3')
 * }
 */
export async function updateOnboardingStepInDatabase(step: number): Promise<boolean> {
  // Validate step range (TOTAL_STEPS is 4)
  if (step < 1 || step > 4) {
    console.error("Invalid onboarding step:", step, "- must be between 1 and 4")
    return false
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("No user found when updating onboarding step")
      return false
    }

    // First check current step to avoid unnecessary updates
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("onboarding_current_step")
      .eq("id", user.id)
      .single()

    // Only update if new step is greater than current (allows progress, prevents regression)
    if (currentProfile && (currentProfile.onboarding_current_step ?? 0) >= step) {
      // Already at or past this step, no update needed
      return true
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        onboarding_current_step: step,
      })
      .eq("id", user.id)
      .select("onboarding_current_step")
      .single()

    if (error) {
      console.error("Failed to update onboarding step in database:", error)
      return false
    }

    if (!updated) {
      console.error("[updateOnboardingStep] No profile row returned for user:", user.id)
      return false
    }

    // Also update localStorage for consistency
    localStorage.setItem(STORAGE_KEYS.step, String(step))

    return true
  } catch (error) {
    console.error("Error updating onboarding step in database:", error)
    return false
  }
}

/**
 * Marks the full onboarding flow as complete in the database
 * Uses a server-side API route for reliable writes with verification.
 * Falls back to direct client-side update if the API call fails.
 * @returns Boolean indicating success
 * @example
 * const success = await completeOnboardingInDatabase()
 * if (success) {
 *   console.log('Onboarding marked as complete')
 * }
 */
export async function completeOnboardingInDatabase(): Promise<boolean> {
  try {
    // Primary path: server-side API route (most reliable)
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      credentials: "include",
    })

    if (response.ok) {
      const data = (await response.json()) as { success?: boolean; onboarding_completed?: boolean }
      if (data.success && data.onboarding_completed === true) {
        // Verified: DB write confirmed by the server
        localStorage.setItem(STORAGE_KEYS.completed, "true")
        localStorage.setItem(STORAGE_KEYS.step, "4")
        return true
      }
      console.error("[completeOnboarding] Server returned unexpected data:", data)
    } else {
      console.error("[completeOnboarding] API returned status:", response.status)
    }

    // Fallback: direct client-side update with verification
    console.warn("[completeOnboarding] API route failed, attempting direct client update")
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("No user found when completing onboarding")
      return false
    }

    // Fetch onboarding type to only set company_onboarding_completed for owners
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_type")
      .eq("id", user.id)
      .single()

    const isOwner = profile?.onboarding_type === "owner"

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_current_step: 4,
        ...(isOwner ? { company_onboarding_completed: true } : {}),
      })
      .eq("id", user.id)
      .select("onboarding_completed")
      .single()

    if (error) {
      console.error("Failed to complete onboarding in database:", error)
      return false
    }

    if (!updated || updated.onboarding_completed !== true) {
      console.error("[completeOnboarding] Client update verification failed:", updated)
      return false
    }

    // Also update localStorage for consistency
    localStorage.setItem(STORAGE_KEYS.completed, "true")
    localStorage.setItem(STORAGE_KEYS.step, "4")

    return true
  } catch (error) {
    console.error("Error completing onboarding in database:", error)
    return false
  }
}

/**
 * Onboarding status from database
 */
export interface OnboardingStatus {
  /** Whether onboarding is completed */
  completed: boolean
  /** Current step in the onboarding flow (1-4) */
  step: number
}

/**
 * Retrieves the user's onboarding status from the database
 * @returns Object containing completed status and current step
 * @example
 * const status = await getOnboardingStatusFromDatabase()
 * if (!status.completed) {
 *   redirectToOnboardingStep(status.step)
 * }
 */
export async function getOnboardingStatusFromDatabase(): Promise<OnboardingStatus> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { completed: false, step: 1 }
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed, onboarding_current_step")
      .eq("id", user.id)
      .single()

    if (error || !profile) {
      console.error("Failed to fetch onboarding status:", error)
      return { completed: false, step: 1 }
    }

    return {
      completed: profile.onboarding_completed ?? false,
      step: profile.onboarding_current_step ?? 1,
    }
  } catch (error) {
    console.error("Error fetching onboarding status:", error)
    return { completed: false, step: 1 }
  }
}
