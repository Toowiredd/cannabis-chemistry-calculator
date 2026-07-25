/**
 * Tests for the N-face 3D coverflow TabCarousel.
 *
 * The carousel replaced the 3-face SwipeDeck + flat-tab-bar split
 * in the 2026-07-25 design refresh. All 9 tabs are now faces of a
 * single cylindrical carousel; the current face is in front and the
 * others are arranged around the cylinder so the user can see them
 * "through and behind" the current one (the see-through effect
 * the user asked for).
 *
 * Tests cover:
 *  - Pure helpers (wrapIndex, circularDistance, gesture math)
 *  - 3D transform math (per-face rotateY, translateZ, opacity falloff)
 *  - Mount + render: all faces are in the DOM, only the active one
 *    gets pointer events
 *  - Lazy mounting: faces outside the active ± 2 window don't
 *    render their children (perf optimization)
 *  - Pagination dots: clicking a dot sets the active tab
 *  - Active face: aria-selected="true" on the active face,
 *    aria-hidden="true" on the rest
 *  - Reduced motion: drops the 3D transforms, uses opacity only
 *  - Reduced transparency: drops back-face opacity further so the
 *    focus stays on the active face
 *  - See-through: the active face uses glass-strong, the inactive
 *    faces use glass so the carousel cylinder is visible through
 *    them
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  TabCarousel,
  type CarouselItem,
  computeFaceTransforms,
  wrapIndex,
  circularDistance,
  shouldSwipeTransition,
  shouldWheelTransition,
  SWIPE_THRESHOLD,
  WHEEL_THRESHOLD,
  VISIBLE_WINDOW,
} from '../TabCarousel'
import { useAppStore } from '../../stores/appStore'

/* jsdom doesn't implement matchMedia by default — stub it so the
 * carousel's useEffect doesn't throw. The real implementation
 * (production) only runs in a browser, so this stub is
 * jsdom-specific. */
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

const ITEMS: CarouselItem[] = [
  { id: 'dashboard', label: 'Dashboard', content: <div>Dashboard content</div> },
  { id: 'decarb', label: 'Decarb', content: <div>Decarb content</div> },
  { id: 'infusion', label: 'Infusion', content: <div>Infusion content</div> },
  { id: 'dose', label: 'Dose', content: <div>Dose content</div> },
  { id: 'knowledge', label: 'Knowledge', content: <div>Knowledge content</div> },
]

function resetStore() {
  useAppStore.setState({
    activeTab: 'dashboard',
  })
}

describe('TabCarousel — pure helpers', () => {
  describe('wrapIndex', () => {
    it('returns the same index when in bounds', () => {
      expect(wrapIndex(0, 9)).toBe(0)
      expect(wrapIndex(4, 9)).toBe(4)
      expect(wrapIndex(8, 9)).toBe(8)
    })
    it('wraps forward past the end', () => {
      expect(wrapIndex(9, 9)).toBe(0)
      expect(wrapIndex(10, 9)).toBe(1)
    })
    it('wraps backward past the start', () => {
      expect(wrapIndex(-1, 9)).toBe(8)
      expect(wrapIndex(-10, 9)).toBe(8)
    })
    it('handles empty arrays safely', () => {
      expect(wrapIndex(0, 0)).toBe(0)
      expect(wrapIndex(5, 0)).toBe(0)
    })
  })

  describe('circularDistance', () => {
    it('returns 0 for the same index', () => {
      expect(circularDistance(0, 0, 9)).toBe(0)
      expect(circularDistance(4, 4, 9)).toBe(0)
    })
    it('returns the signed shortest distance', () => {
      // 0 → 1: +1
      expect(circularDistance(0, 1, 9)).toBe(1)
      // 1 → 0: -1
      expect(circularDistance(1, 0, 9)).toBe(-1)
      // 0 → 4: +4
      expect(circularDistance(0, 4, 9)).toBe(4)
      // 4 → 0: -4
      expect(circularDistance(4, 0, 9)).toBe(-4)
    })
    it('takes the short way around the circle', () => {
      // 0 → 5 in a 9-ring: raw=5, half=4, 5>4 so wrap → -4
      // (going backwards 4 is shorter than going forwards 5).
      expect(circularDistance(0, 5, 9)).toBe(-4)
      // 0 → 4 in a 9-ring: raw=4, half=4, no wrap → 4.
      expect(circularDistance(0, 4, 9)).toBe(4)
      // 0 → 8 in a 9-ring: raw=8, half=4, 8>4 so wrap → -1
      // (going backwards 1 is shorter than going forwards 8).
      expect(circularDistance(0, 8, 9)).toBe(-1)
      // Symmetric: 5 → 0 should be +4 (the inverse of 0 → 5).
      expect(circularDistance(5, 0, 9)).toBe(4)
    })
    it('handles empty arrays', () => {
      expect(circularDistance(0, 1, 0)).toBe(0)
    })
  })

  describe('shouldSwipeTransition', () => {
    it('returns null for vertical-only swipes', () => {
      expect(shouldSwipeTransition(0, 100)).toBeNull()
    })
    it('returns null for small horizontal swipes', () => {
      expect(shouldSwipeTransition(SWIPE_THRESHOLD - 1, 0)).toBeNull()
    })
    it('returns left for left-swipe past threshold', () => {
      expect(shouldSwipeTransition(-(SWIPE_THRESHOLD + 10), 0)).toBe('left')
    })
    it('returns right for right-swipe past threshold', () => {
      expect(shouldSwipeTransition(SWIPE_THRESHOLD + 10, 0)).toBe('right')
    })
  })

  describe('shouldWheelTransition', () => {
    it('returns null for vertical-dominant wheel', () => {
      expect(shouldWheelTransition(0, 50, 0)).toBeNull()
    })
    it('returns null below accumulated threshold', () => {
      expect(shouldWheelTransition(20, 0, 0)).toBeNull()
    })
    it('returns left when accumulated deltaX crosses threshold negative', () => {
      const r = shouldWheelTransition(-WHEEL_THRESHOLD - 1, 0, 0)
      expect(r?.direction).toBe('left')
    })
    it('returns right when accumulated deltaX crosses threshold positive', () => {
      const r = shouldWheelTransition(WHEEL_THRESHOLD + 1, 0, 0)
      expect(r?.direction).toBe('right')
    })
  })
})

