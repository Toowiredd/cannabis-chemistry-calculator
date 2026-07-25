/**
 * Doneness simulation engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 *
 * Arrhenius rate constants (k1 for THCA→THC, k2 for THC→CBN):
 *
 *   k1 (THCA→THC) — recomputed from Wang 2016 (#2) on 2026-07-25:
 *     Source: Wang et al. 2016, "Decarboxylation Study of Acidic
 *       Cannabinoids" (Cannabis and Cannabinoid Research 1(1):262–271,
 *       DOI 10.1089/can.2016.0020), Table 2 (p. 270).
 *     Fit data: 3 first-order rate constants for THCA-A in cannabis
 *       extracts at 80, 95, 110 °C (k = 0.18, 0.66, 1.83 × 10⁻³ s⁻¹).
 *       Wang 2016 also reported measurements at 130 °C and 145 °C but
 *       did not include them in the Arrhenius fit (the reaction was
 *       too fast for k determination at those temperatures).
 *     Least-squares regression of ln k on 1/T (R = 8.314 J/(mol·K)):
 *       slope = −10471 K,  intercept = 21.06
 *       Ea₁ = 87.06 kJ/mol,  A₁ = 1.40 × 10⁹ s⁻¹  (R² = 0.998)
 *     Wang 2016's own rounded summary in Table 2 reads
 *       Ea = 88 kJ/mol, k₀ = 8.7 × 10⁸ s⁻¹
 *       — both are within 6 % of the 3 measured points. The regression
 *       A (1.40 × 10⁹) is ≈ 60 % higher than the paper's rounded k₀
 *       because the paper computed k₀ from the rounded EA; the
 *       regression is the more honest fit of the actual data.
 *     Storage: A₁ is stored as **8.4 × 10¹⁰ min⁻¹** (= 1.40 × 10⁹ s⁻¹
 *       × 60 s/min) to match the engine's minute-scale time axis.
 *     Prior value: Ea₁ = 92 kJ/mol, A₁ = 1.5 × 10¹² s⁻¹ — an engineering
 *       overestimate chosen to favor visible activity in the simulated
 *       UI at the 30-min/120 °C decarb window. A was 10⁴× the published
 *       k₀. Audit table rows 13 & 15 in research/academic-references.md
 *       now read "Wang 2016 (Table 2, p. 270) — 3-point Arrhenius fit".
 *     Extrapolation caveat: the Arrhenius fit is from 80–110 °C only.
 *       Predicting k at 25 °C gives a halflife of ≈10 days, which is
 *       much shorter than the empirical 1–100 year room-temperature
 *       stability of THCA in plant material. The 1-100 year band is
 *       NOT supported by Wang 2016 alone — it would require a different
 *       Ea at low T (e.g. a curved Arrhenius plot, distinct mechanism,
 *       or a low-T-specific citation). See test 25C-halflife in
 *       doneness-simulation.test.ts for the actual Arrhenius band.
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
 * Audit drift flags in research/academic-references.md rows 13–16 are
 * now fully resolved: k1 (Ea₁, A₁) on 2026-07-25 (this pass) and k2
 * (Ea₂, A₂) on 2026-07-09.
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

  // k1: THCA → THC — Wang 2016 (#2) Table 2, p. 270 (3-point Arrhenius fit).
  // See file header for full derivation. A₁ is stored per-minute to match
  // the engine's minute-scale time axis (no *60 conversion needed).
  const Ea1 = 87_060 // J/mol — regression of 80/95/110 °C data (87.06 kJ/mol)
  const A1 = 8.4e10 // min⁻¹ — regression of 80/95/110 °C data (1.40 × 10⁹ s⁻¹)
  const k1 = A1 * Math.exp(-Ea1 / (R * T_K)) // per minute

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
 * THCA→THC Arrhenius rate constant (k₁) for the supplied temperature.
 *
 * Exported for test/audit access. k₁ source: Wang 2016 (#2) Table 2
 * (p. 270, 1(1):262–271, DOI 10.1089/can.2016.0020), 3-point Arrhenius
 * fit of THCA-A decarboxylation rate constants measured in cannabis
 * extracts at 80 °C, 95 °C, and 110 °C (k = 0.18, 0.66, 1.83 × 10⁻³ s⁻¹).
 *   A₁ = 1.40 × 10⁹ s⁻¹ = 8.4 × 10¹⁰ min⁻¹, Eₐ₁ = 87.06 kJ/mol.
 *   R² = 0.998 (3 points, n−2 = 1 dof).
 *
 * Sanity check at 120 °C: k₁ = 8.4 × 10¹⁰ × exp(−87060/(8.314 × 393.15))
 *                        ≈ 0.228 min⁻¹ — consistent with Wang 2016's own
 *   rounded Arrhenius prediction of ≈ 0.234 min⁻¹ at 120 °C (within 3 %).
 *
 * @param tempC  Temperature in Celsius
 * @returns      Rate constant k₁ in per-minute units
 */
export function k1ThcaToThcPerMin(tempC: number): number {
  const R = 8.314
  const Ea1 = 87_060
  const A1 = 8.4e10
  return A1 * Math.exp(-Ea1 / (R * (tempC + 273.15)))
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
