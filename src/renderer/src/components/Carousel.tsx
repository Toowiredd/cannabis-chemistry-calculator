/**
 * Carousel — a generic 3D perspective carousel.
 *
 * Slide 6 of v2.2 (2026-07-27): extracted from
 * `EndProductCoverflow` so the 3D coverflow pattern is reusable
 * for slides 2+ in the wizard. The user wants the same carousel
 * treatment on every step, not just slide 1.
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
  /** Face width in pixels. Default 240. */
  faceWidth?: number
  /** Face height in pixels. Default 300. */
  faceHeight?: number
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
  faceWidth = 240,
  faceHeight = 300,
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
            width: `${faceWidth}px`,
            height: `${faceHeight}px`,
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
 * ±300px; that's the original CSS in the EndProductCoverflow
 * component, but the user is looking at the live deployment
 * and it reads as cramped. Increase to ±210px / ±360px (and
 * pull the side faces a bit further back) so the carousel
 * reads as a deck of cards with deliberate breathing room
 * between them.
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
        transform: 'translateX(-360px) translateZ(-220px) rotateY(35deg)',
        opacity: 0.32,
        zIndex: 1,
      }
    case -1:
      return {
        ...base,
        transform: 'translateX(-210px) translateZ(-90px) rotateY(22deg)',
        opacity: 0.62,
        zIndex: 2,
      }
    case 1:
      return {
        ...base,
        transform: 'translateX(210px) translateZ(-90px) rotateY(-22deg)',
        opacity: 0.62,
        zIndex: 2,
      }
    case 2:
      return {
        ...base,
        transform: 'translateX(360px) translateZ(-220px) rotateY(-35deg)',
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