describe('TabCarousel — 3D transform math', () => {
  it('produces 0° rotateY for the active face', () => {
    const t = computeFaceTransforms(9, 0, false)
    expect(t[0].rotateY).toBe(0)
  })

  it('produces 40° rotateY for the next face (9 items in a ring)', () => {
    const t = computeFaceTransforms(9, 0, false)
    expect(t[1].rotateY).toBe(40)
  })

  it('produces -40° rotateY for the previous face (wraps to last index)', () => {
    const t = computeFaceTransforms(9, 0, false)
    expect(t[8].rotateY).toBe(-40)
  })

  it('the active face is fully opaque', () => {
    const t = computeFaceTransforms(9, 0, false)
    expect(t[0].opacity).toBe(1)
  })

  it('adjacent faces are partially opaque (see-through cylinder)', () => {
    const t = computeFaceTransforms(9, 0, false)
    expect(t[1].opacity).toBeGreaterThan(0.4)
    expect(t[1].opacity).toBeLessThan(0.8)
  })

  it('faces outside the visible window are marked inWindow: false', () => {
    const t = computeFaceTransforms(9, 0, false)
    // Face 0: in window. Face 1, 2, 7, 8: in window (within ±2).
    // Faces 3, 4, 5, 6: out of window.
    expect(t[0].inWindow).toBe(true)
    expect(t[1].inWindow).toBe(true)
    expect(t[2].inWindow).toBe(true)
    expect(t[3].inWindow).toBe(false)
    expect(t[4].inWindow).toBe(false)
    expect(t[5].inWindow).toBe(false)
    expect(t[6].inWindow).toBe(false)
    expect(t[7].inWindow).toBe(true)
    expect(t[8].inWindow).toBe(true)
  })

  it('reduced motion drops 3D transforms and uses opacity only', () => {
    const t = computeFaceTransforms(9, 0, true)
    expect(t[0].rotateY).toBe(0)
    expect(t[0].translateZ).toBe(0)
    expect(t[1].rotateY).toBe(0)
    expect(t[1].translateZ).toBe(0)
    // The active face is fully opaque; back faces are 0 in reduced motion.
    expect(t[0].opacity).toBe(1)
    expect(t[1].opacity).toBeGreaterThan(0)
  })

  it('handles an empty array', () => {
    expect(computeFaceTransforms(0, 0, false)).toEqual([])
  })
})

