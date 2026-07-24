/**
 * BagCalculator — the sous vide bag sizing surface.
 *
 * Coverage (the 2026-07-25 ccc-validation team audit
 * `validation_report_dose_units.md` §5.2 + §7 MAJOR #5 flagged this
 * touchpoint as missing executable UI test coverage; this file is the
 * audit's recommended fix):
 *
 * - Mount with the default decarb state and verify the result panels
 *   render (Material Volume, Fill Depth, Recommended Bag).
 * - Engine wiring: 3.5 g at the default 'medium' grind (3.5 cm³/g)
 *   yields 12.25 cm³ of material volume. The BagCalculator's
 *   `estimateMaterialVolume(weightGrams, grind.cm3PerGram)` call
 *   is what this assertion pins.
 * - **B4 fix** (`validation_report_dose_units.md` §6 B4): the
 *   `weightGrams` useMemo must read `decarb.weightUnit` (the
 *   per-field unit the user typed in), not `units.weightUnit`
 *   (the display unit). Toggling the display unit on the Decarb
 *   tab must NOT change the BagCalculator's Material Volume. The
 *   fix is in BagCalculator.tsx:234-241; the working copy already
 *   uses `decarb.weightUnit`. This test pins the contract.
 * - **B5 fix** (`validation_report_dose_units.md` §6 B5, addressed
 *   by commit `7470b57`): the `handleBagUnitToggle` no longer
 *   does convert-and-replace on `bagWidthOverride` /
 *   `bagLengthOverride`. Toggling cm↔in changes the display unit
 *   only; the stored value stays in the unit the user typed it in,
 *   and the `bagWidthOverrideUnit` / `bagLengthOverrideUnit`
 *   per-field state is unchanged. This test pins the contract.
 * - Custom bag override math: with a 10 cm × 15 cm custom bag
 *   (vs the 17.8 × 20.3 cm quart preset), the Fill Depth is
 *   deeper (smaller bag, same material). The recommendation still
 *   pulls from `BAG_PRESETS` (the engine has no custom bag
 *   recommender), so the recommendation itself is unchanged but
 *   the Fill Depth must reflect the override.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { BagCalculator } from '../BagCalculator'
import { DEFAULT_DECARB, useAppStore } from '../../stores/appStore'

/* React 19 + @testing-library/react 16.x requires IS_REACT_ACT_ENVIRONMENT=true
 * to be set in vitest.setup.ts BEFORE any imports. Without it, every
 * render() throws "React.act is not a function". The setup file is
 * registered in vitest.config.ts. */

/* jsdom doesn't ship matchMedia by default — stub it for
 * useReducedMotion to call .matches safely. */
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

/** Reset the decarb + units slices between tests so cross-test
 * pollution cannot leak. The B5 test toggles `units.bagUnit` to
 * 'in'; if we don't reset `units` here, the next describe's
 * custom-bag test will interpret the 10/15 cm override as
 * inches (10in × 15in = 25.4 × 38.1 cm) and the Fill Depth
 * assertion will be off by ~6×. */
function resetState(seed: Partial<typeof DEFAULT_DECARB> = {}) {
  useAppStore.setState((state) => ({
    decarb: { ...DEFAULT_DECARB, ...seed },
    units: { ...state.units, bagUnit: 'cm' },
  }))
}

