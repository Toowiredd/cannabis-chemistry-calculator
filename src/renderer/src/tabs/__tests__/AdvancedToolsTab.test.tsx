/**
 * AdvancedToolsTab — Fats sub-tab UI tests.
 *
 * Coverage (the 2026-07-25 ccc dose-units audit said the Fats sub-tab
 * was missing executable UI test coverage; this file is the audit's
 * recommended fix — MAJOR #5 from the uiux-reviewer, scope-bounded to
 * the FatsSection component at AdvancedToolsTab.tsx:79-340):
 *
 * - Mount + render — Fats section renders one card per `INFUSION_FATS`
 *   entry (currently 4: ghee, coconut, mct, custom). Each card has
 *   its data-testid.
 * - Per-fat mg/mL calculation — the displayed concentration for each
 *   fat matches `calculateMgPerMl(infusedThc, volumeMl)` for the seeded
 *   infusion state. This pins the engine wiring AND verifies the
 *   per-field-unit refactor (audit B3): the calculation uses
 *   `infusion.volumeUnit`, NOT the display unit.
 * - "Use This" handoff — clicking a card's "Use This" button calls
 *   `setInfusion({ fatId })` with the card's id AND `setActiveTab('infusion')`.
 *   Documented at
 *   docs/experience-topology/cannabis-chemistry-calculator-topology.json
 *   (`reference_tools → infusion_calculator`, data contract
 *   `FatSelection { fatId: string }`).
 * - "Best Extraction" badge — exactly one card carries the badge. The
 *   badge moves when a different fat is configured to have a higher
 *   extraction efficiency (the custom fat uses `infusion.customEfficiency`).
 * - Per-field volume unit is preserved across display-unit toggles
 *   (the B3 fix pin) — set `infusion.volume = "100"`, `volumeUnit = "mL"`,
 *   `units.volumeUnit = "cup"`. The Fats sub-tab must treat the
 *   100 as mL (per-field), not 100 cups (display). Asserted by the
 *   resulting mg/mL value: 500 mg * 0.82 / 100 mL = 4.1; with the
 *   bug present it would be 500 * 0.82 / 23658.8 ≈ 0.017.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { AdvancedToolsTab } from '../AdvancedToolsTab'
import { DEFAULT_INFUSION, useAppStore } from '../../stores/appStore'
import { calculateInfusedThc, calculateMgPerMl } from '../../engine/infusion'
import { INFUSION_FATS } from '../../engine/models'
import { volumeToMl } from '../../engine/units'

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

/** Reset the infusion slice to a known seed between tests. The
 * AdvancedToolsTab (Fats section) reads `infusion.decarbedThc`,
 * `infusion.volume`, `infusion.volumeUnit`, `infusion.customEfficiency`,
 * and `infusion.fatId` directly. Default sub-tab is 'fats', so the
 * Fats section is what the user sees on mount. */
function resetInfusion(
  seed: Partial<typeof DEFAULT_INFUSION> = {}
): void {
  useAppStore.setState({
    infusion: { ...DEFAULT_INFUSION, ...seed },
  })
  useAppStore.setState({
    advancedTools: {
      ...useAppStore.getState().advancedTools,
      subTab: 'fats',
    },
  })
  useAppStore.setState({ activeTab: 'advanced' })
}

/** Drive the debounced useEffect (300ms) by waiting for the results
 * to populate. Each fat's data-testid becomes available only after
 * the `setResults` call inside the debounced effect. */
async function waitForFatsResults() {
  await waitFor(
    () => {
      // The "Final THC" span (fat-thc-{id}) is rendered only when
      // `fatResults` is populated, which happens after the 300ms
      // debounced effect settles. We poll for the coconut card's
      // data-testid to be present.
      expect(screen.getByTestId('fat-thc-coconut')).toBeTruthy()
    },
    { timeout: 3000 }
  )
}

