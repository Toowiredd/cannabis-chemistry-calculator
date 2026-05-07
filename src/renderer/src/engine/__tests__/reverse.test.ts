/**
 * Reverse / inverse calculator engine tests.
 * TDD: RED → GREEN for batch1-reverse-calc.
 */
import { describe, expect, it } from 'vitest'
import { reverseDecarb, reverseFullWorkflow } from '../reverse'
import { ValidationError } from '../errors'

describe('reverseDecarb', () => {
  it('calculates required material for 500mg decarbed at 0.96 eff, 20% THCA → ~2.97g', () => {
    const grams = reverseDecarb({
      desiredDecarbedThcMg: 500,
      thcaPct: 20,
      thcPct: 0,
      decarbEfficiency: 0.96,
    })
    expect(grams).toBe(2.97)
  })

  it('calculates required material with existing THC contribution', () => {
    // 15% THCA + 2% THC material
    const grams = reverseDecarb({
      desiredDecarbedThcMg: 757.8,
      thcaPct: 15,
      thcPct: 2,
      decarbEfficiency: 1.0,
    })
    // Forward check: 5g * ((15/100)*0.877 + 2/100) * 1000 = 757.75 ≈ 757.8
    expect(grams).toBe(5.0)
  })

  it('returns zero when desired decarbed THC is zero', () => {
    const grams = reverseDecarb({
      desiredDecarbedThcMg: 0,
      thcaPct: 20,
      thcPct: 0,
      decarbEfficiency: 0.96,
    })
    expect(grams).toBe(0)
  })

  it('rejects negative desired decarbed THC', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: -100,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative decarb efficiency', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: -0.1,
      })
    ).toThrow(ValidationError)
  })

  it('rejects decarb efficiency above 1.0', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 1.1,
      })
    ).toThrow(ValidationError)
  })

  it('rejects zero decarb efficiency with positive desired output', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0,
      })
    ).toThrow(ValidationError)
  })

  it('rejects zero total potency with positive desired output', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 0,
        thcPct: 0,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative THCA', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: -5,
        thcPct: 0,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative THC', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 20,
        thcPct: -1,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rejects THCA above 100%', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 110,
        thcPct: 0,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rejects THCA + THC above 100%', () => {
    expect(() =>
      reverseDecarb({
        desiredDecarbedThcMg: 500,
        thcaPct: 60,
        thcPct: 50,
        decarbEfficiency: 0.96,
      })
    ).toThrow(ValidationError)
  })

  it('rounds grams to 2 decimal places', () => {
    const grams = reverseDecarb({
      desiredDecarbedThcMg: 100,
      thcaPct: 18,
      thcPct: 0,
      decarbEfficiency: 0.85,
    })
    // theoreticalMax = 100 / 0.85 = 117.647
    // grams = 117.647 / (0.18 * 0.877 * 1000) = 117.647 / 157.86 = 0.7453... ≈ 0.75
    expect(grams).toBe(0.75)
  })

  it('handles very large desired output', () => {
    const grams = reverseDecarb({
      desiredDecarbedThcMg: 100000,
      thcaPct: 25,
      thcPct: 0,
      decarbEfficiency: 0.95,
    })
    expect(grams).toBeGreaterThan(0)
    expect(Number.isFinite(grams)).toBe(true)
  })
})

describe('reverseFullWorkflow', () => {
  it('calculates material for 10mg/serving × 24 servings, 0.82 extraction, 0.96 decarb, 20% THCA → ~1.74g', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 10,
      servings: 24,
      thcaPct: 20,
      thcPct: 0,
      decarbEfficiency: 0.96,
      extractionEfficiency: 0.82,
    })
    expect(grams).toBe(1.74)
  })

  it('calculates material for 5mg/serving × 10 servings, MCT oil, sv_dry → correct grams', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 5,
      servings: 10,
      thcaPct: 18,
      thcPct: 2,
      decarbEfficiency: 0.97,
      extractionEfficiency: 0.92,
    })
    // final = 50mg
    // decarbed = 50 / 0.92 = 54.35
    // theoretical = 54.35 / 0.97 = 56.03
    // grams = 56.03 / ((0.18*0.877 + 0.02)*1000) = 56.03 / 177.86 = 0.315... ≈ 0.32
    expect(grams).toBe(0.32)
  })

  it('returns zero when desired mg per serving is zero', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 0,
      servings: 24,
      thcaPct: 20,
      thcPct: 0,
      decarbEfficiency: 0.96,
      extractionEfficiency: 0.82,
    })
    expect(grams).toBe(0)
  })

  it('returns zero when servings is zero', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 10,
      servings: 0,
      thcaPct: 20,
      thcPct: 0,
      decarbEfficiency: 0.96,
      extractionEfficiency: 0.82,
    })
    expect(grams).toBe(0)
  })

  it('rejects negative desired mg per serving', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: -10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative servings', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: -1,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rejects zero decarb efficiency with positive desired output', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rejects zero extraction efficiency with positive desired output', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: 0,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative decarb efficiency', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: -0.1,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rejects negative extraction efficiency', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: -0.1,
      })
    ).toThrow(ValidationError)
  })

  it('rejects decarb efficiency above 1.0', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 1.1,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rejects extraction efficiency above 1.0', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 20,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: 1.1,
      })
    ).toThrow(ValidationError)
  })

  it('rejects zero total potency with positive desired output', () => {
    expect(() =>
      reverseFullWorkflow({
        desiredMgPerServing: 10,
        servings: 24,
        thcaPct: 0,
        thcPct: 0,
        decarbEfficiency: 0.96,
        extractionEfficiency: 0.82,
      })
    ).toThrow(ValidationError)
  })

  it('rounds grams to 2 decimal places', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 2.5,
      servings: 10,
      thcaPct: 15,
      thcPct: 0,
      decarbEfficiency: 0.9,
      extractionEfficiency: 0.85,
    })
    // final = 25mg
    // decarbed = 25 / 0.85 = 29.41
    // theoretical = 29.41 / 0.9 = 32.68
    // grams = 32.68 / (0.15 * 0.877 * 1000) = 32.68 / 131.55 = 0.2484... ≈ 0.25
    expect(grams).toBe(0.25)
  })

  it('handles very large desired output', () => {
    const grams = reverseFullWorkflow({
      desiredMgPerServing: 100,
      servings: 100,
      thcaPct: 25,
      thcPct: 0,
      decarbEfficiency: 0.95,
      extractionEfficiency: 0.92,
    })
    expect(grams).toBeGreaterThan(0)
    expect(Number.isFinite(grams)).toBe(true)
  })
})
