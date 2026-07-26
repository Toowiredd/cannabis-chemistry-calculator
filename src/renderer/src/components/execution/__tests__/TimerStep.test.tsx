/**
 * Tests for the TimerStep shell.
 *
 * TimerStep is the Stage 2 active-timer shell (§4.1, "Active
 * timer"). It wraps the existing `Timer` widget and adds a
 * "Stir now" alert that fires when the optional
 * `stirIntervalSeconds` elapses.
 *
 * Coverage:
 *  - renders the wrapped Timer widget
 *  - the informational caption reflects the totalSeconds prop
 *  - without stirIntervalSeconds, no Stir alert renders (even
 *    after waiting)
 *  - with stirIntervalSeconds, the Stir alert appears at the
 *    right interval (uses vitest fake timers)
 *  - with stirIntervalSeconds, the alert does NOT appear before
 *    the interval elapses
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { TimerStep } from '../TimerStep'
import { DEFAULT_DECARB, useAppStore } from '../../../stores/appStore'

/* jsdom doesn't ship matchMedia by default — stub it for
 * useReducedMotion / future a11y hooks to call .matches safely. */
beforeEach(() => {
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
  // Reset the decarb state + timer state so the wrapped Timer
  // renders the default panel (no active timer).
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB },
    timer: {
      active: false,
      endTime: null,
      totalSeconds: 0,
      methodName: '',
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TimerStep — render', () => {
  it('renders the wrapped Timer widget', () => {
    render(<TimerStep onComplete={() => {}} totalSeconds={2700} />)
    // The wrapped Timer (TimerWidget) renders a GlassCard with
    // the "Timer" title text.
    expect(screen.getByText('Timer')).toBeTruthy()
  })

  it('the informational caption reflects totalSeconds', () => {
    render(<TimerStep onComplete={() => {}} totalSeconds={2700} />)
    // 2700 seconds = 45 minutes.
    expect(screen.getByTestId('timer-step-total').textContent).toContain('45m')
  })

  it('exposes totalSeconds as a data-attribute', () => {
    const { container } = render(
      <TimerStep onComplete={() => {}} totalSeconds={3600} />
    )
    const root = container.querySelector('[data-testid="timer-step"]')
    expect(root?.getAttribute('data-total-seconds')).toBe('3600')
  })
})

describe('TimerStep — Stir alert', () => {
  it('does NOT render a Stir alert when stirIntervalSeconds is not set', () => {
    vi.useFakeTimers()
    render(<TimerStep onComplete={() => {}} totalSeconds={2700} />)
    // Advance well past any plausible interval. Wrap in act() so
    // the state updates flush — without it, the act-warning fires
    // and the assertion below can race the React batch.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.queryByTestId('timer-step-stir-alert')).toBeNull()
  })

  it('renders the Stir alert at the right interval', () => {
    vi.useFakeTimers()
    render(
      <TimerStep
        onComplete={() => {}}
        stirIntervalSeconds={900}
        totalSeconds={2700}
      />
    )
    // Before the interval: no alert.
    act(() => {
      vi.advanceTimersByTime(899_000)
    })
    expect(screen.queryByTestId('timer-step-stir-alert')).toBeNull()
    // At-or-past the interval: alert appears.
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(screen.getByTestId('timer-step-stir-alert')).toBeTruthy()
  })

  it('the Stir alert is one-shot — does not re-fire on a second tick', () => {
    vi.useFakeTimers()
    render(
      <TimerStep
        onComplete={() => {}}
        stirIntervalSeconds={60}
        totalSeconds={600}
      />
    )
    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    const alert = screen.getByTestId('timer-step-stir-alert')
    expect(alert).toBeTruthy()
    // Advance more — the alert should still be there (it's a
    // conditional render; once visible, it stays visible).
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(screen.getByTestId('timer-step-stir-alert')).toBe(alert)
  })
})
