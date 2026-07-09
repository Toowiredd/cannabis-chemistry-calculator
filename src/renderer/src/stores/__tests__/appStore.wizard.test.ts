import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_WIZARD_STATE,
  useAppStore,
  type WizardSelections,
} from '../appStore'

const STORAGE_KEY = 'cannabis-chem-units'

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

function resetWizard(): void {
  useAppStore.setState({
    wizard: {
      ...DEFAULT_WIZARD_STATE,
      selections: {
        equipment: [],
        decarbMethodIds: [],
        fatIds: [],
        formatIds: [],
      },
    },
    firstRunDismissed: false,
    firstTimerOpen: false,
  })
}

describe('appStore wizard slice — setters', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('default wizard state has the contract shape (arrays initialised to [])', () => {
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

  it('setWizardActive updates wizard.active and the legacy firstTimerOpen alias', () => {
    useAppStore.getState().setWizardActive(true)
    expect(useAppStore.getState().wizard.active).toBe(true)
    expect(useAppStore.getState().firstTimerOpen).toBe(true)

    useAppStore.getState().setWizardActive(false)
    expect(useAppStore.getState().wizard.active).toBe(false)
    expect(useAppStore.getState().firstTimerOpen).toBe(false)
  })

  it('setFirstTimerOpen aliases setWizardActive (legacy transition shim)', () => {
    useAppStore.getState().setFirstTimerOpen(true)
    expect(useAppStore.getState().wizard.active).toBe(true)
    expect(useAppStore.getState().firstTimerOpen).toBe(true)
  })

  it('setWizardStep clamps negative values to 0', () => {
    useAppStore.getState().setWizardStep(3)
    expect(useAppStore.getState().wizard.stepIndex).toBe(3)

    useAppStore.getState().setWizardStep(-7)
    expect(useAppStore.getState().wizard.stepIndex).toBe(0)
  })

  it('toggleWizardSelection appends then removes (idempotent flip)', () => {
    const { toggleWizardSelection } = useAppStore.getState()
    toggleWizardSelection('decarbMethodIds', 'oven_sealed')
    expect(useAppStore.getState().wizard.selections.decarbMethodIds).toEqual([
      'oven_sealed',
    ])

    toggleWizardSelection('decarbMethodIds', 'sv_combined')
    expect(useAppStore.getState().wizard.selections.decarbMethodIds).toEqual([
      'oven_sealed',
      'sv_combined',
    ])

    toggleWizardSelection('decarbMethodIds', 'oven_sealed')
    expect(useAppStore.getState().wizard.selections.decarbMethodIds).toEqual([
      'sv_combined',
    ])
  })

  it('toggleWizardSelection works on every array field independently', () => {
    const { toggleWizardSelection } = useAppStore.getState()
    toggleWizardSelection('equipment', 'Cannabis flower')
    toggleWizardSelection('fatIds', 'coconut')
    toggleWizardSelection('formatIds', 'brownies')

    const s = useAppStore.getState().wizard.selections
    expect(s.equipment).toEqual(['Cannabis flower'])
    expect(s.decarbMethodIds).toEqual([])
    expect(s.fatIds).toEqual(['coconut'])
    expect(s.formatIds).toEqual(['brownies'])
  })

  it('setWizardNumberField sets and clears numeric fields', () => {
    const { setWizardNumberField } = useAppStore.getState()
    setWizardNumberField('grams', 3.5)
    setWizardNumberField('thcaPct', 20)
    setWizardNumberField('servings', 16)
    expect(useAppStore.getState().wizard.selections.grams).toBe(3.5)
    expect(useAppStore.getState().wizard.selections.thcaPct).toBe(20)
    expect(useAppStore.getState().wizard.selections.servings).toBe(16)

    setWizardNumberField('grams', undefined)
    expect(useAppStore.getState().wizard.selections.grams).toBeUndefined()
    expect(useAppStore.getState().wizard.selections.thcaPct).toBe(20)
  })

  it('clearWizardSelections resets every array to [] but keeps dismissed / stepIndex / active', () => {
    const {
      toggleWizardSelection,
      setWizardNumberField,
      setWizardStep,
      setWizardActive,
      clearWizardSelections,
    } = useAppStore.getState()
    toggleWizardSelection('decarbMethodIds', 'oven_sealed')
    setWizardNumberField('grams', 3.5)
    setWizardStep(2)
    setWizardActive(true)
    // dismissWizard is NOT called; we want to verify the "keep dismissed as-is"
    // behaviour for the user-level dismiss vs clearSelections.
    clearWizardSelections()

    const w = useAppStore.getState().wizard
    expect(w.selections).toEqual({
      equipment: [],
      decarbMethodIds: [],
      fatIds: [],
      formatIds: [],
    })
    expect(w.dismissed).toBe(false)
    expect(w.stepIndex).toBe(2)
    expect(w.active).toBe(true)
  })

  it('dismissWizard flips dismissed=true and closes the modal', () => {
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().setWizardStep(3)
    useAppStore.getState().dismissWizard()

    const w = useAppStore.getState().wizard
    expect(w.dismissed).toBe(true)
    expect(w.active).toBe(false)
    // dismissWizard also closes the legacy firstTimerOpen alias.
    expect(useAppStore.getState().firstTimerOpen).toBe(false)
  })

  it('dismissFirstRun keeps firstRunDismissed=true and also closes the wizard', () => {
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().dismissFirstRun()

    const s = useAppStore.getState()
    expect(s.firstRunDismissed).toBe(true)
    expect(s.wizard.active).toBe(false)
    expect(s.firstTimerOpen).toBe(false)
    // wizard.dismissed is intentionally NOT set by the legacy dismiss — the
    // user can still re-open the wizard via the "?" nav button.
    expect(s.wizard.dismissed).toBe(false)
  })
})

describe('appStore wizard persistence (round-trip)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWizard()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('partialize persists only {dismissed, selections} — active/stepIndex are NOT written', async () => {
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().setWizardStep(4)
    await waitForPersisted()

    const persistedWizard = readPersisted()?.state.wizard as
      | Record<string, unknown>
      | undefined
    expect(persistedWizard).toBeDefined()
    expect(persistedWizard?.active).toBeUndefined()
    expect(persistedWizard?.stepIndex).toBeUndefined()
    // dismissed + selections keys are present (values may be defaults).
    expect(persistedWizard).toHaveProperty('dismissed')
    expect(persistedWizard).toHaveProperty('selections')
  })

  it('version=1 is set on the persisted envelope', async () => {
    useAppStore
      .getState()
      .toggleWizardSelection('decarbMethodIds', 'oven_sealed')
    await waitForPersisted()
    expect(readPersisted()?.version).toBe(1)
  })

  it('round-trip: wizard.dismissed=true survives reload (rehydration)', async () => {
    // 1) User explicitly dismisses the wizard forever.
    useAppStore.getState().dismissWizard()
    await waitForPersisted()
    const persistedAfterDismiss = readPersisted()
    const wizardAfterDismiss = persistedAfterDismiss?.state.wizard as
      | Record<string, unknown>
      | undefined
    expect(wizardAfterDismiss).toMatchObject({ dismissed: true })

    // 2) Simulate a reload: rehydrate from the same localStorage envelope.
    //    The custom merge guarantees runtime fields reset to defaults while
    //    persisted fields survive.
    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.dismissed).toBe(true)
    // Runtime fields must always reset to defaults on reload.
    expect(w.active).toBe(false)
    expect(w.stepIndex).toBe(0)
  })

  it('round-trip: multi-select array rehydrates with full payload (length 2)', async () => {
    // 1) Pick two decarb methods via the multi-select primitive.
    const { toggleWizardSelection } = useAppStore.getState()
    toggleWizardSelection('decarbMethodIds', 'oven_sealed')
    toggleWizardSelection('decarbMethodIds', 'sv_combined')
    await waitForPersisted()

    const persisted = readPersisted()
    const persistedWizard = persisted?.state.wizard as
      | Record<string, unknown>
      | undefined
    const persistedSelections = persistedWizard?.selections as
      | WizardSelections
      | undefined
    expect(persistedSelections?.decarbMethodIds).toEqual([
      'oven_sealed',
      'sv_combined',
    ])

    // 2) Rehydrate. Selections must come back as a length-2 array.
    await useAppStore.persist.rehydrate()
    const rehydrated = useAppStore.getState().wizard.selections
    expect(rehydrated.decarbMethodIds).toHaveLength(2)
    expect(rehydrated.decarbMethodIds).toEqual(['oven_sealed', 'sv_combined'])
  })

  it('round-trip NON-PERSIST: wizard.active=true is NOT rehydrated', async () => {
    // 1) Open the modal and advance the step, then flush.
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().setWizardStep(5)
    await waitForPersisted()

    // 2) Confirm runtime fields are absent from the persisted envelope.
    const persistedWizard = readPersisted()?.state.wizard as
      | Record<string, unknown>
      | undefined
    expect(persistedWizard?.active).toBeUndefined()
    expect(persistedWizard?.stepIndex).toBeUndefined()

    // 3) Rehydrate. Wizard must be CLOSED (active=false, stepIndex=0).
    await useAppStore.persist.rehydrate()
    const w = useAppStore.getState().wizard
    expect(w.active).toBe(false)
    expect(w.stepIndex).toBe(0)
  })

  it('round-trip: every array key rehydrates as [] when persisted snapshot pre-dates the field', async () => {
    // Simulate an old (v0) snapshot written before the wizard existed, then
    // hand-rolled upgrade to v1. The migration must backfill missing array
    // keys with `[]` so `toggleWizardSelection` can append safely.
    const oldEnvelope = {
      state: {
        firstRunDismissed: true,
        // No `wizard` key at all → triggers the v0 migration path.
      },
      version: 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldEnvelope))

    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.dismissed).toBe(false)
    expect(w.active).toBe(false)
    expect(w.stepIndex).toBe(0)
    expect(w.selections).toEqual({
      equipment: [],
      decarbMethodIds: [],
      fatIds: [],
      formatIds: [],
    })
  })

  it('round-trip: migration tolerates a partial wizard snapshot (some arrays missing)', async () => {
    // A user on a hypothetical prior build might have wizard.dismissed +
    // wizard.selections.equipment but no other array keys. The migration
    // must backfill missing arrays with `[]` and preserve the ones present.
    const partial = {
      state: {
        firstRunDismissed: true,
        wizard: {
          dismissed: true,
          selections: {
            equipment: ['Cannabis flower', 'Aluminum foil'],
          },
        },
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partial))

    await useAppStore.persist.rehydrate()

    const w = useAppStore.getState().wizard
    expect(w.dismissed).toBe(true)
    expect(w.active).toBe(false)
    expect(w.stepIndex).toBe(0)
    expect(w.selections.equipment).toEqual(['Cannabis flower', 'Aluminum foil'])
    expect(w.selections.decarbMethodIds).toEqual([])
    expect(w.selections.fatIds).toEqual([])
    expect(w.selections.formatIds).toEqual([])
  })
})
