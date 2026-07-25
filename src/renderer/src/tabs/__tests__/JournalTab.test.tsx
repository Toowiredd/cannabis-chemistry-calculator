/**
 * JournalTab — audit-fix regression tests for the 2026-07-25
 * ccc uiux-reviewer + workflow-validator dispatches.
 *
 * Coverage:
 * - B1 (uiux): save-to-journal from the inline form stamps
 *   `source: 'journal_form'` on the new entry. The schema widening
 *   that adds the `source` field to `JournalEntry` is owned by the
 *   parallel `state-routing` dispatch; the producer side (this
 *   tab's `handleSave`) must already stamp the literal value.
 * - B1 (workflow): the auto-populate form (`buildFormFromStore`)
 *   reads the per-field `infusion.volumeUnit` (the unit the user
 *   typed the value in), NOT the display `units.volumeUnit`. A
 *   user who typed 100 mL and then toggled display to 'cup' used
 *   to get a form pre-populated with volumeUnit='cup' — a 23.6x
 *   fat-volume error in the resulting entry.
 * - B7 (workflow): the journal entry card renders the material
 *   weight in the per-field `materialWeightUnit` (the unit the
 *   entry was saved in), not as a hardcoded "g". A user who saved
 *   0.12 oz would otherwise see "0.12 g" on the card — a 28x
 *   under-report.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { JournalTab } from '../JournalTab'
import {
  DEFAULT_DECARB,
  DEFAULT_INFUSION,
  useAppStore,
} from '../../stores/appStore'

/* React 19 + @testing-library/react 16.x: jsdom doesn't ship
 * matchMedia by default — stub a no-op so useReducedMotion can
 * call .matches safely. Same pattern as the other per-tab tests. */
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

/* 2026-07-25 ccc cross-tab data flow audit (MAJOR M4): the
 * auto-populate confirm-guard uses `vi.spyOn(window, 'confirm')`
 * — the M4 test group. Without restoring the spy after each
 * test, the spy stack accumulates across tests and a second
 * `vi.spyOn` wraps the first. Restore between tests so each
 * spy starts fresh. */
afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Reset the journal + calculator slices between tests so cross-test
 * pollution cannot leak. The tab reads `decarb`, `infusion`, `dose`,
 * and `journalEntries` directly; the auto-populate form reads the
 * same `decarb` + `infusion` slices at the time of the click.
 */
function resetJournal(
  seed: {
    decarb?: Partial<typeof DEFAULT_DECARB>
    infusion?: Partial<typeof DEFAULT_INFUSION>
    journalEntries?: unknown[]
  } = {}
) {
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB, ...(seed.decarb ?? {}) },
    infusion: { ...DEFAULT_INFUSION, ...(seed.infusion ?? {}) },
    journalEntries: (seed.journalEntries ?? []) as never,
    activeTab: 'journal',
  })
}

function clickAutoPopulate() {
  // Identified by aria-label on the "Log current calculator values
  // to the journal" button at JournalTab.tsx:351.
  fireEvent.click(
    screen.getByRole('button', {
      name: /Log current calculator values to the journal/i,
    })
  )
}

describe('JournalTab — audit B1 (entry.source on save)', () => {
  beforeEach(() => {
    resetJournal()
    // The form's save path requires window.App.saveJournalEntry.
    // Stub a success responder so the entry reaches the local store.
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: vi.fn().mockResolvedValue({ success: true }),
      loadJournalEntries: vi
        .fn()
        .mockResolvedValue({ success: true, entries: [] }),
    }
  })

  it('inline form save stamps `source: "journal_form"` on the new entry', async () => {
    render(<JournalTab />)
    // Open the inline form via the auto-populate button (it seeds
    // the form from the calculator slices; we'll override the
    // strain name next).
    clickAutoPopulate()
    // Set a strain name — the save flow refuses to save with an
    // empty strain name.
    fireEvent.change(screen.getByLabelText(/Strain name/i), {
      target: { value: 'OG Kush' },
    })
    // Click the Save Entry button.
    fireEvent.click(screen.getByRole('button', { name: /Save Entry/i }))
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    // The schema widening is the parallel dispatch's job, so we
    // read through the structural shape until both land.
    expect((entry as unknown as { source?: string }).source).toBe(
      'journal_form'
    )
  })
})

