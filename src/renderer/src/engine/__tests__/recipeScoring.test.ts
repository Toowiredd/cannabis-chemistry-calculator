import { describe, expect, it } from 'vitest'
import {
  RECIPES,
  scoreRecipe,
  scoreAllRecipes,
  compareRecipes,
  formatName,
} from '../recipeScoring'

describe('scoreRecipe', () => {
  it('returns score > 0 for viable dose within ideal range', () => {
    const r = RECIPES.find(recipe => recipe.id === 'brownies')!
    const scored = scoreRecipe(15, 'ghee', r)
    expect(scored.isViable).toBe(true)
    expect(scored.score).toBeGreaterThan(0)
  })

  it('returns score 0 for zero or negative dose', () => {
    const r = RECIPES[0]
    expect(scoreRecipe(0, 'ghee', r).isViable).toBe(false)
    expect(scoreRecipe(-5, 'ghee', r).isViable).toBe(false)
  })

  it('rejects dose above max threshold', () => {
    const r = RECIPES[0]
    expect(scoreRecipe(55, 'ghee', r).isViable).toBe(false)
    expect(scoreRecipe(200, 'ghee', r).isViable).toBe(false)
  })

  it('awards full fat match bonus for exact fat', () => {
    const brownies = RECIPES.find(r => r.id === 'brownies')!
    const withGhee = scoreRecipe(15, 'ghee', brownies)
    const withCoconut = scoreRecipe(15, 'coconut', brownies)
    expect(withGhee.score).toBeGreaterThan(withCoconut.score)
    expect(withGhee.fatMatch).toBe(true)
    expect(withCoconut.fatMatch).toBe(false)
  })

  it('gives partial weight for custom fat', () => {
    const brownies = RECIPES.find(r => r.id === 'brownies')!
    const custom = scoreRecipe(15, 'custom', brownies)
    const mismatch = scoreRecipe(15, 'mct', brownies)
    expect(custom.score).toBeGreaterThanOrEqual(mismatch.score)
    expect(custom.fatMatch).toBe(false)
  })

  it('gives any-fat weight for recipes without recommended fat', () => {
    const gummies = RECIPES.find(r => r.id === 'gummies')!
    const withGhee = scoreRecipe(10, 'ghee', gummies)
    const withCustom = scoreRecipe(10, 'custom', gummies)
    expect(withGhee.fatMatch).toBe(true)
    expect(withCustom.fatMatch).toBe(true)
    // Both should have non-0 fat bonus since gummies has no recommendedFat
    expect(withGhee.score).toBeGreaterThan(0)
    expect(withCustom.score).toBeGreaterThan(0)
  })

  it('scores highest when mgPerServing is exactly at ideal center', () => {
    const brownies = RECIPES.find(r => r.id === 'brownies')!
    const center = (brownies.idealMin + brownies.idealMax) / 2
    const ideal = scoreRecipe(center, 'ghee', brownies)
    const low = scoreRecipe(brownies.idealMin - 2, 'ghee', brownies)
    expect(ideal.score).toBeGreaterThan(low.score)
  })

  it('caps mgScore at 0 for very high doses inside threshold', () => {
    const capsules = RECIPES.find(r => r.id === 'capsules')!
    // 20 mg is exactly at max threshold, still viable
    const scored = scoreRecipe(20, 'mct', capsules)
    expect(scored.isViable).toBe(true)
    expect(scored.score).toBeGreaterThanOrEqual(0)
  })

  it('returns NaN-tolerant results', () => {
    const brownies = RECIPES.find(r => r.id === 'brownies')!
    expect(scoreRecipe(NaN, 'ghee', brownies).isViable).toBe(false)
    expect(scoreRecipe(Infinity, 'ghee', brownies).isViable).toBe(false)
  })
})

describe('compareRecipes', () => {
  it('sorts by descending score', () => {
    const a = scoreRecipe(10, 'ghee', RECIPES[0]!)
    const b = scoreRecipe(10, 'coconut', RECIPES[0]!)
    // a should have higher fat match score
    expect(compareRecipes(a, b)).toBeLessThan(0)
  })

  it('tie-breaks fatMatch over fatMismatch', () => {
    const recipeA = {
      ...RECIPES[0]!,
      score: 80,
      fatMatch: true,
      isViable: true,
    }
    const recipeB = {
      ...RECIPES[0]!,
      score: 80,
      fatMatch: false,
      isViable: true,
    }
    expect(compareRecipes(recipeA, recipeB)).toBe(-1)
    expect(compareRecipes(recipeB, recipeA)).toBe(1)
  })

  it('stable sort when all fields equal', () => {
    const a = { ...RECIPES[0]!, score: 70, fatMatch: false, isViable: true }
    const b = { ...RECIPES[0]!, score: 70, fatMatch: false, isViable: true }
    expect(compareRecipes(a, b)).toBe(0)
  })
})

describe('scoreAllRecipes', () => {
  it('returns all 4 recipes for a moderate dose', () => {
    const results = scoreAllRecipes(10, 'ghee')
    expect(results.length).toBe(4)
    expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score)
  })

  it('returns empty array when dose exceeds all thresholds', () => {
    const results = scoreAllRecipes(200, 'ghee')
    expect(results.length).toBe(0)
  })

  it('returns only viable recipes for high but not extreme dose', () => {
    // 45 mg: viable for brownies (max 50), not for others
    const results = scoreAllRecipes(45, 'mct')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('brownies')
  })

  it('orders brownies first for 15 mg + ghee (classic match)', () => {
    const results = scoreAllRecipes(15, 'ghee')
    expect(results[0]!.id).toBe('brownies')
    expect(results[0]!.fatMatch).toBe(true)
  })

  it('still returns viable recipes when fat is custom', () => {
    const results = scoreAllRecipes(8, 'custom')
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('formatName', () => {
  it('finds known format id', () => {
    expect(formatName('brownie_9x13')).toContain('Brownie')
  })

  it('returns raw id for unknown', () => {
    expect(formatName('unknown-id')).toBe('unknown-id')
  })
})
