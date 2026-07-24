/**
 * Tests for the AVB (Already Vaped Bud) math layer in `decarb.ts`.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/avb.test.ts
 */
import { describe, expect, it } from 'vitest'
import {
  AVB_RESIDUAL_THC_RANGES,
  calculateAvbTheoreticalMax,
  calculateAvbTheoreticalMaxFromColor,
} from '../decarb'
import { calculateTheoreticalMax } from '../decarb'
import { ValidationError } from '../errors'

describe('calculateAvbTheoreticalMax', () => {
  it('returns 0.0 for zero residual THC (VAL-AVB-001)', () => {
    // 1g × 0% × 1000 = 0 mg
    expect(calculateAvbTheoreticalMax(1, 0)).toBe(0.0)
  })

  it('calculates theoretical max for 1g @ 5% residual (VAL-AVB-002)', () => {
    // 1g × 5% × 1000 = 50 mg
    expect(calculateAvbTheoreticalMax(1, 5)).toBe(50.0)
  })

  it('calculates theoretical max for 3.5g @ 6.5% residual (light-color mid)', () => {
    // 3.5 × 0.065 × 1000 = 227.5 mg
    expect(calculateAvbTheoreticalMax(3.5, 6.5)).toBe(227.5)
  })

  it('does NOT apply the 0.877 THCA→THC factor (AVB is already-active THC)', () => {
    // AVB path: 1g × 5% × 1000 = 50 mg (no 0.877 factor)
    expect(calculateAvbTheoreticalMax(1, 5)).toBe(50.0)
    // THCA path on the same input: 1g × 5% × 0.877 × 1000 = 43.9 mg
    expect(calculateTheoreticalMax(1, 5, 0)).toBe(43.9)
    // The 50.0 vs 43.9 gap proves the AVB path skipped the 0.877 factor
    expect(calculateAvbTheoreticalMax(1, 5)).not.toBe(
      calculateTheoreticalMax(1, 5, 0)
    )
  })

  it('rejects negative grams (VAL-AVB-003)', () => {
    expect(() => calculateAvbTheoreticalMax(-1, 5)).toThrow(ValidationError)
    expect(() => calculateAvbTheoreticalMax(-1, 5)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects residualThcPct > 100% (VAL-AVB-004)', () => {
    expect(() => calculateAvbTheoreticalMax(1, 150)).toThrow(ValidationError)
    expect(() => calculateAvbTheoreticalMax(1, 150)).toThrow(
      'residualThcPct cannot exceed 100%'
    )
  })

  it('rejects negative residualThcPct (VAL-AVB-005)', () => {
    expect(() => calculateAvbTheoreticalMax(1, -1)).toThrow(ValidationError)
    expect(() => calculateAvbTheoreticalMax(1, -1)).toThrow(
      'residualThcPct cannot be negative'
    )
  })
})

describe('calculateAvbTheoreticalMaxFromColor', () => {
  it('returns expected ≈ 227.5 mg for 3.5g light AVB (mid of 5–8%)', () => {
    // light: min 5, mid 6.5, max 8 → 3.5g mid = 3.5 × 0.065 × 1000 = 227.5
    const r = calculateAvbTheoreticalMaxFromColor(3.5, 'light')
    expect(r.expected).toBe(227.5)
    expect(r.low).toBe(175.0) // 3.5 × 0.05 × 1000
    expect(r.high).toBe(280.0) // 3.5 × 0.08 × 1000
  })

  it('preserves the low ≤ expected ≤ high ordering for every color', () => {
    for (const color of ['light', 'medium', 'dark'] as const) {
      const r = calculateAvbTheoreticalMaxFromColor(3.5, color)
      expect(r.low).toBeLessThanOrEqual(r.expected)
      expect(r.expected).toBeLessThanOrEqual(r.high)
    }
  })
})

describe('AVB_RESIDUAL_THC_RANGES preset', () => {
  it('has exactly 3 colors (light / medium / dark), all with efficiency = 1.0', () => {
    const colors = Object.keys(AVB_RESIDUAL_THC_RANGES)
    expect(colors).toHaveLength(3)
    expect(colors.sort()).toEqual(['dark', 'light', 'medium'])
    for (const color of colors) {
      const range =
        AVB_RESIDUAL_THC_RANGES[color as keyof typeof AVB_RESIDUAL_THC_RANGES]
      expect(range.efficiency).toBe(1.0)
    }
  })
})
