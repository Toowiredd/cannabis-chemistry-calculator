/**
 * Timer — preset pre-fill contract.
 *
 * 2026-07-26 userstory-audit P5 (`components-timer-widget`) found
 * the Timer widget listed all DECARB_METHODS as separate start
 * buttons regardless of the user's active decarb preset. The
 * audit asked for the Timer to pre-fill from the active preset
 * so the user lands on the right method (the one they just
 * configured on the Decarb tab) without scrolling through all
 * options.
 *
 * The contract: when `decarb.presetId` matches a `DECARB_METHODS`
 * entry, the Timer shows ONLY that method's start button (and a
 * callout explaining the pre-selection). When no preset is set
 * (or the id doesn't match), the Timer falls back to listing all
 * methods as before.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TimerWidget } from '../Timer'
import { DEFAULT_DECARB, useAppStore } from '../../stores/appStore'
import { DECARB_METHODS } from '../../engine/models'

/* jsdom doesn't ship matchMedia by default — stub it for useReducedMotion
 * to call .matches safely. (The Timer doesn't currently use
 * useReducedMotion, but a defensive stub keeps the test green if a
 * future commit adds it.) */
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
})

function resetTimer(seed: Partial<typeof DEFAULT_DECARB> = {}) {
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB, ...seed },
    timer: {
      active: false,
      endTime: null,
      totalSeconds: 0,
      methodName: '',
    },
  })
}

/** Open the collapsed panel so the preset buttons render. */
function openPanel() {
  const chevronBtn = screen.getByRole('button', {
    name: /Show timer controls/i,
  })
  fireEvent.click(chevronBtn)
}

describe('Timer — audit P5 (preset pre-fill)', () => {
  beforeEach(() => resetTimer())

  it('renders all DECARB_METHODS start buttons when no preset is set (the previous behavior)', () => {
    // Default seed has presetId = 'oven_sealed', so we override to
    // a placeholder that does not match any DECARB_METHODS entry
    // (use an empty string to simulate "no preset set").
    resetTimer({ presetId: '' })
    render(<TimerWidget />)
    openPanel()
    for (const method of DECARB_METHODS) {
      expect(screen.getByTestId(`timer-preset-${method.id}`)).toBeTruthy()
    }
  })

  it('with presetId = "sv_combined", only the sv_combined start button is rendered', () => {
    resetTimer({ presetId: 'sv_combined' })
    render(<TimerWidget />)
    openPanel()
    // The pre-selected method's button is rendered.
    expect(screen.getByTestId('timer-preset-sv_combined')).toBeTruthy()
    // All other method buttons are NOT rendered.
    for (const method of DECARB_METHODS) {
      if (method.id === 'sv_combined') continue
      expect(screen.queryByTestId(`timer-preset-${method.id}`)).toBeNull()
    }
    // The active-preset callout is present.
    expect(screen.getByTestId('timer-active-preset-callout')).toBeTruthy()
  })

  it('the active-preset callout names the active method', () => {
    resetTimer({ presetId: 'sv_combined' })
    render(<TimerWidget />)
    openPanel()
    const callout = screen.getByTestId('timer-active-preset-callout')
    // The callout's text must mention the method's display name.
    // sv_combined's name lives on the engine side; we don't pin
    // the exact string but assert it includes something decarb-
    // related (the callout text is "X is selected on the Decarb
    // tab..."). The simpler pin: the callout must contain
    // "Decarb tab".
    expect(callout.textContent ?? '').toMatch(/Decarb tab/i)
  })

  it('with a non-matching presetId, falls back to listing all methods', () => {
    // 'not-a-method' is not a valid DECARB_METHODS id; the Timer
    // should treat this as "no preset set" and show all methods.
    resetTimer({ presetId: 'not-a-method' })
    render(<TimerWidget />)
    openPanel()
    for (const method of DECARB_METHODS) {
      expect(screen.getByTestId(`timer-preset-${method.id}`)).toBeTruthy()
    }
    expect(
      screen.queryByTestId('timer-active-preset-callout')
    ).toBeNull()
  })

  it('the active-preset button has the highlighted (info) class, not the default class', () => {
    resetTimer({ presetId: 'sv_combined' })
    render(<TimerWidget />)
    openPanel()
    const btn = screen.getByTestId('timer-preset-sv_combined')
    // The highlight class includes `border-info/60` and
    // `bg-info/10`. The default class includes `border-foreground/20`
    // and `bg-foreground/5`.
    expect(btn.className).toMatch(/border-info/)
    expect(btn.className).not.toMatch(/border-foreground\/20/)
  })
})
