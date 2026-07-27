/**
 * EndProductCoverflow — the 3D coverflow landing for the wizard.
 *
 * Per the v2.2 mockup (C:\Users\LEWIS\ccc\wizard-uiux-preview.html §1),
 * the wizard lands on a 3D coverflow of 5 END PRODUCT faces (Brownies,
 * Gummies, Capsules, Tincture, Salve) — not starting materials.
 * The end product is the user's first decision; the starting material
 * decision (Flower / Concentrate / AVB / Edible / Topical) is the
 * underlying `branch` that the end product maps to. The mapping
 * between end product and branch lives in this component (see
 * `END_PRODUCT_TO_BRANCH` below) so the coverflow is self-contained.
 *
 * Visual: 5 glass-strong faces in a perspective container, 1 center
 * + 2 left peek + 2 right peek. Center face is fully visible, side
 * faces are rotated and dimmed. Click any face → that face becomes
 * the center, others shift, and `onSelect` fires with the face id.
 *
 * Accessibility: role=radiogroup, role=radio per face, arrow keys
 * move selection left/right, Enter/Space confirm the center face.
 *
 * The 3D transforms are pure CSS (transform-style: preserve-3d +
 * perspective on the container). No JS animation library.
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import {
  Beaker,
  Cookie,
  Droplets,
  Leaf,
  Pill,
  type LucideIcon,
} from 'lucide-react'
import type { WizardBranchId } from 'renderer/src/wizard/wizardTypes'

/* ------------------------------------------------------------------ */
/* End product definitions                                             */
/* ------------------------------------------------------------------ */

export type EndProductId =
  | 'brownies'
  | 'gummies'
  | 'capsules'
  | 'tincture'
  | 'salve'

interface EndProduct {
  id: EndProductId
  name: string
  description: string
  chip: string
  icon: LucideIcon
  /**
   * The default starting-material branch this end product maps to.
   * The architecture doc has 5 starting-material branches
   * (Flower / Concentrate / AVB / Edible / Topical — see
   * branchSequences.ts). Brownies / Gummies / Capsules all share
   * the `edible` branch in the v1 mapping; future iterations will
   * add a sub-decision (format) inside the edible branch to
   * differentiate brownies from gummies from capsules.
   */
  branch: WizardBranchId
}

const END_PRODUCTS: ReadonlyArray<EndProduct> = [
  {
    id: 'brownies',
    name: 'Brownies',
    description:
      'Classic chocolate brownies infused with cannabis coconut oil. The workhorse recipe — straightforward, hard to mess up.',
    chip: '~18 squares',
    icon: Cookie,
    branch: 'edible',
  },
  {
    id: 'gummies',
    name: 'Gummies',
    description:
      'Fruit-flavored gummies made with infused oil + gelatin + juice. Set in a silicone mold, 4–6 mg per piece.',
    chip: '80 / 160 ct',
    icon: Beaker,
    branch: 'edible',
  },
  {
    id: 'capsules',
    name: 'Capsules',
    description:
      'Size 00 capsules filled with infused coconut oil. Quick to make, easy to dose by the pill.',
    chip: '~24 caps',
    icon: Pill,
    branch: 'edible',
  },
  {
    id: 'tincture',
    name: 'Tincture',
    description:
      'Alcohol-based drops, sublingual. Best for AVB or quick onset. Long shelf life, dose by the dropper.',
    chip: '~100 mL',
    icon: Droplets,
    branch: 'avb',
  },
  {
    id: 'salve',
    name: 'Salve',
    description:
      'Topical for joints, muscles, skin. Carrier oil + beeswax, melts and sets. No decarb needed.',
    chip: '~240 mL',
    icon: Leaf,
    branch: 'topical',
  },
]

/** Map from end product id to the default starting-material branch. */
export const END_PRODUCT_TO_BRANCH: Record<EndProductId, WizardBranchId> =
  END_PRODUCTS.reduce(
    (acc, p) => {
      acc[p.id] = p.branch
      return acc
    },
    {} as Record<EndProductId, WizardBranchId>
  )

/* ------------------------------------------------------------------ */
/* Coverflow component                                                 */
/* ------------------------------------------------------------------ */

export interface EndProductCoverflowProps {
  /**
   * Optional: pre-select an end product (e.g. when restoring state
   * on a re-edit). When omitted, the first face (Brownies) is
   * initial center.
   */
  initialId?: EndProductId
  onSelect: (id: EndProductId, branch: WizardBranchId) => void
}

const FACE_OFFSETS: ReadonlyArray<-2 | -1 | 0 | 1 | 2> = [-2, -1, 0, 1, 2]

