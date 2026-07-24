/**
 * QuickBatchTab — save-to-journal discipline tests.
 *
 * The 2026-07-24 user-journey verification found that
 * QuickBatchTab.handleSaveBatch had a try/catch fallback that added
 * the entry to the local store even when the IPC threw. The
 * FirstTimerGuide had already been fixed for this — but QuickBatch
 * hadn't. This test pins the new behavior:
 *
 *   1. IPC present, success: true → add to local store + switch to
 *      journal tab.
 *   2. IPC present, success: false → do NOT add to local store
 *      (the entry would be a phantom on the next Journal-tab reload).
 *   3. IPC throws → do NOT add to local store; warn to console; tell
 *      the user.
 *   4. IPC missing (no Electron preload bridge — browser dev mode) →
 *      add to local store + switch to journal tab. The user knows
 *      their environment can't persist, and there's no disk to be
 *      out-of-sync with.
 *
 * The test mirrors the same pattern the FirstTimerGuide tests
 * use: stub `window.App.saveJournalEntry`, drive the click, and
 * assert on the resulting journalEntries + activeTab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { QuickBatchTab } from '../QuickBatchTab'
import { DEFAULT_DECARB, useAppStore } from '../../stores/appStore'

/* React 19 + @testing-library/react 16.x requires IS_REACT_ACT_ENVIRONMENT=true
 * to be set in vitest.setup.ts BEFORE any imports. Without it, every
 * render() throws "React.act is not a function". The setup file is
 * registered in vitest.config.ts. */

/* jsdom doesn't ship matchMedia by default — stub it. */
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

afterEach(() => {
  vi.restoreAllMocks()
})

/** Reset the calculator slices to a deterministic state. */
function resetCalculator() {
  useAppStore.setState({
    decarb: {
      ...DEFAULT_DECARB,
      weight: '3.5',
      weightUnit: 'g' as const,
      thcaPct: '20',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      presetId: 'oven_sealed',
    },
    infusion: {
      decarbedThc: '',
      volume: '100',
      volumeUnit: 'mL' as const,
      fatId: 'coconut',
      customEfficiency: '0.82',
    },
    dose: {
      totalThc: '',
      servings: '10',
      formatId: '',
      reverseMode: false,
      desiredMgPerServing: '',
    },
    journalEntries: [],
    activeTab: 'quickbatch',
  })
}

/**
 * Advance the QuickBatch wizard to the final "Label & Save" step.
 * 5 steps total: material & lab, decarb method, fat & volume, dose,
 * label & save. Click the Next button 4 times.
 */
function advanceToFinalStep() {
  advanceToStep(4)
}

/**
 * Advance the QuickBatch wizard to step `n` (0..4). Steps 0=Material
 * & Lab, 1=Decarb Method, 2=Fat & Volume, 3=Servings & Dose,
 * 4=Label & Save. Clicks the Next button `n` times.
 */
function advanceToStep(n: number) {
  for (let i = 0; i < n; i++) {
    const buttons = screen.getAllByRole('button')
    // Find the next-step button: it's the one with the ArrowRight
    // icon. The Back button has ArrowLeft, the Save has BookOpen.
    const nextBtn = buttons.find(
      b =>
        b.querySelector('svg.lucide-arrow-right') !== null &&
        !b.hasAttribute('disabled')
    )
    if (!nextBtn) {
      throw new Error(
        `Could not find Next button at step ${i}. Found: ${buttons.map(b => b.textContent).join(' | ')}`
      )
    }
    fireEvent.click(nextBtn)
  }
}

/**
 * Advance the QuickBatch wizard to the final step in AVB mode.
 * 2026-07-25 AVB feature: the Decarb Method step is skipped, so
 * it takes 3 clicks (0→2, 2→3, 3→4) instead of the 4 the
 * flower path needs.
 */
function advanceToFinalStepAvb() {
  for (let i = 0; i < 3; i++) {
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons.find(
      b =>
        b.querySelector('svg.lucide-arrow-right') !== null &&
        !b.hasAttribute('disabled')
    )
    if (!nextBtn) {
      throw new Error(
        `advanceToFinalStepAvb: Could not find Next button at click ${i}. Found: ${buttons.map(b => b.textContent).join(' | ')}`
      )
    }
    fireEvent.click(nextBtn)
  }
}

