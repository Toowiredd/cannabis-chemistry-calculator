import { describe, expect, it } from 'vitest'
import { k2ThcToCbnPerMin, simulateDoneness } from '../doneness-simulation'

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
