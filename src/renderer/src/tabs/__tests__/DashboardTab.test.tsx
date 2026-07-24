/**
 * DashboardTab — 2026-07-25 ccc workflow-validator audit
 * (BLOCKER B4) regression coverage.
 *
 * The audit found:
 * - The "Material on Hand" stat at `DashboardTab.tsx:325-344` was
 *   always 0.0g because the inventory was always empty (no UI
 *   surface wrote to it).
 * - The fix is two-part:
 *   1. The stat-card must read from real inventory data
 *      (`inventory.items[].amountGrams`).
 *   2. When `items.length === 0`, the stat-card must NOT lie to
 *      the user with a "0.0 g" reading — it must surface a
 *      "Add your first batch" CTA that navigates to the
 *      InventorySection below.
 *
 * This test pins the read-side of that contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DashboardTab } from '../DashboardTab'
import { useAppStore } from '../../stores/appStore'

/* jsdom doesn't ship matchMedia by default — stub a no-op. */
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
})

/**
 * Reset the inventory + journal slices to a known seed. The
 * Dashboard's "Material on Hand" stat depends on inventory; the
 * other stats depend on journalEntries. Pinning both keeps the
 * tests isolated from cross-test pollution.
 */
function resetInventory(
  items: Array<{
    id: string
    date: string
    type: 'purchase' | 'usage'
    name: string
    amountGrams: string
  }> = []
) {
  useAppStore.setState({
    inventory: { items, lowStockThreshold: '3.5' },
    journalEntries: [],
  })
}

const MATERIAL_STAT_TESTID = 'dashboard-stat-material-on-hand'

describe('DashboardTab — Material on Hand stat (audit B4)', () => {
  beforeEach(() => resetInventory())

  it('does NOT show "0.0 g" when inventory is empty — it shows a CTA instead', () => {
    render(<DashboardTab />)
    const card = screen.getByTestId(MATERIAL_STAT_TESTID)
    // The card's text content must NOT include a misleading
    // "0.0 g" reading. The audit's design principle: don't lie
    // to the user when the inventory is just empty.
    expect(card.textContent).not.toMatch(/0\.0\s*g/)
    // It must show the empty-state CTA. The CTA is the first
    // thing the user sees — not a small link buried below.
    expect(card.textContent).toMatch(/Add your first batch/i)
  })

  it('the empty-state CTA is a button with an accessible name (audit M7 pattern)', () => {
    render(<DashboardTab />)
    const cta = screen.getByTestId(MATERIAL_STAT_TESTID)
    expect(cta.tagName).toBe('BUTTON')
    expect(cta.getAttribute('aria-label')).toBeTruthy()
  })

  it('reads the real on-hand sum from inventory.items[].amountGrams', () => {
    resetInventory([
      {
        id: 'inv_a',
        date: '2026-07-25',
        type: 'purchase',
        name: 'OG Kush',
        amountGrams: '7',
      },
      {
        id: 'inv_b',
        date: '2026-07-25',
        type: 'purchase',
        name: 'Gelato',
        amountGrams: '3.5',
      },
    ])
    render(<DashboardTab />)
    const card = screen.getByTestId(MATERIAL_STAT_TESTID)
    // 7 + 3.5 = 10.5 g. The audit's B4 regression: this was
    // always 0.0g before the InventorySection landed.
    expect(card.textContent).toMatch(/10\.5\s*g/)
    // The CTA must be gone — the inventory is no longer empty.
    expect(card.textContent).not.toMatch(/Add your first batch/i)
  })

  it('subtracts usage items from the on-hand sum', () => {
    resetInventory([
      {
        id: 'inv_purchase',
        date: '2026-07-25',
        type: 'purchase',
        name: 'OG Kush',
        amountGrams: '10',
      },
      {
        id: 'inv_usage',
        date: '2026-07-25',
        type: 'usage',
        name: 'batch 1',
        amountGrams: '3.5',
      },
    ])
    render(<DashboardTab />)
    const card = screen.getByTestId(MATERIAL_STAT_TESTID)
    // 10 - 3.5 = 6.5 g
    expect(card.textContent).toMatch(/6\.5\s*g/)
  })

  it('the CTA scrolls to the inventory section on click', () => {
    // jsdom doesn't ship Element.prototype.scrollIntoView; install
    // a stub so the handler can call it. We assert the stub was
    // hit, not the smooth-scroll behavior itself.
    const scrollSpy = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollSpy,
    })
    render(<DashboardTab />)
    const cta = screen.getByTestId(MATERIAL_STAT_TESTID)
    fireEvent.click(cta)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })
})

describe('DashboardTab — inventory section is rendered (audit B4)', () => {
  beforeEach(() => resetInventory())

  it('renders the InventorySection on the dashboard', () => {
    render(<DashboardTab />)
    // The InventorySection has a testid on its empty-state CTA.
    expect(screen.getByTestId('inventory-empty-cta')).toBeTruthy()
  })

  it('renders the add form when the inventory is empty', () => {
    render(<DashboardTab />)
    expect(screen.getByTestId('inventory-add-form')).toBeTruthy()
  })
})

describe('DashboardTab — adding via the InventorySection updates the Material on Hand stat', () => {
  beforeEach(() => resetInventory())

  it('a new purchase item flips the stat from CTA to value', () => {
    render(<DashboardTab />)
    // Form is pre-expanded. Add an item.
    fireEvent.change(screen.getByTestId('inventory-name-input'), {
      target: { value: 'OG Kush' },
    })
    fireEvent.change(screen.getByTestId('inventory-amount-input'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('inventory-save-button'))
    // The stat card should now show 5.0 g, not the CTA.
    const card = screen.getByTestId(MATERIAL_STAT_TESTID)
    expect(card.textContent).toMatch(/5\.0\s*g/)
    expect(card.textContent).not.toMatch(/Add your first batch/i)
  })
})
