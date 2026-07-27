import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MainScreen } from 'renderer/screens/main'
import {
  DEFAULT_DECARB,
  DEFAULT_DOSE,
  DEFAULT_INFUSION,
  DEFAULT_STARTUP_ROUTING,
  useAppStore,
} from 'renderer/src/stores/appStore'
import { evaluateStartupRouting } from 'renderer/src/utils/startupRouting'

vi.mock('renderer/src/components/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}))

vi.mock('renderer/src/components/TransformationCanvas', () => ({
  TransformationCanvas: () => <div data-testid="transformation-canvas" />,
}))

vi.mock('renderer/src/tabs/DecarbTab', () => ({
  DecarbTab: () => <div>Decarb Tab</div>,
}))

vi.mock('renderer/src/tabs/InfusionTab', () => ({
  InfusionTab: () => <div>Infusion Tab</div>,
}))

vi.mock('renderer/src/tabs/DoseTab', () => ({
  DoseTab: () => <div>Dose Tab</div>,
}))

vi.mock('renderer/src/tabs/MethodsTab', () => ({
  MethodsTab: () => <div>Methods Tab</div>,
}))

vi.mock('renderer/src/tabs/AdvancedToolsTab', () => ({
  AdvancedToolsTab: () => <div>Advanced Tools Tab</div>,
}))

vi.mock('renderer/src/tabs/KnowledgeTab', () => ({
  KnowledgeTab: () => <div>Knowledge Tab</div>,
}))

vi.mock('renderer/src/tabs/JournalTab', () => ({
  JournalTab: () => <div>Journal Tab</div>,
}))

vi.mock('renderer/src/tabs/DashboardTab', () => ({
  DashboardTab: () => <div>Dashboard Tab</div>,
}))

vi.mock('renderer/src/tabs/QuickBatchTab', () => ({
  QuickBatchTab: () => <div>Quick Batch Tab</div>,
}))

vi.mock('renderer/src/tabs/FirstTimerGuide', () => ({
  FirstTimerGuide: () => {
    const state = useAppStore.getState() as unknown as {
      wizard: { active: boolean }
      wizardEnabled?: boolean
    }
    // Slide 3 (2026-07-27): the wizard IS the UX. The
    // First-Timer Guide is dead on the happy path — it
    // only renders when the user has rolled back to the
    // legacy GroupedTabNav surface via
    // `wizardEnabled: false`. The mock mirrors the real
    // component's render gate.
    if (state.wizardEnabled === true) return null
    return state.wizard.active ? <div>First-Timer Guide Modal</div> : null
  },
}))

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    candidate => candidate.textContent?.includes(label)
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`)
  }
  return button
}

describe('startup routing heuristic', () => {
  it('shows the chooser with quick batch as the safe fallback when history is weak', () => {
    const decision = evaluateStartupRouting({
      decarb: { ...DEFAULT_DECARB },
      infusion: { ...DEFAULT_INFUSION },
      dose: { ...DEFAULT_DOSE },
      startupRouting: { ...DEFAULT_STARTUP_ROUTING },
    })

    expect(decision.mode).toBe('chooser')
    expect(decision.destinationTab).toBe('quickbatch')
    expect(decision.recommendedIntent).toBe('make_batch')
  })

  it('auto-routes to the repeated successful path when confidence is high', () => {
    const decision = evaluateStartupRouting({
      decarb: { ...DEFAULT_DECARB },
      infusion: { ...DEFAULT_INFUSION },
      dose: { ...DEFAULT_DOSE },
      startupRouting: {
        ...DEFAULT_STARTUP_ROUTING,
        lastSuccessfulIntent: 'history_learn',
        lastSuccessfulTab: 'journal',
        successCounts: {
          ...DEFAULT_STARTUP_ROUTING.successCounts,
          history_learn: 3,
        },
      },
    })

    expect(decision.mode).toBe('route')
    expect(decision.destinationTab).toBe('journal')
    expect(decision.recommendedIntent).toBe('history_learn')
  })
})

describe('MainScreen startup flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    })
    useAppStore.setState({
      activeTab: 'decarb',
      decarb: { ...DEFAULT_DECARB },
      infusion: { ...DEFAULT_INFUSION },
      dose: { ...DEFAULT_DOSE },
      startupRouting: { ...DEFAULT_STARTUP_ROUTING },
      firstRunDismissed: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the wizard on first launch (the wizard IS the UX)', async () => {
    useAppStore.setState({
      firstRunDismissed: false,
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    // Slide 3 (2026-07-27): the wizard is the canonical boot
    // surface. The First-Timer Guide is no longer opened on
    // first launch — the wizard's product-type coverflow is
    // the entry point. Returning users (`wizard.dismissed ===
    // true`) also land on the wizard; they can re-open the
    // coverflow from the "What are you making?" card's
    // pencil icon.
    await act(async () => {
      root.render(<MainScreen />)
    })

    expect(useAppStore.getState().activeTab).toBe('quickbatch')
    expect(container.textContent).toContain('What are you making?')
    // The end-product coverflow is mounted — verified via the
    // data-testid (the testid is on a div and doesn't appear
    // in `container.textContent`).
    expect(
      container.querySelector('[data-testid="end-product-coverflow"]')
    ).toBeTruthy()
    // The First-Timer Guide is no longer the boot path; it
    // remains in the source for the legacy rollback path
    // (`wizardEnabled: false`) but is not shown when the
    // wizard is on.
    expect(container.textContent).not.toContain('First-Timer Guide Modal')

    root.unmount()
  })

  it('opens the wizard on ambiguous return (the chooser is dead code on the happy path)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<MainScreen />)
    })

    // The choose-where-to-start chooser was the legacy entry
    // surface. With the wizard as the default, the chooser
    // never opens — the wizard's product-type coverflow is
    // the entry point regardless of the user's history
    // (returning users, ambiguous return, first launch all
    // land on the wizard).
    expect(container.textContent).toContain('What are you making?')
    expect(
      container.querySelector('[data-testid="end-product-coverflow"]')
    ).toBeTruthy()
    expect(container.textContent).not.toContain('Choose where to start')

    root.unmount()
  })
})
