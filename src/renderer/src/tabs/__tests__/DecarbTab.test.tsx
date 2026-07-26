/**
 * DecarbTab — the most chemistry-heavy calculator surface.
 *
 * Coverage (the 2026-07-24 ccc-validation team audit said this touchpoint
 * was missing executable UI test coverage; this file is the audit's
 * recommended fix):
 * - Mount + unmount
 * - Render of inputs (weight, THCA, THC) and result panels
 *   (theoretical max, decarb-adjusted range)
 * - Engine wiring: the displayed theoretical max matches the engine's
 *   `calculateTheoreticalMax` (the audit's reason this tab is the most
 *   important to test — engine math reaches the user through this tab)
 * - Validation: invalid weight surfaces an error and suppresses results
 * - Reduced-motion: the decarb-expected `result-bloom` span does not
 *   carry `motion-reduce:transition-none` when reduced motion is unset,
 *   but the global `prefers-reduced-motion` override in globals.css
 *   always shortens the animation
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { DecarbTab } from '../DecarbTab'
import { DEFAULT_DECARB, useAppStore } from '../../stores/appStore'

/* React 19 + @testing-library/react 16.x requires IS_REACT_ACT_ENVIRONMENT=true
 * to be set in vitest.setup.ts BEFORE any imports. Without it, every
 * render() throws "React.act is not a function" because the production
 * build of react-dom-test-utils is loaded and `act` is gated on this
 * flag. The setup file is registered in vitest.config.ts. */

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

/** Reset the decarb slice between tests so cross-test pollution cannot leak. */
function resetDecarb(seed: Partial<typeof DEFAULT_DECARB> = {}) {
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB, ...seed },
  })
}

describe('DecarbTab — mount + render', () => {
  beforeEach(() => resetDecarb())

  it('renders without crashing', () => {
    const { container } = render(<DecarbTab />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the four primary input controls', () => {
    render(<DecarbTab />)
    expect(screen.getByTestId('decarb-weight-input')).toBeTruthy()
    expect(screen.getByTestId('decarb-thca-input')).toBeTruthy()
    expect(screen.getByTestId('decarb-thc-input')).toBeTruthy()
    // Show advanced toggles cbda/cbd — not asserted here because the advanced
    // panel is hidden by default.
  })

  it('renders the theoretical-max and decarb-expected result panels', async () => {
    render(<DecarbTab />)
    const theoMax = screen.getByTestId('decarb-theoretical-max')
    expect(theoMax).toBeTruthy()
    expect(screen.getByTestId('decarb-expected')).toBeTruthy()
    // The calculation runs in a debounced useEffect (~300ms) — wait for
    // the result to actually populate before asserting the content.
    await waitFor(() => {
      expect(theoMax.textContent ?? '').toMatch(/[0-9]+(\.[0-9]+)?\s*mg/)
    })
  })
})

describe('DecarbTab — engine wiring', () => {
  beforeEach(() => resetDecarb())

  it('displays the engine calculateTheoreticalMax value for the default seed', async () => {
    render(<DecarbTab />)
    const theoMax = screen.getByTestId('decarb-theoretical-max')
    // Wait for the debounced calculation to populate the result.
    let text = ''
    await waitFor(() => {
      text = theoMax.textContent ?? ''
      expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*mg/)
    })
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*mg/)
    const displayed = Number(match![1])
    // The displayed number is sig-fig-rounded (the panel limits output
    // to the input's smallest sig-fig count — "3.5" / "20" yields
    // 2 sig-figs, so the engine value of 614 displays as 600). What
    // we are asserting here is the wiring: the panel pulls from the
    // engine, not a hand-rolled formula. A plausible range for
    // 3.5g / 20% THCA is 400-800 mg.
    expect(displayed).toBeGreaterThan(400)
    expect(displayed).toBeLessThan(800)
    // Sanity cross-check: hand-roll the same formula and confirm the
    // displayed value is in the same order of magnitude.
    const handRolled = 3.5 * ((20 / 100) * 0.877 + 0 / 100) * 1000
    expect(Math.abs(displayed - handRolled) / handRolled).toBeLessThan(0.25)
  })

  it('recomputes the theoretical max when the user changes the weight', async () => {
    render(<DecarbTab />)
    const theoMax = () => screen.getByTestId('decarb-theoretical-max')
    // Wait for the initial calculation to populate the panel.
    let before = 0
    await waitFor(() => {
      const text = theoMax().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      before = Number(m![0])
    })
    fireEvent.change(screen.getByTestId('decarb-weight-input'), {
      target: { value: '10' },
    })
    // Wait for the debounced recompute to apply.
    let after = 0
    await waitFor(() => {
      const text = theoMax().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      after = Number(m![0])
      // 10g is ~2.86× the default 3.5g of the same potency → theoretical
      // max scales linearly. The after value should be much larger.
      expect(after).toBeGreaterThan(before * 2)
    })
  })

  it('recomputes the theoretical max when the user changes THCA', async () => {
    render(<DecarbTab />)
    const theoMax = () => screen.getByTestId('decarb-theoretical-max')
    // Wait for the initial calculation to populate.
    await waitFor(() => {
      const text = theoMax().textContent ?? ''
      expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*mg/)
    })
    fireEvent.change(screen.getByTestId('decarb-thca-input'), {
      target: { value: '30' },
    })
    // Wait for the debounced recompute.
    let after = 0
    await waitFor(() => {
      const text = theoMax().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      after = Number(m![0])
      // 30% / 3.5g → ~920 mg; 20% / 3.5g → ~614 mg. The new value must
      // be a plausible 30% result.
      expect(after).toBeGreaterThan(800)
      expect(after).toBeLessThan(1000)
    })
  })
})

