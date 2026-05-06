/**
 * Fat infusion engine tests (TDD).
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/infusion.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  calculateInfusedThc,
  calculateMgPerMl,
  calculateSimplifiedEstimate,
} from '../infusion'

describe('calculateInfusedThc', () => {
  it('calculates infused THC for coconut oil (VAL-INFUSE-001 / VAL-INFUSE-008)', () => {
    // 500 mg decarbed × 0.82 coconut efficiency = 410.0 mg
    expect(calculateInfusedThc(500, 0.82)).toBe(410.0)
  })

  it('calculates infused THC for ghee (VAL-INFUSE-007)', () => {
    // 500 mg decarbed × 0.85 ghee efficiency = 425.0 mg
    expect(calculateInfusedThc(500, 0.85)).toBe(425.0)
  })

  it('calculates infused THC for MCT oil (VAL-INFUSE-009)', () => {
    // 500 mg decarbed × 0.92 MCT efficiency = 460.0 mg
    expect(calculateInfusedThc(500, 0.92)).toBe(460.0)
  })

  it('returns 0.0 when extraction efficiency is zero (VAL-INFUSE-005)', () => {
    expect(calculateInfusedThc(500, 0)).toBe(0.0)
    expect(calculateInfusedThc(1000, 0)).toBe(0.0)
  })

  it('output equals input when efficiency is 1.0 (VAL-INFUSE-006)', () => {
    expect(calculateInfusedThc(500, 1.0)).toBe(500.0)
    expect(calculateInfusedThc(0, 1.0)).toBe(0.0)
  })

  it('rounds to max 1 decimal (VAL-INFUSE-003)', () => {
    // 333 mg × 0.82 = 273.06 → 273.1
    expect(calculateInfusedThc(333, 0.82)).toBe(273.1)
  })

  it('handles large inputs without overflow (VAL-INFUSE-004)', () => {
    // 50000 mg × 0.92 = 46000.0
    expect(calculateInfusedThc(50000, 0.92)).toBe(46000.0)
  })

  it('returns 0.0 when decarbed THC is 0', () => {
    expect(calculateInfusedThc(0, 0.82)).toBe(0.0)
  })

  it('rejects negative decarbed THC', () => {
    expect(() => calculateInfusedThc(-100, 0.82)).toThrow(ValidationError)
    expect(() => calculateInfusedThc(-100, 0.82)).toThrow(
      'decarbedThc cannot be negative'
    )
  })

  it('rejects negative extraction efficiency', () => {
    expect(() => calculateInfusedThc(500, -0.1)).toThrow(ValidationError)
  })

  it('rejects efficiency greater than 1.0', () => {
    expect(() => calculateInfusedThc(500, 1.5)).toThrow(ValidationError)
  })
})

describe('calculateMgPerMl', () => {
  it('calculates mg per mL (VAL-INFUSE-001)', () => {
    // 410.0 mg / 100 mL = 4.1 mg/mL
    expect(calculateMgPerMl(410.0, 100)).toBe(4.1)
  })

  it('calculates mg per mL for doubled volume (VAL-INFUSE-002)', () => {
    // 820.0 mg / 200 mL = 4.1 mg/mL
    expect(calculateMgPerMl(820.0, 200)).toBe(4.1)
  })

  it('rounds to max 1 decimal (VAL-INFUSE-003)', () => {
    // 273.06 mg / 73 mL = 3.7405... → 3.7
    expect(calculateMgPerMl(273.06, 73)).toBe(3.7)
  })

  it('handles large inputs without overflow (VAL-INFUSE-004)', () => {
    // 46000.0 mg / 1000 mL = 46.0
    expect(calculateMgPerMl(46000.0, 1000)).toBe(46.0)
  })

  it('throws ValidationError when volume is zero (feature spec)', () => {
    expect(() => calculateMgPerMl(410, 0)).toThrow(ValidationError)
    expect(() => calculateMgPerMl(410, 0)).toThrow(
      'volumeMl must be greater than 0'
    )
  })

  it('throws ValidationError when volume is negative', () => {
    expect(() => calculateMgPerMl(410, -10)).toThrow(ValidationError)
  })

  it('throws ValidationError when infused THC is negative', () => {
    expect(() => calculateMgPerMl(-100, 100)).toThrow(ValidationError)
  })

  it('returns 0.0 when infused THC is 0', () => {
    expect(calculateMgPerMl(0, 100)).toBe(0.0)
  })
})

describe('calculateSimplifiedEstimate', () => {
  it('calculates ghee simplified estimate (feature spec / VAL-INFUSE-013)', () => {
    // 10 g × 18 × 8.5 = 1530.0 mg
    expect(calculateSimplifiedEstimate(10, 18, 8.5)).toBe(1530.0)
  })

  it('calculates coconut oil estimate (VAL-INFUSE-014)', () => {
    // 10 g × 18 × 8.2 = 1476.0 mg
    expect(calculateSimplifiedEstimate(10, 18, 8.2)).toBe(1476.0)
  })

  it('calculates MCT oil estimate (VAL-INFUSE-015)', () => {
    // 10 g × 18 × 9.2 = 1656.0 mg
    expect(calculateSimplifiedEstimate(10, 18, 9.2)).toBe(1656.0)
  })

  it('returns 0.0 when grams is 0', () => {
    expect(calculateSimplifiedEstimate(0, 20, 8.5)).toBe(0.0)
  })

  it('returns 0.0 when thcaPct is 0', () => {
    expect(calculateSimplifiedEstimate(10, 0, 8.5)).toBe(0.0)
  })

  it('returns 0.0 when multiplier is 0', () => {
    expect(calculateSimplifiedEstimate(10, 18, 0)).toBe(0.0)
  })

  it('rejects negative grams', () => {
    expect(() => calculateSimplifiedEstimate(-5, 18, 8.5)).toThrow(
      ValidationError
    )
    expect(() => calculateSimplifiedEstimate(-5, 18, 8.5)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects negative thcaPct', () => {
    expect(() => calculateSimplifiedEstimate(10, -10, 8.5)).toThrow(
      ValidationError
    )
  })

  it('rejects negative multiplier', () => {
    expect(() => calculateSimplifiedEstimate(10, 18, -1)).toThrow(
      ValidationError
    )
  })

  it('rejects thcaPct > 100', () => {
    expect(() => calculateSimplifiedEstimate(10, 110, 8.5)).toThrow(
      ValidationError
    )
  })

  it('rounds to max 1 decimal', () => {
    // 3.33 g × 19.7 × 8.2 = 537.9282 → 537.9
    expect(calculateSimplifiedEstimate(3.33, 19.7, 8.2)).toBe(537.9)
    // 3.33 g × 19.7 × 8.3 = 544.449 → 544.5
    expect(calculateSimplifiedEstimate(3.33, 19.7, 8.3)).toBe(544.5)
  })
})
