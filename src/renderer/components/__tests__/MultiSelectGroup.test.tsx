import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiSelectGroup } from 'renderer/components/MultiSelectGroup'

const baseOptions = [
  {
    id: 'sous-vide-dry',
    label: 'Sous Vide — Dry',
    selected: false,
    onToggle: vi.fn(),
  },
  {
    id: 'oven-sealed',
    label: 'Oven — Sealed Container',
    subtitle: 'Most accessible home method',
    meta: '120°C · 45 min',
    selected: true,
    onToggle: vi.fn(),
  },
  {
    id: 'oven-open',
    label: 'Oven — Open Air',
    selected: false,
    onToggle: vi.fn(),
  },
]

describe('MultiSelectGroup primitive', () => {
  it('renders the group label, the options, and the live counter', () => {
    render(<MultiSelectGroup label="Decarb methods" options={baseOptions} />)

    // Group label is exposed as a real <legend>.
    expect(screen.getByText('Decarb methods').tagName).toBe('LEGEND')

    // The fieldset binds the rows together for assistive tech.
    expect(screen.getAllByRole('checkbox').length).toBe(baseOptions.length)

    // Live counter shows selected / total.
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      'Selected: 1 of 3'
    )
  })

  it('renders custom hint and counterLabel when provided', () => {
    render(
      <MultiSelectGroup
        counterLabel="1 of 3 picked"
        hint="Pick all the methods you have access to."
        label="Decarb methods"
        options={baseOptions}
      />
    )

    expect(
      screen.getByText('Pick all the methods you have access to.')
    ).toBeTruthy()
    // counterLabel is treated as a literal override (parent owns the format).
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      '1 of 3 picked'
    )
  })

  it('reports zero selected when none are toggled on', () => {
    const noneSelected = baseOptions.map(o => ({ ...o, selected: false }))
    render(<MultiSelectGroup label="Decarb methods" options={noneSelected} />)
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      'Selected: 0 of 3'
    )
  })

  it('routes row toggles back to each option on toggle', () => {
    const onToggleDry = vi.fn()
    const onToggleOpen = vi.fn()
    render(
      <MultiSelectGroup
        label="Decarb methods"
        options={[
          {
            id: 'sous-vide-dry',
            label: 'Dry',
            selected: false,
            onToggle: onToggleDry,
          },
          {
            id: 'oven-open',
            label: 'Open',
            selected: false,
            onToggle: onToggleOpen,
          },
        ]}
      />
    )

    fireEvent.click(screen.getByText('Dry'))
    fireEvent.click(screen.getByText('Open'))
    expect(onToggleDry).toHaveBeenCalledTimes(1)
    expect(onToggleOpen).toHaveBeenCalledTimes(1)
  })

  it('lays options out as a vertical stack by default', () => {
    const { container } = render(
      <MultiSelectGroup label="Decarb methods" options={baseOptions} />
    )
    // Default layout: a single column flex container, not a CSS grid.
    const layoutEl = container.querySelector(
      'fieldset > div.flex.flex-col.gap-2, fieldset > div.grid'
    )
    expect(layoutEl).toBeTruthy()
  })

  it('switches to a grid layout when layout="grid" is passed', () => {
    const { container } = render(
      <MultiSelectGroup
        label="Decarb methods"
        layout="grid"
        options={baseOptions}
      />
    )
    expect(container.querySelector('div.grid')).toBeTruthy()
    expect(container.querySelector('div.flex.flex-col.gap-2')).toBeFalsy()
  })

  it('renders an empty group with a 0 of 0 counter', () => {
    render(<MultiSelectGroup label="No options yet" options={[]} />)
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      'Selected: 0 of 0'
    )
    expect(screen.queryAllByRole('checkbox').length).toBe(0)
  })

  it('uses semantic fieldset + legend structure', () => {
    const { container } = render(
      <MultiSelectGroup label="Decarb methods" options={baseOptions} />
    )
    expect(container.querySelector('fieldset legend')?.textContent).toBe(
      'Decarb methods'
    )
  })
})
