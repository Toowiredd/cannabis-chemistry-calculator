/**
 * Tests for the NameRecipeStep component + deriveDefaultRecipeName
 * helper (per `docs/wizard-architecture-2026-07-26.md` §5.4 + §8.5).
 *
 * Coverage:
 *  - deriveDefaultRecipeName: per-branch shape (flower, concentrate,
 *    avb, topical, empty), defensive unknown-id handling.
 *  - NameRecipeStep: placeholder derivation, initialName pre-fill,
 *    user typing, Save button, Enter key, onSkip rendering + firing,
 *    all 5 testids present.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { NameRecipeStep, deriveDefaultRecipeName } from '../NameRecipeStep'
import type { WizardSelections } from 'renderer/src/wizard/wizardTypes'

/* ------------------------------------------------------------------ */
/* deriveDefaultRecipeName — per-branch shape                          */
/* ------------------------------------------------------------------ */

describe('deriveDefaultRecipeName — flower branch', () => {
  it('builds "{method} — {weight}{unit} — {fat}" from the selections', () => {
    expect(
      deriveDefaultRecipeName({
        method: 'oven_sealed',
        weight: { value: 7, unit: 'g' },
        fat: 'coconut',
      })
    ).toBe('Oven, sealed bag — 7g — Coconut')
  })

  it('uses the short fat name (no "Oil" suffix)', () => {
    // "Coconut Oil" (engine display) → "Coconut" (recipe-name form)
    const result = deriveDefaultRecipeName({
      method: 'oven_sealed',
      weight: { value: 28, unit: 'g' },
      fat: 'coconut',
    })
    expect(result).toBe('Oven, sealed bag — 28g — Coconut')
    expect(result).not.toContain('Oil')
  })

  it('renders weight in oz when the unit is oz', () => {
    expect(
      deriveDefaultRecipeName({
        method: 'oven_open',
        weight: { value: 1, unit: 'oz' },
        fat: 'ghee',
      })
    ).toBe('Oven, open tray — 1oz — Ghee')
  })

  it('omits the fat segment when the user picked "No infusion" (fat = null)', () => {
    expect(
      deriveDefaultRecipeName({
        method: 'oven_sealed',
        weight: { value: 7, unit: 'g' },
        fat: null,
      })
    ).toBe('Oven, sealed bag — 7g')
  })
})

describe('deriveDefaultRecipeName — concentrate branch', () => {
  it('builds "{potency}% — {carrier}" from the selections', () => {
    expect(
      deriveDefaultRecipeName({
        potency: 75,
        carrier: 'mct',
      })
    ).toBe('75% — MCT')
  })

  it('uses the short carrier name (no "oil" suffix)', () => {
    const result = deriveDefaultRecipeName({
      potency: 50,
      carrier: 'mct',
    })
    expect(result).toBe('50% — MCT')
    expect(result).not.toContain('oil')
  })
})

describe('deriveDefaultRecipeName — avb branch', () => {
  it('builds "{color} — {carrier}" from the selections', () => {
    expect(
      deriveDefaultRecipeName({
        color: 'light',
        carrier: 'alcohol',
      })
    ).toBe('Light — Alcohol')
  })

  it('uses the short color name (no parenthetical descriptor)', () => {
    const result = deriveDefaultRecipeName({
      color: 'medium',
      carrier: 'glycerin',
    })
    expect(result).toBe('Medium — Glycerin')
    expect(result).not.toContain('(medium brown)')
  })
})

describe('deriveDefaultRecipeName — topical branch', () => {
  it('builds "{carrier} — {appArea title}" from the selections', () => {
    expect(
      deriveDefaultRecipeName({
        carrier: 'olive',
        applicationArea: 'joint',
      })
    ).toBe('Olive — Joints / arthritis')
  })

  it('keeps the full application-area title (per §8.5 example)', () => {
    // The application-area title keeps the parenthetical descriptor
    // so the recipe name reads as a self-describing phrase.
    expect(
      deriveDefaultRecipeName({
        carrier: 'coconut',
        applicationArea: 'body',
      })
    ).toBe('Coconut — Body (general)')
  })
})

describe('deriveDefaultRecipeName — empty + defensive', () => {
  it('returns "Untitled batch" for an empty selections object', () => {
    expect(deriveDefaultRecipeName({})).toBe('Untitled batch')
  })

  it('falls back to the method id itself when the id is unknown (defensive)', () => {
    // The engine method IDs are a closed union but the wizard's
    // `selections.method` is typed `string` — the derivation must
    // not crash on an unknown id, and should render the raw id so
    // the recipe still has a meaningful label.
    const result = deriveDefaultRecipeName({
      method: 'mystery_method_xyz',
      weight: { value: 5, unit: 'g' },
    })
    expect(result).toContain('mystery_method_xyz')
    expect(result).toContain('5g')
  })

  it('falls back to the carrier id itself when the id is unknown', () => {
    const result = deriveDefaultRecipeName({
      potency: 65,
      carrier: 'unknown_carrier',
    })
    expect(result).toBe('65% — unknown_carrier')
  })

  it('falls back to the color id itself when the id is unknown', () => {
    const result = deriveDefaultRecipeName({
      color: 'chartreuse' as 'light',
      carrier: 'alcohol',
    })
    expect(result).toBe('chartreuse — Alcohol')
  })
})

