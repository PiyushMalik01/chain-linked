/**
 * Company Analysis Workflow
 * @description Inngest function that orchestrates company analysis using Firecrawl, Perplexity, and OpenAI
 * @module lib/inngest/functions/analyze-company
 */

import * as Sentry from '@sentry/nextjs'
import { inngest } from '../client'
import { scrapeWebsiteForAnalysis } from '@/lib/firecrawl'
import { researchCompany } from '@/lib/perplexity'
import { createOpenAIClient, chatCompletion } from '@/lib/ai/openai-client'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client for background jobs
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * Company analysis result structure
 * Note: brandColors are extracted from Firecrawl, not OpenAI
 */
interface CompanyAnalysisResult {
  valueProposition: string
  companySummary: string
  productsAndServices: Array<{ name: string; description: string }>
  targetAudience: {
    industries: string[]
    companySize: string
    roles: string[]
    painPoints: string[]
  }
  toneOfVoice: {
    descriptors: string[]
    writingStyle: string
    examples: string[]
  }
}

/**
 * System prompt for company analysis
 */
const ANALYSIS_SYSTEM_PROMPT = `You are an expert business analyst. Analyze the provided company information and extract structured data.

Return a JSON object with the following structure:
{
  "valueProposition": "1-2 sentence core value proposition",
  "companySummary": "2-3 sentence company overview",
  "productsAndServices": [
    { "name": "Product Name", "description": "Brief description" }
  ],
  "targetAudience": {
    "industries": ["Industry 1", "Industry 2"],
    "companySize": "e.g., SMB, Mid-Market, Enterprise",
    "roles": ["Role 1", "Role 2"],
    "painPoints": ["Pain point 1", "Pain point 2"]
  },
  "toneOfVoice": {
    "descriptors": ["Professional", "Friendly", "Innovative"],
    "writingStyle": "Description of their communication style",
    "examples": ["Example phrase 1", "Example phrase 2"]
  }
}

Be concise and focus on information useful for LinkedIn content creation.
Return ONLY the JSON object, no additional text.`

/**
 * Parse analysis response from AI
 */
function parseAnalysisResponse(content: string): CompanyAnalysisResult | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      valueProposition: parsed.valueProposition || '',
      companySummary: parsed.companySummary || '',
      productsAndServices: Array.isArray(parsed.productsAndServices) ? parsed.productsAndServices : [],
      targetAudience: {
        industries: Array.isArray(parsed.targetAudience?.industries) ? parsed.targetAudience.industries : [],
        companySize: parsed.targetAudience?.companySize || '',
        roles: Array.isArray(parsed.targetAudience?.roles) ? parsed.targetAudience.roles : [],
        painPoints: Array.isArray(parsed.targetAudience?.painPoints) ? parsed.targetAudience.painPoints : [],
      },
      toneOfVoice: {
        descriptors: Array.isArray(parsed.toneOfVoice?.descriptors) ? parsed.toneOfVoice.descriptors : [],
        writingStyle: parsed.toneOfVoice?.writingStyle || '',
        examples: Array.isArray(parsed.toneOfVoice?.examples) ? parsed.toneOfVoice.examples : [],
      },
    }
  } catch (error) {
    console.error('[Inngest] Failed to parse analysis response:', error)
    Sentry.captureException(error, {
      tags: { feature: 'inngest', function: 'analyze-company', step: 'parse-response' },
    })
    return null
  }
}

/**
 * Update company context status in database
 */
async function updateStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyContextId: string,
  status: string,
  additionalFields?: Record<string, unknown>
) {
  const { error } = await supabase
    .from('company_context')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...additionalFields,
    })
    .eq('id', companyContextId)

  if (error) {
    console.error(`[Inngest] Failed to update status to ${status}:`, error)
  }
}

/**
 * Company analysis workflow
 * Orchestrates: Firecrawl → Perplexity → OpenAI → Database
 */
export const analyzeCompanyWorkflow = inngest.createFunction(
  {
    id: 'company-analyze',
    name: 'Analyze Company',
    retries: 2,
  },
  { event: 'company/analyze' },
  async ({ event, step }) => {
    const {
      userId,
      companyContextId,
      companyName,
      websiteUrl,
      industry,
      targetAudienceInput,
    } = event.data

    const supabase = getSupabaseAdmin()

    // Step 1: Scrape website with Firecrawl
    const scrapedData = await step.run('scrape-website', async () => {
      await updateStatus(supabase, companyContextId, 'scraping')

      if (!websiteUrl) {
        return { content: '', brandColors: [], success: false, error: 'No website URL provided' }
      }

      const result = await scrapeWebsiteForAnalysis(websiteUrl)

      // Save scraped content to database
      if (result.success) {
        await supabase
          .from('company_context')
          .update({ scraped_content: result.content })
          .eq('id', companyContextId)
      }

      return result
    })

    // Step 2: Research company with Perplexity
    const researchData = await step.run('research-company', async () => {
      await updateStatus(supabase, companyContextId, 'researching')

      const result = await researchCompany(companyName, websiteUrl, targetAudienceInput)

      // Save research to database
      if (result.success) {
        await supabase
          .from('company_context')
          .update({ perplexity_research: result.research })
          .eq('id', companyContextId)
      }

      return result
    })

    // Step 3: Analyze with OpenAI
    const analysisResult = await step.run('analyze-with-openai', async () => {
      await updateStatus(supabase, companyContextId, 'analyzing')

      // Build context for analysis
      let analysisContext = `Company: ${companyName}\n`

      if (industry) {
        analysisContext += `Industry: ${industry}\n`
      }

      if (targetAudienceInput) {
        analysisContext += `Target Audience Hint: ${targetAudienceInput}\n`
      }

      if (scrapedData.success && scrapedData.content) {
        // Truncate to avoid token limits
        const truncatedContent = scrapedData.content.substring(0, 8000)
        analysisContext += `\n--- Website Content ---\n${truncatedContent}\n`
      }

      if (researchData.success && researchData.research) {
        analysisContext += `\n--- Research Data ---\n${researchData.research}\n`
      }

      // Use OpenRouter API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not configured')
      }

      const client = createOpenAIClient({ apiKey })

      const response = await chatCompletion(client, {
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        userMessage: analysisContext,
        temperature: 0.3, // Lower temperature for more consistent JSON output
        maxTokens: 2048,
      })

      return parseAnalysisResponse(response.content)
    })

    // Step 4: Save results to database
    await step.run('save-results', async () => {
      if (!analysisResult) {
        await updateStatus(supabase, companyContextId, 'failed', {
          error_message: 'Failed to parse analysis results',
        })
        throw new Error('Analysis failed')
      }

      // Combine brand colors from scraping and any additional ones
      const brandColors = scrapedData.brandColors || []

      const { error } = await supabase
        .from('company_context')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          value_proposition: analysisResult.valueProposition,
          company_summary: analysisResult.companySummary,
          products_and_services: analysisResult.productsAndServices,
          target_audience: analysisResult.targetAudience,
          tone_of_voice: analysisResult.toneOfVoice,
          brand_colors: brandColors,
          error_message: null,
        })
        .eq('id', companyContextId)

      if (error) {
        throw new Error(`Failed to save results: ${error.message}`)
      }

      return { success: true }
    })

    // Emit completion event
    await step.sendEvent('send-completion-event', {
      name: 'company/analyze.completed',
      data: {
        userId,
        companyContextId,
        success: true,
      },
    })

    return {
      success: true,
      companyContextId,
    }
  }
)
