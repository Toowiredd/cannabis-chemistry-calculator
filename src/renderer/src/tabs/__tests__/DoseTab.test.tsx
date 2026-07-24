/**
 * DoseTab — reverse-mode + forward-mode UI tests.
 *
 * Coverage (the 2026-07-25 ccc dose-units audit MAJOR #4 said the
 * `ui_dose` touchpoint was missing executable UI test coverage; this
 * file is the audit's recommended fix):
 *
 * - Mount + forward-mode render (default seed: totalThc empty, results null)
 * - Forward calc — typing totalThc updates the "mg per Serving" panel after
 *   the 300ms debounce
 * - Reverse-mode toggle — clicking the toggle hides the forward result
 *   panel and shows the "Required Material" card
 * - Debounced reverse calc — typing desiredMgPerServing + servings in
 *   reverse mode updates the "Required Material" result after the
 *   300ms debounce (uses vi.useFakeTimers + vi.advanceTimersByTimeAsync
 *   to avoid real-time waits)
 * - Toggle back to forward — forward result panel reappears and the
 *   previous forward values are preserved
 * - Classification label mapping — typing a value that crosses a
 *   boundary (e.g. 2.0mg → "Sub-Microdose" vs 2.5mg → "Microdose")
 *   updates the classification label
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { DoseTab } from '../DoseTab'
import {
  DEFAULT_DECARB,
  DEFAULT_DOSE,
  DEFAULT_INFUSION,
  useAppStore,
} from '../../stores/appStore'
import { reverseFullWorkflow } from '../../engine/reverse'
import {
  DECARB_METHODS,
  INFUSION_FATS,
} from '../../engine/models'

/* React 19 + @testing-library/react 16.x requires IS_REACT_ACT_ENVIRONMENT=true
 * to be set in vitest.setup.ts BEFORE any imports. The setup file is
 * registered in vitest.config.ts. */

/* jsdom doesn't ship matchMedia by default — stub it for useReducedMotion
 * to call .matches safely. */
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

/** Reset the calculator slices to a deterministic state. */
function resetCalculator() {
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB },
    infusion: { ...DEFAULT_INFUSION },
    dose: { ...DEFAULT_DOSE },
    lastInfusedThc: '',
    lastDecarbExpected: '',
  })
}

/* ------------------------------------------------------------------ */
/* 1. Mount + forward render                                          */
/* ------------------------------------------------------------------ */