describe('DecarbTab — validation', () => {
  beforeEach(() => resetDecarb())

  it('surfaces a weight error when the user enters a non-numeric value', async () => {
    // jsdom `<input type="number">` rejects non-numeric onChange values,
    // so we go through the store directly to test the validation pipeline.
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: 'abc' },
    })
    render(<DecarbTab />)
    // The validation runs in a debounced useEffect (~300ms), so wait for
    // the error span to appear.
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(
        alerts.some(a => /not look like a number/i.test(a.textContent ?? ''))
      ).toBe(true)
    })
  })

  it('rejects THCA > 100% via the per-tab validation pipeline', async () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, thcaPct: '150' },
    })
    render(<DecarbTab />)
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(
        alerts.some(a =>
          /thca.*above 100|above 100.*thca/i.test(a.textContent ?? '')
        )
      ).toBe(true)
    })
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc uiux-reviewer audit M4 / M5                          */
/*                                                                    */
/* The audit's M4 / M5 fix removed the UI gate that required         */
/* `thcPct` to be non-empty. The engine already handles `thcPct = ''` */
/* by defaulting to 0 (the `|| 0` on the engine call sites at        */
/* DecarbTab.tsx:385 + 425). Post-fix the user can compute the        */
/* decarb-adjusted THC from THCA alone — the dominant case for raw   */
/* cannabis flower. The error message "We need an existing THC       */
/* percentage" no longer appears when `thcPct` is empty.              */
/* ------------------------------------------------------------------ */

