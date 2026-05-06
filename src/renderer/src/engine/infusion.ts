/**
 * Fat infusion engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 */
import { ValidationError } from './errors'

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 10) / 10
}

/**
 * Calculate total infused THC (in mg) from decarbed THC and extraction efficiency.
 *
 * Formula: decarbedThc * extractionEff
 *
 * @param decarbedThc   Decarboxylated THC in mg (must be >= 0)
 * @param extractionEff Extraction efficiency [0.0, 1.0]
 * @returns Infused THC in mg, rounded to 1 decimal
 */
export function calculateInfusedThc(
  decarbedThc: number,
  extractionEff: number
): number {
  if (decarbedThc < 0) {
    throw new ValidationError('decarbedThc cannot be negative')
  }
  if (extractionEff < 0) {
    throw new ValidationError('extractionEff cannot be negative')
  }
  if (extractionEff > 1) {
    throw new ValidationError('extractionEff cannot exceed 1.0')
  }

  const result = decarbedThc * extractionEff
  return round1(result)
}

/**
 * Calculate mg per mL (concentration) from infused THC and fat volume.
 *
 * Formula: infusedThc / volumeMl
 *
 * @param infusedThc Total infused THC in mg (must be >= 0)
 * @param volumeMl   Fat volume in mL (must be > 0)
 * @returns mg per mL, rounded to 1 decimal
 */
export function calculateMgPerMl(
  infusedThc: number,
  volumeMl: number
): number {
  if (infusedThc < 0) {
    throw new ValidationError('infusedThc cannot be negative')
  }
  if (volumeMl <= 0) {
    throw new ValidationError('volumeMl must be greater than 0')
  }

  const result = infusedThc / volumeMl
  return round1(result)
}

/**
 * Calculate a simplified potency estimate without full decarb math.
 *
 * Formula: grams * thcaPct * multiplier
 *
 * This is a back-of-the-envelope shortcut; decarb and extraction are
 * baked into the multiplier per fat preset.
 *
 * @param grams      Material weight in grams (must be >= 0)
 * @param thcaPct    THCA percentage [0, 100]
 * @param multiplier Simplified multiplier from fat preset (must be >= 0)
 * @returns Estimated total THC in mg, rounded to 1 decimal
 */
export function calculateSimplifiedEstimate(
  grams: number,
  thcaPct: number,
  multiplier: number
): number {
  if (grams < 0) {
    throw new ValidationError('grams cannot be negative')
  }
  if (thcaPct < 0) {
    throw new ValidationError('thcaPct cannot be negative')
  }
  if (thcaPct > 100) {
    throw new ValidationError('thcaPct cannot exceed 100%')
  }
  if (multiplier < 0) {
    throw new ValidationError('multiplier cannot be negative')
  }

  const result = grams * thcaPct * multiplier
  return round1(result)
}
