/**
 * Carousel — a generic 3D perspective carousel.
 *
 * Slide 6 of v2.2 (2026-07-27): extracted from
 * `EndProductCoverflow` so the 3D coverflow pattern is reusable
 * for slides 2+ in the wizard. The user wants the same carousel
 * treatment on every step, not just slide 1.
 *
 * Slide 7 of v2.2 (2026-07-27): face dimensions and side-face
 * offsets are now CSS custom properties (`--carousel-face-width`,
 * `--carousel-face-height`, `--carousel-offset-l1`, etc.) using
 * `clamp()` for fluid responsive sizing. The carousel scales with
 * the viewport: small screens get smaller faces + tighter
 * spacing; large screens get bigger faces + more breathing room.
 * The face's content layout (icon + title + subtitle, etc.) is
 * the caller's responsibility — this component only owns the
 * 3D geometry.
 *
 * Visual: items in a perspective container, 1 center + 2 left +
 * 2 right peek. The center item is fully visible; side items
 * are rotated around the Y axis, dimmed, and pulled back. Click
 * any item → that item becomes the center AND onSelect fires
 * (the side faces act as both a "bring to center" affordance
 * AND a "select this" affordance — the coverflow is one tap
 * to commit, not two).
 *
 * Keyboard: ArrowLeft/Up → -1, ArrowRight/Down → +1, Enter/Space
 * fires onSelect with the center item.
 *
 * The 3D transforms are pure CSS (transform-style: preserve-3d
 * + perspective on the container). No JS animation library.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from 'renderer/lib/utils'

export interface CarouselProps<T> {
  items: readonly T[]
  initialIndex?: number
  onSelect: (item: T, index: number) => void
  /**
   * Render the face content. `isCenter` lets the caller switch
   * between the "centered" and "side" visual treatment. The face
   * itself (the button + 3D transform) is owned by this component;
   * the caller only provides the inner markup.
   */
  renderItem: (item: T, isCenter: boolean) => ReactNode
  /**
   * Per-face data-testid. The face button's testid is set to
   * this value — callers wire it to the canonical testid
   * (e.g. `option-tile-${option.id}`).
   */
  getItemTestId: (item: T, index: number) => string
  /**
   * Optional: a label for the radiogroup + each face's
   * aria-label. Falls back to the index when the caller does
   * not provide a label.
   */
  getItemAriaLabel?: (item: T, index: number) => string
  /** Perspective in pixels. Default 1400 (matches the v2.2 mockup). */
  perspective?: number
  /**
   * Face width — used as the base for responsive `clamp()`.
   * The default 240px is the coverflow size. The OptionCarousel
   * passes 220 for its smaller faces. The actual rendered width
   * scales with the viewport via `clamp(0.6 * base, 22vw, 1.2 * base)`.
   */
  baseFaceWidth?: number
  /**
   * Face height — used as the base for responsive `clamp()`.
   * Default 300 (coverflow). OptionCarousel uses 180.
   */
  baseFaceHeight?: number
  /** aria-label for the radiogroup. */
  ariaLabel?: string
  /**
   * Wrap offsets so left/right rotation continues from the
   * ends (Salve on the far right is also on the far left of a
   * wrapped carousel). When false, the carousel clamps at
   * either end and the side faces "run out" past the visible
   * window — useful for short lists (3-4 items) where wrapping
   * would feel disorienting.
   */
  wrap?: boolean
  /**
   * Extra className for the OUTER face button. Lets the caller
   * tune the face's padding / gap / radius without forking
   * the Carousel.
   */
  faceClassName?: string
  /**
   * Extra className for the side faces (offset != 0). Lets the
   * caller dim the side faces further when the content is
   * smaller (the coverflow already has its own opacity values
   * baked into the transform; this is for callers that want
   * extra tuning).
   */
  sideFaceClassName?: string
  /** Optional: render a confirm CTA below the carousel. */
  renderConfirm?: (centerItem: T, centerIndex: number) => ReactNode
  /** Optional: render a hint below the carousel (above the confirm). */
  renderHint?: () => ReactNode
}

const FACE_OFFSETS: ReadonlyArray<-2 | -1 | 0 | 1 | 2> = [-2, -1, 0, 1, 2]

