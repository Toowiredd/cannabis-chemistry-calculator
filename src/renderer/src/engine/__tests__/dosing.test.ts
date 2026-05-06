/**
 * Dosing engine tests (TDD — RED state target).
 * After writing these tests, run `pnpm exec vitest run src/renderer/src/engine/__tests__/dosing.test.ts`
 * and confirm they FAIL because dosing.ts does not exist yet.
 */
import { describe, expect, it } from 'vitest'
import { calculateMgPerServing, classifyDose } from '../dosing'
import { ValidationError } from '../errors'

describe('calculateMgPerServing', () => {
  it('100 mg / 4 servings = 25.0 mg per serving (feature spec)', () => {
    expect(calculateMgPerServing(100, 4)).toBe(25.0)
  })

  it('rounds to max 1 decimal', () => {
    // 100 / 3 = 33.333... → 33.3
    expect(calculateMgPerServing(100, 3)).toBe(33.3)
  })

  it('returns 0.0 when finalThcMg is 0', () => {
    expect(calculateMgPerServing(0, 5)).toBe(0.0)
  })

  it('handles large inputs without overflow', () => {
    expect(calculateMgPerServing(100000, 10)).toBe(10000.0)
  })

  it('throws ValidationError when servings is zero', () => {
    expect(() => calculateMgPerServing(50, 0)).toThrow(ValidationError)
  })

  it('throws ValidationError when servings is negative', () => {
    expect(() => calculateMgPerServing(50, -2)).toThrow(ValidationError)
  })

  it('throws ValidationError when finalThcMg is negative', () => {
    expect(() => calculateMgPerServing(-10, 2)).toThrow(ValidationError)
  })
})

describe('classifyDose', () => {
  it('classifies 4.0 mg as microdose (feature spec)', () => {
    expect(classifyDose(4.0)).toBe('microdose')
  })

  it('classifies 8.0 mg as low (feature spec)', () => {
    expect(classifyDose(8.0)).toBe('low')
  })

  it('classifies 16.0 mg as moderate (feature spec)', () => {
    expect(classifyDose(16.0)).toBe('moderate')
  })

  it('classifies 32.0 mg as strong (feature spec)', () => {
    expect(classifyDose(32.0)).toBe('strong')
  })

  it('classifies 60.0 mg as very strong (feature spec)', () => {
    expect(classifyDose(60.0)).toBe('very strong')
  })

  it('classifies 120.0 mg as extreme (feature spec)', () => {
    expect(classifyDose(120.0)).toBe('extreme')
  })

  // Boundary tests: inclusive floor, exclusive ceiling
  it('exactly 2.5 mg → microdose (inclusive floor)', () => {
    expect(classifyDose(2.5)).toBe('microdose')
  })

  it('exactly 5.0 mg → low (inclusive floor)', () => {
    expect(classifyDose(5.0)).toBe('low')
  })

  it('exactly 10.0 mg → moderate', () => {
    expect(classifyDose(10.0)).toBe('moderate')
  })

  it('exactly 25.0 mg → strong', () => {
    expect(classifyDose(25.0)).toBe('strong')
  })

  it('exactly 50.0 mg → very strong', () => {
    expect(classifyDose(50.0)).toBe('very strong')
  })

  it('exactly 100.0 mg → extreme', () => {
    expect(classifyDose(100.0)).toBe('extreme')
  })

  // Ceiling boundary: just below each threshold
  it('just below 5.0 mg (4.99) → microdose', () => {
    expect(classifyDose(4.99)).toBe('microdose')
  })

  it('just below 10.0 mg (9.99) → low', () => {
    expect(classifyDose(9.99)).toBe('low')
  })

  it('just below 25.0 mg (24.99) → moderate', () => {
    expect(classifyDose(24.99)).toBe('moderate')
  })

  it('just below 50.0 mg (49.99) → strong', () => {
    expect(classifyDose(49.99)).toBe('strong')
  })

  it('just below 100.0 mg (99.99) → very strong', () => {
    expect(classifyDose(99.99)).toBe('very strong')
  })

  // Sub-microdose
  it('below 2.5 mg → sub-microdose', () => {
    expect(classifyDose(2.49)).toBe('sub-microdose')
  })

  it('0.0 mg → sub-microdose', () => {
    expect(classifyDose(0.0)).toBe('sub-microdose')
  })

  it('throws ValidationError for negative mgPerServing', () => {
    expect(() => classifyDose(-1)).toThrow(ValidationError)
  })
})
