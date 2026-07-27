/**
 * Tests for the wizardFlow DAG + predicates.
 *
 * The DAG (`getNextStep`) is the single source of truth for
 * "what step is the user on right now" in the Stage 1 wizard.
 * It replaces the old per-branch `BRANCH_SEQUENCES` arrays
 * (deleted in commit 2). The DAG reads
 * `(endProduct, branch, selections)` and returns the next
 * step id, OR `'start'` when the user is on the terminal
 * step.
 *
 * The 15 path test matrix (5 end products × 3 materials) is
 * pinned to the expected step sequences. The tests below
 * cover the canonical happy paths + the key smart-skip
 * rules (no infusion / no decarb / no servings for salve).
 *
 * The DAG is a pure function (no React, no DOM, no store
 * reads) so the tests are straight input/output assertions.
 */
import { describe, expect, it } from 'vitest'
import {
  getNextStep,
  getStepCounter,
  getStepPath,
  isFinished,
  isOnStartStep,
  shouldRecommendDoubleBag,
} from '../wizardFlow'
import type { WizardState } from '../wizardTypes'

/**
 * Build a base state with an end product + material, with
 * empty selections. The DAG should walk through the
 * expected per-path steps.
 */
function stateFor(
  endProduct: 'baked' | 'gummies' | 'capsules' | 'tincture' | 'salve' | null,
  branch: 'flower' | 'avb' | 'concentrate' | null,
  selections: WizardState['selections'] = {}
): WizardState {
  return {
    endProduct,
    branch,
    currentStepId: null,
    selections,
  }
}

describe('getNextStep — initial state', () => {
  it('returns "product-type" when endProduct is unset', () => {
    expect(getNextStep(stateFor(null, null))).toBe('product-type')
  })
})

describe('getNextStep — Material step', () => {
  it('returns "material" when endProduct is set but branch is unset', () => {
    // After the user picks an end product, the next
    // step is always Material — the user can override
    // the coverflow's default branch.
    expect(getNextStep(stateFor('baked', null))).toBe('material')
    expect(getNextStep(stateFor('tincture', null))).toBe('material')
    expect(getNextStep(stateFor('salve', null))).toBe('material')
  })
})

