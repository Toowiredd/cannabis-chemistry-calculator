/**
 * Tests for THC degradation engine (degradation.ts).
 * First-order kinetics model for THC -> CBN conversion.
 * Uses Jaidee 2022 rate constants.
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  DEGRADATION_RATES,
  calculateRemainingThcPercent,
  calculateCbnFormedPercent,
  calculateHalfLifeDays,
  calculateDegradation,
} from '../degradation'

describe('DEGRADATION_RATES', () => {
  it('contains exactly 3 temperature presets (VAL-DEG-002)', () => {
    expect(DEGRADATION_RATES).toHaveLength(3)
  })

  it('has 4C refrigerated rate ~0.00005 day^-1 (VAL-DEG-002)', () => {
    const r = DEGRADATION_RATES.find(d => d.tempC === 4)
    expect(r).toBeDefined()
    expect(r!.ratePerDay).toBeCloseTo(0.00005, 5)
    expect(r!.label).toBe('Refrigerated')
  })

  it('has 25C room temp rate ~0.0005 day^-1 (VAL-DEG-001, VAL-DEG-002)', () => {
    const r = DEGRADATION_RATES.find(d => d.tempC === 25)
    expect(r).toBeDefined()
    expect(r!.ratePerDay).toBeCloseTo(0.0005, 5)
    expect(r!.label).toBe('Room Temperature')
  })

  it('has 40C warm rate ~0.002 day^-1 (VAL-DEG-002)', () => {
    const r = DEGRADATION_RATES.find(d => d.tempC === 40)
    expect(r).toBeDefined()
    expect(r!.ratePerDay).toBeCloseTo(0.002, 5)
    expect(r!.label).toBe('Warm Storage')
  })
})

describe('calculateRemainingThcPercent', () => {
  it('returns 100% at day 0 for any temperature', () => {
    expect(calculateRemainingThcPercent(0, 0.0005)).toBe(100.0)
    expect(calculateRemainingThcPercent(0, 0.002)).toBe(100.0)
  })

  it('90 days at 25C -> 95.6% remaining (VAL-DEG-001)', () => {
    // e^(-0.0005 * 90) = e^(-0.045) = 0.955997... -> 95.6%
    expect(calculateRemainingThcPercent(90, 0.0005)).toBe(95.6)
  })

  it('365 days at 4C -> ~98.2% remaining', () => {
    // e^(-0.00005 * 365) = e^(-0.01825) = 0.981916... -> 98.2%
    expect(calculateRemainingThcPercent(365, 0.00005)).toBe(98.2)
  })

  it('30 days at 40C -> ~94.2% remaining', () => {
    // e^(-0.002 * 30) = e^(-0.06) = 0.941764... -> 94.2%
    expect(calculateRemainingThcPercent(30, 0.002)).toBe(94.2)
  })

  it('rounds to max 1 decimal', () => {
    // e^(-0.0005 * 1) = 0.9995001... -> 100.0%
    expect(calculateRemainingThcPercent(1, 0.0005)).toBe(100.0)
  })

  it('rejects negative days', () => {
    expect(() => calculateRemainingThcPercent(-1, 0.0005)).toThrow(
      ValidationError
    )
  })

  it('rejects negative rate', () => {
    expect(() => calculateRemainingThcPercent(10, -0.001)).toThrow(
      ValidationError
    )
  })
})

describe('calculateCbnFormedPercent', () => {
  it('returns 0% at day 0', () => {
    expect(calculateCbnFormedPercent(0, 0.0005)).toBe(0.0)
  })

  it('90 days at 25C -> 4.4% CBN formed (VAL-DEG-001)', () => {
    // 100 - 95.6 = 4.4%
    expect(calculateCbnFormedPercent(90, 0.0005)).toBe(4.4)
  })

  it('365 days at 4C -> ~1.8% CBN formed', () => {
    // 100 - 98.2 = 1.8%
    expect(calculateCbnFormedPercent(365, 0.00005)).toBe(1.8)
  })

  it('rejects negative days', () => {
    expect(() => calculateCbnFormedPercent(-1, 0.0005)).toThrow(ValidationError)
  })

  it('rejects negative rate', () => {
    expect(() => calculateCbnFormedPercent(10, -0.001)).toThrow(ValidationError)
  })
})

describe('calculateHalfLifeDays', () => {
  it('4C -> ~13860 days (~38 years) (VAL-DEG-002)', () => {
    // ln(2) / 0.00005 = 13862.9
    expect(calculateHalfLifeDays(0.00005)).toBe(13862.9)
  })

  it('25C -> ~1386 days (~3.8 years) (VAL-DEG-002)', () => {
    // ln(2) / 0.0005 = 1386.29 -> 1386.3
    expect(calculateHalfLifeDays(0.0005)).toBe(1386.3)
  })

  it('40C -> ~346.6 days (~11.5 months) (VAL-DEG-002)', () => {
    // ln(2) / 0.002 = 346.57 -> 346.6
    expect(calculateHalfLifeDays(0.002)).toBe(346.6)
  })

  it('rejects zero rate', () => {
    expect(() => calculateHalfLifeDays(0)).toThrow(ValidationError)
  })

  it('rejects negative rate', () => {
    expect(() => calculateHalfLifeDays(-0.001)).toThrow(ValidationError)
  })
})

describe('calculateDegradation', () => {
  it('returns full degradation result for 90 days at 25C (VAL-DEG-001, VAL-DEG-003)', () => {
    const result = calculateDegradation(90, 25)
    expect(result.days).toBe(90)
    expect(result.tempC).toBe(25)
    expect(result.ratePerDay).toBeCloseTo(0.0005, 5)
    expect(result.thcRemainingPercent).toBe(95.6)
    expect(result.cbnFormedPercent).toBe(4.4)
    expect(result.halfLifeDays).toBe(1386.3)
    expect(result.label).toBe('Room Temperature')
    expect(result.isEstimate).toBe(true)
  })

  it('returns full degradation result for 365 days at 4C (VAL-DEG-002, VAL-DEG-003)', () => {
    const result = calculateDegradation(365, 4)
    expect(result.days).toBe(365)
    expect(result.tempC).toBe(4)
    expect(result.thcRemainingPercent).toBe(98.2)
    expect(result.cbnFormedPercent).toBe(1.8)
    expect(result.halfLifeDays).toBe(13862.9)
    expect(result.label).toBe('Refrigerated')
    expect(result.isEstimate).toBe(true)
  })

  it('returns full degradation result for 30 days at 40C (VAL-DEG-002, VAL-DEG-003)', () => {
    const result = calculateDegradation(30, 40)
    expect(result.days).toBe(30)
    expect(result.tempC).toBe(40)
    expect(result.thcRemainingPercent).toBe(94.2)
    expect(result.cbnFormedPercent).toBe(5.8)
    expect(result.halfLifeDays).toBe(346.6)
    expect(result.label).toBe('Warm Storage')
    expect(result.isEstimate).toBe(true)
  })

  it('rejects negative days', () => {
    expect(() => calculateDegradation(-1, 25)).toThrow(ValidationError)
  })

  it('rejects unsupported temperature', () => {
    expect(() => calculateDegradation(30, 100)).toThrow(ValidationError)
  })
})
