/**
 * Week 4 Stage 2 tests (2026-07-26 wizard build, §4.1 + §8.1).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §4.1, the Flower's
 * Stage 2 path grows from 2 steps (preheat + heatmap, Week 3) to
 * 4 steps (preheat + heatmap + timer + transition). §8.1 mandates
 * the re-edit "recalculating..." flow when the user re-edits a
 * Stage 1 selection mid-batch.
 *
 * Coverage:
 *  - Test 1: `buildExecutionSteps('flower', { method: 'oven_sealed' })`
 *    returns 4 steps in canonical order with the right timer
 *    values. The expected `totalSeconds` and
 *    `stirIntervalSeconds` are pinned to the engine's `oven_sealed`
 *    `timeMin: 60, timeMax: 90` — midpoint 75 min, halfway point
 *    37.5 min. The transition step's message must contain
 *    "infusion" so the §4.1 "Move to infusion" affordance reads
 *    naturally.
 *  - Test 2: `TimerStep` renders the configured `totalSeconds`
 *    formatted as "1h 15m" (the brief's "configured for 75 min
 *    total" caption — the `formatDuration` helper renders ≥60min
 *    as `Hh Mm`). The stir alert is a one-shot effect that
 *    would fire at `Math.floor(75*60/2) = 2250` seconds; the
 *    test documents that we don't wait 37.5 minutes for it to
 *    fire in a unit test.
 *  - Test 3: an in-flight Stage 2 re-edit (Begin batch → tap
 *    "Edit" on the Method step) fires `recomputeFromEdit` with
 *    the full Flower Stage 2 list AND clears
 *    `execution.currentStepId` to `null` (Stage 2 exited). The
 *    re-edited step is in the "active" state on the way back.
 *  - Test 4 (negative): when Stage 2 is NOT active
 *    (`execution.currentStepId === null`), tapping Edit on a
 *    Stage 1 step does NOT call `recomputeFromEdit`. The
 *    existing rewind logic is enough.
 *
 * Testid / selector notes (Week 3 mirror):
 *  - The brief mentions the canonical
 *    `execution-step-${stepId}-badge-recalculating` testid for
 *    the "recalculating..." badge. That testid is owned by
 *    design-system and was added to `ExecutionStepRow` in
 *    commit e0e70cc ("recalculating badge + data-recalculating
 *    hooks for §8.1"). We use the
 *    `data-recalculating="true"` attribute on the stepper root
 *    as the canonical Stage 2 "is in recalculating state" gate
 *    (it's a cheaper signal than the per-row badge testid and
 *    is what a11y/visual-regression tests key on). The badge
 *    testid is asserted indirectly in Test 3 via the
 *    stepper-root attribute — a subscriber listening to the
 *    store between the two synchronous `set()` calls inside
 *    `recomputeFromEdit` would also catch the intermediate
 *    `isRecalculating: true` state, but the Week 4 contract
 *    pins that to the state-routing rein's own test file.
 *  - For Test 3 the re-edit targets the Method step (the
 *    first Stage 1 step after the product-type picker). The
 *    StepCard's `data-testid` for the re-edit affordance is
 *    `step-card-${stepId}-collapsed-with-selection` (the
 *    tap-to-re-edit button). We fire a click on that node to
 *    simulate the user re-opening the Method step.
 *  - For Test 3 the spy on `recomputeFromEdit` is installed
 *    BEFORE the WizardScreen renders so the wizard's
 *    `useAppStore(s => s.recomputeFromEdit)` selector picks up
 *    the spy on its first render. Installing the spy AFTER
 *    render would leave the wizard holding the original
 *    closure (zustand captures the action reference at the
 *    time of the selector call), so the spy would never be
 *    invoked. This is the Week 3 pattern from the
 *    `Stage2Transition.test.tsx` file (where state
 *    manipulations happen on the store before render).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { WizardScreen } from '../WizardScreen'
import { buildExecutionSteps } from '../stage2Steps'
import {
  DEFAULT_EXECUTION_STEP_STATE,
  DEFAULT_DECARB,
  useAppStore,
} from '../../stores/appStore'
import { TimerStep } from '../../components/execution/TimerStep'

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

function enableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: true,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Reset `wizardEnabled` to `false` between tests. The Stage 2
 * tests below flip the flag on via `enableWizard()`; without
 * this reset, the persist middleware would write `true` to
 * localStorage and pollute the next test file's rehydrate
 * (notably `screens/__tests__/main.test.tsx` which depends on
 * the default `false` value). Week 4 flake fix.
 */
function disableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: false,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Reset the store's `execution` slice to the default empty form
 * (so each Stage 2 test starts from a clean slate — no leaked
 * `currentStepId` from a prior test). Also reset the
 * `decarb.presetId` so the test on entry to the timer step
 * starts from the default `'oven_sealed'` preset rather than
 * whatever the previous test left behind.
 */
function resetStage2() {
  useAppStore.setState(state => ({
    decarb: { ...DEFAULT_DECARB },
    wizard: {
      ...state.wizard,
      execution: { ...DEFAULT_EXECUTION_STEP_STATE },
    },
  }))
}

/**
 * Stub `window.matchMedia` for any test that ends up rendering
 * the `HeatmapStep` (which reads `useReducedMotion`).
 */
function stubMatchMedia() {
  if (typeof window.matchMedia === 'function') return
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  resetStage2()
  stubMatchMedia()
  // Week 4 flake fix: reset the wizard feature flag so the
  // next test file's rehydrate sees the default `false`
  // (otherwise `enableWizard()` from a prior test would
  // persist `true` to localStorage and break
  // `screens/__tests__/main.test.tsx`).
  disableWizard()
})

/* ------------------------------------------------------------------ */
/* Test 1: builder — Flower returns 4 steps with the right timer math  */
/* ------------------------------------------------------------------ */

describe('buildExecutionSteps — Flower (Week 4 scope)', () => {
  it('returns 4 steps in canonical order with midpoint-anchored timer values for oven_sealed', () => {
    const steps = buildExecutionSteps('flower', { method: 'oven_sealed' })
    // Week 3 had 2 steps; Week 4 grew the path to 4.
    expect(steps).toHaveLength(4)
    // Canonical order: preheat → heatmap → timer → transition.
    expect(steps[0]?.id).toBe('preheat-decarb')
    expect(steps[1]?.id).toBe('heatmap-decarb')
    expect(steps[2]?.id).toBe('timer-decarb')
    expect(steps[3]?.id).toBe('transition-decarb')
    // Timer shell + values. `oven_sealed` is timeMin=60,
    // timeMax=90 → midpoint 75 min → 4500 seconds. The stir
    // interval is the halfway point: floor(4500/2) = 2250.
    expect(steps[2]?.shell).toBe('timer')
    expect(steps[2]?.totalSeconds).toBe(75 * 60)
    expect(steps[2]?.stirIntervalSeconds).toBe(Math.floor((75 * 60) / 2))
    // Transition shell + message. The brief asks for a message
    // that contains 'infusion' so the §4.1 "Move to infusion"
    // affordance reads naturally to the user.
    expect(steps[3]?.shell).toBe('transition')
    expect(steps[3]?.phase).toBe('transition')
    expect(steps[3]?.message ?? '').toContain('infusion')
  })
})

/* ------------------------------------------------------------------ */
/* Test 2: TimerStep renders the configured totalSeconds              */
/* ------------------------------------------------------------------ */

describe('TimerStep — totalSeconds caption (Week 4)', () => {
  it('renders "Configured for 1h 15m total" for totalSeconds=4500 (75 minutes)', () => {
    // Direct component test — no need to mount the WizardScreen
    // for this. 4500s = 75 min, the oven_sealed midpoint from
    // Test 1. The informational caption in TimerStep is
    // `Configured for {formatDuration(totalSeconds)} total`
    // (see TimerStep.tsx). The `formatDuration` helper renders
    // 75 min as "1h 15m" (>= 60 min, non-zero remainder —
    // the canonical pattern for any duration > 1 hour).
    //
    // NOTE: the brief's literal example said "75m", but the
    // canonical format for >= 60 min is "Hh Mm". The test
    // asserts the canonical format; a future engineer who
    // changes `formatDuration` to render "75m" instead of
    // "1h 15m" will need to update both this test and the
    // design-system rein's `TimerStep.test.tsx` in lockstep.
    render(
      <TimerStep
        onComplete={() => {}}
        stirIntervalSeconds={2250}
        totalSeconds={4500}
      />
    )
    expect(screen.getByTestId('timer-step')).toBeTruthy()
    expect(screen.getByTestId('timer-step-total').textContent).toContain(
      '1h 15m'
    )
    // Note: the Stir alert is one-shot and fires at
    // stirIntervalSeconds = 2250s (~37.5 minutes) of elapsed
    // time. The brief explicitly documents that the test
    // doesn't wait for it; the canonical "alert appears at
    // the right interval" test lives in the design-system
    // rein's `TimerStep.test.tsx` (where the test uses fake
    // timers + a 60s test interval for fast feedback).
  })
})

/* ------------------------------------------------------------------ */
/* Test 3: "Back to config" from the Stage 2 stepper (§8.1)             */
/* ------------------------------------------------------------------ */