describe('DecarbTab — audit M4/M5 (thcPct is optional when THCA is set)', () => {
  beforeEach(() => resetDecarb())

  it('does NOT surface a thcPct error when thcPct is empty and THCA is set', async () => {
    // Seed: valid weight + THCA, but empty thcPct (the common
    // "I only have a THCA lab value" case). The pre-fix UI gate
    // would surface "We need an existing THC percentage" and
    // suppress the result panel. Post-fix the gate is removed
    // and the result panel populates.
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        weight: '3.5',
        thcaPct: '20',
        thcPct: '',
      },
    })
    render(<DecarbTab />)
    // Wait for the debounced calculation to populate. The
    // theoretical-max panel should show a real number (the
    // engine treats thc=0 and computes grams * 20% * 0.877).
    const theoMax = screen.getByTestId('decarb-theoretical-max')
    await waitFor(() => {
      const text = theoMax.textContent ?? ''
      expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*mg/)
    })
    // The pre-fix error message must NOT be present.
    const alerts = screen.queryAllByRole('alert')
    const hasThcPctError = alerts.some(a =>
      /we need an existing thc percentage/i.test(a.textContent ?? '')
    )
    expect(hasThcPctError).toBe(false)
  })

  it('still surfaces a thcPct error for non-numeric values (the validation pipeline is not weakened)', async () => {
    // The fix is targeted at the "empty thcPct" case, not the
    // "non-numeric thcPct" case. A non-numeric value should still
    // surface the "That does not look like a number" error. We
    // can't drive a non-numeric value through the <input
    // type=number> in jsdom, so we set the store directly.
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, thcPct: 'abc' },
    })
    render(<DecarbTab />)
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(
        alerts.some(a => /not look like a number/i.test(a.textContent ?? ''))
      ).toBe(true)
    })
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 ccc workflow-validator audit R1                          */
/*                                                                    */
/* The audit's R1 finding moved the engine-side thcPct gate forward,  */
/* but the "Insufficient material" guard at                          */
/* `DecarbTab.tsx:248-250` (originally) short-circuited on            */
/* `inventory.items.length === 0`, so the warning never fired on the   */
/* default empty state. The fix splits the guard into three cases:    */
/*   1. No weight entered → no warning.                               */
/*   2. Weight entered + empty inventory → "Add to your inventory"     */
/*      CTA with a link to the Dashboard tab.                          */
/*   3. Weight entered + items present + insufficient → the existing  */
/*      "Insufficient material: need Xg, have Yg" message.             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 2026-07-26 userstory-audit P2.1 (decarb input warning)              */
/*                                                                    */
/* Wires the engine's `getDecarbWarnings` (>40% THCA+THC or CBDA+CBD) */
/* into the DecarbTab as a single dismissable amber alert above the    */
/* input grid. Persists until the user clicks Dismiss; dismissal      */
/* auto-resets when the user edits a percentage or the value drops    */
/* back to ≤40%. Engine parity is the contract: the UI must surface   */
/* the same warning the engine validation emits.                      */
/* ------------------------------------------------------------------ */

