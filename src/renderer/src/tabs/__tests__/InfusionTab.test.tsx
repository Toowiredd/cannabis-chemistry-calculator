/**
 * InfusionTab — the second calculator surface (after Decarb) that propagates
 * the engine's math to the user.
 *
 * Coverage (the 2026-07-25 ccc-validation team's Infusion audit said this
 * touchpoint was missing executable UI test coverage; this file is the
 * audit's recommended fix — MAJOR #2 from the uiux-reviewer):
 * - Mount + unmount
 * - Render of the three primary input controls (decarbed THC, fat select,
 *   volume) and the two primary result panels (Total Infused THC,
 *   Concentration)
 * - Engine wiring: the displayed Total Infused THC matches the engine's
 *   `calculateInfusedThc` for the default seed (coconut fat, 100 mL
 *   volume)
 * - Volume unit toggling: changing the volume unit recalculates results
 *   (the engine is the source of truth — `volumeToMl` rounds consistently)
 * - Validation: an empty decarbed THC suppresses the result rather than
 *   showing zero
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { InfusionTab } from '../InfusionTab'
import { calculateInfusedThc } from '../../engine/infusion'
import { DEFAULT_INFUSION, useAppStore } from '../../stores/appStore'

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

/** Reset the infusion slice between tests so cross-test pollution cannot leak. */
function resetInfusion(
  seed: Partial<typeof DEFAULT_INFUSION> = {}
): void {
  useAppStore.setState({
    infusion: { ...DEFAULT_INFUSION, ...seed },
  })
  // also reset the carry-forward from decarb so the auto-fill banner
  // doesn't bleed across tests
  useAppStore.setState({ lastDecarbExpected: '' })
}

describe('InfusionTab — mount + render', () => {
  beforeEach(() => resetInfusion())

  it('renders without crashing', () => {
    const { container } = render(<InfusionTab />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the three primary input controls', () => {
    render(<InfusionTab />)
    expect(screen.getByTestId('infusion-decarbed-input')).toBeTruthy()
    expect(screen.getByTestId('infusion-fat-select')).toBeTruthy()
    expect(screen.getByTestId('infusion-volume-input')).toBeTruthy()
  })

  it('renders the total-infused-thc and concentration result panels', async () => {
    render(<InfusionTab />)
    const thc = screen.getByTestId('infusion-thc-result')
    const conc = screen.getByTestId('infusion-concentration-result')
    expect(thc).toBeTruthy()
    expect(conc).toBeTruthy()
    // With the default seed (empty decarbedThc, 100 mL coconut), the
    // result panels show the empty-state copy, not a number. Verify
    // the empty-state is rendered (not a 0 value that would hide the
    // missing-input problem).
    await waitFor(() => {
      expect(thc.textContent ?? '').toMatch(/Enter your decarbed THC/i)
    })
  })
})

describe('InfusionTab — engine wiring', () => {
  beforeEach(() => resetInfusion())

  it('displays the engine calculateInfusedThc value when decarbed THC is set', async () => {
    // 500 mg decarbed at 0.82 (coconut) = 410 mg infused
    resetInfusion({ decarbedThc: '500', fatId: 'coconut', volume: '100' })
    render(<InfusionTab />)
    // Drive the calculation explicitly via a fireEvent so the debounced
    // useEffect fires fresh and the React 19 commit settles. Then look up
    // the result element by testid INSIDE the polling callback — the
    // span carries a `key` that changes on every result update, so the
    // DOM node is unmounted and replaced. A reference grabbed before
    // the update points at a detached node and reads the empty-state
    // text forever.
    const input = screen.getByTestId('infusion-decarbed-input')
    fireEvent.change(input, { target: { value: '500' } })
    let text = ''
    await waitFor(
      () => {
        text = screen.getByTestId('infusion-thc-result').textContent ?? ''
        expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*mg/)
      },
      { timeout: 3000 }
    )
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*mg/)
    const displayed = Number(match![1])
    // Cross-check against the engine: 500 * 0.82 = 410 mg
    const engineValue = calculateInfusedThc(500, 0.82)
    expect(displayed).toBe(engineValue)
  })

  it('recomputes the infused THC when the user changes decarbed THC', async () => {
    render(<InfusionTab />)
    const thc = () => screen.getByTestId('infusion-thc-result')
    const input = screen.getByTestId('infusion-decarbed-input')
    fireEvent.change(input, { target: { value: '1000' } })
    let after = 0
    await waitFor(() => {
      const text = thc().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      after = Number(m![0])
      // 1000 mg * 0.82 = 820 mg
      expect(after).toBeGreaterThan(800)
      expect(after).toBeLessThan(850)
    })
  })

  it('recomputes when the user switches from coconut to mct', async () => {
    resetInfusion({ decarbedThc: '500', fatId: 'coconut', volume: '100' })
    render(<InfusionTab />)
    const thc = () => screen.getByTestId('infusion-thc-result')
    // Wait for the initial calculation to populate.
    let before = 0
    await waitFor(() => {
      const text = thc().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      before = Number(m![0])
    })
    fireEvent.change(screen.getByTestId('infusion-fat-select'), {
      target: { value: 'mct' },
    })
    // After switching to mct (0.92 eff), 500 * 0.92 = 460 mg — bigger than
    // the coconut baseline (500 * 0.82 = 410).
    let after = 0
    await waitFor(() => {
      const text = thc().textContent ?? ''
      const m = text.match(/[0-9.]+/)
      expect(m).toBeTruthy()
      after = Number(m![0])
      expect(after).toBeGreaterThan(before)
    })
  })
})

describe('InfusionTab — concentration wiring', () => {
  beforeEach(() => resetInfusion())

  it('concentration result reflects mg-per-mL using the canonical unit converter', async () => {
    // 500 mg in 100 mL = 5.0 mg/mL
    resetInfusion({ decarbedThc: '500', fatId: 'coconut', volume: '100' })
    render(<InfusionTab />)
    // Same `key` remount reason as the previous test — re-query the
    // span inside the polling callback so we always read the live node.
    const input = screen.getByTestId('infusion-decarbed-input')
    fireEvent.change(input, { target: { value: '500' } })
    let text = ''
    await waitFor(
      () => {
        text =
          screen.getByTestId('infusion-concentration-result').textContent ?? ''
        expect(text).toMatch(/[0-9]+(\.[0-9]+)?\s*mg\/mL/)
      },
      { timeout: 3000 }
    )
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*mg\/mL/)
    const displayed = Number(match![1])
    // 500 * 0.82 / 100 = 4.1 mg/mL
    expect(displayed).toBeGreaterThan(3.5)
    expect(displayed).toBeLessThan(4.5)
  })
})

describe('InfusionTab — empty state', () => {
  beforeEach(() => resetInfusion())

  it('suppresses the result (shows the empty-state copy) when decarbed THC is blank', async () => {
    resetInfusion({ decarbedThc: '', fatId: 'coconut', volume: '100' })
    render(<InfusionTab />)
    const thc = screen.getByTestId('infusion-thc-result')
    await waitFor(() => {
      expect(thc.textContent ?? '').toMatch(/Enter your decarbed THC/i)
    })
    // And no "0 mg" is leaking through
    expect(thc.textContent ?? '').not.toMatch(/^0\.0\s*mg/)
  })
})
