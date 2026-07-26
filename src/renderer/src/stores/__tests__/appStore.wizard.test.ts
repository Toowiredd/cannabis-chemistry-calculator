import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAppStore } from '../appStore'
import {
  DEFAULT_EXECUTION_STEP_STATE,
  DEFAULT_STAGE1_WIZARD_SELECTIONS,
  DEFAULT_WIZARD_STATE,
} from '../appStore'

// Renamed from 'cannabis-chem-units' to 'ccc-app-state' in the
// 2026-07-25 Cluster C refactor (F2.1). The persist key reflects
// the partialize shape (10 slices), not just the `units` slice.
// Bumped to v8 in the 2026-07-26 wizard Week 1 commit (Stage 1
// Configuration Wizard slice + `wizardEnabled` feature flag).
const STORAGE_KEY = 'ccc-app-state'

/**
 * Helper: read the persisted JSON envelope from localStorage.
 * Returns `null` when nothing has been persisted yet.
 */
function readPersisted(): {
  state: Record<string, unknown>
  version: number
} | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw == null) return null
  return JSON.parse(raw)
}

/**
 * Helper: poll the persisted envelope until it shows up. The persist
 * middleware flushes asynchronously (it's debounced), so callers that need
 * to assert against localStorage have to wait.
 */
async function waitForPersisted(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (readPersisted() != null) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

/**
 * Reset the Stage 1 wizard state to its empty defaults. Keeps the
 * legacy kit-configurator fields (`active`, `dismissed`, `stepIndex`,
 * legacy `selections`) and the `wizardEnabled` feature flag as-is so
 * each test starts from a known clean Stage 1 baseline without
 * disturbing the other slices.
 */
function resetStage1Wizard(): void {
  useAppStore.setState({
    wizard: {
      ...DEFAULT_WIZARD_STATE,
      selections: { ...DEFAULT_WIZARD_STATE.selections },
      stage1Selections: { ...DEFAULT_STAGE1_WIZARD_SELECTIONS },
    },
    wizardEnabled: false,
  })
}

describe('appStore Stage 1 Configuration Wizard — defaults', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage1Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('default Stage 1 wizard state has the contract shape (empty branch, step 0, no selections, no history)', () => {
    const { wizard, wizardEnabled } = useAppStore.getState()
    expect(wizard.branch).toBeNull()
    expect(wizard.currentStep).toBe(0)
    expect(wizard.stage1Selections).toEqual({})
    expect(wizard.stepHistory).toEqual([])
    // Feature flag defaults to off (opt-in).
    expect(wizardEnabled).toBe(false)
  })

  it('legacy kit-configurator fields are still present (active=false, dismissed=false, stepIndex=0, selections=arrays)', () => {
    // The legacy multi-select kit configurator (FirstTimerGuide backing
    // store) is kept intact while the §8.6 deprecation lands. This
    // test pins the contract so a future refactor doesn't silently
    // drop the old fields.
    const { wizard } = useAppStore.getState()
    expect(wizard.active).toBe(false)
    expect(wizard.dismissed).toBe(false)
    expect(wizard.stepIndex).toBe(0)
    expect(wizard.selections).toEqual({
      equipment: [],
      decarbMethodIds: [],
      fatIds: [],
      formatIds: [],
    })
  })
})

