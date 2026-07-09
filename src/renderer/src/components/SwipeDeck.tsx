import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from 'renderer/lib/utils'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type WorkflowTab = 'decarb' | 'infusion' | 'dose'
export const WORKFLOW_TABS: WorkflowTab[] = ['decarb', 'infusion', 'dose']

export const WORKFLOW_LABELS: Record<WorkflowTab, string> = {
  decarb: 'Decarb',
  infusion: 'Infusion',
  dose: 'Dose',
}

export const SWIPE_THRESHOLD = 80
export const WHEEL_THRESHOLD = 60
export const EDGE_HOVER_DELAY = 200
export const TRANSITION_DURATION = 450

interface SwipeDeckProps {
  /** Three tab contents in fixed order: [Decarb, Infusion, Dose] */
  children: [ReactNode, ReactNode, ReactNode]
  className?: string
}

/* ------------------------------------------------------------------ */
/* Helpers — exported for tests                                       */
/* ------------------------------------------------------------------ */

export function shouldSwipeTransition(
  deltaX: number,
  deltaY: number,
  threshold = SWIPE_THRESHOLD
): 'left' | 'right' | null {
  // Vertical swipes ignored
  if (Math.abs(deltaY) > Math.abs(deltaX)) return null
  if (Math.abs(deltaX) < threshold) return null
  return deltaX < 0 ? 'left' : 'right'
}

export function shouldWheelTransition(
  deltaX: number,
  deltaY: number,
  accumulated: number,
  threshold = WHEEL_THRESHOLD
): { direction: 'left' | 'right'; remaining: number } | null {
  if (Math.abs(deltaY) > Math.abs(deltaX)) return null
  const next = accumulated + deltaX
  if (Math.abs(next) >= threshold) {
    return {
      direction: next < 0 ? 'left' : 'right',
      remaining: next % threshold || 0,
    }
  }
  return null
}

export function workflowIndex(tab: TabId): number {
  return WORKFLOW_TABS.indexOf(tab as WorkflowTab)
}

