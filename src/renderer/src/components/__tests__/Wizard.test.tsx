/**
 * Tests for the Wizard container component.
 *
 * The Wizard IS the canonical UI/UX. Two key behaviors:
 *  - Kill switch: when `wizardEnabled` is explicitly false, the
 *    component returns `null` (the legacy GroupedTabNav takes
 *    over). This is a build-time gate during the migration
 *    window, not a user-facing opt-in.
 *  - Step stack: when the flag is on (the canonical default),
 *    it renders the steps for the current branch sequence.
 *
 * The feature-flag read (see wizardFeatureFlag.ts) is direct
 * from the typed store — the slice is on master, no defensive
 * cast needed. The tests below exercise both branches.
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
  // Reset the wizardEnabled field between tests so the flag doesn't
  // leak state. The default is `true` (the wizard IS the canonical
  // UI/UX); tests that need the kill-switch branch explicitly
  // override to `false`.
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: true,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
})

describe('Wizard — kill switch (wizard IS the UI/UX; flag is the migration gate)', () => {
  it('renders nothing when wizardEnabled is explicitly false (kill switch)', () => {
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
    // All 5 product-type options are rendered as tiles.
    expect(screen.getByTestId('option-tile-flower')).toBeTruthy()
    expect(screen.getByTestId('option-tile-concentrate')).toBeTruthy()
    expect(screen.getByTestId('option-tile-avb')).toBeTruthy()
    expect(screen.getByTestId('option-tile-edible')).toBeTruthy()
    expect(screen.getByTestId('option-tile-topical')).toBeTruthy()
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
    fireEvent.click(screen.getByTestId('option-tile-flower'))
    expect(captured).toEqual({ stepId: 'product-type', optionId: 'flower' })
  })
})