describe('appStore Stage 1 Configuration Wizard — actions', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage1Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('setProductType sets the branch and resets the rest of the Stage 1 state', () => {
    // Pre-populate some state to verify setProductType resets it.
    const { setSelection, nextStep } = useAppStore.getState()
    setSelection('method', 'oven_sealed')
    nextStep()
    nextStep()
    expect(useAppStore.getState().wizard.currentStep).toBe(2)
    expect(useAppStore.getState().wizard.stage1Selections.method).toBe(
      'oven_sealed'
    )

    useAppStore.getState().setProductType('edible')

    const w = useAppStore.getState().wizard
    expect(w.branch).toBe('edible')
    expect(w.currentStep).toBe(0)
    expect(w.stage1Selections).toEqual({})
    expect(w.stepHistory).toEqual([])
  })

  it('setSelection writes a single Stage 1 selection key (string value)', () => {
    useAppStore.getState().setSelection('method', 'sv_combined')
    expect(useAppStore.getState().wizard.stage1Selections.method).toBe(
      'sv_combined'
    )
  })

  it('setSelection writes a nested-object value (weight with unit)', () => {
    // Per §3.3, `weight` is `{ value: number; unit: 'g' | 'oz' }` — a
    // nested object, not a scalar. The setter must not flatten or
    // transform it.
    useAppStore
      .getState()
      .setSelection('weight', { value: 28, unit: 'g' })

    expect(useAppStore.getState().wizard.stage1Selections.weight).toEqual({
      value: 28,
      unit: 'g',
    })
  })

  it('setSelection with undefined clears the key', () => {
    const { setSelection } = useAppStore.getState()
    setSelection('method', 'oven_sealed')
    expect(useAppStore.getState().wizard.stage1Selections.method).toBe(
      'oven_sealed'
    )

    setSelection('method', undefined)
    expect(
      useAppStore.getState().wizard.stage1Selections.method
    ).toBeUndefined()
    // Other keys are untouched.
    expect(useAppStore.getState().wizard.stage1Selections).toEqual({})
  })

  it('setSelection is a no-op when the new value === the existing value (no spurious persist flush)', () => {
    const { setSelection } = useAppStore.getState()
    setSelection('method', 'oven_sealed')
    const selectionsBefore = useAppStore.getState().wizard.stage1Selections

    setSelection('method', 'oven_sealed') // same value
    const selectionsAfter = useAppStore.getState().wizard.stage1Selections

    // The reference may differ (Zustand always returns a new state
    // object) but the deep value is the same — and the store
    // returned an empty patch from the setter, which is what the
    // no-op contract means. The deep-equal check pins the contract.
    expect(selectionsAfter).toEqual(selectionsBefore)
  })

  it('nextStep pushes the current step onto history and increments currentStep', () => {
    useAppStore.getState().nextStep()
    let w = useAppStore.getState().wizard
    expect(w.currentStep).toBe(1)
    expect(w.stepHistory).toEqual([0])

    useAppStore.getState().nextStep()
    w = useAppStore.getState().wizard
    expect(w.currentStep).toBe(2)
    expect(w.stepHistory).toEqual([0, 1])
  })

  it('prevStep pops the head of stepHistory and restores currentStep', () => {
    const { nextStep, prevStep } = useAppStore.getState()
    nextStep()
    nextStep()
    nextStep()
    expect(useAppStore.getState().wizard.currentStep).toBe(3)
    expect(useAppStore.getState().wizard.stepHistory).toEqual([0, 1, 2])

    prevStep()
    let w = useAppStore.getState().wizard
    expect(w.currentStep).toBe(2)
    expect(w.stepHistory).toEqual([0, 1])

    prevStep()
    w = useAppStore.getState().wizard
    expect(w.currentStep).toBe(1)
    expect(w.stepHistory).toEqual([0])
  })

  it('prevStep is a no-op when stepHistory is empty (already at step 0)', () => {
    // We start at step 0 with an empty history.
    expect(useAppStore.getState().wizard.currentStep).toBe(0)
    expect(useAppStore.getState().wizard.stepHistory).toEqual([])

    useAppStore.getState().prevStep()

    // State is unchanged.
    expect(useAppStore.getState().wizard.currentStep).toBe(0)
    expect(useAppStore.getState().wizard.stepHistory).toEqual([])
  })

  it('resetWizard clears branch, currentStep, stage1Selections, and stepHistory', () => {
    const { setProductType, setSelection, nextStep, resetWizard } =
      useAppStore.getState()
    setProductType('flower')
    setSelection('method', 'oven_sealed')
    nextStep()
    nextStep()
    expect(useAppStore.getState().wizard.branch).toBe('flower')
    expect(useAppStore.getState().wizard.currentStep).toBe(2)
    expect(
      useAppStore.getState().wizard.stage1Selections.method
    ).toBe('oven_sealed')

    resetWizard()

    const w = useAppStore.getState().wizard
    expect(w.branch).toBeNull()
    expect(w.currentStep).toBe(0)
    expect(w.stage1Selections).toEqual({})
    expect(w.stepHistory).toEqual([])
  })

  it('resetWizard keeps the legacy kit-configurator fields and wizardEnabled flag intact', () => {
    // Pre-populate the legacy fields + the feature flag.
    useAppStore.setState({
      wizard: {
        ...useAppStore.getState().wizard,
        active: true,
        dismissed: true,
        stepIndex: 4,
        selections: {
          equipment: ['Cannabis flower'],
          decarbMethodIds: ['oven_sealed'],
          fatIds: [],
          formatIds: [],
        },
        branch: 'flower',
        currentStep: 3,
        stage1Selections: { method: 'oven_sealed' },
        stepHistory: [0, 1, 2],
      },
      wizardEnabled: true,
    })

    useAppStore.getState().resetWizard()

    const s = useAppStore.getState()
    // Stage 1 fields are reset.
    expect(s.wizard.branch).toBeNull()
    expect(s.wizard.currentStep).toBe(0)
    expect(s.wizard.stage1Selections).toEqual({})
    expect(s.wizard.stepHistory).toEqual([])
    // Legacy fields are preserved.
    expect(s.wizard.active).toBe(true)
    expect(s.wizard.dismissed).toBe(true)
    expect(s.wizard.stepIndex).toBe(4)
    expect(s.wizard.selections.equipment).toEqual(['Cannabis flower'])
    expect(s.wizard.selections.decarbMethodIds).toEqual(['oven_sealed'])
    // Feature flag is preserved.
    expect(s.wizardEnabled).toBe(true)
  })

  it('setWizardEnabled flips the feature flag on and off', () => {
    expect(useAppStore.getState().wizardEnabled).toBe(false)
    useAppStore.getState().setWizardEnabled(true)
    expect(useAppStore.getState().wizardEnabled).toBe(true)
    useAppStore.getState().setWizardEnabled(false)
    expect(useAppStore.getState().wizardEnabled).toBe(false)
  })

  it('setWizardEnabled is a no-op when the new value === the existing value', () => {
    useAppStore.getState().setWizardEnabled(true)
    const before = useAppStore.getState().wizardEnabled
    useAppStore.getState().setWizardEnabled(true) // same value
    const after = useAppStore.getState().wizardEnabled
    expect(after).toBe(before)
    expect(after).toBe(true)
  })
})