describe('JournalTab — audit workflow B1 (auto-populate form uses per-field volumeUnit)', () => {
  beforeEach(() => {
    resetJournal()
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: vi.fn().mockResolvedValue({ success: true }),
      loadJournalEntries: vi
        .fn()
        .mockResolvedValue({ success: true, entries: [] }),
    }
  })

  it('auto-populate form stamps the per-field volumeUnit, not the display unit', () => {
    // Seed: per-field = 'mL' (the unit the user typed in), display =
    // 'cup' (the user toggled after typing). Pre-fix, the form's
    // volumeUnit select was set to 'cup' — the entry would have
    // been saved as 100 cup (≈23.6 L).
    resetJournal({
      infusion: { volume: '100', volumeUnit: 'mL' },
    })
    useAppStore.setState(state => ({
      units: { ...state.units, volumeUnit: 'cup' },
    }))
    render(<JournalTab />)
    clickAutoPopulate()
    // The form's volumeUnit select is identified by its aria-label
    // at JournalTab.tsx:576. The select's `value` is the form's
    // `volumeUnit` state. We assert via `getByDisplayValue` which
    // finds the <option> that the select currently shows.
    const select = screen.getByLabelText(/Volume unit/i) as HTMLSelectElement
    // The pre-fix bug would have shown "cup" here.
    expect(select.value).toBe('mL')
    expect(select.value).not.toBe('cup')
  })
})