function clickSaveBatch() {
  fireEvent.click(
    screen.getByRole('button', { name: /Save Batch to Journal/i })
  )
}

describe('QuickBatchTab — save-to-journal discipline', () => {
  beforeEach(() => resetCalculator())

  it('on IPC success, adds to local store and switches to the journal tab', async () => {
    const saveMock = vi.fn().mockResolvedValue({ success: true })
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: saveMock,
    }
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1)
    })
    // After a successful save the user should land on the journal tab
    // so they can see the entry — same UX as the First-Timer Guide.
    expect(useAppStore.getState().activeTab).toBe('journal')
    expect(useAppStore.getState().journalEntries.length).toBe(1)
  })

  it('on IPC success=false, does NOT add to local store (no phantom entry)', async () => {
    const saveMock = vi.fn().mockResolvedValue({
      success: false,
      error: 'disk full',
    })
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: saveMock,
    }
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1)
    })
    // The entry was rejected by disk — there is NO local copy. If
    // we'd added one, it would be a phantom that the next
    // Journal-tab mount-time reload would silently delete.
    expect(useAppStore.getState().journalEntries.length).toBe(0)
    // We don't switch tabs on a failed save.
    expect(useAppStore.getState().activeTab).toBe('quickbatch')
  })

  it('on IPC throw, does NOT add to local store and warns the user', async () => {
    const saveMock = vi.fn().mockRejectedValue(new Error('IPC bridge dead'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(window as unknown as { App: unknown }).App = {
      saveJournalEntry: saveMock,
    }
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1)
    })
    // Critical: the catch path must NOT fall through to a local-store
    // add. That was the original bug.
    expect(useAppStore.getState().journalEntries.length).toBe(0)
    // The catch path also logs a warning so the developer can see
    // why the save failed.
    expect(warnSpy).toHaveBeenCalled()
    // User stays on the QuickBatch tab — no phantom entry, no jump.
    expect(useAppStore.getState().activeTab).toBe('quickbatch')
  })

  it('on missing IPC bridge (browser dev mode), falls back to local-store-only', async () => {
    // No window.App at all — browser-only / dev-renderer audit
    // environment. There's no disk to be out-of-sync with, so a
    // local-store-only fallback is correct and the user should still
    // see their entry.
    delete (window as unknown as { App?: unknown }).App
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    expect(useAppStore.getState().activeTab).toBe('journal')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 dose-units audit B1, B2, MAJOR (workflow)                */
/*                                                                    */
/* The audit's per-field-unit refactor needs pinned behavior for:    */
/* - The weight + volume onChange must set per-field unit             */
/* - The weight + volume input value must convert to display unit     */
/* - The engine calc must use the per-field unit (weight in grams,    */
/*   volume in mL)                                                    */
/* - The journal save must record the per-field unit, not the         */
/*   display unit                                                     */
/* - Cross-tab carry-forward (Infusion -> QuickBatch) must work       */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — per-field unit refactor (audit B1, B2, MAJOR)', () => {
  beforeEach(() => resetCalculator())

  it('mounts with the default weight + volume values from the store', () => {
    render(<QuickBatchTab />)
    // The weight input is on step 0 (Material & Lab); the volume
    // input is on step 2 (Fat & Volume). Step 1 is the Decarb
    // Method card grid which has no inputs the test cares about.
    const weightInput = screen.getByTestId(
      'quickbatch-weight-input'
    ) as HTMLInputElement
    // The resetCalculator seed has weight='3.5'.
    expect(weightInput.value).toBe('3.5')

    // Advance to step 2 to reveal the volume input.
    advanceToStep(2)
    const volumeInput = screen.getByTestId(
      'quickbatch-volume-input'
    ) as HTMLInputElement
    // The resetCalculator seed has volume='100'.
    expect(volumeInput.value).toBe('100')
  })

  it('weight toggle round-trip: stored value + per-field unit are preserved across toggles', () => {
    render(<QuickBatchTab />)
    const weightInput = screen.getByTestId(
      'quickbatch-weight-input'
    ) as HTMLInputElement
    // Display=g (default). Type "3.5" — onChange should set BOTH
    // decarb.weight AND decarb.weightUnit = 'g' (the unit the user
    // typed in).
    fireEvent.change(weightInput, { target: { value: '3.5' } })
    expect(useAppStore.getState().decarb.weight).toBe('3.5')
    expect(useAppStore.getState().decarb.weightUnit).toBe('g')

    // Click the "oz" toggle. The toggle handler should ONLY flip
    // units.weightUnit; the per-field decarb.weightUnit + decarb.weight
    // stay untouched. The displayed value converts to oz (2 dp).
    fireEvent.click(screen.getByTestId('quickbatch-weight-toggle-oz'))
    expect(useAppStore.getState().units.weightUnit).toBe('oz')
    expect(useAppStore.getState().decarb.weight).toBe('3.5')
    expect(useAppStore.getState().decarb.weightUnit).toBe('g')
    // 3.5g -> 0.12 oz (2 dp). The user can see the converted value
    // without losing the original grams.
    expect(weightInput.value).toBe('0.12')

    // Click back to g. Stored value + per-field unit still untouched.
    fireEvent.click(screen.getByTestId('quickbatch-weight-toggle-g'))
    expect(useAppStore.getState().units.weightUnit).toBe('g')
    expect(useAppStore.getState().decarb.weight).toBe('3.5')
    expect(useAppStore.getState().decarb.weightUnit).toBe('g')
    expect(weightInput.value).toBe('3.5')
  })

  it('volume toggle round-trip: stored value + per-field unit are preserved across toggles', () => {
    render(<QuickBatchTab />)
    // The volume input is on step 2 (Fat & Volume). Advance.
    advanceToStep(2)
    const volumeInput = screen.getByTestId(
      'quickbatch-volume-input'
    ) as HTMLInputElement
    // Display=mL (default). Type "100" — onChange should set BOTH
    // infusion.volume AND infusion.volumeUnit = 'mL'.
    fireEvent.change(volumeInput, { target: { value: '100' } })
    expect(useAppStore.getState().infusion.volume).toBe('100')
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')

    // Click the "cup" toggle. Toggle handler ONLY flips
    // units.volumeUnit; the per-field infusion.volumeUnit +
    // infusion.volume stay untouched. Display converts 100 mL to
    // 0.42 cup (2 dp).
    fireEvent.click(screen.getByTestId('quickbatch-volume-toggle-cup'))
    expect(useAppStore.getState().units.volumeUnit).toBe('cup')
    expect(useAppStore.getState().infusion.volume).toBe('100')
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')
    expect(volumeInput.value).toBe('0.42')

    // Click back to mL. Stored value + per-field unit still untouched.
    fireEvent.click(screen.getByTestId('quickbatch-volume-toggle-ml'))
    expect(useAppStore.getState().units.volumeUnit).toBe('mL')
    expect(useAppStore.getState().infusion.volume).toBe('100')
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')
    expect(volumeInput.value).toBe('100')
  })

  it('weight calc uses per-field unit: typing oz then toggling to g computes from grams, not oz', () => {
    // Set the store to: 0.12 oz, thca 20%, oven_sealed preset. We
    // do this through the store (faster + more deterministic than
    // walking the UI). The onChange path is covered by the
    // round-trip test above; here we want to pin that the engine
    // call uses per-field grams.
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        weight: '0.12',
        weightUnit: 'oz',
        thcaPct: '20',
        thcPct: '0',
        cbdaPct: '0',
        cbdPct: '0',
        presetId: 'oven_sealed',
      },
      units: { ...useAppStore.getState().units, weightUnit: 'oz' },
    })
    render(<QuickBatchTab />)
    const weightInput = screen.getByTestId(
      'quickbatch-weight-input'
    ) as HTMLInputElement
    // Display still 'oz' from the store. Input shows "0.12" (per-field
    // == display, no conversion).
    expect(weightInput.value).toBe('0.12')

    // Toggle to g. The toggle handler only flips units.weightUnit.
    fireEvent.click(screen.getByTestId('quickbatch-weight-toggle-g'))
    expect(useAppStore.getState().units.weightUnit).toBe('g')
    // Per-field weight + per-field unit are unchanged.
    expect(useAppStore.getState().decarb.weight).toBe('0.12')
    expect(useAppStore.getState().decarb.weightUnit).toBe('oz')
    // Display converts 0.12 oz -> 3.40 g (2 dp).
    expect(weightInput.value).toBe('3.40')

    // Advance to save and click. The journal entry's
    // totalInfusedThc must be based on 3.40 g (not 0.12 g).
    // Per-field fix: 3.4g * 20% THCA -> ~596 mg theoretical ->
    // ~566 mg decarbed (95% efficiency oven_sealed) -> ~464 mg
    // infused (82% coconut).
    // Buggy (pre-fix): 0.12g * 20% THCA -> ~21 mg theoretical ->
    // ~20 mg decarbed -> ~16.4 mg infused.
    delete (window as unknown as { App?: unknown }).App
    advanceToFinalStep()
    clickSaveBatch()
    const entry = useAppStore.getState().journalEntries[0]
    // 464 mg is the per-field-correct value (sanity range: > 400).
    // If the per-field fix is missing, this would be ~16.
    const infused = Number(entry.totalInfusedThc)
    expect(infused).toBeGreaterThan(400)
    expect(infused).toBeLessThan(550)
  })

  it('save-to-journal uses per-field volume unit, not display unit (audit MAJOR #2 workflow)', async () => {
    // User typed 100 in mL, then toggled display to cup before
    // saving. The journal entry must record 100 mL — the per-field
    // unit — not 100 cup. A later reader of the journal entry would
    // mis-interpret 100 cup as ~23.6 L of fat.
    useAppStore.setState({
      infusion: {
        ...useAppStore.getState().infusion,
        volume: '100',
        volumeUnit: 'mL',
      },
      units: { ...useAppStore.getState().units, volumeUnit: 'cup' },
    })
    delete (window as unknown as { App?: unknown }).App
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    expect(entry.volume).toBe('100')
    // The per-field unit is the source of truth, not the display.
    expect(entry.volumeUnit).toBe('mL')
    expect(entry.volumeUnit).not.toBe('cup')
  })

  it('save-to-journal preserves weight + per-field weight unit (audit MAJOR #2 workflow)', async () => {
    // User typed 3.5 in g, then toggled display to oz before
    // saving. The journal entry must record 3.5 g — the per-field
    // weight + unit — not 0.12 oz.
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        weight: '3.5',
        weightUnit: 'g',
      },
      units: { ...useAppStore.getState().units, weightUnit: 'oz' },
    })
    delete (window as unknown as { App?: unknown }).App
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    expect(entry.materialWeight).toBe('3.5')
    // QuickBatchTab doesn't currently stamp weightUnit on the
    // journal entry (it only has materialWeight, not weightUnit).
    // What we ARE asserting here is that the engine call for the
    // totalInfusedThc used 3.5g (per-field), not 0.12 oz (display).
    // Same numeric check as the per-field calc test above:
    // 3.5g * 20% THCA -> ~614 mg theoretical -> ~583 mg decarbed ->
    // ~478 mg infused (coconut 82%). Buggy pre-fix: 0.12 * ... ->
    // ~17 mg infused.
    const infused = Number(entry.totalInfusedThc)
    expect(infused).toBeGreaterThan(400)
    expect(infused).toBeLessThan(550)
  })

  it('cross-tab carry-forward: values typed on Infusion tab display correctly in QuickBatchTab', () => {
    // Simulate the user having typed values on the Infusion tab
    // (which writes to infusion.volume + infusion.volumeUnit) and
    // a weight on the Decarb tab. When the user navigates to
    // QuickBatchTab, the inputs should reflect the per-field value
    // (with display-unit conversion if needed).
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        weight: '7',
        weightUnit: 'g',
      },
      infusion: {
        ...useAppStore.getState().infusion,
        volume: '250',
        volumeUnit: 'mL',
        fatId: 'olive',
      },
      units: {
        ...useAppStore.getState().units,
        weightUnit: 'g',
        volumeUnit: 'mL',
      },
    })
    render(<QuickBatchTab />)
    const weightInput = screen.getByTestId(
      'quickbatch-weight-input'
    ) as HTMLInputElement
    // Display unit matches per-field unit — no conversion needed.
    expect(weightInput.value).toBe('7')

    // Volume input is on step 2 (Fat & Volume). Advance.
    advanceToStep(2)
    const volumeInput = screen.getByTestId(
      'quickbatch-volume-input'
    ) as HTMLInputElement
    expect(volumeInput.value).toBe('250')

    // Now toggle volume display to cup. The per-field value
    // (250 mL) is preserved; the display shows 1.06 cup (250 / 236.588).
    fireEvent.click(screen.getByTestId('quickbatch-volume-toggle-cup'))
    expect(useAppStore.getState().units.volumeUnit).toBe('cup')
    expect(useAppStore.getState().infusion.volume).toBe('250')
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')
    // 250 / 236.588 = 1.056... -> "1.06"
    expect(volumeInput.value).toBe('1.06')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc uiux-reviewer audit B1                                */
