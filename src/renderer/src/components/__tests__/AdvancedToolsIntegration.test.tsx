import { act } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
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

// Mock that uses React state for the sub-tab so click→re-render works
// the way the real component would. The mock only needs to demonstrate
// that the carousel mounts the active face and the active face's
// content is interactive — it doesn't need to reproduce the real
// sub-tab state model (which lives in the appStore).
vi.mock('renderer/src/tabs/AdvancedToolsTab', () => ({
  AdvancedToolsTab: () => {
    const React = require('react') as typeof import('react')
    const [sub, setSub] = React.useState('fats')
    return (
      <div>
        <h2>Advanced Tools</h2>
        <div>Shared Input</div>
        <button onClick={() => setSub('concentrates')}>Concentrates</button>
        <button onClick={() => setSub('blending')}>Strain Blending</button>
        <button onClick={() => setSub('cost')}>Cost Analysis</button>
        <button onClick={() => setSub('fats')}>Fat Comparison</button>
        {sub === 'concentrates' && <div>Concentrate Calculator</div>}
        {sub === 'blending' && <div>Strains</div>}
        {sub === 'cost' && <div>Cost Inputs</div>}
        {sub === 'fats' && <div>Shared Input</div>}
      </div>
    )
  },
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

  it('mounts the intended advanced surface and exposes each tool tab', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    // The MainScreen now uses React.lazy() to code-split the 9 tabs;
    // `<Suspense>` shows the "Loading tab…" fallback until each tab's
    // chunk resolves. `await act(async)` flushes the microtask queue so
    // the lazy modules (mocked above) resolve before we read the DOM.
    await act(async () => {
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