describe('appStore Stage 1 Configuration Wizard — persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage1Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('partialize persists the Stage 1 fields (branch, currentStep, stage1Selections, stepHistory) and the wizardEnabled flag', async () => {
    useAppStore.getState().setWizardEnabled(true)
    useAppStore.getState().setProductType('concentrate')
    useAppStore.getState().setSelection('potency', 78)
    useAppStore.getState().nextStep()
    await waitForPersisted()

    const persisted = readPersisted()?.state
    expect(persisted).toBeDefined()
    const persistedWizard = persisted?.wizard as
      | Record<string, unknown>
      | undefined
    expect(persistedWizard).toMatchObject({
      branch: 'concentrate',
      currentStep: 1,
      stage1Selections: { potency: 78 },
      stepHistory: [0],
    })
    expect(persisted?.wizardEnabled).toBe(true)
  })

  it('version=8 is set on the persisted envelope (bumped in the 2026-07-26 wizard Week 1 commit)', async () => {
    useAppStore.getState().setProductType('avb')
    await waitForPersisted()
    expect(readPersisted()?.version).toBe(8)
  })

  it('round-trip: Stage 1 selections + branch survive reload', async () => {
    useAppStore.getState().setProductType('edible')
    useAppStore
      .getState()
      .setSelection('weight', { value: 14, unit: 'g' })
    useAppStore.getState().nextStep()
    useAppStore.getState().setSelection('fat', 'coconut')
    await waitForPersisted()

    // Simulate a reload.
    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.branch).toBe('edible')
    expect(w.currentStep).toBe(1)
    expect(w.stage1Selections.weight).toEqual({ value: 14, unit: 'g' })
    expect(w.stage1Selections.fat).toBe('coconut')
    expect(w.stepHistory).toEqual([0])
  })

  it('round-trip: wizardEnabled=true survives reload', async () => {
    useAppStore.getState().setWizardEnabled(true)
    await waitForPersisted()

    await useAppStore.persist.rehydrate()
    expect(useAppStore.getState().wizardEnabled).toBe(true)
  })
})

