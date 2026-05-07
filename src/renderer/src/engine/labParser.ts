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
  // "THCA: 22.4%", "THCa 22.4 %", "THCA = 22.4"
  /\bTHCA\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "Total THCA: 22.4"
  /Total\s+THCA\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "THCA (%) 22.4"
  /\bTHCA\b\s*\(?%?\)?[:\s]+(\d+(?:\.\d+)?)/i,
]

const THC_PATTERNS = [
  // "THC: 0.8%", "THC 0.8 %", "THC = 0.8"
  /\bTHC\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "Delta-9-THC: 0.8"
  /Delta[-\s]?9[-\s]?THC\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "Total THC 0.8"
  /Total\s+THC\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
]

const CBDA_PATTERNS = [
  // "CBDA: 15.2%"
  /\bCBDA\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "Total CBDA 15.2"
  /Total\s+CBDA\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
]

const CBD_PATTERNS = [
  // "CBD: 0.5%"
  /\bCBD\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
  // "Total CBD 0.5"
  /Total\s+CBD\b[:\s=]+(\d+(?:\.\d+)?)\s*%?/i,
]

/* ------------------------------------------------------------------ */
/* Extract a single value from text using multiple patterns           */
/* ------------------------------------------------------------------ */

function extractValue(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      if (!Number.isNaN(value)) {
        // Clamp to reasonable range [0, 100]
        if (value >= 0 && value <= 100) return Math.round(value * 100) / 100
        // If > 100 it might be mg/g (multiply by 10 to get %)
        if (value > 100 && value <= 1000) return Math.round(value * 10) / 100
      }
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
