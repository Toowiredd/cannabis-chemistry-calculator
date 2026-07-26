/**
 * Tests for the StockRecipeCard component.
 *
 * StockRecipeCard is the Dashboard entry for a curated
 * starter recipe (per `docs/wizard-architecture-2026-07-26.md`
 * §5.4 + §8.3). It surfaces the recipe name, 1-line
 * description, and a few "key number" chips; tapping the
 * card fires `onSelect(recipe)` so the caller can
 * pre-fill the wizard.
 *
 * Coverage:
 *  - renders the recipe name, description, and all chips
 *  - tapping the card calls onSelect with the recipe
 *  - all required testids are present (card root, per-card
 *    root, name, chips container)
 *  - the button has the right aria-label
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { StockRecipeCard, type StockRecipe } from '../StockRecipeCard'

const sampleRecipe: StockRecipe = {
  id: 'standard-oven-decarb-28g',
  name: 'Standard Oven Decarb — 28g',
  description: 'A reliable starting point for an oven decarb batch.',
  branch: 'flower',
  chips: ['28g', '113°C', '60 min'],
  selections: {
    method: 'oven_sealed',
    weight: { value: 28, unit: 'g' },
  },
}

describe('StockRecipeCard — render', () => {
  it('renders the recipe name, description, and all chips', () => {
    render(<StockRecipeCard onSelect={() => {}} recipe={sampleRecipe} />)
    const card = screen.getByTestId('stock-recipe-card-standard-oven-decarb-28g-name')
    expect(card.textContent).toBe('Standard Oven Decarb — 28g')
    // Description is plain text inside the button — query by its
    // text content directly.
    expect(
      screen.getByText('A reliable starting point for an oven decarb batch.')
    ).toBeTruthy()
    for (const chip of sampleRecipe.chips) {
      expect(screen.getByText(chip)).toBeTruthy()
    }
  })

  it('renders the stock-recipe-card root testid', () => {
    render(<StockRecipeCard onSelect={() => {}} recipe={sampleRecipe} />)
    expect(screen.getByTestId('stock-recipe-card')).toBeTruthy()
  })

  it('renders the per-card root testid with the recipe id', () => {
    render(<StockRecipeCard onSelect={() => {}} recipe={sampleRecipe} />)
    expect(
      screen.getByTestId('stock-recipe-card-standard-oven-decarb-28g')
    ).toBeTruthy()
  })

  it('renders the chips container testid', () => {
    render(<StockRecipeCard onSelect={() => {}} recipe={sampleRecipe} />)
    expect(
      screen.getByTestId(
        'stock-recipe-card-standard-oven-decarb-28g-chips'
      )
    ).toBeTruthy()
  })

  it('the button has the right aria-label', () => {
    render(<StockRecipeCard onSelect={() => {}} recipe={sampleRecipe} />)
    const button = screen.getByTestId(
      'stock-recipe-card-standard-oven-decarb-28g'
    )
    expect(button.getAttribute('aria-label')).toBe(
      'Pre-fill wizard with Standard Oven Decarb — 28g'
    )
  })

  it('renders no chip list when chips is empty (no empty <ul>)', () => {
    const noChips: StockRecipe = {
      ...sampleRecipe,
      id: 'no-chips',
      chips: [],
    }
    render(<StockRecipeCard onSelect={() => {}} recipe={noChips} />)
    expect(
      screen.queryByTestId('stock-recipe-card-no-chips-chips')
    ).toBeNull()
  })
})

describe('StockRecipeCard — interaction', () => {
  it('tapping the card calls onSelect with the recipe', () => {
    const onSelect = vi.fn()
    render(
      <StockRecipeCard onSelect={onSelect} recipe={sampleRecipe} />
    )
    fireEvent.click(
      screen.getByTestId('stock-recipe-card-standard-oven-decarb-28g')
    )
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(sampleRecipe)
  })
})
