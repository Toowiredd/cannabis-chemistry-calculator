/**
 * DecarbHeatmap — the temperature danger-zone visualization on the Decarb tab.
 *
 * Coverage (the 2026-07-25 ccc-uiux-reviewer report's BLOCKER B5 was the
 * missing test file + the needle-shift bug, both addressed here):
 *
 * - Mount with the default decarb state and verify the figure renders.
 * - **B5 fix** (`validation_report_dose_units.md` §6 B5): the `tempC`
 *   useMemo at DecarbHeatmap.tsx:56-64 used `units.tempUnit` (display) to
 *   drive the conversion instead of `decarb.tempOverrideUnit` (per-field).
 *   With a user-typed `240.1` °F override, toggling the global temp
 *   display unit from F → C re-interpreted the stored value in the new
 *   display unit and the needle jumped from ~75% to 100% (clamped).
 *   The fix keys the conversion on `decarb.tempOverrideUnit`, so the
 *   stored value always means the same physical temperature regardless
 *   of which display unit is active, and the needle stays put on
 *   toggle.
 * - **Display label** (DecarbHeatmap.tsx:104-106) follows the same fix:
 *   it now derives from `tempDisplay` (the converted-to-display-unit
 *   value) instead of always-C `tempC`, so the label respects the
 *   user's chosen unit.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { DecarbHeatmap } from '../DecarbHeatmap'
import { DEFAULT_DECARB, useAppStore } from '../../stores/appStore'

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

/** Reset state and pin the temp display unit so cross-test pollution
 * (the B5 test toggles `units.tempUnit` F → C) doesn't leak. */
function resetState(seed: Partial<typeof DEFAULT_DECARB> = {}) {
  useAppStore.setState(state => ({
    decarb: { ...DEFAULT_DECARB, ...seed },
    units: { ...state.units, tempUnit: 'C' },
  }))
}

/** The heatmap needle is the only element with `aria-hidden="true"`
 * AND `style.left` ending in `%`. The two boundary markers at
 * GREEN_YELLOW_BOUNDARY (90°C) and YELLOW_RED_BOUNDARY (116°C) also
 * have `style.left` with a `%` value, but they don't carry
 * `aria-hidden` — they are decorative sub-bars. */
function findNeedleLeftPct(container: HTMLElement): number {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>('div[aria-hidden="true"]')
  ).filter(el => el.style.left?.endsWith('%'))
  if (candidates.length === 0) {
    throw new Error('Heatmap needle not found')
  }
  // Defensive: if multiple, take the first (the needle). The component
  // is expected to render exactly one aria-hidden element with a %
  // left style.
  return parseFloat(candidates[0]?.style.left ?? '0')
}

