/**
 * Lab Result Parser
 * Pure TypeScript — zero UI imports.
 * Extracts cannabinoid percentages from unstructured text using regex.
 */

import { ValidationError } from './errors'

export interface ParsedLabResult {
  thcaPct: number | null
  thcPct: number | null
  cbdaPct: number | null
  cbdPct: number | null
}

/* ------------------------------------------------------------------ */
/* Regex patterns for common lab report formats                        */
/* ------------------------------------------------------------------ */

const THCA_PATTERNS = [
  // mg/g first — avoids plain number being captured by percentage pattern
  /\bTHCA\b[:\s=]*((?:\d+(?:\.\d+)?)\s*mg\/g)/i,
  // Percentage with explicit %
  /\bTHCA\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  /Total\s+THCA\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  // "THCA (%) 22.4" or "THCA 22.4"
  /\bTHCA\b\s*\(?%?\)?[:\s]+(\d+(?:\.\d+)?)/i,
  // Fallback for bare `THCA = 22.4` without %
  /\bTHCA\b[:\s=]+(\d+(?:\.\d+)?)/i,
]

const THC_PATTERNS = [
  // mg/g first
  /\bTHC\b[:\s=]*((?:\d+(?:\.\d+)?)\s*mg\/g)/i,
  // Percentage with explicit %
  /\bTHC\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  /Delta[-\s]?9[-\s]?THC\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  /Total\s+THC\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  // Fallback for bare `THC = 0.8` without %
  /\bTHC\b[:\s=]+(\d+(?:\.\d+)?)/i,
]

const CBDA_PATTERNS = [
  // mg/g first
  /\bCBDA\b[:\s=]*((?:\d+(?:\.\d+)?)\s*mg\/g)/i,
  // Percentage with explicit %
  /\bCBDA\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  /Total\s+CBDA\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  // Fallback for bare `CBDA = 15.2` without %
  /\bCBDA\b[:\s=]+(\d+(?:\.\d+)?)/i,
]

const CBD_PATTERNS = [
  // mg/g first
  /\bCBD\b[:\s=]*((?:\d+(?:\.\d+)?)\s*mg\/g)/i,
  // Percentage with explicit %
  /\bCBD\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  /Total\s+CBD\b[:\s=]*(\d+(?:\.\d+)?)\s*%/i,
  // Fallback for bare `CBD = 0.5` without %
  /\bCBD\b[:\s=]+(\d+(?:\.\d+)?)/i,
]

/* ------------------------------------------------------------------ */
/* Extract a single value from text using multiple patterns           */
/* ------------------------------------------------------------------ */

function extractValue(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const raw = match[1]
      // Detect mg/g format from the full match
      const isMgPerGram = raw.toLowerCase().includes('mg/g')
      const numericValue = parseFloat(raw)
      if (Number.isNaN(numericValue)) continue

      if (isMgPerGram) {
        // mg/g → % (divide by 10: 205 mg/g = 20.5%)
        const pct = numericValue / 10
        if (pct >= 0 && pct <= 100) return Math.round(pct * 100) / 100
        return null
      }

      // Percentage format
      if (numericValue >= 0 && numericValue <= 100)
        return Math.round(numericValue * 100) / 100
      // If > 100 (no mg/g suffix), reject as unlikely
      return null
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse raw lab text and extract cannabinoid percentages.
 * Returns null values for any cannabinoid not found.
 */
export function parseLabText(text: string): ParsedLabResult {
  if (!text || text.trim().length === 0) {
    return { thcaPct: null, thcPct: null, cbdaPct: null, cbdPct: null }
  }

  return {
    thcaPct: extractValue(text, THCA_PATTERNS),
    thcPct: extractValue(text, THC_PATTERNS),
    cbdaPct: extractValue(text, CBDA_PATTERNS),
    cbdPct: extractValue(text, CBD_PATTERNS),
  }
}

/**
 * Parse lab text with strict validation.
 * Throws ValidationError if no cannabinoid values are detected.
 */
export function parseLabTextStrict(text: string): ParsedLabResult {
  const result = parseLabText(text)

  if (
    result.thcaPct == null &&
    result.thcPct == null &&
    result.cbdaPct == null &&
    result.cbdPct == null
  ) {
    throw new ValidationError('No cannabinoid values detected')
  }

  return result
}

/**
 * Check if text contains any recognizable cannabinoid data.
 */
export function looksLikeLabData(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  const result = parseLabText(text)
  return (
    result.thcaPct != null ||
    result.thcPct != null ||
    result.cbdaPct != null ||
    result.cbdPct != null
  )
}