describe('DoseTab — mount + forward render', () => {
  beforeEach(() => resetCalculator())

  it('renders without crashing', () => {
    const { container } = render(<DoseTab />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the forward result panel and the four primary input controls', () => {
    render(<DoseTab />)
    // Forward panel is visible by default (reverseMode: false)
    expect(screen.getByTestId('dose-forward-result')).toBeTruthy()
    // The reverse panel is hidden in forward mode
    expect(screen.queryByTestId('dose-reverse-result')).toBeNull()
    // Inputs visible in forward mode
    expect(screen.getByTestId('dose-total-thc-input')).toBeTruthy()
    expect(screen.getByTestId('dose-servings-input')).toBeTruthy()
    // The reverse-mode desired-mg input is hidden in forward mode
    expect(screen.queryByTestId('dose-desired-mg-input')).toBeNull()
  })

  it('renders the empty-state "enter total THC" message in the forward panel', () => {
    render(<DoseTab />)
    const panel = screen.getByTestId('dose-forward-result')
    expect(panel.textContent ?? '').toMatch(
      /Enter total THC and number of servings/i
    )
  })

  it('renders the radar chart and the dose scale inside the forward result panel', () => {
    render(<DoseTab />)
    const panel = screen.getByTestId('dose-forward-result')
    // Radar chart shows its own header
    expect(within(panel).getByText(/Experience Profile/i)).toBeTruthy()
    // Dose scale label appears in the panel header
    expect(
      within(panel).getAllByText(/Dose Classification Scale/i).length
    ).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* 2. Forward calc                                                    */
/* ------------------------------------------------------------------ */

describe('DoseTab — forward calc', () => {
  beforeEach(() => resetCalculator())

  it('updates the "mg per Serving" panel after the user types totalThc', async () => {
    render(<DoseTab />)
    // The forward calc runs in a debounced useEffect (~300ms). Type
    // 100mg / 10 servings → 10.0 mg per serving.
    fireEvent.change(screen.getByTestId('dose-total-thc-input'), {
      target: { value: '100' },
    })
    // Default servings is 10, so 100 / 10 = 10.0.
    await waitFor(() => {
      const panel = screen.getByTestId('dose-forward-result')
      expect(panel.textContent ?? '').toMatch(/10\.0 mg per serving/)
    })
  })

  it('recomputes when the user changes the totalThc value', async () => {
    render(<DoseTab />)
    // First: 100 / 10 = 10.0
    fireEvent.change(screen.getByTestId('dose-total-thc-input'), {
      target: { value: '100' },
    })
    await waitFor(() => {
      const panel = screen.getByTestId('dose-forward-result')
      expect(panel.textContent ?? '').toMatch(/10\.0 mg per serving/)
    })
    // Then: 200 / 10 = 20.0
    fireEvent.change(screen.getByTestId('dose-total-thc-input'), {
      target: { value: '200' },
    })
    await waitFor(() => {
      const panel = screen.getByTestId('dose-forward-result')
      expect(panel.textContent ?? '').toMatch(/20\.0 mg per serving/)
    })
  })
})

/* ------------------------------------------------------------------ */
/* 3. Reverse-mode toggle                                             */
/* ------------------------------------------------------------------ */

describe('DoseTab — reverse-mode toggle', () => {
  beforeEach(() => resetCalculator())

  it('hides the forward panel and shows the "Required Material" card on toggle', async () => {
    render(<DoseTab />)
    // Forward panel visible at mount.
    expect(screen.getByTestId('dose-forward-result')).toBeTruthy()
    expect(screen.queryByTestId('dose-reverse-result')).toBeNull()

    // Click the toggle. The button is wired to setDose({ reverseMode: true }).
    fireEvent.click(screen.getByTestId('dose-reverse-mode-toggle'))

    // Forward panel hides, reverse "Required Material" card appears.
    await waitFor(() => {
      expect(screen.queryByTestId('dose-forward-result')).toBeNull()
    })
    expect(screen.getByTestId('dose-reverse-result')).toBeTruthy()
    // The forward total-thc input is also hidden in reverse mode.
    expect(screen.queryByTestId('dose-total-thc-input')).toBeNull()
    // The reverse desired-mg input appears.
    expect(screen.getByTestId('dose-desired-mg-input')).toBeTruthy()
  })

  it('reflects the toggled state via aria-pressed', () => {
    render(<DoseTab />)
    const toggle = screen.getByTestId('dose-reverse-mode-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('exposes a descriptive aria-label that swaps with state', () => {
    render(<DoseTab />)
    const toggle = screen.getByTestId('dose-reverse-mode-toggle')
    expect(toggle.getAttribute('aria-label')).toMatch(/Switch to reverse mode/i)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-label')).toMatch(/Switch to forward mode/i)
  })
})

/* ------------------------------------------------------------------ */
/* 4. Debounced reverse calc (uses vi.useFakeTimers)                  */
/* ------------------------------------------------------------------ */

describe('DoseTab — debounced reverse calc', () => {
  beforeEach(() => {
    resetCalculator()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates the "Required Material" result after the 300ms debounce', async () => {
    render(<DoseTab />)
    // Switch to reverse mode. The reverse effect schedules a 300ms
    // debounced timer to compute the initial result from the default
    // desiredMgPerServing=10 and servings=10. Wrap the click + timer
    // advance in act() so the React state updates from the debounced
    // callback are flushed before we assert.
    await act(async () => {
      fireEvent.click(screen.getByTestId('dose-reverse-mode-toggle'))
      await vi.advanceTimersByTimeAsync(350)
    })

    // The reverse inputs are visible; defaults are 10 / 10.
    const desiredMgInput = screen.getByTestId('dose-desired-mg-input')
    const servingsInput = screen.getByTestId('dose-servings-input')
    expect((desiredMgInput as HTMLInputElement).value).toBe('10')
    expect((servingsInput as HTMLInputElement).value).toBe('10')

    // Compute the expected grams the same way the component does
    // (DoseTab.tsx:453-464), pulling the same defaults from the store.
    const state = useAppStore.getState()
    const method =
      DECARB_METHODS.find(m => m.id === state.decarb.presetId) ??
      DECARB_METHODS[0]
    const fat =
      INFUSION_FATS.find(f => f.id === state.infusion.fatId) ??
      INFUSION_FATS[0]
    const expected = reverseFullWorkflow({
      desiredMgPerServing: parseFloat(state.dose.desiredMgPerServing),
      servings: parseFloat(state.dose.servings),
      thcaPct: parseFloat(state.decarb.thcaPct) || 0,
      thcPct: parseFloat(state.decarb.thcPct) || 0,
      decarbEfficiency: state.decarb.effExpectedOverride
        ? parseFloat(state.decarb.effExpectedOverride)
        : method.efficiency.expected,
      extractionEfficiency: state.infusion.customEfficiency
        ? parseFloat(state.infusion.customEfficiency)
        : fat.extractionEff,
    })

    // The "Required Material" card shows the result as `${grams} g`,
    // formatted to 2 decimals. The reverseGrams state in the component
    // is updated to `expected` (a number, rounded by the engine to 2dp).
    const card = screen.getByTestId('dose-reverse-result')
    expect(card.textContent ?? '').toMatch(
      new RegExp(`${expected.toFixed(2)}\\s*g`)
    )
  })

  it('recomputes the "Required Material" result when the user edits desiredMgPerServing', async () => {
    render(<DoseTab />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('dose-reverse-mode-toggle'))
      // First calc with default 10/10.
      await vi.advanceTimersByTimeAsync(350)
    })

    const firstText = screen.getByTestId('dose-reverse-result').textContent ?? ''
    expect(firstText).toMatch(/\d+\.\d{2}\s*g/)

    // Edit desiredMgPerServing to 20. The debounce timer is cleared
    // and re-scheduled; the result should change.
    await act(async () => {
      fireEvent.change(screen.getByTestId('dose-desired-mg-input'), {
        target: { value: '20' },
      })
      await vi.advanceTimersByTimeAsync(350)
    })

    const secondText =
      screen.getByTestId('dose-reverse-result').textContent ?? ''
    // Higher desired mg per serving → more material required →
    // larger grams value.
    const firstGrams = Number(firstText.match(/(\d+\.\d{2})\s*g/)?.[1] ?? '0')
    const secondGrams = Number(secondText.match(/(\d+\.\d{2})\s*g/)?.[1] ?? '0')
    expect(secondGrams).toBeGreaterThan(firstGrams)
  })
})

/* ------------------------------------------------------------------ */
/* 5. Toggle back to forward                                          */
/* ------------------------------------------------------------------ */

describe('DoseTab — toggle back to forward preserves values', () => {
  beforeEach(() => resetCalculator())

  it('restores the forward result panel with the previous forward values', async () => {
    render(<DoseTab />)

    // Set up forward values: 100mg / 10 servings → 10.0 mg per serving.
    fireEvent.change(screen.getByTestId('dose-total-thc-input'), {
      target: { value: '100' },
    })
    await waitFor(() => {
      const panel = screen.getByTestId('dose-forward-result')
      expect(panel.textContent ?? '').toMatch(/10\.0 mg per serving/)
    })

    // Toggle to reverse.
    fireEvent.click(screen.getByTestId('dose-reverse-mode-toggle'))
    await waitFor(() => {
      expect(screen.queryByTestId('dose-forward-result')).toBeNull()
    })
    expect(screen.getByTestId('dose-reverse-result')).toBeTruthy()

    // Toggle back to forward.
    fireEvent.click(screen.getByTestId('dose-reverse-mode-toggle'))
    await waitFor(() => {
      expect(screen.getByTestId('dose-forward-result')).toBeTruthy()
    })
    expect(screen.queryByTestId('dose-reverse-result')).toBeNull()

    // The previous forward values are preserved: 100 / 10 = 10.0.
    // The debounce may re-run, so wait for the result to settle.
    const panel = screen.getByTestId('dose-forward-result')
    await waitFor(() => {
      expect(panel.textContent ?? '').toMatch(/10\.0 mg per serving/)
    })
    // The totalThc input still shows the previous value.
    const totalThcInput = screen.getByTestId(
      'dose-total-thc-input'
    ) as HTMLInputElement
    expect(totalThcInput.value).toBe('100')
  })
})

/* ------------------------------------------------------------------ */
/* 6. Classification label mapping                                    */
/* ------------------------------------------------------------------ */

describe('DoseTab — classification label mapping', () => {
  beforeEach(() => resetCalculator())

  it('shows "Sub-Microdose" for 2.0 mg per serving and "Microdose" at the 2.5 mg boundary', async () => {
    render(<DoseTab />)
    const totalThcInput = screen.getByTestId('dose-total-thc-input')

    // 20mg / 10 servings = 2.0 mg per serving → Sub-Microdose.
    // The classification span has a `key` prop that changes with the
    // classification label, so React unmounts and remounts the node
    // on every result change. Re-query inside waitFor to avoid
    // holding a stale reference.
    fireEvent.change(totalThcInput, { target: { value: '20' } })
    await waitFor(() => {
      expect(
        screen.getByTestId('dose-classification').textContent ?? ''
      ).toMatch(/Sub-Microdose/i)
    })

    // 25mg / 10 servings = 2.5 mg per serving → Microdose
    // (the boundary is inclusive at 2.5, per engine/dosing.ts:62-63).
    fireEvent.change(totalThcInput, { target: { value: '25' } })
    await waitFor(() => {
      expect(
        screen.getByTestId('dose-classification').textContent ?? ''
      ).toMatch(/^Microdose$/i)
    })
  })

  it('crosses from "Moderate" to "Strong" at the 25 mg boundary', async () => {
    render(<DoseTab />)
    const totalThcInput = screen.getByTestId('dose-total-thc-input')

    // 200mg / 10 servings = 20.0 mg per serving → Moderate.
    fireEvent.change(totalThcInput, { target: { value: '200' } })
    await waitFor(() => {
      expect(
        screen.getByTestId('dose-classification').textContent ?? ''
      ).toMatch(/^Moderate$/i)
    })

    // 250mg / 10 servings = 25.0 mg per serving → Strong.
    fireEvent.change(totalThcInput, { target: { value: '250' } })
    await waitFor(() => {
      expect(
        screen.getByTestId('dose-classification').textContent ?? ''
      ).toMatch(/^Strong$/i)
    })
  })
})
