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

// ---------------------------------------------------------------------------
// AVB (Already Vaped Bud / ABV) math layer
// ---------------------------------------------------------------------------

/**
 * AVB is the community term for material left in a dry-herb vaporizer after
 * a session. It is already decarboxylated (THCA → THC during the vape
 * session) and has a lower residual THC content (typically 1–8% by mass)
 * depending on the vaporizer temperature, draw length, and number of
 * re-vapes.
 *
 * Mathematically, AVB fits the existing theoretical-max formula by treating
 * the residual as already-decarboxylated THC (so the 0.877 THCA→THC factor
 * does NOT apply). The color → residual mapping below encodes the community
 * heuristic that lighter brown AVB retains more THC than darker AVB.
 */

/** Visual AVB color category used as a proxy for residual THC. */
export type AVBColor = 'light' | 'medium' | 'dark'

/**
 * Residual THC percentage range for a given AVB color category.
 *
 * @property minPct     Lower-bound residual THC percentage [0, 100]
 * @property midPct     Most-likely residual THC percentage [0, 100]
 * @property maxPct     Upper-bound residual THC percentage [0, 100]
 * @property efficiency Decarb efficiency [0.0, 1.0] — always 1.0 for AVB
 *                      because the material is already decarboxylated by
 *                      the vaporizer session (no further decarb needed)
 */
export interface AVBResidualRange {
  minPct: number
  midPct: number
  maxPct: number
  efficiency: number
}

/**
 * Residual THC ranges keyed by visual AVB color.
 *
 * Basis: community + dry-herb vaporizer manufacturer guidance, plus the
 * generalized "low-temp retains more cannabinoids" principle from the same
 * decarboxylation literature that drives the rest of the engine (see
 * `research/academic-references.md`). There is no single peer-reviewed
 * "AVB residual THC" number; published vaporizer studies report a wide
 * spread because residual depends on temperature, draw length, packing
 * density, and number of re-vapes. The ranges below are conservative
 * midpoints of that spread:
 *   - light  (golden / light brown, low-temp ~180°C, short draws):
 *       ~5–8% residual THC remaining
 *   - medium (medium brown, mid-temp ~200°C, typical session):
 *       ~3–5% residual THC remaining
 *   - dark   (dark brown / near-black, high-temp ~220°C, long session,
 *       re-vaped): ~1–3% residual THC remaining
 *
 * `efficiency` is 1.0 for all three because AVB is already decarboxylated —
 * no further decarb step is needed before infusion.
 */
export const AVB_RESIDUAL_THC_RANGES: Record<AVBColor, AVBResidualRange> = {
  light: { minPct: 5, midPct: 6.5, maxPct: 8, efficiency: 1.0 },
  medium: { minPct: 3, midPct: 4, maxPct: 5, efficiency: 1.0 },
  dark: { minPct: 1, midPct: 2, maxPct: 3, efficiency: 1.0 },
}

/**
 * Calculate the theoretical maximum THC (in mg) from AVB material.
 *
 * Formula: grams * (residualThcPct / 100) * 1000
 *          (delegates to `calculateTheoreticalMax(grams, 0, residualThcPct)`)
 *
 * The 0.877 THCA→THC factor is intentionally NOT applied: AVB is already
 * decarboxylated by the vaporizer, so the residual is already-active THC.
 *
 * @param grams          AVB weight in grams
 * @param residualThcPct Residual THC percentage [0, 100] (already decarbed)
 * @returns              Theoretical maximum in mg, rounded to 1 decimal
 * @throws {ValidationError} if grams < 0 or residualThcPct is outside [0, 100]
 */
export function calculateAvbTheoreticalMax(
  grams: number,
  residualThcPct: number
): number {
  if (grams < 0) throw new ValidationError('grams cannot be negative')
  if (residualThcPct < 0) {
    throw new ValidationError('residualThcPct cannot be negative')
  }
  if (residualThcPct > 100) {
    throw new ValidationError('residualThcPct cannot exceed 100%')
  }
  // Delegate to the canonical theoretical-max function so the THCA→THC
  // factor, input validation, and 1-decimal rounding are all reused
  // consistently with the flower / concentrate paths. The AVB efficiency
  // is implicitly 1.0 because the residual THC passed in is already-active
  // (THCA→THC factor is multiplied by 0 on the thcaPct argument).
  return calculateTheoreticalMax(grams, 0, residualThcPct)
}

/**
 * Calculate low / expected / high theoretical max (in mg) for an AVB
 * weight + color category.
 *
 * Uses `AVB_RESIDUAL_THC_RANGES[color]` to pick the min / mid / max residual
 * THC percentages, then delegates to `calculateAvbTheoreticalMax` for each.
 *
 * @param grams AVB weight in grams
 * @param color AVB color category ('light' | 'medium' | 'dark')
 * @returns     Object with `low`, `expected`, `high` theoretical max in mg
 *              (all rounded to 1 decimal)
 * @throws {ValidationError} if grams < 0 (propagated from
 *         `calculateAvbTheoreticalMax`)
 */
export function calculateAvbTheoreticalMaxFromColor(
  grams: number,
  color: AVBColor
): { low: number; expected: number; high: number } {
  const range = AVB_RESIDUAL_THC_RANGES[color]
  return {
    low: calculateAvbTheoreticalMax(grams, range.minPct),
    expected: calculateAvbTheoreticalMax(grams, range.midPct),
    high: calculateAvbTheoreticalMax(grams, range.maxPct),
  }
}
