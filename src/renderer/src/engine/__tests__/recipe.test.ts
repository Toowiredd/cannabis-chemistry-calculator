/**
 * Failing tests (RED) for recipe engine.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/recipe.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  saveRecipe,
  loadRecipe,
  scaleRecipe,
  type RecipeUnits,
  type RecipeDecarb,
  type RecipeInfusion,
  type RecipeDose,
} from '../recipe'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeUnitPreferences(): RecipeUnits {
  return {
    tempUnit: 'C',
    weightUnit: 'g',
    volumeUnit: 'mL',
    bagUnit: 'cm',
  }
}

function makeDecarbState(partial?: Partial<RecipeDecarb>): RecipeDecarb {
  return {
    weight: '7',
    thcaPct: '20',
    thcPct: '2',
    cbdaPct: '0',
    cbdPct: '0',
    presetId: 'sv_dry',
    tempOverride: null,
    timeOverride: null,
    effLowOverride: null,
    effExpectedOverride: null,
    effHighOverride: null,
    bagExpanded: true,
    bagGrindId: 'medium',
    bagPresetId: 'quart',
    bagWidthOverride: null,
    bagLengthOverride: null,
    bagHasStems: false,
    ...partial,
  }
}

function makeInfusionState(partial?: Partial<RecipeInfusion>): RecipeInfusion {
  return {
    decarbedThc: '1500',
    volume: '200',
    fatId: 'coconut',
    customEfficiency: '0.82',
    ...partial,
  }
}

function makeDoseState(partial?: Partial<RecipeDose>): RecipeDose {
  return {
    totalThc: '1230',
    servings: '24',
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// saveRecipe
// ---------------------------------------------------------------------------

describe('saveRecipe', () => {
  it('captures full calculator state (VAL-RECIPE-001)', () => {
    const units = makeUnitPreferences()
    const decarb = makeDecarbState()
    const infusion = makeInfusionState()
    const dose = makeDoseState()

    const recipe = saveRecipe('Test Recipe', units, decarb, infusion, dose)

    expect(recipe.name).toBe('Test Recipe')
    expect(recipe.version).toBe('1.0.0')
    expect(recipe.units).toEqual(units)
    expect(recipe.decarb).toEqual(decarb)
    expect(recipe.infusion).toEqual(infusion)
    expect(recipe.dose).toEqual(dose)
    expect(new Date(recipe.createdAt).getTime()).not.toBeNaN()
  })

  it('creates a timestamp', () => {
    const before = Date.now()
    const recipe = saveRecipe(
      'Timed',
      makeUnitPreferences(),
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    const after = Date.now()

    const ts = new Date(recipe.createdAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

// ---------------------------------------------------------------------------
// loadRecipe
// ---------------------------------------------------------------------------

describe('loadRecipe', () => {
  it('restores all tabs from a valid recipe (VAL-RECIPE-002)', () => {
    const units = makeUnitPreferences()
    const decarb = makeDecarbState({ weight: '10.5', presetId: 'oven_sealed' })
    const infusion = makeInfusionState({ fatId: 'mct', volume: '150' })
    const dose = makeDoseState({ servings: '12' })

    const recipe = saveRecipe('Load Test', units, decarb, infusion, dose)
    const loaded = loadRecipe(recipe)

    expect(loaded.units).toEqual(units)
    expect(loaded.decarb.weight).toBe('10.5')
    expect(loaded.decarb.presetId).toBe('oven_sealed')
    expect(loaded.infusion.fatId).toBe('mct')
    expect(loaded.infusion.volume).toBe('150')
    expect(loaded.dose.servings).toBe('12')
  })

  it('restores unit preferences', () => {
    const units: RecipeUnits = {
      tempUnit: 'F',
      weightUnit: 'oz',
      volumeUnit: 'cup',
      bagUnit: 'in',
    }
    const recipe = saveRecipe(
      'Units Test',
      units,
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    const loaded = loadRecipe(recipe)

    expect(loaded.units.tempUnit).toBe('F')
    expect(loaded.units.weightUnit).toBe('oz')
    expect(loaded.units.volumeUnit).toBe('cup')
    expect(loaded.units.bagUnit).toBe('in')
  })

  it('restores override values', () => {
    const decarb = makeDecarbState({
      tempOverride: '110',
      effLowOverride: '0.88',
      effExpectedOverride: '0.92',
      effHighOverride: '0.95',
    })
    const recipe = saveRecipe(
      'Override Test',
      makeUnitPreferences(),
      decarb,
      makeInfusionState(),
      makeDoseState()
    )
    const loaded = loadRecipe(recipe)

    expect(loaded.decarb.tempOverride).toBe('110')
    expect(loaded.decarb.effLowOverride).toBe('0.88')
    expect(loaded.decarb.effExpectedOverride).toBe('0.92')
    expect(loaded.decarb.effHighOverride).toBe('0.95')
  })

  it('uses defaults for missing optional fields', () => {
    const partialRecipe = {
      version: '1.0.0',
      name: 'Partial',
      createdAt: new Date().toISOString(),
      units: { tempUnit: 'C' },
      decarb: { weight: '5' },
      infusion: { decarbedThc: '100' },
      dose: { totalThc: '80' },
    }

    const loaded = loadRecipe(partialRecipe)

    expect(loaded.decarb.weight).toBe('5')
    expect(loaded.decarb.thcaPct).toBe('20') // default
    expect(loaded.dose.servings).toBe('10') // default
    expect(loaded.units.weightUnit).toBe('g') // default
  })

  it('throws for non-object input', () => {
    expect(() => loadRecipe(null)).toThrow(ValidationError)
    expect(() => loadRecipe('string')).toThrow(ValidationError)
    expect(() => loadRecipe(123)).toThrow(ValidationError)
  })
})

// ---------------------------------------------------------------------------
// scaleRecipe
// ---------------------------------------------------------------------------

describe('scaleRecipe', () => {
  it('scale 2x doubles weight and servings (VAL-RECIPE-003)', () => {
    const recipe = saveRecipe(
      'Scale Test',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '7',
        thcaPct: '20',
        thcPct: '2',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'coconut',
        volume: '200',
        customEfficiency: '0.82',
      }),
      makeDoseState({ servings: '24' })
    )

    const scaled = scaleRecipe(recipe, 2)

    expect(scaled.decarb.weight).toBe('14')
    expect(scaled.dose.servings).toBe('48')
  })

  it('scale 0.5x halves weight and servings', () => {
    const recipe = saveRecipe(
      'Half Test',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '14',
        thcaPct: '20',
        thcPct: '2',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'coconut',
        volume: '400',
        customEfficiency: '0.82',
      }),
      makeDoseState({ servings: '48' })
    )

    const scaled = scaleRecipe(recipe, 0.5)

    expect(scaled.decarb.weight).toBe('7')
    expect(scaled.dose.servings).toBe('24')
  })

  it('rejects zero scale factor', () => {
    const recipe = saveRecipe(
      'Zero',
      makeUnitPreferences(),
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    expect(() => scaleRecipe(recipe, 0)).toThrow(ValidationError)
  })

  it('rejects negative scale factor', () => {
    const recipe = saveRecipe(
      'Neg',
      makeUnitPreferences(),
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    expect(() => scaleRecipe(recipe, -1)).toThrow(ValidationError)
  })

  it('rejects non-numeric scale factor', () => {
    const recipe = saveRecipe(
      'NaN',
      makeUnitPreferences(),
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    expect(() => scaleRecipe(recipe, NaN)).toThrow(ValidationError)
  })

  it('rejects infinite scale factor', () => {
    const recipe = saveRecipe(
      'Inf',
      makeUnitPreferences(),
      makeDecarbState(),
      makeInfusionState(),
      makeDoseState()
    )
    expect(() => scaleRecipe(recipe, Infinity)).toThrow(ValidationError)
  })

  it('recalculates downstream values proportionally when scaling 2x', () => {
    // Base: 10g × 20% THCA × 0.877 + 2% THC = 10 * (0.1754 + 0.02) * 1000 = 1954.0 mg theoretical
    // sv_dry efficiency expected = 0.97 → decarbed = 1895.4 mg
    // coconut eff 0.82 → infused = 1554.2 mg
    // volume 100 mL → mg/mL = 15.5
    // servings 10 → mg/serving = 155.4 (very strong)

    const recipe = saveRecipe(
      'Downstream',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '2',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'coconut',
        volume: '100',
        customEfficiency: '0.82',
      }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 2)

    // Weight doubled to 20g → theoretical max doubled to 3908.0
    // decarbed expected doubled to 3790.8
    // infused doubled to 3108.5
    // volume doubled to 200 → mg/mL stays 15.5
    // servings doubled to 20 → mg/serving stays 155.4
    expect(scaled.computed).toBeDefined()
    expect(scaled.computed?.theoreticalMax).toBe(3908.0)
    expect(scaled.computed?.decarbedRange.expected).toBe(3790.8)
    expect(scaled.computed?.infusedThc).toBe(3108.5)
    expect(scaled.computed?.mgPerMl).toBe(15.5)
    expect(scaled.computed?.mgPerServing).toBe(155.4)
    expect(scaled.computed?.classification).toBe('extreme')
  })

  it('recalculates downstream values when scaling 0.5x', () => {
    const recipe = saveRecipe(
      'Half Downstream',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '2',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'coconut',
        volume: '100',
        customEfficiency: '0.82',
      }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 0.5)

    expect(scaled.computed).toBeDefined()
    expect(scaled.computed?.theoreticalMax).toBe(977.0)
    expect(scaled.computed?.infusedThc).toBe(777.1)
    expect(scaled.computed?.mgPerMl).toBe(15.5)
    expect(scaled.computed?.mgPerServing).toBe(155.4)
  })

  it('scales volume proportionally to maintain concentration', () => {
    const recipe = saveRecipe(
      'Volume Scale',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'ghee',
        volume: '100',
        customEfficiency: '0.85',
      }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 3)

    expect(scaled.infusion.volume).toBe('300')
  })

  it('updates infusion decarbedThc and dose totalThc to match computed values', () => {
    const recipe = saveRecipe(
      'Sync Test',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'coconut',
        volume: '100',
        customEfficiency: '0.82',
      }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 2)

    // decarbedThc and totalThc should match the recomputed expected values
    expect(parseFloat(scaled.infusion.decarbedThc)).toBe(
      scaled.computed?.decarbedRange.expected
    )
    expect(parseFloat(scaled.dose.totalThc)).toBe(scaled.computed?.infusedThc)
  })

  it('handles custom fat with override efficiency during scaling', () => {
    const recipe = saveRecipe(
      'Custom Fat Scale',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        presetId: 'sv_dry',
      }),
      makeInfusionState({
        fatId: 'custom',
        volume: '100',
        customEfficiency: '0.75',
      }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 2)

    // theoretical max 10g × 20% × 0.877 × 1000 = 1754.0
    // sv_dry expected 0.97 → 1701.4
    // custom eff 0.75 → infused = 1276.1
    // doubled weight → 3508.0 theoretical → 3402.8 decarbed → 2552.1 infused
    expect(scaled.computed?.theoreticalMax).toBe(3508.0)
    expect(scaled.computed?.infusedThc).toBe(2552.1)
    expect(scaled.infusion.fatId).toBe('custom')
    expect(scaled.infusion.customEfficiency).toBe('0.75')
  })

  it('handles efficiency overrides during scaling', () => {
    const recipe = saveRecipe(
      'Override Scale',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        presetId: 'sv_dry',
        effLowOverride: '0.90',
        effExpectedOverride: '0.93',
        effHighOverride: '0.96',
      }),
      makeInfusionState({ fatId: 'mct', volume: '100' }),
      makeDoseState({ servings: '10' })
    )

    const scaled = scaleRecipe(recipe, 2)

    // Use overridden efficiency: expected = 0.93
    // theoretical 1754.0 * 2 = 3508.0
    // decarbed expected = 3508.0 * 0.93 = 3262.4
    // mct eff 0.92 → infused = 3001.4
    expect(scaled.computed?.decarbedRange.expected).toBe(3262.4)
    expect(scaled.computed?.infusedThc).toBe(3001.4)
    expect(scaled.decarb.effExpectedOverride).toBe('0.93')
  })

  it('rounds all scaled values to max 1 decimal', () => {
    // Use values that produce repeating decimals when scaled
    const recipe = saveRecipe(
      'Rounding',
      makeUnitPreferences(),
      makeDecarbState({
        weight: '3.33',
        thcaPct: '19.7',
        thcPct: '0.8',
        presetId: 'sv_dry',
      }),
      makeInfusionState({ fatId: 'coconut', volume: '73' }),
      makeDoseState({ servings: '7' })
    )

    const scaled = scaleRecipe(recipe, 2)

    // All computed values should be rounded to 1 decimal
    const computed = scaled.computed!
    expect(computed.theoreticalMax!).toBe(
      Math.round(computed.theoreticalMax! * 10) / 10
    )
    expect(computed.mgPerServing!).toBe(
      Math.round(computed.mgPerServing! * 10) / 10
    )
  })
})