describe('appStore Stage 1 Configuration Wizard — v7→v8 migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('legacy v7 envelope with firstTimerOpen drops cleanly to v8', async () => {
    // Simulate a v7 envelope: has the legacy `firstTimerOpen` field
    // (already collapsed by the v4→v7 migration, but defensively
    // present on a hand-rolled v7 snapshot), the wizard slice in its
    // v7 shape (active/dismissed/stepIndex/selections), and NO Stage 1
    // fields. The v7→v8 migration must drop `firstTimerOpen` (no-op
    // since the v4→v7 already did, but defensive) and initialize the
    // Stage 1 fields to clean empty defaults.
    const v7Envelope = {
      state: {
        firstRunDismissed: false,
        firstTimerOpen: false, // legacy alias from before F2.4
        wizard: {
          active: false,
          dismissed: false,
          stepIndex: 0,
          selections: {
            equipment: [],
            decarbMethodIds: [],
            fatIds: [],
            formatIds: [],
          },
        },
      },
      version: 7,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v7Envelope))

    await useAppStore.persist.rehydrate()

    const persisted = readPersisted()?.state as Record<string, unknown>
    // The legacy `firstTimerOpen` is gone.
    expect(persisted.firstTimerOpen).toBeUndefined()
    // The Stage 1 fields are initialized in the persisted envelope.
    const persistedWizard = persisted.wizard as Record<string, unknown>
    expect(persistedWizard.branch).toBeNull()
    expect(persistedWizard.currentStep).toBe(0)
    expect(persistedWizard.stage1Selections).toEqual({})
    expect(persistedWizard.stepHistory).toEqual([])
    // The top-level wizardEnabled flag is initialized to false.
    expect(persisted.wizardEnabled).toBe(false)
    // Runtime-only legacy fields (`active`, `stepIndex`) are NOT in
    // the persisted envelope — they're session-only by partialize
    // design. Read them from the rehydrated store state instead.
    const w = useAppStore.getState().wizard
    expect(w.active).toBe(false)
    expect(w.dismissed).toBe(false)
    expect(w.stepIndex).toBe(0)
  })

  it('v7→v8 migration is idempotent (running twice on a v8 envelope is a no-op)', async () => {
    // First rehydrate: v7 → v8.
    const v7Envelope = {
      state: {
        firstRunDismissed: true,
        wizard: {
          active: false,
          dismissed: true,
          stepIndex: 2,
          selections: {
            equipment: ['Cannabis flower'],
            decarbMethodIds: ['oven_sealed'],
            fatIds: [],
            formatIds: [],
          },
        },
      },
      version: 7,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v7Envelope))

    await useAppStore.persist.rehydrate()

    // Snapshot the migrated envelope.
    const migrated = readPersisted()
    expect(migrated?.version).toBe(8)
    const migratedState = migrated?.state as Record<string, unknown>
    const migratedWizard = migratedState.wizard as Record<string, unknown>
    expect(migratedWizard.branch).toBeNull()
    expect(migratedWizard.currentStep).toBe(0)
    expect(migratedWizard.stage1Selections).toEqual({})
    expect(migratedWizard.stepHistory).toEqual([])
    expect(migratedState.wizardEnabled).toBe(false)

    // Second rehydrate: already-v8 envelope. Migration is a no-op
    // — the Stage 1 fields stay at their v8 defaults, the legacy
    // fields stay intact.
    await useAppStore.persist.rehydrate()

    const rehydrated = readPersisted()
    const rehydratedWizard = (rehydrated?.state as Record<string, unknown>)
      .wizard as Record<string, unknown>
    expect(rehydratedWizard.branch).toBeNull()
    expect(rehydratedWizard.currentStep).toBe(0)
    expect(rehydratedWizard.stage1Selections).toEqual({})
    expect(rehydratedWizard.stepHistory).toEqual([])
    // Legacy fields preserved across the idempotent re-run.
    // `dismissed` is persisted; `stepIndex` is runtime-only and
    // resets to 0 on every rehydrate (session-only by partialize
    // design — same as `active`). Read the runtime value from the
    // store state, not the persisted envelope.
    expect(rehydratedWizard.dismissed).toBe(true)
    expect(useAppStore.getState().wizard.stepIndex).toBe(0)
  })

  it('v7→v8 migration coerces invalid Stage 1 values to defaults (defensive)', async () => {
    // A hand-rolled v7 envelope with invalid Stage 1 values (e.g.
    // `branch: 'banana'`, `currentStep: -3`, `stage1Selections: 'not-an-object'`).
    // The migration must coerce these to the clean empty defaults
    // rather than propagate the corruption.
    const corruptEnvelope = {
      state: {
        wizard: {
          active: false,
          dismissed: false,
          stepIndex: 0,
          selections: {
            equipment: [],
            decarbMethodIds: [],
            fatIds: [],
            formatIds: [],
          },
          branch: 'banana', // invalid ProductType
          currentStep: -3, // negative integer
          stage1Selections: 'not-an-object', // wrong shape
          stepHistory: 'not-an-array', // wrong shape
        },
        wizardEnabled: 'not-a-boolean', // wrong type
      },
      version: 7,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptEnvelope))

    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.branch).toBeNull()
    expect(w.currentStep).toBe(0)
    expect(w.stage1Selections).toEqual({})
    expect(w.stepHistory).toEqual([])
    expect(useAppStore.getState().wizardEnabled).toBe(false)
  })

  it('v7→v8 migration preserves a valid Stage 1 branch written by a future build', async () => {
    // A hand-rolled v8 envelope (simulating a build that beat the
    // migration) with valid Stage 1 values. The migration must
    // preserve them — the migration only writes defaults when a
    // field is missing or invalid, never overwriting valid data.
    const futureV8Envelope = {
      state: {
        wizard: {
          active: false,
          dismissed: false,
          stepIndex: 0,
          selections: {
            equipment: [],
            decarbMethodIds: [],
            fatIds: [],
            formatIds: [],
          },
          branch: 'topical',
          currentStep: 2,
          stage1Selections: { carrier: 'aloe-vera' },
          stepHistory: [0, 1],
        },
        wizardEnabled: true,
      },
      version: 7, // pre-migration, but with v8-shaped state
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(futureV8Envelope))

    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.branch).toBe('topical')
    expect(w.currentStep).toBe(2)
    expect(w.stage1Selections).toEqual({ carrier: 'aloe-vera' })
    expect(w.stepHistory).toEqual([0, 1])
    expect(useAppStore.getState().wizardEnabled).toBe(true)
  })
})

