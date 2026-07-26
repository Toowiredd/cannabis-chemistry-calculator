/**
 * Tests for the OptionTile component.
 *
 * OptionTile is the 2-line summary tile used inside a StepCard's
 * option carousel (per the architecture doc §3.2). It shows a
 * title + subtitle, optionally an icon, and optionally a badge.
 * Tap fires `onTap`; selected state shows a check + accent border.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Leaf } from 'lucide-react'

import { OptionTile } from '../OptionTile'
import type { WizardOption } from 'renderer/src/wizard/wizardTypes'

const baseOption: WizardOption = {
  id: 'test-option',
  title: 'Test option',
  subtitle: 'A short subtitle',
}

describe('OptionTile — render', () => {
  it('renders the title and subtitle', () => {
    render(
      <OptionTile isSelected={false} onTap={() => {}} option={baseOption} />
    )
    expect(screen.getByText('Test option')).toBeTruthy()
    expect(screen.getByText('A short subtitle')).toBeTruthy()
  })

  it('renders an icon when provided', () => {
    render(
      <OptionTile
        isSelected={false}
        onTap={() => {}}
        option={{ ...baseOption, icon: Leaf }}
      />
    )
    // The leaf icon is rendered as an svg
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('renders the badge when provided', () => {
    render(
      <OptionTile
        isSelected={false}
        onTap={() => {}}
        option={{ ...baseOption, badge: 'Beginner-friendly' }}
      />
    )
    expect(screen.getByText('Beginner-friendly')).toBeTruthy()
  })

  it('hides the badge when selected (check wins)', () => {
    render(
      <OptionTile
        isSelected
        onTap={() => {}}
        option={{ ...baseOption, badge: 'Beginner-friendly' }}
      />
    )
    // The badge should NOT render when the tile is selected.
    expect(screen.queryByText('Beginner-friendly')).toBeNull()
    // The check icon should be present.
    expect(screen.getByTestId('option-tile-test-option-check')).toBeTruthy()
  })

  it('renders an empty subtitle without crashing', () => {
    render(
      <OptionTile
        isSelected={false}
        onTap={() => {}}
        option={{ ...baseOption, subtitle: '' }}
      />
    )
    expect(screen.getByText('Test option')).toBeTruthy()
  })
})

describe('OptionTile — tap', () => {
  it('calls onTap when the tile is clicked', () => {
    const onTap = vi.fn()
    render(<OptionTile isSelected={false} onTap={onTap} option={baseOption} />)
    fireEvent.click(screen.getByTestId('option-tile-test-option'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('uses the testId override when provided', () => {
    render(
      <OptionTile
        isSelected={false}
        onTap={() => {}}
        option={baseOption}
        testId="custom-tile"
      />
    )
    expect(screen.getByTestId('custom-tile')).toBeTruthy()
  })
})

describe('OptionTile — selected state', () => {
  it('has aria-pressed=true when selected', () => {
    render(<OptionTile isSelected onTap={() => {}} option={baseOption} />)
    expect(
      screen.getByTestId('option-tile-test-option').getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('has aria-pressed=false when not selected', () => {
    render(
      <OptionTile isSelected={false} onTap={() => {}} option={baseOption} />
    )
    expect(
      screen.getByTestId('option-tile-test-option').getAttribute('aria-pressed')
    ).toBe('false')
  })
})