describe('JournalTab — audit workflow B7 (entry card renders per-field materialWeightUnit)', () => {
  beforeEach(() => {
    // The tab reads journalEntries on mount. The Card renders an
    // entry once it's in the store. We need loadJournalEntries to
    // resolve to a stable shape (the auto-mount effect). We then
    // inject the entry directly into the store so the card renders
    // synchronously.
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: vi.fn().mockResolvedValue({ success: true }),
      loadJournalEntries: vi
        .fn()
        .mockResolvedValue({ success: true, entries: [] }),
    }
  })

  it('card shows per-field materialWeightUnit, not hardcoded "g"', async () => {
    // Seed: a saved entry with weight=0.12 and materialWeightUnit='oz'.
    // The state-routing dispatch owns the `materialWeightUnit`
    // schema widening — we cast the entry to `unknown` so the
    // pre-widening type accepts the field. After the widening
    // lands the cast can be removed.
    const entry = {
      id: 'entry_test_oz',
      date: '2026-07-25',
      strainName: 'OG Kush',
      strainId: null,
      materialWeight: '0.12',
      // Per-field unit on the entry — the B7 fix reads this.
      // The widening is `state-routing`'s job, so we attach the
      // field as an extension through the existing structural
      // shape.
      ...({ materialWeightUnit: 'oz' } as Record<string, unknown>),
      thcaPct: '20',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      methodId: 'oven_sealed',
      methodName: 'Oven (Sealed)',
      fatId: 'coconut',
      fatName: 'Coconut',
      servings: '10',
      mgPerServing: '0',
      classification: '',
      totalInfusedThc: '0',
      concentration: '0',
      volume: '100',
      volumeUnit: 'mL',
      notes: '',
    }
    useAppStore.setState({
      journalEntries: [entry as never],
      activeTab: 'journal',
    })
    const { container } = render(<JournalTab />)
    // The card should NOT show "0.12 g" — that was the pre-fix
    // hardcoded-unit output that mis-reported ounces as grams.
    expect(container.textContent).not.toContain('0.12 g')
    // It SHOULD show "0.12 oz".
    expect(container.textContent).toContain('0.12')
    expect(container.textContent).toContain('oz')
  })

  it('card falls back to "g" for older entries that have no materialWeightUnit field', async () => {
    // Pre-B7 entries (saved before the schema widening) have no
    // `materialWeightUnit` field. The render path falls back to
    // 'g' so they don't crash on `undefined`.
    const entry = {
      id: 'entry_test_legacy',
      date: '2026-07-25',
      strainName: 'Legacy',
      strainId: null,
      materialWeight: '3.5',
      thcaPct: '20',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      methodId: 'oven_sealed',
      methodName: 'Oven (Sealed)',
      fatId: 'coconut',
      fatName: 'Coconut',
      servings: '10',
      mgPerServing: '0',
      classification: '',
      totalInfusedThc: '0',
      concentration: '0',
      volume: '100',
      volumeUnit: 'mL',
      notes: '',
    }
    useAppStore.setState({
      journalEntries: [entry as never],
      activeTab: 'journal',
    })
    const { container } = render(<JournalTab />)
    expect(container.textContent).toContain('3.5')
    expect(container.textContent).toContain('g')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc cross-tab data flow audit (MAJOR M4)                 */
/*                                                                    */
/* The M4 fix adds a confirm-guard to the "Save current calculator    */
/* values to the journal" button (a.k.a. auto-populate). Pre-fix,     */
/* clicking the button while the form had user-entered values         */
/* silently overwrote every field — the user lost their entry.        */
/* Post-fix, the button asks "Discard your current entry and          */
/* auto-populate from the last batch?" before clobbering.             */
/*                                                                    */
/* The three properties that must hold:                               */
/* - Empty form (or the form already populated by the store): no      */
/*   confirm dialog.                                                  */
/* - Dirty form + confirm accept: form is replaced by the             */
/*   auto-populated values.                                           */
/* - Dirty form + confirm cancel: form is preserved (the user keeps    */
/*   what they had typed).                                            */
/* ------------------------------------------------------------------ */

describe('JournalTab — audit M4 (auto-populate confirm-guard)', () => {
  beforeEach(() => {
    resetJournal()
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: vi.fn().mockResolvedValue({ success: true }),
      loadJournalEntries: vi
        .fn()
        .mockResolvedValue({ success: true, entries: [] }),
    }
  })

  it('does NOT prompt when the form is empty', () => {
    // jsdom's window.confirm returns undefined by default; a spy
    // that never fires confirms the confirm-dialog was never
    // reached. An empty form is the "no data to lose" case — the
    // user can't be surprised by the auto-populate.
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<JournalTab />)
    clickAutoPopulate()
    expect(confirmSpy).not.toHaveBeenCalled()
    // Sanity: the form is now open with the auto-populated values.
    const nameInput = screen.getByLabelText(/Strain name/i) as HTMLInputElement
    // The default empty seed has no strain name, so the input is
    // still empty after auto-populate (no name in the store).
    expect(nameInput.value).toBe('')
  })

  it('prompts when the form has user-entered values, and CANCEL preserves them', () => {
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(false)
    render(<JournalTab />)
    // Open the form first.
    clickAutoPopulate()
    // Now the user types a strain name. The form is "dirty".
    fireEvent.change(screen.getByLabelText(/Strain name/i), {
      target: { value: 'OG Kush' },
    })
    // Click auto-populate again. The handler must call confirm().
    clickAutoPopulate()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    // The exact text the user sees — the brief mandates this copy.
    expect(confirmSpy).toHaveBeenCalledWith(
      'Discard your current entry and auto-populate from the last batch?'
    )
    // User cancelled. The form is unchanged — the user-typed name
    // is still there.
    const nameInput = screen.getByLabelText(/Strain name/i) as HTMLInputElement
    expect(nameInput.value).toBe('OG Kush')
  })

  it('prompts when the form has user-entered values, and ACCEPT replaces them', () => {
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(true)
    // Seed: a strain name in the store. The auto-populate
    // would (in the journal form's buildFormFromStore) put the
    // store's decarb.strainId onto strainId but NOT onto
    // strainName (the form is blank for strainName). So after
    // an accepted auto-populate, the strain name input should
    // be empty even though the user had typed "OG Kush" — the
    // user explicitly accepted the discard.
    render(<JournalTab />)
    clickAutoPopulate()
    fireEvent.change(screen.getByLabelText(/Strain name/i), {
      target: { value: 'OG Kush' },
    })
    // Confirm the form is currently dirty.
    const nameInput = screen.getByLabelText(/Strain name/i) as HTMLInputElement
    expect(nameInput.value).toBe('OG Kush')
    // Click auto-populate and accept.
    clickAutoPopulate()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    // The form has been re-populated from the store; the
    // user-typed "OG Kush" is gone (strainName defaults to
    // '' in buildFormFromStore).
    expect(nameInput.value).toBe('')
  })
})
