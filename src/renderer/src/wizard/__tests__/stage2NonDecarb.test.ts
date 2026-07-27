/**
 * Stage 2 step builder tests for the non-decarb branches
 * (avb / concentrate / topical). These branches were previously
 * returning `[]` (see the pre-fix `stage2Steps.ts:175-183`),
 * which left the user with zero steps to actually follow after
 * tapping "Begin batch". This file pins the post-fix behaviour:
 * each non-decarb branch returns a 4-step list (preheat + timer
 * + transition + completion) with the right per-branch temp +
 * duration.
 *
 * Coverage:
 *  - Test 1: AVB branch returns 4 steps with the AVB defaults.
 *  - Test 2: Concentrate branch returns 4 steps with the
 *    concentrate defaults.
 *  - Test 3: Topical branch returns 4 steps with the topical
 *    defaults.
 *  - Test 4: All 3 non-decarb branches include the completion
 *    step (no smart-skip — there is always a recipe to save).
 *  - Test 5: The Flower + Edible branches STILL return the
 *    full 8-step (or 4-step no-infusion) list — the
 *    `buildFlowerOrEdibleSteps` refactor must not regress the
 *    Flower's existing contract.
 */
import { describe, expect, it } from 'vitest'

import { buildExecutionSteps, STAGE2_STEP_IDS } from '../stage2Steps'
import type { WizardSelections } from '../wizardTypes'

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

function avbSelections(): WizardSelections {
  return {
    color: 'medium',
    carrier: 'alcohol_high_proof',
    volume: { value: 100, unit: 'mL' },
    servings: 30,
  }
}

function concentrateSelections(): WizardSelections {
  return {
    potency: 0.8,
    carrier: 'mct',
    volume: { value: 30, unit: 'mL' },
    servings: 15,
  }
}

function topicalSelections(): WizardSelections {
  return {
    carrier: 'coconut',
    volume: { value: 240, unit: 'mL' },
    applicationArea: 'joints',
  }
}

function flowerSelections(): WizardSelections {
  return {
    method: 'oven_sealed',
    container: 'quart',
    weight: { value: 7, unit: 'g' },
    efficiency: 0.9,
    fat: 'coconut',
    volume: { value: 240, unit: 'mL' },
  }
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('buildExecutionSteps — non-decarb branches', () => {
  it('AVB branch returns 4 steps with the AVB steep defaults', () => {
    const steps = buildExecutionSteps('avb', avbSelections())
    expect(steps).toHaveLength(4)
    // Step 1: preheat at the AVB steep temp (80°C).
    const preheat = steps[0]
    expect(preheat).toBeDefined()
    expect(preheat?.id).toBe(STAGE2_STEP_IDS.preheatSteep)
    expect(preheat?.shell).toBe('preheat')
    expect(preheat?.targetTemp).toBe(80)
    expect(preheat?.phase).toBe('infusion')
    // Step 2: timer at the AVB steep duration (2 hours = 7200s).
    const timer = steps[1]
    expect(timer).toBeDefined()
    expect(timer?.id).toBe(STAGE2_STEP_IDS.timerInfusion)
    expect(timer?.shell).toBe('timer')
    expect(timer?.totalSeconds).toBe(7200)
    expect(timer?.stirIntervalSeconds).toBe(1800) // 7200/4
    // Step 3: transition.
    const transition = steps[2]
    expect(transition).toBeDefined()
    expect(transition?.id).toBe(STAGE2_STEP_IDS.transitionInfusion)
    expect(transition?.shell).toBe('transition')
    // Step 4: completion.
    const completion = steps[3]
    expect(completion).toBeDefined()
    expect(completion?.id).toBe(STAGE2_STEP_IDS.completion)
    expect(completion?.shell).toBe('completion')
  })

  it('Concentrate branch returns 4 steps with the concentrate dissolve defaults', () => {
    const steps = buildExecutionSteps('concentrate', concentrateSelections())
    expect(steps).toHaveLength(4)
    const preheat = steps[0]
    expect(preheat?.targetTemp).toBe(80)
    const timer = steps[1]
    expect(timer?.totalSeconds).toBe(2700) // 45 min
    expect(timer?.stirIntervalSeconds).toBe(675) // 2700/4
  })

  it('Topical branch returns 4 steps with the topical infuse defaults', () => {
    const steps = buildExecutionSteps('topical', topicalSelections())
    expect(steps).toHaveLength(4)
    const preheat = steps[0]
    expect(preheat?.targetTemp).toBe(70)
    const timer = steps[1]
    expect(timer?.totalSeconds).toBe(3600) // 1 hour
    expect(timer?.stirIntervalSeconds).toBe(900) // 3600/4
  })

  it('all 3 non-decarb branches include the completion step (no smart-skip)', () => {
    // The Flower "no infusion" path skips completion (fat === null).
    // The non-decarb branches have no infusion-vs-no-infusion fork —
    // the user is always producing a recipe (tincture / infused
    // oil / salve) so the completion step is always present.
    for (const branch of ['avb', 'concentrate', 'topical'] as const) {
      const selections =
        branch === 'avb'
          ? avbSelections()
          : branch === 'concentrate'
            ? concentrateSelections()
            : topicalSelections()
      const steps = buildExecutionSteps(branch, selections)
      const completion = steps.find(
        s => s.id === STAGE2_STEP_IDS.completion
      )
      expect(completion, `${branch} must include the completion step`).toBeDefined()
    }
  })

  it('Flower + Edible branches still return the 8-step (or 4-step no-infusion) list', () => {
    // Regression guard: the `buildFlowerOrEdibleSteps` refactor
    // must not break the Flower's existing 8-step contract.
    const flowerSteps = buildExecutionSteps('flower', flowerSelections())
    expect(flowerSteps).toHaveLength(8)
    // Edible branch always requires a fat — no "no infusion" path.
    const edibleSteps = buildExecutionSteps('edible', flowerSelections())
    expect(edibleSteps).toHaveLength(8)
    // Flower "no infusion" path: 4 decarb steps only.
    const flowerNoInfusion = buildExecutionSteps('flower', {
      ...flowerSelections(),
      fat: null,
    })
    expect(flowerNoInfusion).toHaveLength(4)
  })
})
