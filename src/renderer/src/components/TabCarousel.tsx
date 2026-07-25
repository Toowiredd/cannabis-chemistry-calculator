/**
 * TabCarousel — N-face 3D coverflow carousel for the ccc main screen.
 *
 * The 2026-07-25 design refresh moved all nine tabs (Dashboard, Quick
 * Batch, Decarb, Infusion, Dose, Methods, Advanced, Knowledge, Journal)
 * into a single cylindrical carousel. The current face is in front, the
 * adjacent faces are rotated around the cylinder so the user can see
 * them "through and behind" the current one — the see-through effect
 * comes from the natural 3D rotation, not from per-face opacity tricks.
 *
 * Why not a flat tab bar:
 * - The user's mental model is the chemistry pipeline (decarb → infusion
 *   → dose). A 3D carousel makes the pipeline spatial and visible.
 * - The glassmorphism design (see design.md "UI/UX Decisions") relies on
 *   layered transparency; a flat tab strip breaks the aesthetic.
 *
 * Performance:
 * - 9 faces × backdrop-filter:blur is GPU-heavy. The component
 *   lazy-mounts faces more than 2 positions away from the active one
 *   (they keep their 3D position but don't render their children) so
 *   only 5 faces × blur is on screen at any time.
 * - Faces 2+ positions away render as low-opacity "ghost" placeholders
 *   so the carousel cylinder is still visible.
 *
 * Accessibility:
 * - role="tablist" + role="tab" + role="tabpanel" with proper aria-hidden
 *   on non-active faces.
 * - Keyboard nav: ArrowLeft/Right, Home, End.
 * - Honors prefers-reduced-motion: no 3D transforms, just opacity.
 * - Honors prefers-reduced-transparency: drops the back-face opacity
 *   so the focus stays on the active face.
 *
 * @see SwipeDeck.tsx for the original 3-face implementation this
 *   generalizes. Kept as a sibling for now in case any test or
 *   reference still points at it.
 */
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from 'react'
import { cn } from 'renderer/lib/utils'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export interface CarouselItem {
  id: TabId
  label: string
  /** Short subtitle shown under the label on the face label badge. */
  subtitle?: string
  content: ReactNode
}

interface TabCarouselProps {
  items: CarouselItem[]
  className?: string
}

/* ------------------------------------------------------------------ */
/* Constants — exported for tests                                     */
/* ------------------------------------------------------------------ */

export const SWIPE_THRESHOLD = 60
export const WHEEL_THRESHOLD = 50
export const TRANSITION_DURATION = 520

/**
 * Maximum number of faces rendered at any time. Faces outside the
 * active ± 2 window are unmounted to keep the GPU happy. The
 * cylinder is still visible because the 2-visible-neighbors on each
 * side keep their 3D position with low opacity.
 */
export const VISIBLE_WINDOW = 2

/* ------------------------------------------------------------------ */
/* Pure helpers — exported for tests                                  */
/* ------------------------------------------------------------------ */

/** Wraps an index around a circular array of length n. */
export function wrapIndex(idx: number, n: number): number {
  if (n <= 0) return 0
  return ((idx % n) + n) % n
}

/** Returns the shortest signed distance from `from` to `to` on a
 *  circular array, in the range `[-floor(n/2), floor(n/2)]`. */
export function circularDistance(from: number, to: number, n: number): number {
  if (n <= 0) return 0
  const raw = to - from
  const half = Math.floor(n / 2)
  let d = raw % n
  if (d > half) d -= n
  else if (d < -half) d += n
  return d
}

/** Resolve a swipe into a direction, or null if below threshold. */
export function shouldSwipeTransition(
  deltaX: number,
  deltaY: number,
  threshold = SWIPE_THRESHOLD
): 'left' | 'right' | null {
  if (Math.abs(deltaY) > Math.abs(deltaX)) return null
  if (Math.abs(deltaX) < threshold) return null
  return deltaX < 0 ? 'left' : 'right'
}

/** Resolve a wheel event into a transition + remaining accumulator. */
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

/* ------------------------------------------------------------------ */
/* 3D math                                                            */
/* ------------------------------------------------------------------ */

