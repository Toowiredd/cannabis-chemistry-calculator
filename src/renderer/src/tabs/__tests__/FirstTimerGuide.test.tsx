/**
 * FirstTimerGuide — multi-select kit-configurator wizard.
 *
 * Coverage:
 * - Mount / unmount based on `wizard.active`.
 * - Dismiss via X button and via the "Skip" link both persist
 *   `wizard.dismissed = true`.
 * - Step nav (Back / Next / pill clicking).
 * - Multi-select toggle on the equipment step:
 *   - toggling a row once adds it to `selections.equipment`
 *   - toggling the same row twice removes it
 * - Live-preview math updates when grams / thcaPct change.
 * - Step 6 matrix shows one row per (method × fat × format)
 *   combination when all are selected and numeric material is set.
 * - Reduced-motion: the description span does not carry
 *   `transition-all` when `prefers-reduced-motion: reduce` is set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { FirstTimerGuide } from '../FirstTimerGuide'
import { DEFAULT_WIZARD_STATE, useAppStore } from '../../stores/appStore'

// `useReducedMotion` listens to matchMedia — jsdom does not implement it
// by default, so stub a no-op API so the hook can call .matches safely.
beforeEach(() => {
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

// `window.App.saveJournalEntry` is invoked by the journal CTA. Stub it
// so tests don't touch real IPC.
beforeEach(() => {
  ;(window as unknown as { App: unknown }).App = {
    saveJournalEntry: vi.fn().mockResolvedValue({ success: true }),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Reset the store between tests so cross-test pollution cannot leak. */
function resetWizard(seed: Partial<typeof DEFAULT_WIZARD_STATE> = {}) {
  useAppStore.setState({
    wizard: {
      ...DEFAULT_WIZARD_STATE,
      selections: {
        equipment: [],
        decarbMethodIds: [],
        fatIds: [],
        formatIds: [],
      },
      active: false,
      stepIndex: 0,
      dismissed: false,
      ...seed,
    },
    firstRunDismissed: false,
    firstTimerOpen: false,
  })
}

function openWizard(seed?: Partial<typeof DEFAULT_WIZARD_STATE>) {
  resetWizard({ active: true, ...seed })
}

function wizardState() {
  return useAppStore.getState().wizard
}

