/**
 * Tests for the ProductTypeTooltip component.
 *
 * ProductTypeTooltip is the "what does this mean?" expander that
 * the architecture doc §8.4 calls for on every product-type
 * label. Default state: collapsed (only the `?` icon visible). A
 * tap on the `?` icon expands the definition in place; a second
 * tap collapses it.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ProductTypeTooltip } from '../ProductTypeTooltip'

const DEFINITION =
  'You have raw, unprocessed cannabis flower and want to decarboxylate it (heat it to activate the THC) before infusing or dosing.'

describe('ProductTypeTooltip — mount + collapse', () => {
  it('renders the trigger button with an accessible name', () => {
    render(<ProductTypeTooltip text={DEFINITION} />)
    const trigger = screen.getByTestId('product-type-tooltip-trigger')
    expect(trigger).toBeTruthy()
    expect(trigger.getAttribute('aria-label')).toBe('Show explanation')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not render the definition panel when collapsed', () => {
    render(<ProductTypeTooltip text={DEFINITION} />)
    expect(screen.queryByTestId('product-type-tooltip-panel')).toBeNull()
  })
})

describe('ProductTypeTooltip — expand on tap', () => {
  it('expands the definition when the trigger is tapped', () => {
    render(<ProductTypeTooltip text={DEFINITION} />)
    fireEvent.click(screen.getByTestId('product-type-tooltip-trigger'))
    const panel = screen.getByTestId('product-type-tooltip-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toBe(DEFINITION)
  })

  it('flips aria-expanded to true when expanded', () => {
    render(<ProductTypeTooltip text={DEFINITION} />)
    const trigger = screen.getByTestId('product-type-tooltip-trigger')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('collapses again on a second tap', () => {
    render(<ProductTypeTooltip text={DEFINITION} />)
    const trigger = screen.getByTestId('product-type-tooltip-trigger')
    fireEvent.click(trigger)
    expect(screen.queryByTestId('product-type-tooltip-panel')).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.queryByTestId('product-type-tooltip-panel')).toBeNull()
  })
})
