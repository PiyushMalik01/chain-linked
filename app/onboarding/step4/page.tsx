"use client"

/**
 * Onboarding Step 4 - Review & Complete
 * @description Final onboarding step - Review AI-extracted company context,
 * edit inline with compose-style textareas, and complete onboarding.
 * @module app/onboarding/step4/page
 */

import React, { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Package,
  Palette,
  Target,
  MessageSquare,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BrandKitPreview } from "@/components/features/brand-kit-preview"
import type { BrandKitPreviewData } from "@/components/features/brand-kit-preview"
import { trackOnboardingStep } from "@/lib/analytics"
import { useOnboardingGuard } from "@/hooks/use-onboarding-guard"
import { completeOnboardingInDatabase } from "@/services/onboarding"
import { useAuthContext } from "@/lib/auth/auth-provider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ContentRulesEditor } from "@/components/features/content-rules-editor"

/* ------------------------------------------------------------------ */
/*                         TYPE DEFINITIONS                          */
/* ------------------------------------------------------------------ */

/**
 * Product or service entry
 */
interface ProductEntry {
  name: string
  description: string
}

/**
 * Target audience / ICP data
 */
interface TargetAudienceData {
  industries: string[]
  companySize: string
  roles: string[]
  painPoints: string[]
}

/**
 * Tone of voice data
 */
interface ToneOfVoiceData {
  descriptors: string[]
  writingStyle: string
  examples: string[]
}

/**
 * Company context from database
 */
interface CompanyContext {
  id: string
  company_name: string
  website_url?: string
  industry?: string
  value_proposition?: string
  company_summary?: string
  products_and_services: ProductEntry[]
  target_audience: TargetAudienceData
  tone_of_voice: ToneOfVoiceData
  brand_colors: string[]
  status: string
}

/**
 * Full analysis data shape for UI
 */
interface CompanyAnalysis {
  valueProposition: string
  productsAndServices: ProductEntry[]
  targetAudience: TargetAudienceData
  toneOfVoice: ToneOfVoiceData
  brandColors: string[]
  summary: string
}

/**
 * Color scheme configuration for section blocks
 */
type ColorScheme = "blue" | "pink" | "emerald" | "violet" | "amber"

/**
 * Default empty analysis structure
 */
const EMPTY_ANALYSIS: CompanyAnalysis = {
  valueProposition: "",
  productsAndServices: [],
  targetAudience: {
    industries: [],
    companySize: "",
    roles: [],
    painPoints: [],
  },
  toneOfVoice: {
    descriptors: [],
    writingStyle: "",
    examples: [],
  },
  brandColors: [],
  summary: "",
}

/* ------------------------------------------------------------------ */
/*                    SERIALIZATION / PARSING                         */
/* ------------------------------------------------------------------ */

/**
 * Serializes target audience data into a single compose-style string
 * with section headers as dividers. One item per line.
 * @param data - Target audience data
 * @returns Formatted string
 */
function serializeAudience(data: TargetAudienceData): string {
  const sections: string[] = []

  sections.push("INDUSTRIES")
  if (data.industries.length > 0) {
    sections.push(data.industries.join("\n"))
  } else {
    sections.push("")
  }

  sections.push("")
  sections.push("COMPANY SIZE")
  sections.push(data.companySize || "")

  sections.push("")
  sections.push("TARGET ROLES")
  if (data.roles.length > 0) {
    sections.push(data.roles.join("\n"))
  } else {
    sections.push("")
  }

  sections.push("")
  sections.push("PAIN POINTS")
  if (data.painPoints.length > 0) {
    sections.push(data.painPoints.join("\n"))
  } else {
    sections.push("")
  }

  return sections.join("\n")
}

/**
 * Parses a compose-style string back into target audience data
 * by splitting on section headers.
 * @param text - Raw textarea content
 * @returns Parsed target audience data
 */
