/**
 * Cannabinoid molecular-weight constants and shared theoretical-max helper.
 *
 * Created 2026-07-25 during Cluster B (Engine DRY) refactor to replace 5
 * duplicate `const THCA_TO_THC_FACTOR = 0.877` definitions across the engine
 * (decarb.ts, concentrate.ts, costAnalysis.ts, reverse.ts, cbda.ts with the
 * CBDA-equivalent factor) and 2 inline `0.877` literals in radarScores.ts.
 *
 * Source: Filer 2022 (#1 in research/academic-references.md) for the
 * THCA→THC molecular-weight ratio of 314.45/358.47. CBDA and THCA are
 * isomers (C22H30O4, MW 358.47), so the same MW ratio applies — see also
 * Citti 2018 (#14).
 *
 * Pure TypeScript — zero UI imports.
 */

/**
 * Molecular weight ratio: THC / THCA = 314.45 / 358.47 ≈ 0.877.
 * Applied to the acidic form to convert mass of THCA into the equivalent
 * mass of active THC after decarboxylation.
 */
export const THCA_TO_THC_FACTOR = 0.877

/**
 * Molecular weight ratio: CBD / CBDA = 314.45 / 358.47 ≈ 0.877.
 * CBDA and THCA are isomers (C22H30O4, MW 358.47), so the factor is
 * identical to THCA_TO_THC_FACTOR. Exposed as a distinct constant so
 * code reads as semantically explicit (callers don't write a comment
 * to explain that "the 0.877 here is the same as the THCA one").
 */
export const CBDA_TO_CBD_FACTOR = 0.877

/**
 * Generic theoretical-max calculator for an acidic→active cannabinoid
 * pair (THCA→THC, CBDA→CBD, and any future isomer pair).
 *
 * Formula: `grams * ((acidicPct / 100) * mwFactor + activePct / 100) * 1000`
 *
 * Returns the theoretical maximum yield in mg, **NOT** rounded. Callers
 * apply their own rounding (typically the engine's `round1n` for 1-decimal
 * display) so the canonical helper stays precision-neutral.
 *
 * @param grams      Material weight in grams (must be >= 0)
 * @param acidicPct  Acidic cannabinoid percentage [0, 100]
 * @param activePct  Already-decarboxylated active cannabinoid percentage [0, 100]
 * @param mwFactor   Molecular-weight ratio (active / acidic) — typically
 *                   0.877 for THCA→THC or CBDA→CBD
 * @returns Theoretical maximum yield in mg (raw, unrounded)
 */
export function theoreticalMaxCannabinoid(
  grams: number,
  acidicPct: number,
  activePct: number,
  mwFactor: number
): number {
  return grams * ((acidicPct / 100) * mwFactor + activePct / 100) * 1000
}
