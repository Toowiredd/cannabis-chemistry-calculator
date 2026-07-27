/**
 * EndProductCoverflow — the 3D coverflow landing for the wizard.
 *
 * Per the v2.2 mockup (C:\Users\LEWIS\ccc\wizard-uiux-preview.html §1),
 * the wizard lands on a 3D coverflow of 5 END PRODUCT faces
 * (Baked, Gummies, Capsules, Tincture, Salve) — not starting
 * materials and not individual recipes. The faces are CATEGORIES:
 * "Baked" means brownies / cookies / cakes / pancakes / muffins —
 * anything you bake in the oven with infused butter or oil. The
 * end product is the user's first decision; the starting material
 * decision (Flower / Concentrate / AVB / Edible / Topical) is the
 * underlying `branch` that the end product maps to. The mapping
 * between end product and branch lives in this component (see
 * `END_PRODUCT_TO_BRANCH` below) so the coverflow is self-contained.
 *
 * Slide 6 of v2.2 (2026-07-27): refactored to use the generic
 * `Carousel` component (3D perspective + rotateY + face
 * transforms are owned by Carousel; this file just supplies the
 * face data + the per-face render). The Carousel is shared
 * with `OptionCarousel` (slides 2+), so every wizard step now
 * has the same carousel treatment.
 */
import { Beaker, Croissant, Droplets, Leaf, Pill, type LucideIcon } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import type { WizardBranchId } from 'renderer/src/wizard/wizardTypes'
import { Carousel } from './Carousel'

/* ------------------------------------------------------------------ */
/* End product definitions                                             */
/* ------------------------------------------------------------------ */

export type EndProductId =
  | 'baked'
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
   * branchSequences.ts). Baked / Gummies / Capsules all share
   * the `edible` branch in the v1 mapping; future iterations will
   * add a sub-decision (format) inside the edible branch to
   * differentiate baked from gummies from capsules.
   */
  branch: WizardBranchId
}

const END_PRODUCTS: ReadonlyArray<EndProduct> = [
  {
    id: 'baked',
    name: 'Baked',
    description:
      'Brownies, cookies, cakes, pancakes, muffins — anything you bake in the oven with infused butter or oil. The workhorse category.',
    chip: '1 batch',
    icon: Croissant,
    branch: 'edible',
  },
  {
    id: 'gummies',
    name: 'Gummies',
    description:
      'Fruit-flavored chews — gummies, jellies, gummy bears — made with infused oil + gelatin + juice. Set in a silicone mold, 4–6 mg per piece.',
    chip: '80 / 160 ct',
    icon: Beaker,
    branch: 'edible',
  },
  {
    id: 'capsules',
    name: 'Capsules',
    description:
      'Capsules, softgels, pills — pre-dosed, swallowed with water. Quick, discreet, dose by the pill.',
    chip: '~24 caps',
    icon: Pill,
    branch: 'edible',
  },
  {
    id: 'tincture',
    name: 'Tincture',
    description:
      'Sublingual drops — alcohol or oil-based, fast onset. Long shelf life, dose by the dropper.',
    chip: '~100 mL',
    icon: Droplets,
    branch: 'avb',
  },
  {
    id: 'salve',
    name: 'Salve',
    description:
      'Topical balms, lotions, rubs — applied to skin for localized relief on joints, muscles, etc. No decarb needed.',
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
   * on a re-edit). When omitted, the first face (Baked) is the
   * initial center.
   */
  initialId?: EndProductId
  onSelect: (id: EndProductId, branch: WizardBranchId) => void
}

export function EndProductCoverflow({
  initialId,
  onSelect,
}: EndProductCoverflowProps) {
  const initialIndex = initialId
    ? END_PRODUCTS.findIndex(p => p.id === initialId)
    : 0
  return (
    <div className="flex w-full flex-col items-center" data-testid="end-product-coverflow">
      <Carousel
        ariaLabel="End product"
        // Slide 7 (2026-07-27, take 2): the coverflow faces
        // were 240x300 in v1, which rendered as 168-276px on a
        // 1440px screen. The user said the carousel tiles
        // were too small and the empty space was wasted.
        // Bumping the base to 360x440 so the end-product
        // faces land in the 360-576px range on desktop and
        // actually fill the available horizontal space. The
        // 5:4 aspect (taller than wide) gives the description
        // text room to breathe.
        baseFaceHeight={440}
        baseFaceWidth={360}
        getItemAriaLabel={item => item.name}
        getItemTestId={item => `end-product-face-${item.id}`}
        initialIndex={initialIndex >= 0 ? initialIndex : 0}
        items={END_PRODUCTS}
        onSelect={(item, _i) => onSelect(item.id, item.branch)}
        renderConfirm={center => (
          <button
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent/30 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            data-testid="end-product-coverflow-confirm"
            onClick={() => onSelect(center.id, center.branch)}
            type="button"
          >
            Make {center.name.toLowerCase()}
          </button>
        )}
        renderHint={() => (
          <span
            aria-hidden="true"
            className="font-mono text-[11px] text-foreground/50"
            data-testid="end-product-coverflow-hint"
          >
            ← tap a face · or use ← / →
          </span>
        )}
        renderItem={(product, isCenter) => {
          const Icon = product.icon
          return (
            <>
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
            </>
          )
        }}
      />
    </div>
  )
}
