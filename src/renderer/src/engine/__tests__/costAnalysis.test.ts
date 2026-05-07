/**
 * Cost-per-dose engine tests (TDD).
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/costAnalysis.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  calculateCostPerDose,
  calculateCostPerMg,
  compareMethodCosts,
} from '../costAnalysis'

describe('calculateCostPerDose', () => {
  it('calculates cost per dose (VAL-COST-001)', () => {
    // $80 / 140 servings = $0.57
    expect(calculateCostPerDose(80, 140)).toBe(0.57)
  })

  it('returns 0.00 when material cost is 0', () => {
    expect(calculateCostPerDose(0, 10)).toBe(0.0)
  })

  it('throws ValidationError when servings is zero', () => {
    expect(() => calculateCostPerDose(80, 0)).toThrow(ValidationError)
    expect(() => calculateCostPerDose(80, 0)).toThrow(
      'servings must be greater than 0'
    )
  })

  it('throws ValidationError when servings is negative', () => {
    expect(() => calculateCostPerDose(80, -5)).toThrow(ValidationError)
  })

  it('throws ValidationError when materialCost is negative', () => {
    expect(() => calculateCostPerDose(-10, 5)).toThrow(ValidationError)
    expect(() => calculateCostPerDose(-10, 5)).toThrow(
      'materialCost cannot be negative'
    )
  })

  it('rounds to 2 decimal places', () => {
    // 100 / 3 = 33.333... → 33.33
    expect(calculateCostPerDose(100, 3)).toBe(33.33)
  })
})

describe('calculateCostPerMg', () => {
  it('calculates cost per mg (VAL-COST-001)', () => {
    // $80 / 1400 mg = $0.057
    expect(calculateCostPerMg(80, 1400)).toBe(0.057)
  })

  it('returns 0.000 when material cost is 0', () => {
    expect(calculateCostPerMg(0, 100)).toBe(0.0)
  })

  it('throws ValidationError when totalThcMg is zero', () => {
    expect(() => calculateCostPerMg(80, 0)).toThrow(ValidationError)
    expect(() => calculateCostPerMg(80, 0)).toThrow(
      'totalThcMg must be greater than 0'
    )
  })

  it('throws ValidationError when totalThcMg is negative', () => {
    expect(() => calculateCostPerMg(80, -100)).toThrow(ValidationError)
  })

  it('throws ValidationError when materialCost is negative', () => {
    expect(() => calculateCostPerMg(-10, 100)).toThrow(ValidationError)
  })

  it('rounds to 3 decimal places', () => {
    // 100 / 7 = 14.2857... → 14.286
    expect(calculateCostPerMg(100, 7)).toBe(14.286)
  })
})

describe('compareMethodCosts — efficiency validation', () => {
  it('throws ValidationError when a method efficiency is below 0', () => {
    const methods = [{ id: 'bad', name: 'Bad Method', efficiency: -0.1 }]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)).toThrow(
      ValidationError
    )
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)).toThrow(
      'method efficiency must be in [0.0, 1.0]'
    )
  })

  it('throws ValidationError when a method efficiency is above 1.0', () => {
    const methods = [{ id: 'bad', name: 'Bad Method', efficiency: 1.05 }]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)).toThrow(
      ValidationError
    )
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)).toThrow(
      'method efficiency must be in [0.0, 1.0]'
    )
  })

  it('throws ValidationError when any method in array has invalid efficiency', () => {
    const methods = [
      { id: 'good', name: 'Good Method', efficiency: 0.96 },
      { id: 'bad', name: 'Bad Method', efficiency: 1.2 },
    ]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)).toThrow(
      ValidationError
    )
  })

  it('accepts efficiency exactly 0.0', () => {
    const methods = [{ id: 'zero', name: 'Zero Efficiency', efficiency: 0.0 }]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)
    expect(result).toHaveLength(1)
    expect(result[0].zeroYield).toBe(true)
  })

  it('accepts efficiency exactly 1.0', () => {
    const methods = [{ id: 'full', name: 'Full Efficiency', efficiency: 1.0 }]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)
    expect(result).toHaveLength(1)
    expect(result[0].decarbEfficiency).toBe(1.0)
  })
})

describe('compareMethodCosts — zero yield', () => {
  it('returns zeroYield=true with 0 costs when grams is 0', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    const result = compareMethodCosts(80, 0, 20, 0, methods, 0.82, 10)
    expect(result[0].totalThcMg).toBe(0)
    expect(result[0].servings).toBe(0)
    expect(result[0].costPerDose).toBe(0)
    expect(result[0].costPerMg).toBe(0)
    expect(result[0].zeroYield).toBe(true)
  })

  it('returns zeroYield=true with 0 costs when extractionEff is 0', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.0, 10)
    expect(result[0].totalThcMg).toBe(0)
    expect(result[0].servings).toBe(0)
    expect(result[0].costPerDose).toBe(0)
    expect(result[0].costPerMg).toBe(0)
    expect(result[0].zeroYield).toBe(true)
  })

  it('returns zeroYield=true with 0 costs when method efficiency is 0', () => {
    const methods = [
      { id: 'zero_eff', name: 'Zero Efficiency', efficiency: 0.0 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)
    expect(result[0].totalThcMg).toBe(0)
    expect(result[0].servings).toBe(0)
    expect(result[0].costPerDose).toBe(0)
    expect(result[0].costPerMg).toBe(0)
    expect(result[0].zeroYield).toBe(true)
  })

  it('returns zeroYield=true with 0 costs when THCA and THC are both 0', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    const result = compareMethodCosts(80, 10, 0, 0, methods, 0.82, 10)
    expect(result[0].totalThcMg).toBe(0)
    expect(result[0].servings).toBe(0)
    expect(result[0].costPerDose).toBe(0)
    expect(result[0].costPerMg).toBe(0)
    expect(result[0].zeroYield).toBe(true)
  })

  it('returns zeroYield=false for normal non-zero yield', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)
    expect(result[0].zeroYield).toBe(false)
    expect(result[0].costPerDose).toBeGreaterThan(0)
    expect(result[0].costPerMg).toBeGreaterThan(0)
  })
})

describe('compareMethodCosts', () => {
  it('compares sv_dry vs oven_open (VAL-COST-002)', () => {
    // 10g, 20% THCA, 0% THC → theoretical max = 1754.0 mg
    // sv_dry eff 0.96 → decarbed = 1683.8 mg → infused 0.82 = 1380.7 mg
    // oven_open eff 0.91 → decarbed = 1596.1 mg → infused 0.82 = 1308.8 mg
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
      { id: 'oven_open', name: 'Oven -- Open Air', efficiency: 0.91 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)

    expect(result).toHaveLength(2)

    const svDry = result.find(r => r.methodId === 'sv_dry')
    const ovenOpen = result.find(r => r.methodId === 'oven_open')

    expect(svDry).toBeDefined()
    expect(ovenOpen).toBeDefined()

    if (svDry && ovenOpen) {
      // sv_dry should have lower cost per mg (more efficient)
      expect(svDry.costPerMg).toBeLessThan(ovenOpen.costPerMg)
      expect(svDry.costPerDose).toBeLessThan(ovenOpen.costPerDose)

      // sv_dry should have more servings
      expect(svDry.servings).toBeGreaterThan(ovenOpen.servings)

      // sv_dry should have more total THC
      expect(svDry.totalThcMg).toBeGreaterThan(ovenOpen.totalThcMg)
    }
  })

  it('returns empty array when methods array is empty', () => {
    const result = compareMethodCosts(80, 10, 20, 0, [], 0.82, 10)
    expect(result).toHaveLength(0)
  })

  it('throws ValidationError for negative materialCost', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    expect(() => compareMethodCosts(-10, 10, 20, 0, methods, 0.82, 10)).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError for negative grams', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    expect(() => compareMethodCosts(80, -10, 20, 0, methods, 0.82, 10)).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError for negative targetDose', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, -10)).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError for extractionEff above 1.0', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 1.5, 10)).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError for zero targetDose', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    expect(() => compareMethodCosts(80, 10, 20, 0, methods, 0.82, 0)).toThrow(
      ValidationError
    )
  })

  it('sv_dry produces exact expected values', () => {
    const methods = [
      { id: 'sv_dry', name: 'Sous Vide -- Dry', efficiency: 0.96 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)

    const svDry = result[0]
    expect(svDry.totalThcMg).toBe(1380.7)
    expect(svDry.servings).toBe(138.1)
    expect(svDry.costPerMg).toBe(0.058)
    expect(svDry.costPerDose).toBe(0.58)
  })

  it('oven_open produces exact expected values', () => {
    const methods = [
      { id: 'oven_open', name: 'Oven -- Open Air', efficiency: 0.91 },
    ]
    const result = compareMethodCosts(80, 10, 20, 0, methods, 0.82, 10)

    const ovenOpen = result[0]
    expect(ovenOpen.totalThcMg).toBe(1308.8)
    expect(ovenOpen.servings).toBe(130.9)
    expect(ovenOpen.costPerMg).toBe(0.061)
    expect(ovenOpen.costPerDose).toBe(0.61)
  })
})