describe('AdvancedToolsTab — Fats sub-tab mount + render', () => {
  beforeEach(() => resetInfusion())

  it('renders without crashing', () => {
    const { container } = render(<AdvancedToolsTab />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders one fat card per INFUSION_FATS entry, each with the expected data-testid', async () => {
    // Seed the infusion so the Fats section's debounced effect
    // produces a result (an empty decarbedThc would short-circuit
    // the calc and render the empty-state spans, which have no
    // testids). The fat-thc-{id} and fat-mgperml-{id} spans are
    // only present when results have populated.
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    render(<AdvancedToolsTab />)
    // Wait for the debounced results to populate so the cards' inner
    // testids (`fat-thc-{id}` / `fat-mgperml-{id}`) become available.
    await waitForFatsResults()
    for (const fat of INFUSION_FATS) {
      expect(screen.getByTestId(`fat-card-${fat.id}`)).toBeTruthy()
      expect(screen.getByTestId(`fat-use-${fat.id}`)).toBeTruthy()
      // fat-thc-{id} and fat-mgperml-{id} are only present when
      // results have populated (the empty-state copy has no
      // testid). Their presence is the mount+results signal.
      expect(screen.getByTestId(`fat-thc-${fat.id}`)).toBeTruthy()
      expect(screen.getByTestId(`fat-mgperml-${fat.id}`)).toBeTruthy()
    }
    // Sanity check: the count matches the data, so the test will
    // fail if a future refactor silently drops a fat from the
    // comparison table.
    const cards = screen.getAllByTestId(/^fat-card-/)
    expect(cards.length).toBe(INFUSION_FATS.length)
  })
})

describe('AdvancedToolsTab — Fats sub-tab engine wiring', () => {
  beforeEach(() => resetInfusion())

  it('per-fat mg/mL matches calculateMgPerMl(infusedThc, volumeMl) for the seeded state', async () => {
    // Seed: 500 mg decarbed at 100 mL. Per the engine:
    // - coconut (0.82): 500 * 0.82 = 410 mg infused, 410 / 100 = 4.1 mg/mL
    // - ghee    (0.85): 500 * 0.85 = 425 mg infused, 425 / 100 = 4.25 → 4.3
    // - mct     (0.92): 500 * 0.92 = 460 mg infused, 460 / 100 = 4.6
    // - custom  (uses infusion.customEfficiency = 0.82): 410 / 100 = 4.1
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    for (const fat of INFUSION_FATS) {
      const eff = fat.id === 'custom'
        ? parseFloat(DEFAULT_INFUSION.customEfficiency)
        : fat.extractionEff
      const infusedThc = calculateInfusedThc(500, eff)
      const expectedMgPerMl = calculateMgPerMl(infusedThc, 100)
      const actualText = screen
        .getByTestId(`fat-mgperml-${fat.id}`)
        .textContent ?? ''
      const match = actualText.match(/([0-9]+(?:\.[0-9]+)?)\s*mg\/mL/)
      expect(match).toBeTruthy()
      const actualMgPerMl = Number(match![1])
      expect(actualMgPerMl).toBe(expectedMgPerMl)
    }
  })

  it('the "Best Extraction" badge sits on the fat with the highest extractionEff', async () => {
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    // mct (0.92) is the highest among ghee/coconut/mct. custom uses
    // DEFAULT_INFUSION.customEfficiency = 0.82, so mct wins by
    // default. The badge testid is `fat-best-badge` (a single
    // element, not per-fat) — assert it's inside the mct card.
    const mctCard = screen.getByTestId('fat-card-mct')
    expect(within(mctCard).getByTestId('fat-best-badge')).toBeTruthy()
    // And it's NOT inside any other card.
    for (const fat of INFUSION_FATS) {
      if (fat.id === 'mct') continue
      const card = screen.getByTestId(`fat-card-${fat.id}`)
      expect(within(card).queryByTestId('fat-best-badge')).toBeNull()
    }
  })

  it('the "Best Extraction" badge moves when customEfficiency overtakes mct (0.92)', async () => {
    // Bump the custom fat's efficiency to 0.95 — mct (0.92) loses.
    resetInfusion({
      decarbedThc: '500',
      volume: '100',
      volumeUnit: 'mL',
      customEfficiency: '0.95',
    })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    // Now the badge is on the custom card, not on mct.
    const customCard = screen.getByTestId('fat-card-custom')
    expect(within(customCard).getByTestId('fat-best-badge')).toBeTruthy()
    const mctCard = screen.getByTestId('fat-card-mct')
    expect(within(mctCard).queryByTestId('fat-best-badge')).toBeNull()
  })
})

describe('AdvancedToolsTab — Fats sub-tab "Use This" handoff', () => {
  beforeEach(() => resetInfusion())

  it('clicking "Use This" calls setInfusion({ fatId }) with the card id AND setActiveTab("infusion")', async () => {
    // Seed so the cards render with a stable known state.
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    // Click the ghee card's "Use This" button.
    const useGheeBtn = screen.getByTestId('fat-use-ghee')
    expect(useGheeBtn).toBeTruthy()
    // The button is text-labeled "Use This" but its accessible name
    // is `aria-label="Use Ghee"` — fireEvent.click doesn't require
    // the accessible name; data-testid is enough.
    fireEvent.click(useGheeBtn)
    // Both store actions fire synchronously inside the click handler
    // (no debounce). The store is the source of truth; verify it
    // directly rather than re-querying the DOM (the Fats sub-tab
    // unmounts when activeTab leaves 'advanced').
    expect(useAppStore.getState().infusion.fatId).toBe('ghee')
    expect(useAppStore.getState().activeTab).toBe('infusion')
  })

  it('the "Use This" buttons have aria-labels naming the fat', async () => {
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    for (const fat of INFUSION_FATS) {
      const btn = screen.getByTestId(`fat-use-${fat.id}`)
      expect(btn.getAttribute('aria-label')).toBe(`Use ${fat.name}`)
    }
  })
})

describe('AdvancedToolsTab — Fats sub-tab B3 fix (per-field volume unit)', () => {
  beforeEach(() => resetInfusion())

  it('volume unit display toggle does NOT change the Fats calculation (per-field wins)', async () => {
    // Set up the exact scenario the audit reported (B3): user types
    // 100 mL on Infusion, toggles display to cup, then navigates to
    // AdvancedToolsTab → Fats. The Fats section must use 100 mL
    // (per-field unit) for the calculation, NOT 100 cups (display).
    //   volume = "100", volumeUnit = "mL", units.volumeUnit = "cup"
    //   decarbedThc = "500", fatId = "coconut" (0.82)
    //   Expected: 500 * 0.82 / 100 = 4.1 mg/mL for coconut
    //   Bug behavior: 500 * 0.82 / 23658.8 ≈ 0.017 mg/mL (rounds to 0.0)
    resetInfusion({ decarbedThc: '500', volume: '100', volumeUnit: 'mL' })
    // Set the DISPLAY unit to a different unit. The Fats section
    // must NOT use this for its calculation; it must use
    // `infusion.volumeUnit` (mL).
    useAppStore.setState(state => ({
      units: { ...state.units, volumeUnit: 'cup' },
    }))
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    // Engine value for the per-field-unit (correct) path.
    const expected = calculateMgPerMl(
      calculateInfusedThc(500, 0.82),
      // Per-field unit is 'mL' → volumeToMl(100, 'mL') = 100.
      volumeToMl(100, 'mL')
    )
    const text = screen.getByTestId('fat-mgperml-coconut').textContent ?? ''
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*mg\/mL/)
    expect(match).toBeTruthy()
    const displayed = Number(match![1])
    expect(displayed).toBe(expected)
    // And the wrong-unit path would have produced 0 (or NaN — the
    // .toFixed(1) of ~0.017 is "0.0"). Sanity-check we are NOT on
    // that path.
    expect(displayed).toBeGreaterThan(3.0)
  })

  it('changing per-field volumeUnit (mL → tbsp) reflects in the Fats calculation', async () => {
    // Same 500 mg decarbed, coconut (0.82). The user TYPES the
    // value in a different per-field unit, then the Fats section
    // re-interprets correctly. 100 tbsp = 100 * 14.787 = 1478.7 mL.
    // Expected: 500 * 0.82 / 1478.7 ≈ 0.28 mg/mL.
    resetInfusion({
      decarbedThc: '500',
      volume: '100',
      volumeUnit: 'tbsp',
    })
    render(<AdvancedToolsTab />)
    await waitForFatsResults()
    const expected = calculateMgPerMl(
      calculateInfusedThc(500, 0.82),
      volumeToMl(100, 'tbsp')
    )
    const text = screen.getByTestId('fat-mgperml-coconut').textContent ?? ''
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*mg\/mL/)
    expect(match).toBeTruthy()
    const displayed = Number(match![1])
    expect(displayed).toBe(expected)
  })
})
