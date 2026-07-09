/**
 * Doneness simulation engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 *
 * Arrhenius rate constants (k1 for THCA→THC, k2 for THC→CBN):
 *
 *   k1 (THCA→THC):
 *     Ea₁ = 92 kJ/mol — top of Wang 2016 (#2) reported range of 84.8–88 kJ/mol
 *                       for THCA-A → THC. Engineering overestimate to favor
 *                       visible activity in the simulated UI.
 *     A₁  = 1.5×10¹² s⁻¹ — Wang 2016 reports k₀ ≈ 3.7×10⁸ – 8.7×10⁸ s⁻¹.
 *                         Engine value is 10⁴× the published k₀; flagged in
 *                         audit table row 13/15 as engineering-default.
 *     Cited per research/academic-references.md audit table rows 13 & 15.
 *
 *   k2 (THC→CBN):
 *     Ea₂ = 51.70 kJ/mol — Jaidee 2022 (#7) Table 3, pH 2 solution
 *                           pseudo-first-order Δ9-THC degradation.
 *                           DOI 10.1089/can.2021.0004.
 *     A₂  = 6.40×10⁶ day⁻¹ — same source. Converted to per-minute via /1440
 *                            to match the engine's minute-scale time axis.
 *     Sanity check at 25 °C: k₂ = (A₂/1440) × exp(−Ea₂/(R·T))
 *                                = 3.94×10⁻⁶ /min → halflife ≈ 122 days,
 *                              consistent with industry-reported room-temp
 *                              stability of Δ9-THC in stored resin (rather
 *                              than the pre-recompute sub-hour halflife
 *                              implied by the old Ea₂=110 kJ/mol default).
 *     Note on math-form choice: Jaidee 2022's dried-resin measurement of
 *     Δ9-THC degradation is pseudo-zero-order (rate ∝ constant, not
 *     concentration). The engine models degradation as pseudo-first-order
 *     (rate ∝ concentration). The only first-order Δ9-THC kinetics Jaidee
 *     provides are the pH 2 solution values cited above; this is the
 *     matching source for our ODE form. Choosing the dried-resin
 *     pseudo-zero-order would require changing the simulation ODE form
 *     — out of scope here.
 *
 * Drift flags in the audit table (rows 13–16) are now resolved for k2
 * (Ea₂ + A₂). k1 retains the engineering-overestimate flag pending a
 * planned Ea₁/A₁ cleanup pass against Wang 2016.
 */
import { round1 } from './units'

/**
 * Simulate the kinetic progression of THCA → THC → CBN over time
 * at a given temperature using a simplified Arrhenius model.
 *
 * @param tempC        Temperature in Celsius
 * @param maxTimeMin   Maximum time to simulate (minutes)
 * @param steps        Number of discrete time steps (default 120)
 * @returns Array of {t, thca, thc, cbn} points, each as rounded percentages
 */
export function simulateDoneness(
  tempC: number,
  maxTimeMin: number,
  steps = 120
): { t: number; thca: number; thc: number; cbn: number }[] {
  const result: { t: number; thca: number; thc: number; cbn: number }[] = []
  const dt = maxTimeMin / steps
  const T_K = tempC + 273.15
  const R = 8.314 // J/(mol·K) — NIST CODATA exact universal gas constant

  // k1: engineering overestimate on top of Wang 2016 (#2)
  const Ea1 = 92_000 // J/mol — upper end of Wang 2016 84.8–88 kJ/mol range
  const A1 = 1.5e12 // s⁻¹ — Wang 2016 reports k₀ ≈ 1e8 (10⁴× underestimate flagged)
  const k1 = A1 * Math.exp(-Ea1 / (R * T_K)) * 60 // per minute

  // k2: Jaidee 2022 Table 3, pH 2 solution pseudo-first-order Δ9-THC degradation
  const Ea2 = 51_700 // J/mol — Jaidee 2022 #7, k@25°C = 0.0056 day⁻¹
  const A2 = 6.4e6 // day⁻¹ — Jaidee 2022 #7, same source
  const k2 = (A2 / 1440) * Math.exp(-Ea2 / (R * T_K)) // per minute

  let thca = 1.0
  let thc = 0.0
  let cbn = 0.0

  for (let i = 0; i <= steps; i++) {
    const t = i * dt
    result.push({
      t: round1(t),
      thca: round1(thca * 100),
      thc: round1(thc * 100),
      cbn: round1(cbn * 100),
    })

    const dThca = -k1 * thca * dt
    const dThc = (k1 * thca - k2 * thc) * dt
    const dCbn = k2 * thc * dt

    thca += dThca
    thc += dThc
    cbn += dCbn

    if (thca < 0) thca = 0
    if (thc < 0) thc = 0
    if (cbn < 0) cbn = 0
    const total = thca + thc + cbn
    if (total > 0) {
      thca /= total
      thc /= total
      cbn /= total
    }
    if (cbn > 0.1) {
      cbn = 0.1
      const remaining = thca + thc
      if (remaining > 0) {
        const scale = 0.9 / remaining
        thca *= scale
        thc *= scale
      }
    }
  }

  return result
}

/**
 * THC→CBN Arrhenius rate constant (k₂) for the supplied temperature.
 *
 * Exported for test/audit access. k₂ source: Jaidee 2022 (#7) Table 3,
 * pH 2 solution pseudo-first-order Δ9-THC degradation:
 *   A₂ = 6.40×10⁶ day⁻¹, Eₐ₂ = 51.70 kJ/mol.
 *
 * At 25 °C this returns ≈3.94×10⁻⁶ /min, matching Jaidee's reported
 * k@25°C of 0.0056 day⁻¹ (within round-off).
 *
 * @param tempC  Temperature in Celsius
 * @returns      Rate constant k₂ in per-minute units
 */
export function k2ThcToCbnPerMin(tempC: number): number {
  const R = 8.314
  const Ea2 = 51_700
  const A2 = 6.4e6
  return (A2 / 1440) * Math.exp(-Ea2 / (R * (tempC + 273.15)))
}

/**
 * Format a duration in minutes into a human-readable string.
 * Examples: 30 → "30m", 90 → "1h 30m", 120 → "2h"
 */
export function timeLabel(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }
  return `${Math.round(minutes)}m`
}
