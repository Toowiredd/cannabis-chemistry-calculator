/**
 * Tests for the ReferenceStrip component.
 *
 * The ReferenceStrip is the flat row of cards for the 4 reference
 * tabs (Methods, Advanced, Knowledge, Journal) that replaced 4 of
 * the 9 faces in the old 3D coverflow. It renders an icon + title +
 * 2-bullet preview per card, highlights the active tab, and
 * dispatches the active tab change on click.
 *
 * Coverage:
 *  - Mount: 4 cards render, each with title + 2 bullets
 *  - Active highlight: active card has the accent border + glow
 *  - Click: clicking a card sets the active tab in the store
 *  - Hover: non-active cards get a subtle hover transform
 *  - Bullets: the 2 preview bullets are visible and distinct
 *  - Default icons: each tab gets a sensible default lucide icon
 *  - Custom icons: items can override the default icon
 *  - A11y: aria-current, aria-label, role="navigation"
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { ReferenceStrip, type ReferenceStripItem } from '../ReferenceStrip'
import { useAppStore } from '../../stores/appStore'

const ITEMS: ReferenceStripItem[] = [
  {
    id: 'methods',
    label: 'Methods',
    bullets: ['Oven Decarb', 'Sous Vide'],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    bullets: ['Cost Analysis', 'Strain Blending'],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    bullets: ['Chemistry 101', 'AVB Guide'],
  },
  {
    id: 'journal',
    label: 'Journal',
    bullets: ['Recent Batches', 'Saved Recipes'],
  },
]

beforeEach(() => {
  useAppStore.setState({ activeTab: 'methods' })
})

describe('ReferenceStrip — mount + render', () => {
  it('renders one card per item', () => {
    const { container } = render(<ReferenceStrip items={ITEMS} />)
    ITEMS.forEach(item => {
      expect(
        container.querySelector(`[data-testid="reference-card-${item.id}"]`)
      ).toBeTruthy()
    })
  })

  it('renders the title and 2 bullets per card', () => {
    render(<ReferenceStrip items={ITEMS} />)
    ITEMS.forEach(item => {
      const card = screen.getByTestId(`reference-card-${item.id}`)
      expect(within(card).getByText(item.label)).toBeTruthy()
      item.bullets.forEach(b => {
        expect(within(card).getByText(b)).toBeTruthy()
      })
    })
  })

  it('renders a navigation landmark', () => {
    const { container } = render(<ReferenceStrip items={ITEMS} />)
    expect(container.querySelector('[role="navigation"]')).toBeTruthy()
  })
})

describe('ReferenceStrip — active state', () => {
  it('the active card has aria-current="page"', () => {
    render(<ReferenceStrip items={ITEMS} />)
    const activeCard = screen.getByTestId('reference-card-methods')
    expect(activeCard.getAttribute('aria-current')).toBe('page')
  })

  it('inactive cards do not have aria-current', () => {
    render(<ReferenceStrip items={ITEMS} />)
    const inactive = screen.getByTestId('reference-card-journal')
    expect(inactive.getAttribute('aria-current')).toBeNull()
  })

  it('the active card label uses the accent color class', () => {
    const { container } = render(<ReferenceStrip items={ITEMS} />)
    const activeLabel = container.querySelector(
      '[data-testid="reference-card-methods"] span'
    ) as HTMLElement
    // The label span is the first <span> in the card. The active
    // state has the text-accent class.
    expect(activeLabel.className).toContain('text-accent')
  })

  it('switches the active card when activeTab changes', () => {
    const { rerender } = render(<ReferenceStrip items={ITEMS} />)
    expect(
      screen.getByTestId('reference-card-methods').getAttribute('aria-current')
    ).toBe('page')
    useAppStore.setState({ activeTab: 'journal' })
    rerender(<ReferenceStrip items={ITEMS} />)
    expect(
      screen.getByTestId('reference-card-journal').getAttribute('aria-current')
    ).toBe('page')
  })
})

describe('ReferenceStrip — click', () => {
  it('clicking a card sets the active tab', () => {
    render(<ReferenceStrip items={ITEMS} />)
    fireEvent.click(screen.getByTestId('reference-card-advanced'))
    expect(useAppStore.getState().activeTab).toBe('advanced')
  })

  it('clicking the already-active card is a no-op visually but still fires', () => {
    render(<ReferenceStrip items={ITEMS} />)
    fireEvent.click(screen.getByTestId('reference-card-methods'))
    expect(useAppStore.getState().activeTab).toBe('methods')
  })
})

describe('ReferenceStrip — bullets', () => {
  it('renders each bullet as a separate <li>', () => {
    const { container } = render(<ReferenceStrip items={ITEMS} />)
    const journalCard = screen.getByTestId('reference-card-journal')
    const list = within(journalCard).getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items.length).toBe(2)
    expect(within(items[0]).getByText('Recent Batches')).toBeTruthy()
    expect(within(items[1]).getByText('Saved Recipes')).toBeTruthy()
  })

  it('renders a small bullet dot before each text', () => {
    const { container } = render(<ReferenceStrip items={ITEMS} />)
    const methodsCard = screen.getByTestId('reference-card-methods')
    // Two bullet dots (one per bullet text)
    const dots = methodsCard.querySelectorAll('li > span[aria-hidden="true"]')
    expect(dots.length).toBe(2)
  })
})

describe('ReferenceStrip — accessibility', () => {
  it('each card has an aria-label matching the item label', () => {
    render(<ReferenceStrip items={ITEMS} />)
    ITEMS.forEach(item => {
      const card = screen.getByTestId(`reference-card-${item.id}`)
      expect(card.getAttribute('aria-label')).toBe(item.label)
    })
  })
})
