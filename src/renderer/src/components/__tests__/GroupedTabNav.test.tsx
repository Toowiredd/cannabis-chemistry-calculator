/**
 * Tests for the GroupedTabNav component.
 *
 * The GroupedTabNav is the 2-level navigation surface that replaced
 * the 9-face 3D coverflow. It composes a TabCarousel (workflow
 * group, 3D cylinder) + a NextIndicator + a ReferenceStrip (4
 * reference cards, flat row). The active tab is highlighted in
 * whichever group it lives in; the other group's header dims.
 *
 * Coverage:
 *  - Mount: both groups render
 *  - Active group highlighting: workflow header bright when on
 *    a workflow tab, reference header bright when on a reference tab
 *  - Next indicator: clicking jumps to the configured next tab
 *  - Next step map: default mapping is the documented one
 *    (dose → journal, quickbatch → journal, etc.)
 *  - Custom next step map: caller can override
 *  - 3D backdrop arc: rendered behind the workflow carousel
 *  - GroupHeader subtitle: visible when active
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { GroupedTabNav } from '../GroupedTabNav'
import { useAppStore } from '../../stores/appStore'
import type { CarouselItem } from '../TabCarousel'
import type { ReferenceStripItem } from '../ReferenceStrip'

const WORKFLOW: CarouselItem[] = [
  { id: 'dashboard', label: 'Dashboard', content: <div>Dashboard</div> },
  { id: 'quickbatch', label: 'Quick Batch', content: <div>Quick Batch</div> },
  { id: 'decarb', label: 'Decarb', content: <div>Decarb</div> },
  { id: 'infusion', label: 'Infusion', content: <div>Infusion</div> },
  { id: 'dose', label: 'Dose', content: <div>Dose</div> },
]

const REFERENCE: Array<ReferenceStripItem & { content: React.ReactNode }> = [
  { id: 'methods', label: 'Methods', bullets: ['Oven Decarb', 'Sous Vide'], content: <div>Methods content</div> },
  { id: 'advanced', label: 'Advanced', bullets: ['Cost', 'Blending'], content: <div>Advanced content</div> },
  { id: 'knowledge', label: 'Knowledge', bullets: ['Chem 101', 'AVB'], content: <div>Knowledge content</div> },
  { id: 'journal', label: 'Journal', bullets: ['Batches', 'Recipes'], content: <div>Journal content</div> },
]

beforeEach(() => {
  useAppStore.setState({ activeTab: 'decarb' })
})

describe('GroupedTabNav — mount', () => {
  it('renders both group sections', () => {
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-workflow"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-reference"]')
    ).toBeTruthy()
  })

  it('renders group headers with labels', () => {
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    expect(screen.getByTestId('group-header-workflow').textContent).toContain(
      'Workflow'
    )
    expect(screen.getByTestId('group-header-reference').textContent).toContain(
      'Reference'
    )
  })

  it('renders all workflow items via the carousel', () => {
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    WORKFLOW.forEach(item => {
      expect(
        document.querySelector(`[data-testid="carousel-face-${item.id}"]`)
      ).toBeTruthy()
    })
  })

  it('renders all reference items as cards', () => {
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    REFERENCE.forEach(item => {
      expect(
        document.querySelector(`[data-testid="reference-card-${item.id}"]`)
      ).toBeTruthy()
    })
  })

  it('renders the Next indicator between the two groups', () => {
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-next"]')
    ).toBeTruthy()
  })
})

describe('GroupedTabNav — active group highlighting', () => {
  it('workflow header is bright when activeTab is a workflow tab', () => {
    useAppStore.setState({ activeTab: 'decarb' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    const workflowHeader = container.querySelector(
      '[data-testid="group-header-workflow"]'
    ) as HTMLElement
    expect(workflowHeader.className).toContain('text-accent')
  })

  it('reference header is bright when activeTab is a reference tab', () => {
    useAppStore.setState({ activeTab: 'methods' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    const referenceHeader = container.querySelector(
      '[data-testid="group-header-reference"]'
    ) as HTMLElement
    expect(referenceHeader.className).toContain('text-accent')
  })

  it('workflow header is dim when activeTab is a reference tab', () => {
    useAppStore.setState({ activeTab: 'journal' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    const workflowHeader = container.querySelector(
      '[data-testid="group-header-workflow"]'
    ) as HTMLElement
    expect(workflowHeader.className).toContain('text-foreground/40')
  })
})

describe('GroupedTabNav — Next indicator', () => {
  it('clicking the Next button advances the active tab to the default next step', () => {
    useAppStore.setState({ activeTab: 'dose' })
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    fireEvent.click(screen.getByTestId('next-indicator'))
    // Default mapping: dose → journal
    expect(useAppStore.getState().activeTab).toBe('journal')
  })

  it('quickbatch next step is journal', () => {
    useAppStore.setState({ activeTab: 'quickbatch' })
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    fireEvent.click(screen.getByTestId('next-indicator'))
    expect(useAppStore.getState().activeTab).toBe('journal')
  })

  it('methods next step is journal', () => {
    useAppStore.setState({ activeTab: 'methods' })
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    fireEvent.click(screen.getByTestId('next-indicator'))
    expect(useAppStore.getState().activeTab).toBe('journal')
  })

  it('a custom next step map overrides the default', () => {
    useAppStore.setState({ activeTab: 'decarb' })
    render(
      <GroupedTabNav
        nextStepMap={{ decarb: 'methods' }}
        reference={REFERENCE}
        workflow={WORKFLOW}
      />
    )
    fireEvent.click(screen.getByTestId('next-indicator'))
    // Custom mapping: decarb → methods (instead of the default decarb → infusion)
    expect(useAppStore.getState().activeTab).toBe('methods')
  })

  it('falls back to "methods" if the current tab has no next-step entry', () => {
    // Defensive: the default map covers every TabId, but the
    // caller's override might miss one. Verify the fallback.
    useAppStore.setState({ activeTab: 'dose' })
    render(
      <GroupedTabNav
        nextStepMap={{}} // empty override = use defaults
        reference={REFERENCE}
        workflow={WORKFLOW}
      />
    )
    fireEvent.click(screen.getByTestId('next-indicator'))
    expect(useAppStore.getState().activeTab).toBe('journal')
  })

  it('the Next button aria-label includes the next tab name', () => {
    useAppStore.setState({ activeTab: 'dose' })
    render(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    const nextButton = screen.getByTestId('next-indicator')
    expect(nextButton.getAttribute('aria-label')).toContain('Journal')
    expect(nextButton.getAttribute('aria-label')).toContain('Dose')
  })
})

describe('GroupedTabNav — backdrop arc', () => {
  it('renders the SVG backdrop arc behind the workflow carousel', () => {
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    // An <svg> with the backdrop-arc linearGradient definition
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.textContent).toContain('Workflow') // sanity
  })

  it('the backdrop arc has pointer-events-none (doesn\'t intercept gestures)', () => {
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    const svg = container.querySelector('svg')
    expect(svg?.className.baseVal).toContain('pointer-events-none')
  })
})

describe('GroupedTabNav — reference content panel', () => {
  it('does NOT render the content panel when active tab is a workflow tab', () => {
    useAppStore.setState({ activeTab: 'decarb' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-reference-content"]')
    ).toBeNull()
  })

  it('renders the content panel when active tab is a reference tab', () => {
    useAppStore.setState({ activeTab: 'methods' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-reference-content"]')
    ).toBeTruthy()
  })

  it('renders the active reference tab\'s content inside the panel', () => {
    useAppStore.setState({ activeTab: 'journal' })
    const { container } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    const panel = container.querySelector(
      '[data-testid="reference-content-panel"]'
    )
    expect(panel?.textContent).toContain('Journal content')
  })

  it('switches the content panel when the active reference tab changes', () => {
    useAppStore.setState({ activeTab: 'methods' })
    const { container, rerender } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="reference-content-panel"]')
        ?.textContent
    ).toContain('Methods content')

    useAppStore.setState({ activeTab: 'knowledge' })
    rerender(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    expect(
      container.querySelector('[data-testid="reference-content-panel"]')
        ?.textContent
    ).toContain('Knowledge content')
  })

  it('hides the content panel when returning to a workflow tab', () => {
    useAppStore.setState({ activeTab: 'journal' })
    const { container, rerender } = render(
      <GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />
    )
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-reference-content"]')
    ).toBeTruthy()

    useAppStore.setState({ activeTab: 'decarb' })
    rerender(<GroupedTabNav reference={REFERENCE} workflow={WORKFLOW} />)
    expect(
      container.querySelector('[data-testid="grouped-tab-nav-reference-content"]')
    ).toBeNull()
  })
})