/**
 * Stage 2 Execution stepper (Week 3, 2026-07-26 wizard build).
 *
 * The Stage 2 slice lives on `wizard.execution` and is ephemeral
 * by design — it is NOT persisted (see `partialize` in appStore.ts
 * + the `merge` block that defensively drops any stale `execution`
 * key from a rehydrated envelope). The tests below cover:
 *
 *  - default shape
 *  - `beginExecution` (transition to Stage 2)
 *  - `completeExecutionStep` (mark current step done, advance)
 *  - `completeExecutionStep` no-op when stepId !== currentStepId
 *  - `skipExecutionStep` (skip current step, advance)
 *  - `returnToConfig` (Stage 2 → Stage 1, preserve Stage 1 selections)
 *  - `resetWizard` clears `execution` too
 *  - `execution` is NOT in the persisted envelope (after a
 *    beginExecution + persist flush + rehydrate, the new store
 *    instance has `execution` as empty defaults)
 *
 * The reset helper below mirrors the Stage 1 `resetStage1Wizard`
 * helper but also resets `execution` so each test starts from the
 * canonical "Stage 1 + Stage 2 both empty" baseline.
 */
function resetStage2Wizard(): void {
  useAppStore.setState({
    wizard: {
      ...DEFAULT_WIZARD_STATE,
      selections: { ...DEFAULT_WIZARD_STATE.selections },
      stage1Selections: { ...DEFAULT_STAGE1_WIZARD_SELECTIONS },
      execution: { ...DEFAULT_EXECUTION_STEP_STATE },
    },
    wizardEnabled: false,
  })
}

