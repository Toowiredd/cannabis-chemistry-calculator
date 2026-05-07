/**
 * Multi-strain blending engine tests (TDD).
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/blend.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import { calculateBlend, type BlendStrain } from '../blend'

describe('calculateBlend - two strains', () => {
  it('blends two strains to hit target potency (VAL-BLEND-001)', () => {
    // Strain A at 18%, Strain B at 25%
    // Target: 12g total at 20%
    // Math: a + b = 12, 18a + 25b = 240
    // a = 60/7 ≈ 8.571, b = 24/7 ≈ 3.429
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    const result = calculateBlend(strains, 12, 20)
    expect(result.totalWeight).toBe(12)
    expect(result.actualPotency).toBe(20.0)
    expect(result.isAchievable).toBe(true)
    expect(result.results).toHaveLength(2)

    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    expect(a.weightGrams).toBeCloseTo(8.6, 1)
    expect(b.weightGrams).toBeCloseTo(3.4, 1)
    expect(a.weightGrams + b.weightGrams).toBeCloseTo(12, 1)
  })

  it('blends when target matches one strain exactly', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 15 },
      { name: 'B', potency: 25 },
    ]
    // Target exactly at strain A potency
    const resultA = calculateBlend(strains, 10, 15)
    expect(resultA.isAchievable).toBe(true)
    expect(resultA.actualPotency).toBe(15.0)
    const aOnly = resultA.results.find(r => r.name === 'A')!
    expect(aOnly.weightGrams).toBe(10.0)
    const bZero = resultA.results.find(r => r.name === 'B')!
    expect(bZero.weightGrams).toBe(0.0)

    // Target exactly at strain B potency
    const resultB = calculateBlend(strains, 10, 25)
    expect(resultB.isAchievable).toBe(true)
    expect(resultB.actualPotency).toBe(25.0)
    const bOnly = resultB.results.find(r => r.name === 'B')!
    expect(bOnly.weightGrams).toBe(10.0)
    const aZero = resultB.results.find(r => r.name === 'A')!
    expect(aZero.weightGrams).toBe(0.0)
  })

  it('returns equal split when target is midpoint of two strains', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 10 },
      { name: 'B', potency: 30 },
    ]
    const result = calculateBlend(strains, 10, 20)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(20.0)
    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    expect(a.weightGrams).toBe(5.0)
    expect(b.weightGrams).toBe(5.0)
  })
})

describe('calculateBlend - three or more strains (VAL-BLEND-002)', () => {
  it('handles three strains, uses the one matching target exactly', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 15 },
      { name: 'B', potency: 20 },
      { name: 'C', potency: 25 },
    ]
    const result = calculateBlend(strains, 10, 20)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(20.0)
    expect(result.results).toHaveLength(3)
    const b = result.results.find(r => r.name === 'B')!
    expect(b.weightGrams).toBe(10.0)
    const a = result.results.find(r => r.name === 'A')!
    const c = result.results.find(r => r.name === 'C')!
    expect(a.weightGrams).toBe(0.0)
    expect(c.weightGrams).toBe(0.0)
  })

  it('handles three strains, brackets with two adjacent strains', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 15 },
      { name: 'B', potency: 22 },
      { name: 'C', potency: 28 },
    ]
    // Target 24 is between B(22) and C(28)
    const result = calculateBlend(strains, 12, 24)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(24.0)
    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    const c = result.results.find(r => r.name === 'C')!
    expect(a.weightGrams).toBe(0.0)
    expect(b.weightGrams).toBeGreaterThan(0)
    expect(c.weightGrams).toBeGreaterThan(0)
    expect(b.weightGrams + c.weightGrams).toBeCloseTo(12, 1)
  })

  it('handles four strains', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 10 },
      { name: 'B', potency: 18 },
      { name: 'C', potency: 25 },
      { name: 'D', potency: 30 },
    ]
    // Target 20 is between B(18) and C(25)
    const result = calculateBlend(strains, 20, 20)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(20.0)
    const b = result.results.find(r => r.name === 'B')!
    const c = result.results.find(r => r.name === 'C')!
    expect(b.weightGrams).toBeGreaterThan(0)
    expect(c.weightGrams).toBeGreaterThan(0)
    const a = result.results.find(r => r.name === 'A')!
    const d = result.results.find(r => r.name === 'D')!
    expect(a.weightGrams).toBe(0.0)
    expect(d.weightGrams).toBe(0.0)
  })
})

describe('calculateBlend - input validation (VAL-BLEND-003)', () => {
  it('rejects potency below 0%', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: -5 },
      { name: 'B', potency: 20 },
    ]
    expect(() => calculateBlend(strains, 10, 15)).toThrow(ValidationError)
  })

  it('rejects potency above 100%', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 20 },
      { name: 'B', potency: 110 },
    ]
    expect(() => calculateBlend(strains, 10, 15)).toThrow(ValidationError)
  })

  it('rejects negative target weight', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    expect(() => calculateBlend(strains, -5, 20)).toThrow(ValidationError)
  })

  it('rejects zero target weight', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    expect(() => calculateBlend(strains, 0, 20)).toThrow(ValidationError)
  })

  it('rejects negative target potency', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    expect(() => calculateBlend(strains, 10, -5)).toThrow(ValidationError)
  })

  it('rejects target potency above 100%', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    expect(() => calculateBlend(strains, 10, 110)).toThrow(ValidationError)
  })

  it('rejects fewer than 2 strains', () => {
    const strains: BlendStrain[] = [{ name: 'A', potency: 20 }]
    expect(() => calculateBlend(strains, 10, 20)).toThrow(ValidationError)
  })

  it('rejects empty strains array', () => {
    expect(() => calculateBlend([], 10, 20)).toThrow(ValidationError)
  })

  it('marks unachievable when target exceeds max potency', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 15 },
      { name: 'B', potency: 20 },
    ]
    const result = calculateBlend(strains, 10, 25)
    expect(result.isAchievable).toBe(false)
  })

  it('marks unachievable when target is below min potency', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 15 },
      { name: 'B', potency: 20 },
    ]
    const result = calculateBlend(strains, 10, 10)
    expect(result.isAchievable).toBe(false)
  })
})

describe('calculateBlend - precision and edge cases', () => {
  it('rounds weights to max 1 decimal', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    const result = calculateBlend(strains, 12, 20)
    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    // Verify 1-decimal precision by checking the string representation
    expect(a.weightGrams.toFixed(1)).toBe(a.weightGrams.toString())
    expect(b.weightGrams.toFixed(1)).toBe(b.weightGrams.toString())
  })

  it('handles zero potency strain blended with high potency', () => {
    const strains: BlendStrain[] = [
      { name: 'Hemp', potency: 0 },
      { name: 'Strong', potency: 30 },
    ]
    const result = calculateBlend(strains, 10, 15)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(15.0)
    const hemp = result.results.find(r => r.name === 'Hemp')!
    const strong = result.results.find(r => r.name === 'Strong')!
    expect(hemp.weightGrams).toBe(5.0)
    expect(strong.weightGrams).toBe(5.0)
  })

  it('handles all strains at same potency', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 20 },
      { name: 'B', potency: 20 },
    ]
    const result = calculateBlend(strains, 10, 20)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(20.0)
    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    // When potencies are equal, algorithm should pick the first strain
    expect(a.weightGrams).toBe(10.0)
    expect(b.weightGrams).toBe(0.0)
  })

  it('handles target potency of 0%', () => {
    const strains: BlendStrain[] = [
      { name: 'Hemp', potency: 0 },
      { name: 'Low', potency: 10 },
    ]
    const result = calculateBlend(strains, 10, 0)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(0.0)
    const hemp = result.results.find(r => r.name === 'Hemp')!
    expect(hemp.weightGrams).toBe(10.0)
  })

  it('handles target potency of 100%', () => {
    const strains: BlendStrain[] = [
      { name: 'Pure', potency: 100 },
      { name: 'Other', potency: 50 },
    ]
    const result = calculateBlend(strains, 10, 100)
    expect(result.isAchievable).toBe(true)
    expect(result.actualPotency).toBe(100.0)
    const pure = result.results.find(r => r.name === 'Pure')!
    expect(pure.weightGrams).toBe(10.0)
  })

  it('handles large numbers without overflow', () => {
    const strains: BlendStrain[] = [
      { name: 'A', potency: 18 },
      { name: 'B', potency: 25 },
    ]
    const result = calculateBlend(strains, 1000, 20)
    expect(result.isAchievable).toBe(true)
    expect(result.totalWeight).toBe(1000.0)
    const a = result.results.find(r => r.name === 'A')!
    const b = result.results.find(r => r.name === 'B')!
    expect(a.weightGrams + b.weightGrams).toBeCloseTo(1000, 1)
  })

  it('preserves strain order in results', () => {
    const strains: BlendStrain[] = [
      { name: 'First', potency: 15 },
      { name: 'Second', potency: 25 },
    ]
    const result = calculateBlend(strains, 10, 20)
    expect(result.results[0].name).toBe('First')
    expect(result.results[1].name).toBe('Second')
  })
})
