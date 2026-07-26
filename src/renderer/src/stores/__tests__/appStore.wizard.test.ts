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
// Bumped to v9 in the 2026-07-26 wizard Week 5 commit (Stage 2
// Recipes slice + `recipes[]` partialize + v8→v9 migration).
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

  it('version=9 is set on the persisted envelope (Week 1 bumped to v8, Week 5 bumped to v9)', async () => {
    // Week 1 (2026-07-26 wizard build) bumped the persist
    // version to v8 when it added the Stage 1 Configuration
    // Wizard slice + `wizardEnabled` feature flag. Week 5
    // (2026-07-26 wizard build, §8.2 + §8.5) bumped the
    // version to v9 when it added the Stage 2 Recipes slice
    // + `recipes[]` partialize + v8→v9 migration. The current
    // version is therefore 9.
    useAppStore.getState().setProductType('avb')
    await waitForPersisted()
    expect(readPersisted()?.version).toBe(9)
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

    // Snapshot the migrated envelope. The v7→v8 migration
    // brings the version to 8; a separate v8→v9 migration
    // (Week 5, §8.2) runs in the same `migrate` call and
    // brings the final version to 9. The chain is intentional
    // — see the migration block in appStore.ts.
    const migrated = readPersisted()
    expect(migrated?.version).toBe(9)
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

  it('default `execution` shape is { currentStepId: null, completedStepIds: [], skippedStepIds: [], isRecalculating: false, affectedStepIds: [] }', () => {
    // Week 4 (2026-07-26 wizard build, §8.1) added the two
    // recalculating fields to ExecutionStepState. The default
    // contract is the "Stage 2 has not been entered yet, no
    // re-edit in progress" shape.
    const { execution } = useAppStore.getState().wizard
    expect(execution).toEqual({
      currentStepId: null,
      completedStepIds: [],
      skippedStepIds: [],
      isRecalculating: false,
      affectedStepIds: [],
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
          // Week 4 (2026-07-26 wizard build, §8.1): the two
          // recalculating fields are seeded as defaults here so
          // the test exercises the reset path with a
          // fully-populated execution slice (the type now
          // requires them).
          isRecalculating: false,
          affectedStepIds: [],
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

/**
 * Stage 2 recalculating flag — Week 4 (2026-07-26 wizard build).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §8.1, the user can
 * re-edit a Stage 1 selection mid-batch and the engine recomputes
 * the totals. The stepper shows a "recalculating..." badge on
 * every step whose data is affected. The two fields
 * `isRecalculating` + `affectedStepIds` are the store-level
 * signal for that badge; the three actions
 * `markRecalculating` / `finishRecalculating` / `recomputeFromEdit`
 * are the surfaces the WizardScreen calls.
 *
 * The tests below cover:
 *  - the default shape includes both fields
 *  - `markRecalculating(['a', 'b'])` flips the flag on and stores
 *    the array
 *  - `markRecalculating([])` is valid (semantically "all steps
 *    affected" — the stepper's "all" logic is ui-tabs's scope)
 *  - `markRecalculating(['x'])` is a no-op when Stage 2 isn't
 *    active (defensive against `currentStepId === null`)
 *  - `finishRecalculating()` clears both fields
 *  - `finishRecalculating()` is a no-op when already false
 *  - `recomputeFromEdit(['a'])` flips the flags on then off in a
 *    single dispatch (final state is the empty defaults;
 *    intermediate on-state is reachable via a subscriber)
 *  - `recomputeFromEdit(['x'])` is a no-op when Stage 2 isn't
 *    active
 *  - `resetWizard()` and `returnToConfig()` both clear the new
 *    fields
 *  - the new fields are NOT in the persisted envelope (after a
 *    `markRecalculating` + persist flush + rehydrate, the runtime
 *    is the empty default — Stage 2 stays ephemeral)
 */
describe('appStore Stage 2 recalculating flag — Week 4', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStage2Wizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('default `execution` shape includes isRecalculating: false and affectedStepIds: []', () => {
    // Belt-and-suspenders: the Week 3 test on line 614 pins the
    // shape, but the Week 4 contract deserves its own pin so a
    // future engineer who lands Week 4 first (e.g. on a branch
    // cut before Week 3) gets a clear failure pointing at the
    // new fields.
    const { execution } = useAppStore.getState().wizard
    expect(execution.isRecalculating).toBe(false)
    expect(execution.affectedStepIds).toEqual([])
  })

  it('markRecalculating(["timer-decarb", "transition-decarb"]) sets isRecalculating: true and stores the array', () => {
    const { beginExecution, markRecalculating } = useAppStore.getState()
    beginExecution('preheat')
    // Pre-condition: not recalculating yet.
    expect(useAppStore.getState().wizard.execution.isRecalculating).toBe(false)

    markRecalculating(['timer-decarb', 'transition-decarb'])

    const { execution } = useAppStore.getState().wizard
    expect(execution.isRecalculating).toBe(true)
    expect(execution.affectedStepIds).toEqual([
      'timer-decarb',
      'transition-decarb',
    ])
    // The other Stage 2 fields are untouched — the recalculating
    // flag is an overlay, not a state transition.
    expect(execution.currentStepId).toBe('preheat')
    expect(execution.completedStepIds).toEqual([])
    expect(execution.skippedStepIds).toEqual([])
  })

  it('markRecalculating([]) is valid — empty array means "all steps affected" (stepper-side logic, not store-side)', () => {
    // The empty array is a valid input that semantically means
    // "every step in the visible list is affected". The store
    // just stores the array verbatim; the stepper (ui-tabs
    // scope) interprets an empty array as "broadcast the badge
    // to all rows". Verify the store contract: empty array is
    // accepted, no coercion, no defaulting.
    const { beginExecution, markRecalculating } = useAppStore.getState()
    beginExecution('preheat')

    markRecalculating([])

    const { execution } = useAppStore.getState().wizard
    expect(execution.isRecalculating).toBe(true)
    expect(execution.affectedStepIds).toEqual([])
  })

  it('markRecalculating is a no-op when currentStepId === null (Stage 2 not running)', () => {
    // Defensive guard: a stale dispatch from a UI bug that
    // forgot to beginExecution shouldn't put the wizard into a
    // half-initialized "recalculating" state. Pin the no-op
    // contract by snapshotting state before + after.
    const before = useAppStore.getState().wizard.execution
    expect(before.currentStepId).toBeNull()
    expect(before.isRecalculating).toBe(false)

    useAppStore.getState().markRecalculating(['timer-decarb'])

    const after = useAppStore.getState().wizard.execution
    expect(after.isRecalculating).toBe(false)
    expect(after.affectedStepIds).toEqual([])
    expect(after.currentStepId).toBeNull()
  })

  it('finishRecalculating() clears both fields (isRecalculating: false, affectedStepIds: [])', () => {
    const { beginExecution, markRecalculating, finishRecalculating } =
      useAppStore.getState()
    beginExecution('preheat')
    markRecalculating(['timer-decarb', 'transition-decarb'])
    // Pre-condition: recalculating with affected steps.
    let exec = useAppStore.getState().wizard.execution
    expect(exec.isRecalculating).toBe(true)
    expect(exec.affectedStepIds).toEqual(['timer-decarb', 'transition-decarb'])

    finishRecalculating()

    exec = useAppStore.getState().wizard.execution
    expect(exec.isRecalculating).toBe(false)
    expect(exec.affectedStepIds).toEqual([])
    // Stage 2 itself is still active (finishRecalculating only
    // clears the badge, not the stepper state).
    expect(exec.currentStepId).toBe('preheat')
  })

  it('finishRecalculating() is a no-op when isRecalculating is already false (idempotent)', () => {
    // Idempotency contract: calling finish on a stable stepper
    // must not trigger a spurious re-render that could flicker
    // the badge. The action returns an empty patch from the
    // setter (no state change), so subscribers shouldn't fire.
    // The deep-equal check on the execution slice is the
    // observable proxy for "no state change".
    const { beginExecution, finishRecalculating } = useAppStore.getState()
    beginExecution('preheat')
    const before = useAppStore.getState().wizard.execution
    expect(before.isRecalculating).toBe(false)

    finishRecalculating()

    const after = useAppStore.getState().wizard.execution
    expect(after).toEqual(before)
  })

  it('recomputeFromEdit(["timer-decarb"]) flips the flags on then off in a single dispatch (final state: defaults)', () => {
    // The Week 4 contract: `recomputeFromEdit` is a single
    // dispatch that flips the flag on (synchronous set #1) and
    // then off (synchronous set #2) so the stepper shows a
    // brief "recalculating..." flash. The final state is the
    // empty defaults — the recompute itself is a no-op at the
    // store level (the engine recomputes, not the store). A
    // subscriber listening to the store can capture the
    // intermediate on-state.
    const { beginExecution, recomputeFromEdit } = useAppStore.getState()
    beginExecution('preheat')

    // Capture intermediate states via a subscriber. Zustand
    // subscribers fire synchronously after each `set()` call,
    // so between the two writes inside `recomputeFromEdit`
    // we'll see `isRecalculating: true` exactly once.
    const seenIsRecalculating: boolean[] = []
    const unsub = useAppStore.subscribe(state => {
      seenIsRecalculating.push(state.wizard.execution.isRecalculating)
    })

    recomputeFromEdit(['timer-decarb'])

    unsub()

    // Final state: empty defaults.
    const { execution } = useAppStore.getState().wizard
    expect(execution.isRecalculating).toBe(false)
    expect(execution.affectedStepIds).toEqual([])

    // Intermediate on-state was reachable: the subscriber saw
    // the `true` transition between the two synchronous set
    // calls. (If a future refactor makes the two writes async
    // — e.g. swapping the synchronous pattern for a debounced
    // one in Week 7 — this assertion will fail loudly, which
    // is the right signal to update the test contract.)
    expect(seenIsRecalculating).toContain(true)
  })

  it('recomputeFromEdit is a no-op when currentStepId === null (Stage 2 not running)', () => {
    // Defensive: a stale dispatch from a UI bug must not put
    // the wizard into a "recalculating" state if Stage 2
    // hasn't started. The two synchronous set() calls inside
    // recomputeFromEdit each guard on currentStepId === null,
    // so the action as a whole is a no-op.
    const before = useAppStore.getState().wizard.execution
    expect(before.currentStepId).toBeNull()

    useAppStore.getState().recomputeFromEdit(['timer-decarb'])

    const after = useAppStore.getState().wizard.execution
    expect(after.isRecalculating).toBe(false)
    expect(after.affectedStepIds).toEqual([])
    expect(after.currentStepId).toBeNull()
  })

  it('resetWizard() clears isRecalculating and affectedStepIds along with the rest of execution', () => {
    // Set up a "recalculating in progress" state.
    const { beginExecution, markRecalculating, resetWizard } =
      useAppStore.getState()
    beginExecution('preheat')
    markRecalculating(['timer-decarb', 'transition-decarb'])
    let exec = useAppStore.getState().wizard.execution
    expect(exec.isRecalculating).toBe(true)
    expect(exec.affectedStepIds).toEqual(['timer-decarb', 'transition-decarb'])

    resetWizard()

    exec = useAppStore.getState().wizard.execution
    expect(exec).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    expect(exec.isRecalculating).toBe(false)
    expect(exec.affectedStepIds).toEqual([])
    expect(exec.currentStepId).toBeNull()
  })

  it('returnToConfig() clears isRecalculating and affectedStepIds along with the rest of execution', () => {
    // Set up a "recalculating in progress" state with Stage 1
    // selections populated, then return to Stage 1.
    const {
      setProductType,
      setSelection,
      beginExecution,
      markRecalculating,
      returnToConfig,
    } = useAppStore.getState()
    setProductType('flower')
    setSelection('method', 'oven_sealed')
    beginExecution('preheat')
    markRecalculating(['timer-decarb'])
    let exec = useAppStore.getState().wizard.execution
    expect(exec.isRecalculating).toBe(true)
    expect(exec.affectedStepIds).toEqual(['timer-decarb'])

    returnToConfig()

    exec = useAppStore.getState().wizard.execution
    expect(exec).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    expect(exec.isRecalculating).toBe(false)
    expect(exec.affectedStepIds).toEqual([])
    // Stage 1 selections are preserved (the existing returnToConfig contract).
    const w = useAppStore.getState().wizard
    expect(w.branch).toBe('flower')
    expect(w.stage1Selections.method).toBe('oven_sealed')
  })

  it('execution.isRecalculating and execution.affectedStepIds are NOT in the persisted envelope (Stage 2 stays ephemeral)', async () => {
    // Set up a non-default Stage 2 state, including the new
    // recalculating fields, flush to localStorage, then
    // rehydrate and verify the runtime is the empty default
    // — the new fields must NOT survive a reload, just like
    // the rest of the execution slice.
    const { beginExecution, markRecalculating } = useAppStore.getState()
    beginExecution('preheat')
    markRecalculating(['timer-decarb', 'transition-decarb'])
    // Sanity-check the pre-flush state.
    expect(useAppStore.getState().wizard.execution.isRecalculating).toBe(true)
    await waitForPersisted()

    // The persisted envelope has no `execution` key at all —
    // the partialize block doesn't write Stage 2 to disk.
    const persistedWizard = readPersisted()?.state?.wizard as
      | Record<string, unknown>
      | undefined
    expect(persistedWizard).toBeDefined()
    expect(persistedWizard).not.toHaveProperty('execution')

    // After rehydrate, the new fields are at their default
    // (empty) values, not the pre-flush "recalculating" state.
    // This is the Stage 2 ephemerality contract.
    await useAppStore.persist.rehydrate()
    const rehydrated = useAppStore.getState().wizard.execution
    expect(rehydrated).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    expect(rehydrated.isRecalculating).toBe(false)
    expect(rehydrated.affectedStepIds).toEqual([])
  })

  it('merge defensively drops a stale `execution.isRecalculating: true` from a hand-rolled v8 envelope', async () => {
    // A hand-rolled v8 envelope that has a stale
    // `isRecalculating: true` — simulating a future build
    // that regressed on the not-persisted contract, or a
    // test fixture that wrote `execution` by accident. The
    // merge function drops the whole `execution` slice on
    // rehydrate (Week 3) and reseeds it with the empty
    // default, so the new fields are covered automatically.
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
          currentStep: 0,
          stage1Selections: {},
          stepHistory: [],
          // Stale `execution` with the new recalculating fields
          // set to non-defaults. Should be dropped on rehydrate.
          execution: {
            currentStepId: 'preheat',
            completedStepIds: ['setup'],
            skippedStepIds: [],
            isRecalculating: true,
            affectedStepIds: ['timer-decarb', 'transition-decarb'],
          },
        },
        wizardEnabled: false,
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(handRolledV8))

    await useAppStore.persist.rehydrate()

    // The stale `execution` key was dropped — runtime is the
    // empty default, not the stale "recalculating" state.
    const w = useAppStore.getState().wizard
    expect(w.execution).toEqual(DEFAULT_EXECUTION_STEP_STATE)
    expect(w.execution.isRecalculating).toBe(false)
    expect(w.execution.affectedStepIds).toEqual([])
  })
})

/**
 * Stage 2 Recipes slice — Week 5 (2026-07-26 wizard build).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §8.2 + §8.5, every
 * completed Stage 2 batch writes a Recipe record. This is the
 * "repeatable workflow" promise — the user can look back at past
 * batches, compare results, see what worked. The store owns the
 * canonical record; the IDB mirror called out in §7 Week 5 is out
 * of scope for this commit (the localStorage write via `partialize`
 * is the canonical record; a future ui-tabs commit can wire the
 * IDB mirror as a separate write).
 *
 * The tests below cover:
 *  - default shape (`recipes: []`)
 *  - `addRecipe` returns a non-empty id and pushes a Recipe
 *  - `addRecipe` with a duplicate id is a no-op (existing entry
 *    preserved, same id returned)
 *  - `addRecipe` with explicit `id` and `createdAt` uses those
 *    values (so tests can pin assertions)
 *  - `renameRecipe(id, 'New name')` updates the name field
 *  - `renameRecipe('nonexistent-id', 'X')` is a no-op
 *  - `deleteRecipe(id)` removes the entry; subsequent `addRecipe`
 *    with the same id is allowed (the deleted slot is freed)
 *  - `deleteRecipe('nonexistent-id')` is a no-op
 *  - `setRecipeJournalEntry(recipeId, 'je-1')` patches
 *    `batchJournalEntryId`
 *  - `setRecipeJournalEntry('nonexistent-id', 'je-1')` is a no-op
 *  - the `recipes` slice IS in the persisted envelope (after
 *    `addRecipe` + persist flush + re-init, the new store
 *    instance sees the recipe)
 *  - the v8→v9 migration backfills `recipes: []` on a v8 envelope
 *  - the version is bumped to 9 on the persisted envelope
 */
describe('appStore recipes[] slice — Week 5', () => {
  beforeEach(() => {
    localStorage.clear()
    // The recipes slice lives at the top level, alongside the
    // other wizard-era slices. Reset the wizard too so each test
    // starts from a clean Stage 1 + Stage 2 baseline.
    useAppStore.setState({
      wizard: {
        ...DEFAULT_WIZARD_STATE,
        selections: { ...DEFAULT_WIZARD_STATE.selections },
        stage1Selections: { ...DEFAULT_STAGE1_WIZARD_SELECTIONS },
        execution: { ...DEFAULT_EXECUTION_STEP_STATE },
      },
      wizardEnabled: false,
      recipes: [],
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('default `recipes` shape is []', () => {
    // The canonical "no Recipes yet" baseline. Mirrors the
    // Stage 1 / Stage 2 default-shape pins.
    expect(useAppStore.getState().recipes).toEqual([])
  })

  it('addRecipe({ name, branch, selections }) returns a non-empty id and pushes a Recipe', () => {
    // The minimum shape the §8.2 / §8.5 spec demands:
    // `name` (user-supplied from NameRecipeStep), `branch` (the
    // Stage 1 product type), `selections` (the full Stage 1
    // selections). `batchJournalEntryId` is optional (defaults
    // to null until the "Save to Journal" flow links them).
    const { addRecipe } = useAppStore.getState()
    const id = addRecipe({
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    // id is a non-empty string.
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    // The Recipe is at the head of the list (newest-first).
    const recipes = useAppStore.getState().recipes
    expect(recipes).toHaveLength(1)
    expect(recipes[0]).toMatchObject({
      id,
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })
    // `createdAt` was auto-stamped as an ISO timestamp.
    expect(typeof recipes[0]?.createdAt).toBe('string')
    expect(recipes[0]?.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    )
  })

  it('addRecipe with a duplicate id is a no-op (existing entry preserved, same id returned)', () => {
    // The dedupe contract: a re-issue of the same id must not
    // corrupt the list. The linked JournalEntry flow chains
    // addJournalEntry + setRecipeJournalEntry; a re-issue
    // must be idempotent (the caller can safely call addRecipe
    // twice with the same id and the second call is a no-op).
    const { addRecipe } = useAppStore.getState()
    const firstId = addRecipe({
      id: 'recipe-1',
      name: 'Original name',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
      createdAt: '2026-07-26T10:00:00.000Z',
    })
    expect(firstId).toBe('recipe-1')
    expect(useAppStore.getState().recipes).toHaveLength(1)

    // Second add with the same id — must not append, must
    // preserve the original entry (so a "rename" via
    // overwrite doesn't happen by accident).
    const secondId = addRecipe({
      id: 'recipe-1',
      name: 'Different name that should be ignored',
      branch: 'concentrate',
      selections: { potency: 80 },
      batchJournalEntryId: 'je-99',
      createdAt: '2099-12-31T23:59:59.000Z',
    })

    // Same id returned (the existing one).
    expect(secondId).toBe('recipe-1')
    const recipes = useAppStore.getState().recipes
    expect(recipes).toHaveLength(1)
    // The original entry is preserved unchanged.
    expect(recipes[0]).toMatchObject({
      id: 'recipe-1',
      name: 'Original name',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
      createdAt: '2026-07-26T10:00:00.000Z',
    })
  })

  it('addRecipe with explicit id and createdAt uses those values (test fixture friendly)', () => {
    // The spec allows the caller to pass `id` + `createdAt`
    // explicitly (the Omit<Recipe, 'id' | 'createdAt'> &
    // { id?, createdAt? } pattern). Tests use this to pin
    // assertions against stable values.
    const { addRecipe } = useAppStore.getState()
    const id = addRecipe({
      id: 'fixed-id-123',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'Sleep edible',
      branch: 'edible',
      selections: { weight: { value: 14, unit: 'g' }, fat: 'coconut' },
      batchJournalEntryId: null,
    })

    expect(id).toBe('fixed-id-123')
    const recipes = useAppStore.getState().recipes
    expect(recipes[0]?.id).toBe('fixed-id-123')
    expect(recipes[0]?.createdAt).toBe('2026-07-26T10:00:00.000Z')
  })

  it('renameRecipe(id, "New name") updates the name field', () => {
    const { addRecipe, renameRecipe } = useAppStore.getState()
    const id = addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'Original name',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    renameRecipe(id, 'Renamed recipe')

    const recipe = useAppStore.getState().recipes[0]
    expect(recipe?.name).toBe('Renamed recipe')
    // Other fields are preserved.
    expect(recipe?.id).toBe('recipe-1')
    expect(recipe?.branch).toBe('flower')
    expect(recipe?.selections).toEqual({ method: 'oven_sealed' })
  })

  it('renameRecipe("nonexistent-id", "X") is a no-op', () => {
    const { addRecipe, renameRecipe } = useAppStore.getState()
    addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'Original name',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    // Snapshot the pre-state so we can deep-equal it after.
    const before = useAppStore.getState().recipes

    renameRecipe('nonexistent-id', 'X')

    const after = useAppStore.getState().recipes
    // The list is structurally identical — the no-op contract
    // means no spurious state mutation.
    expect(after).toEqual(before)
  })

  it('deleteRecipe(id) removes the entry; subsequent addRecipe with the same id is allowed', () => {
    const { addRecipe, deleteRecipe } = useAppStore.getState()
    addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'A',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })
    addRecipe({
      id: 'recipe-2',
      createdAt: '2026-07-26T10:01:00.000Z',
      name: 'B',
      branch: 'concentrate',
      selections: { potency: 80 },
      batchJournalEntryId: null,
    })
    expect(useAppStore.getState().recipes).toHaveLength(2)

    deleteRecipe('recipe-1')

    let recipes = useAppStore.getState().recipes
    expect(recipes).toHaveLength(1)
    expect(recipes[0]?.id).toBe('recipe-2')

    // The deleted slot is freed — a subsequent add with the
    // same id is allowed (the dedupe no-op is only against
    // EXISTING ids).
    const newId = addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:02:00.000Z',
      name: 'A (re-added)',
      branch: 'flower',
      selections: { method: 'sv_combined' },
      batchJournalEntryId: null,
    })
    expect(newId).toBe('recipe-1')
    recipes = useAppStore.getState().recipes
    expect(recipes).toHaveLength(2)
    expect(recipes[0]?.id).toBe('recipe-1')
    expect(recipes[0]?.name).toBe('A (re-added)')
  })

  it('deleteRecipe("nonexistent-id") is a no-op', () => {
    const { addRecipe, deleteRecipe } = useAppStore.getState()
    addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'A',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    const before = useAppStore.getState().recipes
    deleteRecipe('nonexistent-id')
    const after = useAppStore.getState().recipes

    expect(after).toEqual(before)
  })

  it('setRecipeJournalEntry(recipeId, "je-1") patches batchJournalEntryId', () => {
    const { addRecipe, setRecipeJournalEntry } = useAppStore.getState()
    const id = addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    setRecipeJournalEntry(id, 'je-1')

    const recipe = useAppStore.getState().recipes[0]
    expect(recipe?.batchJournalEntryId).toBe('je-1')
    // Other fields are preserved.
    expect(recipe?.id).toBe('recipe-1')
    expect(recipe?.name).toBe('Morning dose')
    expect(recipe?.selections).toEqual({ method: 'oven_sealed' })
  })

  it('setRecipeJournalEntry("nonexistent-id", "je-1") is a no-op', () => {
    const { addRecipe, setRecipeJournalEntry } = useAppStore.getState()
    addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'A',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })

    const before = useAppStore.getState().recipes
    setRecipeJournalEntry('nonexistent-id', 'je-1')
    const after = useAppStore.getState().recipes

    expect(after).toEqual(before)
  })
})

describe('appStore recipes[] slice — persistence (Week 5)', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      wizard: {
        ...DEFAULT_WIZARD_STATE,
        selections: { ...DEFAULT_WIZARD_STATE.selections },
        stage1Selections: { ...DEFAULT_STAGE1_WIZARD_SELECTIONS },
        execution: { ...DEFAULT_EXECUTION_STEP_STATE },
      },
      wizardEnabled: false,
      recipes: [],
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('partialize persists the `recipes` slice (after addRecipe + flush + re-init, the new instance sees the recipe)', async () => {
    // The persist roundtrip contract: the `recipes` slice is
    // in the persisted envelope, and a reload (simulated via
    // rehydrate) sees the same recipes on the live store.
    const { addRecipe } = useAppStore.getState()
    addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })
    await waitForPersisted()

    // The persisted envelope has the `recipes` slice at the
    // top level (alongside the other top-level slices, e.g.
    // `decarb`, `wizardEnabled`).
    const persisted = readPersisted()?.state
    expect(persisted).toBeDefined()
    const persistedRecipes = persisted?.recipes as
      | Array<Record<string, unknown>>
      | undefined
    expect(persistedRecipes).toBeDefined()
    expect(persistedRecipes).toHaveLength(1)
    expect(persistedRecipes?.[0]).toMatchObject({
      id: 'recipe-1',
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
      createdAt: '2026-07-26T10:00:00.000Z',
    })

    // Simulate a reload by rehydrating. The store is a
    // singleton (it stays the same instance), so rehydrate
    // re-runs the merge function with the persisted envelope.
    await useAppStore.persist.rehydrate()

    const rehydratedRecipes = useAppStore.getState().recipes
    expect(rehydratedRecipes).toHaveLength(1)
    expect(rehydratedRecipes[0]).toMatchObject({
      id: 'recipe-1',
      name: 'Morning dose',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
      createdAt: '2026-07-26T10:00:00.000Z',
    })
  })

  it('version=9 is set on the persisted envelope (bumped in the 2026-07-26 wizard Week 5 commit)', async () => {
    // Touch the store so the partialize runs at least once
    // (the persist middleware doesn't write an empty envelope
    // until something has actually changed).
    useAppStore.getState().addRecipe({
      id: 'recipe-1',
      createdAt: '2026-07-26T10:00:00.000Z',
      name: 'A',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })
    await waitForPersisted()
    expect(readPersisted()?.version).toBe(9)
  })
})

