/**
 * Tests for the HeatmapStep shell.
 *
 * HeatmapStep is the Stage 2 visual-state shell (§4.1, "Visual
 * state"). It wraps the existing `DecarbHeatmap` widget and
 * adds a progress bar overlay.
 *
 * Coverage:
 *  - renders the wrapped DecarbHeatmap
 *  - the progress bar overlay is visible and reflects progressPct
 *  - the target temperature + material caption is rendered
 *  - clamps progressPct into 0-100 range
 *  - data-attributes expose the props for tests + week-4 wiring
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { HeatmapStep } from '../HeatmapStep'
import { DEFAULT_DECARB, useAppStore } from '../../../stores/appStore'

/* jsdom doesn't ship matchMedia by default — stub it for
 * useReducedMotion (used by the underlying DecarbHeatmap) to
 * call .matches safely. */
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
  // Reset the decarb state so the wrapped heatmap renders the
  // default (no temperature override).
  useAppStore.setState(state => ({
    decarb: { ...DEFAULT_DECARB },
    units: { ...state.units, tempUnit: 'C' },
  }))
})

describe('HeatmapStep — render', () => {
  it('renders the wrapped DecarbHeatmap', () => {
    render(
      <HeatmapStep
        currentTemp={105}
        material="flower"
        progressPct={42}
        targetTemp={105}
      />
    )
    // The wrapped DecarbHeatmap's figure carries aria-label
    // "Temperature heatmap".
    expect(screen.getByLabelText('Temperature heatmap')).toBeTruthy()
  })

  it('renders the progress bar overlay with the right percentage', () => {
    render(
      <HeatmapStep
        currentTemp={105}
        material="flower"
        progressPct={42}
        targetTemp={105}
      />
    )
    const progress = screen.getByTestId('heatmap-step-progress')
    expect(progress.getAttribute('aria-valuenow')).toBe('42')
    expect(screen.getByTestId('heatmap-step-progress-pct').textContent).toBe(
      '42%'
    )
  })

  it('renders the target temperature + material caption', () => {
    render(
      <HeatmapStep
        currentTemp={80}
        material="concentrate"
        progressPct={0}
        targetTemp={120}
      />
    )
    // The caption lives inside the progress bar header.
    const header = screen.getByTestId('heatmap-step-progress')
    expect(header.textContent).toContain('120')
    expect(header.textContent).toContain('concentrate')
  })

  it('clamps progressPct above 100 to 100', () => {
    render(
      <HeatmapStep
        currentTemp={105}
        material="flower"
        progressPct={150}
        targetTemp={105}
      />
    )
    expect(
      screen.getByTestId('heatmap-step-progress').getAttribute('aria-valuenow')
    ).toBe('100')
  })

  it('clamps progressPct below 0 to 0', () => {
    render(
      <HeatmapStep
        currentTemp={105}
        material="flower"
        progressPct={-25}
        targetTemp={105}
      />
    )
    expect(
      screen.getByTestId('heatmap-step-progress').getAttribute('aria-valuenow')
    ).toBe('0')
  })

  it('exposes the props as data-attributes for week-4 wiring', () => {
    const { container } = render(
      <HeatmapStep
        currentTemp={88}
        material="avb"
        progressPct={60}
        targetTemp={115}
      />
    )
    const root = container.querySelector('[data-testid="heatmap-step"]')
    expect(root?.getAttribute('data-target-temp')).toBe('115')
    expect(root?.getAttribute('data-current-temp')).toBe('88')
    expect(root?.getAttribute('data-progress-pct')).toBe('60')
    expect(root?.getAttribute('data-material')).toBe('avb')
  })
})
