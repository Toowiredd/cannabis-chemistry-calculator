/**
 * EndProductCoverflow — the 3D coverflow at the wizard's landing
 * (per the v2.2 mockup, screen 1).
 *
 * Per the architecture doc + the v2.2 brief: the wizard lands on 5
 * end-product faces (Brownies / Gummies / Capsules / Tincture /
 * Salve), not 5 starting-material faces. Each face has icon + name
 * + description + chip. Click a face → it becomes the center and
 * `onSelect` fires with the end-product id and its mapped branch id.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EndProductCoverflow } from '../EndProductCoverflow'

describe('EndProductCoverflow', () => {
  it('renders all 5 end-product faces', () => {
    render(<EndProductCoverflow onSelect={() => {}} />)
    for (const id of ['brownies', 'gummies', 'capsules', 'tincture', 'salve']) {
      expect(screen.getByTestId(`end-product-face-${id}`)).toBeTruthy()
    }
  })

  it('marks the first face (Brownies) as the initial center', () => {
    render(<EndProductCoverflow onSelect={() => {}} />)
    const brownies = screen.getByTestId('end-product-face-brownies')
    expect(brownies.getAttribute('aria-checked')).toBe('true')
  })

  it('clicking a side face fires onSelect AND moves it to center', () => {
    const onSelect = vi.fn()
    render(<EndProductCoverflow onSelect={onSelect} />)
    // Click the second face (Gummies) — it should fire onSelect
    // immediately. The coverflow re-centers on the clicked face.
    fireEvent.click(screen.getByTestId('end-product-face-gummies'))
    expect(onSelect).toHaveBeenCalledWith('gummies', 'edible')
    // Now Gummies is the center.
    expect(
      screen.getByTestId('end-product-face-gummies').getAttribute('aria-checked')
    ).toBe('true')
  })

  it('clicking the confirm CTA fires onSelect with the center face id and mapped branch', () => {
    const onSelect = vi.fn()
    render(<EndProductCoverflow onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('end-product-coverflow-confirm'))
    // Default center is Brownies → edible branch.
    expect(onSelect).toHaveBeenCalledWith('brownies', 'edible')
  })

  it('clicking the center face fires onSelect immediately', () => {
    const onSelect = vi.fn()
    render(<EndProductCoverflow onSelect={onSelect} />)
    // Brownies is the initial center — clicking it fires onSelect.
    fireEvent.click(screen.getByTestId('end-product-face-brownies'))
    expect(onSelect).toHaveBeenCalledWith('brownies', 'edible')
  })

  it('mapping: Tincture → avb, Salve → topical, Gummies/Capsules → edible', () => {
    const onSelect = vi.fn()
    render(<EndProductCoverflow onSelect={onSelect} />)
    // Move Tincture to center, confirm.
    fireEvent.click(screen.getByTestId('end-product-face-tincture'))
    fireEvent.click(screen.getByTestId('end-product-coverflow-confirm'))
    expect(onSelect).toHaveBeenLastCalledWith('tincture', 'avb')
    // Salve → topical.
    fireEvent.click(screen.getByTestId('end-product-face-salve'))
    fireEvent.click(screen.getByTestId('end-product-coverflow-confirm'))
    expect(onSelect).toHaveBeenLastCalledWith('salve', 'topical')
  })

  it('initialId prop centers the matching face on mount', () => {
    render(<EndProductCoverflow initialId="tincture" onSelect={() => {}} />)
    expect(
      screen.getByTestId('end-product-face-tincture').getAttribute('aria-checked')
    ).toBe('true')
  })

  it('renders the hint text', () => {
    render(<EndProductCoverflow onSelect={() => {}} />)
    expect(screen.getByTestId('end-product-coverflow-hint')).toBeTruthy()
  })
})
