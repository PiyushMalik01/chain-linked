/**
 * Swipe Suggestions Generation Workflow
 * @description Inngest function that generates personalized LinkedIn post suggestions
 * based on user's company context from onboarding.
 * @module lib/inngest/functions/generate-suggestions
 */

import { inngest } from '../client'
import { createOpenAIClient, chatCompletion } from '@/lib/ai/openai-client'
import { createClient } from '@supabase/supabase-js'
import {
  buildContentIdeasSystemPrompt,
  buildPostExpansionPrompt,
  parseContentIdeasResponse,
  validateGeneratedPost,
  TEMPERATURE_SETTINGS,
  type CompanyContext,
  type ContentIdea,
} from '@/lib/ai/suggestion-prompts'

/**
 * Maximum number of active suggestions a user can have
 */
const MAX_ACTIVE_SUGGESTIONS = 10

/**
 * Default number of content ideas to generate per batch (used as fallback)
 */
const DEFAULT_IDEAS_PER_BATCH = 10

/**
 * Supabase admin client for background jobs
 * Uses service role key to bypass RLS
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

/**
 * Structure for a generated suggestion to be saved
 */
interface GeneratedSuggestion {
  userId: string
  content: string
  postType: string
  category: string
  estimatedEngagement: number
  promptContext: {
    companyName: string
    industry: string | null
    topicGenerated: string
    hookUsed: string
  }
  generationBatchId: string
}

/**
 * Updates the status of a generation run in the database
 * @param supabase - Supabase admin client
 * @param runId - Generation run ID
 * @param status - New status to set
 * @param additionalFields - Optional additional fields to update
 */
async function updateRunStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  runId: string,
  status: string,
  additionalFields?: Record<string, unknown>
) {
  const { error } = await supabase
    .from('suggestion_generation_runs')
    .update({
      status,
      ...additionalFields,
    })
    .eq('id', runId)

  if (error) {
    console.error(`[Inngest] Failed to update run status to ${status}:`, error)
  }
}

/**
 * Swipe suggestions generation workflow
 * Orchestrates: Validate -> Generate Ideas -> Expand Posts -> Save Results
 */