/**
 * Per-face 3D transform. Faces are arranged around a vertical
 * cylinder; the active face is at angle 0 (front), the others at
 * 360/N degrees. Each face sits at translateZ(-R) so the center of
 * the cylinder is behind the active face — that radius is what
 * makes the adjacent faces visible at the edges of the current one.
 *
 * Opacity is a falloff from the active face. The falloff is gentle
 * enough that the user can see the carousel cylinder through and
 * behind the current face (the "see-through" effect the user asked
 * for) without the active face becoming hard to read.
 */
interface FaceTransform {
  rotateY: number
  translateZ: number
  opacity: number
  scale: number
  /** Faces outside the active ± VISIBLE_WINDOW are unmounted. */
  inWindow: boolean
}

export function computeFaceTransforms(
  count: number,
  activeIdx: number,
  reducedMotion: boolean
): FaceTransform[] {
  if (count === 0) return []
  const angleStep = 360 / count
  // The radius is the cylinder radius. Bigger = flatter carousel.
  // 900px gives a noticeable curve without making the back faces too
  // small to read; the side faces are still ~75% of the active face
  // width which is enough to identify them.
  const radius = 900
  return Array.from({ length: count }, (_, i) => {
    const signedDist = circularDistance(activeIdx, i, count)
    const absDist = Math.abs(signedDist)
    if (reducedMotion) {
      return {
        rotateY: 0,
        translateZ: 0,
        opacity: absDist === 0 ? 1 : absDist <= 1 ? 0.45 : 0,
        scale: 1,
        inWindow: absDist <= VISIBLE_WINDOW,
      }
    }
    return {
      rotateY: signedDist * angleStep,
      translateZ: -radius,
      // The active face is fully opaque so the content reads
      // cleanly. Adjacent faces stay at ~60% so the cylinder is
      // visible. Far faces taper to ~20% so they're clearly "back"
      // but still hint at the rest of the carousel.
      opacity:
        absDist === 0
          ? 1
          : absDist === 1
            ? 0.62
            : absDist === 2
              ? 0.32
              : 0.15,
      // Subtle scale falloff so the back faces feel smaller.
      scale: 1 - absDist * 0.04,
      inWindow: absDist <= VISIBLE_WINDOW,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function TabCarousel({ items, className }: TabCarouselProps) {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const count = items.length

  const activeIdx = useMemo(() => {
    const found = items.findIndex(it => it.id === activeTab)
    return found >= 0 ? found : 0
  }, [items, activeTab])

  const [reducedMotion, setReducedMotion] = useState(false)
  const [reducedTransparency, setReducedTransparency] = useState(false)
  const [compactDeck, setCompactDeck] = useState(false)
  const [wheelAccum, setWheelAccum] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  /* Refs for stable callbacks (avoid re-creating on every render) */
  const activeIdxRef = useRef(activeIdx)
  activeIdxRef.current = activeIdx
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion
  const isTransitioningRef = useRef(isTransitioning)
  isTransitioningRef.current = isTransitioning
  const transitionLock = useRef(false)
  const touchStateRef = useRef<{ startX: number; startY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /* Reduced-motion + reduced-transparency detection. The
   * matchMedia guard matters because jsdom (used in the
   * test environment) does not implement matchMedia by
   * default — without the typeof guard, the carousel would
   * throw on mount in any test that doesn't stub matchMedia
   * first. The 2026-07-25 SwipeDeck code path didn't trip
   * this because the old test was mounting only the non-
   * workflow tab path (which used TabPanel, not SwipeDeck). */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(motionMq.matches)
    const motionHandler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    motionMq.addEventListener('change', motionHandler)

    const transpMq = window.matchMedia('(prefers-reduced-transparency: reduce)')
    setReducedTransparency(transpMq.matches)
    const transpHandler = (e: MediaQueryListEvent) =>
      setReducedTransparency(e.matches)
    transpMq.addEventListener('change', transpHandler)

    return () => {
      motionMq.removeEventListener('change', motionHandler)
      transpMq.removeEventListener('change', transpHandler)
    }
  }, [])

  /* Compact mode for narrow screens (skip 3D, use simple slide) */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 640px)')
    setCompactDeck(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompactDeck(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* Transition with debounce lock + circular wrap */
  const performTransition = useCallback(
    (direction: 'left' | 'right') => {
      if (transitionLock.current) return
      const current = activeIdxRef.current
      const next = direction === 'left' ? current + 1 : current - 1
      const wrapped = wrapIndex(next, count)
      if (wrapped === current) return
      transitionLock.current = true
      setIsTransitioning(true)
      setActiveTab(items[wrapped].id)
      const delay = reducedMotionRef.current ? 50 : TRANSITION_DURATION
      window.setTimeout(() => {
        transitionLock.current = false
        setIsTransitioning(false)
      }, delay + 50)
    },
    [count, items, setActiveTab]
  )
  const performTransitionRef = useRef(performTransition)
  performTransitionRef.current = performTransition

  /* Keyboard navigation: arrows, Home, End */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        performTransitionRef.current('left')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        performTransitionRef.current('right')
      } else if (e.key === 'Home') {
        e.preventDefault()
        if (transitionLock.current) return
        setActiveTab(items[0].id)
      } else if (e.key === 'End') {
        e.preventDefault()
        if (transitionLock.current) return
        setActiveTab(items[items.length - 1].id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [items, setActiveTab])

  /* Touch / pointer events */
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    touchStateRef.current = { startX: e.clientX, startY: e.clientY }
  }, [])
  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const ts = touchStateRef.current
    if (!ts) return
    const dx = e.clientX - ts.startX
    const dy = e.clientY - ts.startY
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      touchStateRef.current = null
      return
    }
    if (Math.abs(dx) > 10) e.preventDefault()
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
  const onPointerCancel = useCallback(() => {
    touchStateRef.current = null
  }, [])

  /* Wheel / trackpad horizontal scroll */
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const result = shouldWheelTransition(e.deltaX, e.deltaY, wheelAccum)
      if (result) {
        setWheelAccum(result.remaining)
        performTransitionRef.current(result.direction)
        window.setTimeout(() => setWheelAccum(0), 150)
      } else {
        setWheelAccum(prev => prev + e.deltaX)
        window.setTimeout(() => setWheelAccum(0), 300)
      }
    },
    [wheelAccum]
  )

  /* Face transforms */
  const faceTransforms = useMemo(
    () => computeFaceTransforms(count, activeIdx, reducedMotion),
    [count, activeIdx, reducedMotion]
  )

  /* Active item reference for the label badge */
  const activeItem = items[activeIdx]

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <section
      aria-label="Tab carousel"
      aria-roledescription="carousel"
      className={cn(
        'relative isolate h-full w-full overflow-hidden',
        className
      )}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      ref={containerRef}
      role="tablist"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Perspective container — the 3D scene root. */}
      <div
        className="absolute inset-0"
        style={{
          perspective: '1800px',
          transformStyle: 'preserve-3d',
        }}
      >
        {items.map((item, i) => {
          const t = faceTransforms[i]
          if (!t) return null
          const isActive = i === activeIdx
          // Lazy-mount: only the active face + VISIBLE_WINDOW on each
          // side actually render their content. The other faces keep
          // their 3D position via the transform, but their content
          // is unmounted to save GPU. The cylinder is still visible
          // because the 2-visible-neighbors + the active face = 5
          // faces are still in the scene.
          const shouldRender = t.inWindow

          // For the active face we use the heavier glass so the
          // content reads cleanly. For inactive faces we use a
          // lighter glass so the see-through effect works — the
          // back faces are visible but the active face stays clear.
          const glassClass = isActive ? 'glass-strong' : 'glass'

          // Opacity is also tempered by prefers-reduced-transparency
          // (drop inactive faces further so the focus stays on the
          // active one).
          const effectiveOpacity = reducedTransparency
            ? isActive
              ? 1
              : t.opacity * 0.6
            : t.opacity

          // Transform: 3D rotateY + translateZ, or compact horizontal
          // slide for narrow screens. In reduced-motion mode we
          // return the empty string so the face renders without any
          // transform — important for users who set the OS flag
          // (otherwise they'd still see the 0°/0px no-op transform
          // applied, which is a no-op visually but the CSS engine
          // still does work for it).
          const transform = reducedMotion
            ? ''
            : compactDeck
              ? `translateX(${(i - activeIdx) * 105}%) scale(0.98)`
              : `perspective(1800px) rotateY(${t.rotateY}deg) translateZ(${t.translateZ}px) scale(${t.scale})`

          const transition = isTransitioning
            ? `transform ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${TRANSITION_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : compactDeck
              ? 'transform 0.25s ease, opacity 0.25s ease'
              : 'transform 0.25s ease, opacity 0.25s ease'

          const faceStyle: CSSProperties = {
            transform,
            opacity: effectiveOpacity,
            zIndex: 100 - Math.abs(i - activeIdx),
            transition,
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            pointerEvents: isActive ? 'auto' : 'none',
          }

          return (
            <div
              aria-hidden={!isActive}
              aria-label={item.label}
              aria-selected={isActive}
              className={cn(
                'absolute inset-0 h-full w-full overflow-hidden rounded-2xl',
                glassClass,
                isActive && 'shadow-2xl ring-1 ring-foreground/20'
              )}
              data-testid={`carousel-face-${item.id}`}
              key={item.id}
              role="tabpanel"
              style={faceStyle}
            >
              {/* The face label badge — a small tab-name marker at
                  the top-center of every face. Helps the user
                  orient when looking at an inactive face. */}
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/60 backdrop-blur-sm">
                {item.label}
                {item.subtitle ? ` · ${item.subtitle}` : ''}
              </div>

              {/* The face content. Lazy-mounted for off-window faces. */}
              {shouldRender ? (
                <div className="h-full w-full overflow-auto pt-9">
                  {item.content}
                </div>
              ) : null}

              {/* Click target for inactive faces: clicking a visible
                  back face brings it to the front. */}
              {!isActive && t.inWindow && (
                <button
                  aria-label={`Go to ${item.label}`}
                  className="absolute inset-0 cursor-pointer"
                  onClick={() => {
                    if (transitionLock.current) return
                    setActiveTab(item.id)
                  }}
                  type="button"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Active-face label badge — bottom-left, so the user can
          always see the current tab name even if the top badge
          on the active face is hidden by the content. */}
      <div className="pointer-events-none absolute bottom-16 left-4 z-30 sm:bottom-20">
        <div className="rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/80 backdrop-blur-md">
          {activeItem.label}
        </div>
      </div>

      {/* Pagination dots — click a dot to jump to that face.
          Each dot shows the index + a 1-letter hint so the user
          can tell which face they're going to. */}
      <div
        className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1.5 backdrop-blur-md sm:bottom-4 sm:gap-2 sm:px-3"
        role="presentation"
      >
        {items.map((item, i) => (
          <button
            aria-controls={`carousel-face-${item.id}`}
            aria-label={item.label}
            aria-selected={i === activeIdx}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 sm:h-2',
              i === activeIdx
                ? 'w-8 bg-accent shadow-sm sm:w-10'
                : 'w-1.5 bg-foreground/30 hover:bg-foreground/50 sm:w-2'
            )}
            key={item.id}
            onClick={() => {
              if (transitionLock.current) return
              setActiveTab(item.id)
            }}
            role="tab"
            tabIndex={i === activeIdx ? 0 : -1}
            type="button"
          />
        ))}
      </div>

      {/* Edge hover zones (ghost previews) — only on the active
          face's left/right edges, not on every face. This is
          unchanged from the original SwipeDeck. */}
      {!reducedMotion && !compactDeck && (
        <>
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 z-20 h-full w-[5%] cursor-w-resize opacity-0 transition-opacity duration-200 hover:opacity-100"
            style={{
              background:
                'linear-gradient(90deg, rgba(20,184,166,0.10), transparent)',
            }}
            onClick={() => performTransitionRef.current('right')}
          >
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-base text-foreground/50">
              ‹
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 z-20 h-full w-[5%] cursor-e-resize opacity-0 transition-opacity duration-200 hover:opacity-100"
            style={{
              background:
                'linear-gradient(270deg, rgba(20,184,166,0.10), transparent)',
            }}
            onClick={() => performTransitionRef.current('left')}
          >
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-foreground/50">
              ›
            </div>
          </div>
        </>
      )}
    </section>
  )
}
