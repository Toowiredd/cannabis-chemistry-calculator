/**
 * Stock recipes — curated starter recipes the Dashboard surfaces
 * (per docs/wizard-architecture-2026-07-26.md §8.3, Week 6
 * deliverable).
 *
 * Per §8.3, stock recipes are a "guided shortcut" for nervous
 * beginners — pick a stock recipe and the wizard pre-fills with
 * those values. The user reviews each step (sees what was chosen
 * and why), can adjust anything, and only then transitions to
 * Stage 2. Stock recipes are NOT a skip — they're a pre-fill
 * (`§8.3` literally: "the wizard pre-fills, doesn't skip it").
 *
 * The 5 entries cover the 5 product-type branches the wizard
 * supports (per §3.1):
 *  1. Standard Oven Decarb → flower / no infusion
 *  2. Quick Sous Vide      → flower / no infusion
 *  3. Coconut Oil Infusion → flower / with infusion
 *  4. Light AVB Tincture   → avb / with infusion (alcohol carrier)
 *  5. Beginner Olive Salve → topical / with infusion (olive carrier)
 *
 * `selections` is a `Record<string, unknown>` so the type
 * matches the design-system agent's `StockRecipe` interface in
 * `src/renderer/src/components/StockRecipeCard.tsx` verbatim —
 * the design-system contract is the single source of truth for
 * the public type, this file owns the data. The runtime values
 * are shaped like `WizardSelections` (from
 * `src/renderer/src/stores/wizardTypes.ts`) and the Dashboard
 * wire uses `setSelection` to write each key, so the wider
 * type doesn't lose type safety at the write site.
 *
 * Pure TypeScript — zero UI / React / Electron imports. The data
 * is the canonical store; the Dashboard renders a `StockRecipeCard`
 * list from this array.
 */
import type { ProductType } from '../stores/wizardTypes'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * A curated starter recipe the Dashboard surfaces as a
 * `StockRecipeCard`. Re-exported from
 * `src/renderer/src/components/StockRecipeCard.tsx` (the
 * design-system agent owns the canonical interface) so the
 * Dashboard import path is one line.
 *
 * `selections` is a `Record<string, unknown>` to match the
 * design-system's contract. The runtime values are shaped
 * like `WizardSelections` (from `stores/wizardTypes.ts`).
 */
export interface StockRecipe {
  /** Stable id; matches a `ProductType` branch. */
  id: string
  /** Card title (e.g. "Standard Oven Decarb"). */
  name: string
  /** 1-sentence plain-language description. */
  description: string
  /** Which of the 5 product-type branches this recipe belongs to. */
  branch: ProductType
  /**
   * The Stage 1 selections the wizard should pre-fill when the
   * user taps this card. Each key matches a member of the
   * Stage 1 `WizardSelections` shape; the value type is the
   * corresponding `WizardSelections[K]` type. Stored as
   * `Record<string, unknown>` to match the design-system's
   * `StockRecipeCard` contract.
   */
  selections: Record<string, unknown>
  /**
   * 2-4 short display strings rendered as chips on the card
   * (e.g. "28g", "113°C", "60-90 min"). Designed to glance-
   * compare recipes without opening the wizard.
   */
  chips: string[]
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/**
 * The 5 curated starter recipes. Per the brief:
 *
 *  1. Standard Oven Decarb — flower / oven_sealed / 28g / 95% / no
 *     infusion. Chips: 28g, 113°C, 60-90 min.
 *  2. Quick Sous Vide — flower / sv_fast / 7g / 97% / no infusion.
 *     Chips: 7g, 95°C, 120-180 min.
 *  3. Coconut Oil Infusion — flower / oven_sealed / 14g / 93% /
 *     coconut fat / 240mL. Chips: 14g, 113°C, 240mL coconut.
 *  4. Light AVB Tincture — avb / light color / alcohol carrier /
 *     100mL. Chips: Light AVB, 100mL alcohol, 5-8% residual.
 *  5. Beginner Olive Salve — topical / olive carrier / 240mL /
 *     joints application. Chips: 240mL olive, Joints / arthritis.
 *
 * The `method` / `fat` / `container` / `carrier` ids below match
 * real preset ids from `engine/models.ts`. The `weight` / `volume`
 * objects are the Stage 1 shape (`{ value, unit }`).
 */
export const STOCK_RECIPES: readonly StockRecipe[] = [
  {
    id: 'standard-oven-decarb',
    name: 'Standard Oven Decarb',
    description:
      'The workhorse flower decarb. Sealed in foil, slow and steady — perfect for a first batch.',
    branch: 'flower',
    selections: {
      method: 'oven_sealed',
      weight: { value: 28, unit: 'g' },
      efficiency: 0.95,
      // No infusion — omit the `fat` key entirely. The
      // Flower branch's smart-skip rule (§3.1) reads
      // `selections.fat === undefined` as "no fat picked",
      // and `setSelection('fat', undefined)` deletes the key.
    },
    chips: ['28g', '113°C', '60-90 min'],
  },
  {
    id: 'quick-sous-vide',
    name: 'Quick Sous Vide',
    description:
      'Hotter, shorter sous vide run. Near-maximum conversion in 2-3 hours.',
    branch: 'flower',
    selections: {
      method: 'sv_fast',
      weight: { value: 7, unit: 'g' },
      efficiency: 0.97,
    },
    chips: ['7g', '95°C', '120-180 min'],
  },
  {
    id: 'coconut-oil-infusion',
    name: 'Coconut Oil Infusion',
    description:
      'Flower decarb + coconut oil infusion in one batch. Great for capsules and candy.',
    branch: 'flower',
    selections: {
      method: 'oven_sealed',
      weight: { value: 14, unit: 'g' },
      efficiency: 0.93,
      fat: 'coconut',
      volume: { value: 240, unit: 'mL' },
    },
    chips: ['14g', '113°C', '240mL coconut'],
  },
  {
    id: 'light-avb-tincture',
    name: 'Light AVB Tincture',
    description:
      'Repurpose already-vaped bud into a sublingual alcohol tincture. 5-8% residual THC per dose.',
    branch: 'avb',
    selections: {
      color: 'light',
      carrier: 'alcohol',
      volume: { value: 100, unit: 'mL' },
    },
    chips: ['Light AVB', '100mL alcohol', '5-8% residual'],
  },
  {
    id: 'beginner-olive-salve',
    name: 'Beginner Olive Salve',
    description:
      'A topical olive-oil salve for joints and arthritis. No decarb needed — infusion only.',
    branch: 'topical',
    selections: {
      carrier: 'olive',
      volume: { value: 240, unit: 'mL' },
      applicationArea: 'joints',
    },
    chips: ['240mL olive', 'Joints / arthritis'],
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Id-based lookup. Returns `null` if no stock recipe exists for the
 * given id (so the Dashboard can render an explicit "not found"
 * state rather than crashing on a corrupted persisted id).
 */
export function findStockRecipe(id: string): StockRecipe | null {
  return STOCK_RECIPES.find(r => r.id === id) ?? null
}
