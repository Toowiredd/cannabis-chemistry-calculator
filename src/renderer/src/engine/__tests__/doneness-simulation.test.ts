import { describe, expect, it } from 'vitest'
import {
  k1ThcaToThcPerMin,
  k2ThcToCbnPerMin,
  simulateDoneness,
} from '../doneness-simulation'

describe('simulateDoneness', () => {
  it('caps CBN at 10% at 95C/60min (VAL-DONENESS-004)', () => {
    const points = simulateDoneness(95, 60, 120)
    const maxCbn = Math.max(...points.map(p => p.cbn))
    expect(maxCbn).toBeLessThanOrEqual(10)
  })

  it('caps CBN at 10% at 113C/60min (VAL-DONENESS-004, VAL-DONENESS-005)', () => {
    const points = simulateDoneness(113, 60, 120)
    const maxCbn = Math.max(...points.map(p => p.cbn))
    expect(maxCbn).toBeLessThanOrEqual(10)
  })

  it('THCA+THC+CBN sums to ~1.0 (100%) at every step (VAL-DONENESS-004)', () => {
    const points = simulateDoneness(95, 60, 120)
    for (const p of points) {
      const sum = p.thca + p.thc + p.cbn
      expect(sum).toBeCloseTo(100, 0)
    }
  })

  it('THCA+THC+CBN sums to ~1.0 at 113C/60min after cap (VAL-DONENESS-004)', () => {
    const points = simulateDoneness(113, 60, 120)
    for (const p of points) {
      const sum = p.thca + p.thc + p.cbn
      expect(sum).toBeCloseTo(100, 0)
    }
  })

  it('produces a full time series from 0 to maxTimeMin', () => {
    const points = simulateDoneness(95, 60, 120)
    expect(points[0].t).toBe(0)
    expect(points[points.length - 1].t).toBeCloseTo(60, 0)
    expect(points.length).toBe(121)
  })

  it('starts with 100% THCA and 0% THC/CBN at t=0', () => {
    const points = simulateDoneness(95, 60, 120)
    expect(points[0].thca).toBe(100)
    expect(points[0].thc).toBe(0)
    expect(points[0].cbn).toBe(0)
  })

  it('THC rises then falls; CBN never exceeds 10% at any temperature', () => {
    const temps = [73, 85, 95, 100, 113, 116]
    for (const temp of temps) {
      const points = simulateDoneness(temp, 120, 120)
      const maxCbn = Math.max(...points.map(p => p.cbn))
      expect(maxCbn).toBeLessThanOrEqual(10)
    }
  })

  it('at 95C/60min defaults, CBN shows plausible values (<=10%)', () => {
    const points = simulateDoneness(95, 60, 120)
    // At 60min default, CBN is capped at 10% (VAL-DONENESS-004)
    const pointAt60 = points[points.length - 1]
    expect(pointAt60.cbn).toBeLessThanOrEqual(10)
  })
})

describe('k2ThcToCbnPerMin (Jaidee 2022 sanity)', () => {
  // Jaidee 2022 Table 3, pH 2 solution pseudo-first-order Δ9-THC degradation:
  //   A₂ = 6.40 × 10⁶ day⁻¹, Eₐ = 51.70 kJ/mol, k@25 °C = 0.0056 day⁻¹
  //   DOI 10.1089/can.2021.0004
  //
  // Sanity check: engine's exported k₂ThcToCbnPerMin(25) should produce
  // ≈ 0.0056 / 1440 /min = 3.889 × 10⁻⁶ /min within round-off.
  it('at 25 °C reproduces Jaidee 2022 published k@25 °C within 1% relative', () => {
    const k_per_min = k2ThcToCbnPerMin(25)
    const expected_per_min = 0.0056 / 1440
    const rel_err = Math.abs(k_per_min - expected_per_min) / expected_per_min
    expect(rel_err).toBeLessThan(0.01) // 1% relative — round-off only
  })

  // Sanity check: at 25 °C, the implied halflife is roughly 4 months — well
  // above 1 minute and below 10 years. Anchors the math against absurdity.
  it('halflife at 25 °C is between 1 day and 10 years (real-world sanity)', () => {
    const k_per_min = k2ThcToCbnPerMin(25)
    const halflife_min = Math.LN2 / k_per_min
    const one_day = 24 * 60
    const ten_years = 10 * 365.25 * 24 * 60
    expect(halflife_min).toBeGreaterThan(one_day)
    expect(halflife_min).toBeLessThan(ten_years)
  })

  // Arrhenius shape: rate doubles roughly every 10 °C in this temperature
  // band. Tolerance is loose (Q10 = 2 ± 0.4) to allow for the actual Ea.
  it('rate roughly doubles every 10 °C in the 25–95 °C band', () => {
    const k25 = k2ThcToCbnPerMin(25)
    const k35 = k2ThcToCbnPerMin(35)
    const k95 = k2ThcToCbnPerMin(95)
    expect(k35 / k25).toBeGreaterThan(1.5)
    expect(k35 / k25).toBeLessThan(2.5)
    expect(k95 / k25).toBeGreaterThan(2 ** 6 * 0.5) // 7 doublings ~64×
    expect(k95 / k25).toBeLessThan(2 ** 8 * 2) // 9 doublings ~512×
  })
})

