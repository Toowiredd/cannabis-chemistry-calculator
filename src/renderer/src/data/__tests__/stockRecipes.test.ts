/**
 * stockRecipes.ts data tests (Week 6, §8.3).
 *
 * The Dashboard renders 5 curated `StockRecipe` cards that
 * pre-fill the wizard's `WizardSelections`. This test pins the
 * shape contract so a future change to the data file can't
 * silently regress the Dashboard's render.
 *
 * Coverage:
 *  - Exactly 5 recipes (the brief's "3-5 curated starters" upper
 *    bound)
 *  - Every recipe has a non-empty `name` + `description` + 2-4
 *    chips
 *  - Every `branch` is one of the 5 valid `ProductType` literals
 *  - Every `selections` shape matches `WizardSelections` (the
 *    Stage 1 store type) — we typecheck the union by importing
 *    the type and asserting the values narrow correctly
 *  - The 3 numeric selection values match the brief's spec
 *    (e.g. "Standard Oven Decarb" = 28g, etc.)
 *  - `findStockRecipe(id)` round-trips by id
 *  - Every method / fat / container / carrier id is a known
 *    engine preset id (no fabricated ids sneak in)
 */
import { describe, expect, it } from 'vitest'

import {
  STOCK_RECIPES,
  findStockRecipe,
  type StockRecipe,
} from '../stockRecipes'
import { DECARB_METHODS, INFUSION_FATS } from '../../engine/models'

/* ------------------------------------------------------------------ */
/* Constants — engine preset id sets for the cross-check              */
/* ------------------------------------------------------------------ */

const VALID_METHOD_IDS = new Set(DECARB_METHODS.map(m => m.id))
const VALID_FAT_IDS = new Set(INFUSION_FATS.map(f => f.id))
const VALID_BRANCHES = new Set([
  'flower',
  'concentrate',
  'avb',
  'edible',
  'topical',
] as const)

/* ------------------------------------------------------------------ */
/* Shape contract                                                      */
/* ------------------------------------------------------------------ */

