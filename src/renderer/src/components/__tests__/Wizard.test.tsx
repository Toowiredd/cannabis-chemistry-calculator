/**
 * Tests for the Wizard container component.
 *
 * The Wizard is the vertical step-stack container. Two key
 * behaviors:
 *  - Feature flag: when `wizardEnabled` is false, the component
 *    returns `null` (the existing GroupedTabNav takes over).
 *  - Step stack: when the flag is on, it renders the steps for
 *    the current branch sequence.
 *
 * The feature-flag read is defensive (see wizardFeatureFlag.ts):
 * when the state-routing rein hasn't shipped the `wizardEnabled`
 * field yet, the read returns `false`. The tests below exercise
 * both branches.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { Wizard } from '../Wizard'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  DEFAULT_WIZARD_STATE,
  type WizardState,
} from 'renderer/src/wizard/wizardTypes'

beforeEach(() => {
  // Reset the wizardEnabled field between tests so the cast in
  // the wizardFeatureFlag module doesn't leak state.
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
  })
})

describe('Wizard — feature flag', () => {
  it('renders nothing when wizardEnabled is false (default)', () => {
    const { container } = render(
      <Wizard
        onEdit={() => {}}
        onSelect={() => {}}
        state={DEFAULT_WIZARD_STATE}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when wizardEnabled is explicitly false', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: false,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const { container } = render(
      <Wizard
        onEdit={() => {}}
        onSelect={() => {}}
        state={DEFAULT_WIZARD_STATE}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the product-type step when wizardEnabled is true and branch is null', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    render(
      <Wizard
        onEdit={() => {}}
        onSelect={() => {}}
        state={DEFAULT_WIZARD_STATE}
      />
    )
    // The product-type step is active at step 0. The active
    // StepCard has testid `step-card-product-type-active`.
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    // Per the v2.2 mockup: the product-type step renders a 3D
    // coverflow of 5 end-product faces (Brownies / Gummies /
    // Capsules / Tincture / Salve).
    expect(screen.getByTestId('end-product-coverflow')).toBeTruthy()
    for (const id of ['brownies', 'gummies', 'capsules', 'tincture', 'salve']) {
      expect(screen.getByTestId(`end-product-face-${id}`)).toBeTruthy()
    }
  })
})

describe('Wizard — branch sequences', () => {
  it('renders the product-type step as collapsed-with-selection when the branch is set', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const state: WizardState = {
      branch: 'flower',
      currentStep: 1,
      selections: {},
    }
    render(<Wizard onEdit={() => {}} onSelect={() => {}} state={state} />)
    // Step 0 (product type) is collapsed-with-selection because
    // the branch is set and currentStep is past 0.
    expect(
      screen.getByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeTruthy()
    // Step 1 (Method) is active.
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
  })

  it('renders the Potency step for the Concentrate branch (Week 2)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const state: WizardState = {
      branch: 'concentrate',
      currentStep: 1,
      selections: {},
    }
    render(<Wizard onEdit={() => {}} onSelect={() => {}} state={state} />)
    // Week 2: the Concentrate branch's first decision step
    // is Potency (the coming-soon placeholder is gone). The
    // active StepCard renders the option carousel.
    expect(screen.getByTestId('step-card-potency-active')).toBeTruthy()
    expect(screen.getByTestId('option-tile-p-50')).toBeTruthy()
    expect(screen.getByTestId('option-tile-p-85')).toBeTruthy()
  })
})

describe('Wizard — callbacks', () => {
  it('tapping a product-type option fires onSelect with the option id', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    let captured: { stepId: string; optionId: string } | null = null
    render(
      <Wizard
        onEdit={() => {}}
        onSelect={(stepId, optionId) => {
          captured = { stepId, optionId }
        }}
        state={DEFAULT_WIZARD_STATE}
      />
    )
    // Per the v2.2 mockup: the product-type step renders a 3D
    // coverflow of 5 end-product faces. Each face's onSelect
    // returns the END-PRODUCT branch id (not the end-product id)
    // so the wizard's onSelect handler can set `state.branch`
    // without further mapping. Brownies → 'edible' branch.
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    expect(captured).toEqual({ stepId: 'product-type', optionId: 'edible' })
  })
})