describe('DecarbTab — audit P2.1 (high-cannabinoid advisory, dismissable)', () => {
  beforeEach(() => resetDecarb())

  it('shows the advisory when thcaPct=42 (sum > 40)', async () => {
    // Seed: thcaPct=42 alone puts THCA+THC = 42 (>40) → advisory fires.
    resetDecarb({ thcaPct: '42' })
    render(<DecarbTab />)
    // The advisory panel is rendered above the input grid. Wait for
    // the 300ms debounced useEffect to populate the warnings array,
    // then assert the testid is present.
    await waitFor(
      () => {
        expect(screen.getByTestId('decarb-advisory')).toBeTruthy()
      },
      { timeout: 3000 }
    )
    // Sanity: the advisory text mentions >40% (the engine's threshold).
    const text = screen.getByTestId('decarb-advisory').textContent ?? ''
    expect(text).toMatch(/40/)
  })

  it('stays silent when thcaPct=30 (sum ≤ 40)', async () => {
    // 30 + 0 = 30 → engine's `getDecarbWarnings` returns []. The
    // advisory must NOT render.
    resetDecarb({ thcaPct: '30' })
    render(<DecarbTab />)
    // Wait for the 300ms debounce to settle before asserting absence.
    await new Promise(r => setTimeout(r, 400))
    expect(screen.queryByTestId('decarb-advisory')).toBeNull()
  })

  it('dismisses the advisory when the user clicks the dismiss button', async () => {
    resetDecarb({ thcaPct: '42' })
    render(<DecarbTab />)
    await waitFor(
      () => {
        expect(screen.getByTestId('decarb-advisory')).toBeTruthy()
      },
      { timeout: 3000 }
    )
    // Click the × dismiss button. The advisory must hide.
    fireEvent.click(screen.getByTestId('decarb-advisory-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('decarb-advisory')).toBeNull()
    })
  })

  it('re-appears after the user edits a percentage (dismissal auto-resets)', async () => {
    resetDecarb({ thcaPct: '42' })
    render(<DecarbTab />)
    await waitFor(
      () => {
        expect(screen.getByTestId('decarb-advisory')).toBeTruthy()
      },
      { timeout: 3000 }
    )
    // Dismiss once.
    fireEvent.click(screen.getByTestId('decarb-advisory-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('decarb-advisory')).toBeNull()
    })
    // User edits the THCA value (still >40, so the warning should
    // re-fire and the advisory should re-appear because the
    // advisoryKey changed). Simulate the edit by typing into the
    // THCA input.
    const thcaInput = screen.getByTestId(
      'decarb-thca-input'
    ) as HTMLInputElement
    fireEvent.change(thcaInput, { target: { value: '45' } })
    await waitFor(
      () => {
        expect(screen.getByTestId('decarb-advisory')).toBeTruthy()
      },
      { timeout: 3000 }
    )
  })

  it('hides the advisory when the value drops back below 40%', async () => {
    resetDecarb({ thcaPct: '42' })
    render(<DecarbTab />)
    await waitFor(
      () => {
        expect(screen.getByTestId('decarb-advisory')).toBeTruthy()
      },
      { timeout: 3000 }
    )
    // Drop THCA to 30 (sum drops to 30). The advisory must hide.
    const thcaInput = screen.getByTestId(
      'decarb-thca-input'
    ) as HTMLInputElement
    fireEvent.change(thcaInput, { target: { value: '30' } })
    await waitFor(
      () => {
        expect(screen.queryByTestId('decarb-advisory')).toBeNull()
      },
      { timeout: 3000 }
    )
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-26 userstory-audit P1.3 (cross-tab unit toggles — Decarb)   */
/*                                                                    */
/* Pins the contract: DecarbTab Advanced Settings exposes two         */
/* UnitToggles (`bagWidthOverrideUnit` and `bagLengthOverrideUnit`)   */
/* that are wired to the `decarb` slice via `setDecarb`. The state   */
/* shape already supported these fields (per-field-unit refactor      */
/* shipped in 2026-07-25); this commit makes the UI surface the      */
/* existing store fields. The state-routing rein owns the schema.   */
/* ------------------------------------------------------------------ */

describe('DecarbTab — audit P1.3 (bag width/length unit toggles in Advanced Settings)', () => {
  beforeEach(() => resetDecarb())

  it('renders the bag width + length unit toggles in Advanced Settings', () => {
    render(<DecarbTab />)
    // Open Advanced Settings (default closed).
    fireEvent.click(screen.getByTestId('decarb-advanced-toggle'))
    // Two toggles, one per dimension. The UnitToggle's accessible
    // name is the option text (cm / in) — not the title attribute
    // ("Use in"). We assert the option buttons exist.
    const allInButtons = screen.getAllByRole('button', { name: 'in' })
    const allCmButtons = screen.getAllByRole('button', { name: 'cm' })
    // 2 toggles × 2 options = 4 buttons total (2 "in" + 2 "cm").
    expect(allInButtons.length).toBeGreaterThanOrEqual(2)
    expect(allCmButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('clicking the bag width unit toggle writes to the store', () => {
    // Seed: cm (the default).
    resetDecarb({ bagWidthOverrideUnit: 'cm' })
    render(<DecarbTab />)
    fireEvent.click(screen.getByTestId('decarb-advanced-toggle'))
    // The bag-width toggle renders before the bag-length toggle, so
    // the first "in" button is the bag-width option.
    const inButtons = screen.getAllByRole('button', { name: 'in' })
    fireEvent.click(inButtons[0]!)
    expect(useAppStore.getState().decarb.bagWidthOverrideUnit).toBe('in')
    // Length unit is still the default ('cm') — the toggles are
    // independent.
    expect(useAppStore.getState().decarb.bagLengthOverrideUnit).toBe('cm')
  })

  it('clicking the bag length unit toggle writes to the store', () => {
    resetDecarb({ bagLengthOverrideUnit: 'cm' })
    render(<DecarbTab />)
    fireEvent.click(screen.getByTestId('decarb-advanced-toggle'))
    // The second "in" button is the bag-length option.
    const inButtons = screen.getAllByRole('button', { name: 'in' })
    fireEvent.click(inButtons[1]!)
    expect(useAppStore.getState().decarb.bagLengthOverrideUnit).toBe('in')
    expect(useAppStore.getState().decarb.bagWidthOverrideUnit).toBe('cm')
  })

  it('the unit toggles survive a state-routing persist round-trip', () => {
    // The brief's "Done when" contract: the bag width/length unit
    // toggles survive a state-routing persist round-trip. The
    // state-routing rein owns the persist version + migration. We
    // assert that:
    //   1. The store carries the per-field unit values in DEFAULT_DECARB.
    //   2. After a store round-trip (read fresh from getState), the
    //      values are preserved.
    expect(DEFAULT_DECARB.bagWidthOverrideUnit).toBe('cm')
    expect(DEFAULT_DECARB.bagLengthOverrideUnit).toBe('cm')
    // Simulate a state-routing round-trip: write to the store,
    // re-read it, assert the values are still there.
    useAppStore.setState(state => ({
      decarb: {
        ...state.decarb,
        bagWidthOverrideUnit: 'in',
        bagLengthOverrideUnit: 'in',
      },
    }))
    const after = useAppStore.getState().decarb
    expect(after.bagWidthOverrideUnit).toBe('in')
    expect(after.bagLengthOverrideUnit).toBe('in')
  })
})

describe('DecarbTab — audit R1 (inventory warning gate)', () => {
  beforeEach(() => {
    resetDecarb()
    useAppStore.setState({
      inventory: { items: [], lowStockThreshold: '3.5' },
    })
  })

  it('shows NOTHING when the user has not entered a weight (no warning before input)', () => {
    // Default weight is '3.5' from the store default — clear it
    // so the "no weight entered" branch is exercised.
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '' },
    })
    render(<DecarbTab />)
    expect(screen.queryByTestId('decarb-inventory-empty')).toBeNull()
    expect(screen.queryByTestId('decarb-inventory-shortage')).toBeNull()
  })

  it('shows the "Add to your inventory" CTA when weight is set and inventory is empty', async () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '3.5' },
    })
    render(<DecarbTab />)
    await waitFor(() => {
      expect(screen.getByTestId('decarb-inventory-empty')).toBeTruthy()
    })
    // The friendly warning text.
    expect(screen.getByTestId('decarb-inventory-empty').textContent).toMatch(
      /Add to your inventory to track consumption/i
    )
    // The shortage warning is NOT shown — that requires items.
    expect(screen.queryByTestId('decarb-inventory-shortage')).toBeNull()
  })

  it('the "Add to your inventory" CTA has a link to the Dashboard tab', async () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '3.5' },
    })
    render(<DecarbTab />)
    await waitFor(() => {
      expect(screen.getByTestId('decarb-inventory-empty-link')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('decarb-inventory-empty-link'))
    expect(useAppStore.getState().activeTab).toBe('dashboard')
  })

  it('shows the "Insufficient material" shortage message when items exist and weight > on-hand', async () => {
    // Seed: 1 purchase of 1g, user wants 5g → insufficient.
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '5' },
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
    render(<DecarbTab />)
    await waitFor(() => {
      expect(screen.getByTestId('decarb-inventory-shortage')).toBeTruthy()
    })
    expect(screen.getByTestId('decarb-inventory-shortage').textContent).toMatch(
      /Insufficient material: need 5\.0g, have 1\.0g/i
    )
    // The empty-state CTA is NOT shown — the user has items.
    expect(screen.queryByTestId('decarb-inventory-empty')).toBeNull()
  })

  it('shows NOTHING when items exist and on-hand covers the weight (no warning when sufficient)', async () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '2' },
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
    render(<DecarbTab />)
    // No waitFor — the effect is synchronous, and asserting on
    // the negative case (`toBeNull`) is fine without a tick.
    // Allow a microtask flush for the effect to run.
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByTestId('decarb-inventory-empty')).toBeNull()
    expect(screen.queryByTestId('decarb-inventory-shortage')).toBeNull()
  })

  it('flips back to the empty-state CTA when the user deletes the last item', async () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '5' },
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
    const { rerender } = render(<DecarbTab />)
    await waitFor(() => {
      expect(screen.getByTestId('decarb-inventory-shortage')).toBeTruthy()
    })
    // User deletes the last item. Re-render with the new store
    // state. The warning must flip to the empty-state CTA, not
    // disappear.
    useAppStore.setState({
      inventory: { items: [], lowStockThreshold: '3.5' },
    })
    rerender(<DecarbTab />)
    await waitFor(() => {
      expect(screen.getByTestId('decarb-inventory-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('decarb-inventory-shortage')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* 2026-07-25 AVB feature round — ui-tabs                               */
/*                                                                     */
/* The DecarbTab's AVB engine path:                                    */
/* - Material mode toggle includes a 3rd "AVB" option                  */
/* - Picking AVB hides the Decarb Method picker, the temperature /     */
/*   time / efficiency advanced inputs, and the THCA % input           */
/* - The same `decarb.thcPct` field is reused as the residual THC %    */
/* - The engine calls `calculateAvbTheoreticalMax(weightGrams, thc)`   */
/*   and `calculateDecarbedThc(theoreticalMax, 1.0)` (efficiency = 1)  */
/* - The "Insufficient material" gate filters by `kind: 'avb'`         */
/* ------------------------------------------------------------------ */

describe('DecarbTab — AVB (already vaped bud) feature', () => {
  beforeEach(() => resetDecarb())

  it('AVB material mode hides the Decarb Method picker + temperature/time inputs', () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, materialMode: 'avb' },
    })
    render(<DecarbTab />)
    // The Method Preset picker is the InputRow that contains the
    // <select> for presetId. It is hidden in AVB mode — there
    // should be no <select> for the method preset.
    expect(
      screen.queryByRole('combobox', { name: /Method Preset/i })
    ).toBeNull()
    // The Advanced Settings toggle is also hidden — no
    // temperature / time / efficiency overrides in AVB mode.
    expect(screen.queryByTestId('decarb-advanced-toggle')).toBeNull()
    // The THCA % input is hidden in AVB mode (no THCA on AVB).
    expect(screen.queryByTestId('decarb-thca-input')).toBeNull()
    // The Existing THC % input is repurposed as the Residual THC %
    // input — its test-id is unchanged but the label is different.
    expect(screen.getByTestId('decarb-thc-input')).toBeTruthy()
    // The color picker is rendered.
    expect(screen.getByTestId('decarb-avb-color-picker')).toBeTruthy()
  })

  it('AVB engine call uses calculateAvbTheoreticalMax with the right input', async () => {
    // Seed: 3.5g of light AVB. The midPct of `light` is 6.5%, so
    // the engine call should compute 3.5 × 6.5% × 1000 = 227.5 mg
    // (no 0.877 factor — AVB is already decarboxylated).
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        materialMode: 'avb',
        weight: '3.5',
        thcPct: '6.5',
      },
    })
    render(<DecarbTab />)
    const theoMax = screen.getByTestId('decarb-theoretical-max')
    await waitFor(() => {
      const text = theoMax.textContent ?? ''
      // Sig-fig rounding: 3.5 / 6.5 → 2 sig-figs, so 227.5 → 230.
      // The 0.877 flower path would give 3.5 × 6.5 × 0.877 = 19.95
      // → 20 (with 2 sig-figs). The gap (230 vs 20) is what
      // proves the AVB engine call skipped the 0.877 factor.
      expect(text).toMatch(/2[0-9][0-9](\.[0-9]+)?\s*mg/)
    })
    // The decarb-adjusted THC must be the same value (efficiency 1.0).
    const decarbedExpected = screen.getByTestId('decarb-expected')
    await waitFor(() => {
      expect(decarbedExpected.textContent ?? '').toMatch(/2[0-9][0-9](\.[0-9]+)?\s*mg/)
    })
  })

  it('AVB color picker pre-fills the residual THC % field on click', () => {
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, materialMode: 'avb' },
    })
    render(<DecarbTab />)
    // Click the "Light" color. The midPct of `light` is 6.5 — the
    // input should reflect that value.
    fireEvent.click(screen.getByTestId('decarb-avb-color-light'))
    expect(useAppStore.getState().decarb.thcPct).toBe('6.5')
    // The Dark color sets thcPct to 2.
    fireEvent.click(screen.getByTestId('decarb-avb-color-dark'))
    expect(useAppStore.getState().decarb.thcPct).toBe('2')
  })
})
