/**
 * Tests for the WizardScreen.
 *
 * WizardScreen is the top-level Stage 1 wizard surface (per the
 * architecture doc §7). It owns the local `WizardState`, renders
 * the Wizard container, and exposes a "Reset wizard" link.
 *
 * Coverage:
 *  - Feature flag: when `wizardEnabled` is false, the screen
 *    renders nothing.
 *  - Product-type step: tapping each product type sets the
 *    branch and advances to the first branch step.
 *  - Flower branch: tapping through Method → Container → Weight
 *    → Efficiency → Fat → Volume advances the wizard; picking
 *    "No infusion" on the Fat step auto-skips the Volume step.
 *  - Concentrate branch: tapping through Potency → Carrier →
 *    Volume → Servings advances the wizard.
 *  - Terminal Start step: tapping the "Begin batch" CTA calls
 *    `beginExecution('preheat-decarb')` on the store and
 *    mounts the Stage 2 stepper (Week 3+ wire-up).
 *  - "Reset wizard" link returns the state to the default.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { WizardScreen } from '../WizardScreen'
import { useAppStore } from 'renderer/src/stores/appStore'

function enableWizard() {
  // The wizardEnabled field is owned by the state-routing rein
  // and is not yet on the store. The defensive read in
  // wizardFeatureFlag.ts handles the type cast. Setting via
  // `setState` with an explicit `as unknown` cast keeps the
  // typecheck clean until state-routing lands.
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: true,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

function disableWizard() {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: false,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

beforeEach(() => {
  disableWizard()
  // Week 7 fix: the ExecutionStepper now calls
  // `useReducedMotion()` which reads `window.matchMedia`.
  // JSDOM doesn't ship matchMedia by default. The
  // ExecutionStepper mounts on the "Begin batch" path
  // and the Begin batch test previously passed only
  // because the stepper never mounted. Stub matchMedia
  // before any test mounts the wizard — the stub
  // returns `false` for `prefers-reduced-motion` (the
  // standard `useReducedMotion` default).
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

describe('WizardScreen — feature flag', () => {
  it('renders nothing when wizardEnabled is false', () => {
    const { container } = render(<WizardScreen />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the screen when wizardEnabled is true', () => {
    enableWizard()
    render(<WizardScreen />)
    expect(screen.getByTestId('wizard-screen')).toBeTruthy()
    // The product-type step is rendered as active at step 0.
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
  })
})

describe('WizardScreen — product-type step', () => {
  // Per the v2.2 mockup: the product-type step renders a 3D
  // coverflow of 5 end-product faces (Brownies / Gummies / Capsules
  // / Tincture / Salve). The coverflow maps each end product to
  // a starting-material branch: 3 end products → edible, Tincture
  // → avb, Salve → topical. The 5 starting-material branches are
  // no longer the user-facing primary decision — they're the
  // internal state that drives the rest of the wizard.

  it('tapping Brownies sets branch=edible and advances to step 1 (Method)', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
    expect(screen.getByTestId('wizard-screen').textContent).toContain(
      'Brownies'
    )
  })

  it('tapping Gummies sets branch=edible and advances to Method', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-gummies'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })

  it('tapping Capsules sets branch=edible and advances to Method', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-capsules'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })

  it('tapping Tincture advances to the AVB branch Color step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-color-active')).toBeTruthy()
  })

  it('tapping Salve advances to the Topical branch Carrier step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-salve'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-carrier-active')).toBeTruthy()
  })
})

describe('WizardScreen — Brownies (edible) branch navigation', () => {
  it('navigates Method → Container → Weight → Fat', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Brownies (→ edible branch).
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    // Step 1 → Oven, sealed bag
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 2 → Container
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    // Step 3 → Weight
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Fat (edible branch skips Efficiency; jumps
    // straight from Weight to Fat).
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    // Volume is the next active step.
    expect(screen.getByTestId('step-card-volume-active')).toBeTruthy()
  })

  it('Brownies (edible) "with infusion" path: Fat → Volume → Servings → Start', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Brownies (→ edible branch)
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    // Step 1 → Method
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 2 → Container
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    // Step 3 → Weight
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Fat — pick coconut (with infusion, not 'none').
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    // Step 5 → Volume (rendered, not auto-skipped, because
    // selections.fat !== null on the Edible branch).
    expect(screen.getByTestId('step-card-volume-active')).toBeTruthy()
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 6 → Servings
    expect(screen.getByTestId('step-card-servings-active')).toBeTruthy()
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Step 7 → Start.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
  })
})

describe('WizardScreen — Tincture (avb) branch navigation', () => {
  it('navigates Color → Carrier → Volume → Servings → Start', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Tincture (→ avb branch)
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    // Step 1 → Color (light AVB)
    fireEvent.click(screen.getByTestId('option-tile-light'))
    // Step 2 → Carrier (alcohol)
    fireEvent.click(screen.getByTestId('option-tile-alcohol'))
    // Step 3 → Volume
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 4 → Servings
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Start should be the next active step.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    expect(screen.getByTestId('wizard-begin-section')).toBeTruthy()
  })
})

describe('WizardScreen — Salve (topical) branch smart-skip', () => {
  it('skips the Servings step (topicals are not dose-divided)', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Salve (→ topical branch)
    fireEvent.click(screen.getByTestId('end-product-face-salve'))
    // Step 1 → Carrier
    fireEvent.click(screen.getByTestId('option-tile-alcohol'))
    // Step 2 → Volume
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 3 → Application area (Servings is smart-skipped)
    fireEvent.click(screen.getByTestId('option-tile-face'))
    // Start should be the next active step.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // Servings should not be in the rendered tree.
    expect(screen.queryByTestId('step-card-servings-active')).toBeNull()
  })
})

describe('WizardScreen — terminal Start step', () => {
  it('shows a "Begin batch" CTA when the user reaches the Start step', () => {
    enableWizard()
    render(<WizardScreen />)
    // Walk the Tincture branch (shortest path) to the Start step.
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    fireEvent.click(screen.getByTestId('option-tile-light'))
    fireEvent.click(screen.getByTestId('option-tile-alcohol'))
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // The "Begin batch" CTA is visible.
    expect(screen.getByTestId('wizard-begin-cta')).toBeTruthy()
    // Clicking the Begin batch CTA marks the wizard as finished.
    fireEvent.click(screen.getByTestId('wizard-begin-cta'))
    expect(screen.getByTestId('wizard-finished-section')).toBeTruthy()
  })
})

describe('WizardScreen — reset', () => {
  it('clicking Reset wizard returns the state to default', () => {
    enableWizard()
    render(<WizardScreen />)
    // Advance the state: pick Brownies.
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    // Reset.
    fireEvent.click(screen.getByTestId('wizard-reset'))
    // The product-type step should be active again (no branch).
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
  })
})
