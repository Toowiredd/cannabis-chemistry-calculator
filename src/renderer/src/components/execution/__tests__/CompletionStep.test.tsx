/**
 * Tests for the CompletionStep shell.
 *
 * CompletionStep is the Stage 2 completion shell (§4.1,
 * "Completion"). It accepts a `recipeName` + `computedTotals`
 * + `onSave` and renders the result summary + journal save CTA.
 *
 * Coverage:
 *  - renders the recipe name in the headline
 *  - renders the three totals (THC, CBD, servings) in the dl
 *  - tapping "Save to Journal" calls onSave
 *  - falls back to "Untitled recipe" when recipeName is empty
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CompletionStep } from '../CompletionStep'

const baseTotals = { thcMg: 142.5, cbdMg: 8.2, servings: 12 }

describe('CompletionStep — render', () => {
  it('renders the recipe name in the headline', () => {
    render(
      <CompletionStep
        computedTotals={baseTotals}
        onSave={() => {}}
        recipeName="Morning Dose — 28g Coconut Oil"
      />
    )
    expect(screen.getByTestId('completion-step-recipe-name').textContent).toBe(
      'Morning Dose — 28g Coconut Oil'
    )
  })

  it('renders the three totals (THC, CBD, servings) in the dl', () => {
    render(
      <CompletionStep
        computedTotals={baseTotals}
        onSave={() => {}}
        recipeName="Test"
      />
    )
    expect(screen.getByTestId('completion-step-thc').textContent).toBe(
      '142.5 mg'
    )
    expect(screen.getByTestId('completion-step-cbd').textContent).toBe('8.2 mg')
    expect(screen.getByTestId('completion-step-servings').textContent).toBe(
      '12'
    )
  })

  it('renders the "Save to Journal" CTA', () => {
    render(
      <CompletionStep
        computedTotals={baseTotals}
        onSave={() => {}}
        recipeName="Test"
      />
    )
    expect(screen.getByTestId('completion-step-save')).toBeTruthy()
  })

  it('falls back to "Untitled recipe" when recipeName is empty', () => {
    render(
      <CompletionStep
        computedTotals={baseTotals}
        onSave={() => {}}
        recipeName=""
      />
    )
    expect(screen.getByTestId('completion-step-recipe-name').textContent).toBe(
      'Untitled recipe'
    )
  })
})

describe('CompletionStep — callbacks', () => {
  it('tapping "Save to Journal" calls onSave exactly once', () => {
    const onSave = vi.fn()
    render(
      <CompletionStep
        computedTotals={baseTotals}
        onSave={onSave}
        recipeName="Test"
      />
    )
    fireEvent.click(screen.getByTestId('completion-step-save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
