/**
 * Dose estimation engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 */
import { ValidationError } from './errors'

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 10) / 10
}

/**
 * Calculate mg of THC per serving.
 *
 * Formula: finalThcMg / servings
 *
 * @param finalThcMg Total infused THC in mg (must be >= 0)
 * @param servings   Number of servings (must be > 0)
 * @returns mg per serving, rounded to 1 decimal
 */
export function calculateMgPerServing(
  finalThcMg: number,
  servings: number
): number {
  if (finalThcMg < 0) {
    throw new ValidationError('finalThcMg cannot be negative')
  }
  if (servings <= 0) {
    throw new ValidationError('servings must be greater than 0')
  }

  const result = finalThcMg / servings
  return round1(result)
}

/**
 * Classify a dose based on mg per serving.
 *
 * Boundary rule: inclusive floor, exclusive ceiling.
 *   2.5 <= x < 5   → microdose
 *   5   <= x < 10  → low
 *   10  <= x < 25  → moderate
 *   25  <= x < 50  → strong
 *   50  <= x < 100 → very strong
 *   x >= 100       → extreme
 *   x < 2.5        → sub-microdose
 *
 * The 2.5 mg microdose threshold aligns with Bhaskar et al. 2021 (#9) and
 * MacCallum & Russo 2018 (#4), both of which recommend initiating oral THC
 * at 2.5 mg. The categorical labels above 5 mg and the bracket cutoffs are
 * internal UI taxonomy — see research/academic-references.md audit table.
 *
 * @param mgPerServing mg per serving (must be >= 0)
 * @returns DoseClassification string label
 */
export function classifyDose(mgPerServing: number): string {
  if (mgPerServing < 0) {
    throw new ValidationError('mgPerServing cannot be negative')
  }

  if (mgPerServing < 2.5) return 'sub-microdose'
  if (mgPerServing < 5) return 'microdose'
  if (mgPerServing < 10) return 'low'
  if (mgPerServing < 25) return 'moderate'
  if (mgPerServing < 50) return 'strong'
  if (mgPerServing < 100) return 'very strong'
  return 'extreme'
}

/**
 * Map a dose classification token (the engine's canonical lowercase output)
 * to the Title-Case display label the UI surfaces. Pure mapping — no DOM,
 * no side effects. Safe to call from any renderer code that needs to show
 * a classification to the user.
 *
 * The token set is the same 7 values `classifyDose` returns, plus a passthrough
 * for unknown tokens (e.g. a future category the engine adds before the UI
 * mapping is updated). The mapping mirrors the DOSE_ZONES table in
 * DoseTab.tsx so the two tabs show identical labels.
 */
export function displayDoseLabel(raw: string): string {
  switch (raw) {
    case 'sub-microdose':
      return 'Sub-Microdose'
    case 'microdose':
      return 'Microdose'
    case 'low':
      return 'Low'
    case 'moderate':
      return 'Moderate'
    case 'strong':
      return 'Strong'
    case 'very strong':
      return 'Very Strong'
    case 'extreme':
      return 'Extreme'
    default:
      return raw
  }
}
