/**
 * Tests for the WizardScreen.
 *
 * WizardScreen is the top-level Stage 1 wizard surface (per the
 * architecture doc §7 Week 1 scope). It owns the local `WizardState`,
 * renders the Wizard container, and exposes a "Reset wizard" link.
 *
 * Coverage:
 *  - Feature flag: when `wizardEnabled` is false, the screen
 *    renders nothing.
 *  - Product-type step: tapping "From raw flower" sets the branch
 *    to 'flower' and advances to step 1.
 *  - Flower Method step: tapping "Oven, sealed bag" sets
 *    `selections.method` and advances to step 2.
 *  - "Reset wizard" link returns the state to the default.
 *  - Coming-soon placeholder renders for non-Flower branches.
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
  it('tapping "From raw flower" sets branch=flower and advances to step 1', () => {
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

  it('tapping "For an edible or recipe" routes to the coming-soon step', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('option-tile-edible'))
    // The edible branch has only productType + coming-soon for
    // week 1.
    expect(screen.getByTestId('step-card-coming-soon-active')).toBeTruthy()
  })
})

describe('WizardScreen — Flower Method step', () => {
  it('tapping "Oven, sealed bag" sets selections.method and advances to step 2', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → pick Flower.
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 1 → pick Oven, sealed bag.
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // After both taps, the Method step is collapsed-with-selection
    // and the Name-step placeholder appears.
    expect(
      screen.getByTestId('step-card-method-collapsed-with-selection')
    ).toBeTruthy()
    expect(screen.getByTestId('wizard-name-step-placeholder')).toBeTruthy()
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