describe('appStore Stage 2 Execution stepper — Week 3', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage2Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('default `execution` shape is { currentStepId: null, completedStepIds: [], skippedStepIds: [] }', () => {
    const { execution } = useAppStore.getState().wizard
    expect(execution).toEqual({
      currentStepId: null,
      completedStepIds: [],
      skippedStepIds: [],
    })
    // Pin the contract via the exported default — a future refactor
    // that drifts the literal defaults would break this test.
    expect(execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
  })

  it('beginExecution("step-a") sets currentStepId and clears the lists', () => {
    useAppStore.getState().beginExecution('step-a')
    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-a')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('beginExecution("") is a no-op (defensive guard against malformed dispatch)', () => {
    // Pre-populate some state to verify the empty-string dispatch
    // does NOT overwrite the existing execution.
    useAppStore.getState().beginExecution('step-a')
    expect(useAppStore.getState().wizard.execution.currentStepId).toBe('step-a')

    useAppStore.getState().beginExecution('')

    // State is unchanged.
    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-a')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('completeExecutionStep advances to nextStepId and appends stepId to completedStepIds', () => {
    const { beginExecution, completeExecutionStep } = useAppStore.getState()
    beginExecution('step-a')
    completeExecutionStep('step-a', 'step-b')

    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-b')
    expect(execution.completedStepIds).toEqual(['step-a'])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('completeExecutionStep is a no-op if currentStepId !== stepId', () => {
    // Pre-populate the store with a different current step.
    useAppStore.getState().beginExecution('step-z')
    // Attempt to complete 'step-a' when 'step-z' is the current step.
    useAppStore.getState().completeExecutionStep('step-a', 'step-b')

    const { execution } = useAppStore.getState().wizard
    // No advancement, no append.
    expect(execution.currentStepId).toBe('step-z')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('completeExecutionStep accumulates across multiple steps (ordered)', () => {
    const { beginExecution, completeExecutionStep } = useAppStore.getState()
    beginExecution('step-a')
    completeExecutionStep('step-a', 'step-b')
    completeExecutionStep('step-b', 'step-c')
    completeExecutionStep('step-c', 'step-d')

    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-d')
    expect(execution.completedStepIds).toEqual(['step-a', 'step-b', 'step-c'])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('skipExecutionStep advances to nextStepId and appends stepId to skippedStepIds', () => {
    const { beginExecution, skipExecutionStep } = useAppStore.getState()
    beginExecution('step-a')
    skipExecutionStep('step-a', 'step-b')

    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-b')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual(['step-a'])
  })

  it('skipExecutionStep is a no-op if currentStepId !== stepId (same guard as complete)', () => {
    useAppStore.getState().beginExecution('step-z')
    useAppStore.getState().skipExecutionStep('step-a', 'step-b')

    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-z')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('skip and complete populate independent lists when interleaved', () => {
    // Documents the intended behavior: a step is either completed
    // OR skipped, never both. The lists are independent so the
    // UI can render "✓ done" and "↷ skipped" badges distinctly.
    const { beginExecution, completeExecutionStep, skipExecutionStep } =
      useAppStore.getState()
    beginExecution('step-a')
    completeExecutionStep('step-a', 'step-b')
    skipExecutionStep('step-b', 'step-c')
    completeExecutionStep('step-c', 'step-d')

    const { execution } = useAppStore.getState().wizard
    expect(execution.currentStepId).toBe('step-d')
    expect(execution.completedStepIds).toEqual(['step-a', 'step-c'])
    expect(execution.skippedStepIds).toEqual(['step-b'])
  })

  it('returnToConfig resets execution to empty defaults, preserves Stage 1 selections', () => {
    // Set up a non-trivial Stage 1 + Stage 2 state.
    const {
      setProductType,
      setSelection,
      nextStep,
      beginExecution,
      completeExecutionStep,
      returnToConfig,
    } = useAppStore.getState()
    setProductType('edible')
    setSelection('weight', { value: 14, unit: 'g' })
    nextStep()
    beginExecution('preheat')
    completeExecutionStep('preheat', 'timer')

    // Sanity-check preconditions.
    let w = useAppStore.getState().wizard
    expect(w.branch).toBe('edible')
    expect(w.currentStep).toBe(1)
    expect(w.stage1Selections.weight).toEqual({ value: 14, unit: 'g' })
    expect(w.execution.currentStepId).toBe('timer')
    expect(w.execution.completedStepIds).toEqual(['preheat'])

    returnToConfig()

    w = useAppStore.getState().wizard
    // Stage 2 is fully reset.
    expect(w.execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    // Stage 1 selections are preserved.
    expect(w.branch).toBe('edible')
    expect(w.currentStep).toBe(1)
    expect(w.stage1Selections.weight).toEqual({ value: 14, unit: 'g' })
    expect(w.stepHistory).toEqual([0])
  })

  it('resetWizard resets execution to empty defaults', () => {
    const {
      setProductType,
      beginExecution,
      completeExecutionStep,
      resetWizard,
    } = useAppStore.getState()
    setProductType('flower')
    beginExecution('preheat')
    completeExecutionStep('preheat', 'timer')

    // Sanity-check preconditions.
    expect(useAppStore.getState().wizard.execution.currentStepId).toBe('timer')
    expect(useAppStore.getState().wizard.execution.completedStepIds).toEqual([
      'preheat',
    ])

    resetWizard()

    const w = useAppStore.getState().wizard
    expect(w.execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    // Stage 1 fields are also reset (the existing contract).
    expect(w.branch).toBeNull()
    expect(w.currentStep).toBe(0)
    expect(w.stage1Selections).toEqual({})
    expect(w.stepHistory).toEqual([])
  })

  it('resetWizard keeps the legacy kit-configurator fields and wizardEnabled flag intact (Stage 2 parallel)', () => {
    // Pre-populate the legacy fields + the feature flag + a
    // half-finished Stage 2 execution.
    useAppStore.setState({
      wizard: {
        ...useAppStore.getState().wizard,
        active: true,
        dismissed: true,
        stepIndex: 2,
        selections: {
          equipment: ['Cannabis flower'],
          decarbMethodIds: ['oven_sealed'],
          fatIds: [],
          formatIds: [],
        },
        branch: 'flower',
        currentStep: 3,
        stage1Selections: { method: 'oven_sealed' },
        stepHistory: [0, 1, 2],
        execution: {
          currentStepId: 'timer',
          completedStepIds: ['preheat'],
          skippedStepIds: [],
        },
      },
      wizardEnabled: true,
    })

    useAppStore.getState().resetWizard()

    const s = useAppStore.getState()
    // Stage 2 is reset.
    expect(s.wizard.execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    // Stage 1 fields are reset.
    expect(s.wizard.branch).toBeNull()
    expect(s.wizard.currentStep).toBe(0)
    expect(s.wizard.stage1Selections).toEqual({})
    expect(s.wizard.stepHistory).toEqual([])
    // Legacy fields are preserved.
    expect(s.wizard.active).toBe(true)
    expect(s.wizard.dismissed).toBe(true)
    expect(s.wizard.stepIndex).toBe(2)
    expect(s.wizard.selections.equipment).toEqual(['Cannabis flower'])
    // Feature flag is preserved.
    expect(s.wizardEnabled).toBe(true)
  })
})

describe('appStore Stage 2 Execution stepper — persistence (Week 3)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage2Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('partialize does NOT persist `execution` — after beginExecution + persist flush, the envelope has no execution key', async () => {
    // Set up Stage 1 + Stage 2 state, then flush to localStorage.
    const { setProductType, beginExecution, completeExecutionStep } =
      useAppStore.getState()
    setProductType('flower')
    beginExecution('preheat')
    completeExecutionStep('preheat', 'timer')
    await waitForPersisted()

    const persistedWizard = readPersisted()?.state?.wizard as
      | Record<string, unknown>
      | undefined
    expect(persistedWizard).toBeDefined()
    // The wizard envelope has the Stage 1 fields, the legacy
    // dismissed flag, and the legacy selections — but NO
    // `execution` key. Stage 2 is ephemeral by design.
    expect(persistedWizard).toMatchObject({
      branch: 'flower',
      currentStep: 0,
      stage1Selections: {},
      stepHistory: [],
    })
    expect(persistedWizard).not.toHaveProperty('execution')
  })

  it('execution is NOT in the persisted envelope (after beginExecution + re-init, execution is empty defaults)', async () => {
    // Stage 2 → push it into a non-default state, then flush.
    const { beginExecution, completeExecutionStep } = useAppStore.getState()
    beginExecution('preheat')
    completeExecutionStep('preheat', 'timer')
    expect(useAppStore.getState().wizard.execution.currentStepId).toBe('timer')
    await waitForPersisted()

    // Re-read from localStorage and confirm the envelope has no
    // `execution` key — Stage 2 is ephemeral and should not
    // survive a reload even within the same browser tab.
    const persisted = readPersisted()?.state as Record<string, unknown>
    const persistedWizard = persisted.wizard as Record<string, unknown>
    expect(persistedWizard.execution).toBeUndefined()

    // Simulate a full reload by rehydrating. The store is a
    // singleton (it stays the same instance), so rehydrate
    // re-runs the merge function with the persisted envelope.
    // After rehydrate, the `execution` slice on the live store
    // must be the empty default — NOT the pre-reload 'timer'
    // / ['preheat'] state.
    await useAppStore.persist.rehydrate()
    const rehydrated = useAppStore.getState().wizard.execution
    expect(rehydrated).toEqual(DEFAULT_EXECUTION_STEP_STATE)
  })

  it('merge defensively drops a stale `execution` key from a hand-rolled v8 envelope (defensive against future regressions)', async () => {
    // A hand-rolled v8 envelope that has a stale `execution`
    // key — simulating a future build that regressed on the
    // not-persisted contract, or a test fixture that wrote
    // `execution` by accident. The merge function must drop
    // the stale key and seed the runtime default.
    const handRolledV8 = {
      state: {
        wizard: {
          active: false,
          dismissed: false,
          stepIndex: 0,
          selections: {
            equipment: [],
            decarbMethodIds: [],
            fatIds: [],
            formatIds: [],
          },
          branch: 'flower',
          currentStep: 2,
          stage1Selections: { method: 'oven_sealed' },
          stepHistory: [0, 1],
          // Stale `execution` key — should be dropped on
          // rehydrate by the `merge` function.
          execution: {
            currentStepId: 'stale-timer',
            completedStepIds: ['stale-preheat'],
            skippedStepIds: ['stale-skipped'],
          },
        },
        wizardEnabled: false,
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(handRolledV8))

    await useAppStore.persist.rehydrate()

    // Stage 1 fields are preserved (valid v8 data).
    const w = useAppStore.getState().wizard
    expect(w.branch).toBe('flower')
    expect(w.currentStep).toBe(2)
    expect(w.stage1Selections).toEqual({ method: 'oven_sealed' })
    expect(w.stepHistory).toEqual([0, 1])
    // The stale `execution` key was dropped — runtime is the
    // empty default, not the stale half-finished Stage 2 run.
    expect(w.execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
  })
})