describe('THCA → THC Arrhenius recompute (Wang 2016)', () => {
  // Source: Wang et al. 2016, "Decarboxylation Study of Acidic Cannabinoids"
  //   Cannabis and Cannabinoid Research 1(1):262–271, p. 270, Table 2.
  //   DOI 10.1089/can.2016.0020 (PMC5549281)
  //
  // Fit data: 3 first-order rate constants for THCA-A in cannabis extracts
  //   at 80 °C, 95 °C, 110 °C (k = 0.18, 0.66, 1.83 × 10⁻³ s⁻¹).
  //   Wang 2016 also measured at 130 °C and 145 °C but excluded those points
  //   from the Arrhenius fit (the reaction was too fast for k determination).
  //
  // Least-squares regression of ln k on 1/T (R = 8.314 J/(mol·K)):
  //   slope = −10471 K,  intercept = 21.06
  //   Ea₁ = 87.06 kJ/mol,  A₁ = 1.40 × 10⁹ s⁻¹  (R² = 0.998)
  // Wang 2016's own rounded summary in Table 2 reads EA = 88 kJ/mol,
  //   k₀ = 8.7 × 10⁸ s⁻¹ — the regression A is ~60 % higher than the paper's
  //   rounded k₀ because the paper computed k₀ from the rounded EA. The
  //   regression is the more honest fit of the actual data.
  //
  // Storage: engine stores A₁ as 8.4 × 10¹⁰ min⁻¹ (= 1.40 × 10⁹ s⁻¹ × 60) to
  //   match the engine's minute-scale time axis.

  // --- direct measured points (the 3 anchor temperatures) ------------------

  it('k₁ at 80 °C matches Wang 2016 Table 2 measured k = 0.18 × 10⁻³ s⁻¹ within 10 %', () => {
    // Wang 2016 Table 2 (p. 270): THCA-A, 80 °C, k = 0.18 × 10⁻³ s⁻¹.
    const k_s = k1ThcaToThcPerMin(80) / 60 // min⁻¹ → s⁻¹
    const expected = 0.18e-3 // s⁻¹
    const rel_err = Math.abs(k_s - expected) / expected
    expect(rel_err).toBeLessThan(0.10)
  })

  it('k₁ at 95 °C matches Wang 2016 Table 2 measured k = 0.66 × 10⁻³ s⁻¹ within 10 %', () => {
    // Wang 2016 Table 2 (p. 270): THCA-A, 95 °C, k = 0.66 × 10⁻³ s⁻¹.
    const k_s = k1ThcaToThcPerMin(95) / 60
    const expected = 0.66e-3
    const rel_err = Math.abs(k_s - expected) / expected
    expect(rel_err).toBeLessThan(0.10)
  })

  it('k₁ at 110 °C matches Wang 2016 Table 2 measured k = 1.83 × 10⁻³ s⁻¹ within 10 %', () => {
    // Wang 2016 Table 2 (p. 270): THCA-A, 110 °C, k = 1.83 × 10⁻³ s⁻¹.
    const k_s = k1ThcaToThcPerMin(110) / 60
    const expected = 1.83e-3
    const rel_err = Math.abs(k_s - expected) / expected
    expect(rel_err).toBeLessThan(0.10)
  })

  // --- Arrhenius-prediction temps (no direct measurement) ------------------

  it('k₁ at 100 °C is consistent with the Wang 2016 3-point Arrhenius fit (within 5 %)', () => {
    // Wang 2016 did not directly measure at 100 °C; the "Wang 2016
    // measurement" at 100 °C is the regression of their 3 measured
    // points. The engine's k₁(100 °C) is the regression value computed
    // independently from the engine's constants, so the relative error
    // is essentially zero (well within 5 %).
    const k_s = k1ThcaToThcPerMin(100) / 60
    const regression = 1.3976e9 * Math.exp(-87058 / (8.314 * 373.15))
    const rel_err = Math.abs(k_s - regression) / regression
    expect(rel_err).toBeLessThan(0.05)
  })

  it('k₁ at 120 °C is consistent with the Wang 2016 3-point Arrhenius fit (within 5 %)', () => {
    const k_s = k1ThcaToThcPerMin(120) / 60
    const regression = 1.3976e9 * Math.exp(-87058 / (8.314 * 393.15))
    const rel_err = Math.abs(k_s - regression) / regression
    expect(rel_err).toBeLessThan(0.05)
  })

  it('k₁ at 140 °C is consistent with the Wang 2016 3-point Arrhenius fit (within 5 %)', () => {
    const k_s = k1ThcaToThcPerMin(140) / 60
    const regression = 1.3976e9 * Math.exp(-87058 / (8.314 * 413.15))
    const rel_err = Math.abs(k_s - regression) / regression
    expect(rel_err).toBeLessThan(0.05)
  })

  // --- temperature dependence ---------------------------------------------

  it('Q10 (per-decade rate ratio) is ≈ 2 ± 0.4 between 100 °C and 140 °C', () => {
    // 4 decades of 10 °C (100→110→120→130→140). Per-decade Q10 =
    // (k140 / k100)^(10/40).
    const k100 = k1ThcaToThcPerMin(100)
    const k140 = k1ThcaToThcPerMin(140)
    const q10 = (k140 / k100) ** (10 / 40)
    expect(q10).toBeGreaterThan(1.6) // 2 − 0.4
    expect(q10).toBeLessThan(2.4) // 2 + 0.4
  })

  // --- 25 °C extrapolation (HONEST BAND, not 1–100 yr) ---------------------

  it('k₁ at 25 °C halflife is between 1 day and 100 years — Wang 2016 Arrhenius extrapolation ≈ 10 days', () => {
    // EXTRAPOLATION CAVEAT: the Arrhenius fit is from 80–110 °C only. At
    // 25 °C the fit predicts k ≈ 7.8 × 10⁻⁷ s⁻¹ → halflife ≈ 10 days. The
    // 1–100 year room-temperature stability of THCA in plant material is an
    // empirical observation that is NOT supported by Wang 2016 alone — it
    // would require a different Ea at low T (curved Arrhenius plot, distinct
    // mechanism, or a low-T-specific citation such as Trofin 2012 / Lindholst
    // 2010, both currently flagged ⚠ unverified in academic-references.md).
    //
    // This test pins the actual Arrhenius prediction to a sane bound
    // (1 day to 100 years) rather than asserting the unphysical 1–100 year
    // band on Wang 2016 data alone. See doneness-simulation.ts header for
    // the full extrapolation caveat.
    const k = k1ThcaToThcPerMin(25)
    const halflife_min = Math.LN2 / k
    const one_day = 24 * 60
    const one_hundred_years = 100 * 365.25 * 24 * 60
    expect(halflife_min).toBeGreaterThan(one_day)
    expect(halflife_min).toBeLessThan(one_hundred_years)
  })

  // --- engine-side integration: simulateDoneness uses the same constants --

  it('simulateDoneness at 120 °C reaches > 90 % THC by 30 min (30-min/120 °C decarb window)', () => {
    // The 30-min/120 °C decarb window is the rationale for the original
    // engineering-overestimate constants. The new Wang 2016 fit preserves
    // that qualitative behavior — k₁(120 °C) ≈ 0.23 min⁻¹ → halflife
    // ≈ 3 min, so THCA is effectively gone well before 30 min, leaving
    // ~95 % THC (the rest is slow THC→CBN conversion by k₂). The window
    // is therefore still satisfied without the 10⁴× A overestimate.
    const points = simulateDoneness(120, 30, 60)
    const last = points[points.length - 1]
    expect(last.thc).toBeGreaterThan(90)
    expect(last.thca).toBeLessThan(5)
  })
})