export const generateSuggestionsWorkflow = inngest.createFunction(
  {
    id: 'swipe-generate-suggestions',
    name: 'Generate Swipe Suggestions',
    retries: 2,
  },
  { event: 'swipe/generate-suggestions' },
  async ({ event, step }) => {
    const { userId, runId, suggestionsToGenerate: requestedCount } = event.data
    const supabase = getSupabaseAdmin()

    // Step 1: Validate and prepare
    const prepareResult = await step.run('validate-and-prepare', async () => {
      // Fetch user's company data from company_context table
      const { data: companyCtx, error: ctxError } = await supabase
        .from('company_context')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (ctxError || !companyCtx) {
        await updateRunStatus(supabase, runId, 'failed', {
          error_message: 'Company context not found. Please complete onboarding first.',
        })
        throw new Error('Company context not found')
      }

      // Check if company data is populated
      const hasCompanyData = companyCtx.company_name && (
        companyCtx.company_summary ||
        companyCtx.value_proposition ||
        companyCtx.products_and_services ||
        companyCtx.target_audience
      )

      if (!hasCompanyData) {
        await updateRunStatus(supabase, runId, 'failed', {
          error_message: 'Company context not complete. Please add your company information in onboarding.',
        })
        throw new Error('Company context not complete')
      }

      // Map company_context directly to CompanyContext format
      const companyContext: CompanyContext = {
        id: companyCtx.id,
        user_id: userId,
        company_name: companyCtx.company_name,
        website_url: companyCtx.website_url || null,
        industry: companyCtx.industry || null,
        target_audience_input: companyCtx.target_audience_input || null,
        value_proposition: companyCtx.value_proposition || null,
        company_summary: companyCtx.company_summary || null,
        products_and_services: Array.isArray(companyCtx.products_and_services)
          ? companyCtx.products_and_services
          : [],
        target_audience: companyCtx.target_audience || {},
        tone_of_voice: companyCtx.tone_of_voice || { style: 'professional', traits: [] },
        brand_colors: companyCtx.brand_colors || [],
      }

      // Check active suggestion count
      const { count: activeSuggestionCount, error: countError } = await supabase
        .from('generated_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active')

      if (countError) {
        console.error('[Inngest] Failed to count active suggestions:', countError)
      }

      if ((activeSuggestionCount ?? 0) >= MAX_ACTIVE_SUGGESTIONS) {
        await updateRunStatus(supabase, runId, 'failed', {
          error_message: `Maximum active suggestions reached (${MAX_ACTIVE_SUGGESTIONS}). Please use or dismiss existing suggestions.`,
        })
        throw new Error('Maximum active suggestions reached')
      }

      // Update run status to generating
      await updateRunStatus(supabase, runId, 'generating', {})

      return {
        companyContext,
        existingCount: activeSuggestionCount ?? 0,
      }
    })

    // Step 2: Generate content ideas using AI
    const contentIdeas = await step.run('generate-content-ideas', async () => {
      const { companyContext } = prepareResult

      // Get OpenRouter API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not configured')
      }

      const client = createOpenAIClient({ apiKey, timeout: 60000 })

      // Build system prompt with company context
      const systemPrompt = buildContentIdeasSystemPrompt(companyContext)

      // Use the requested count from the API, capped at MAX, fallback to default
      const ideasToGenerate = Math.min(
        requestedCount || DEFAULT_IDEAS_PER_BATCH,
        MAX_ACTIVE_SUGGESTIONS - prepareResult.existingCount
      ) || DEFAULT_IDEAS_PER_BATCH

      // Request for content ideas
      const userMessage = `Generate ${ideasToGenerate} diverse LinkedIn post ideas for ${companyContext.company_name}.

Focus on topics that:
1. Showcase their expertise in ${companyContext.industry || 'their industry'}
2. Address their target audience's pain points
3. Align with their value proposition: "${companyContext.value_proposition || 'helping customers succeed'}"

Ensure a good mix of post types and categories. Return ONLY the JSON array.`

      const response = await chatCompletion(client, {
        systemPrompt,
        userMessage,
        temperature: TEMPERATURE_SETTINGS.ideas,
        maxTokens: 4096,
      })

      // Parse and validate the response
      const ideas = parseContentIdeasResponse(response.content)

      if (ideas.length === 0) {
        throw new Error('No valid content ideas generated')
      }

      console.log(`[Inngest] Generated ${ideas.length} content ideas for user ${userId}`)

      return ideas
    })

    // Step 3: Expand ideas into full posts
    const expandedPosts = await step.run('expand-ideas-to-posts', async () => {
      const { companyContext } = prepareResult

      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not configured')
      }

      const client = createOpenAIClient({ apiKey, timeout: 60000 })

      const expandedResults: Array<{
        idea: ContentIdea
        content: string
        isValid: boolean
      }> = []

      // Process each idea sequentially to avoid rate limits
      for (let i = 0; i < contentIdeas.length; i++) {
        const idea = contentIdeas[i]

        // Alternate between short and medium lengths
        const length = i % 2 === 0 ? 'short' : 'medium'

        try {
          // Build expansion prompt
          const expansionPrompt = buildPostExpansionPrompt(companyContext, idea, length)

          const response = await chatCompletion(client, {
            systemPrompt: expansionPrompt,
            userMessage: `Write the complete LinkedIn post about: "${idea.topic}"

Start with a variation of this hook: "${idea.hook}"

Make sure to cover these key points:
${idea.keyPoints.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}

Remember: Return ONLY the post content, nothing else.`,
            temperature: TEMPERATURE_SETTINGS.expansion,
            maxTokens: 2048,
          })

          // Validate the generated post
          const validation = validateGeneratedPost(response.content, length)

          expandedResults.push({
            idea,
            content: response.content.trim(),
            isValid: validation.isValid || validation.issues.length <= 2, // Allow minor issues
          })

          if (!validation.isValid) {
            console.log(
              `[Inngest] Post validation warnings for idea "${idea.topic}":`,
              validation.issues
            )
          }
        } catch (error) {
          console.error(`[Inngest] Failed to expand idea "${idea.topic}":`, error)
          // Continue with other ideas, don't fail the whole batch
        }

        // Small delay between API calls to avoid rate limiting
        if (i < contentIdeas.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      // Filter to only valid posts
      const validPosts = expandedResults.filter((r) => r.isValid && r.content.length > 100)

      if (validPosts.length === 0) {
        throw new Error('No valid posts generated after expansion')
      }

      console.log(
        `[Inngest] Expanded ${validPosts.length} valid posts for user ${userId}`
      )

      return validPosts
    })

    // Step 4: Save suggestions to database
    const saveResult = await step.run('save-suggestions', async () => {
      const { companyContext, existingCount } = prepareResult

      // Cap the number of posts to save so we never exceed MAX_ACTIVE_SUGGESTIONS
      const maxToSave = MAX_ACTIVE_SUGGESTIONS - existingCount
      const postsToSave = expandedPosts.slice(0, Math.max(maxToSave, 0))

      if (postsToSave.length === 0) {
        await updateRunStatus(supabase, runId, 'completed', {
          suggestions_generated: 0,
          completed_at: new Date().toISOString(),
        })
        return { batchId: '', count: 0, postTypes: [] as string[] }
      }

      // Generate a batch ID to group these suggestions
      const batchId = crypto.randomUUID()

      // Prepare suggestions for insertion
      const suggestions: Array<{
        user_id: string
        content: string
        post_type: string
        category: string
        estimated_engagement: number
        prompt_context: Record<string, unknown>
        generation_batch_id: string
        status: string
        expires_at: string
      }> = postsToSave.map(({ idea, content }) => ({
        user_id: userId,
        content,
        post_type: idea.postType,
        category: idea.category,
        estimated_engagement: idea.estimatedEngagement,
        prompt_context: {
          companyName: companyContext.company_name,
          industry: companyContext.industry,
          topicGenerated: idea.topic,
          hookUsed: idea.hook,
          keyPoints: idea.keyPoints,
        },
        generation_batch_id: batchId,
        status: 'active',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }))

      // Insert all suggestions
      const { data: insertedData, error: insertError } = await supabase
        .from('generated_suggestions')
        .insert(suggestions)
        .select('id')

      if (insertError) {
        console.error('[Inngest] Failed to insert suggestions:', insertError)
        throw new Error(`Failed to save suggestions: ${insertError.message}`)
      }

      const insertedCount = insertedData?.length ?? 0

      // Update the generation run with results
      await updateRunStatus(supabase, runId, 'completed', {
        suggestions_generated: insertedCount,
        post_types_used: [...new Set(suggestions.map((s) => s.post_type))],
        completed_at: new Date().toISOString(),
      })

      console.log(
        `[Inngest] Saved ${insertedCount} suggestions for user ${userId} (batch: ${batchId})`
      )

      return {
        batchId,
        count: insertedCount,
        postTypes: [...new Set(suggestions.map((s) => s.post_type))],
      }
    })

    // Step 5: Send completion event
    await step.sendEvent('send-completion-event', {
      name: 'swipe/suggestions-ready',
      data: {
        userId,
        runId,
        count: saveResult.count,
        success: true,
      },
    })

    return {
      success: true,
      runId,
      suggestionsGenerated: saveResult.count,
      batchId: saveResult.batchId,
      postTypes: saveResult.postTypes,
    }
  }
)
