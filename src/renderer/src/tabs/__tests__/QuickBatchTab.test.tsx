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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

function clickSaveBatch() {
  fireEvent.click(screen.getByRole('button', { name: /Save Batch to Journal/i }))
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
