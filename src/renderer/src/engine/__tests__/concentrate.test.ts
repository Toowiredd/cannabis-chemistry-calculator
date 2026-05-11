/**
 * Failing tests (RED) for concentrate calculator engine.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/concentrate.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  calculateConcentrateTheoreticalMax,
  calculateConcentrateDecarbedThc,
  calculateConcentrateRange,
  CONCENTRATE_TYPES,
} from '../concentrate'

describe('calculateConcentrateTheoreticalMax', () => {
  it('calculates theoretical max for 1g wax at 80% THCA (VAL-CONC-001)', () => {
    // 1g × 80% THCA × 0.877 × 1000 = 701.6 mg
    expect(calculateConcentrateTheoreticalMax(1, 80, 0)).toBe(701.6)
  })

  it('calculates theoretical max with existing THC contribution', () => {
    // 1g × ((80% × 0.877) + 5%) × 1000 = 1 × (0.7016 + 0.05) × 1000 = 751.6 mg
    expect(calculateConcentrateTheoreticalMax(1, 80, 5)).toBe(751.6)
  })

  it('distillate with 90% THC already-decarbed yields 900.0 mg (VAL-CONC-003)', () => {
    // 1g × (0% × 0.877 + 90%) × 1000 = 900.0 mg
    expect(calculateConcentrateTheoreticalMax(1, 0, 90)).toBe(900.0)
  })

  it('returns 0.0 for zero inputs', () => {
    expect(calculateConcentrateTheoreticalMax(0, 0, 0)).toBe(0.0)
  })

  it('handles large inputs without overflow', () => {
    // 100g × 100% THCA × 0.877 × 1000 = 87700.0 mg
    expect(calculateConcentrateTheoreticalMax(100, 100, 0)).toBe(87700.0)
  })

  it('rounds to max 1 decimal', () => {
    // 2.5 * ((0.75*0.877) + 0.03) * 1000 ≈ 2.5 * (0.65775 + 0.03) * 1000 = 1719.375 → 1719.4
    expect(calculateConcentrateTheoreticalMax(2.5, 75, 3)).toBe(1719.4)
  })

  it('rejects negative grams', () => {
    expect(() => calculateConcentrateTheoreticalMax(-1, 80, 0)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateTheoreticalMax(-1, 80, 0)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects negative THCA', () => {
    expect(() => calculateConcentrateTheoreticalMax(1, -10, 0)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateTheoreticalMax(1, -10, 0)).toThrow(
      'thcaPct cannot be negative'
    )
  })

  it('rejects negative THC', () => {
    expect(() => calculateConcentrateTheoreticalMax(1, 0, -5)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateTheoreticalMax(1, 0, -5)).toThrow(
      'thcPct cannot be negative'
    )
  })

  it('rejects THCA > 100%', () => {
    expect(() => calculateConcentrateTheoreticalMax(1, 110, 0)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateTheoreticalMax(1, 110, 0)).toThrow(
      'thcaPct cannot exceed 100%'
    )
  })

  it('rejects THCA + THC > 100%', () => {
    expect(() => calculateConcentrateTheoreticalMax(1, 60, 50)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateTheoreticalMax(1, 60, 50)).toThrow(
      'thcaPct + thcPct cannot exceed 100%'
    )
  })

  it('accepts combined THCA + THC exactly 100%', () => {
    expect(calculateConcentrateTheoreticalMax(1, 100, 0)).toBe(877.0)
    expect(calculateConcentrateTheoreticalMax(1, 0, 100)).toBe(1000.0)
    expect(calculateConcentrateTheoreticalMax(1, 50, 50)).toBe(938.5)
  })
})

describe('calculateConcentrateDecarbedThc', () => {
  it('applies decarb efficiency to theoretical max (VAL-CONC-001)', () => {
    // 701.6 * 0.95 = 666.52 → 666.5
    expect(calculateConcentrateDecarbedThc(701.6, 0.95)).toBe(666.5)
  })

  it('returns 0.0 when theoretical max is 0', () => {
    expect(calculateConcentrateDecarbedThc(0, 0.95)).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateConcentrateDecarbedThc(-100, 0.9)).toThrow(
      ValidationError
    )
  })

  it('rejects negative efficiency', () => {
    expect(() => calculateConcentrateDecarbedThc(100, -0.1)).toThrow(
      ValidationError
    )
  })

  it('rejects efficiency > 1.0', () => {
    expect(() => calculateConcentrateDecarbedThc(100, 1.5)).toThrow(
      ValidationError
    )
  })

  it('rounds to max 1 decimal', () => {
    // 333 * 0.82 = 273.06 → 273.1
    expect(calculateConcentrateDecarbedThc(333, 0.82)).toBe(273.1)
  })
})

describe('calculateConcentrateRange', () => {
  it('returns low/expected/high from efficiency range (VAL-CONC-001)', () => {
    const range = calculateConcentrateRange(701.6, 0.9, 0.95, 0.98)
    // low:    701.6 * 0.9  = 631.44  → 631.4
    // expected: 701.6 * 0.95 = 666.52  → 666.5
    // high:     701.6 * 0.98 = 687.568 → 687.6
    expect(range.low).toBe(631.4)
    expect(range.expected).toBe(666.5)
    expect(range.high).toBe(687.6)
  })

  it('handles single-point efficiency (no range)', () => {
    const range = calculateConcentrateRange(500.0, 0.9, 0.9, 0.9)
    expect(range.low).toBe(450.0)
    expect(range.expected).toBe(450.0)
    expect(range.high).toBe(450.0)
    expect(range.low).toBe(range.expected)
    expect(range.expected).toBe(range.high)
  })

  it('returns all zeros when theoretical max is 0', () => {
    const range = calculateConcentrateRange(0, 0.9, 0.95, 0.98)
    expect(range.low).toBe(0.0)
    expect(range.expected).toBe(0.0)
    expect(range.high).toBe(0.0)
  })

  it('rejects negative theoretical max', () => {
    expect(() => calculateConcentrateRange(-100, 0.9, 0.95, 0.98)).toThrow(
      ValidationError
    )
  })

  it('rejects efficiency out of [0, 1] range', () => {
    expect(() => calculateConcentrateRange(100, -0.1, 0.5, 0.9)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateRange(100, 0.1, 0.5, 1.5)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateRange(100, 0.1, 1.1, 0.9)).toThrow(
      ValidationError
    )
  })

  it('rejects low > expected or expected > high', () => {
    expect(() => calculateConcentrateRange(100, 0.9, 0.8, 0.85)).toThrow(
      ValidationError
    )
    expect(() => calculateConcentrateRange(100, 0.7, 0.8, 0.75)).toThrow(
      ValidationError
    )
  })

  it('rounds all values to max 1 decimal', () => {
    const range = calculateConcentrateRange(333.3, 0.75, 0.875, 0.99)
    expect(range.low).toBe(250.0)
    expect(range.expected).toBe(291.6)
    expect(range.high).toBe(330.0)
  })
})

describe('concentrate infusion integration (VAL-CONC-002)', () => {
  it('1g concentrate @ 80% THCA into 30mL MCT yields 20.4 mg/mL', () => {
    // Step 1: theoretical max
    const theoreticalMax = calculateConcentrateTheoreticalMax(1, 80, 0)
    expect(theoreticalMax).toBe(701.6)

    // Step 2: decarb at 95% efficiency
    const decarbed = calculateConcentrateDecarbedThc(theoreticalMax, 0.95)
    expect(decarbed).toBe(666.5)

    // Step 3: infusion into 30mL MCT (efficiency 0.92)
    const rawInfused = decarbed * 0.92
    const infused = Math.round((rawInfused + 1e-9) * 10) / 10
    expect(infused).toBe(613.2)

    // Step 4: mg/mL
    const rawMgPerMl = infused / 30
    const mgPerMl = Math.round((rawMgPerMl + 1e-9) * 10) / 10
    expect(mgPerMl).toBe(20.4)
  })
})

describe('CONCENTRATE_TYPES presets (VAL-CONC-003)', () => {
  it('contains exactly 6 concentrate types', () => {
    expect(CONCENTRATE_TYPES).toHaveLength(6)
  })

  it('contains wax, shatter, distillate, hash, kief, and RSO', () => {
    const ids = CONCENTRATE_TYPES.map(t => t.id)
    expect(ids).toContain('wax')
    expect(ids).toContain('shatter')
    expect(ids).toContain('distillate')
    expect(ids).toContain('hash')
    expect(ids).toContain('kief')
    expect(ids).toContain('rso')
  })

  it('distillate has needsDecarb = false (skip decarb step)', () => {
    const distillate = CONCENTRATE_TYPES.find(t => t.id === 'distillate')
    expect(distillate).toBeDefined()
    expect(distillate?.needsDecarb).toBe(false)
  })

  it('non-distillate types have needsDecarb = true', () => {
    const nonDistillate = CONCENTRATE_TYPES.filter(t => t.id !== 'distillate')
    for (const type of nonDistillate) {
      expect(type.needsDecarb).toBe(true)
    }
  })

  it('each type has a decarb guidance string', () => {
    for (const type of CONCENTRATE_TYPES) {
      expect(type.decarbGuidance).toBeTruthy()
      expect(typeof type.decarbGuidance).toBe('string')
      expect(type.decarbGuidance.length).toBeGreaterThan(0)
    }
  })

  it('each type has a human-readable name (text-only)', () => {
    for (const type of CONCENTRATE_TYPES) {
      expect(type.name).toBeTruthy()
      expect(typeof type.name).toBe('string')
      expect(type.name.length).toBeGreaterThan(0)
    }
  })

  it('each type has typical THCA and THC percentages in valid ranges', () => {
    for (const type of CONCENTRATE_TYPES) {
      expect(type.typicalThcaPct).toBeGreaterThanOrEqual(0)
      expect(type.typicalThcaPct).toBeLessThanOrEqual(100)
      expect(type.typicalThcPct).toBeGreaterThanOrEqual(0)
      expect(type.typicalThcPct).toBeLessThanOrEqual(100)
      expect(type.typicalThcaPct + type.typicalThcPct).toBeLessThanOrEqual(100)
    }
  })

  it('distillate has high THC and zero THCA', () => {
    const distillate = CONCENTRATE_TYPES.find(t => t.id === 'distillate')!
    expect(distillate.typicalThcaPct).toBe(0)
    expect(distillate.typicalThcPct).toBeGreaterThan(80)
  })

  it('efficiency values are in [0.0, 1.0] range for all types', () => {
    for (const type of CONCENTRATE_TYPES) {
      expect(type.decarbEfficiency.low).toBeGreaterThanOrEqual(0)
      expect(type.decarbEfficiency.low).toBeLessThanOrEqual(1)
      expect(type.decarbEfficiency.expected).toBeGreaterThanOrEqual(0)
      expect(type.decarbEfficiency.expected).toBeLessThanOrEqual(1)
      expect(type.decarbEfficiency.high).toBeGreaterThanOrEqual(0)
      expect(type.decarbEfficiency.high).toBeLessThanOrEqual(1)
      expect(type.decarbEfficiency.low).toBeLessThanOrEqual(
        type.decarbEfficiency.expected
      )
      expect(type.decarbEfficiency.expected).toBeLessThanOrEqual(
        type.decarbEfficiency.high
      )
    }
  })
})