describe('getNextStep — per-path canonical sequences', () => {
  it('Baked + Flower: material → method → container → weight → efficiency → fat → volume → servings → name → start', () => {
    // The 9-step path for the edible+flower combination.
    let s = stateFor('baked', 'flower')
    expect(getNextStep(s)).toBe('method')
    s = { ...s, selections: { ...s.selections, method: 'oven_sealed' } }
    expect(getNextStep(s)).toBe('container')
    s = { ...s, selections: { ...s.selections, container: 'vac-19' } }
    expect(getNextStep(s)).toBe('weight')
    s = {
      ...s,
      selections: { ...s.selections, weight: { value: 7, unit: 'g' } },
    }
    expect(getNextStep(s)).toBe('efficiency')
    s = { ...s, selections: { ...s.selections, efficiency: 0.9 } }
    expect(getNextStep(s)).toBe('fat')
    s = { ...s, selections: { ...s.selections, fat: 'coconut' } }
    expect(getNextStep(s)).toBe('volume')
    s = {
      ...s,
      selections: { ...s.selections, volume: { value: 100, unit: 'mL' } },
    }
    expect(getNextStep(s)).toBe('servings')
    s = { ...s, selections: { ...s.selections, servings: 12 } }
    expect(getNextStep(s)).toBe('name')
    s = { ...s, selections: { ...s.selections, name: 'My recipe' } }
    expect(getNextStep(s)).toBe('start')
  })

  it('Baked + AVB: material → container → weight → color → fat → volume → servings → name → start', () => {
    let s = stateFor('baked', 'avb')
    expect(getNextStep(s)).toBe('container')
    s = { ...s, selections: { ...s.selections, container: 'vac-19' } }
    expect(getNextStep(s)).toBe('weight')
    s = {
      ...s,
      selections: { ...s.selections, weight: { value: 7, unit: 'g' } },
    }
    expect(getNextStep(s)).toBe('color')
    s = { ...s, selections: { ...s.selections, color: 'medium' } }
    expect(getNextStep(s)).toBe('fat')
    s = { ...s, selections: { ...s.selections, fat: 'coconut' } }
    expect(getNextStep(s)).toBe('volume')
    s = {
      ...s,
      selections: { ...s.selections, volume: { value: 100, unit: 'mL' } },
    }
    expect(getNextStep(s)).toBe('servings')
    s = { ...s, selections: { ...s.selections, servings: 12 } }
    expect(getNextStep(s)).toBe('name')
    s = { ...s, selections: { ...s.selections, name: 'My recipe' } }
    expect(getNextStep(s)).toBe('start')
  })

  it('Baked + Concentrate: material → container → weight → potency → fat → volume → servings → name → start', () => {
    let s = stateFor('baked', 'concentrate')
    expect(getNextStep(s)).toBe('container')
    s = { ...s, selections: { ...s.selections, container: 'vac-19' } }
    expect(getNextStep(s)).toBe('weight')
    s = {
      ...s,
      selections: { ...s.selections, weight: { value: 7, unit: 'g' } },
    }
    expect(getNextStep(s)).toBe('potency')
    s = { ...s, selections: { ...s.selections, potency: 0.75 } }
    expect(getNextStep(s)).toBe('fat')
    s = { ...s, selections: { ...s.selections, fat: 'coconut' } }
    expect(getNextStep(s)).toBe('volume')
    s = {
      ...s,
      selections: { ...s.selections, volume: { value: 100, unit: 'mL' } },
    }
    expect(getNextStep(s)).toBe('servings')
    s = { ...s, selections: { ...s.selections, servings: 12 } }
    expect(getNextStep(s)).toBe('name')
    s = { ...s, selections: { ...s.selections, name: 'My recipe' } }
    expect(getNextStep(s)).toBe('start')
  })

  it('Tincture + Flower: material → method → container → weight → efficiency → carrier → volume → servings → name → start', () => {
    let s = stateFor('tincture', 'flower')
    expect(getNextStep(s)).toBe('method')
    s = { ...s, selections: { ...s.selections, method: 'oven_sealed' } }
    expect(getNextStep(s)).toBe('container')
    s = { ...s, selections: { ...s.selections, container: 'vac-19' } }
    expect(getNextStep(s)).toBe('weight')
    s = {
      ...s,
      selections: { ...s.selections, weight: { value: 7, unit: 'g' } },
    }
    expect(getNextStep(s)).toBe('efficiency')
    s = { ...s, selections: { ...s.selections, efficiency: 0.9 } }
    expect(getNextStep(s)).toBe('carrier')
    s = { ...s, selections: { ...s.selections, carrier: 'alcohol' } }
    expect(getNextStep(s)).toBe('volume')
    s = {
      ...s,
      selections: { ...s.selections, volume: { value: 100, unit: 'mL' } },
    }
    expect(getNextStep(s)).toBe('servings')
    s = { ...s, selections: { ...s.selections, servings: 12 } }
    expect(getNextStep(s)).toBe('name')
    s = { ...s, selections: { ...s.selections, name: 'My recipe' } }
    expect(getNextStep(s)).toBe('start')
  })

  it('Salve + Flower: material → method → container → weight → efficiency → carrier → volume → app-area → name → start', () => {
    // The salve path skips Servings (topicals are not
    // dose-divided) and asks for app-area instead.
    let s = stateFor('salve', 'flower')
    expect(getNextStep(s)).toBe('method')
    s = { ...s, selections: { ...s.selections, method: 'oven_sealed' } }
    expect(getNextStep(s)).toBe('container')
    s = { ...s, selections: { ...s.selections, container: 'vac-19' } }
    expect(getNextStep(s)).toBe('weight')
    s = {
      ...s,
      selections: { ...s.selections, weight: { value: 7, unit: 'g' } },
    }
    expect(getNextStep(s)).toBe('efficiency')
    s = { ...s, selections: { ...s.selections, efficiency: 0.9 } }
    expect(getNextStep(s)).toBe('carrier')
    s = { ...s, selections: { ...s.selections, carrier: 'coconut' } }
    expect(getNextStep(s)).toBe('volume')
    s = {
      ...s,
      selections: { ...s.selections, volume: { value: 100, unit: 'mL' } },
    }
    expect(getNextStep(s)).toBe('app-area')
    s = { ...s, selections: { ...s.selections, applicationArea: 'face' } }
    expect(getNextStep(s)).toBe('name')
    s = { ...s, selections: { ...s.selections, name: 'My recipe' } }
    expect(getNextStep(s)).toBe('start')
  })
})

