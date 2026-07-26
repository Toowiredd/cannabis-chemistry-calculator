/**
 * Tests for the TransitionStep shell.
 *
 * TransitionStep is the Stage 2 transition shell (§4.1,
 * "Transition"). It accepts a `message` + `onContinue` and
 * renders the brief animation + next-step CTA.
 *
 * Coverage:
 *  - renders the message
 *  - renders the Continue button
 *  - tapping Continue calls onContinue
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TransitionStep } from '../TransitionStep'

describe('TransitionStep — render', () => {
  it('renders the message in the body', () => {
    render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    expect(screen.getByTestId('transition-step-message').textContent).toBe(
      'Move to infusion →'
    )
  })

  it('renders the Continue CTA', () => {
    render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    expect(screen.getByTestId('transition-step-continue')).toBeTruthy()
  })
})

describe('TransitionStep — callbacks', () => {
  it('tapping Continue calls onContinue exactly once', () => {
    const onContinue = vi.fn()
    render(
      <TransitionStep message="Move to infusion →" onContinue={onContinue} />
    )
    fireEvent.click(screen.getByTestId('transition-step-continue'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
