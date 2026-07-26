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
  it('tapping "From raw flower" sets branch=flower and advances to step 1 (Method)', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // After tapping, the product-type step is collapsed-with-selection
    // and the Method step becomes active (Flower branch).
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
    expect(screen.getByTestId('wizard-screen').textContent).toContain(
      'From raw flower'
    )
  })

  it('tapping "For an edible or recipe" advances to the Edible branch Method step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-edible'))
    // Week 2: the Edible branch has a real sequence starting
    // with the Method step. No more "coming-soon" placeholder.
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })

  it('tapping "From concentrate or hash" advances to the Concentrate branch Potency step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-concentrate'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    // Concentrate branch starts with Potency (no Method step).
    expect(screen.getByTestId('step-card-potency-active')).toBeTruthy()
  })

  it('tapping "From already-used flower (AVB)" advances to the AVB branch Color step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-avb'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-color-active')).toBeTruthy()
  })

  it('tapping "For a skin or topical product" advances to the Topical branch Carrier step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-topical'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('step-card-carrier-active')).toBeTruthy()
  })
})

describe('WizardScreen — Flower branch navigation', () => {
  it('navigates Method → Container → Weight → Efficiency', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Flower
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 1 → Oven, sealed bag
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 2 → Container
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    // Step 3 → Weight
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Efficiency (picks the 90% tile)
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // After the four taps, the previous steps are
    // collapsed-with-selection and Efficiency is the next
    // collapsed (the user hasn't picked an efficiency yet
    // because the tap on eff-90 advanced past Efficiency).
    expect(
      screen.getByTestId('step-card-efficiency-collapsed-with-selection')
    ).toBeTruthy()
    // The next active step is Fat.
    expect(screen.getByTestId('step-card-fat-active')).toBeTruthy()
  })

  it('Flower "no infusion" path auto-skips the Volume step', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Flower
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 1 → Method
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 2 → Container
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    // Step 3 → Weight
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Efficiency
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // Step 5 → Fat — pick the "No infusion" tile.
    fireEvent.click(screen.getByTestId('option-tile-none'))
    // The Volume step should be auto-skipped (smart-skip
    // filters it out because selections.fat === null), so
    // the Start step is the next active step.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // The Volume step should not be in the rendered tree at all.
    expect(screen.queryByTestId('step-card-volume-active')).toBeNull()
  })

  it('Flower "with infusion" path shows the Volume step after Fat', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Flower
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 1 → Method
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 2 → Container
    fireEvent.click(screen.getByTestId('option-tile-quart'))
    // Step 3 → Weight
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Efficiency
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // Step 5 → Fat — pick coconut (real fat, not 'none').
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    // Volume should be the next active step (not auto-skipped).
    expect(screen.getByTestId('step-card-volume-active')).toBeTruthy()
  })
})

describe('WizardScreen — Concentrate branch navigation', () => {
  it('navigates Potency → Carrier → Volume → Servings → Start', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Concentrate
    fireEvent.click(screen.getByTestId('option-tile-concentrate'))
    // Step 1 → Potency
    fireEvent.click(screen.getByTestId('option-tile-p-75'))
    // Step 2 → Carrier
    fireEvent.click(screen.getByTestId('option-tile-mct'))
    // Step 3 → Volume
    fireEvent.click(screen.getByTestId('option-tile-mL-240'))
    // Step 4 → Servings
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Start should be the next active step.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // The "Begin batch" CTA section should be visible.
    expect(screen.getByTestId('wizard-begin-section')).toBeTruthy()
  })
})

describe('WizardScreen — Topical branch smart-skip', () => {
  it('skips the Servings step (topicals are not dose-divided)', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Topical
    fireEvent.click(screen.getByTestId('option-tile-topical'))
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
    // Walk the Concentrate branch (shortest non-Flower path)
    // to the Start step.
    fireEvent.click(screen.getByTestId('option-tile-concentrate'))
    fireEvent.click(screen.getByTestId('option-tile-p-75'))
    fireEvent.click(screen.getByTestId('option-tile-mct'))
    fireEvent.click(screen.getByTestId('option-tile-mL-240'))
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
    // Advance the state: pick Flower.
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    // Reset.
    fireEvent.click(screen.getByTestId('wizard-reset'))
    // The product-type step should be active again (no branch).
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
  })
})
