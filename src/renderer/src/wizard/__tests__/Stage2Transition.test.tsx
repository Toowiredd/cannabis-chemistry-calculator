/**
 * Stage 2 transition + decarb data-flow tests (Week 3).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §7, Week 3 wires
 * the Stage 1 → Stage 2 transition: tapping "Begin batch" mounts
 * the Stage 2 execution stepper, and the Flower branch's first two
 * decarb steps (preheat + heatmap) are driven by the engine data.
 *
 * Coverage:
 *  - Test 1: Stage 1 renders by default; the stepper does NOT
 *    mount when `execution.currentStepId` is null.
 *  - Test 2: Walking the Flower branch (full path: method →
 *    container → weight → efficiency → fat → volume → start)
 *    and tapping "Begin batch" mounts the stepper with the
 *    decarb preheat step. The target temp is read from the
 *    engine's `DECARB_METHODS[oven_sealed].tempC` (113°C).
 *  - Test 3: Tapping the preheat step's "I'm ready" CTA advances
 *    to the heatmap step via `completeExecutionStep`.
 *  - Test 4 (integration): `PreheatStep` renders the target temp
 *    + duration from props (covered by the design-system rein's
 *    own tests too; re-asserted here as a guard against drift).
 *  - Test 5 (integration): `HeatmapStep` exposes its props as
 *    data-attributes so the Stage 2 wire-up is testable end-to-end
 *    without scraping visible text.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { WizardScreen } from '../WizardScreen'
import { buildExecutionSteps } from '../stage2Steps'
import {
  DEFAULT_EXECUTION_STEP_STATE,
  useAppStore,
} from '../../stores/appStore'
import { HeatmapStep } from '../../components/execution/HeatmapStep'
import { PreheatStep } from '../../components/execution/PreheatStep'
import type { WizardState } from '../wizardTypes'

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

function enableWizard() {
  // The `wizardEnabled` field is owned by the state-routing rein
  // (landed alongside the `execution` slice in commit 51f8d89).
  // The defensive read in `wizardFeatureFlag.ts` keeps the
  // typecheck clean today; setting via `setState` with an
  // explicit cast mirrors the pattern in the Week 1+ tests.
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: true,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Week 4 flake fix: reset `wizardEnabled` to `false` between
 * tests. The Stage 2 tests flip the flag on via
 * `enableWizard()`; without this reset, the persist middleware
 * writes `true` to localStorage and pollutes the next test
 * file's rehydrate (notably
 * `screens/__tests__/main.test.tsx` which depends on the
 * default `false` value). Mirrors the helper added to
 * Stage2Recalculating.test.tsx.
 */
function disableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: false,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

/**
 * Reset the store's `execution` slice to the default empty form.
 * Vitest doesn't run `beforeEach` in the React render lifecycle
 * — components mount once per test and read whatever the store
 * has at mount time. Each Stage 2 test needs a clean slate so a
 * test that completed a step doesn't leak `currentStepId` into
 * the next test's render. Week 4 (2026-07-26 wizard build, §8.1)
 * added two new fields to `ExecutionStepState` (`isRecalculating`,
 * `affectedStepIds`); this helper imports the default so the
 * helper stays in lockstep with the canonical shape rather than
 * hardcoding the literal.
 */
function resetExecution() {
  useAppStore.setState(state => ({
    wizard: {
      ...state.wizard,
      execution: { ...DEFAULT_EXECUTION_STEP_STATE },
    },
  }))
}

/**
 * jsdom doesn't ship `matchMedia` by default. The
 * `DecarbHeatmap` widget (wrapped by `HeatmapStep`) reads
 * `useReducedMotion`, which calls `window.matchMedia`. Stub
 * it once before any test mounts the HeatmapStep so the
 * widget's `prefers-reduced-motion` check doesn't throw.
 */
