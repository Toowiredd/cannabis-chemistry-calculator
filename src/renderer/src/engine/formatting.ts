/**
 * Output formatting utilities for the Cannabis Chemistry Calculator.
 * Pure TypeScript — zero UI imports.
 */

/**
 * Count significant figures in a numeric string.
 *
 * Rules:
 * - All non-zero digits are significant
 * - Zeros between non-zero digits are significant
 * - Trailing zeros after a decimal point are significant
 * - Leading zeros are not significant
 * - For integers without a decimal point, all digits are treated as significant
 *   (conservative: we assume the user typed what they meant)
 */
export function countSigFigs(input: string): number {
  const s = input.trim()
  if (!s || Number.isNaN(parseFloat(s))) return Infinity

  // Remove sign
  const num = s.replace(/^-/, '')

  if (num.includes('.')) {
    // Decimal present: remove the decimal, then strip leading zeros
    const digits = num.replace('.', '').replace(/^0+/, '')
    return digits.length || 1
  }

  // Integer: count all digits (conservative)
  const digits = num.replace(/^0+/, '')
  return digits.length || 1
}

/**
 * Round a value to a given number of significant figures.
 */
export function roundToSigFigs(value: number, sigFigs: number): number {
  if (value === 0 || !Number.isFinite(value)) return value
  const d = Math.ceil(Math.log10(Math.abs(value)))
  const power = sigFigs - d
  const factor = 10 ** power
  return Math.round(value * factor) / factor
}

/**
 * Format a number with a given number of significant figures.
 * Decimal places are capped at 1 to respect app-wide convention.
 */
export function formatWithSigFigs(value: number, sigFigs: number): string {
  const rounded = roundToSigFigs(value, sigFigs)
  if (rounded === 0) return '0'

  const d = Math.ceil(Math.log10(Math.abs(rounded))) || 1
  const decimals = Math.max(0, Math.min(sigFigs - d, 1))
  return rounded.toFixed(decimals)
}

/**
 * Compute the minimum significant figures across a set of input strings.
 * Empty or invalid strings are ignored.
 */
export function minSigFigs(...inputs: string[]): number {
  const counts = inputs
    .map(s => countSigFigs(s))
    .filter(n => n !== Infinity && n > 0)
  if (counts.length === 0) return 3 // default precision
  return Math.min(...counts)
}
