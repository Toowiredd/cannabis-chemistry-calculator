/**
 * Decarboxylation engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math -- zero UI imports.
 */
import { ValidationError } from './errors'
import type { EfficiencyRange } from './models'

/** Molecular weight ratio: THC / THCA ≈ 0.877 (314.45 / 358.47).
 *  Source: Filer 2022 (#1, see research/academic-references.md). */
const THCA_TO_THC_FACTOR = 0.877

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

/**
 * Calculate the theoretical maximum THC (in mg) from raw material.
 *
 * Formula: grams * ((thcaPct / 100) * 0.877 + (thcPct / 100)) * 1000
 *
 * @param grams   Material weight in grams
 * @param thcaPct THCA percentage [0, 100]
 * @param thcPct  Already-decarboxylated THC percentage [0, 100]
 * @returns Theoretical maximum in mg, rounded to 1 decimal
 */
export function calculateTheoreticalMax(
  grams: number,
  thcaPct: number,
  thcPct: number
): number {
  if (grams < 0) throw new ValidationError('grams cannot be negative')
  if (thcaPct < 0) throw new ValidationError('thcaPct cannot be negative')
  if (thcPct < 0) throw new ValidationError('thcPct cannot be negative')
  if (thcaPct > 100) throw new ValidationError('thcaPct cannot exceed 100%')
  if (thcaPct + thcPct > 100) {
    throw new ValidationError('thcaPct + thcPct cannot exceed 100%')
  }

  const result =
    grams * ((thcaPct / 100) * THCA_TO_THC_FACTOR + thcPct / 100) * 1000
  return round1(result)
}

/**
 * Apply decarboxylation efficiency to the theoretical maximum.
 *
 * Formula: theoreticalMax * efficiency
 *
 * @param theoreticalMax Theoretical maximum in mg
 * @param efficiency     Decarb efficiency [0.0, 1.0]
 * @returns Decarbed THC in mg, rounded to 1 decimal
 */
export function calculateDecarbedThc(
  theoreticalMax: number,
  efficiency: number
): number {
  if (theoreticalMax < 0) {
    throw new ValidationError('theoreticalMax cannot be negative')
  }
  if (efficiency < 0) throw new ValidationError('efficiency cannot be negative')
  if (efficiency > 1) throw new ValidationError('efficiency cannot exceed 1.0')

  const result = theoreticalMax * efficiency
  return round1(result)
}

/**
 * Calculate low / expected / high range by applying three efficiency factors.
 *
 * @param theoreticalMax Theoretical maximum in mg
 * @param lowEff         Lowest expected efficiency [0.0, 1.0]
 * @param expectedEff    Most likely efficiency [0.0, 1.0]
 * @param highEff        Best-case efficiency [0.0, 1.0]
 * @returns EfficiencyRange with decarbed THC rounded to 1 decimal
 */
export function calculateRange(
  theoreticalMax: number,
  lowEff: number,
  expectedEff: number,
  highEff: number
): EfficiencyRange {
  if (theoreticalMax < 0) {
    throw new ValidationError('theoreticalMax cannot be negative')
  }
  if (
    lowEff < 0 ||
    lowEff > 1 ||
    expectedEff < 0 ||
    expectedEff > 1 ||
    highEff < 0 ||
    highEff > 1
  ) {
    throw new ValidationError('efficiency values must be in [0.0, 1.0]')
  }
  if (lowEff > expectedEff || expectedEff > highEff) {
    throw new ValidationError(
      'efficiency ordering must be: low <= expected <= high'
    )
  }

  return {
    low: round1(theoreticalMax * lowEff),
    expected: round1(theoreticalMax * expectedEff),
    high: round1(theoreticalMax * highEff),
  }
}
