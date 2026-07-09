/**
 * CBDA → CBD decarboxylation engine.
 * Pure TypeScript math -- zero UI imports.
 *
 * CBDA and THCA are isomers (C22H30O4, MW 358.47), so the same
 * 0.877 molecular weight ratio applies.
 */
import { ValidationError } from './errors'
import type { EfficiencyRange } from './models'

/** Molecular weight ratio: CBD / CBDA ≈ 0.877 (same as THC / THCA).
 *  Source: Filer 2022 (see research/academic-references.md #1) for the THCA→THC MW ratio of 314.45/358.47.
 *  CBDA and THCA are isomers (C22H30O4, MW 358.47) — see also Citti 2018 (#14). */
const CBDA_TO_CBD_FACTOR = 0.877

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

/**
 * Calculate the theoretical maximum CBD (in mg) from raw material.
 *
 * Formula: grams * ((cbdaPct / 100) * 0.877 + (cbdPct / 100)) * 1000
 *
 * @param grams    Material weight in grams
 * @param cbdaPct  CBDA percentage [0, 100]
 * @param cbdPct   Already-decarboxylated CBD percentage [0, 100]
 * @returns Theoretical maximum CBD in mg, rounded to 1 decimal
 */
export function calculateTheoreticalMaxCbd(
  grams: number,
  cbdaPct: number,
  cbdPct: number
): number {
  if (grams < 0) throw new ValidationError('grams cannot be negative')
  if (cbdaPct < 0) throw new ValidationError('cbdaPct cannot be negative')
  if (cbdPct < 0) throw new ValidationError('cbdPct cannot be negative')
  if (cbdaPct > 100) throw new ValidationError('cbdaPct cannot exceed 100%')
  if (cbdaPct + cbdPct > 100) {
    throw new ValidationError('cbdaPct + cbdPct cannot exceed 100%')
  }

  const result =
    grams * ((cbdaPct / 100) * CBDA_TO_CBD_FACTOR + cbdPct / 100) * 1000
  return round1(result)
}

/**
 * Apply decarboxylation efficiency to the theoretical maximum CBD.
 *
 * Formula: theoreticalMax * efficiency
 *
 * @param theoreticalMax Theoretical maximum CBD in mg
 * @param efficiency     Decarb efficiency [0.0, 1.0]
 * @returns Decarbed CBD in mg, rounded to 1 decimal
 */
export function calculateDecarbedCbd(
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
 * Calculate low / expected / high CBD range by applying three efficiency factors.
 *
 * @param theoreticalMax Theoretical maximum CBD in mg
 * @param lowEff         Lowest expected efficiency [0.0, 1.0]
 * @param expectedEff    Most likely efficiency [0.0, 1.0]
 * @param highEff        Best-case efficiency [0.0, 1.0]
 * @returns EfficiencyRange with decarbed CBD rounded to 1 decimal
 */
export function calculateCbdRange(
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
