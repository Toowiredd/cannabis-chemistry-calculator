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
      thcaPct: '20',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      presetId: 'oven_sealed',
    },
    infusion: {
      decarbedThc: '',
      volume: '100',
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
  // The Next button has a right-arrow icon and is the only enabled
  // forward-nav button on the screen. Find by role to avoid coupling
  // to testids that may or may not be added later.
  for (let i = 0; i < 4; i++) {
    const buttons = screen.getAllByRole('button')
    // Find the next-step button: it's the one with the ArrowRight
    // icon. The Back button has ArrowLeft, the Save has BookOpen.
    const nextBtn = buttons.find(b =>
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