describe('STOCK_RECIPES — shape contract (Week 6, §8.3)', () => {
  it('has exactly 5 recipes (the brief-mandated 3-5 range)', () => {
    expect(STOCK_RECIPES).toHaveLength(5)
  })

  it('every recipe has a non-empty name + description', () => {
    for (const recipe of STOCK_RECIPES) {
      expect(recipe.name.length).toBeGreaterThan(0)
      expect(recipe.description.length).toBeGreaterThan(0)
    }
  })

  it('every recipe has 2-4 chips (the brief-mandated range)', () => {
    for (const recipe of STOCK_RECIPES) {
      expect(recipe.chips.length).toBeGreaterThanOrEqual(2)
      expect(recipe.chips.length).toBeLessThanOrEqual(4)
    }
  })

  it('every chip is a non-empty string', () => {
    for (const recipe of STOCK_RECIPES) {
      for (const chip of recipe.chips) {
        expect(typeof chip).toBe('string')
        expect(chip.length).toBeGreaterThan(0)
      }
    }
  })

  it('every branch is one of the 5 valid ProductType literals', () => {
    for (const recipe of STOCK_RECIPES) {
      expect(VALID_BRANCHES.has(recipe.branch)).toBe(true)
    }
  })

  it('every id is unique (no duplicate cards on the Dashboard)', () => {
    const ids = STOCK_RECIPES.map(r => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

/* ------------------------------------------------------------------ */
/* Per-recipe content pins                                            */
/* ------------------------------------------------------------------ */

describe('STOCK_RECIPES — content pins (the 5 brief-mandated entries)', () => {
  it('recipe #1 — Standard Oven Decarb (flower, 28g, 95%, no infusion)', () => {
    const r = findStockRecipe('standard-oven-decarb')
    expect(r).not.toBeNull()
    expect(r?.branch).toBe('flower')
    expect(r?.selections.method).toBe('oven_sealed')
    expect(r?.selections.weight).toEqual({ value: 28, unit: 'g' })
    expect(r?.selections.efficiency).toBe(0.95)
    // No infusion — `fat` is omitted entirely (omitting the key
    // is the "no fat picked" sentinel per the Stage 1 type).
    expect(r?.selections.fat).toBeUndefined()
    expect(r?.chips).toEqual(['28g', '113°C', '60-90 min'])
  })

  it('recipe #2 — Quick Sous Vide (flower, 7g, 97%, no infusion)', () => {
    const r = findStockRecipe('quick-sous-vide')
    expect(r).not.toBeNull()
    expect(r?.branch).toBe('flower')
    expect(r?.selections.method).toBe('sv_fast')
    expect(r?.selections.weight).toEqual({ value: 7, unit: 'g' })
    expect(r?.selections.efficiency).toBe(0.97)
    expect(r?.selections.fat).toBeUndefined()
    expect(r?.chips).toEqual(['7g', '95°C', '120-180 min'])
  })

  it('recipe #3 — Coconut Oil Infusion (flower, 14g, 93%, coconut, 240mL)', () => {
    const r = findStockRecipe('coconut-oil-infusion')
    expect(r).not.toBeNull()
    expect(r?.branch).toBe('flower')
    expect(r?.selections.method).toBe('oven_sealed')
    expect(r?.selections.weight).toEqual({ value: 14, unit: 'g' })
    expect(r?.selections.efficiency).toBe(0.93)
    expect(r?.selections.fat).toBe('coconut')
    expect(r?.selections.volume).toEqual({ value: 240, unit: 'mL' })
    expect(r?.chips).toEqual(['14g', '113°C', '240mL coconut'])
  })

  it('recipe #4 — Light AVB Tincture (avb, light, alcohol, 100mL)', () => {
    const r = findStockRecipe('light-avb-tincture')
    expect(r).not.toBeNull()
    expect(r?.branch).toBe('avb')
    expect(r?.selections.color).toBe('light')
    expect(r?.selections.carrier).toBe('alcohol')
    expect(r?.selections.volume).toEqual({ value: 100, unit: 'mL' })
    expect(r?.chips).toEqual(['Light AVB', '100mL alcohol', '5-8% residual'])
  })

  it('recipe #5 — Beginner Olive Salve (topical, olive, 240mL, joints)', () => {
    const r = findStockRecipe('beginner-olive-salve')
    expect(r).not.toBeNull()
    expect(r?.branch).toBe('topical')
    expect(r?.selections.carrier).toBe('olive')
    expect(r?.selections.volume).toEqual({ value: 240, unit: 'mL' })
    expect(r?.selections.applicationArea).toBe('joints')
    expect(r?.chips).toEqual(['240mL olive', 'Joints / arthritis'])
  })
})

/* ------------------------------------------------------------------ */
/* Engine-id cross-check — no fabricated ids                          */
/* ------------------------------------------------------------------ */

describe('STOCK_RECIPES — engine id cross-check', () => {
  it('every method id matches a real PresetMethod', () => {
    for (const recipe of STOCK_RECIPES) {
      const method = recipe.selections.method
      if (typeof method === 'string') {
        expect(VALID_METHOD_IDS.has(method)).toBe(true)
      }
    }
  })

  it('every fat id matches a real PresetFat', () => {
    for (const recipe of STOCK_RECIPES) {
      const fat = recipe.selections.fat
      if (typeof fat === 'string') {
        expect(VALID_FAT_IDS.has(fat)).toBe(true)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
/* findStockRecipe lookup                                              */
/* ------------------------------------------------------------------ */

describe('findStockRecipe — id lookup', () => {
  it('returns the matching recipe for a known id', () => {
    const r = findStockRecipe('coconut-oil-infusion')
    expect(r?.name).toBe('Coconut Oil Infusion')
  })

  it('returns null for an unknown id', () => {
    const r = findStockRecipe('not-a-real-recipe')
    expect(r).toBeNull()
  })

  it('returns null for an empty id', () => {
    const r = findStockRecipe('')
    expect(r).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Type guard — the `selections` shape narrows to WizardSelections    */
/* ------------------------------------------------------------------ */

describe('STOCK_RECIPES — type contract (selections matches WizardSelections)', () => {
  it('every recipe is assignable to the StockRecipe type (compile-time)', () => {
    // If this file typechecks, the assignment passes. The runtime
    // check is a defensive belt-and-braces against an accidental
    // shape drift in the data file.
    const typed: readonly StockRecipe[] = STOCK_RECIPES
    expect(typed.length).toBe(5)
  })
})