export function clampIndex(idx: number): number {
  return Math.min(Math.max(idx, 0), WORKFLOW_TABS.length - 1)
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function SwipeDeck({ children, className }: SwipeDeckProps) {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const activeIdx = workflowIndex(activeTab)

  const [reducedMotion, setReducedMotion] = useState(false)
  const [compactDeck, setCompactDeck] = useState(false)
  const [wheelAccum, setWheelAccum] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  /* Refs for stable callbacks */
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion

  const isTransitioningRef = useRef(isTransitioning)
  isTransitioningRef.current = isTransitioning

  const transitionLock = useRef(false)
  const edgeHoverTimer = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /* Track touch state in a ref to avoid re-creating callbacks */
  const touchStateRef = useRef<{ startX: number; startY: number } | null>(null)

  /* reduced-motion detection */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* Avoid clipped 3D previews on phone-width workflow panes. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setCompactDeck(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompactDeck(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* Transition with debounce lock */
  const performTransition = useCallback(
    (direction: 'left' | 'right') => {
      if (transitionLock.current) return
      const current = workflowIndex(activeTabRef.current)
      if (current < 0) return

      const nextIdx = direction === 'left' ? current + 1 : current - 1
      if (nextIdx < 0 || nextIdx >= WORKFLOW_TABS.length) return

      transitionLock.current = true
      setIsTransitioning(true)
      setActiveTab(WORKFLOW_TABS[nextIdx])

      const delay = reducedMotionRef.current ? 50 : TRANSITION_DURATION
      window.setTimeout(() => {
        transitionLock.current = false
        setIsTransitioning(false)
      }, delay + 50)
    },
    [setActiveTab]
  )

  const performTransitionRef = useRef(performTransition)
  performTransitionRef.current = performTransition

  /* Keyboard navigation */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const current = workflowIndex(activeTabRef.current)
      if (current < 0) return

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        performTransitionRef.current('left')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        performTransitionRef.current('right')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  /* Touch events — Pointer Events API for unified mouse+touch */
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    touchStateRef.current = { startX: e.clientX, startY: e.clientY }
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const ts = touchStateRef.current
    if (!ts) return
    const dx = e.clientX - ts.startX
    const dy = e.clientY - ts.startY
    // If vertical dominates, cancel this touch swipe
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      touchStateRef.current = null
      return
    }
    // Prevent default on horizontal swipes to stop page scroll
    if (Math.abs(dx) > 10) {
      e.preventDefault()
    }
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const ts = touchStateRef.current
    if (!ts) return
    const dx = e.clientX - ts.startX
    const dy = e.clientY - ts.startY
    const dir = shouldSwipeTransition(dx, dy)
    touchStateRef.current = null
    if (dir) performTransitionRef.current(dir)
  }, [])

  const onPointerLeave = useCallback(() => {
    touchStateRef.current = null
  }, [])

  /* Wheel / trackpad horizontal scroll */
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const current = workflowIndex(activeTabRef.current)
      if (current < 0) return
      const result = shouldWheelTransition(e.deltaX, e.deltaY, wheelAccum)
      if (result) {
        setWheelAccum(result.remaining)
        performTransitionRef.current(result.direction)
        // Decay remaining after a tick
        window.setTimeout(() => setWheelAccum(0), 150)
      } else {
        setWheelAccum(prev => prev + e.deltaX)
        window.setTimeout(() => setWheelAccum(0), 300)
      }
    },
    [wheelAccum]
  )

  /* Edge hover */
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const current = workflowIndex(activeTabRef.current)
    if (current < 0) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    const isLeftEdge = x < width * 0.05
    const isRightEdge = x > width * 0.95

    if (edgeHoverTimer.current) {
      window.clearTimeout(edgeHoverTimer.current)
      edgeHoverTimer.current = null
    }

    if (isLeftEdge && current > 0) {
      edgeHoverTimer.current = window.setTimeout(() => {
        performTransitionRef.current('right')
      }, EDGE_HOVER_DELAY)
    } else if (isRightEdge && current < WORKFLOW_TABS.length - 1) {
      edgeHoverTimer.current = window.setTimeout(() => {
        performTransitionRef.current('left')
      }, EDGE_HOVER_DELAY)
    }
  }, [])

  const onMouseLeaveContainer = useCallback(() => {
    if (edgeHoverTimer.current) {
      window.clearTimeout(edgeHoverTimer.current)
      edgeHoverTimer.current = null
    }
  }, [])

  /* Cleanup timers on unmount */
  useEffect(() => {
    return () => {
      if (edgeHoverTimer.current) {
        window.clearTimeout(edgeHoverTimer.current)
      }
    }
  }, [])

  /* 3D transforms per card */
  const cardStyles = useMemo<React.CSSProperties[]>(() => {
    return children.map((_, i) => {
      const dist = i - activeIdx
      const absDist = Math.abs(dist)

      if (reducedMotion) {
        return {
          transform: 'none',
          opacity: i === activeIdx ? 1 : 0,
          zIndex: 10 - absDist,
          transition: 'opacity 0.15s ease',
          pointerEvents: i === activeIdx ? 'auto' : 'none',
        }
      }

      let rotateY = 0
      let translateZ = 0
      let translateX = '0%'
      let opacity = 1
      let scale = 1

      if (compactDeck && dist !== 0) {
        return {
          transform: `translateX(${dist < 0 ? '-105%' : '105%'}) scale(0.98)`,
          opacity: 0,
          zIndex: 10 - absDist,
          transition: isTransitioning
            ? `transform ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : undefined,
          pointerEvents: 'none',
        }
      }

      if (dist < 0) {
        rotateY = 45
        translateZ = -200
        translateX = '-60%'
        opacity = 0.35
        scale = 0.88
      } else if (dist > 0) {
        rotateY = -45
        translateZ = -200
        translateX = '60%'
        opacity = 0.35
        scale = 0.88
      }

      return {
        transform: compactDeck
          ? 'translateX(0) scale(1)'
          : `perspective(1200px) rotateY(${rotateY}deg) translateZ(${translateZ}px) translateX(${translateX}) scale(${scale})`,
        opacity,
        zIndex: 10 - absDist,
        transition: isTransitioning
          ? `transform ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`
          : undefined,
        pointerEvents: i === activeIdx ? 'auto' : ('none' as const),
      }
    })
  }, [children.length, activeIdx, reducedMotion, compactDeck, isTransitioning])

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <section
      aria-label="Workflow tabs"
      aria-roledescription="carousel"
      className={cn(
        'relative isolate h-full w-full overflow-hidden',
        className
      )}
      onMouseLeave={onMouseLeaveContainer}
      onMouseMove={onMouseMove}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      ref={containerRef}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Perspective container */}
      <div
        className="absolute inset-0"
        style={{
          perspective: '1200px',
          transformStyle: 'preserve-3d',
        }}
      >
        {children.map((child, i) => (
          <div
            className={cn(
              'absolute inset-0 h-full w-full rounded-2xl',
              i === activeIdx && 'shadow-2xl'
            )}
            key={WORKFLOW_TABS[i]}
            style={{
              ...cardStyles[i],
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              overflow: 'auto',
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Active tab indicator dots */}
      <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground/5 px-3 py-1.5 backdrop-blur-sm sm:bottom-4">
        {WORKFLOW_TABS.map((tab, i) => (
          <button
            aria-label={WORKFLOW_LABELS[tab]}
            className={cn(
              'h-2 w-2 rounded-full transition-all duration-300',
              i === activeIdx
                ? 'w-6 bg-accent'
                : 'bg-foreground/30 hover:bg-foreground/50'
            )}
            key={tab}
            onClick={() => {
              if (transitionLock.current) return
              setActiveTab(tab)
            }}
            type="button"
          />
        ))}
      </div>

      {/* Edge hover zones (ghost previews) */}
      {!reducedMotion && !compactDeck && activeIdx > 0 && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 z-10 h-full w-[5%] opacity-0 transition-opacity duration-200 hover:opacity-100"
          style={{
            background:
              'linear-gradient(90deg, rgba(20,184,166,0.08), transparent)',
          }}
        >
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-foreground/40">
            &#8249;
          </div>
        </div>
      )}
      {!reducedMotion &&
        !compactDeck &&
        activeIdx < WORKFLOW_TABS.length - 1 && (
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 z-10 h-full w-[5%] opacity-0 transition-opacity duration-200 hover:opacity-100"
            style={{
              background:
                'linear-gradient(270deg, rgba(20,184,166,0.08), transparent)',
            }}
          >
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-foreground/40">
              &#8250;
            </div>
          </div>
        )}
    </section>
  )
}