describe('DecarbHeatmap — mount + render', () => {
  beforeEach(() => resetState())

  it('renders without crashing', () => {
    const { container } = render(<DecarbHeatmap />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('DecarbHeatmap — B5 fix (tempOverride per-field unit)', () => {
  beforeEach(() => resetState())

  it('needle position is stable when toggling the temp display unit (per-field wins)', () => {
    // The B5 fix: with a user-typed 240.1 °F override, the needle
    // should land at the same physical position whether the display
    // unit is F or C. 240.1 °F = ((240.1 - 32) * 5/9) = 115.6 °C.
    // needlePosition(115.6) = ((115.6 - 73) / 57) * 100 ≈ 74.7%.
    // Pre-fix, toggling F → C re-interpreted the stored 240.1 in
    // the new display unit (treating it as 240.1 °C) and the needle
    // jumped to 100% (clamped at MAX_TEMP=130). Post-fix the needle
    // stays put.
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        tempOverride: '240.1',
        tempOverrideUnit: 'F',
      },
      units: { ...useAppStore.getState().units, tempUnit: 'F' },
    })
    const { container: fContainer } = render(<DecarbHeatmap />)
    const fLeft = findNeedleLeftPct(fContainer)
    // 240.1 F → 115.6 C → needle at 74.7%. Sanity-check the F
    // baseline is what we expect before toggling.
    expect(fLeft).toBeGreaterThan(70)
    expect(fLeft).toBeLessThan(80)

    // Re-render with the display unit toggled to C. The needle
    // should be in the same position because the stored value
    // interpretation did not change.
    useAppStore.setState({
      units: { ...useAppStore.getState().units, tempUnit: 'C' },
    })
    const { container: cContainer } = render(<DecarbHeatmap />)
    const cLeft = findNeedleLeftPct(cContainer)

    expect(cLeft).toBeCloseTo(fLeft, 1)
  })

  it('display label reflects the per-field temperature in the display unit (F display)', () => {
    // 240.1 °F stored. The display unit is also F, so the label
    // should show "240°F" (the value in the display unit, rounded
    // to whole degrees). The post-fix label derives from
    // `tempDisplay` (the same physical temp, in the chosen display
    // unit), so a user-typed 240.1 in F and display=F round-trips
    // to "240°F" — NOT the pre-fix "240°C" that ignored the display
    // unit.
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        tempOverride: '240.1',
        tempOverrideUnit: 'F',
      },
      units: { ...useAppStore.getState().units, tempUnit: 'F' },
    })
    const { container } = render(<DecarbHeatmap />)
    // The display span is the second child of the header div; the
    // first child is the "Temperature Danger Zone" label. Find by
    // class signature.
    const displaySpan = container.querySelector('span.text-foreground\\/50')
    expect(displaySpan?.textContent).toMatch(/240°F/)
  })

  it('display label reflects the per-field temperature in the display unit (C display)', () => {
    // Same input (240.1 typed in F) but display is C. The label
    // should show "116°C" (240.1 F → 115.6 C, rounded to 116).
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        tempOverride: '240.1',
        tempOverrideUnit: 'F',
      },
      units: { ...useAppStore.getState().units, tempUnit: 'C' },
    })
    const { container } = render(<DecarbHeatmap />)
    const displaySpan = container.querySelector('span.text-foreground\\/50')
    expect(displaySpan?.textContent).toMatch(/116°C/)
  })

  it('typed-in-C override is read as C even when display is F', () => {
    // Symmetric coverage: user types 115 in C, then toggles to F.
    // Pre-fix the F display would have triggered the (v - 32) * 5/9
    // branch and yielded 46.1 °C → needle at 0% (clamped at MIN_TEMP).
    // Post-fix, 115 °C is read as 115 °C, and 115 C → 239 F
    // (display) which is the same physical position.
    useAppStore.setState({
      decarb: {
        ...DEFAULT_DECARB,
        tempOverride: '115',
        tempOverrideUnit: 'C',
      },
      units: { ...useAppStore.getState().units, tempUnit: 'C' },
    })
    const { container: cContainer } = render(<DecarbHeatmap />)
    const cLeft = findNeedleLeftPct(cContainer)
    // 115 C → ((115 - 73) / 57) * 100 ≈ 73.7%. Sanity-check the
    // baseline.
    expect(cLeft).toBeGreaterThan(70)
    expect(cLeft).toBeLessThan(78)

    useAppStore.setState({
      units: { ...useAppStore.getState().units, tempUnit: 'F' },
    })
    const { container: fContainer } = render(<DecarbHeatmap />)
    const fLeft = findNeedleLeftPct(fContainer)
    expect(fLeft).toBeCloseTo(cLeft, 1)
  })

  it('no override uses the preset temperature (no per-field unit involved)', () => {
    // Sanity check: with no tempOverride, the heatmap pulls from
    // the preset's preset.tempC. Toggling the display unit changes
    // the LABEL but the needle stays in the same position because
    // the underlying C value is unchanged.
    useAppStore.setState({
      decarb: { ...DEFAULT_DECARB, tempOverride: null },
      units: { ...useAppStore.getState().units, tempUnit: 'C' },
    })
    const { container: cContainer } = render(<DecarbHeatmap />)
    const cLeft = findNeedleLeftPct(cContainer)

    useAppStore.setState({
      units: { ...useAppStore.getState().units, tempUnit: 'F' },
    })
    const { container: fContainer } = render(<DecarbHeatmap />)
    const fLeft = findNeedleLeftPct(fContainer)

    expect(fLeft).toBeCloseTo(cLeft, 1)
  })
})