describe('BagCalculator — mount + render', () => {
  beforeEach(() => resetState())

  it('renders without crashing', () => {
    const { container } = render(<BagCalculator tempC={110} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the Material Volume, Fill Depth, and Recommended Bag result panels', async () => {
    render(<BagCalculator tempC={110} />)
    // All three result panels live inside the conditional `bagResults`
    // block. The calculation runs in a debounced useEffect (~300ms) —
    // wait for the results to populate before asserting they exist.
    const matVol = await waitFor(() => screen.getByTestId('bag-material-volume'))
    expect(matVol).toBeTruthy()
    expect(screen.getByTestId('bag-fill-depth')).toBeTruthy()
    expect(screen.getByTestId('bag-recommendation')).toBeTruthy()
  })
})

describe('BagCalculator — engine wiring', () => {
  beforeEach(() => resetState())

  it('Material Volume matches the engine for the default seed (3.5g at medium grind = 12.25 cm³)', async () => {
    // The audit's MAJOR #5 (no test file) is the gap this test fills.
    // The default decarb state is weight=3.5g, bagGrindId=medium
    // (3.5 cm³/g). The engine formula is `grams * cm3PerGram`, so
    // 3.5 * 3.5 = 12.25 cm³. The engine rounds to 1 decimal
    // (engine/bagVolume.ts:31 `roundN(value, 1)`), and JS Math.round
    // rounds 0.5 up — so 12.25 displays as 12.3. The point of this
    // test is to pin the wiring: the panel pulls from the engine,
    // not a hand-rolled formula. A plausible range for 3.5g /
    // medium grind is 10–15 cm³.
    render(<BagCalculator tempC={110} />)
    const matVol = await waitFor(() =>
      screen.getByTestId('bag-material-volume')
    )
    await waitFor(() => {
      expect(matVol.textContent ?? '').toMatch(/[0-9]+(\.[0-9]+)?\s*cm³/)
    })
    const text = matVol.textContent ?? ''
    const m = text.match(/([0-9]+(?:\.[0-9]+)?)/)
    expect(m).toBeTruthy()
    const displayed = Number(m![1])
    // 3.5 * 3.5 = 12.25 → engine rounds to 12.3. Accept 12–13 to
    // absorb the 1-decimal rounding without false negatives.
    expect(displayed).toBeGreaterThanOrEqual(12)
    expect(displayed).toBeLessThanOrEqual(13)
  })
})

describe('BagCalculator — B4 fix (weight-from-decarb per-field unit)', () => {
  beforeEach(() => resetState())

  it('Material Volume is preserved when the user toggles the weight DISPLAY unit (per-field wins)', async () => {
    // The B4 fix: `weightGrams` useMemo must use `decarb.weightUnit`
    // (per-field), not `units.weightUnit` (display). With per-field
    // = g and display = oz, the calculator must still treat 3.5 as
    // 3.5 GRAMS, not 3.5 ounces. Pre-fix: 3.5 (display=oz) → 99.2g
    // → ~347 cm³. Post-fix: 3.5 (per-field=g) → 3.5g → 12.25 cm³
    // (rounds to 12.3 on display).
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, weight: '3.5', weightUnit: 'g' },
      units: {
        ...useAppStore.getState().units,
        weightUnit: 'oz',
      },
    })
    render(<BagCalculator tempC={110} />)
    const matVol = await waitFor(() =>
      screen.getByTestId('bag-material-volume')
    )
    await waitFor(() => {
      const text = matVol.textContent ?? ''
      expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*cm³/)
    })
    const text = matVol.textContent ?? ''
    const m = text.match(/([0-9]+(?:\.[0-9]+)?)/)
    expect(m).toBeTruthy()
    const displayed = Number(m![1])
    // If the B4 fix is in place, the per-field 'g' wins regardless
    // of the display unit. 3.5g at medium grind = 12.25 cm³ →
    // displays as 12.3. If the B4 fix were missing, 3.5
    // (display=oz) would be interpreted as 3.5 oz = 99.22g →
    // 347.3 cm³. The < 50 bound catches the regression.
    expect(displayed).toBeGreaterThanOrEqual(12)
    expect(displayed).toBeLessThanOrEqual(13)
    expect(displayed).toBeLessThan(50) // 99.2g would give ~347 cm³
  })
})