export function Carousel<T>({
  items,
  initialIndex = 0,
  onSelect,
  renderItem,
  getItemTestId,
  getItemAriaLabel,
  perspective = 1400,
  baseFaceWidth = 240,
  baseFaceHeight = 300,
  ariaLabel = 'Carousel',
  wrap = true,
  faceClassName,
  sideFaceClassName,
  renderConfirm,
  renderHint,
}: CarouselProps<T>) {
  const [centerIndex, setCenterIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, items.length - 1))
  )
  const radiogroupRef = useRef<HTMLDivElement | null>(null)

  // Keep the center index in sync if `initialIndex` changes
  // externally (e.g. when restoring from persisted state on
  // a re-edit).
  useEffect(() => {
    if (
      initialIndex >= 0 &&
      initialIndex < items.length &&
      initialIndex !== centerIndex
    ) {
      setCenterIndex(initialIndex)
    }
    // We intentionally only re-run when the initial index
    // changes; the local state is the source of truth for user
    // navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex])

  if (items.length === 0) return null
  const center = items[centerIndex]
  if (center === undefined) return null

  const move = (delta: number) => {
    setCenterIndex(prev => {
      if (wrap) {
        return (prev + delta + items.length) % items.length
      }
      return Math.max(0, Math.min(items.length - 1, prev + delta))
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(center, centerIndex)
    }
  }

  // Slide 7 (2026-07-27, take 3): take 1 used a fluid factor
  // proportional to the base — the tile came out tiny.
  // Take 2 used a fixed 32vw fluid + a huge max — the tile
  // came out huge but the content floated in empty space
  // and the side faces ran off the panel.
  //
  // This take: the face width is fluid (clamp 280-520px on
  // desktop, scaling with the viewport), and the face HEIGHT
  // is derived from the width with a fixed aspect ratio so
  // the content fills the face instead of floating in the
  // top-left. The offset multipliers are reduced (0.62×
  // and 1.05× of face-width) so the l-2/r-2 faces stay
  // mostly within the wizard panel instead of running off
  // the edge of the screen.
  const faceWidthMin = Math.max(240, Math.round(baseFaceWidth * 0.7))
  const faceWidthMax = Math.max(faceWidthMin + 80, Math.round(baseFaceWidth * 1.45))
  const faceWidthCss = `clamp(${faceWidthMin}px, 30vw, ${faceWidthMax}px)`
  // Aspect ratio: the coverflow is 4:5 (taller than wide
  // for the description text); the option carousel is 9:11
  // (slightly taller than wide for the icon + title +
  // subtitle). The ratio is derived from the caller's
  // baseFaceWidth / baseFaceHeight so the caller controls
  // the shape; we just preserve it across the fluid scale.
  const aspectRatio = baseFaceHeight / baseFaceWidth
  const faceHeightCss = `calc(${faceWidthCss} * ${aspectRatio.toFixed(3)})`
  // Offsets proportional to the (clamped) face width.
  // Reduced from the take-2 values (0.78× / 1.32×) so the
  // side faces stay within the panel — the user is on a
  // 1440px screen and the panel is 1400px wide, so anything
  // past ~1.2× face-width runs off the edge.
  const offsetL1Css = `calc(${faceWidthCss} * 0.62)`
  const offsetL2Css = `calc(${faceWidthCss} * 1.05)`

  const containerVars = {
    '--carousel-face-width': faceWidthCss,
    '--carousel-face-height': faceHeightCss,
    '--carousel-offset-l1': offsetL1Css,
    '--carousel-offset-l2': offsetL2Css,
  } as CSSProperties

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        aria-label={ariaLabel}
        className="relative w-full"
        onKeyDown={handleKeyDown}
        ref={radiogroupRef}
        role="radiogroup"
        style={{ perspective: `${perspective}px` }}
        tabIndex={0}
      >
        <div
          aria-hidden="false"
          className="relative mx-auto"
          style={{
            ...containerVars,
            width: 'var(--carousel-face-width)',
            height: 'var(--carousel-face-height)',
            transformStyle: 'preserve-3d',
          }}
        >
          {items.map((item, i) => {
            const offset = i - centerIndex
            // Wrap offsets so left/right rotation continues
            // from the ends (Brownie on the far right is also
            // on the far left of a wrapped carousel). For
            // non-wrapped carousels, anything past ±2 falls
            // off-screen and is hidden.
            const wrapped = wrap
              ? offset > 2
                ? offset - items.length
                : offset < -2
                  ? offset + items.length
                  : offset
              : offset
            const isCenter = wrapped === 0
            const isSide = !isCenter && Math.abs(wrapped) <= 2
            return (
              <button
                aria-checked={isCenter}
                aria-label={getItemAriaLabel?.(item, i) ?? `Item ${i + 1}`}
                className={cn(
                  'absolute inset-0 flex flex-col gap-1.5 rounded-[18px] border p-5 text-left transition-all duration-500',
                  'border-foreground/10 bg-foreground/5 backdrop-blur',
                  isCenter
                    ? 'cursor-default border-accent/70 shadow-[0_14px_44px_-8px_rgba(34,211,238,0.3)]'
                    : 'cursor-pointer opacity-90 hover:opacity-100',
                  isSide && sideFaceClassName,
                  faceClassName
                )}
                data-testid={getItemTestId(item, i)}
                key={i}
                onClick={() => {
                  // Clicking any face selects it. The coverflow
                  // re-renders with the clicked face as the new
                  // center. The side-face click is a one-tap
                  // commit, not a "bring to center, then click
                  // again" pattern.
                  onSelect(item, i)
                  if (!isCenter) setCenterIndex(i)
                }}
                role="radio"
                style={faceTransform(wrapped, isCenter)}
                type="button"
              >
                {renderItem(item, isCenter)}
              </button>
            )
          })}
        </div>
      </div>

      {renderHint?.()}

      {renderConfirm?.(center, centerIndex)}
    </div>
  )
}

/**
 * Slide 6 spacing — the user said the coverflow faces were
 * "too tightly bunched up". The v2.2 mockup used ±170px /
 * ±300px; the original EndProductCoverflow component used
 * the same values, but the user is looking at the live
 * deployment and it reads as cramped.
 *
 * Slide 7 (2026-07-27): the offsets are now derived from
 * `--carousel-face-width` via `calc()`, so the spacing
 * scales with the face size. A smaller face on a phone
 * gets tighter spacing; a larger face on a desktop gets
 * more breathing room. The translateZ values stay fixed
 * because they're perspective-relative (the perspective
 * container's `perspective: 1400px` makes them feel right
 * at any face size).
 */
function faceTransform(wrapped: number, isCenter: boolean): CSSProperties {
  const base: CSSProperties = {
    transformOrigin: 'center center',
    willChange: 'transform, opacity',
  }
  if (isCenter) {
    return {
      ...base,
      transform: 'translateX(0) translateZ(60px) rotateY(0)',
      opacity: 1,
      zIndex: 5,
    }
  }
  switch (wrapped) {
    case -2:
      return {
        ...base,
        transform:
          'translateX(calc(-1 * var(--carousel-offset-l2))) translateZ(-220px) rotateY(35deg)',
        opacity: 0.32,
        zIndex: 1,
      }
    case -1:
      return {
        ...base,
        transform:
          'translateX(calc(-1 * var(--carousel-offset-l1))) translateZ(-90px) rotateY(22deg)',
        opacity: 0.62,
        zIndex: 2,
      }
    case 1:
      return {
        ...base,
        transform:
          'translateX(var(--carousel-offset-l1)) translateZ(-90px) rotateY(-22deg)',
        opacity: 0.62,
        zIndex: 2,
      }
    case 2:
      return {
        ...base,
        transform:
          'translateX(var(--carousel-offset-l2)) translateZ(-220px) rotateY(-35deg)',
        opacity: 0.32,
        zIndex: 1,
      }
    default:
      return {
        ...base,
        transform: 'translateX(0) translateZ(-300px)',
        opacity: 0,
        zIndex: 0,
      }
  }
}

// Re-export for test introspection (the existing
// EndProductCoverflow test imports FACE_OFFSETS).
export { FACE_OFFSETS }
