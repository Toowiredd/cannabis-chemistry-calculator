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

  // Slide 7 (2026-07-27, take 5): the previous take (4)
  // used 0.78× / 1.32× face-width for the l-1 / l-2 side
  // offsets, which caused the side faces' bounding boxes
  // to overlap the center face and each other on most
  // viewports. The 3D rotateY shrinks the visible width
  // of a side face to ~0.85× of the layout width, but the
  // bounding box is still the full width — so faces with
  // offsets < 1.0× overlap their neighbours.
  //
  // Take 6 (2026-07-28): the l-1 / l-2 offsets are pushed
  // further out to eliminate l-1/l-2 overlap on the
  // coverflow (5-item) and the Method step (6-item wrap).
  // The math: the l-2 face's translateZ(-220) makes it
  // appear at 0.864× scale; the l-1 face's translateZ(-90)
  // makes it appear at 0.94× scale. The rotated bounding
  // box of l-2 is ~0.65×W wide, of l-1 is ~0.85×W wide.
  // For no l-1/l-2 overlap:
  //   apparent_l1_left >= apparent_l2_right
  //   -offsetL1 * 0.94 - 0.85 * W/2 * 0.94 >=
  //     -offsetL2 * 0.864 + 0.65 * W/2 * 0.864
  //   → offsetL2 - offsetL1 > 0.75 * W
  //
  // With offsetL1 = 1.3×W and offsetL2 = 2.5×W, the
  // difference is 1.2×W > 0.75×W — no overlap. The l-2
  // face's center is at -2.5*W*0.864 = -2.16*W from the
  // container center, which means it extends ~0.4*W off
  // the visible panel on a 1280px viewport. The user sees
  // a small "peek" of the l-2 face at the panel edge —
  // not a full face, but enough to know the option exists.
  const faceWidthMin = Math.max(220, Math.round(baseFaceWidth * 0.7))
  const faceWidthMax = Math.max(
    faceWidthMin + 60,
    Math.round(baseFaceWidth * 1.3)
  )
  const faceWidthCss = `clamp(${faceWidthMin}px, 26vw, ${faceWidthMax}px)`
  const aspectRatio = baseFaceHeight / baseFaceWidth
  const faceHeightCss = `min(calc(${faceWidthCss} * ${aspectRatio.toFixed(3)}), min(60vh, 380px))`
  // Take 6 (2026-07-28): the l-1 / l-2 offsets are
  // pushed to 1.3×W / 2.5×W (up from 1.05×W / 1.75×W).
  // The l-2 face is now mostly clipped on small viewports,
  // but the l-1/l-2 no longer overlap. The user gets a
  // tight coverflow with clear gaps between faces.
  const offsetL1Css = `calc(${faceWidthCss} * 1.3)`
  const offsetL2Css = `calc(${faceWidthCss} * 2.5)`

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
        // Take 6 (2026-07-28): bumped from 0.32 to 0.45
        // so the l-2 face's content is readable when it
        // peeks at the panel edge. The user called the
        // side faces "very dim" — the previous 0.32 made
        // the l-2 text almost invisible against the dark
        // background. 0.45 is still clearly "in the
        // distance" compared to the l-1 (0.7) and center
        // (1.0) but is legible.
        opacity: 0.45,
        zIndex: 1,
      }
    case -1:
      return {
        ...base,
        transform:
          'translateX(calc(-1 * var(--carousel-offset-l1))) translateZ(-90px) rotateY(22deg)',
        // Take 6 (2026-07-28): bumped from 0.62 to 0.7
        // so the l-1 face is closer to the center face's
        // brightness. The "in the distance" hint still
        // reads, but the side face content is no longer
        // muted.
        opacity: 0.7,
        zIndex: 2,
      }
    case 1:
      return {
        ...base,
        transform:
          'translateX(var(--carousel-offset-l1)) translateZ(-90px) rotateY(-22deg)',
        opacity: 0.7,
        zIndex: 2,
      }
    case 2:
      return {
        ...base,
        transform:
          'translateX(var(--carousel-offset-l2)) translateZ(-220px) rotateY(-35deg)',
        opacity: 0.45,
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
