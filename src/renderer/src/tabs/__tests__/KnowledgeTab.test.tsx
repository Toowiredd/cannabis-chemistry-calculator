/**
 * KnowledgeTab — audit-fix regression tests for the 2026-07-25
 * ccc workflow-validator B8 fix.
 *
 * Coverage:
 * - The doneness-curve temperature slider displays in the user's
 *   global temp unit (`units.tempUnit`). Pre-fix the slider
 *   hardcoded "°C" and called `setDecarb({ tempOverride: String(tempC) })`
 *   in °C — so a °F user who dragged the slider in °F and clicked
 *   "Apply to Decarb Tab" would stamp a value in °C with no
 *   `tempOverrideUnit` set, causing the per-field refactor to
 *   re-interpret the value as °C (5/9 × 32 conversion error).
 * - "Apply to Decarb Tab" stamps BOTH `tempOverride` (in the
 *   display unit the user dragged) AND `tempOverrideUnit: tempUnit`
 *   (the per-field unit), so the per-field refactor sees the
 *   value in the unit the user typed it in.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { KnowledgeTab } from '../KnowledgeTab'
import { useAppStore } from '../../stores/appStore'

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
  // KnowledgeTab renders a MolecularBuilder, which uses
  // IntersectionObserver for auto-play on first view. jsdom
  // doesn't ship it; stub a no-op.
  if (typeof window.IntersectionObserver !== 'function') {
    class StubIntersectionObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
      root = null
      rootMargin = ''
      thresholds = []
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: StubIntersectionObserver,
    })
  }
})

describe('KnowledgeTab — audit B8 (doneness-curve slider uses display unit)', () => {
  beforeEach(() => {
    useAppStore.setState({
      decarb: {
        ...useAppStore.getState().decarb,
        presetId: 'oven_sealed',
      },
      activeTab: 'knowledge',
    })
  })

  it('temperature slider unit label is "°F" when units.tempUnit is "F" (audit B8)', () => {
    useAppStore.setState(state => ({
      units: { ...state.units, tempUnit: 'F' },
    }))
    render(<KnowledgeTab />)
    // The Temperature slider is a range input with an accessible
    // name (the label "Temperature" from the RangeSlider wrapper).
    const slider = screen.getByRole('slider', { name: /Temperature/i })
    // The unit text is rendered in the same wrapper. We assert
    // by walking the parent — the simplest path is to find the
    // visible "°F" text node.
    const container = slider.closest('div')?.parentElement
    expect(container?.textContent).toMatch(/°F/)
  })

  it('Apply to Decarb Tab stamps tempOverrideUnit so the per-field refactor sees the user-typed unit (audit B8)', () => {
    // A user with display=°F drags the slider (which is in °F),
    // then clicks "Apply to Decarb Tab". The pre-fix code wrote
    // the slider's raw value (in °F) to `tempOverride` without
    // `tempOverrideUnit`, so the next time the per-field engine
    // read the value it interpreted °F as °C. Post-fix the
    // `tempOverrideUnit` is stamped alongside the value.
    useAppStore.setState(state => ({
      units: { ...state.units, tempUnit: 'F' },
    }))
    render(<KnowledgeTab />)
    // Drive the slider: change the input value to a known F value.
    const slider = screen.getByRole('slider', { name: /Temperature/i })
    fireEvent.change(slider, { target: { value: '250' } })
    // Click "Apply to Decarb Calculator" (the actual button label
    // at KnowledgeTab.tsx:469).
    const applyBtn = screen.getByRole('button', {
      name: /Apply to Decarb Calculator/i,
    })
    fireEvent.click(applyBtn)
    // The store now has tempOverride = "250" (in °F) and
    // tempOverrideUnit = "F". The per-field refactor on the
    // Decarb tab will re-interpret 250 as °F (not °C).
    expect(useAppStore.getState().decarb.tempOverride).toBe('250')
    expect(useAppStore.getState().decarb.tempOverrideUnit).toBe('F')
  })
})
