/**
 * Cryptographic Utilities for API Key Encryption
 * @description AES-256-GCM encryption for secure API key storage
 * @module lib/crypto
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Encryption algorithm used for API keys
 */
const ALGORITHM = 'aes-256-gcm'

/**
 * IV length in bytes (96 bits recommended for GCM)
 */
const IV_LENGTH = 12

/**
 * Auth tag length in bytes
 */
const AUTH_TAG_LENGTH = 16

/**
 * Gets the encryption key from environment variables
 * @returns Buffer containing the 32-byte encryption key
 * @throws Error if encryption secret is not configured
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET

  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is not set')
  }

  // If the secret is a hex string, convert it to buffer
  if (secret.length === 64) {
    return Buffer.from(secret, 'hex')
  }

  // If the secret is a plain string, hash it to get 32 bytes
  // This is less secure but provides a fallback
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The text to encrypt (e.g., API key)
 * @returns Base64 encoded string containing IV + ciphertext + auth tag
 * @example
 * const encrypted = encrypt('sk-abc123...')
 * // Returns base64 encoded encrypted data
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'base64'),
    authTag,
  ])

  return combined.toString('base64')
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param encryptedData - Base64 encoded string from encrypt()
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 * @example
 * const apiKey = decrypt(encryptedKeyFromDB)
 * // Returns original API key
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encryptedContent = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedContent)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * Attempts to decrypt a value, falling back to the raw string if decryption fails.
 * Handles tokens that were stored as plaintext before encryption was added.
 * @param value - Possibly encrypted string, or plaintext fallback
 * @returns Decrypted or raw plaintext string
 */
export function safeDecrypt(value: string): string {
  try {
    return decrypt(value)
  } catch {
    return value
  }
}

/**
 * Creates a hint for an API key (last 4 characters)
 * @param apiKey - The full API key
 * @returns A masked hint like "...abc1"
 * @example
 * const hint = createKeyHint('sk-proj-abc123xyz789')
 * // Returns '...9789'
 */
export function createKeyHint(apiKey: string): string {
  if (apiKey.length < 4) {
    return '...'
  }
  return `...${apiKey.slice(-4)}`
}

/**
 * Validates OpenRouter/OpenAI API key format
 * @param apiKey - The API key to validate (OpenRouter: sk-or-v1-... or OpenAI: sk-...)
 * @returns Object with isValid boolean and error message if invalid
 * @example
 * const result = validateOpenAIKeyFormat('sk-or-v1-abc123...')
 * // Returns { isValid: true }
 */
export function validateOpenAIKeyFormat(apiKey: string): { isValid: boolean; error?: string } {
  const trimmedKey = apiKey.trim()

  if (!trimmedKey) {
    return { isValid: false, error: 'API key is required' }
  }

  // Accept both OpenRouter (sk-or-) and legacy OpenAI (sk-) keys
  if (!trimmedKey.startsWith('sk-')) {
    return { isValid: false, error: "Invalid API key format. Keys should start with 'sk-'" }
  }

  if (trimmedKey.length < 20) {
    return { isValid: false, error: 'API key appears to be too short' }
  }

  return { isValid: true }
}
