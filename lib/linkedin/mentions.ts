/**
 * LinkedIn Mention Utilities
 * @description Parsing, encoding, and converting @mention tokens
 * for LinkedIn post creation. Supports both UGC API (attributes array)
 * and REST Posts API (inline @[Name](URN) format).
 * @module lib/linkedin/mentions
 */

/**
 * Regex to match mention tokens: @[Display Name](urn:li:person:xxx)
 * Captures: group 1 = display name, group 2 = full URN
 */
export const MENTION_REGEX = /@\[([^\]]+)\]\((urn:li:(?:person|organization):[^\)]+)\)/g

/**
 * Parsed mention with position info
 */
export interface ParsedMention {
  /** Display name shown to the user */
  name: string
  /** LinkedIn URN (e.g., urn:li:person:abc123) */
  urn: string
  /** Start index of the full token in the original text */
  start: number
  /** Length of the full token in the original text */
  length: number
}

/**
 * UGC API mention attribute
 */
export interface MentionAttribute {
  start: number
  length: number
  value: {
    'com.linkedin.common.MemberAttributedEntity': {
      member: string
    }
  }
}

/**
 * Parse all mention tokens from text
 * @param text - Raw text with mention tokens
 * @returns Array of parsed mentions with positions
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = []
  const regex = new RegExp(MENTION_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      name: match[1],
      urn: match[2],
      start: match.index,
      length: match[0].length,
    })
  }

  return mentions
}

/**
 * Replace mention tokens with just display names (for UGC API text field)
 * @param text - Raw text with mention tokens
 * @returns Plain text with names only
 */
export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_REGEX, '$1')
}

/**
 * Build UGC API attributes array from mention tokens.
 * Calculates correct character positions after token -> name replacement.
 *
 * NOTE: LinkedIn's UGC API expects `start` and `length` as UTF-16 code unit
 * offsets, which is exactly what JavaScript's `.length` and `RegExp.index`
 * provide. This means the current implementation is correct even for text
 * containing characters outside the BMP (e.g. emoji), because JS strings
 * are natively UTF-16 and surrogate pairs are counted as 2 units by `.length`.
 *
 * @param text - Raw text with mention tokens
 * @returns Object with plain text and attributes array
 */
export function buildUgcMentionAttributes(text: string): {
  plainText: string
  attributes: MentionAttribute[]
} {
  const mentions = parseMentions(text)
  const attributes: MentionAttribute[] = []

  // Track the cumulative offset as we replace tokens with names
  let offset = 0
  let plainText = text

  for (const mention of mentions) {
    const token = `@[${mention.name}](${mention.urn})`
    const adjustedStart = mention.start - offset

    // Replace this token with just the name
    plainText =
      plainText.slice(0, adjustedStart) +
      mention.name +
      plainText.slice(adjustedStart + token.length)

    attributes.push({
      start: adjustedStart,
      length: mention.name.length,
      value: {
        'com.linkedin.common.MemberAttributedEntity': {
          member: mention.urn,
        },
      },
    })

    // Update offset: token is longer than name
    offset += token.length - mention.name.length
  }

  return { plainText, attributes }
}

/**
 * Check if text contains any mention tokens
 * @param text - Text to check
 * @returns True if text contains mention tokens
 */
export function hasMentions(text: string): boolean {
  // Use a fresh regex (not the global one) to avoid lastIndex state issues
  return /@\[([^\]]+)\]\((urn:li:(?:person|organization):[^)]+)\)/.test(text)
}

/**
 * Build a mention token string
 * @param name - Display name
 * @param urn - LinkedIn URN
 * @returns Formatted mention token
 */
export function buildMentionToken(name: string, urn: string): string {
  return `@[${name}](${urn})`
}

/**
 * Count characters excluding mention token overhead.
 * For LinkedIn character limit, mentions count as just the display name.
 * Uses UTF-16 code unit length (.length) instead of code-point length
 * because LinkedIn's API counts surrogate pairs (e.g. Unicode bold/italic
 * characters like 𝗛) as 2 characters, not 1.
 * @param text - Raw text with mention tokens
 * @returns Character count with mentions counted as display names only
 */
export function countCharactersWithMentions(text: string): number {
  const plainText = mentionsToPlainText(text)
  return plainText.length
}
