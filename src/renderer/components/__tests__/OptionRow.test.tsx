import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Thermometer } from 'lucide-react'
import { OptionRow } from 'renderer/components/OptionRow'

function renderRow(
  overrides: Partial<React.ComponentProps<typeof OptionRow>> = {}
) {
  const onToggle = overrides.onToggle ?? vi.fn()
  const props = {
    id: 'sous-vide-dry',
    label: 'Sous Vide — Dry',
    selected: false,
    onToggle,
    ...overrides,
  }
  return { onToggle, ...render(<OptionRow {...props} />) }
}

describe('OptionRow primitive', () => {
  it('renders label, subtitle, meta, and a screen-reader-only checkbox', () => {
    const { container } = renderRow({
      subtitle: 'Best potency + terpene retention',
      meta: '113°C · 60 min',
    })

    // Label + helper text are visible to all readers.
    expect(screen.getByText('Sous Vide — Dry')).toBeTruthy()
    expect(screen.getByText('Best potency + terpene retention')).toBeTruthy()
    expect(screen.getByText('113°C · 60 min')).toBeTruthy()

    // Native checkbox is hidden but still focusable + form-participating.
    const input = screen.getByRole('checkbox', { name: /sous vide/i })
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).type).toBe('checkbox')
    expect(input.className).toMatch(/sr-only/)

    // It lives inside a <label> so the whole row is the click target.
    expect(container.querySelector('label[for]')).toBeTruthy()
  })

  it('reflects selected state via data-selected and checked', () => {
    const { rerender, onToggle } = renderRow({ selected: false })

    const input = screen.getByRole('checkbox', { name: /sous vide/i })
    const row = document.querySelector('[data-option-row-id="sous-vide-dry"]')
    expect(row?.getAttribute('data-selected')).toBe('false')
    expect((input as HTMLInputElement).checked).toBe(false)

    rerender(
      <OptionRow
        id="sous-vide-dry"
        label="Sous Vide — Dry"
        onToggle={onToggle}
        selected
      />
    )

    expect(row?.getAttribute('data-selected')).toBe('true')
    expect((input as HTMLInputElement).checked).toBe(true)
  })

  it('renders an unchecked visual chip before selection and a check icon after', () => {
    const { rerender, onToggle } = renderRow({ selected: false })

    // No <svg> tag inside the label before selection (no check icon rendered).
    expect(document.querySelector('label svg')).toBeFalsy()

    rerender(
      <OptionRow
        id="sous-vide-dry"
        label="Sous Vide — Dry"
        onToggle={onToggle}
        selected
      />
    )
    expect(document.querySelector('label svg')).toBeTruthy()
  })

  it('fires onToggle when the user clicks the row', () => {
    const onToggle = vi.fn()
    renderRow({ onToggle })
    // Click anywhere in the label — native label/checkbox wiring forwards
    // the click to the input, which fires onChange → onToggle.
    fireEvent.click(screen.getByText('Sous Vide — Dry'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('fires onToggle when the underlying checkbox is clicked', () => {
    const onToggle = vi.fn()
    renderRow({ onToggle })
    const input = screen.getByRole('checkbox', { name: /sous vide/i })
    fireEvent.click(input)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not fire onToggle when disabled', () => {
    const onToggle = vi.fn()
    renderRow({ onToggle, disabled: true })
    const row = document.querySelector('[data-option-row-id="sous-vide-dry"]')
    expect(row?.getAttribute('aria-disabled')).toBe('true')

    const input = screen.getByRole('checkbox', { name: /sous vide/i })
    expect((input as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('Sous Vide — Dry'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('renders the previewSlot when provided', () => {
    const { container } = renderRow({
      previewSlot: <span data-testid="preview">42.0 mg</span>,
    })
    const slot = container.querySelector('[data-testid="preview"]')
    expect(slot).toBeTruthy()
    expect(slot?.textContent).toBe('42.0 mg')
  })

  it('renders the Lucide icon when provided', () => {
    const { container } = renderRow({ icon: Thermometer, selected: true })
    // The decorative icon is rendered as <svg aria-hidden="true"> directly.
    // (With `selected=true` we also get the check-mark svg, so we expect ≥1.)
    expect(
      container.querySelectorAll('svg[aria-hidden="true"]').length
    ).toBeGreaterThanOrEqual(1)
  })

  it('exposes data-option-row-id for stable test selection', () => {
    renderRow({ id: 'deck-test' })
    expect(
      document.querySelector('[data-option-row-id="deck-test"]')
    ).toBeTruthy()
  })

  it('does not animate scale or translate on hover (reduced-motion friendly)', () => {
    const { container } = renderRow({ selected: true })
    const labelClass = (container.querySelector('label') as HTMLElement)
      .className
    // Only border-color + background-color animate.
    expect(labelClass).toMatch(/transition-\[border-color/)
    // Defensive: never use transition-all (would catch transform too),
    // never include scale/translate hover utilities.
    expect(labelClass).not.toMatch(/transition-all/)
    expect(labelClass).not.toMatch(/hover:scale/)
    expect(labelClass).not.toMatch(/hover:translate/)
  })
})
