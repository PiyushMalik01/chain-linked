/**
 * Company Analysis API Route
 * @description AI-powered website analysis to extract company context for onboarding
 * @module app/api/ai/analyze-company/route
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveApiKey, resolveClient } from "@/lib/ai/resolve-api-key"
import { codexChatCompletion } from "@/lib/ai/codex-client"
import {
  chatCompletion,
  OpenAIError,
  getErrorMessage,
  DEFAULT_MODEL,
} from "@/lib/ai/openai-client"
import { PromptService, PromptType } from '@/lib/prompts'

/**
 * Request body for company analysis
 */
interface AnalyzeCompanyRequest {
  /** Company website URL to analyze */
  websiteUrl: string
  /** Company name */
  companyName: string
  /** Industry hint (optional, from user selection) */
  industry?: string
  /** Target audience hint (optional, from user input) */
  targetAudience?: string
}

/**
 * Extracted company context returned by the AI
 */
interface CompanyAnalysisResult {
  /** Short value proposition */
  valueProposition: string
  /** List of products or services */
  productsAndServices: Array<{ name: string; description: string }>
  /** Target audience / ideal customer profile */
  targetAudience: {
    industries: string[]
    companySize: string
    roles: string[]
    painPoints: string[]
  }
  /** Tone of voice descriptors */
  toneOfVoice: {
    descriptors: string[]
    writingStyle: string
    examples: string[]
  }
  /** Brand colors extracted or inferred (hex codes) */
  brandColors: string[]
  /** Brief company summary */
  summary: string
}

/**
 * Builds the system prompt for company analysis
 * @param companyName - Name of the company
 * @param industry - Optional industry hint
 * @param targetAudience - Optional target audience hint
 * @returns System prompt string
 */
function buildAnalysisSystemPrompt(
  companyName: string,
  industry?: string,
  targetAudience?: string
): string {
  return `You are an expert business analyst and brand strategist. Your task is to analyze a company's website content and extract structured business context.

## Company Info
Company Name: ${companyName}
${industry ? `Industry hint: ${industry}` : ""}
${targetAudience ? `Target audience hint: ${targetAudience}` : ""}

## Your Task
Analyze the website content provided and extract the following information in JSON format:

1. **valueProposition**: A concise 1-2 sentence value proposition
2. **productsAndServices**: Array of objects with "name" and "description" fields
3. **targetAudience**: Object with:
   - "industries": Array of target industry strings
   - "companySize": String describing ideal company size
   - "roles": Array of target job titles/roles
   - "painPoints": Array of customer pain points addressed
4. **toneOfVoice**: Object with:
   - "descriptors": Array of 3-5 tone words (e.g., "professional", "friendly", "authoritative")
   - "writingStyle": Brief description of their writing style
   - "examples": 2-3 short example phrases that capture their voice
5. **brandColors**: Array of hex color codes you can identify or infer from the brand (if detectable, otherwise provide reasonable brand-appropriate colors)
6. **summary**: A 2-3 sentence company summary

## Output Format
Return ONLY valid JSON matching the structure above. No markdown, no explanations, no code fences.`
}

/**
 * POST /api/ai/analyze-company
 * Analyzes a company website and returns structured context
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeCompanyRequest
    const { websiteUrl, companyName, industry, targetAudience } = body

    if (!websiteUrl?.trim() || !companyName?.trim()) {
      return NextResponse.json(
        { error: "Company name and website URL are required" },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      )
    }

    // Build prompts
    const systemPrompt = buildAnalysisSystemPrompt(companyName, industry, targetAudience)
    const userMessage = `Please analyze this company website and extract the structured business context.

Company: ${companyName}
Website URL: ${websiteUrl}
${industry ? `Industry: ${industry}` : ""}
${targetAudience ? `Target Audience: ${targetAudience}` : ""}

Based on the company name, website URL, and any provided hints, generate a comprehensive analysis. If you cannot access the website directly, use your knowledge of the company or infer reasonable details from the company name and industry.

Return the analysis as valid JSON only.`

    // Route through Codex (ChatGPT subscription) or OpenRouter
    let response: { content: string; model: string; promptTokens: number; completionTokens: number; totalTokens: number; finishReason?: string | null }

    const resolved = await resolveApiKey(supabase, user.id)

    if (resolved?.provider === 'openai-oauth') {
      // Use Codex Responses API — bills against ChatGPT subscription
      response = {
        ...await codexChatCompletion(
          resolved.apiKey,
          resolved.accountId,
          { model: 'gpt-5.4', systemPrompt, userMessage }
        ),
        finishReason: 'stop',
      }
    } else {
      // Use OpenRouter via OpenAI SDK
      const openai = await resolveClient(supabase, user.id)
      if (!openai) {
        return NextResponse.json(
          { error: "No API key available. Connect your ChatGPT account or set OPENROUTER_API_KEY." },
          { status: 400 }
        )
      }

      response = await chatCompletion(openai, {
        systemPrompt,
        userMessage,
        model: DEFAULT_MODEL,
        temperature: 0.4,
        maxTokens: 2000,
      })
    }

    // Log usage (non-blocking)
    const estimatedCost = ((response.promptTokens ?? 0) * 0.0025 + (response.completionTokens ?? 0) * 0.015) / 1000
    PromptService.logUsage({
      promptType: PromptType.BASE_RULES,
      promptVersion: 1,
      userId: user.id,
      feature: 'analyze-company',
      inputTokens: response.promptTokens,
      outputTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      model: response.model,
      success: true,
      estimatedCost,
      metadata: { provider: resolved?.provider === 'openai-oauth' ? 'openai-oauth' : 'openrouter' },
    }).catch(() => {})

    // Parse JSON response
    let analysisData: CompanyAnalysisResult
    try {
      const cleaned = response.content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()
      analysisData = JSON.parse(cleaned) as CompanyAnalysisResult
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI analysis. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis: analysisData,
      metadata: {
        model: response.model,
        tokensUsed: response.totalTokens,
      },
    })
  } catch (error) {
    console.error("Company analysis error:", error)

    if (error instanceof OpenAIError) {
      return NextResponse.json(
        { error: getErrorMessage(error), errorType: error.type },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: "Failed to analyze company. Please try again." },
      { status: 500 }
    )
  }
}