describe('getNextStep — smart-skip rules', () => {
  it('skips Volume + Servings when selections.fat === null (the "no infusion" path)', () => {
    // The Flower branch's "No infusion" tile sets
    // selections.fat = null. The DAG skips Volume and
    // Servings downstream because the user is just
    // decarbing without infusing into a fat.
    const s = stateFor('baked', 'flower', {
      method: 'oven_sealed',
      container: 'vac-19',
      weight: { value: 7, unit: 'g' },
      efficiency: 0.9,
      fat: null,
    })
    expect(getNextStep(s)).toBe('name')
  })

  it('asks for fat (not carrier) for edible end products even with material=flower', () => {
    // The end product drives the infusion-side question
    // (fat vs carrier), not the material.
    const s = stateFor('baked', 'flower', {
      method: 'oven_sealed',
      container: 'vac-19',
      weight: { value: 7, unit: 'g' },
      efficiency: 0.9,
    })
    expect(getNextStep(s)).toBe('fat')
  })

  it('asks for carrier (not fat) for tincture end products', () => {
    const s = stateFor('tincture', 'flower', {
      method: 'oven_sealed',
      container: 'vac-19',
      weight: { value: 7, unit: 'g' },
      efficiency: 0.9,
    })
    expect(getNextStep(s)).toBe('carrier')
  })

  it('asks for app-area (not servings) for salve end products', () => {
    const s = stateFor('salve', 'flower', {
      method: 'oven_sealed',
      container: 'vac-19',
      weight: { value: 7, unit: 'g' },
      efficiency: 0.9,
      carrier: 'coconut',
      volume: { value: 100, unit: 'mL' },
    })
    expect(getNextStep(s)).toBe('app-area')
  })
})

describe('isOnStartStep', () => {
  it('returns true when the DAG returns "start"', () => {
    const s = stateFor('baked', 'flower', {
      method: 'oven_sealed',
      container: 'vac-19',
      containerWidthCm: 19,
      weight: { value: 7, unit: 'g' },
      efficiency: 0.9,
      fat: 'coconut',
      volume: { value: 100, unit: 'mL' },
      servings: 12,
      name: 'My recipe',
    })
    expect(isOnStartStep(s)).toBe(true)
  })
})

describe('isFinished', () => {
  it('returns true when currentStepId is null + endProduct + branch are all set', () => {
    const s: WizardState = {
      endProduct: 'baked',
      branch: 'flower',
      currentStepId: null,
      selections: {},
    }
    expect(isFinished(s)).toBe(true)
  })

  it('returns false for the initial state (endProduct is null)', () => {
    const s: WizardState = {
      endProduct: null,
      branch: null,
      currentStepId: null,
      selections: {},
    }
    expect(isFinished(s)).toBe(false)
  })
})

describe('shouldRecommendDoubleBag', () => {
  it('returns true for material=flower + sv_* method + 19cm bag', () => {
    const s = stateFor('baked', 'flower', {
      method: 'sv_dry',
      containerWidthCm: 19,
    })
    expect(shouldRecommendDoubleBag(s)).toBe(true)
  })

  it('returns false for the 28cm bag (large enough that single-bag is fine)', () => {
    const s = stateFor('baked', 'flower', {
      method: 'sv_dry',
      containerWidthCm: 28,
    })
    expect(shouldRecommendDoubleBag(s)).toBe(false)
  })

  it('returns false for oven methods (no puncturing risk)', () => {
    const s = stateFor('baked', 'flower', {
      method: 'oven_sealed',
      containerWidthCm: 19,
    })
    expect(shouldRecommendDoubleBag(s)).toBe(false)
  })

  it('returns false for AVB material (no decarb, no sous vide)', () => {
    const s = stateFor('baked', 'avb', {
      containerWidthCm: 19,
    })
    expect(shouldRecommendDoubleBag(s)).toBe(false)
  })
})