export function EndProductCoverflow({
  initialId,
  onSelect,
}: EndProductCoverflowProps) {
  const initialIndex = initialId
    ? END_PRODUCTS.findIndex(p => p.id === initialId)
    : 0
  const [centerIndex, setCenterIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0
  )
  const radiogroupRef = useRef<HTMLDivElement | null>(null)

  // Keep the center index in sync if `initialId` changes externally
  // (e.g. when restoring from persisted state on re-edit).
  useEffect(() => {
    if (initialId) {
      const idx = END_PRODUCTS.findIndex(p => p.id === initialId)
      if (idx >= 0 && idx !== centerIndex) setCenterIndex(idx)
    }
    // We intentionally only re-run when the id string changes; the
    // local state change is the source of truth for user navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId])

  const center = END_PRODUCTS[centerIndex]
  if (!center) return null

  const move = (delta: number) => {
    setCenterIndex(prev => {
      const next = (prev + delta + END_PRODUCTS.length) % END_PRODUCTS.length
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(center.id, center.branch)
    }
  }

  return (
    <div
      className="flex flex-col items-center gap-3"
      data-testid="end-product-coverflow"
    >
      <div
        aria-label="End product"
        className="relative w-full"
        onKeyDown={handleKeyDown}
        ref={radiogroupRef}
        role="radiogroup"
        style={{ perspective: '1400px' }}
        tabIndex={0}
      >
        <div
          aria-hidden="false"
          className="relative mx-auto"
          style={{
            width: '240px',
            height: '300px',
            transformStyle: 'preserve-3d',
          }}
        >
          {END_PRODUCTS.map((product, i) => {
            const offset = i - centerIndex
            // Wrap offsets so left/right rotation continues from
            // the ends (Brownie on the far right is also on the
            // far left of a wrapped carousel).
            const wrapped =
              offset > 2
                ? offset - END_PRODUCTS.length
                : offset < -2
                  ? offset + END_PRODUCTS.length
                  : offset
            const Icon = product.icon
            const isCenter = wrapped === 0
            return (
              <button
                aria-checked={isCenter}
                aria-label={product.name}
                className={cn(
                  'absolute inset-0 flex flex-col gap-1.5 rounded-[18px] border p-5 text-left transition-all duration-500',
                  'border-foreground/10 bg-foreground/10 backdrop-blur-xl',
                  isCenter
                    ? 'cursor-default border-accent/70 shadow-[0_14px_44px_-8px_rgba(34,211,238,0.3)]'
                    : 'cursor-pointer opacity-90 hover:opacity-100'
                )}
                data-testid={`end-product-face-${product.id}`}
                key={product.id}
                onClick={() => {
                  // Clicking any face selects that end product. The
                  // coverflow re-renders with the clicked face as
                  // the new center. Previously the coverflow required
                  // a second click to confirm the side face — that
                  // double-click affordance is replaced by a dedicated
                  // "Make {name}" CTA below the carousel.
                  onSelect(product.id, product.branch)
                  if (!isCenter) setCenterIndex(i)
                }}
                role="radio"
                style={faceTransform(wrapped, isCenter)}
                type="button"
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-[10px]',
                    isCenter ? 'bg-accent/25' : 'bg-accent/10'
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-5',
                      isCenter ? 'text-accent' : 'text-accent/80'
                    )}
                  />
                </span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {product.name}
                </h3>
                <p className="text-xs leading-snug text-foreground/70">
                  {product.description}
                </p>
                <span className="mt-auto inline-block w-fit rounded-md bg-foreground/10 px-2 py-0.5 font-mono text-[10px] text-foreground/80">
                  {product.chip}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <span
        aria-hidden="true"
        className="font-mono text-[11px] text-foreground/50"
        data-testid="end-product-coverflow-hint"
      >
        ← tap a face · or use ← / →
      </span>

      {/* Confirm CTA — only meaningful when a face is the center.
          The face itself is also clickable to confirm. */}
      <button
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent/30 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        data-testid="end-product-coverflow-confirm"
        onClick={() => onSelect(center.id, center.branch)}
        type="button"
      >
        Make {center.name.toLowerCase()}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3D transform helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Per-face 3D transform. Offsets mirror the v2.2 mockup (5 face
 * positions in a 1400px-perspective coverflow). The center face is
 * pulled forward and un-rotated; side faces rotate around Y and pull
 * back; the off-screen l-2/r-2 are dimmed and further back.
 */
function faceTransform(
  wrapped: number,
  isCenter: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    transformOrigin: 'center center',
    willChange: 'transform, opacity',
  }
  if (isCenter) {
    return {
      ...base,
      transform: 'translateX(0) translateZ(50px) rotateY(0)',
      opacity: 1,
      zIndex: 5,
    }
  }
  switch (wrapped) {
    case -2:
      return {
        ...base,
        transform: 'translateX(-300px) translateZ(-180px) rotateY(35deg)',
        opacity: 0.35,
        zIndex: 1,
      }
    case -1:
      return {
        ...base,
        transform: 'translateX(-170px) translateZ(-70px) rotateY(20deg)',
        opacity: 0.65,
        zIndex: 2,
      }
    case 1:
      return {
        ...base,
        transform: 'translateX(170px) translateZ(-70px) rotateY(-20deg)',
        opacity: 0.65,
        zIndex: 2,
      }
    case 2:
      return {
        ...base,
        transform: 'translateX(300px) translateZ(-180px) rotateY(-35deg)',
        opacity: 0.35,
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

// re-export FACE_OFFSETS for test introspection
export { FACE_OFFSETS }
