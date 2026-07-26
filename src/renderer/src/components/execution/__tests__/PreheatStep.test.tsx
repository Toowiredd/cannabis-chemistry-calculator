/**
 * Tests for the PreheatStep shell.
 *
 * PreheatStep is the Stage 2 "preheat oven" pre-action shell
 * (§4.1, "Pre-action"). It accepts a `targetTemp` + `duration`
 * + `onReady` and renders the large-text + button affordance.
 *
 * Coverage:
 *  - renders the target temperature in the headline
 *  - renders the duration in the subtitle
 *  - "I'm ready" calls onReady
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PreheatStep } from '../PreheatStep'

describe('PreheatStep — render', () => {
  it('renders the target temperature in the headline', () => {
    render(
      <PreheatStep duration="45 min" onReady={() => {}} targetTemp={105} />
    )
    expect(screen.getByTestId('preheat-step-target').textContent).toContain(
      '105'
    )
  })

  it('renders the duration in the subtitle', () => {
    render(
      <PreheatStep duration="45 min" onReady={() => {}} targetTemp={105} />
    )
    expect(screen.getByTestId('preheat-step-duration').textContent).toContain(
      '45 min'
    )
  })

  it('renders the "I\'m ready" CTA', () => {
    render(
      <PreheatStep duration="45 min" onReady={() => {}} targetTemp={105} />
    )
    expect(screen.getByTestId('preheat-step-ready')).toBeTruthy()
  })
})

describe('PreheatStep — callbacks', () => {
  it('tapping "I\'m ready" calls onReady exactly once', () => {
    const onReady = vi.fn()
    render(<PreheatStep duration="45 min" onReady={onReady} targetTemp={105} />)
    fireEvent.click(screen.getByTestId('preheat-step-ready'))
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})
