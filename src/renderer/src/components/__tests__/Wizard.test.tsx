/**
 * Tests for the Wizard container component.
 *
 * The Wizard is a slide-by-slide stepper (slide 4 of v2.2,
 * 2026-07-27). One step is in view at a time. No collapsed
 * future steps, no "make a batch" multi-step view, no back
 * button — just the current step + a small step counter.
 *
 * Two key behaviors:
 *  - Feature flag: when `wizardEnabled` is false, the component
 *    returns `null` (the legacy GroupedTabNav takes over).
 *  - Slide-by-slide: only the current step's StepCard is in
 *    the DOM. Future steps are NOT rendered.
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
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
  })
})

describe('Wizard — feature flag', () => {
  it('renders the product-type coverflow by default (wizardEnabled: true is the new default)', () => {
    const { container } = render(
      <Wizard onSelect={() => {}} state={DEFAULT_WIZARD_STATE} />
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByTestId('end-product-coverflow')).toBeTruthy()
  })

  it('renders nothing when wizardEnabled is explicitly false (legacy rollback)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: false,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const { container } = render(
      <Wizard onSelect={() => {}} state={DEFAULT_WIZARD_STATE} />
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('Wizard — slide-by-slide rendering', () => {
  it('renders ONLY the product-type step when branch is null (slide 1 of 7)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const state: WizardState = {
      branch: null,
      endProduct: null,
      currentStepId: null,
      selections: {},
    }
    render(<Wizard onSelect={() => {}} state={state} />)
    // The active step is the product-type coverflow.
    expect(screen.getByTestId('step-card-product-type-active')).toBeTruthy()
    expect(screen.getByTestId('end-product-coverflow')).toBeTruthy()
    // NO collapsed future steps — slide-by-slide means
    // nothing else is in the DOM.
    expect(
      screen.queryByTestId('step-card-method-active')
    ).toBeNull()
    expect(
      screen.queryByTestId('step-card-container-active')
    ).toBeNull()
    // Step counter shows 1 / 7 (or whatever the total is).
    expect(screen.getByTestId('wizard-step-counter')).toBeTruthy()
  })

  it('renders ONLY the Method step when the branch is set and currentStep is 1 (slide 2 of 7)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const state: WizardState = {
      branch: 'flower',
      endProduct: 'baked',
      currentStepId: 'method',
      selections: {},
    }
    render(<Wizard onSelect={() => {}} state={state} />)
    // Slide 2: Method step is active.
    expect(screen.getByTestId('step-card-method-active')).toBeTruthy()
    // The product-type step is NOT in the DOM (no collapsed
    // sibling, no breadcrumb).
    expect(
      screen.queryByTestId('step-card-product-type-collapsed-with-selection')
    ).toBeNull()
    expect(
      screen.queryByTestId('step-card-product-type-active')
    ).toBeNull()
    // Future steps are NOT in the DOM.
    expect(
      screen.queryByTestId('step-card-container-active')
    ).toBeNull()
    expect(
      screen.queryByTestId('step-card-weight-active')
    ).toBeNull()
  })

  it('renders ONLY the Potency step for the Concentrate branch (slide 2 of 6)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    const state: WizardState = {
      branch: 'concentrate',
      endProduct: 'baked',
      currentStepId: 'potency',
      selections: {},
    }
    render(<Wizard onSelect={() => {}} state={state} />)
    // The Concentrate branch's first decision step is Potency.
    expect(screen.getByTestId('step-card-potency-active')).toBeTruthy()
    expect(screen.getByTestId('option-tile-p-50')).toBeTruthy()
    expect(screen.getByTestId('option-tile-p-85')).toBeTruthy()
  })

  it('renders nothing when the wizard is complete (the parent renders the Begin batch CTA)', () => {
    useAppStore.setState({
      ...(useAppStore.getState() as unknown as Record<string, unknown>),
      wizardEnabled: true,
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    // The wizard is finished when `currentStepId === null`
    // and the user has picked an endProduct + branch
    // (the parent renders the Begin batch CTA / the
    // "Batch ready" badge via the `isFinished` helper).
    const state: WizardState = {
      branch: 'flower',
      endProduct: 'baked',
      currentStepId: null,
      selections: {},
    }
    const { container } = render(
      <Wizard onSelect={() => {}} state={state} />
    )
    expect(container.firstChild).toBeNull()
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
        onSelect={(stepId, optionId) => {
          captured = { stepId, optionId }
        }}
        state={DEFAULT_WIZARD_STATE}
      />
    )
    fireEvent.click(screen.getByTestId('end-product-face-baked'))
    expect(captured).toEqual({ stepId: 'product-type', optionId: 'edible' })
  })
})
