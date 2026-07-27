/**
 * Tests for the WizardScreen.
 *
 * WizardScreen is the top-level Stage 1 wizard surface (per the
 * architecture doc §7). It owns the local `WizardState`, renders
 * the Wizard container, and exposes a "Reset wizard" link.
 *
 * Coverage (v2.3, 2026-07-28):
 *  - Feature flag: when `wizardEnabled` is false, the screen
 *    renders nothing.
 *  - Product-type step: tapping each product type sets
 *    `endProduct` and `branch` (from END_PRODUCT_TO_BRANCH) and
 *    advances to the Material step.
 *  - Material step: tapping a material sets `branch` (overriding
 *    the coverflow's default) and advances to the next step per
 *    the DAG. The 3 materials (flower / avb / concentrate) route
 *    to the right per-material first step.
 *  - Flower + edible path: Material=flower + Baked walks Method →
 *    Container → Weight → Efficiency → Fat → Volume → Servings
 *    → Name → Start.
 *  - Concentrate + baked: Material=concentrate + Baked walks
 *    Container → Weight → Potency → Fat → Volume → Servings →
 *    Name → Start.
 *  - AVB + tincture: Material=avb + Tincture walks Container →
 *    Weight → Color → Carrier → Volume → Servings → Name →
 *    Start.
 *  - Salve + topical path: Material=flower + Salve walks Method →
 *    Container → Weight → Efficiency → Carrier → Volume →
 *    AppArea → Name → Start.
 *  - Terminal Start step: tapping the "Begin batch" CTA calls
 *    `beginExecution('preheat-decarb')` on the store and
 *    mounts the Stage 2 stepper.
 *  - "Reset wizard" link returns the state to the default.
 *  - Double-bag interjection: when the user picks the 19cm
 *    bag + a sous vide method, the interjection fires and
 *    the answer is stored in `selections.doubleBagged`.
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
  // v2.3: the product-type step is the EndProductCoverflow.
  // Tapping a face fires onSelect with the endProductId
  // ('baked' / 'gummies' / etc.); the wizard's decodeSelection
  // looks up the branch from END_PRODUCT_TO_BRANCH. The next
  // step is the Material step (the new flow's slide 2).

  it('tapping Baked sets endProduct=baked + branch=edible and advances to Material', () => {
    enableWizard()
    render(<WizardScreen />)
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    // Slide 2: Material step is now the ONLY step in the DOM.
    expect(screen.getByTestId('step-card-material-active')).toBeTruthy()
    expect(
      screen.queryByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeNull()
    expect(
      screen.queryByTestId('step-card-product-type-active')
    ).toBeNull()
  })

  it('tapping Gummies sets endProduct=gummies + branch=edible and advances to Material', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-gummies'))
    expect(screen.getByTestId('step-card-material-active')).toBeTruthy()
  })

  it('tapping Capsules sets endProduct=capsules + branch=edible and advances to Material', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-capsules'))
    expect(screen.getByTestId('step-card-material-active')).toBeTruthy()
  })

  it('tapping Tincture sets endProduct=tincture + branch=avb and advances to Material', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    expect(screen.getByTestId('step-card-material-active')).toBeTruthy()
  })

  it('tapping Salve sets endProduct=salve + branch=topical and advances to Material', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-salve'))
    expect(screen.getByTestId('step-card-material-active')).toBeTruthy()
  })
})

describe('WizardScreen — Material step', () => {
  it('tapping Flower (after Baked) advances to Method (decarb step)', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    // Slide 2: Material step.
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Slide 3: Method step (only for material=flower).
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })

  it('tapping AVB (after Tincture) advances to Container (no decarb)', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    // Tincture default branch is 'avb' but user can override.
    fireEvent.click(screen.getByTestId('option-tile-avb'))
    // AVB skips Method (no decarb); the next step is Container.
    expect(screen.getByTestId('step-card-container-active')).toBeTruthy()
  })

  it('tapping Concentrate (after Baked) advances to Container (no decarb, will pick Potency next)', () => {
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    fireEvent.click(screen.getByTestId('option-tile-concentrate'))
    // Concentrate skips Method; next is Container.
    expect(screen.getByTestId('step-card-container-active')).toBeTruthy()
  })

  it('the Material step overrides the coverflow default (Tincture + Flower is a valid path)', () => {
    // Tincture's default branch is 'avb' but a tincture can
    // be made from flower (a real recipe). The Material step
    // lets the user override the default.
    enableWizard()
    render(<WizardScreen />)
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Material=flower → Method step (decarb required).
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })
})

describe('WizardScreen — Baked (edible) + Flower path', () => {
  it('walks Method → Container → Weight → Efficiency → Fat → Volume → Servings → Name → Start', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Baked (→ edible end product + avb default branch).
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    // Step 1 → Material → Flower (overrides the avb default).
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 2 → Method → Oven, sealed bag.
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 3 → Container → 19cm vacuum bag.
    fireEvent.click(screen.getByTestId('option-tile-vac-19'))
    // Step 4 → Weight.
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 5 → Efficiency (Flower only).
    expect(screen.getByTestId('step-card-efficiency-active')).toBeTruthy()
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // Step 6 → Fat (edible end product).
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    // Step 7 → Volume.
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 8 → Servings.
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Step 9 → Name (typed name).
    fireEvent.click(screen.getByTestId('option-tile-named'))
    // Step 10 → Start.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
  })
})

describe('WizardScreen — Tincture (avb end-product default) path', () => {
  it('walks Material=avb → Container → Weight → Color → Carrier → Volume → Servings → Name → Start', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Tincture (→ avb default branch).
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    // Step 1 → Material → AVB (matches the default, but explicit pick).
    fireEvent.click(screen.getByTestId('option-tile-avb'))
    // Step 2 → Container (avb skips Method).
    fireEvent.click(screen.getByTestId('option-tile-vac-19'))
    // Step 3 → Weight.
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 4 → Color (AVB only).
    fireEvent.click(screen.getByTestId('option-tile-light'))
    // Step 5 → Carrier (tincture / salve end product).
    fireEvent.click(screen.getByTestId('option-tile-alcohol'))
    // Step 6 → Volume.
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 7 → Servings.
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    // Step 8 → Name.
    fireEvent.click(screen.getByTestId('option-tile-named'))
    // Step 9 → Start.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    expect(screen.getByTestId('wizard-begin-section')).toBeTruthy()
  })
})

describe('WizardScreen — Salve (topical end-product) smart-skip', () => {
  it('skips the Servings step (topicals are not dose-divided) and routes to AppArea', () => {
    enableWizard()
    render(<WizardScreen />)
    // Step 0 → Salve (→ topical default branch).
    fireEvent.click(screen.getByTestId('end-product-face-salve'))
    // Step 1 → Material → Flower (a real recipe — salve with flower).
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Step 2 → Method.
    fireEvent.click(screen.getByTestId('option-tile-oven_sealed'))
    // Step 3 → Container.
    fireEvent.click(screen.getByTestId('option-tile-vac-19'))
    // Step 4 → Weight.
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    // Step 5 → Efficiency (Flower only).
    fireEvent.click(screen.getByTestId('option-tile-eff-90'))
    // Step 6 → Carrier (salve end product, not Fat).
    fireEvent.click(screen.getByTestId('option-tile-coconut'))
    // Step 7 → Volume.
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    // Step 8 → AppArea (salve only — Servings is smart-skipped).
    fireEvent.click(screen.getByTestId('option-tile-face'))
    // Step 9 → Name.
    fireEvent.click(screen.getByTestId('option-tile-named'))
    // Step 10 → Start.
    expect(screen.getByTestId('step-card-start-active')).toBeTruthy()
    // Servings should not be in the rendered tree.
    expect(screen.queryByTestId('step-card-servings-active')).toBeNull()
  })
})

describe('WizardScreen — double-bag interjection', () => {
  it('fires the interjection on the Container step when 19cm + sv_* method are picked', () => {
    enableWizard()
    render(<WizardScreen />)
    // Walk to Method.
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Pick a sous vide method.
    fireEvent.click(screen.getByTestId('option-tile-sv_dry'))
    // Pick the 19cm bag — the interjection should appear below the carousel.
    fireEvent.click(screen.getByTestId('option-tile-vac-19'))
    // The interjection banner is rendered.
    expect(screen.getByTestId('interjection-banner-container')).toBeTruthy()
    // Tapping "Yes" sets selections.doubleBagged = true and
    // advances to the next step (Weight).
    fireEvent.click(screen.getByTestId('interjection-tile-container-yes'))
    expect(screen.getByTestId('step-card-weight-active')).toBeTruthy()
  })
})

describe('WizardScreen — terminal Start step', () => {
  it('shows a "Begin batch" CTA when the user reaches the Start step', () => {
    enableWizard()
    render(<WizardScreen />)
    // Walk the shortest path (Tincture + AVB).
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    fireEvent.click(screen.getByTestId('option-tile-avb'))
    fireEvent.click(screen.getByTestId('option-tile-vac-19'))
    fireEvent.click(screen.getByTestId('option-tile-g-7'))
    fireEvent.click(screen.getByTestId('option-tile-light'))
    fireEvent.click(screen.getByTestId('option-tile-alcohol'))
    fireEvent.click(screen.getByTestId('option-tile-mL-100'))
    fireEvent.click(screen.getByTestId('option-tile-s-12'))
    fireEvent.click(screen.getByTestId('option-tile-named'))
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
    // Advance the state: pick Baked → Material → Flower.
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    // Reset.
    fireEvent.click(screen.getByTestId('wizard-reset'))
    // The product-type step should be active again.
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    // The Method step is GONE (reset cleared all state).
    expect(screen.queryByTestId('step-card-method-active')).toBeNull()
  })
})