function parseAudience(text: string): TargetAudienceData {
  const result: TargetAudienceData = {
    industries: [],
    companySize: "",
    roles: [],
    painPoints: [],
  }

  // Split into sections by known headers
  const headerPattern = /^(INDUSTRIES|COMPANY SIZE|TARGET ROLES|PAIN POINTS)\s*$/gm
  const headers: { name: string; index: number }[] = []
  let match

  while ((match = headerPattern.exec(text)) !== null) {
    headers.push({ name: match[1], index: match.index + match[0].length })
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length
      ? text.lastIndexOf(headers[i + 1].name, headers[i + 1].index)
      : text.length
    const content = text.slice(start, end).trim()
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)

    switch (headers[i].name) {
      case "INDUSTRIES":
        result.industries = lines
        break
      case "COMPANY SIZE":
        result.companySize = lines.join(" ")
        break
      case "TARGET ROLES":
        result.roles = lines
        break
      case "PAIN POINTS":
        result.painPoints = lines
        break
    }
  }

  return result
}

/**
 * Serializes tone of voice data into a compose-style string
 * @param data - Tone of voice data
 * @returns Formatted string
 */
function serializeTone(data: ToneOfVoiceData): string {
  const sections: string[] = []

  sections.push("TONE DESCRIPTORS")
  if (data.descriptors.length > 0) {
    sections.push(data.descriptors.join("\n"))
  } else {
    sections.push("")
  }

  sections.push("")
  sections.push("WRITING STYLE")
  sections.push(data.writingStyle || "")

  sections.push("")
  sections.push("EXAMPLE PHRASES")
  if (data.examples.length > 0) {
    sections.push(data.examples.join("\n"))
  } else {
    sections.push("")
  }

  return sections.join("\n")
}

/**
 * Parses a compose-style string back into tone of voice data
 * @param text - Raw textarea content
 * @returns Parsed tone of voice data
 */
function parseTone(text: string): ToneOfVoiceData {
  const result: ToneOfVoiceData = {
    descriptors: [],
    writingStyle: "",
    examples: [],
  }

  const headerPattern = /^(TONE DESCRIPTORS|WRITING STYLE|EXAMPLE PHRASES)\s*$/gm
  const headers: { name: string; index: number }[] = []
  let match

  while ((match = headerPattern.exec(text)) !== null) {
    headers.push({ name: match[1], index: match.index + match[0].length })
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length
      ? text.lastIndexOf(headers[i + 1].name, headers[i + 1].index)
      : text.length
    const content = text.slice(start, end).trim()
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)

    switch (headers[i].name) {
      case "TONE DESCRIPTORS":
        result.descriptors = lines
        break
      case "WRITING STYLE":
        result.writingStyle = lines.join("\n")
        break
      case "EXAMPLE PHRASES":
        result.examples = lines
        break
    }
  }

  return result
}

/**
 * Serializes company info into a compose-style string
 * @param valueProp - Value proposition text
 * @param summary - Company summary text
 * @returns Formatted string
 */
function serializeCompanyInfo(valueProp: string, summary: string): string {
  return [
    "VALUE PROPOSITION",
    valueProp || "",
    "",
    "SUMMARY",
    summary || "",
  ].join("\n")
}

/**
 * Parses a compose-style string back into company info
 * @param text - Raw textarea content
 * @returns Object with valueProposition and summary
 */
function parseCompanyInfo(text: string): { valueProposition: string; summary: string } {
  const result = { valueProposition: "", summary: "" }

  const headerPattern = /^(VALUE PROPOSITION|SUMMARY)\s*$/gm
  const headers: { name: string; index: number }[] = []
  let match

  while ((match = headerPattern.exec(text)) !== null) {
    headers.push({ name: match[1], index: match.index + match[0].length })
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length
      ? text.lastIndexOf(headers[i + 1].name, headers[i + 1].index)
      : text.length
    const content = text.slice(start, end).trim()

    switch (headers[i].name) {
      case "VALUE PROPOSITION":
        result.valueProposition = content
        break
      case "SUMMARY":
        result.summary = content
        break
    }
  }

  return result
}

/* ------------------------------------------------------------------ */
/*                        MAIN PAGE COMPONENT                        */
/* ------------------------------------------------------------------ */

/** Current step number for this page */
const CURRENT_STEP = 4

/**
 * Step 4 - Review & Complete
 * Final onboarding step. Displays AI-extracted data from database
 * for review and inline editing. Completes onboarding when finished.
 * @returns Step 4 page JSX
 */