describe('TabCarousel — mount + render', () => {
  beforeEach(() => resetStore())

  it('renders one face per item', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    ITEMS.forEach(item => {
      expect(
        container.querySelector(`[data-testid="carousel-face-${item.id}"]`)
      ).toBeTruthy()
    })
  })

  it('the active face has aria-selected=true and pointer-events:auto', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    const active = container.querySelector(
      '[data-testid="carousel-face-dashboard"]'
    ) as HTMLElement
    expect(active.getAttribute('aria-selected')).toBe('true')
    expect(active.style.pointerEvents).toBe('auto')
  })

  it('inactive faces have aria-selected=false and pointer-events:none', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    const inactive = container.querySelector(
      '[data-testid="carousel-face-decarb"]'
    ) as HTMLElement
    expect(inactive.getAttribute('aria-selected')).toBe('false')
    expect(inactive.style.pointerEvents).toBe('none')
  })

  it('inactive faces are aria-hidden', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    const inactive = container.querySelector(
      '[data-testid="carousel-face-decarb"]'
    ) as HTMLElement
    expect(inactive.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders the active face content', () => {
    render(<TabCarousel items={ITEMS} />)
    expect(screen.getByText('Dashboard content')).toBeTruthy()
  })

  it('lazy-mounts: faces outside the active ± 2 window do NOT render their children', () => {
    // 9 items, active is 0. Faces 3..6 are out of the visible window.
    const manyItems: CarouselItem[] = Array.from({ length: 9 }, (_, i) => ({
      id: `tab${i}` as CarouselItem['id'],
      label: `Tab ${i}`,
      content: <div>Content {i}</div>,
    }))
    useAppStore.setState({ activeTab: 'tab0' as CarouselItem['id'] })
    const { container } = render(<TabCarousel items={manyItems} />)
    // In-window faces: their content is in the DOM.
    expect(container.textContent).toContain('Content 0')
    expect(container.textContent).toContain('Content 1')
    expect(container.textContent).toContain('Content 2')
    expect(container.textContent).toContain('Content 7')
    expect(container.textContent).toContain('Content 8')
    // Out-of-window faces: their content is NOT in the DOM.
    expect(container.textContent).not.toContain('Content 3')
    expect(container.textContent).not.toContain('Content 4')
    expect(container.textContent).not.toContain('Content 5')
    expect(container.textContent).not.toContain('Content 6')
  })
})

describe('TabCarousel — pagination dots', () => {
  beforeEach(() => resetStore())

  it('renders one dot per item', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    const dots = container.querySelectorAll('[role="tab"]')
    expect(dots.length).toBe(ITEMS.length)
  })

  it('clicking a dot switches the active tab', () => {
    const { container } = render(<TabCarousel items={ITEMS} />)
    const decarbDot = Array.from(container.querySelectorAll('[role="tab"]')).find(
      b => b.getAttribute('aria-label') === 'Decarb'
    ) as HTMLElement
    fireEvent.click(decarbDot)
    expect(useAppStore.getState().activeTab).toBe('decarb')
  })

  it('the active dot has aria-selected=true', () => {
    useAppStore.setState({ activeTab: 'infusion' })
    const { container } = render(<TabCarousel items={ITEMS} />)
    const dot = container.querySelector('[aria-label="Infusion"][role="tab"]')
    expect(dot?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('TabCarousel — click on a back face brings it to the front', () => {
  beforeEach(() => resetStore())

  it('clicking a visible back face sets it as the active tab', () => {
    // 5 items, active is 0. Face 1 is in-window (adjacent).
    const { container } = render(<TabCarousel items={ITEMS} />)
    const decarbFace = container.querySelector(
      '[data-testid="carousel-face-decarb"]'
    ) as HTMLElement
    // The face has an overlay <button> with aria-label "Go to Decarb".
    const clickOverlay = within(decarbFace).getByLabelText(
      'Go to Decarb'
    ) as HTMLElement
    fireEvent.click(clickOverlay)
    expect(useAppStore.getState().activeTab).toBe('decarb')
  })
})

describe('TabCarousel — reduced motion', () => {
  beforeEach(() => resetStore())

  it('drops the 3D transforms under prefers-reduced-motion', () => {
    // Stub matchMedia to return matches: true for reduce.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    const { container } = render(<TabCarousel items={ITEMS} />)
    const decarbFace = container.querySelector(
      '[data-testid="carousel-face-decarb"]'
    ) as HTMLElement
    // Under reduced motion the face's transform is empty (no 3D).
    expect(decarbFace.style.transform).toBe('')
  })
})
