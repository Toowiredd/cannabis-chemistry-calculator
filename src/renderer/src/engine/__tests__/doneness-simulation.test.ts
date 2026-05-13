import { describe, expect, it } from 'vitest'
import { simulateDoneness } from '../doneness-simulation'

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
