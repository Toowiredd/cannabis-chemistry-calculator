/**
 * Tests for the wizard step definitions.
 *
 * Each step is a declarative `WizardStep` per the architecture
 * doc §3.4. The tests below assert that every Week 2 step
 * definition returns the right options, the right option IDs,
 * the right `getSelectedOptionId` encoding, and the right
 * `skipIf` predicate behaviour.
 *
 * Coverage:
 *  - Each step's `getOptions` returns the right number of
 *    options with the right IDs and titles.
 *  - Each step's `getSelectedOptionId` encodes the
 *    `WizardSelections` value into the option ID space.
 *  - The `skipIf` predicates on `volumeStep` and `servingsStep`
 *    return the right boolean for the relevant branch states.
 */
import { describe, expect, it } from 'vitest'
import {
  applicationAreaStep,
  carrierStep,
  colorStep,
  containerStep,
  efficiencyStep,
  fatStep,
  potencyStep,
  servingsStep,
  startStep,
  volumeStep,
  weightStep,
} from '../steps'
import { AVB_RESIDUAL_THC_RANGES } from 'renderer/src/engine/decarb'
import {
  BAG_PRESETS,
  DECARB_METHODS,
  INFUSION_FATS,
} from 'renderer/src/engine/models'
import type { WizardState } from '../wizardTypes'

/** Minimal `WizardState` for tests that need a branch set. */
const flowerState: WizardState = {
  branch: 'flower',
  currentStep: 0,
  selections: {},
}

const edibleState: WizardState = {
  branch: 'edible',
  currentStep: 0,
  selections: {},
}

const topicalState: WizardState = {
  branch: 'topical',
  currentStep: 0,
  selections: {},
}

describe('containerStep', () => {
  it('returns one tile per BAG_PRESETS entry with the real bag name', () => {
    const options = containerStep.getOptions(flowerState)
    expect(options).toHaveLength(BAG_PRESETS.length)
    for (const preset of BAG_PRESETS) {
      const tile = options.find(o => o.id === preset.id)
      expect(tile).toBeTruthy()
      expect(tile?.title).toBe(preset.name)
    }
  })

  it('encodes the selection as the option id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { container: 'gallon' },
    }
    expect(containerStep.getSelectedOptionId?.(state)).toBe('gallon')
  })

  it('returns null when no container has been picked', () => {
    expect(containerStep.getSelectedOptionId?.(flowerState)).toBeNull()
  })
})

describe('weightStep', () => {
  it('returns 5 beginner-friendly weight presets (3.5g to 56g)', () => {
    const options = weightStep.getOptions(flowerState)
    expect(options).toHaveLength(5)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['g-3.5', 'g-7', 'g-14', 'g-28', 'g-56'])
  })

  it('shows both grams and oz on each tile', () => {
    const options = weightStep.getOptions(flowerState)
    const eighth = options.find(o => o.id === 'g-3.5')
    expect(eighth?.title).toBe('3.5 g')
    expect(eighth?.subtitle).toBe('1/8 oz')
  })

  it('encodes the selection as unit-dash-value', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { weight: { value: 7, unit: 'g' } },
    }
    expect(weightStep.getSelectedOptionId?.(state)).toBe('g-7')
  })

  it('returns null when no weight has been picked', () => {
    expect(weightStep.getSelectedOptionId?.(flowerState)).toBeNull()
  })
})