export default function Step4() {
  const router = useRouter()
  const { checking } = useOnboardingGuard()
  const { refreshProfile } = useAuthContext()

  const [analysis, setAnalysis] = useState<CompanyAnalysis>(EMPTY_ANALYSIS)
  const [companyName, setCompanyName] = useState("")
  const [companyContextId, setCompanyContextId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingBrandKit, setSavingBrandKit] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [hasData, setHasData] = useState(false)

  // Brand kit state
  const [brandKit, setBrandKit] = useState<BrandKitPreviewData | null>(null)
  const [brandKitId, setBrandKitId] = useState<string | null>(null)

  // Inline editing states
  const [editingCompany, setEditingCompany] = useState(false)
  const [editingAudience, setEditingAudience] = useState(false)
  const [editingTone, setEditingTone] = useState(false)

  // Draft text for inline compose editors
  const [companyDraft, setCompanyDraft] = useState("")
  const [audienceDraft, setAudienceDraft] = useState("")
  const [toneDraft, setToneDraft] = useState("")

  // Product dialog (keep as dialog since it's add/edit single item)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productEditIndex, setProductEditIndex] = useState<number | null>(null)
  const [productDraft, setProductDraft] = useState<ProductEntry>({
    name: "",
    description: "",
  })

  /**
   * Loads company context from database on mount
   */
  useEffect(() => {
    if (checking) return

    async function loadCompanyContext() {
      try {
        const response = await fetch("/api/company-context")
        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = (await response.json()) as CompanyContext | null

        if (data && data.status === "completed") {
          setCompanyName(data.company_name)
          setCompanyContextId(data.id)

          const mapped: CompanyAnalysis = {
            valueProposition: data.value_proposition || "",
            summary: data.company_summary || "",
            productsAndServices: Array.isArray(data.products_and_services)
              ? data.products_and_services
              : [],
            targetAudience: {
              industries: data.target_audience?.industries || [],
              companySize: data.target_audience?.companySize || "",
              roles: data.target_audience?.roles || [],
              painPoints: data.target_audience?.painPoints || [],
            },
            toneOfVoice: {
              descriptors: data.tone_of_voice?.descriptors || [],
              writingStyle: data.tone_of_voice?.writingStyle || "",
              examples: data.tone_of_voice?.examples || [],
            },
            brandColors: Array.isArray(data.brand_colors) ? data.brand_colors : [],
          }

          setAnalysis(mapped)
          setHasData(true)
        }
      } catch (err) {
        console.error("Failed to load company context:", err)
      } finally {
        setLoading(false)
      }
    }

    loadCompanyContext()
  }, [checking])

  /**
   * Loads brand kit from the brand_kits table on mount
   */
  useEffect(() => {
    if (checking) return

    async function loadBrandKit() {
      try {
        const response = await fetch("/api/brand-kit")
        if (!response.ok) return

        const data = await response.json()
        const kits = data.brandKits as Array<{
          id: string
          websiteUrl: string
          primaryColor: string
          secondaryColor?: string | null
          accentColor?: string | null
          backgroundColor?: string | null
          textColor?: string | null
          fontPrimary?: string | null
          fontSecondary?: string | null
          logoUrl?: string | null
          isActive: boolean
        }>

        if (!kits || kits.length === 0) return

        const activeKit = kits.find((k) => k.isActive) || kits[0]
        setBrandKitId(activeKit.id)
        setBrandKit({
          websiteUrl: activeKit.websiteUrl || "",
          primaryColor: activeKit.primaryColor,
          secondaryColor: activeKit.secondaryColor,
          accentColor: activeKit.accentColor,
          backgroundColor: activeKit.backgroundColor,
          textColor: activeKit.textColor,
          fontPrimary: activeKit.fontPrimary,
          fontSecondary: activeKit.fontSecondary,
          logoUrl: activeKit.logoUrl,
        })
      } catch (err) {
        console.error("Failed to load brand kit:", err)
      }
    }

    loadBrandKit()
  }, [checking])

  /**
   * Handles brand kit field updates via PUT /api/brand-kit
   * @param updates - Partial brand kit data to save
   */
  const handleBrandKitUpdate = useCallback(
    async (updates: Partial<BrandKitPreviewData>) => {
      if (!brandKitId) return

      setBrandKit((prev) => (prev ? { ...prev, ...updates } : prev))
      setSavingBrandKit(true)

      try {
        const res = await fetch("/api/brand-kit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: brandKitId, ...updates }),
        })
        if (!res.ok) {
          toast.error("Failed to save brand kit changes.")
        } else {
          toast.success("Brand kit updated")
        }
      } catch {
        toast.error("Failed to save brand kit changes.")
      } finally {
        setSavingBrandKit(false)
      }
    },
    [brandKitId]
  )

  /**
   * Saves analysis data to database
   * @param updater - Callback to update the analysis state
   */
  const updateAnalysis = useCallback(
    async (updater: (prev: CompanyAnalysis) => CompanyAnalysis) => {
      setAnalysis((prev) => {
        const updated = updater(prev)

        setSaving(true)
        fetch("/api/company-context", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName,
            valueProposition: updated.valueProposition,
            companySummary: updated.summary,
            productsAndServices: updated.productsAndServices,
            targetAudience: updated.targetAudience,
            toneOfVoice: updated.toneOfVoice,
            brandColors: updated.brandColors,
          }),
        })
          .then((res) => {
            setSaving(false)
            if (!res.ok) {
              toast.error("Failed to save changes. Please try again.")
            }
          })
          .catch(() => {
            setSaving(false)
            toast.error("Failed to save changes. Please try again.")
          })

        return updated
      })
    },
    [companyName]
  )

  /* ---- Inline edit handlers ---- */

  const startEditCompany = () => {
    setCompanyDraft(
      serializeCompanyInfo(analysis.valueProposition, analysis.summary)
    )
    setEditingCompany(true)
  }

  const saveEditCompany = () => {
    const parsed = parseCompanyInfo(companyDraft)
    updateAnalysis((prev) => ({
      ...prev,
      valueProposition: parsed.valueProposition,
      summary: parsed.summary,
    }))
    setEditingCompany(false)
    toast.success("Company info updated")
  }

  const startEditAudience = () => {
    setAudienceDraft(serializeAudience(analysis.targetAudience))
    setEditingAudience(true)
  }

  const saveEditAudience = () => {
    const parsed = parseAudience(audienceDraft)
    updateAnalysis((prev) => ({
      ...prev,
      targetAudience: parsed,
    }))
    setEditingAudience(false)
    toast.success("Target audience updated")
  }

  const startEditTone = () => {
    setToneDraft(serializeTone(analysis.toneOfVoice))
    setEditingTone(true)
  }

  const saveEditTone = () => {
    const parsed = parseTone(toneDraft)
    updateAnalysis((prev) => ({
      ...prev,
      toneOfVoice: parsed,
    }))
    setEditingTone(false)
    toast.success("Tone & voice updated")
  }

  if (checking || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading brand context...
          </p>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <div className="flex flex-col items-center gap-4 text-center py-20">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">No company analysis found</p>
          <p className="text-sm text-muted-foreground max-w-md">
            You can complete setup now and add your company context later from
            Settings, or go back to Step 2 to run the AI analysis.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/onboarding/step2")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back to Step 2
            </Button>
            <Button
              onClick={async () => {
                setCompleting(true)
                try {
                  const success = await completeOnboardingInDatabase()
                  if (!success) throw new Error("Failed to complete onboarding in database")
                  await refreshProfile()
                  trackOnboardingStep(CURRENT_STEP, true)
                  toast.success("Welcome to ChainLinked!")
                  router.push("/dashboard")
                } catch (err) {
                  console.error("Failed to complete onboarding:", err)
                  toast.error("Failed to complete setup. Please try again.")
                  setCompleting(false)
                }
              }}
              disabled={completing}
              className="gap-2"
            >
              {completing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Review Brand Context
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and refine the AI-extracted context for{" "}
            <span className="font-medium text-foreground">{companyName}</span>.
            Click Edit on any section to modify it inline.
          </p>
        </div>
        {(saving || savingBrandKit) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* Info alert */}
      <Alert className="bg-primary/5 border-primary/20 rounded-xl">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          This data powers personalized LinkedIn content generation. Edit any
          section to refine the AI&apos;s understanding of your brand.
          Write one item per line — we&apos;ll organize them automatically.
        </AlertDescription>
      </Alert>

      {/* ========================= COMPANY INFO SECTION ========================= */}
      <SectionBlock
        title="Company Information"
        icon={<Building2 className="h-5 w-5" />}
        colorScheme="blue"
        isEditing={editingCompany}
        onEdit={startEditCompany}
        onSave={saveEditCompany}
        onCancel={() => setEditingCompany(false)}
      >
        {editingCompany ? (
          <ComposeEditor
            value={companyDraft}
            onChange={setCompanyDraft}
            placeholder={
              "VALUE PROPOSITION\nDescribe your core value proposition...\n\nSUMMARY\nBrief company summary..."
            }
          />
        ) : (
          <>
            <FieldDisplay label="Company" value={companyName} />
            <FieldDisplay
              label="Value Proposition"
              value={analysis.valueProposition || "Not extracted"}
              multiline
            />
            <FieldDisplay
              label="Summary"
              value={analysis.summary || "Not extracted"}
              multiline
            />
          </>
        )}
      </SectionBlock>

      {/* ========================= BRAND IDENTITY SECTION ========================= */}
      <SectionBlock
        title="Brand Identity"
        icon={<Palette className="h-5 w-5" />}
        colorScheme="pink"
      >
        {brandKit ? (
          <BrandKitPreview
            brandKit={brandKit}
            editable
            onUpdate={handleBrandKitUpdate}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No brand kit extracted. You can set this up later in Settings.
          </p>
        )}
      </SectionBlock>

      {/* ========================= PRODUCTS SECTION ========================= */}
      <SectionBlock
        title="Products & Services"
        icon={<Package className="h-5 w-5" />}
        colorScheme="emerald"
        actionLabel="Add Product"
        onAction={() => {
          setProductDraft({ name: "", description: "" })
          setProductEditIndex(null)
          setProductDialogOpen(true)
        }}
      >
        {analysis.productsAndServices.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No products extracted. Click &quot;Add Product&quot; to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {analysis.productsAndServices.map((product, i) => (
              <SubItem
                key={i}
                title={product.name}
                description={product.description}
                colorScheme="emerald"
                onEdit={() => {
                  setProductDraft(product)
                  setProductEditIndex(i)
                  setProductDialogOpen(true)
                }}
                onDelete={() =>
                  updateAnalysis((prev) => ({
                    ...prev,
                    productsAndServices: prev.productsAndServices.filter(
                      (_, idx) => idx !== i
                    ),
                  }))
                }
              />
            ))}
          </div>
        )}
      </SectionBlock>

      {/* ========================= TARGET AUDIENCE SECTION ========================= */}
      <SectionBlock
        title="Target Audience / ICP"
        icon={<Target className="h-5 w-5" />}
        colorScheme="violet"
        isEditing={editingAudience}
        onEdit={startEditAudience}
        onSave={saveEditAudience}
        onCancel={() => setEditingAudience(false)}
      >
        {editingAudience ? (
          <ComposeEditor
            value={audienceDraft}
            onChange={setAudienceDraft}
            placeholder={
              "INDUSTRIES\nSaaS\nFintech\n\nCOMPANY SIZE\n50-500 employees\n\nTARGET ROLES\nVP Marketing\nHead of Growth\n\nPAIN POINTS\nLow engagement\nInconsistent posting"
            }
          />
        ) : (
          <>
            <FieldDisplay
              label="Industries"
              value={
                analysis.targetAudience.industries.length > 0
                  ? analysis.targetAudience.industries.join(", ")
                  : "Not specified"
              }
            />
            <FieldDisplay
              label="Company Size"
              value={analysis.targetAudience.companySize || "Not specified"}
            />
            {analysis.targetAudience.roles.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Target Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.targetAudience.roles.map((role, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {analysis.targetAudience.painPoints.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Pain Points
                </div>
                <ul className="text-sm space-y-1">
                  {analysis.targetAudience.painPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </SectionBlock>

      {/* ========================= TONE SECTION ========================= */}
      <SectionBlock
        title="Tone & Voice"
        icon={<MessageSquare className="h-5 w-5" />}
        colorScheme="amber"
        isEditing={editingTone}
        onEdit={startEditTone}
        onSave={saveEditTone}
        onCancel={() => setEditingTone(false)}
      >
        {editingTone ? (
          <ComposeEditor
            value={toneDraft}
            onChange={setToneDraft}
            placeholder={
              "TONE DESCRIPTORS\nProfessional\nFriendly\n\nWRITING STYLE\nConversational yet data-driven...\n\nEXAMPLE PHRASES\nWe help teams scale their presence\nData-driven insights for marketing"
            }
          />
        ) : (
          <>
            {analysis.toneOfVoice.descriptors.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Tone Descriptors
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.toneOfVoice.descriptors.map((desc, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {desc}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <FieldDisplay
              label="Writing Style"
              value={analysis.toneOfVoice.writingStyle || "Not analyzed"}
              multiline
            />
            {analysis.toneOfVoice.examples.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Example Phrases
                </div>
                <div className="space-y-1.5">
                  {analysis.toneOfVoice.examples.map((example, i) => (
                    <p
                      key={i}
                      className="text-sm italic text-muted-foreground border-l-2 border-amber-300 pl-3"
                    >
                      &quot;{example}&quot;
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </SectionBlock>

      {/* ========================= CONTENT RULES SECTION ========================= */}
      <SectionBlock
        title="AI Writing Rules"
        icon={<ShieldCheck className="h-5 w-5" />}
        colorScheme="violet"
      >
        <p className="text-sm text-muted-foreground">
          Set rules that the AI must follow when generating your LinkedIn content.
          You can always update these later from Settings.
        </p>
        <ContentRulesEditor scope="personal" />
      </SectionBlock>

      {/* ========================= PRODUCT DIALOG (kept for add/edit single item) ========================= */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {productEditIndex !== null ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product / Service Name</Label>
              <Input
                value={productDraft.name}
                onChange={(e) =>
                  setProductDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Product name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={productDraft.description}
                onChange={(e) =>
                  setProductDraft((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProductDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateAnalysis((prev) => {
                  const arr = [...prev.productsAndServices]
                  if (productEditIndex !== null) {
                    arr[productEditIndex] = productDraft
                  } else {
                    arr.push(productDraft)
                  }
                  return { ...prev, productsAndServices: arr }
                })
                setProductDialogOpen(false)
                toast.success(
                  productEditIndex !== null
                    ? "Product updated"
                    : "Product added"
                )
              }}
              disabled={!productDraft.name.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= NAVIGATION ========================= */}
      <div className="flex justify-between pt-4 pb-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/step3")}
        >
          Back
        </Button>
        <Button
          onClick={async () => {
            setCompleting(true)
            try {
              const success = await completeOnboardingInDatabase()
              if (!success) throw new Error("Failed to complete onboarding in database")
              await refreshProfile()
              trackOnboardingStep(CURRENT_STEP, true)

              toast.success("Welcome to ChainLinked!")
              router.push("/dashboard")
            } catch (err) {
              console.error("Failed to complete onboarding:", err)
              toast.error("Failed to complete setup. Please try again.")
              setCompleting(false)
            }
          }}
          disabled={completing || savingBrandKit || saving}
          className="gap-2"
        >
          {completing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Complete Setup
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*                      PRESENTATION COMPONENTS                      */
/* ------------------------------------------------------------------ */

/**
 * Color mapping for section block themes
 */
const COLOR_MAP: Record<
  ColorScheme,
  {
    border: string
    bg: string
    icon: string
    hover: string
  }
> = {
  blue: {
    border: "border-l-sky-500",
    bg: "bg-sky-500/5",
    icon: "text-sky-500",
    hover: "hover:bg-sky-500/10",
  },
  pink: {
    border: "border-l-pink-500",
    bg: "bg-pink-500/5",
    icon: "text-pink-500",
    hover: "hover:bg-pink-500/10",
  },
  emerald: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    icon: "text-emerald-500",
    hover: "hover:bg-emerald-500/10",
  },
  violet: {
    border: "border-l-violet-500",
    bg: "bg-violet-500/5",
    icon: "text-violet-500",
    hover: "hover:bg-violet-500/10",
  },
  amber: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    icon: "text-amber-500",
    hover: "hover:bg-amber-500/10",
  },
}

/**
 * Editable section block with colored left border and icon.
 * Supports inline editing mode with Save/Cancel buttons.
 * @param props - Section block props
 * @returns Section block JSX
 */
function SectionBlock({
  title,
  icon,
  colorScheme,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onAction,
  actionLabel,
  children,
}: {
  title: string
  icon: React.ReactNode
  colorScheme: ColorScheme
  isEditing?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
  onAction?: () => void
  actionLabel?: string
  children: React.ReactNode
}) {
  const colors = COLOR_MAP[colorScheme]

  return (
    <Card
      className={cn(
        "border-l-4 overflow-hidden",
        colors.border,
        colors.bg
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span className={colors.icon}>{icon}</span>
            {title}
          </CardTitle>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="gap-1 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} className="gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Save
                </Button>
              </>
            ) : (
              <>
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                {onAction && (
                  <Button variant="outline" size="sm" onClick={onAction}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {actionLabel}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

/**
 * Auto-resizing compose-style textarea for inline section editing.
 * Highlights section headers (UPPERCASE lines) with a subtle style.
 * @param props - Editor props
 * @param props.value - Current text content
 * @param props.onChange - Change handler
 * @param props.placeholder - Placeholder text
 * @returns Compose editor JSX
 */
function ComposeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Auto-resize textarea on value change
   */
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    function resize() {
      if (!textarea) return
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }

    resize()
    textarea.addEventListener("input", resize)
    return () => {
      textarea.removeEventListener("input", resize)
    }
  }, [value])

  /**
   * Focus the textarea when it mounts
   */
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      // Move cursor to end
      textarea.selectionStart = textarea.value.length
      textarea.selectionEnd = textarea.value.length
    }
  }, [])

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Write one item per line. Section headers (UPPERCASE) separate different fields.
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none rounded-lg border border-border bg-background p-4",
          "text-sm leading-relaxed font-mono",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
          "placeholder:text-muted-foreground/40",
          "min-h-[200px]"
        )}
        spellCheck={false}
      />
    </div>
  )
}

/**
 * Displays a labeled field value
 * @param props - Field display props
 * @returns Field display JSX
 */
function FieldDisplay({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-sm", multiline && "leading-relaxed")}>
        {value || "---"}
      </div>
    </div>
  )
}

/**
 * Color mapping for sub-items
 */
const SUB_ITEM_COLORS: Record<
  ColorScheme,
  { border: string; bg: string; hover: string }
> = {
  blue: {
    border: "border-sky-200/40 dark:border-sky-500/20",
    bg: "bg-sky-500/5",
    hover: "hover:bg-sky-500/10",
  },
  pink: {
    border: "border-pink-200/40 dark:border-pink-500/20",
    bg: "bg-pink-500/5",
    hover: "hover:bg-pink-500/10",
  },
  emerald: {
    border: "border-emerald-200/40 dark:border-emerald-500/20",
    bg: "bg-emerald-500/5",
    hover: "hover:bg-emerald-500/10",
  },
  violet: {
    border: "border-violet-200/40 dark:border-violet-500/20",
    bg: "bg-violet-500/5",
    hover: "hover:bg-violet-500/10",
  },
  amber: {
    border: "border-amber-200/40 dark:border-amber-500/20",
    bg: "bg-amber-500/5",
    hover: "hover:bg-amber-500/10",
  },
}

/**
 * Individual editable/deletable item within a section
 * @param props - Sub item props
 * @returns Sub item JSX
 */
function SubItem({
  title,
  description,
  colorScheme,
  onEdit,
  onDelete,
}: {
  title: string
  description?: string
  colorScheme: ColorScheme
  onEdit: () => void
  onDelete: () => void
}) {
  const colors = SUB_ITEM_COLORS[colorScheme]

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col space-y-2 transition-all duration-200",
        colors.border,
        colors.bg,
        colors.hover
      )}
    >
      <div className="font-medium text-sm">{title}</div>
      {description && (
        <div className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onEdit} className="h-7">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