function stubMatchMedia() {
  if (typeof window.matchMedia === 'function') return
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

beforeEach(() => {
  resetExecution()
  stubMatchMedia()
  // Week 4 flake fix: reset the wizard feature flag so the
  // next test file's rehydrate sees the default `false`.
  disableWizard()
})

/* ------------------------------------------------------------------ */
/* Test 1: Stage 1 default — no stepper                                */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Stage 1 default', () => {
  it('renders the wizard but NOT the execution stepper when execution.currentStepId is null', () => {
    enableWizard()
    render(<WizardScreen />)
    // Stage 1 mounts (the feature flag is on).
    expect(screen.getByTestId('wizard-screen')).toBeTruthy()
    // Stage 2 does not — execution hasn't been entered.
    expect(screen.queryByTestId('execution-stepper')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Test 2: Begin batch → Stage 2 with preheat step visible             */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Begin batch transitions to Stage 2', () => {
  it('mounts the stepper with the Flower oven_sealed preheat step after Begin batch', () => {
    enableWizard()
    // The Stage 2 builder only returns steps for the Flower
    // branch (the Edible / AVB / Topical / Concentrate branch
    // Stage 2 work is scoped in the architecture but not
    // implemented in the current build — see
    // `stage2Steps.ts:175-183`). Slide 1 of the v2.2 model
    // collapsed the coverflow from "starting material"
    // (Flower / Concentrate / AVB / Edible / Topical) to
    // "end product" (Baked / Gummies / Capsules / Tincture
    // / Salve), so the Flower branch is no longer reachable
    // from the coverflow in the UI. The Stage 2 tests
    // position the wizard at the Start step with a Flower
    // branch + full selections via the `initialState` prop
    // (test-only — production code does not pass it) so the
    // Stage 2 stepper is exercised end-to-end without
    // coupling the test to the coverflow's entry surface.
    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7, // Start step in the 8-step Flower-with-infusion sequence.
      selections: {
        method: 'oven_sealed',
        container: 'quart',
        weight: { value: 7, unit: 'g' },
        efficiency: 0.9,
        fat: 'coconut',
        volume: { value: 240, unit: 'mL' },
      },
    }
    render(<WizardScreen initialState={initialState} />)
    // The user is on the Start step. The "Begin batch" CTA
    // section is visible.
    expect(screen.getByTestId('wizard-begin-section')).toBeTruthy()
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    // Stage 2 mounted.
    expect(screen.getByTestId('execution-stepper')).toBeTruthy()
    // The Flower branch's first Stage 2 step is the preheat
    // step. The stepper's per-step shell wrapper carries the
    // `execution-step-preheat-decarb-shell` testid; inside it,
    // the PreheatStep renders the target temp in the
    // `preheat-step-target` element. (Note: a `preheat-step`
    // wrapper testid would be more idiomatic, but `GlassCard`
    // — the wrapper the PreheatStep uses — does not pass
    // through `data-testid` props; the child testids are the
    // canonical assertion surface until the design-system
    // rein widens GlassCard's prop contract.)
    expect(
      screen.getByTestId('execution-step-preheat-decarb-shell')
    ).toBeTruthy()
    // Week 5 update: with the infusion phase added to the
    // Flower with-infusion path, the stepper now renders
    // TWO preheat shells (`preheat-decarb` and
    // `preheat-infusion`). Both have a `preheat-step-target`
    // element. The test must scope the query to the
    // preheat-decarb shell specifically — `getByTestId` on
    // the global `screen` would now fail with
    // "Found multiple elements". The `within` helper
    // restricts the search to the named ancestor.
    const preheatDecarbShell = screen.getByTestId(
      'execution-step-preheat-decarb-shell'
    )
    expect(
      within(preheatDecarbShell).getByTestId('preheat-step-target').textContent
    ).toContain('113')
    // And the duration is the method's `timeMin` (60 min for
    // oven_sealed).
    expect(
      within(preheatDecarbShell).getByTestId('preheat-step-duration')
        .textContent
    ).toContain('60 min')
  })
})

/* ------------------------------------------------------------------ */
/* Test 3: Preheat complete → heatmap step visible                     */
/* ------------------------------------------------------------------ */

describe('WizardScreen — Stage 2 advance', () => {
  it('advancing past the preheat step reveals the heatmap step', () => {
    enableWizard()
    // See Test 2's comment for the rationale on using
    // `initialState` to position the wizard at the Start
    // step with a Flower branch (the only branch whose
    // Stage 2 path is built today).
    const initialState: WizardState = {
      branch: 'flower',
      currentStep: 7, // Start step.
      selections: {
        method: 'oven_sealed',
        container: 'quart',
        weight: { value: 7, unit: 'g' },
        efficiency: 0.9,
        fat: 'coconut',
        volume: { value: 100, unit: 'mL' },
      },
    }
    render(<WizardScreen initialState={initialState} />)
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    // Stage 2 mounted on the preheat step. Assert via the
    // shell wrapper testid (GlassCard does not pass through
    // `data-testid`, so the `preheat-step` testid is dropped
    // — see Test 2's comment for the full rationale).
    expect(
      screen.getByTestId('execution-step-preheat-decarb-shell')
    ).toBeTruthy()
    // The preheat step carries the "Current" badge. (The
    // heatmap step's shell IS also rendered at this point —
    // the stepper shows every step in the phase so the user
    // can scan-find their position — but it does NOT carry
    // the current badge yet.)
    expect(
      screen.getByTestId('execution-step-preheat-decarb-badge-current')
    ).toBeTruthy()
    expect(
      screen.queryByTestId('execution-step-heatmap-decarb-badge-current')
    ).toBeNull()
    // The preheat's "I'm ready" CTA fires the stepper's
    // onComplete, which the WizardScreen wires to
    // `completeExecutionStep('preheat-decarb', 'heatmap-decarb')`.
    // The with-infusion path renders BOTH a preheat-decarb and
    // a preheat-infusion shell at the same time (Week 5), so
    // `preheat-step-ready` matches 2 elements on the global
    // `screen`; scope the click to the preheat-decarb shell
    // via `within`.
    const preheatDecarbShellForReady = screen.getByTestId(
      'execution-step-preheat-decarb-shell'
    )
    fireEvent.click(
      within(preheatDecarbShellForReady).getByTestId('preheat-step-ready')
    )
    // The preheat collapses to its completed summary.
    expect(
      screen.getByTestId('execution-step-preheat-decarb-complete')
    ).toBeTruthy()
    // And the heatmap step is now the current step (the
    // "Current" badge migrates from preheat → heatmap).
    expect(
      screen.getByTestId('execution-step-heatmap-decarb-badge-current')
    ).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/* Test 4: PreheatStep prop contract (integration)                     */
/* ------------------------------------------------------------------ */

describe('PreheatStep — Stage 2 preheat shell', () => {
  it('renders the target temperature from the prop', () => {
    render(
      <PreheatStep duration="60 min" onReady={() => {}} targetTemp={113} />
    )
    // The headline reads "Preheat oven to {targetTemp}°C". The
    // 113 is the canonical target for the oven_sealed method
    // (DECARB_METHODS[oven_sealed].tempC).
    expect(screen.getByTestId('preheat-step-target').textContent).toContain(
      '113°C'
    )
  })
})

/* ------------------------------------------------------------------ */
/* Test 5: HeatmapStep prop contract (integration)                     */
/* ------------------------------------------------------------------ */

describe('HeatmapStep — Stage 2 heatmap shell', () => {
  it('exposes its props as data-attributes for the Stage 2 wire-up', () => {
    const { container } = render(
      <HeatmapStep
        currentTemp={113}
        material="flower"
        progressPct={0}
        targetTemp={113}
      />
    )
    // The root container carries one data-attribute per prop.
    // The Stage 2 wire-up (week 4+) drives these from the
    // engine's per-second heatmap update; today they are set
    // by the WizardScreen's `buildExecutionSteps` output.
    const root = container.querySelector('[data-testid="heatmap-step"]')
    expect(root?.getAttribute('data-target-temp')).toBe('113')
    expect(root?.getAttribute('data-current-temp')).toBe('113')
    expect(root?.getAttribute('data-progress-pct')).toBe('0')
    expect(root?.getAttribute('data-material')).toBe('flower')
  })
})

/* ------------------------------------------------------------------ */
/* Builder unit coverage — assert the Flower shape directly            */
/* ------------------------------------------------------------------ */

describe('buildExecutionSteps — Flower branch', () => {
  // Week 3 (commit 66c4818) added 2 steps — preheat + heatmap.
  // Week 4 (the current commit) grew the Flower Stage 2 path
  // to 4 steps by appending `timer-decarb` and
  // `transition-decarb`. The full Week 4 path is asserted
  // exhaustively in `Stage2Recalculating.test.tsx`; this
  // block stays the canonical "preheat + heatmap data flow"
  // pin (the Week 3 contract the integration tests depend
  // on) and adds the Week 4 step 2 + 3 sanity asserts so a
  // future regression to the pre-Week-4 builder shape is
  // caught here too (the test name is updated to drop the
  // literal "2-step" / "Week 3 scope" markers so the
  // description matches the new shape).
  it('returns the 4-step preheat + heatmap + timer + transition list for oven_sealed', () => {
    const steps = buildExecutionSteps('flower', { method: 'oven_sealed' })
    expect(steps).toHaveLength(4)
    expect(steps[0]?.id).toBe('preheat-decarb')
    expect(steps[0]?.phase).toBe('decarb')
    expect(steps[0]?.shell).toBe('preheat')
    expect(steps[0]?.targetTemp).toBe(113)
    expect(steps[0]?.duration).toBe('60 min')
    expect(steps[1]?.id).toBe('heatmap-decarb')
    expect(steps[1]?.phase).toBe('decarb')
    expect(steps[1]?.shell).toBe('heatmap')
    expect(steps[1]?.targetTemp).toBe(113)
    expect(steps[1]?.currentTemp).toBe(113)
    expect(steps[1]?.progressPct).toBe(0)
    expect(steps[1]?.material).toBe('flower')
    // Week 4 — timer step. Pinned to the oven_sealed
    // midpoint (60+90)/2 = 75 min → 4500 seconds; the
    // stir interval is the halfway point (2250s). The
    // exhaustive Week 4 builder coverage lives in
    // `Stage2Recalculating.test.tsx > buildExecutionSteps —
    // Flower (Week 4 scope)`; this block is the canonical
    // pre-Week-5 regression pin.
    expect(steps[2]?.id).toBe('timer-decarb')
    expect(steps[2]?.shell).toBe('timer')
    expect(steps[2]?.totalSeconds).toBe(75 * 60)
    // Week 4 — transition step. The message must contain
    // "infusion" so the §4.1 "Move to infusion" affordance
    // reads naturally.
    expect(steps[3]?.id).toBe('transition-decarb')
    expect(steps[3]?.phase).toBe('transition')
    expect(steps[3]?.shell).toBe('transition')
    expect(steps[3]?.message ?? '').toContain('infusion')
  })
})