/* ------------------------------------------------------------------ */
/* NameRecipeStep — component                                          */
/* ------------------------------------------------------------------ */

/** A representative Flower-branch selections set, used as the
 *  default in the component tests below. */
const flowerSelections: WizardSelections = {
  method: 'oven_sealed',
  weight: { value: 7, unit: 'g' },
  fat: 'coconut',
}

describe('NameRecipeStep — render + placeholder', () => {
  it('renders the root card with the name-recipe-step testid', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    expect(screen.getByTestId('name-recipe-step')).toBeTruthy()
  })

  it('renders the input with the derived default as its placeholder', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    expect(input.placeholder).toBe('Oven, sealed bag — 7g — Coconut')
  })

  it('renders the derived default in the placeholder indicator', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    const placeholderEl = screen.getByTestId('name-recipe-step-placeholder')
    expect(placeholderEl.textContent).toContain(
      'Oven, sealed bag — 7g — Coconut'
    )
  })

  it('renders the hint with the name-recipe-step-hint testid', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    const hint = screen.getByTestId('name-recipe-step-hint')
    expect(hint.textContent).toBe('You can change this later from the Dashboard.')
  })

  it('renders the save button with the name-recipe-step-save testid', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    const save = screen.getByTestId('name-recipe-step-save')
    expect(save).toBeTruthy()
    expect(save.textContent).toContain('Save recipe')
  })
})

describe('NameRecipeStep — initial value', () => {
  it('pre-fills the input with the derived default when initialName is empty', () => {
    render(
      <NameRecipeStep
        initialName=""
        onSave={() => {}}
        selections={flowerSelections}
      />
    )
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    expect(input.value).toBe('Oven, sealed bag — 7g — Coconut')
  })

  it('pre-fills the input with initialName when provided', () => {
    render(
      <NameRecipeStep
        initialName="OG Kush — morning dose"
        onSave={() => {}}
        selections={flowerSelections}
      />
    )
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    expect(input.value).toBe('OG Kush — morning dose')
  })

  it('falls back to the derived default when initialName is whitespace only', () => {
    render(
      <NameRecipeStep
        initialName="   "
        onSave={() => {}}
        selections={flowerSelections}
      />
    )
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    expect(input.value).toBe('Oven, sealed bag — 7g — Coconut')
  })
})

describe('NameRecipeStep — user typing', () => {
  it('updates the input value when the user types', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My custom name' } })
    expect(input.value).toBe('My custom name')
  })
})

describe('NameRecipeStep — Save', () => {
  it('calls onSave with the entered value when "Save recipe" is tapped', () => {
    const onSave = vi.fn()
    render(<NameRecipeStep onSave={onSave} selections={flowerSelections} />)
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My custom name' } })
    fireEvent.click(screen.getByTestId('name-recipe-step-save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('My custom name')
  })

  it('calls onSave with the entered value when Enter is pressed in the input', () => {
    const onSave = vi.fn()
    render(<NameRecipeStep onSave={onSave} selections={flowerSelections} />)
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Enter-key name' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Enter-key name')
  })

  it('falls back to the derived default when the user cleared the field and tapped Save', () => {
    const onSave = vi.fn()
    render(<NameRecipeStep onSave={onSave} selections={flowerSelections} />)
    const input = screen.getByTestId(
      'name-recipe-step-input'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByTestId('name-recipe-step-save'))
    expect(onSave).toHaveBeenCalledWith('Oven, sealed bag — 7g — Coconut')
  })
})

describe('NameRecipeStep — Skip', () => {
  it('renders the "Skip — use default name" button when onSkip is provided', () => {
    render(
      <NameRecipeStep
        onSave={() => {}}
        onSkip={() => {}}
        selections={flowerSelections}
      />
    )
    expect(
      screen.getByText('Skip — use default name')
    ).toBeTruthy()
  })

  it('does NOT render the Skip button when onSkip is omitted', () => {
    render(<NameRecipeStep onSave={() => {}} selections={flowerSelections} />)
    expect(screen.queryByText('Skip — use default name')).toBeNull()
  })

  it('calls onSkip when the Skip button is tapped', () => {
    const onSkip = vi.fn()
    const onSave = vi.fn()
    render(
      <NameRecipeStep
        onSave={onSave}
        onSkip={onSkip}
        selections={flowerSelections}
      />
    )
    fireEvent.click(screen.getByText('Skip — use default name'))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})
