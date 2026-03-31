/**
 * Edit Selection API Route
 * @description Non-streaming API for editing selected text within a post using AI.
 * Receives the selected text, an editing instruction, and the full post content,
 * then returns only the edited replacement text.
 * @module app/api/ai/edit-selection/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { resolveApiKey } from '@/lib/ai/resolve-api-key'
import { ANTI_AI_PROMPT_CONSTRAINTS } from '@/lib/ai/anti-ai-rules'

/**
 * Request body for the edit-selection endpoint
 */
interface EditSelectionRequest {
  /** The text that the user has selected */
  selectedText: string
  /** The user's instruction for how to edit the selection */
  instruction: string
  /** The full post content for context */
  fullPostContent: string
}

/**
 * POST /api/ai/edit-selection
 * Edits a selected portion of text per user instruction
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as EditSelectionRequest
    const { selectedText, instruction, fullPostContent } = body

    if (!selectedText?.trim()) {
      return NextResponse.json({ error: 'No text selected' }, { status: 400 })
    }

    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'No instruction provided' }, { status: 400 })
    }

    const resolved = await resolveApiKey(supabase, user.id)
    if (!resolved) {
      return NextResponse.json(
        { error: 'No API key found. Connect your ChatGPT account in Settings or set OPENROUTER_API_KEY in environment.' },
        { status: 400 }
      )
    }
    const aiApiKey = resolved.apiKey
    const isOpenAIDirect = resolved.provider === 'openai-direct'

    // Build system prompt for selection editing
    let systemPrompt = `You are a precise text editor for LinkedIn posts. Your job is to edit the selected text according to the user's instruction.

## Rules
- Return ONLY the edited text that should replace the selection
- Do NOT include any explanation, commentary, or surrounding context
- Do NOT wrap the output in quotes or markdown
- CRITICAL: Preserve all leading and trailing whitespace and newlines from the selected text exactly. If the selection starts or ends with newlines/blank lines, the output must too. Do NOT strip or add line breaks.
- Maintain the same general formatting style (line breaks, spacing between paragraphs, etc.) unless the instruction explicitly says otherwise
- If the instruction asks to expand, you may return more text than the selection
- If the instruction asks to shorten, return less text
- Keep the tone consistent with the rest of the post

${ANTI_AI_PROMPT_CONSTRAINTS}`

    // Inject content rules from database (non-blocking)
    try {
      const [{ data: personalRules }, { data: teamMember }] = await Promise.all([
        supabase
          .from('content_rules')
          .select('rule_text')
          .eq('user_id', user.id)
          .is('team_id', null)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
        supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1),
      ])

      let teamRules: { rule_text: string }[] = []
      if (teamMember?.[0]?.team_id) {
        const { data } = await supabase
          .from('content_rules')
          .select('rule_text')
          .eq('team_id', teamMember[0].team_id)
          .eq('is_active', true)
          .order('priority', { ascending: false })
        teamRules = data || []
      }

      const allRules = [...teamRules, ...(personalRules || [])]
      if (allRules.length > 0) {
        systemPrompt += `\n\n## MANDATORY Content Rules\nThe following rules MUST be followed in all generated content:\n${allRules.map(r => `- ${r.rule_text}`).join('\n')}`
      }
    } catch {
      // Content rules injection is non-blocking
    }

    const provider = createOpenAICompatible({
      name: isOpenAIDirect ? 'openai' : 'openrouter',
      apiKey: aiApiKey,
      baseURL: isOpenAIDirect ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1',
    })

    const result = await generateText({
      model: provider(isOpenAIDirect ? 'gpt-4o' : 'openai/gpt-5.4'),
      system: systemPrompt,
      prompt: `## Full Post Content (for context)
${fullPostContent}

## Selected Text to Edit
${selectedText}

## Editing Instruction
${instruction}

Return ONLY the edited replacement text:`,
      temperature: 0.7,
      maxOutputTokens: 1000,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'edit-selection',
      },
    })

    return NextResponse.json({ editedText: result.text })
  } catch (error) {
    console.error('Edit selection error:', error)
    return NextResponse.json(
      { error: 'Failed to edit selection.' },
      { status: 500 }
    )
  }
}