describe('appStore recipes[] slice — v8→v9 migration (Week 5)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('v8 envelope is migrated to v9 with recipes: [] backfilled', async () => {
    // A hand-rolled v8 envelope — no `recipes` key on the
    // top level. The v8→v9 migration backfills `recipes: []`
    // so consumers can rely on a present-but-default value
    // after a one-time upgrade.
    const v8Envelope = {
      state: {
        firstRunDismissed: false,
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
          currentStep: 1,
          stage1Selections: { method: 'oven_sealed' },
          stepHistory: [0],
        },
        wizardEnabled: false,
        // NO `recipes` key — the v9 backfill must stamp it.
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v8Envelope))

    await useAppStore.persist.rehydrate()

    // The live store has the empty Recipes array (the v9
    // default).
    expect(useAppStore.getState().recipes).toEqual([])

    // The persisted envelope has been migrated to v9 with
    // `recipes: []` on the top level.
    const persisted = readPersisted()
    expect(persisted?.version).toBe(9)
    const persistedState = persisted?.state as Record<string, unknown>
    expect(persistedState.recipes).toEqual([])
  })

  it('v8→v9 migration is idempotent (running twice on a v9 envelope is a no-op)', async () => {
    // First rehydrate: v8 → v9. The migration stamps
    // `recipes: []` on the envelope.
    const v8Envelope = {
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
          branch: 'concentrate',
          currentStep: 0,
          stage1Selections: {},
          stepHistory: [],
        },
        wizardEnabled: false,
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v8Envelope))

    await useAppStore.persist.rehydrate()

    // Sanity: v9 with empty recipes.
    expect(useAppStore.getState().recipes).toEqual([])

    // Second rehydrate: already-v9 envelope with `recipes: []`
    // stamped. The migration is a no-op (the `Array.isArray`
    // check passes on the second pass, so the spread-and-
    // default is skipped).
    await useAppStore.persist.rehydrate()

    const persisted = readPersisted()
    expect(persisted?.version).toBe(9)
    const persistedState = persisted?.state as Record<string, unknown>
    expect(persistedState.recipes).toEqual([])
    // Stage 1 fields are preserved across the idempotent
    // re-run (the v8→v9 migration doesn't touch the wizard
    // slice).
    const persistedWizard = persistedState.wizard as Record<string, unknown>
    expect(persistedWizard.branch).toBe('concentrate')
  })

  it('v8→v9 migration preserves a valid `recipes` array written by a future build', async () => {
    // A hand-rolled v8 envelope that already has a valid
    // `recipes` array (simulating a future build that beat
    // the migration, or a dev that wrote a Recipe through
    // some out-of-band mechanism). The migration must
    // preserve the array — it only writes the default
    // when the key is missing or invalid.
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
          branch: 'flower',
          currentStep: 0,
          stage1Selections: {},
          stepHistory: [],
        },
        wizardEnabled: false,
        // A valid `recipes` array — must be preserved.
        recipes: [
          {
            id: 'recipe-pre-existing',
            createdAt: '2026-07-25T09:00:00.000Z',
            name: 'Pre-existing recipe',
            branch: 'flower',
            selections: { method: 'oven_sealed' },
            batchJournalEntryId: 'je-pre-existing',
          },
        ],
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(futureV8Envelope))

    await useAppStore.persist.rehydrate()

    // The Recipe is preserved.
    const recipes = useAppStore.getState().recipes
    expect(recipes).toHaveLength(1)
    expect(recipes[0]).toMatchObject({
      id: 'recipe-pre-existing',
      name: 'Pre-existing recipe',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: 'je-pre-existing',
    })
  })

  it('merge defensively coerces a non-array `recipes` value to [] on a hand-rolled v8 envelope', async () => {
    // A hand-rolled v8 envelope that has a non-array
    // `recipes` value (e.g. a corrupted snapshot, a dev
    // that wrote `recipes: null` by accident). The merge
    // function must coerce to `[]` so a corrupted snapshot
    // can't sneak a non-array past the type system. The
    // v8→v9 migration is the canonical first-run backfill;
    // the merge coercion is the runtime defense.
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
          branch: 'flower',
          currentStep: 0,
          stage1Selections: {},
          stepHistory: [],
        },
        wizardEnabled: false,
        // Non-array value — must be coerced to [].
        recipes: 'not-an-array',
      },
      version: 8,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptEnvelope))

    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().recipes).toEqual([])
  })
})
