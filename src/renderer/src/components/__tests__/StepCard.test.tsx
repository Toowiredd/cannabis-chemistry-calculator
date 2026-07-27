/**
 * Tests for the StepCard component.
 *
 * StepCard has 3 visual states (per the architecture doc §3.2):
 *  - collapsed: not yet active, grayed-out preview
 *  - active: currently being decided, full card with options
 *  - collapsed-with-selection: done, green check + chosen option
 *
 * Coverage:
 *  - collapsed state: title visible, options not rendered, aria-disabled
 *  - active state: title + description + options + Confirm CTA
 *  - active with no options: "empty" affordance
 *  - collapsed-with-selection: shows the chosen option, tap fires onEdit
 *  - Confirm CTA only appears when an option is selected
 *  - onConfirm fires with the selected option id when Confirm is tapped
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { StepCard } from '../StepCard'
import type { WizardState, WizardStep } from 'renderer/src/wizard/wizardTypes'

const baseStep: WizardStep = {
  id: 'test-step',
  title: 'Test step',
  description: 'A short description',
  getOptions: () => [
    { id: 'opt-a', title: 'Option A', subtitle: 'A' },
    { id: 'opt-b', title: 'Option B', subtitle: 'B' },
  ],
}

const baseState: WizardState = {
  branch: null,
  endProduct: null,
  currentStepId: null,
  selections: {},
}

describe('StepCard — collapsed state', () => {
  it('renders the title and description, hides the options', () => {
    render(
      <StepCard
        cardState="collapsed"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    expect(screen.getByTestId('step-card-test-step-collapsed')).toBeTruthy()
    expect(screen.getByText('Test step')).toBeTruthy()
    expect(screen.getByText('A short description')).toBeTruthy()
    // The options should NOT render in the collapsed state.
    expect(screen.queryByTestId('step-card-test-step-options')).toBeNull()
  })

  it('marks the collapsed card as aria-disabled', () => {
    render(
      <StepCard
        cardState="collapsed"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    expect(
      screen
        .getByTestId('step-card-test-step-collapsed')
        .getAttribute('aria-disabled')
    ).toBe('true')
  })
})

describe('StepCard — active state', () => {
  it('renders the title, description, and the option carousel', () => {
    render(
      <StepCard
        cardState="active"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    expect(screen.getByTestId('step-card-test-step-active')).toBeTruthy()
    expect(screen.getByText('Test step')).toBeTruthy()
    expect(screen.getByText('A short description')).toBeTruthy()
    expect(screen.getByTestId('step-card-test-step-options')).toBeTruthy()
  })

  it('renders one OptionTile per option', () => {
    render(
      <StepCard
        cardState="active"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    expect(screen.getByTestId('option-tile-opt-a')).toBeTruthy()
    expect(screen.getByTestId('option-tile-opt-b')).toBeTruthy()
  })

  it('does NOT render a Confirm CTA — the option carousel is one-tap to commit', () => {
    // Slide 6 of v2.2 (2026-07-27): the per-step "Confirm"
    // button was removed. The option carousel is one-tap to
    // commit (click any face → onSelect fires → wizard
    // advances). The coverflow (slide 1) keeps its own
    // "Make {name}" confirm CTA inside EndProductCoverflow.
    render(
      <StepCard
        cardState="active"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    expect(screen.queryByTestId('step-card-test-step-confirm')).toBeNull()
  })

  it('does NOT render a Confirm CTA even when an option is pre-selected', () => {
    render(
      <StepCard
        cardState="active"
        onConfirm={() => {}}
        selectedOptionId="opt-a"
        state={baseState}
        step={baseStep}
      />
    )
    expect(screen.queryByTestId('step-card-test-step-confirm')).toBeNull()
  })

  it('tapping a tile calls onConfirm with the option id', () => {
    const onConfirm = vi.fn()
    render(
      <StepCard
        cardState="active"
        onConfirm={onConfirm}
        selectedOptionId={null}
        state={baseState}
        step={baseStep}
      />
    )
    fireEvent.click(screen.getByTestId('option-tile-opt-b'))
    expect(onConfirm).toHaveBeenCalledWith('opt-b')
  })

  it('tapping the centered (pre-selected) option face calls onConfirm with that option id', () => {
    // Pre-condition: opt-a is the selected option. The
    // OptionCarousel centers on the selected option on mount,
    // so its face is the center of the carousel. Clicking
    // the center face fires onConfirm (the carousel is
    // one-tap to commit; the center face is a "yes, this
    // one" affordance).
    const onConfirm = vi.fn()
    render(
      <StepCard
        cardState="active"
        onConfirm={onConfirm}
        selectedOptionId="opt-a"
        state={baseState}
        step={baseStep}
      />
    )
    fireEvent.click(screen.getByTestId('option-tile-opt-a'))
    expect(onConfirm).toHaveBeenCalledWith('opt-a')
  })

  it('renders the empty affordance when the step has no options', () => {
    const emptyStep: WizardStep = {
      id: 'empty',
      title: 'Empty step',
      description: 'Nothing to pick',
      getOptions: () => [],
    }
    render(
      <StepCard
        cardState="active"
        onConfirm={() => {}}
        selectedOptionId={null}
        state={baseState}
        step={emptyStep}
      />
    )
    expect(screen.getByTestId('step-card-empty-empty')).toBeTruthy()
    expect(screen.getByText('Nothing to pick here yet.')).toBeTruthy()
  })
})

describe('StepCard — collapsed-with-selection state', () => {
  it('renders the chosen option in the summary line', () => {
    render(
      <StepCard
        cardState="collapsed-with-selection"
        onConfirm={() => {}}
        selectedOptionId="opt-a"
        state={baseState}
        step={baseStep}
      />
    )
    expect(
      screen.getByTestId('step-card-test-step-collapsed-with-selection')
    ).toBeTruthy()
    expect(
      screen.getByTestId('step-card-test-step-selection').textContent
    ).toBe('Option A')
  })

  it('tapping the collapsed-with-selection card fires onEdit', () => {
    const onEdit = vi.fn()
    render(
      <StepCard
        cardState="collapsed-with-selection"
        onConfirm={() => {}}
        onEdit={onEdit}
        selectedOptionId="opt-a"
        state={baseState}
        step={baseStep}
      />
    )
    fireEvent.click(
      screen.getByTestId('step-card-test-step-collapsed-with-selection')
    )
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
