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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TransitionStep } from '../TransitionStep'

/* -- Mock useReducedMotion. Default `false` (animation on) so the
 * existing tests behave exactly as before. The Week 7 a11y tests
 * flip it to `true` and assert the toast-in class is dropped. */
const { mockMotion } = vi.hoisted(() => ({ mockMotion: { value: false } }))
vi.mock('renderer/src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockMotion.value,
}))

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

/* -- Week 7 a11y polish ----------------------------------------------
 * The `toast-in` animation must be dropped when the user prefers
 * reduced motion. The global CSS backstop zeros the animation
 * duration but the explicit React-level gate keeps the contract
 * visible. */

beforeEach(() => {
  mockMotion.value = false
})

describe('TransitionStep — a11y / reduced motion', () => {
  it('applies the `toast-in` class by default (reduced motion off)', () => {
    render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    // GlassCard doesn't forward data-testid, so the section is the
    // findable wrapper and the animated class lives on its
    // firstElementChild (the GlassCard root div).
    const wrapper = screen.getByTestId('transition-step')
    const glassCardDiv = wrapper.firstElementChild as HTMLElement
    expect(glassCardDiv).toBeTruthy()
    expect(glassCardDiv.className).toContain('toast-in')
  })

  it('does NOT apply the `toast-in` class when reduced motion is on', () => {
    mockMotion.value = true
    render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    const wrapper = screen.getByTestId('transition-step')
    const glassCardDiv = wrapper.firstElementChild as HTMLElement
    expect(glassCardDiv.className).not.toContain('toast-in')
  })

  it('keeps the `data-testid="transition-step"` regardless of motion preference', () => {
    // Default: motion on.
    const { rerender } = render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    expect(screen.getByTestId('transition-step')).toBeTruthy()
    // Now flip to reduced motion and rerender.
    mockMotion.value = true
    rerender(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    expect(screen.getByTestId('transition-step')).toBeTruthy()
  })

  it('Continue CTA has a focus-visible:ring-* class set', () => {
    render(
      <TransitionStep message="Move to infusion →" onContinue={() => {}} />
    )
    const cont = screen.getByTestId('transition-step-continue')
    expect(cont.className).toContain('focus-visible:ring-')
  })
})
