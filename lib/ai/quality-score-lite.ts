interface QualityBreakdown {
  wordCount: number
  hookQuality: number
  hasCta: number
  formatting: number
  hashtags: number
  lengthFit: number
}

export interface QualityScore {
  total: number
  breakdown: QualityBreakdown
  grade: "low" | "medium" | "high"
}

export function scoreContent(content: string): QualityScore {
  if (!content || content.trim().length === 0) {
    return { total: 0, breakdown: { wordCount: 0, hookQuality: 0, hasCta: 0, formatting: 0, hashtags: 0, lengthFit: 0 }, grade: "low" }
  }

  const words = content.trim().split(/\s+/)
  const wordCount = words.length
  const lines = content.split("\n").filter((l) => l.trim().length > 0)
  const firstLine = lines[0]?.trim() || ""
  const lastParagraph = lines.slice(-2).join(" ").toLowerCase()
  const hashtagCount = (content.match(/#\w+/g) || []).length
  const charCount = content.length

  let wordScore = 0
  if (wordCount < 50) wordScore = 0
  else if (wordCount < 150) wordScore = 10
  else if (wordCount <= 400) wordScore = 25
  else if (wordCount <= 600) wordScore = 15
  else wordScore = 5

  let hookScore = 0
  if (firstLine.length > 0 && firstLine.length < 80) hookScore += 10
  if (/[?]/.test(firstLine) || /\d/.test(firstLine)) hookScore += 5
  if (/^[A-Z]/.test(firstLine)) hookScore += 5

  let ctaScore = 0
  if (/[?]/.test(lastParagraph)) ctaScore += 10
  if (/\b(follow|share|comment|check|try|visit|click|subscribe|join|dm|save|repost)\b/i.test(lastParagraph)) ctaScore += 5

  let formatScore = 0
  const lineBreaks = content.split("\n").length - 1
  if (lineBreaks >= 3) formatScore += 10
  const avgWordsPerLine = lines.length > 0 ? wordCount / lines.length : wordCount
  if (avgWordsPerLine < 40) formatScore += 5

  let hashtagScore = 0
  if (hashtagCount === 0) hashtagScore = 0
  else if (hashtagCount <= 2) hashtagScore = 5
  else if (hashtagCount <= 5) hashtagScore = 10
  else hashtagScore = 3

  let lengthScore = 0
  if (charCount < 30) lengthScore = 0
  else if (charCount < 200) lengthScore = 5
  else if (charCount <= 3000) lengthScore = 15
  else lengthScore = 8

  const total = wordScore + hookScore + ctaScore + formatScore + hashtagScore + lengthScore
  const grade = total <= 40 ? "low" : total <= 70 ? "medium" : "high"

  return { total, breakdown: { wordCount: wordScore, hookQuality: hookScore, hasCta: ctaScore, formatting: formatScore, hashtags: hashtagScore, lengthFit: lengthScore }, grade }
}