describe('efficiencyStep', () => {
  it('returns 5 tiles: 1 recommended + 4 fixed presets (80/85/90/95)', () => {
    const options = efficiencyStep.getOptions(flowerState)
    expect(options).toHaveLength(5)
    // The recommended tile carries the "Recommended" badge.
    const recommended = options.find(o => o.badge === 'Recommended')
    expect(recommended).toBeTruthy()
    // The fixed presets are 80/85/90/95 (deduped if the
    // recommended value collides with one of them).
    const ids = options.map(o => o.id)
    expect(ids).toContain('eff-80')
    expect(ids).toContain('eff-85')
    expect(ids).toContain('eff-90')
    expect(ids).toContain('eff-95')
  })

  it('uses the picked method expected efficiency as the recommended value', () => {
    // sv_dry has expected efficiency 0.97 → 97% recommended.
    const state: WizardState = {
      ...flowerState,
      selections: { method: 'sv_dry' },
    }
    const options = efficiencyStep.getOptions(state)
    const recommended = options.find(o => o.badge === 'Recommended')
    expect(recommended?.id).toBe('eff-97')
  })

  it('encodes the selection as eff-pct', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { efficiency: 0.9 },
    }
    expect(efficiencyStep.getSelectedOptionId?.(state)).toBe('eff-90')
  })

  it('returns null when no efficiency has been picked', () => {
    expect(efficiencyStep.getSelectedOptionId?.(flowerState)).toBeNull()
  })
})

describe('fatStep', () => {
  it('returns INFUSION_FATS tiles for the Edible branch', () => {
    const options = fatStep.getOptions(edibleState)
    expect(options).toHaveLength(INFUSION_FATS.length)
    for (const fat of INFUSION_FATS) {
      const tile = options.find(o => o.id === fat.id)
      expect(tile).toBeTruthy()
      expect(tile?.title).toBe(fat.name)
    }
  })

  it('adds a "No infusion" tile for the Flower branch only', () => {
    const edibleOptions = fatStep.getOptions(edibleState)
    expect(edibleOptions.find(o => o.id === 'none')).toBeUndefined()
    const flowerOptions = fatStep.getOptions(flowerState)
    expect(flowerOptions.find(o => o.id === 'none')).toBeTruthy()
  })

  it('encodes the "no infusion" selection as the "none" option id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { fat: null },
    }
    expect(fatStep.getSelectedOptionId?.(state)).toBe('none')
  })

  it('encodes a real fat selection as the fat id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { fat: 'coconut' },
    }
    expect(fatStep.getSelectedOptionId?.(state)).toBe('coconut')
  })
})

describe('volumeStep', () => {
  it('returns 4 volume presets in mL', () => {
    const options = volumeStep.getOptions(flowerState)
    expect(options).toHaveLength(4)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['mL-100', 'mL-240', 'mL-480', 'mL-960'])
  })

  it('encodes the selection as unit-dash-value', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { volume: { value: 240, unit: 'mL' } },
    }
    expect(volumeStep.getSelectedOptionId?.(state)).toBe('mL-240')
  })

  it('skips for the Flower branch "no infusion" path', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { fat: null },
    }
    expect(volumeStep.skipIf?.(state)).toBe(true)
  })

  it('does not skip for the Flower branch "with infusion" path', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { fat: 'coconut' },
    }
    expect(volumeStep.skipIf?.(state)).toBe(false)
  })

  it('does not skip for non-Flower branches', () => {
    const edible: WizardState = {
      ...edibleState,
      selections: { fat: 'coconut' },
    }
    expect(volumeStep.skipIf?.(edible)).toBe(false)
  })
})

describe('servingsStep', () => {
  it('returns 6 serving presets (4 to 48)', () => {
    const options = servingsStep.getOptions(flowerState)
    expect(options).toHaveLength(6)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['s-4', 's-8', 's-12', 's-16', 's-24', 's-48'])
  })

  it('encodes the selection as s-count', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { servings: 12 },
    }
    expect(servingsStep.getSelectedOptionId?.(state)).toBe('s-12')
  })

  it('skips for the Topical branch', () => {
    expect(servingsStep.skipIf?.(topicalState)).toBe(true)
  })

  it('does not skip for dose-able branches (flower, edible, concentrate, avb)', () => {
    expect(servingsStep.skipIf?.(flowerState)).toBe(false)
    expect(servingsStep.skipIf?.(edibleState)).toBe(false)
    expect(
      servingsStep.skipIf?.({
        branch: 'concentrate',
        currentStep: 0,
        selections: {},
      })
    ).toBe(false)
    expect(
      servingsStep.skipIf?.({ branch: 'avb', currentStep: 0, selections: {} })
    ).toBe(false)
  })
})

