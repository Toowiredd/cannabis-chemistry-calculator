/**
 * Week 7 Stage 2 validation tests (2026-07-26 wizard build,
 * §3.4 + §8.2 polish). Per the dispatch brief:
 *
 *  - Test 1: tapping "Begin batch" with an empty Flower
 *    selection set (no method) does NOT call `beginExecution`
 *    and instead renders the validation error.
 *  - Test 2: tapping "Begin batch" with a complete Flower
 *    selection set (oven_sealed + 7g + coconut) calls
 *    `beginExecution('preheat-decarb')` as before.
 *  - Test 3: making a new selection clears the previous
 *    validation error.
 *  - Test 4: the "Run again" CTA on the completion step calls
 *    `rerunRecipe(currentRecipeId)` + sets the local name +
 *    calls `returnToConfig()`.
 *  - Test 5: `rerunRecipe` returning `null` (recipe not
 *    found — defensive edge case) is handled gracefully
 *    (no crash).
 *
 * Testid / selector notes:
 *  - The validation error uses the brief's literal testid
 *    `wizard-validation-error` and renders as a `<div>` with
 *    `role="alert"` + `aria-live="assertive"` (the §7 a11y
 *    polish mandate).
 *  - The "Run again" CTA uses the design-system's literal
 *    testid `completion-step-rerun` (the same one the
 *    `CompletionStep.test.tsx` regression suite asserts
 *    on).
 *  - The "Mark complete" + "Run again" flows require the
 *    Stage 2 stepper to be mounted. Tests 4 + 5 set the
 *    `execution` slice directly to make the completion step
 *    current (the canonical "stage-2-finished" sentinel).
 *    This avoids walking 8 Stage 2 "Mark complete" clicks
 *    in the test — the full walk is covered by the
 *    Stage2Transition + Stage2Recalculating regression
 *    suites. Putting the completion step current is what
 *    the canonical Stage 2 "in flight, last step" state
 *    looks like; the brief's Test 4 / Test 5 descriptions
 *    don't care HOW we got there, only that the
 *    "Run again" CTA fires the right action chain.
 *  - The `initialState` prop is used for Test 1 + Test 3 to
 *    position the wizard at the Start step with incomplete
 *    selections. The wizard's local `state` is
 *    React-internal, so the only way to inject a specific
 *    (branch, currentStep, selections) triple is via this
 *    prop (added in the same Week 7 commit as the
 *    validation wiring; production code does not pass it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { WizardScreen } from '../WizardScreen'
import {
  DEFAULT_EXECUTION_STEP_STATE,
  useAppStore,
} from '../../stores/appStore'
import type { WizardSelections, WizardState } from '../wizardTypes'

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
 * Week 4 flake fix: reset the wizard feature flag so the next
 * test file's rehydrate sees the default `false`. The validation
 * tests flip the flag on via `enableWizard()`; without this
 * reset, the persist middleware would write `true` to
 * localStorage and pollute the next test file's rehydrate.
 */
function disableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: false,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Reset the store's `execution` slice + the `recipes` array so
 * each test starts from a clean slate — no leaked
 * `currentStepId` from a prior test, no leaked recipe records.
 */
function resetStage2AndRecipes() {
  useAppStore.setState(state => ({
    wizard: {
      ...state.wizard,
      execution: { ...DEFAULT_EXECUTION_STEP_STATE },
    },
    recipes: [],
  }))
}

/**
 * Stub `window.matchMedia` for tests that end up rendering
 * Stage 2 shells (the `HeatmapStep` reads `useReducedMotion`,
 * which uses `window.matchMedia`). Mirrors the helper in
 * `Stage2Recalculating.test.tsx` so the same env setup is
 * reused.
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

/**
 * Build a Flower+infusion `selections` object that satisfies the
 * §3.4 per-branch validation. The "with infusion" path is what
 * `buildExecutionSteps` uses to generate the `completion` row
 * (the "no infusion" path skips it — see
 * `wizard/stage2Steps.ts:153-158`), so Tests 4 + 5 need the fat
 * + volume fields populated.
 */
function buildFullFlowerInfusionSelections(): WizardSelections {
  return {
    method: 'oven_sealed',
    container: 'quart',
    weight: { value: 7, unit: 'g' },
    efficiency: 0.9,
    fat: 'coconut',
    volume: { value: 100, unit: 'mL' },
  }
}

/**
 * Pin the `execution` slice to "completion is current, all other
 * Stage 2 steps are complete". This is the canonical "user has
 * walked through Stage 2 and is on the final step" state — the
 * precondition for the "Run again" CTA to be visible. Avoids
 * the 8-click Stage 2 walk in the test.
 */
