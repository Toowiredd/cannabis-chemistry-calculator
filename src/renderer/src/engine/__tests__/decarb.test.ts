/**
 * Failing tests (RED) for decarboxylation engine.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/decarb.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
  calculateRange,
} from '../decarb'

describe('calculateTheoreticalMax', () => {
  it('calculates theoretical max from THCA only (VAL-DECARB-001)', () => {
    // 10g × 20% THCA × 0.877 × 1000 = 1754.0 mg
    expect(calculateTheoreticalMax(10, 20, 0)).toBe(1754.0)
  })

  it('calculates theoretical max with existing THC (VAL-DECARB-002)', () => {
    // 5g × ((15% × 0.877) + 2%) × 1000 = 757.75 → 757.8 mg
    expect(calculateTheoreticalMax(5, 15, 2)).toBe(757.8)
  })

  it('returns 0.0 for zero inputs (VAL-DECARB-008)', () => {
    expect(calculateTheoreticalMax(0, 0, 0)).toBe(0.0)
  })

  it('handles large inputs without overflow (VAL-DECARB-009)', () => {
    // 1000g × 100% THCA × 0.877 × 1000 = 877000.0 mg
    expect(calculateTheoreticalMax(1000, 100, 0)).toBe(877000.0)
  })

  it('rounds to max 1 decimal (VAL-DECARB-007)', () => {
    // 3.33 * ((0.197*0.877) + 0.008) * 1000 ≈ 601.96 → 602.0
    expect(calculateTheoreticalMax(3.33, 19.7, 0.8)).toBe(602.0)
  })

  it('rejects negative grams (VAL-DECARB-034)', () => {
    expect(() => calculateTheoreticalMax(-5, 20, 0)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMax(-5, 20, 0)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects negative THCA (VAL-DECARB-035)', () => {
    expect(() => calculateTheoreticalMax(10, -10, 0)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMax(10, -10, 0)).toThrow(
      'thcaPct cannot be negative'
    )
  })

  it('rejects negative THC (VAL-DECARB-036)', () => {
    expect(() => calculateTheoreticalMax(10, 0, -5)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMax(10, 0, -5)).toThrow(
      'thcPct cannot be negative'
    )
  })

  it('rejects THCA > 100% (VAL-DECARB-037)', () => {
    expect(() => calculateTheoreticalMax(10, 110, 0)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMax(10, 110, 0)).toThrow(
      'thcaPct cannot exceed 100%'
    )
  })

  it('rejects THCA + THC > 100% (VAL-DECARB-038)', () => {
    expect(() => calculateTheoreticalMax(10, 60, 50)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMax(10, 60, 50)).toThrow(
      'thcaPct + thcPct cannot exceed 100%'
    )
  })

  it('accepts combined THCA + THC exactly 100%', () => {
    expect(calculateTheoreticalMax(10, 100, 0)).toBe(8770.0)
    expect(calculateTheoreticalMax(10, 0, 100)).toBe(10000.0)
    expect(calculateTheoreticalMax(10, 50, 50)).toBe(9385.0)
  })
})

describe('calculateDecarbedThc', () => {
  it('applies a single efficiency factor', () => {
    // 1754.0 * 0.97 = 1701.38 → 1701.4
    expect(calculateDecarbedThc(1754.0, 0.97)).toBe(1701.4)
  })

  it('returns 0.0 when theoretical max is 0', () => {
    expect(calculateDecarbedThc(0, 0.9)).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateDecarbedThc(-100, 0.9)).toThrow(ValidationError)
  })

  it('rejects negative efficiency', () => {
    expect(() => calculateDecarbedThc(100, -0.1)).toThrow(ValidationError)
  })

  it('rejects efficiency > 1.0', () => {
    expect(() => calculateDecarbedThc(100, 1.5)).toThrow(ValidationError)
  })

  it('rounds to max 1 decimal', () => {
    // 333 * 0.82 = 273.06 → 273.1
    expect(calculateDecarbedThc(333, 0.82)).toBe(273.1)
  })
})

describe('calculateRange', () => {
  it('returns low/expected/high from efficiency range (VAL-DECARB-003)', () => {
    const range = calculateRange(1754.0, 0.95, 0.97, 0.98)
    // low:   1754 * 0.95 = 1666.3
    // expected: 1754 * 0.97 = 1701.4
    // high:    1754 * 0.98 = 1718.9
    expect(range.low).toBe(1666.3)
    expect(range.expected).toBe(1701.4)
    expect(range.high).toBe(1718.9)
  })

  it('handles single-point efficiency (no range) (VAL-DECARB-004)', () => {
    const theoreticalMax = 500.0
    const range = calculateRange(theoreticalMax, 0.9, 0.9, 0.9)
    const _expected = 500.0 * 0.9 // 450.0
    expect(range.low).toBe(450.0)
    expect(range.expected).toBe(450.0)
    expect(range.high).toBe(450.0)
    expect(range.low).toBe(range.expected)
    expect(range.expected).toBe(range.high)
  })

  it('returns all zeros when theoretical max is 0', () => {
    const range = calculateRange(0, 0.95, 0.97, 0.98)
    expect(range.low).toBe(0.0)
    expect(range.expected).toBe(0.0)
    expect(range.high).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateRange(-100, 0.9, 0.95, 0.98)).toThrow(ValidationError)
  })

  it('rejects efficiency out of [0, 1] range', () => {
    expect(() => calculateRange(100, -0.1, 0.5, 0.9)).toThrow(ValidationError)
    expect(() => calculateRange(100, 0.1, 0.5, 1.5)).toThrow(ValidationError)
    expect(() => calculateRange(100, 0.1, 1.1, 0.9)).toThrow(ValidationError)
  })

  it('rejects low > expected or expected > high', () => {
    expect(() => calculateRange(100, 0.9, 0.8, 0.85)).toThrow(ValidationError)
    expect(() => calculateRange(100, 0.7, 0.8, 0.75)).toThrow(ValidationError)
  })

  it('handles large inputs (VAL-DECARB-009)', () => {
    const theoreticalMax = 877000.0 // 1000g, 100% THCA
    const range = calculateRange(theoreticalMax, 0.88, 0.92, 0.95)
    expect(range.low).toBe(771760.0)
    expect(range.expected).toBe(806840.0)
    expect(range.high).toBe(833150.0)
  })

  it('rounds all values to max 1 decimal', () => {
    // 333.33 * 0.875 = 291.66 → 291.7
    const range = calculateRange(333.3, 0.75, 0.875, 0.99)
    expect(range.low).toBe(250.0) // 333.3 * 0.75 = 250.0 (rounds to max 1)
    expect(range.expected).toBe(291.6) // 333.3 * 0.875 = 291.662...
    expect(range.high).toBe(330.0) // 333.3 * 0.99 = 329.967
  })
})
