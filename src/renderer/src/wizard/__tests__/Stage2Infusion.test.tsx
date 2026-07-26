/**
 * Stage 2 infusion + completion + save flow tests (Week 5).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §7, Week 5 grows
 * the Flower branch's Stage 2 path from 4 steps (Week 4) to 8
 * steps when an infusion is requested, OR keeps it at 4 steps
 * when the Flower "no infusion" path is taken. The completion
 * step is the new terminal affordance (§8.2 + §8.5); the
 * "Save to Journal" CTA wires the canonical
 * addJournalEntry → addRecipe → setRecipeJournalEntry flow
 * (§8.2).
 *
 * Coverage:
 *  - Test 1: builder — `buildExecutionSteps('flower', ...)`
 *    returns 8 steps in canonical order when a fat is set,
 *    with steps[4..7] being the infusion + completion
 *    sequence (preheat-infusion, timer-infusion,
 *    transition-infusion, completion).
 *  - Test 2: builder — `buildExecutionSteps('flower', ...)`
 *    returns 4 steps (decarb only; no infusion phase) when
 *    `selections.fat === null`. The terminal step is
 *    `transition-decarb`.
 *  - Test 3: `NameRecipeStep` integration — the
 *    `deriveDefaultRecipeName` helper produces
 *    "Oven, sealed bag — 7g — Coconut" for the canonical
 *    Flower test selection (method=oven_sealed, weight=7g,
 *    fat=coconut).
 *  - Test 4: completion save flow — mount the WizardScreen
 *    at the completion step (via direct execution-state
 *    seeding; the test asserts the §8.2 chain: addJournalEntry
 *    is called first, then addRecipe, then
 *    setRecipeJournalEntry with the linked ids). The spy
 *    pattern is the same one used by the Week 4 re-edit
 *    tests (install the spy before render so the wizard's
 *    `useAppStore(s => s.<action>)` selector picks up the
 *    spy on its first render).
 *
 * Testid / selector notes:
 *  - The Stage 2 stepper mounts at `data-testid="execution-stepper"`
 *    when `execution.currentStepId` is non-null. The
 *    completion shell is mounted at `data-testid="completion-step"`
 *    with the "Save to Journal" CTA at
 *    `data-testid="completion-step-save"`. The
 *    `NameRecipeStep` component is at
 *    `data-testid="name-recipe-step"` (its save button is at
 *    `data-testid="name-recipe-step-save"`).
 *  - For Test 4 we seed the `wizard.execution` slice
 *    directly (currentStepId = 'completion', all 7 prior
 *    steps in `completedStepIds`). This bypasses the
 *    click-walk-through Stage 2 sequence (which would
 *    require 8 `fireEvent.click` calls on "Mark complete"
 *    buttons) and focuses the test on the §8.2 save chain.
 *  - The store's `addRecipe` returns the generated id; the
 *    test asserts both the call payload and the returned id
 *    to be used as the first arg of `setRecipeJournalEntry`.
 *  - The store's `addJournalEntry` prepends to the list;
 *    the test seeds an empty list and asserts
 *    `state.journalEntries.length === 1` after the save
 *    flow, with the new entry at index 0 and the
 *    `source: 'quickbatch'` stamp (per the
 *    WizardScreen.tsx:613 JSDoc rationale — the existing
 *    JournalEntrySource union does not include 'wizard').
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { WizardScreen } from '../WizardScreen'
import { buildExecutionSteps, STAGE2_STEP_IDS } from '../stage2Steps'
import type { WizardSelections } from '../wizardTypes'
import {
  DEFAULT_EXECUTION_STEP_STATE,
  DEFAULT_DECARB,
  useAppStore,
} from '../../stores/appStore'
import { deriveDefaultRecipeName } from '../../components/NameRecipeStep'

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
 * Week 4 flake fix: reset the wizard feature flag so the
 * next test file's rehydrate sees the default `false`
 * (otherwise `enableWizard()` from a prior test would
 * persist `true` to localStorage and break
 * `screens/__tests__/main.test.tsx`).
 */
function disableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: false,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Reset the Stage 2 `execution` slice + the `decarb`
 * preset back to the default empty form. Mirrors the
 * helper in `Stage2Recalculating.test.tsx` so the tests
 * in this file don't leak state into each other or into
 * adjacent test files.
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

