/**
 * Concentrate calculator engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math -- zero UI imports.
 *
 * Supports: wax, shatter, distillate, hash, kief, RSO.
 * Calculates theoretical max and decarb-adjusted THC.
 * Distillate is already decarboxylated (skips decarb step).
 */
import { ValidationError } from './errors'
import type { EfficiencyRange } from './models'

/** Molecular weight ratio: THC / THCA ≈ 0.877 — Filer 2022 (#1, see research/academic-references.md). */
const THCA_TO_THC_FACTOR = 0.877

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export interface ConcentrateType {
  /** Internal identifier */
  id: string
  /** Human-readable name (text-only, no symbols) */
  name: string
  /** Whether this concentrate type needs decarboxylation before infusion */
  needsDecarb: boolean
  /** Typical THCA percentage [0, 100] */
  typicalThcaPct: number
  /** Already-decarboxylated THC percentage [0, 100] */
  typicalThcPct: number
  /** Recommended decarb efficiency range (ignored for distillate) */
  decarbEfficiency: EfficiencyRange
  /** Human-readable decarb guidance text */
  decarbGuidance: string
}

// ---------------------------------------------------------------------------
// Concentrate-type presets -- exactly 6 entries
// ---------------------------------------------------------------------------

// TODO(citation): typical THCA / THC percentages and decarb temperature
// guidance (95–105 °C for wax/shatter, 110–115 °C for hash/kief/RSO) are
// industry averages anchored to Garcia-Valverde 2022 (#11) for the
// THCA→THC→CBN cascade direction, but the specific ranges are not tabulated
// in any cited source. See research/academic-references.md audit row #23.
export const CONCENTRATE_TYPES: readonly ConcentrateType[] = [
  {
    id: 'wax',
    name: 'Wax',
    needsDecarb: true,
    typicalThcaPct: 80,
    typicalThcPct: 2,
    decarbEfficiency: { low: 0.88, expected: 0.93, high: 0.96 },
    decarbGuidance:
      'Decarb at 95–105C for 20–30 minutes in a sealed container to minimize terpene loss.',
  },
  {
    id: 'shatter',
    name: 'Shatter',
    needsDecarb: true,
    typicalThcaPct: 85,
    typicalThcPct: 1,
    decarbEfficiency: { low: 0.88, expected: 0.93, high: 0.96 },
    decarbGuidance:
      'Decarb at 95–105C for 20–30 minutes. Break into small pieces first for even heating.',
  },
  {
    id: 'distillate',
    name: 'Distillate',
    needsDecarb: false,
    typicalThcaPct: 0,
    typicalThcPct: 90,
    decarbEfficiency: { low: 1.0, expected: 1.0, high: 1.0 },
    decarbGuidance:
      'Distillate is already fully decarboxylated. No decarb step needed.',
  },
  {
    id: 'hash',
    name: 'Hash',
    needsDecarb: true,
    typicalThcaPct: 45,
    typicalThcPct: 5,
    decarbEfficiency: { low: 0.85, expected: 0.9, high: 0.94 },
    decarbGuidance:
      'Decarb at 110–115C for 30–45 minutes. Crumble or break apart before heating.',
  },
  {
    id: 'kief',
    name: 'Kief',
    needsDecarb: true,
    typicalThcaPct: 55,
    typicalThcPct: 3,
    decarbEfficiency: { low: 0.85, expected: 0.9, high: 0.94 },
    decarbGuidance:
      'Decarb at 110–115C for 25–35 minutes. Spread thinly for uniform heat distribution.',
  },
  {
    id: 'rso',
    name: 'RSO',
    needsDecarb: true,
    typicalThcaPct: 60,
    typicalThcPct: 10,
    decarbEfficiency: { low: 0.85, expected: 0.9, high: 0.93 },
    decarbGuidance:
      'Decarb at 110–115C for 30–40 minutes. RSO is viscous; use a shallow dish.',
  },
] as const

// ---------------------------------------------------------------------------
// Calculation functions
// ---------------------------------------------------------------------------

/**
 * Calculate the theoretical maximum THC (in mg) from concentrate material.
 *
 * Formula: grams * ((thcaPct / 100) * 0.877 + (thcPct / 100)) * 1000
 *
 * @param grams   Concentrate weight in grams
 * @param thcaPct THCA percentage [0, 100]
 * @param thcPct  Already-decarboxylated THC percentage [0, 100]
 * @returns Theoretical maximum in mg, rounded to 1 decimal
 */
export function calculateConcentrateTheoreticalMax(
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
export function calculateConcentrateDecarbedThc(
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
export function calculateConcentrateRange(
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