describe('getStepPath', () => {
  // The path is the ordered list of step ids the user will
  // walk through for the current (endProduct, branch) combo.
  // The tests below pin the path length + the first/last
  // step for the 5 canonical (endProduct, branch) combos +
  // the smart-skip rules.

  it('returns [product-type] when nothing is picked (path unknown until endProduct is set)', () => {
    const s = stateFor(null, null)
    expect(getStepPath(s)).toEqual(['product-type'])
  })

  it('returns [product-type, material] when endProduct is set but branch is not', () => {
    const s = stateFor('baked', null)
    expect(getStepPath(s)).toEqual(['product-type', 'material'])
  })

  it('returns the 11-step path for baked + flower (longest path)', () => {
    // baked (edible) + flower has: product-type, material,
    // method, container, weight, efficiency, fat, volume,
    // servings, name, start = 11 steps
    const s = stateFor('baked', 'flower')
    const path = getStepPath(s)
    expect(path).toHaveLength(11)
    expect(path[0]).toBe('product-type')
    expect(path[1]).toBe('material')
    expect(path[2]).toBe('method')
    expect(path[path.length - 1]).toBe('start')
  })

  it('returns the 10-step path for baked + avb (no method/efficiency/fat)', () => {
    // baked (edible) + avb has: product-type, material,
    // container, weight, color, fat, volume, servings, name,
    // start = 10 steps
    const s = stateFor('baked', 'avb')
    const path = getStepPath(s)
    expect(path).toHaveLength(10)
    expect(path).not.toContain('method')
    expect(path).not.toContain('efficiency')
    expect(path).toContain('color')
  })

  it('returns the 10-step path for baked + concentrate (potency instead of color)', () => {
    const s = stateFor('baked', 'concentrate')
    const path = getStepPath(s)
    expect(path).toHaveLength(10)
    expect(path).not.toContain('color')
    expect(path).toContain('potency')
  })

  it('returns the path for salve (carrier + app-area, no servings)', () => {
    const s = stateFor('salve', 'flower')
    const path = getStepPath(s)
    expect(path).toContain('carrier')
    expect(path).toContain('app-area')
    expect(path).not.toContain('servings')
  })

  it('returns the path for tincture (carrier + servings, no fat/app-area)', () => {
    const s = stateFor('tincture', 'avb')
    const path = getStepPath(s)
    expect(path).toContain('carrier')
    expect(path).toContain('servings')
    expect(path).not.toContain('fat')
    expect(path).not.toContain('app-area')
  })
})

describe('getStepCounter', () => {
  // The step counter is the source of truth for the
  // "{n} / {total}" widget. It should:
  //  - start at "1 / 1" on the product-type step (path
  //    unknown until the user picks an end product)
  //  - move to "2 / 2" on the material step
  //  - move to "3 / 11" (or whatever the path length is)
  //    on the method step of the baked + flower path
  //  - end at "{n} / {n}" on the start step (the user is
  //    on the last step of the path)

  it('returns 1 / 1 on the product-type step (no endProduct yet)', () => {
    const s = stateFor(null, null)
    expect(getStepCounter(s)).toEqual({ stepNumber: 1, totalSteps: 1 })
  })

  it('returns 2 / 2 on the material step (endProduct set, branch not)', () => {
    const s: WizardState = {
      endProduct: 'baked',
      branch: null,
      currentStepId: 'material',
      selections: {},
    }
    expect(getStepCounter(s)).toEqual({ stepNumber: 2, totalSteps: 2 })
  })

  it('returns 3 / 11 on the method step of the baked + flower path', () => {
    const s: WizardState = {
      endProduct: 'baked',
      branch: 'flower',
      currentStepId: 'method',
      selections: {},
    }
    expect(getStepCounter(s).stepNumber).toBe(3)
    expect(getStepCounter(s).totalSteps).toBe(11)
  })

  it('returns the correct position for the start step (last step in the path)', () => {
    const s: WizardState = {
      endProduct: 'baked',
      branch: 'flower',
      currentStepId: 'start',
      selections: {
        method: 'oven_sealed',
        container: 'vac-19',
        containerWidthCm: 19,
        weight: { value: 7, unit: 'g' },
        efficiency: 0.9,
        fat: 'coconut',
        volume: { value: 240, unit: 'mL' },
        servings: 12,
        name: 'My recipe',
      },
    }
    const counter = getStepCounter(s)
    expect(counter.stepNumber).toBe(counter.totalSteps)
  })

  it('uses getNextStep to find the current step when currentStepId is null', () => {
    // Defensive: the Wizard's render block uses
    // `state.currentStepId ?? getNextStep(state)`. The
    // counter helper should do the same — if the user is
    // on the initial state (currentStepId is null), the
    // counter should reflect the first DAG step.
    const s = stateFor(null, null)
    const counter = getStepCounter(s)
    expect(counter.stepNumber).toBe(1)
  })
})