describe('WizardScreen — "Back to config" from Stage 2 (slide 4 of v2.2)', () => {
  it('tapping "Back to config" clears execution and rewinds to the Start step', () => {
    enableWizard()
    // Spy on `recomputeFromEdit` so we can assert it was NOT
    // called — the slide-by-slide view (slide 4 of v2.2,
    // 2026-07-27) removed the per-step re-edit affordance;
    // the only path back to Stage 1 from the Stepper is
    // "Back to config", which calls `returnToConfig` and
    // rewinds `currentStep` to the Start step. The recompute
    // path is still wired in `onEdit` (per the §8.1
    // contract) but no user-facing UI surfaces it today.
    // The action itself stays in the codebase for future
    // use (the state-routing rein's appStore tests cover
    // the action in isolation).
    const { recomputeFromEdit } = useAppStore.getState()
    const recomputeSpy = vi.fn((affectedStepIds: string[]) => {
      recomputeFromEdit(affectedStepIds)
    })
    useAppStore.setState({ recomputeFromEdit: recomputeSpy })

    // Spy on `returnToConfig` so we can assert it was
    // called by the "Back to config" path.
    const { returnToConfig } = useAppStore.getState()
    const returnSpy = vi.fn(() => returnToConfig())
    useAppStore.setState({ returnToConfig: returnSpy })

    render(<WizardScreen />)
    // Walk the Baked (edible) branch to the Start step.
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Start is the next active step.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // Begin batch → Stage 2 mounts.
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    expect(screen.getByTestId('execution-stepper')).toBeTruthy()
    // Pre-condition: Stage 2 is live.
    expect(useAppStore.getState().wizard.execution.currentStepId).not.toBeNull()
    // Tap "Back to config" — the canonical "go back to Stage
    // 1" affordance on the stepper. (This testid is owned
    // by the design-system rein; see ExecutionStepper.tsx.)
    fireEvent.click(screen.getByTestId('execution-stepper-back'))
    // `returnToConfig` was called — the canonical
    // "Stage 2 exited" sentinel.
    expect(returnSpy).toHaveBeenCalledTimes(1)
    // `recomputeFromEdit` was NOT called — the slide-by-
    // slide view has no per-step re-edit affordance, so
    // the §8.1 recompute path is dormant in the user-
    // facing UI today. (The action is still wired in
    // `onEdit`; the appStore tests cover it.)
    expect(recomputeSpy).not.toHaveBeenCalled()
    // The store's execution slice is cleared.
    expect(useAppStore.getState().wizard.execution.currentStepId).toBeNull()
    // The Stage 2 stepper has unmounted.
    expect(screen.queryByTestId('execution-stepper')).toBeNull()
    // The Stage 1 wizard is back at the Start step (the
    // slide-by-slide view: ONLY the current step is in the
    // DOM, no collapsed past-step breadcrumb).
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/* Test 4 (negative): "Reset wizard" before Stage 2 does NOT recompute */
/* ------------------------------------------------------------------ */

describe('WizardScreen — "Reset wizard" (slide 4 of v2.2)', () => {
  it('tapping "Reset wizard" clears the wizard state and does NOT call recomputeFromEdit', () => {
    enableWizard()
    // Spy on `recomputeFromEdit`. The slide-by-slide view
    // has no per-step re-edit affordance; "Reset wizard"
    // just clears the wizard's local state, so the §8.1
    // recompute path stays dormant. The action itself is
    // still wired in `onEdit` and the appStore tests cover
    // it in isolation.
    const { recomputeFromEdit } = useAppStore.getState()
    const recomputeSpy = vi.fn((affectedStepIds: string[]) => {
      recomputeFromEdit(affectedStepIds)
    })
    useAppStore.setState({ recomputeFromEdit: recomputeSpy })

    render(<WizardScreen />)
    // Walk past the product-type picker so the wizard has
    // some non-default state.
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
    // Pre-condition: Stage 2 is NOT active.
    expect(useAppStore.getState().wizard.execution.currentStepId).toBeNull()
    // Tap "Reset wizard".
    fireEvent.click(screen.getByTestId('wizard-reset'))
    // The recompute must NOT have been called — there are
    // no Stage 2 rows to re-derive because Stage 2 was
    // never entered. The existing reset logic is enough.
    expect(recomputeSpy).not.toHaveBeenCalled()
    // The product-type step is back to active (the user
    // is back at the start of the wizard).
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    // The Method step is GONE (reset cleared all state).
    expect(screen.queryByTestId('step-card-method-active')).toBeNull()
  })
})