/*                                                                    */
/* The audit's B1 fix stamps `source: 'quickbatch'` on every journal  */
/* entry saved from this tab. The `state-routing` agent owns the      */
/* `JournalEntry.source` schema widening; the test asserts the        */
/* stamped value reaches the saved entry even before the widening     */
/* lands (the entry is read through the existing structural shape).   */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — audit B1 (entry.source on save)', () => {
  beforeEach(() => resetCalculator())

  it('save-to-journal stamps `source: "quickbatch"` on the new entry', async () => {
    // Browser-only path — no IPC, entry goes straight to the local
    // store. Simpler + deterministic than the IPC round-trip and
    // tests the same producer-side concern.
    delete (window as unknown as { App?: unknown }).App
    render(<QuickBatchTab />)
    advanceToFinalStep()
    clickSaveBatch()
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    // The producer stamps the source; the schema widening is
    // state-routing's job, so we read through the structural shape
    // (`unknown`) until both dispatches land.
    expect((entry as unknown as { source?: string }).source).toBe('quickbatch')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc workflow-validator audit B2                          */
/*                                                                    */
/* The audit's B2 fix restores `infusion.volumeUnit` (and             */
/* `decarb.strainId`, the folded-in N4 fix) on                       */
/* `handleLoadFromLastBatch` so a journal entry that was saved with   */
/* per-field units / a selected strain doesn't lose them on reload.   */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — audit B2 (handleLoadFromLastBatch carries forward volumeUnit + strainId)', () => {
  beforeEach(() => resetCalculator())

  it('restores infusion.volumeUnit from the saved entry (audit B2)', () => {
    // Seed: one saved entry with volume=100, volumeUnit='mL'. The
    // user's current display unit is 'cup' (so the prior handler
    // would have loaded 100 mL as 100 cup).
    useAppStore.setState({
      journalEntries: [
        {
          id: 'entry_test_1',
          date: '2026-07-25',
          strainName: '',
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
        },
      ],
      units: { ...useAppStore.getState().units, volumeUnit: 'cup' },
    })
    render(<QuickBatchTab />)
    // The "Start from last batch" button is at the top of the
    // QuickBatch tab.
    const loadBtn = screen.getByRole('button', {
      name: /Start from last batch/i,
    })
    fireEvent.click(loadBtn)
    // The new handler must restore BOTH the per-field unit and the
    // display unit so the loaded value isn't misinterpreted.
    expect(useAppStore.getState().infusion.volume).toBe('100')
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')
    expect(useAppStore.getState().units.volumeUnit).toBe('mL')
  })

  it('restores decarb.strainId from the saved entry (audit workflow N4, folded into B2)', () => {
    useAppStore.setState({
      journalEntries: [
        {
          id: 'entry_test_2',
          date: '2026-07-25',
          strainName: 'OG Kush',
          // The strainId is the key field — pre-fix, the loader
          // dropped it silently.
          strainId: 'strain_og_kush',
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
        },
      ],
    })
    render(<QuickBatchTab />)
    fireEvent.click(
      screen.getByRole('button', { name: /Start from last batch/i })
    )
    expect(useAppStore.getState().decarb.strainId).toBe('strain_og_kush')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc workflow-validator audit B6                          */
/*                                                                    */
/* The audit's B6 fix converts the saved material weight to the       */
/* DISPLAY unit for the Label & Save summary panel, instead of        */
/* hardcoding "g". The fix is in the JSX of the Step 5 summary        */
/* panel; this test renders the final step and asserts the unit       */
/* label matches the display unit (or the per-field unit, when they   */
/* match).                                                            */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — audit B6 (Label & Save summary panel uses display unit)', () => {
  beforeEach(() => resetCalculator())

  it('summary panel material line matches the display unit, not a hardcoded "g"', () => {
    // Seed: weight=3.5, per-field=g, display=oz. Display converts
    // 3.5 g to 0.12 oz. The summary must show "0.12 oz" — not
    // "3.5 g" — because the user is in oz mode.
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        weight: '3.5',
        weightUnit: 'g',
      },
      units: { ...useAppStore.getState().units, weightUnit: 'oz' },
    })
    render(<QuickBatchTab />)
    advanceToFinalStep()
    // The summary panel is in step 4 (Label & Save). Render the
    // tree and walk it for the material cell.
    const container = document.body
    // The "Material" label cell.
    expect(container.textContent).toContain('Material')
    // The cell must NOT show "3.5 g" (the buggy pre-fix output).
    // It must show "0.12 oz" (the post-fix display-converted
    // value).
    expect(container.textContent).toContain('0.12')
    expect(container.textContent).toContain('oz')
    // And the previous "3.5 g" hardcoded value should be gone.
    expect(container.textContent).not.toContain('3.5 g')
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc workflow-validator audit R1 (mirror of DecarbTab)   */
/*                                                                    */
/* Same three-case guard the DecarbTab tests pin. The QuickBatchTab   */
/* shares the audit's R1 fix shape — see DecarbTab tests above for   */
/* the full rationale. QuickBatch renders the warning on step 0       */
/* (Material & Lab), so the test mounts and asserts on step 0.        */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — audit R1 (inventory warning gate)', () => {
  beforeEach(() => {
    resetCalculator()
    useAppStore.setState({
      inventory: { items: [], lowStockThreshold: '3.5' },
    })
  })

  it('shows NOTHING on step 0 when the user has not entered a weight', () => {
    useAppStore.setState({
      decarb: { ...useAppStore.getState().decarb, weight: '' },
    })
    render(<QuickBatchTab />)
    // Step 0 is the default — Material & Lab card is rendered.
    expect(screen.queryByTestId('quickbatch-inventory-empty')).toBeNull()
    expect(screen.queryByTestId('quickbatch-inventory-shortage')).toBeNull()
  })

  it('shows the "Add to your inventory" CTA when weight is set and inventory is empty', async () => {
    useAppStore.setState({
      decarb: { ...useAppStore.getState().decarb, weight: '3.5' },
    })
    render(<QuickBatchTab />)
    await waitFor(() => {
      expect(screen.getByTestId('quickbatch-inventory-empty')).toBeTruthy()
    })
    expect(
      screen.getByTestId('quickbatch-inventory-empty').textContent
    ).toMatch(/Add to your inventory to track consumption/i)
    expect(screen.queryByTestId('quickbatch-inventory-shortage')).toBeNull()
  })

  it('the QuickBatch "Add to your inventory" CTA navigates to the Dashboard tab', async () => {
    useAppStore.setState({
      decarb: { ...useAppStore.getState().decarb, weight: '3.5' },
    })
    render(<QuickBatchTab />)
    await waitFor(() => {
      expect(screen.getByTestId('quickbatch-inventory-empty-link')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('quickbatch-inventory-empty-link'))
    expect(useAppStore.getState().activeTab).toBe('dashboard')
  })

  it('shows the "Insufficient material" shortage message when items exist and weight > on-hand', async () => {
    useAppStore.setState({
      decarb: { ...useAppStore.getState().decarb, weight: '5' },
      inventory: {
        items: [
          {
            id: 'inv_seed',
            date: '2026-07-25',
            type: 'purchase',
            name: 'OG Kush',
            amountGrams: '1',
          },
        ],
        lowStockThreshold: '3.5',
      },
    })
    render(<QuickBatchTab />)
    await waitFor(() => {
      expect(screen.getByTestId('quickbatch-inventory-shortage')).toBeTruthy()
    })
    expect(
      screen.getByTestId('quickbatch-inventory-shortage').textContent
    ).toMatch(/Insufficient material: need 5\.0g, have 1\.0g/i)
    expect(screen.queryByTestId('quickbatch-inventory-empty')).toBeNull()
  })

  it('shows NOTHING when items exist and on-hand covers the weight', async () => {
    useAppStore.setState({
      decarb: { ...useAppStore.getState().decarb, weight: '2' },
      inventory: {
        items: [
          {
            id: 'inv_seed',
            date: '2026-07-25',
            type: 'purchase',
            name: 'OG Kush',
            amountGrams: '10',
          },
        ],
        lowStockThreshold: '3.5',
      },
    })
    render(<QuickBatchTab />)
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByTestId('quickbatch-inventory-empty')).toBeNull()
    expect(screen.queryByTestId('quickbatch-inventory-shortage')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 AVB feature round — ui-tabs                               */
/*                                                                     */
/* These tests pin the AVB UI surface on QuickBatch: the materialMode  */
/* selector, the residual-THC % swap for thcaPct, the color picker     */
/* pre-fill, the wizard skipping Step 2 (Decarb Method), the journal   */
/* source stamp, and the AVB-specific inventory gate.                  */
/* ------------------------------------------------------------------ */

describe('QuickBatchTab — AVB (already vaped bud) feature', () => {
  beforeEach(() => resetCalculator())

  it('shows the materialMode selector in Step 1 with Flower / Concentrate / AVB options', () => {
    render(<QuickBatchTab />)
    // The 3-option materialMode toggle lives on Step 1.
    const modeGroup = screen.getByTestId('quickbatch-material-mode')
    expect(modeGroup).toBeTruthy()
    // Each option is a button with a data-testid matching the
    // value (flower / concentrate / avb).
    expect(
      within(modeGroup).getByTestId('quickbatch-material-flower')
    ).toBeTruthy()
    expect(
      within(modeGroup).getByTestId('quickbatch-material-concentrate')
    ).toBeTruthy()
    expect(
      within(modeGroup).getByTestId('quickbatch-material-avb')
    ).toBeTruthy()
    // Default is flower — the flower radio is aria-checked.
    expect(
      within(modeGroup)
        .getByTestId('quickbatch-material-flower')
        .getAttribute('aria-checked')
    ).toBe('true')
  })

  it('AVB mode swaps the THCA % input for a residual-THC % input AND a color picker', async () => {
    render(<QuickBatchTab />)
    // In flower mode the THCA % input is present, residual-THC is NOT.
    expect(
      screen.queryByTestId('quickbatch-residual-thc-input')
    ).toBeNull()
    expect(
      screen.queryByTestId('quickbatch-avb-color-picker')
    ).toBeNull()
    // Click AVB.
    fireEvent.click(screen.getByTestId('quickbatch-material-avb'))
    // The residual-THC % input now exists.
    const residualInput = screen.getByTestId('quickbatch-residual-thc-input')
    expect(residualInput).toBeTruthy()
    // The color picker is visible.
    expect(screen.getByTestId('quickbatch-avb-color-picker')).toBeTruthy()
    // Light/Medium/Dark color buttons are all present.
    expect(
      screen.getByTestId('quickbatch-avb-color-light')
    ).toBeTruthy()
    expect(
      screen.getByTestId('quickbatch-avb-color-medium')
    ).toBeTruthy()
    expect(
      screen.getByTestId('quickbatch-avb-color-dark')
    ).toBeTruthy()
  })

  it('AVB color picker pre-fills residual THC % with the midpoint of the color range', () => {
    render(<QuickBatchTab />)
    fireEvent.click(screen.getByTestId('quickbatch-material-avb'))
    // 3.5 * midPct of light (6.5%) = 227.5 mg. The form writes the
    // % (not mg) to thcPct. So we expect thcPct === '6.5' (the
    // midPct literal, not the multiplied mg).
    fireEvent.click(screen.getByTestId('quickbatch-avb-color-light'))
    expect(useAppStore.getState().decarb.thcPct).toBe(
      String(6.5) // AVB_RESIDUAL_THC_RANGES.light.midPct
    )
    fireEvent.click(screen.getByTestId('quickbatch-avb-color-dark'))
    expect(useAppStore.getState().decarb.thcPct).toBe(
      String(2) // AVB_RESIDUAL_THC_RANGES.dark.midPct
    )
  })

  it('AVB skips Step 2 (Decarb Method): Next from Step 1 lands on Step 3 (Fat & Volume)', () => {
    render(<QuickBatchTab />)
    // Switch to AVB.
    fireEvent.click(screen.getByTestId('quickbatch-material-avb'))
    // Type a residual THC % so the gate is satisfied.
    fireEvent.change(screen.getByTestId('quickbatch-weight-input'), {
      target: { value: '3.5' },
    })
    fireEvent.change(screen.getByTestId('quickbatch-residual-thc-input'), {
      target: { value: '4' },
    })
    // Click Next.
    const nextBtns = () =>
      screen
        .getAllByRole('button')
        .filter(
          b =>
            b.querySelector('svg.lucide-arrow-right') !== null &&
            !b.hasAttribute('disabled')
        )
    expect(nextBtns().length).toBeGreaterThan(0)
    fireEvent.click(nextBtns()[0])
    // We should be on step 2 (index), which is "Fat & Volume" — the
    // Decarb Method step (index 1) is skipped.
    expect(screen.getByTestId('quickbatch-volume-input')).toBeTruthy()
    // The step pills indicate we're on step 3 of 5.
    expect(screen.getByText(/Step 3 of 5/)).toBeTruthy()
  })

  it('AVB save stamps `source: "avb"` on the journal entry (vs source: "quickbatch" in flower mode)', async () => {
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        materialMode: 'avb',
        weight: '3.5',
        weightUnit: 'g',
        thcaPct: '0',
        thcPct: '4', // residual THC % for AVB
        cbdaPct: '0',
        cbdPct: '0',
        presetId: 'oven_sealed',
      },
    })
    // Browser-only path — no IPC, entry goes straight to the local
    // store. The fall-through local-add path runs.
    delete (window as unknown as { App?: unknown }).App
    render(<QuickBatchTab />)
    // In AVB mode, Step 2 is skipped: 0→2 (1 click), 2→3 (1
    // click), 3→4 (1 click) = 3 clicks to reach the final step.
    // The flower path needs 4 clicks. We use the AVB-specific
    // helper here so the test is robust if either path changes.
    advanceToFinalStepAvb()
    clickSaveBatch()
    await waitFor(() => {
      expect(useAppStore.getState().journalEntries.length).toBe(1)
    })
    const entry = useAppStore.getState().journalEntries[0]
    // The producer stamps the AVB source, not the regular
    // quickbatch source.
    expect((entry as unknown as { source?: string }).source).toBe('avb')
    expect((entry as unknown as { source?: string }).source).not.toBe(
      'quickbatch'
    )
  })

  it('AVB "Insufficient material" gate counts kind: "avb" items (not flower)', async () => {
    // Seed inventory: 1g of flower, 5g of AVB. User picks AVB and
    // types 7g → insufficient (only 5g of AVB on hand).
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        materialMode: 'avb',
        weight: '7',
        thcPct: '4',
      },
      inventory: {
        items: [
          {
            id: 'inv_flower',
            date: '2026-07-25',
            type: 'purchase',
            name: 'OG Kush',
            amountGrams: '1',
            kind: 'flower',
          },
          {
            id: 'inv_avb',
            date: '2026-07-25',
            type: 'purchase',
            name: 'AVB from Volcano',
            amountGrams: '5',
            kind: 'avb',
          },
        ],
        lowStockThreshold: '3.5',
      },
    })
    render(<QuickBatchTab />)
    await waitFor(() => {
      expect(screen.getByTestId('quickbatch-inventory-shortage')).toBeTruthy()
    })
    // The shortage message must reflect the AVB-only total (5g),
    // not the combined flower+avb total (6g). The user has 5g of
    // AVB; they want 7g → need 7.0g, have 5.0g.
    expect(
      screen.getByTestId('quickbatch-inventory-shortage').textContent
    ).toMatch(/Insufficient material: need 7\.0g, have 5\.0g/i)
  })
})
