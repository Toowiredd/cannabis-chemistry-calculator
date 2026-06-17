import { flushSync } from 'react-dom'
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
    const { firstTimerOpen } = useAppStore.getState()
    return firstTimerOpen ? <div>First-Timer Guide Modal</div> : null
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
      firstTimerOpen: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts first-run users on quick batch and opens the guide', () => {
    useAppStore.setState({
      firstRunDismissed: false,
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    flushSync(() => {
      root.render(<MainScreen />)
    })

    expect(useAppStore.getState().activeTab).toBe('quickbatch')
    expect(container.textContent).toContain('Quick Batch Tab')
    expect(container.textContent).toContain('First-Timer Guide Modal')

    root.unmount()
  })

  it('opens the chooser on ambiguous return and lets the user pick history', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    flushSync(() => {
      root.render(<MainScreen />)
    })

    expect(container.textContent).toContain('Choose where to start')
    expect(container.textContent).toContain('Quick Batch Tab')

    flushSync(() => {
      findButton(container, 'History / learn').click()
    })

    expect(useAppStore.getState().activeTab).toBe('journal')
    expect(container.textContent).toContain('Journal Tab')
    expect(useAppStore.getState().startupRouting.lastChooserIntent).toBe(
      'history_learn'
    )

    root.unmount()
  })
})
