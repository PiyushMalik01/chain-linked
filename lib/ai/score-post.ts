import { createClient } from "@/lib/supabase/server"
import { scoreContent } from "./quality-score-lite"

/**
 * Fire-and-forget: compute rule-based score and persist to generated_posts.
 * LLM scoring and fact-check are handled by the admin batch pipeline.
 *
 * Note: rule_score, rule_grade, rule_breakdown columns exist in the DB
 * (added via migration) but are not yet in the generated TypeScript types.
 */
export async function scorePostBackground(postId: string, content: string): Promise<void> {
  try {
    const supabase = await createClient()
    const score = scoreContent(content)
    await supabase
      .from("generated_posts")
      .update({
        rule_score: score.total,
        rule_grade: score.grade,
        rule_breakdown: score.breakdown,
      } as Record<string, unknown>)
      .eq("id", postId)
  } catch (err) {
    console.error("[score-post] Background scoring failed:", err)
  }
}
