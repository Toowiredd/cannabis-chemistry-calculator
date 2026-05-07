/**
 * Failing tests (RED) for CBDA → CBD decarboxylation engine.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/cbda.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  calculateTheoreticalMaxCbd,
  calculateDecarbedCbd,
  calculateCbdRange,
} from '../cbda'

describe('calculateTheoreticalMaxCbd', () => {
  it('calculates theoretical max from CBDA only (VAL-CBDA-001)', () => {
    // 10g × 15% CBDA × 0.877 × 1000 = 1315.5 mg
    expect(calculateTheoreticalMaxCbd(10, 15, 0)).toBe(1315.5)
  })

  it('calculates theoretical max with existing CBD (VAL-CBDA-001)', () => {
    // 10g × ((15% × 0.877) + 2%) × 1000 = 10 × (0.13155 + 0.02) × 1000 = 1515.5 mg
    expect(calculateTheoreticalMaxCbd(10, 15, 2)).toBe(1515.5)
  })

  it('existing CBD contributes additively without 0.877 factor (VAL-CBDA-001)', () => {
    // 5g × ((10% × 0.877) + 5%) × 1000 = 5 × (0.0877 + 0.05) × 1000 = 688.5 mg
    expect(calculateTheoreticalMaxCbd(5, 10, 5)).toBe(688.5)
  })

  it('returns 0.0 for zero inputs', () => {
    expect(calculateTheoreticalMaxCbd(0, 0, 0)).toBe(0.0)
  })

  it('handles large inputs without overflow', () => {
    // 1000g × 100% CBDA × 0.877 × 1000 = 877000.0 mg
    expect(calculateTheoreticalMaxCbd(1000, 100, 0)).toBe(877000.0)
  })

  it('rounds to max 1 decimal', () => {
    // 3.33 * ((0.197*0.877) + 0.008) * 1000 ≈ 601.96 → 602.0
    expect(calculateTheoreticalMaxCbd(3.33, 19.7, 0.8)).toBe(602.0)
  })

  it('rejects negative grams', () => {
    expect(() => calculateTheoreticalMaxCbd(-5, 20, 0)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMaxCbd(-5, 20, 0)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects negative CBDA', () => {
    expect(() => calculateTheoreticalMaxCbd(10, -10, 0)).toThrow(
      ValidationError
    )
    expect(() => calculateTheoreticalMaxCbd(10, -10, 0)).toThrow(
      'cbdaPct cannot be negative'
    )
  })

  it('rejects negative CBD', () => {
    expect(() => calculateTheoreticalMaxCbd(10, 0, -5)).toThrow(ValidationError)
    expect(() => calculateTheoreticalMaxCbd(10, 0, -5)).toThrow(
      'cbdPct cannot be negative'
    )
  })

  it('rejects CBDA > 100% (VAL-CBDA-003)', () => {
    expect(() => calculateTheoreticalMaxCbd(10, 110, 0)).toThrow(
      ValidationError
    )
    expect(() => calculateTheoreticalMaxCbd(10, 110, 0)).toThrow(
      'cbdaPct cannot exceed 100%'
    )
  })

  it('rejects CBDA + CBD > 100% (VAL-CBDA-003)', () => {
    expect(() => calculateTheoreticalMaxCbd(10, 60, 50)).toThrow(
      ValidationError
    )
    expect(() => calculateTheoreticalMaxCbd(10, 60, 50)).toThrow(
      'cbdaPct + cbdPct cannot exceed 100%'
    )
  })

  it('accepts combined CBDA + CBD exactly 100%', () => {
    expect(calculateTheoreticalMaxCbd(10, 100, 0)).toBe(8770.0)
    expect(calculateTheoreticalMaxCbd(10, 0, 100)).toBe(10000.0)
    expect(calculateTheoreticalMaxCbd(10, 50, 50)).toBe(9385.0)
  })
})

describe('calculateDecarbedCbd', () => {
  it('applies a single efficiency factor to theoretical max CBD', () => {
    // 1315.5 * 0.97 = 1276.035 → 1276.0
    expect(calculateDecarbedCbd(1315.5, 0.97)).toBe(1276.0)
  })

  it('returns 0.0 when theoretical max is 0', () => {
    expect(calculateDecarbedCbd(0, 0.9)).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateDecarbedCbd(-100, 0.9)).toThrow(ValidationError)
  })

  it('rejects negative efficiency', () => {
    expect(() => calculateDecarbedCbd(100, -0.1)).toThrow(ValidationError)
  })

  it('rejects efficiency > 1.0', () => {
    expect(() => calculateDecarbedCbd(100, 1.5)).toThrow(ValidationError)
  })

  it('rounds to max 1 decimal', () => {
    // 333 * 0.82 = 273.06 → 273.1
    expect(calculateDecarbedCbd(333, 0.82)).toBe(273.1)
  })
})

describe('calculateCbdRange', () => {
  it('returns low/expected/high from efficiency range (VAL-CBDA-002)', () => {
    const range = calculateCbdRange(1315.5, 0.85, 0.88, 0.92)
    // low:      1315.5 * 0.85 = 1118.175 → 1118.2
    // expected: 1315.5 * 0.88 = 1157.64  → 1157.6
    // high:     1315.5 * 0.92 = 1210.26  → 1210.3
    expect(range.low).toBe(1118.2)
    expect(range.expected).toBe(1157.6)
    expect(range.high).toBe(1210.3)
  })

  it('handles single-point efficiency (no range)', () => {
    const theoreticalMax = 500.0
    const range = calculateCbdRange(theoreticalMax, 0.9, 0.9, 0.9)
    expect(range.low).toBe(450.0)
    expect(range.expected).toBe(450.0)
    expect(range.high).toBe(450.0)
    expect(range.low).toBe(range.expected)
    expect(range.expected).toBe(range.high)
  })

  it('returns all zeros when theoretical max is 0', () => {
    const range = calculateCbdRange(0, 0.95, 0.97, 0.98)
    expect(range.low).toBe(0.0)
    expect(range.expected).toBe(0.0)
    expect(range.high).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateCbdRange(-100, 0.9, 0.95, 0.98)).toThrow(
      ValidationError
    )
  })

  it('rejects efficiency out of [0, 1] range', () => {
    expect(() => calculateCbdRange(100, -0.1, 0.5, 0.9)).toThrow(
      ValidationError
    )
    expect(() => calculateCbdRange(100, 0.1, 0.5, 1.5)).toThrow(ValidationError)
    expect(() => calculateCbdRange(100, 0.1, 1.1, 0.9)).toThrow(ValidationError)
  })

  it('rejects low > expected or expected > high', () => {
    expect(() => calculateCbdRange(100, 0.9, 0.8, 0.85)).toThrow(
      ValidationError
    )
    expect(() => calculateCbdRange(100, 0.7, 0.8, 0.75)).toThrow(
      ValidationError
    )
  })

  it('handles large inputs', () => {
    const theoreticalMax = 877000.0
    const range = calculateCbdRange(theoreticalMax, 0.88, 0.92, 0.95)
    expect(range.low).toBe(771760.0)
    expect(range.expected).toBe(806840.0)
    expect(range.high).toBe(833150.0)
  })

  it('rounds all values to max 1 decimal', () => {
    const range = calculateCbdRange(333.3, 0.75, 0.875, 0.99)
    expect(range.low).toBe(250.0)
    expect(range.expected).toBe(291.6)
    expect(range.high).toBe(330.0)
  })
})
