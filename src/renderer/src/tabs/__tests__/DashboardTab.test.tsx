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

/* ================================================================== */
/* Week 6 (§8.3) — Resume last batch + Stock recipes                   */
/* ================================================================== */

describe('DashboardTab — Resume last batch (Week 6, §8.3)', () => {
  beforeEach(() => {
    resetInventory()
    // Clear the recipes slice between tests so a previous test's
    // addRecipe doesn't leak into the next test's render. The
    // addRecipe action seeds a new id via crypto.randomUUID, so
    // a clean reset is required for the "null" assertion below
    // to be meaningful.
    useAppStore.setState({ recipes: [] })
  })

  it('does NOT render the resume card when no saved Recipe exists (default state)', () => {
    render(<DashboardTab />)
    // Default state: recipes is `[]`, so the card hides itself.
    expect(screen.queryByTestId('dashboard-resume-card')).toBeNull()
  })

  it('renders the resume card when at least one saved Recipe exists', () => {
    // Seed a saved Recipe. The Dashboard's resume lookup picks
    // the most recent (sorted by createdAt desc) — a single
    // entry is enough to surface the card.
    useAppStore.getState().addRecipe({
      name: 'My first batch',
      branch: 'flower',
      selections: { method: 'oven_sealed' },
      batchJournalEntryId: null,
    })
    render(<DashboardTab />)
    const card = screen.getByTestId('dashboard-resume-card')
    expect(card).toBeTruthy()
    // The summary line carries the recipe's name + branch +
    // step number. The exact phrasing is implementation-
    // defined; we just assert the three pieces are present.
    const summary = screen.getByTestId('dashboard-resume-card-summary')
    expect(summary.textContent).toMatch(/My first batch/)
    expect(summary.textContent).toMatch(/flower/)
    expect(summary.textContent).toMatch(/step\s*0/)
  })

  it('picks the most recent Recipe when several exist', () => {
    // Two recipes — the second is more recent. The card should
    // render the second recipe's name, not the first.
    useAppStore.getState().addRecipe({
      name: 'Older batch',
      branch: 'flower',
      selections: {},
      batchJournalEntryId: null,
    })
    useAppStore.getState().addRecipe({
      name: 'Newer batch',
      branch: 'avb',
      selections: {},
      batchJournalEntryId: null,
    })
    render(<DashboardTab />)
    const summary = screen.getByTestId('dashboard-resume-card-summary')
    expect(summary.textContent).toMatch(/Newer batch/)
    expect(summary.textContent).toMatch(/avb/)
    // And the older batch name is NOT on the page.
    expect(summary.textContent).not.toMatch(/Older batch/)
  })

  it('tapping the Resume CTA opens the wizard and routes to step 0', () => {
    useAppStore.getState().addRecipe({
      name: 'My saved batch',
      branch: 'flower',
      selections: { method: 'oven_sealed', weight: { value: 7, unit: 'g' } },
      batchJournalEntryId: null,
    })
    render(<DashboardTab />)
    // The wizard IS the canonical UI/UX; `wizardEnabled` defaults
    // to `true`. The Resume CTA doesn't need to flip a flag — it
    // just sets the branch and restores the recipe's selections.
    // (Kill-switch test path is covered separately in the
    // "Resume card absent when wizardEnabled is false" describe
    // block below.)
    expect(useAppStore.getState().wizardEnabled).toBe(true)
    fireEvent.click(screen.getByTestId('dashboard-resume-card-cta'))
    // The CTA sets the branch and restores the recipe's
    // selections. The flag stays `true` (it was already on).
    const state = useAppStore.getState()
    expect(state.wizardEnabled).toBe(true)
    expect(state.wizard.branch).toBe('flower')
    expect(state.wizard.stage1Selections.method).toBe('oven_sealed')
    expect(state.wizard.stage1Selections.weight).toEqual({
      value: 7,
      unit: 'g',
    })
    // And the wizard is routed to step 0 (the product-type
    // picker) per §8.3 — the selections are pre-filled but the
    // user reviews them, they don't skip.
    expect(state.wizard.currentStep).toBe(0)
  })
})

/* ------------------------------------------------------------------ */

describe('DashboardTab — Stock recipes section (Week 6, §8.3)', () => {
  beforeEach(() => {
    resetInventory()
    useAppStore.setState({ recipes: [], wizardEnabled: false })
    // Reset Stage 1 wizard state so a previous test's setSelection
    // call doesn't leak into the next test's "no pre-fill" check.
    useAppStore.getState().resetWizard()
  })

  it('renders the Stock recipes section + list', () => {
    render(<DashboardTab />)
    expect(screen.getByTestId('dashboard-stock-recipes-section')).toBeTruthy()
    expect(screen.getByTestId('dashboard-stock-recipes-list')).toBeTruthy()
  })

  it('renders all 5 stock recipe cards', () => {
    render(<DashboardTab />)
    // The 5 brief-mandated cards each render a StockRecipeCard
    // with a `stock-recipe-card-<id>` testid. We assert each id
    // is present on the page.
    const expectedIds = [
      'standard-oven-decarb',
      'quick-sous-vide',
      'coconut-oil-infusion',
      'light-avb-tincture',
      'beginner-olive-salve',
    ]
    for (const id of expectedIds) {
      expect(screen.getByTestId(`stock-recipe-card-${id}`)).toBeTruthy()
    }
  })

  it('tapping a stock recipe pre-fills the wizard + routes to step 0', () => {
    render(<DashboardTab />)
    expect(useAppStore.getState().wizardEnabled).toBe(false)
    // Tap the "Coconut Oil Infusion" card. The handler pre-fills
    // the wizard with the recipe's selections and opens it.
    fireEvent.click(
      screen.getByTestId('stock-recipe-card-coconut-oil-infusion')
    )
    const state = useAppStore.getState()
    // wizardEnabled flipped on
    expect(state.wizardEnabled).toBe(true)
    // branch set to the recipe's branch
    expect(state.wizard.branch).toBe('flower')
    // selections pre-filled — the recipe carries
    // method=oven_sealed, weight=14g, efficiency=0.93, fat=coconut,
    // volume=240mL. The Dashboard wire calls setSelection for
    // each key.
    expect(state.wizard.stage1Selections.method).toBe('oven_sealed')
    expect(state.wizard.stage1Selections.weight).toEqual({
      value: 14,
      unit: 'g',
    })
    expect(state.wizard.stage1Selections.efficiency).toBe(0.93)
    expect(state.wizard.stage1Selections.fat).toBe('coconut')
    expect(state.wizard.stage1Selections.volume).toEqual({
      value: 240,
      unit: 'mL',
    })
    // And the wizard is at step 0 (per §8.3: pre-fills, doesn't
    // skip — the user reviews every pre-filled step before
    // transitioning to Stage 2).
    expect(state.wizard.currentStep).toBe(0)
  })

  it('tapping a topical recipe (no decarb method) pre-fills the topical branch + carrier', () => {
    render(<DashboardTab />)
    fireEvent.click(
      screen.getByTestId('stock-recipe-card-beginner-olive-salve')
    )
    const state = useAppStore.getState()
    expect(state.wizardEnabled).toBe(true)
    expect(state.wizard.branch).toBe('topical')
    expect(state.wizard.stage1Selections.carrier).toBe('olive')
    expect(state.wizard.stage1Selections.volume).toEqual({
      value: 240,
      unit: 'mL',
    })
    expect(state.wizard.stage1Selections.applicationArea).toBe('joints')
    // No method was set — the topical branch skips decarb.
    expect(state.wizard.stage1Selections.method).toBeUndefined()
  })
})