describe('carrierStep', () => {
  it('returns 5 carrier tiles (alcohol, glycerin, mct, olive, coconut)', () => {
    const options = carrierStep.getOptions(flowerState)
    expect(options).toHaveLength(5)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['alcohol', 'glycerin', 'mct', 'olive', 'coconut'])
  })

  it('encodes the selection as the carrier id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { carrier: 'alcohol' },
    }
    expect(carrierStep.getSelectedOptionId?.(state)).toBe('alcohol')
  })
})

describe('potencyStep', () => {
  it('returns 4 potency presets (50/65/75/85)', () => {
    const options = potencyStep.getOptions(flowerState)
    expect(options).toHaveLength(4)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['p-50', 'p-65', 'p-75', 'p-85'])
  })

  it('encodes the selection as p-pct', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { potency: 75 },
    }
    expect(potencyStep.getSelectedOptionId?.(state)).toBe('p-75')
  })
})

describe('colorStep', () => {
  it('returns 3 AVB color tiles with the engine residual THC range', () => {
    const options = colorStep.getOptions(flowerState)
    expect(options).toHaveLength(3)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['light', 'medium', 'dark'])
    // Each tile shows the engine's min-max range.
    for (const color of ['light', 'medium', 'dark'] as const) {
      const tile = options.find(o => o.id === color)
      const range = AVB_RESIDUAL_THC_RANGES[color]
      expect(tile?.subtitle).toBe(
        `${range.minPct}-${range.maxPct}% residual THC remaining`
      )
    }
  })

  it('encodes the selection as the color id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { color: 'medium' },
    }
    expect(colorStep.getSelectedOptionId?.(state)).toBe('medium')
  })
})

describe('applicationAreaStep', () => {
  it('returns 4 application area tiles (face, body, joint, muscle)', () => {
    const options = applicationAreaStep.getOptions(flowerState)
    expect(options).toHaveLength(4)
    const ids = options.map(o => o.id)
    expect(ids).toEqual(['face', 'body', 'joint', 'muscle'])
  })

  it('encodes the selection as the area id', () => {
    const state: WizardState = {
      ...flowerState,
      selections: { applicationArea: 'joint' },
    }
    expect(applicationAreaStep.getSelectedOptionId?.(state)).toBe('joint')
  })
})

describe('startStep', () => {
  it('returns a single "Begin batch" option', () => {
    const options = startStep.getOptions(flowerState)
    expect(options).toHaveLength(1)
    expect(options[0]?.id).toBe('begin')
    expect(options[0]?.title).toBe('Begin batch')
  })

  it('always returns "begin" as the selected option id', () => {
    // The Start step's selection is a marker (the wizard is
    // complete), not a `selections` key.
    expect(startStep.getSelectedOptionId?.(flowerState)).toBe('begin')
  })
})

/**
 * Sanity check: every step id is unique. The Wizard component
 * keys StepCards by `step.id`; duplicate ids would break the
 * diffing.
 */
describe('step id uniqueness', () => {
  it('every step has a unique id', () => {
    const allSteps = [
      containerStep,
      weightStep,
      efficiencyStep,
      fatStep,
      volumeStep,
      servingsStep,
      carrierStep,
      potencyStep,
      colorStep,
      applicationAreaStep,
      startStep,
    ]
    const ids = allSteps.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the DECARB_METHODS ids referenced by the engine tests are unchanged', () => {
    // Defensive: the engine's method ids are the contract the
    // brief's Flower Method step reads. We do not modify them.
    const ids = DECARB_METHODS.map(m => m.id)
    expect(ids).toContain('oven_sealed')
    expect(ids).toContain('sv_dry')
  })
})
