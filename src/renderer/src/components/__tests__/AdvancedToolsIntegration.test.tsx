import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MainScreen } from 'renderer/screens/main'
import { useAppStore } from 'renderer/src/stores/appStore'

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
  FirstTimerGuide: () => null,
}))

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    candidate => candidate.textContent?.trim() === label
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`)
  }
  return button
}

describe('Advanced Tools integration', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    useAppStore.setState({
      activeTab: 'advanced',
      firstRunDismissed: true,
      firstTimerOpen: false,
      advancedTools: {
        subTab: 'fats',
        concentrate: {
          concentrateTypeId: 'wax',
          weight: '1.0',
          thcaOverride: '',
          thcOverride: '',
          customEff: '',
        },
        blending: {
          strains: [
            { name: 'Strain A', potency: 18 },
            { name: 'Strain B', potency: 25 },
          ],
          targetWeight: '10',
          targetPotency: '20',
        },
        cost: {
          materialCost: '50',
          weightG: '3.5',
          thcaPct: '20',
          thcPct: '0',
          extractionEff: '0.82',
          targetDose: '10',
          servings: '',
        },
      },
    })
  })

  it('mounts the intended advanced surface and exposes each tool tab', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    flushSync(() => {
      root.render(<MainScreen />)
    })

    expect(container.textContent).toContain('Advanced Tools')
    expect(container.textContent).toContain('Shared Input')

    flushSync(() => {
      findButton(container, 'Concentrates').click()
    })
    expect(container.textContent).toContain('Concentrate Calculator')

    flushSync(() => {
      findButton(container, 'Strain Blending').click()
    })
    expect(container.textContent).toContain('Strains')

    flushSync(() => {
      findButton(container, 'Cost Analysis').click()
    })
    expect(container.textContent).toContain('Cost Inputs')

    flushSync(() => {
      findButton(container, 'Fat Comparison').click()
    })
    expect(container.textContent).toContain('Shared Input')

    root.unmount()
  })
})