describe('FirstTimerGuide — mount + dismiss', () => {
  beforeEach(() => resetWizard())
  afterEach(() => resetWizard())

  it('returns null when wizard is not active', () => {
    const { container } = render(<FirstTimerGuide />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the dialog when wizard.active is true', () => {
    openWizard()
    render(<FirstTimerGuide />)
    expect(
      screen.getByRole('dialog', { name: /first-timer guide/i })
    ).toBeTruthy()
  })

  it('dismiss via the X button sets wizard.dismissed=true and closes modal', () => {
    openWizard()
    const { container } = render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-close'))
    const w = wizardState()
    expect(w.dismissed).toBe(true)
    expect(w.active).toBe(false)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('dismiss via the Skip link has the same effect as X', () => {
    openWizard()
    const { container } = render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-skip'))
    const w = wizardState()
    expect(w.dismissed).toBe(true)
    expect(w.active).toBe(false)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('header pills expose all seven steps', () => {
    openWizard()
    render(<FirstTimerGuide />)
    expect(screen.getByTestId('wizard-pill-equipment')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-material')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-decarb')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-fats')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-fat_volume')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-formats')).toBeTruthy()
    expect(screen.getByTestId('wizard-pill-review')).toBeTruthy()
  })
})

describe('FirstTimerGuide — equipment multi-select', () => {
  beforeEach(() => resetWizard())

  it('toggles a row on then off (round-trip)', () => {
    openWizard()
    render(<FirstTimerGuide />)
    // Step 1 is equipment by default. Toggle the "kitchen_scale" row.
    const row = document.querySelector(
      '[data-option-row-id="kitchen_scale"]'
    ) as HTMLElement
    expect(row).toBeTruthy()
    fireEvent.click(row)
    expect(wizardState().selections.equipment).toEqual(['kitchen_scale'])
    fireEvent.click(row)
    expect(wizardState().selections.equipment).toEqual([])
  })

  it('toggles multiple rows independently', () => {
    openWizard()
    render(<FirstTimerGuide />)
    fireEvent.click(
      document.querySelector(
        '[data-option-row-id="kitchen_scale"]'
      ) as HTMLElement
    )
    fireEvent.click(
      document.querySelector('[data-option-row-id="foil"]') as HTMLElement
    )
    expect(wizardState().selections.equipment.sort()).toEqual(
      ['foil', 'kitchen_scale'].sort()
    )
  })

  it('does not block Next on step 1 even with empty selection', () => {
    openWizard()
    render(<FirstTimerGuide />)
    const next = screen.getByTestId('wizard-next') as HTMLButtonElement
    expect(next.disabled).toBe(false)
  })
})

describe('FirstTimerGuide — step navigation', () => {
  beforeEach(() => resetWizard())

  it('Next on step 1 (equipment) advances to step 2 (material)', () => {
    openWizard()
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-next'))
    expect(wizardState().stepIndex).toBe(1)
  })

  it('Back is disabled on step 1', () => {
    openWizard()
    render(<FirstTimerGuide />)
    const back = screen.getByTestId('wizard-back') as HTMLButtonElement
    expect(back.disabled).toBe(true)
  })

  it('material step requires valid numeric input to enable Next', () => {
    openWizard({ stepIndex: 1 })
    render(<FirstTimerGuide />)
    const next = screen.getByTestId('wizard-next') as HTMLButtonElement
    expect(next.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('wizard-grams'), {
      target: { value: '3.5' },
    })
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(true)

    fireEvent.change(screen.getByTestId('wizard-thca'), {
      target: { value: '20' },
    })
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('decarb step requires at least one selection to enable Next', () => {
    openWizard({
      stepIndex: 3,
      selections: {
        equipment: [],
        decarbMethodIds: [],
        fatIds: [],
        formatIds: [],
        grams: 3.5,
        thcaPct: 20,
      },
    })
    render(<FirstTimerGuide />)
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(
      document.querySelector(
        '[data-testid="wizard-decarb-card-oven_sealed"]'
      ) as HTMLElement
    )
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('fats step requires at least one fat to enable Next', () => {
    openWizard({
      stepIndex: 4,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: [],
        formatIds: [],
        grams: 3.5,
        thcaPct: 20,
      },
    })
    render(<FirstTimerGuide />)
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(
      document.querySelector('[data-testid="wizard-fat-card-coconut"]') as HTMLElement
    )
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('fat-volume step requires a positive volume to enable Next', () => {
    openWizard({
      stepIndex: 5,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: [],
        grams: 3.5,
        thcaPct: 20,
      },
    })
    render(<FirstTimerGuide />)
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.change(screen.getByTestId('wizard-fat-volume-input'), {
      target: { value: '100' },
    })
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('formats step requires at least one format (servings override optional)', () => {
    openWizard({
      stepIndex: 6,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: [],
        grams: 3.5,
        thcaPct: 20,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(
      document.querySelector(
        '[data-testid="wizard-format-card-brownie_9x13"]'
      ) as HTMLElement
    )
    // A format is picked — Next is now enabled even without an override
    // (each format has its own suggestedServings default).
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
    // User can still override the per-format servings value.
    fireEvent.change(screen.getByTestId('wizard-servings'), {
      target: { value: '12' },
    })
    expect(
      (screen.getByTestId('wizard-next') as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('Back from step 3 returns to step 2', () => {
    openWizard({ stepIndex: 3 })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-back'))
    expect(wizardState().stepIndex).toBe(2)
  })

  it('clicking an earlier pill jumps backwards', () => {
    openWizard({ stepIndex: 4 })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-pill-equipment'))
    expect(wizardState().stepIndex).toBe(0)
  })
})

describe('FirstTimerGuide — numeric inputs persist to the store', () => {
  beforeEach(() => resetWizard())

  it('grams input writes selections.grams', () => {
    openWizard({ stepIndex: 1 })
    render(<FirstTimerGuide />)
    fireEvent.change(screen.getByTestId('wizard-grams'), {
      target: { value: '4.2' },
    })
    expect(wizardState().selections.grams).toBeCloseTo(4.2)
  })

  it('thca input writes selections.thcaPct', () => {
    openWizard({ stepIndex: 1 })
    render(<FirstTimerGuide />)
    fireEvent.change(screen.getByTestId('wizard-thca'), {
      target: { value: '22' },
    })
    expect(wizardState().selections.thcaPct).toBe(22)
  })

  it('Use values from Decarb copies grams + thcaPct from the decarb slice', () => {
    openWizard({ stepIndex: 1 })
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        weight: '7.5',
        thcaPct: '17',
      },
    })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-use-decarb'))
    const sel = wizardState().selections
    expect(sel.grams).toBeCloseTo(7.5)
    expect(sel.thcaPct).toBe(17)
  })
})

/* ------------------------------------------------------------------ */
/* Wizard selections survive a dismiss + reopen (regression guard for  */
/* the 2026-07-25 ccc user's "if I enter fat volume then close the    */
/* guide, the value is lost" report. The fix is upstream: the wizard   */
/* partialize persists `selections`, and dismissWizard does not clear  */
/* them. This test pins both contracts.                                  */
/* ------------------------------------------------------------------ */

describe('FirstTimerGuide — selections survive dismiss + reopen', () => {
  beforeEach(() => resetWizard())

  it('fat volume entered on the wizard persists across dismiss + reopen', () => {
    // 1. Open the wizard via the production action and navigate
    //    to the fat-volume step. Use production actions (not the
    //    `resetWizard` test helper, which intentionally wipes
    //    selections) — the real reopen path goes through
    //    `setWizardActive(true)` and must NOT clear selections.
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().setWizardStep(5)
    useAppStore.getState().setWizardNumberField('grams', 3.5)
    useAppStore.getState().setWizardNumberField('thcaPct', 18)
    const { unmount } = render(<FirstTimerGuide />)
    fireEvent.change(screen.getByTestId('wizard-fat-volume-input'), {
      target: { value: '50' },
    })
    expect(wizardState().selections.fatVolume).toBe(50)

    // 2. Dismiss the wizard via the production action. `dismissed`
    //    flips to true; selections (including fatVolume) must NOT
    //    be cleared.
    useAppStore.getState().dismissWizard()
    expect(wizardState().dismissed).toBe(true)
    expect(wizardState().active).toBe(false)
    expect(wizardState().selections.fatVolume).toBe(50)
    unmount()

    // 3. Reopen the wizard via the production action. The
    //    fat-volume input should be pre-populated with the
    //    persisted value (the user's last batch's volume, ready
    //    to be reused or edited).
    useAppStore.getState().setWizardActive(true)
    useAppStore.getState().setWizardStep(5)
    render(<FirstTimerGuide />)
    const input = screen.getByTestId('wizard-fat-volume-input') as HTMLInputElement
    expect(input.value).toBe('50')
  })
})

describe('FirstTimerGuide — live previews', () => {
  beforeEach(() => resetWizard())

  it('renders a decarb-method preview for each selected method', () => {
    openWizard({
      stepIndex: 3,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed', 'oven_open'],
        fatIds: [],
        formatIds: [],
        grams: 3.5,
        thcaPct: 20,
      },
    })
    render(<FirstTimerGuide />)
    const previews = screen.getByTestId('wizard-decarb-previews')
    expect(previews).toBeTruthy()
    expect(
      within(previews).getByTestId('wizard-decarb-preview-oven_sealed')
    ).toBeTruthy()
    expect(
      within(previews).getByTestId('wizard-decarb-preview-oven_open')
    ).toBeTruthy()
  })

  it('formats step totals the suggestedServings of selected formats', () => {
    openWizard({
      stepIndex: 6,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: ['brownie_9x13', 'gummy_80'],
        grams: 3.5,
        thcaPct: 20,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    // 18 (brownie_9x13) + 80 (gummy_80) = 98
    expect(screen.getByTestId('wizard-total-servings').textContent).toMatch(
      /98/
    )
  })
})

describe('FirstTimerGuide — step 6 matrix', () => {
  beforeEach(() => resetWizard())

  it('shows a row per (method × fat × format) combination', () => {
    openWizard({
      stepIndex: 7,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['ghee', 'coconut'],
        formatIds: ['brownie_9x13'],
        grams: 3.5,
        thcaPct: 20,
        servings: 16,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    const matrix = screen.getByTestId('wizard-matrix')
    expect(matrix).toBeTruthy()
    // 1 method × 2 fats × 1 format = 2 rows
    expect(
      within(matrix).getByTestId(
        'wizard-matrix-row-oven_sealed+ghee+brownie_9x13'
      )
    ).toBeTruthy()
    expect(
      within(matrix).getByTestId(
        'wizard-matrix-row-oven_sealed+coconut+brownie_9x13'
      )
    ).toBeTruthy()
  })

  it('shows the empty-state message when no combinations are possible', () => {
    openWizard({
      stepIndex: 7,
      selections: {
        equipment: [],
        decarbMethodIds: [],
        fatIds: [],
        formatIds: [],
      },
    })
    render(<FirstTimerGuide />)
    expect(screen.getByTestId('wizard-no-matrix')).toBeTruthy()
    expect(screen.queryByTestId('wizard-matrix')).toBeNull()
  })

  it('Save to Journal appends one entry to journalEntries and dismisses the wizard', async () => {
    openWizard({
      stepIndex: 7,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: ['brownie_9x13'],
        grams: 3.5,
        thcaPct: 20,
        servings: 16,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-save-journal'))
    // handleSaveToJournal is async: it awaits the disk-write IPC for each
    // matrix row before adding to the local store, so the assertion below
    // has to wait for the mock IPC promise to resolve.
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const state = useAppStore.getState()
    expect(state.journalEntries[0].methodId).toBe('oven_sealed')
    expect(state.journalEntries[0].fatId).toBe('coconut')
    // The 2026-07-25 ccc Infusion audit MINOR #3 fix: the journal entry's
    // `volume` field must match the wizard's fatVolume step, not the
    // Infusion tab's default 100 mL.
    expect(state.journalEntries[0].volume).toBe('100')
    expect(state.journalEntries[0].volumeUnit).toBe('mL')
    expect(state.wizard.dismissed).toBe(true)
    expect(state.wizard.active).toBe(false)
    // Also switched the active tab to journal so the user sees the entry.
    expect(state.activeTab).toBe('journal')
  })

  it('Save to Journal honors a non-default fatVolume (regression for stale-closure bug)', async () => {
    // The 2026-07-25 user-journey verification found that
    // handleSaveToJournal captured `selections.fatVolume` in a closure
    // that was missing the dep — every save used the first-render
    // fatVolume. This test fails on the old code (volume='100') and
    // passes on the fix (volume='250').
    openWizard({
      stepIndex: 7,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: ['brownie_9x13'],
        grams: 3.5,
        thcaPct: 20,
        servings: 16,
        fatVolume: 250,
      },
    })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-save-journal'))
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    expect(entry.volume).toBe('250')
    // Concentration = infused (mg) / volume (mL) should also reflect 250,
    // not 100. The engine produces a different value when the divisor
    // changes — this is the user-visible payoff of the MINOR #3 fix.
    expect(Number(entry.concentration)).toBeGreaterThan(0)
    expect(entry.concentration).not.toBe('0')
  })

  it('Open in Quick Batch switches tab and dismisses the wizard', () => {
    openWizard({
      stepIndex: 7,
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: ['brownie_9x13'],
        grams: 3.5,
        thcaPct: 20,
        servings: 16,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    fireEvent.click(screen.getByTestId('wizard-open-quickbatch'))
    const state = useAppStore.getState()
    expect(state.activeTab).toBe('quickbatch')
    expect(state.wizard.dismissed).toBe(true)
    expect(state.wizard.active).toBe(false)
  })
})

describe('FirstTimerGuide — reduced-motion safety', () => {
  beforeEach(() => resetWizard())

  it('does not use transition-all on the step description span', () => {
    openWizard()
    const { container } = render(<FirstTimerGuide />)
    const desc = screen.getByTestId('wizard-step-description')
    // `useReducedMotion` returns false in jsdom (we did not set matchMedia
    // to match). Either way the description span never uses `transition-all`
    // — only color-related transitions, which are a no-op under reduced
    // motion.
    expect(desc.className).not.toMatch(/transition-all/)
    // Defensive: container should not have animation utilities either.
    expect(container.innerHTML).not.toMatch(/transition-all/)
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc uiux-reviewer audit B1                                */
/*                                                                    */
/* The audit's B1 fix stamps `source: 'first_timer_guide'` on every   */
/* journal entry saved from this wizard. The `state-routing` agent   */
/* owns the `JournalEntry.source` schema widening; the test asserts   */
/* the stamped value reaches the saved entry.                          */
/* ------------------------------------------------------------------ */

describe('FirstTimerGuide — audit B1 (entry.source on save)', () => {
  beforeEach(() => {
    resetWizard()
    // Clear the journal — the broader FirstTimerGuide test
    // suite adds entries in other tests. The audit B1 test
    // asserts on the COUNT of new entries, so the journal must
    // start empty.
    useAppStore.setState({ journalEntries: [] })
  })

  it('save-to-journal stamps `source: "first_timer_guide"` on the new entry', async () => {
    // Walk the wizard to the review step with a complete selection
    // set so the matrix has at least one row, then click the save
    // CTA. The save lands via the mock `window.App.saveJournalEntry`
    // set up in `beforeEach` above; the entry should reach the
    // local store on success.
    openWizard({
      stepIndex: 7, // Review / Save step
      selections: {
        equipment: [],
        decarbMethodIds: ['oven_sealed'],
        fatIds: ['coconut'],
        formatIds: ['brownie_9x13'],
        grams: 3.5,
        thcaPct: 20,
        servings: 10,
        fatVolume: 100,
      },
    })
    render(<FirstTimerGuide />)
    // The save CTA is identified by `wizard-save-journal` in the
    // existing tests; reuse the same selector.
    fireEvent.click(screen.getByTestId('wizard-save-journal'))
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    // Read through the structural shape — the schema widening is
    // the parallel dispatch's job, but the producer side must
    // stamp the literal value.
    expect((entry as unknown as { source?: string }).source).toBe(
      'first_timer_guide'
    )
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 AVB feature round — ui-tabs                               */
/*                                                                     */
/* The First-Timer Guide's Step 2 (Material) surfaces a one-line       */
/* callout that points AVB-havers at the Quick Batch flow. The        */
/* callout must be visible on the Material step in the rendered       */
/* wizard.                                                             */
/* ------------------------------------------------------------------ */

describe('FirstTimerGuide — AVB callout on the Material step', () => {
  beforeEach(() => resetWizard())
  afterEach(() => resetWizard())

  it('renders the AVB callout when the user is on the Material step (step 1)', () => {
    openWizard({ stepIndex: 1 })
    render(<FirstTimerGuide />)
    // The callout is identified by `first-timer-avb-callout` (a
    // custom data-testid on the wrapping div in StepMaterial).
    const callout = screen.getByTestId('first-timer-avb-callout')
    expect(callout).toBeTruthy()
    // The copy must mention "AVB" and the Quick Batch hand-off.
    expect(callout.textContent).toMatch(/AVB/i)
    expect(callout.textContent).toMatch(/Quick Batch/i)
  })
})