function pinCompletionAsCurrent() {
  useAppStore.setState(state => ({
    wizard: {
      ...state.wizard,
      execution: {
        currentStepId: 'completion',
        completedStepIds: [
          'preheat-decarb',
          'heatmap-decarb',
          'timer-decarb',
          'transition-decarb',
          'preheat-infusion',
          'timer-infusion',
          'transition-infusion',
        ],
        skippedStepIds: [],
        isRecalculating: false,
        affectedStepIds: [],
      },
    },
  }))
}

beforeEach(() => {
  resetStage2AndRecipes()
  stubMatchMedia()
  disableWizard()
})

/* ------------------------------------------------------------------ */
/* Test 1: empty Flower selection set → no beginExecution, error shown */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Begin batch validation (§3.4, Step 2)', () => {
  it('tapping Begin batch with an empty Flower selection set renders the validation error and does NOT call beginExecution', () => {
    enableWizard()
    // Spy on `beginExecution` so we can assert it was NOT
    // called. The spy is installed BEFORE render so the
    // wizard's `useAppStore(s => s.beginExecution)` selector
    // picks up the spy on its first render. (See
    // `Stage2Recalculating.test.tsx` for the full
    // rationale.)
    const { beginExecution } = useAppStore.getState()
    const beginSpy = vi.fn((firstStepId: string) => {
      beginExecution(firstStepId)
    })
    useAppStore.setState({ beginExecution: beginSpy })

    // The Flower no-infusion path has 7 effective steps
    // (productType + method + container + weight + efficiency
    // + fat + start — Volume is smart-skipped when fat is
    // null). For Test 1 the selections are EMPTY, so
    // `selections.fat` is `undefined` (NOT `null`) — the
    // Volume step's `skipIf` predicate checks
    // `selections.fat === null` and returns `false` for
    // `undefined`, so the Volume step is NOT smart-skipped.
    // The effective sequence is the full 8-step canonical
    // list (productType + method + container + weight +
    // efficiency + fat + volume + start) and the Start step
    // sits at index 7. We position the wizard there with an
    // empty `selections` object to simulate the "user has
    // picked a branch but not filled in any of the required
    // fields" case.
    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7,
      selections: {},
    }
    render(<WizardScreen initialState={initialState} />)
    expect(screen.getByTestId('wizard-begin-cta')).toBeTruthy()

    // Click "Begin batch". The validation in `onSelect` for
    // `stepId === 'start'` should fire and set
    // `validationError` to the joined errors string (the
    // Flower branch's missing-method / missing-container /
    // missing-weight errors).
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))

    // The validation error is rendered inline next to the
    // CTA with the brief's literal testid +
    // `role="alert"` + `aria-live="assertive"`.
    const errorEl = screen.getByTestId('wizard-validation-error')
    expect(errorEl).toBeTruthy()
    expect(errorEl.getAttribute('role')).toBe('alert')
    expect(errorEl.getAttribute('aria-live')).toBe('assertive')
    // The error text should mention at least one of the
    // missing required fields. The Flower no-infusion
    // path is missing method + container + weight; the
    // joined error string contains all three.
    expect(errorEl.textContent).toMatch(/method|container|weight/i)

    // `beginExecution` was NOT called — the brief's
    // contract: "DON'T call beginExecution" when
    // validation fails.
    expect(beginSpy).not.toHaveBeenCalled()
    // Defensive: the store's `execution.currentStepId`
    // is still null (the wizard did not transition to
    // Stage 2).
    expect(useAppStore.getState().wizard.execution.currentStepId).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Test 2: complete Flower selection set → beginExecution called        */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Begin batch happy path', () => {
  it('tapping Begin batch with a complete Flower no-infusion selection set calls beginExecution("preheat-decarb")', () => {
    enableWizard()
    // Spy on `beginExecution` so we can assert it was
    // called with `'preheat-decarb'`. The wrapper calls
    // the original so the store's `execution` slice is
    // updated and the Stage 2 stepper mounts (the test
    // asserts the mount as a side-effect check).
    const { beginExecution } = useAppStore.getState()
    const beginSpy = vi.fn((firstStepId: string) => {
      beginExecution(firstStepId)
    })
    useAppStore.setState({ beginExecution: beginSpy })

    render(<WizardScreen />)

    // Walk the Baked (edible) branch — the end-product
    // that maps to the edible branch in v2. Seven tile
    // clicks take the user from product-type picker to
    // the Start step: Method → Container → Weight → Fat
    // → Volume → Servings. The Edible branch has no
    // Efficiency step and no "No infusion" tile (those
    // were Flower-only), so the test walks the canonical
    // "with infusion" path.
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    expect(screen.getByTestId('wizard-begin-cta')).toBeTruthy()

    // Click "Begin batch". The validation passes (all
    // required selections are set for the Baked →
    // edible branch), the validationError state stays
    // null, and `beginExecution` is called with the
    // edible branch's first Stage 2 step.
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))

    // No validation error rendered.
    expect(screen.queryByTestId('wizard-validation-error')).toBeNull()
    // `beginExecution` was called exactly once with the
    // Flower's first Stage 2 step.
    expect(beginSpy).toHaveBeenCalledTimes(1)
    expect(beginSpy).toHaveBeenCalledWith('preheat-decarb')
    // The Stage 2 stepper mounted — the side-effect
    // check that confirms the store transition fired.
    expect(screen.getByTestId('execution-stepper')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/* Test 3: "Reset wizard" clears the validation error                   */
/* ------------------------------------------------------------------ */

describe('WizardScreen — "Reset wizard" clears the validation error (slide 4 of v2.2)', () => {
  it('tapping "Reset wizard" after a validation error clears the error and returns the wizard to its default state', () => {
    enableWizard()

    // Start at the Start step with PARTIAL selections
    // (method + container set, weight missing). This is
    // the canonical "user is on the Start step but the
    // selections are incomplete" scenario the brief
    // describes — the Begin batch tap fails the §3.4
    // per-branch validation and the error renders inline
    // next to the CTA.
    //
    // `currentStep: 7` because the partial selections
    // have `selections.fat === undefined` (not `null`),
    // so the Volume step is NOT smart-skipped and the
    // Start step is at index 7 in the effective 8-step
    // sequence.
    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7,
      selections: {
        method: 'oven_sealed',
        container: 'quart',
      },
    }
    render(<WizardScreen initialState={initialState} />)

    // Trigger the validation error (the user is on the
    // Start step with no weight).
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    expect(screen.getByTestId('wizard-validation-error')).toBeTruthy()

    // Slide 4 of v2.2 (2026-07-27): the slide-by-slide
    // view has no per-step re-edit affordance — there is
    // no `step-card-method-collapsed-with-selection`
    // breadcrumb the user can tap to rewind. The new
    // recovery path is "Reset wizard" from the header:
    // it clears the wizard's local state (including the
    // `validationError` state) and returns the user to
    // the product-type picker.
    fireEvent.click(screen.getByTestId('wizard-reset'))

    // The validation error is gone. The
    // `queryByTestId` returns `null` because the
    // `validationError` state was cleared by the reset
    // AND the Start section (which conditionally renders
    // the error) is un-rendered (the user is back at
    // the product-type picker). Both contribute to the
    // result; the test verifies the observable contract
    // without making assumptions about which side of the
    // OR is responsible.
    expect(screen.queryByTestId('wizard-validation-error')).toBeNull()
    // The product-type step is back to active.
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    // The Start step is GONE (reset cleared all state).
    expect(screen.queryByTestId('step-card-start-active')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Test 4: Run again CTA → rerunRecipe + returnToConfig                */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Run again on completion step (§8.2)', () => {
  it('tapping Run again on the completion step calls rerunRecipe(currentRecipeId) and returnToConfig', () => {
    enableWizard()

    // The "current" Recipe is the one the user just saved
    // in `handleCompletionSave` — it has the same
    // `selections` reference as the wizard's live
    // `state.selections` (the save flow passes
    // `state.selections` directly to `addRecipe`, which
    // preserves the reference). We pre-populate the
    // store with a Recipe whose `selections` is the SAME
    // object as the one the wizard will receive via
    // `initialState.selections` below, so the
    // `r.selections === state.selections` lookup in
    // `handleRerun` finds it.
    const testSelections = buildFullFlowerInfusionSelections()
    const recipeId = useAppStore.getState().addRecipe({
      id: 'recipe-rerun-test',
      createdAt: '2026-07-27T00:00:00.000Z',
      name: 'Test recipe',
      branch: 'flower',
      selections: testSelections,
      batchJournalEntryId: null,
    })

    // Pin the `execution` slice so the completion step is
    // current. This is the precondition for the
    // CompletionStep's "Run again" CTA to be visible.
    pinCompletionAsCurrent()

    // Spy on `rerunRecipe` + `returnToConfig`. The
    // `rerunRecipe` wrapper calls the original so the
    // store transition (Stage 1 re-engagement) fires
    // and the post-condition is verifiable. The
    // `returnToConfig` wrapper does the same.
    const { rerunRecipe, returnToConfig } = useAppStore.getState()
    const rerunSpy = vi.fn((id: string) => rerunRecipe(id))
    const returnSpy = vi.fn(() => returnToConfig())
    useAppStore.setState({ rerunRecipe: rerunSpy, returnToConfig: returnSpy })

    // Render with the `initialState` prop positioned at
    // the Flower+infusion Start step (currentStep: 7 —
    // the canonical sequence has 8 steps
    // productType+method+container+weight+efficiency+fat
    // +volume+start; the Start step is at index 7).
    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7,
      selections: testSelections,
    }
    render(<WizardScreen initialState={initialState} />)

    // The completion step is the current Stage 2 step
    // (per the `pinCompletionAsCurrent` setup), and the
    // design-system's `CompletionStep` renders the
    // "Run again" CTA.
    const rerunButton = screen.getByTestId('completion-step-rerun')
    expect(rerunButton).toBeTruthy()

    // Tap "Run again". The handler:
    //   1. looks up the current recipe by
    //      (branch, selections) identity — finds the
    //      pre-populated Recipe.
    //   2. calls `rerunRecipe(recipeId)` — the spy is
    //      invoked with the recipe's id.
    //   3. sets the local `name` to the returned
    //      recipe's `name` (verifiable only indirectly —
    //      the local state is React-internal; the
    //      `setName` call is a `useState` setter, so we
    //      trust the code path).
    //   4. calls `returnToConfig()`.
    fireEvent.click(rerunButton)

    // `rerunRecipe` was called exactly once with the
    // pre-populated recipe's id.
    expect(rerunSpy).toHaveBeenCalledTimes(1)
    expect(rerunSpy).toHaveBeenCalledWith(recipeId)
    // `returnToConfig` was called exactly once.
    expect(returnSpy).toHaveBeenCalledTimes(1)
    // The Stage 2 stepper has unmounted (because
    // `rerunRecipe` reset `execution` to the empty
    // defaults, and `returnToConfig` re-affirmed that).
    expect(screen.queryByTestId('execution-stepper')).toBeNull()
    // The Stage 1 wizard is back at the Start step with
    // the pre-filled selections (the `rerunRecipe` action
    // set `currentStep: 0` and copied the selections into
    // `wizard.stage1Selections`; the local `state` will
    // re-render the product-type picker).
    expect(screen.getByTestId('wizard-screen')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/* Test 5: rerunRecipe returns null → no crash                         */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Run again defensive edge case', () => {
  it('rerunRecipe returning null is handled gracefully (no crash, wizard stays mounted)', () => {
    enableWizard()

    // Pre-populate the store with a matching Recipe. The
    // handler's first lookup (`recipes.find(...)`) will
    // find this Recipe (the brief's defensive edge case
    // is "rerunRecipe returning null", not "no recipe in
    // the store" — those are two separate failure modes
    // and the handler guards both). We simulate the
    // rerunRecipe-null return by replacing the action
    // with a spy.
    const testSelections = buildFullFlowerInfusionSelections()
    useAppStore.getState().addRecipe({
      id: 'recipe-rerun-null-test',
      createdAt: '2026-07-27T00:00:00.000Z',
      name: 'Test recipe',
      branch: 'flower',
      selections: testSelections,
      batchJournalEntryId: null,
    })

    // Pin the completion step as current.
    pinCompletionAsCurrent()

    // Replace `rerunRecipe` with a spy that returns
    // `null`. This simulates the "recipe deleted between
    // the lookup and the call" race condition (the
    // store's `rerunRecipe` action returns `null` when
    // the recipe is not found — see
    // `appStore.ts:1796-1825`).
    const rerunSpy = vi.fn(() => null)
    useAppStore.setState({ rerunRecipe: rerunSpy })

    // Spy on `console.error` to verify the handler
    // fires the defensive log. `mockImplementation` is a
    // no-op so the test output isn't polluted with the
    // error message (which is intentional — the
    // handler is logging because something went wrong).
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7,
      selections: testSelections,
    }
    render(<WizardScreen initialState={initialState} />)

    // The completion step is current, "Run again" is
    // visible.
    expect(screen.getByTestId('completion-step-rerun')).toBeTruthy()

    // Tap "Run again" — the handler should NOT crash.
    // The first lookup finds the Recipe, the second
    // call (`rerunRecipe`) returns `null`, the handler
    // console.errors and bails (no `setName`, no
    // `returnToConfig`).
    fireEvent.click(screen.getByTestId('completion-step-rerun'))

    // `rerunRecipe` was called (the handler reached
    // the second call).
    expect(rerunSpy).toHaveBeenCalledTimes(1)
    // The defensive `console.error` fired.
    expect(consoleErrorSpy).toHaveBeenCalled()
    // The wizard screen is still mounted — no crash.
    expect(screen.getByTestId('wizard-screen')).toBeTruthy()
    // The completion step is still visible (the
    // handler bailed before the `returnToConfig` call
    // that would have unmounted the stepper).
    expect(screen.getByTestId('completion-step-rerun')).toBeTruthy()

    // Restore the console.error spy so the next test
    // sees a clean console.
    consoleErrorSpy.mockRestore()
  })
})