beforeEach(() => {
  resetStage2()
  disableWizard()
  // Week 7 fix: the ExecutionStepper now calls
  // `useReducedMotion()` which reads `window.matchMedia`.
  // JSDOM doesn't ship matchMedia by default. The
  // completion-save test mounts the stepper to the
  // completion step, which transitively mounts the
  // HeatmapStep (DecarbHeatmap reads `useReducedMotion`
  // for its needle animation) — both need the stub.
  if (typeof window.matchMedia !== 'function') {
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
})

/* ------------------------------------------------------------------ */
/* Test 1: builder — Flower with infusion returns 8 steps             */
/* ------------------------------------------------------------------ */

describe('buildExecutionSteps — Flower (Week 5 with-infusion path)', () => {
  it('returns 8 steps with steps[4..7] = preheat-infusion, timer-infusion, transition-infusion, completion', () => {
    const steps = buildExecutionSteps('flower', {
      method: 'oven_sealed',
      weight: { value: 7, unit: 'g' },
      fat: 'coconut',
    })
    // Week 4 was 4 steps; Week 5 grows the with-infusion
    // path to 8.
    expect(steps).toHaveLength(8)
    // Steps 0..3 are the unchanged Week 4 decarb sequence.
    expect(steps[0]?.id).toBe(STAGE2_STEP_IDS.preheatDecarb)
    expect(steps[1]?.id).toBe(STAGE2_STEP_IDS.heatmapDecarb)
    expect(steps[2]?.id).toBe(STAGE2_STEP_IDS.timerDecarb)
    expect(steps[3]?.id).toBe(STAGE2_STEP_IDS.transitionDecarb)
    // Steps 4..7 are the Week 5 infusion + completion
    // sequence.
    expect(steps[4]?.id).toBe(STAGE2_STEP_IDS.preheatInfusion)
    expect(steps[5]?.id).toBe(STAGE2_STEP_IDS.timerInfusion)
    expect(steps[6]?.id).toBe(STAGE2_STEP_IDS.transitionInfusion)
    expect(steps[7]?.id).toBe(STAGE2_STEP_IDS.completion)
    // Sanity-check the new shells' values. The
    // preheat-infusion target is `oven_sealed.tempC (113)
    // - 13 = 100`; the timer-infusion is 30 min × 60
    // = 1800s with a 10-min stir cadence; the transition
    // message contains "Dose and save" (the §8.5
    // affordance); the completion shell is present.
    expect(steps[4]?.shell).toBe('preheat')
    expect(steps[4]?.targetTemp).toBe(100)
    expect(steps[4]?.duration).toBe('30 min')
    expect(steps[4]?.phase).toBe('infusion')
    expect(steps[5]?.shell).toBe('timer')
    expect(steps[5]?.totalSeconds).toBe(1800)
    expect(steps[5]?.stirIntervalSeconds).toBe(600)
    expect(steps[5]?.phase).toBe('infusion')
    expect(steps[6]?.shell).toBe('transition')
    expect(steps[6]?.phase).toBe('transition')
    expect(steps[6]?.message ?? '').toContain('Dose and save')
    expect(steps[7]?.shell).toBe('completion')
    expect(steps[7]?.phase).toBe('completion')
  })
})

/* ------------------------------------------------------------------ */
/* Test 2: builder — Flower with fat: null returns 4 steps            */
/* ------------------------------------------------------------------ */

describe('buildExecutionSteps — Flower (Week 5 no-infusion path)', () => {
  it('returns 4 decarb-only steps when selections.fat === null (no infusion phase, no completion)', () => {
    // The selections must be typed as the wizard-side
    // WizardSelections (the store-side one has
    // `fat: string` and rejects `null`). The cast keeps
    // the contract explicit and matches the canonical
    // §3.1 "no infusion" sentinel.
    const selections: WizardSelections = {
      method: 'oven_sealed',
      fat: null,
    }
    const steps = buildExecutionSteps('flower', selections)
    // The no-infusion path is the Week 4 shape: 4 decarb
    // steps, no infusion phase, no completion step. The
    // §3.1 smart-skip rule generalises to Stage 2: there
    // is no batch to save, so the completion step does
    // not render.
    expect(steps).toHaveLength(4)
    expect(steps[0]?.id).toBe(STAGE2_STEP_IDS.preheatDecarb)
    expect(steps[1]?.id).toBe(STAGE2_STEP_IDS.heatmapDecarb)
    expect(steps[2]?.id).toBe(STAGE2_STEP_IDS.timerDecarb)
    // The terminal step is the decarb transition (no
    // infusion transition + no completion).
    expect(steps[3]?.id).toBe(STAGE2_STEP_IDS.transitionDecarb)
    // Defensive: the no-infusion path does NOT include
    // any of the Week 5 new steps.
    const ids = steps.map(s => s.id)
    expect(ids).not.toContain(STAGE2_STEP_IDS.preheatInfusion)
    expect(ids).not.toContain(STAGE2_STEP_IDS.timerInfusion)
    expect(ids).not.toContain(STAGE2_STEP_IDS.transitionInfusion)
    expect(ids).not.toContain(STAGE2_STEP_IDS.completion)
  })
})

/* ------------------------------------------------------------------ */
/* Test 3: deriveDefaultRecipeName — Flower with-infusion shape       */
/* ------------------------------------------------------------------ */

describe('deriveDefaultRecipeName — Flower (Week 5 §8.5 default)', () => {
  it('produces "Oven, sealed bag — 7g — Coconut" for method=oven_sealed, weight=7g, fat=coconut', () => {
    const name = deriveDefaultRecipeName({
      method: 'oven_sealed',
      weight: { value: 7, unit: 'g' },
      fat: 'coconut',
    })
    // The §8.5 example for a typical Flower batch is
    // exactly this string. The order is
    // method → weight → fat, joined with " — "
    // (em-dash surrounded by single spaces). The
    // NameRecipeStep's `deriveDefaultRecipeName` is
    // exported so this assertion is independent of the
    // component's internal state machine.
    expect(name).toBe('Oven, sealed bag — 7g — Coconut')
  })
})

/* ------------------------------------------------------------------ */
/* Test 4: completion save flow (§8.2)                                */
/* ------------------------------------------------------------------ */

describe('WizardScreen — completion save flow (Week 5 §8.2)', () => {
  it('Save to Journal fires addJournalEntry → addRecipe → setRecipeJournalEntry in that order', () => {
    enableWizard()
    // Spy on the three §8.2 actions. The spy is installed
    // BEFORE render so the wizard's
    // `useAppStore(s => s.<action>)` selectors pick up the
    // spy on their first render — installing the spy
    // after render would leave the wizard holding the
    // original action reference (zustand captures the
    // action reference at selector-call time), so the spy
    // would never be invoked. This is the same pattern
    // the Week 4 `Stage2Recalculating.test.tsx` uses.
    const { addJournalEntry, addRecipe, setRecipeJournalEntry } =
      useAppStore.getState()
    const callOrder: string[] = []
    const journalSpy = vi.fn((entry: unknown) => {
      callOrder.push('addJournalEntry')
      return addJournalEntry(entry as Parameters<typeof addJournalEntry>[0])
    })
    const recipeSpy = vi.fn(
      (recipe: Parameters<typeof addRecipe>[0]): string => {
        callOrder.push('addRecipe')
        return addRecipe(recipe)
      }
    )
    const linkSpy = vi.fn((recipeId: string, entryId: string): void => {
      callOrder.push('setRecipeJournalEntry')
      setRecipeJournalEntry(recipeId, entryId)
    })
    useAppStore.setState({
      addJournalEntry: journalSpy,
      addRecipe: recipeSpy,
      setRecipeJournalEntry: linkSpy,
    })

    render(<WizardScreen />)

    // Walk the Flower branch with an infusion path.
    // The branch sequence is product-type → method →
    // container → weight → efficiency → fat (coconut —
    // NOT 'none', so the volume + servings steps are
    // NOT smart-skipped) → volume (100 mL) → servings
    // (10) → start. The Start step is the terminal
    // "Begin batch" CTA; tapping it calls
    // `beginExecution('preheat-decarb')` on the store
    // and mounts the Stage 2 stepper.
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // Fat = coconut (NOT 'none'). The Volume step renders
    // next (the §3.1 smart-skip filter only skips Volume
    // when fat === null).
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // The Flower branch has no Servings step (per
    // `branchSequences.ts:62-71` — the canonical Flower
    // sequence is productType → method → container →
    // weight → efficiency → fat → volume → start). The
    // next active step IS the Start step. The "Begin
    // batch" CTA is visible.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // Pre-condition: no journal entries, no recipes, no
    // execution entered.
    const preState = useAppStore.getState()
    expect(preState.journalEntries).toHaveLength(0)
    expect(preState.recipes).toHaveLength(0)
    expect(preState.wizard.execution.currentStepId).toBeNull()
    // Begin batch → Stage 2 mounts at the preheat step.
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    expect(screen.getByTestId('execution-stepper')).toBeTruthy()
    // Fast-forward to the completion step. We could
    // click "Mark complete" 7 times (one per prior
    // step) but that drags the test through 7 seconds
    // of unrelated UI plumbing. Seeding the
    // `execution` slice directly is the canonical
    // "Stage 2 is on the completion step" test setup;
    // the Week 4 §8.1 tests use the same pattern (the
    // `recomputeFromEdit` spy test seeds
    // `currentStepId` directly via `useAppStore.setState`).
    useAppStore.setState(state => ({
      wizard: {
        ...state.wizard,
        execution: {
          ...state.wizard.execution,
          currentStepId: STAGE2_STEP_IDS.completion,
          completedStepIds: [
            STAGE2_STEP_IDS.preheatDecarb,
            STAGE2_STEP_IDS.heatmapDecarb,
            STAGE2_STEP_IDS.timerDecarb,
            STAGE2_STEP_IDS.transitionDecarb,
            STAGE2_STEP_IDS.preheatInfusion,
            STAGE2_STEP_IDS.timerInfusion,
            STAGE2_STEP_IDS.transitionInfusion,
          ],
        },
      },
    }))

    // The completion step is the current Stage 2 step.
    // The "Save to Journal" button is mounted.
    const completionSave = screen.getByTestId('completion-step-save')
    expect(completionSave).toBeTruthy()
    // Tap "Save to Journal" on the completion step.
    fireEvent.click(completionSave)
    // The §8.2 chain ran in order. The first dispatch
    // was addJournalEntry; the second was addRecipe; the
    // third was setRecipeJournalEntry.
    expect(callOrder).toEqual([
      'addJournalEntry',
      'addRecipe',
      'setRecipeJournalEntry',
    ])
    // All three spies were called exactly once.
    expect(journalSpy).toHaveBeenCalledTimes(1)
    expect(recipeSpy).toHaveBeenCalledTimes(1)
    expect(linkSpy).toHaveBeenCalledTimes(1)
    // The addJournalEntry payload is a JournalEntry with
    // the canonical shape: today's date, source =
    // 'quickbatch' (the existing JournalEntrySource
    // sentinel; see WizardScreen.tsx:613 JSDoc), a
    // generated entry_<ts>_<rand> id, the wizard's
    // selections mapped to per-field authoring values.
    const journalArg = journalSpy.mock.calls[0]?.[0] as {
      id: string
      source: string
      methodId: string
      fatId: string
      servings: string
      materialWeight: string
    }
    expect(journalArg.id).toMatch(/^entry_\d+_[a-z0-9]+$/)
    expect(journalArg.source).toBe('quickbatch')
    expect(journalArg.methodId).toBe('oven_sealed')
    expect(journalArg.fatId).toBe('coconut')
    // The Flower branch has no Servings step (per
    // `branchSequences.ts:62-71`), so
    // `selections.servings` is `undefined` and the
    // computed `servings` fallback is `0`.
    expect(journalArg.servings).toBe('0')
    expect(journalArg.materialWeight).toBe('7')
    // The addRecipe payload has batchJournalEntryId:
    // null on the initial write (the link is patched in
    // the next step), the wizard's branch as 'flower',
    // and the user-typed name (the local `name` state
    // starts as `''` so the fallback 'Untitled recipe'
    // is used).
    const recipeArg = recipeSpy.mock.calls[0]?.[0] as {
      name: string
      branch: string
      batchJournalEntryId: string | null
    }
    expect(recipeArg.batchJournalEntryId).toBeNull()
    expect(recipeArg.branch).toBe('flower')
    expect(recipeArg.name).toBeTruthy()
    // The setRecipeJournalEntry payload uses the
    // generated recipe id (the return value of
    // addRecipe) and the journal entry id we just
    // wrote.
    const recipeId = recipeSpy.mock.results[0]?.value as string
    const linkArgs = linkSpy.mock.calls[0] as [string, string]
    expect(linkArgs[0]).toBe(recipeId)
    expect(linkArgs[1]).toMatch(/^entry_\d+_[a-z0-9]+$/)
    // Post-condition: the store has 1 journal entry
    // (prepended) and 1 recipe (prepended). The
    // recipe's `batchJournalEntryId` was patched to the
    // entry id by the link step.
    const postState = useAppStore.getState()
    expect(postState.journalEntries).toHaveLength(1)
    expect(postState.recipes).toHaveLength(1)
    expect(postState.recipes[0]?.batchJournalEntryId).toBe(
      postState.journalEntries[0]?.id
    )
  })
})