describe('BagCalculator — B5 fix (bag unit toggle preserves the stored value)', () => {
  beforeEach(() =>
    resetState({
      bagPresetId: 'custom',
      bagWidthOverride: '10',
      bagWidthOverrideUnit: 'cm',
      bagLengthOverride: '15',
      bagLengthOverrideUnit: 'cm',
    })
  )

  it('toggling cm → in changes the DISPLAY unit but does NOT mutate the stored override', async () => {
    // The B5 fix (commit 7470b57): handleBagUnitToggle now only
    // calls `setUnits({ bagUnit: newUnit })`. It does NOT call
    // `setDecarb({ bagWidthOverride: converted })` — that was the
    // pre-fix convert-and-replace pattern which drifted on every
    // toggle. After the toggle, the stored value stays '10' and
    // the per-field unit stays 'cm'; only the input's display
    // changes to the converted value.
    render(<BagCalculator tempC={110} />)

    // Find the bag unit toggle buttons (cm / in) inside the
    // bag-unit-toggle testid wrapper. The UnitToggle renders
    // both as <button> elements with the unit as their text.
    const toggle = await waitFor(() =>
      screen.getByTestId('bag-unit-toggle')
    )
    const inButton = Array.from(toggle.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'in'
    )
    expect(inButton).toBeTruthy()
    fireEvent.click(inButton!)

    // The display unit changed; the toggle's 'in' button is now
    // the active one. The stored value is unchanged.
    await waitFor(() => {
      const after = useAppStore.getState().decarb
      expect(after.bagWidthOverride).toBe('10')
      expect(after.bagWidthOverrideUnit).toBe('cm')
      expect(after.bagLengthOverride).toBe('15')
      expect(after.bagLengthOverrideUnit).toBe('cm')
      // The display unit preference is the only thing that moved.
      expect(useAppStore.getState().units.bagUnit).toBe('in')
    })
  })
})

describe('BagCalculator — custom bag override math', () => {
  beforeEach(() =>
    resetState({
      bagPresetId: 'custom',
      bagWidthOverride: '10',
      bagWidthOverrideUnit: 'cm',
      bagLengthOverride: '15',
      bagLengthOverrideUnit: 'cm',
    })
  )

  it('Fill Depth is deeper for a smaller custom bag than for the quart preset', async () => {
    // With 3.5g at medium grind (12.25 cm³ material), a 10×15 cm
    // custom bag yields fillDepth = 12.25 / (10*15) = 0.0817 cm.
    // The default quart preset (17.8×20.3 cm) yields
    // fillDepth = 12.25 / (17.8*20.3) = 0.0339 cm. The custom
    // bag's fill depth is ~2.4× deeper — the override is honored.
    // Render the custom-bag version.
    render(<BagCalculator tempC={110} />)
    const fillDepthCustom = await waitFor(() =>
      screen.getByTestId('bag-fill-depth')
    )
    await waitFor(() => {
      expect(fillDepthCustom.textContent ?? '').toMatch(/[0-9]+\.[0-9]+\s*cm/)
    })
    const customText = fillDepthCustom.textContent ?? ''
    const customMatch = customText.match(/([0-9]+\.[0-9]+)/)
    expect(customMatch).toBeTruthy()
    const customDepth = Number(customMatch![1])
    // 10 * 15 = 150; 12.25 / 150 = 0.0817 cm. Allow a tolerance
    // because the engine rounds to 3 decimals.
    expect(customDepth).toBeGreaterThan(0.07)
    expect(customDepth).toBeLessThan(0.1)

    // Now switch back to the quart preset and verify the fill
    // depth is shallower (the override no longer applies). This
    // proves the override actually changes the calculation, not
    // just that the depth happens to be in the right range.
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        bagPresetId: 'quart',
        bagWidthOverride: null,
        bagLengthOverride: null,
      },
    })
    const fillDepthPreset = await waitFor(() =>
      screen.getByTestId('bag-fill-depth')
    )
    await waitFor(() => {
      const newText = fillDepthPreset.textContent ?? ''
      const newMatch = newText.match(/([0-9]+\.[0-9]+)/)
      expect(newMatch).toBeTruthy()
      const presetDepth = Number(newMatch![1])
      // 17.8 * 20.3 = 361.34; 12.25 / 361.34 = 0.0339 cm.
      // The preset depth is shallower than the custom depth.
      expect(presetDepth).toBeLessThan(customDepth)
    })
  })
})
