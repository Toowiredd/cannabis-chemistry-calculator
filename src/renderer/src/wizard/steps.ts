/**
 * Wizard step definitions.
 *
 * Each step is a declarative `WizardStep` per the architecture doc
 * §3.4. The wizard's step sequence is `branches[state.branch].steps`
 * (see `branchSequences.ts`); the product-type picker is a special
 * step 0 that every branch shares.
 *
 * Week 1 scope (§7 of docs/wizard-architecture-2026-07-26.md):
 * - Product-type step: 5 plain-language options with tooltips
 *   (§8.4). All 5 are shown — picking a branch other than 'flower'
 *   routes to a "Coming in week 2" placeholder.
 * - Flower Method step: the 6 real decarb methods from
 *   `engine/models.ts DECARB_METHODS`, with the brief's plain-
 *   language display names and the engine's tempC / time / efficiency
 *   data as the canonical subtitle. Badges ("Beginner-friendly",
 *   "Best match") are stamped where the engine data supports them.
 */
import {
  Cloud,
  Cookie,
  Droplets,
  type LucideIcon,
  Pill,
  Sprout,
} from 'lucide-react'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import type { WizardOption, WizardState, WizardStep } from './wizardTypes'

/* ------------------------------------------------------------------ */
/* Product-type step (step 0 for every branch)                         */
/* ------------------------------------------------------------------ */

/**
 * Icon helper for the product-type tiles. These match the visual
 * metaphors the user can verify in the wild:
 *  - raw flower → sprout (unprocessed plant)
 *  - concentrate → droplets (oil/wax)
 *  - AVB → cloud (vaporizer)
 *  - edible → cookie (baked good)
 *  - topical → pill (lotions live in the same shelf as salves)
 */
const PRODUCT_TYPE_ICONS: Record<string, LucideIcon> = {
  flower: Sprout,
  concentrate: Droplets,
  avb: Cloud,
  edible: Cookie,
  topical: Pill,
}

export const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{
  id: 'flower' | 'concentrate' | 'avb' | 'edible' | 'topical'
  title: string
  tooltip: string
}> = [
  {
    id: 'flower',
    title: 'From raw flower',
    tooltip:
      'You have raw, unprocessed cannabis flower and want to decarboxylate it (heat it to activate the THC) before infusing or dosing.',
  },
  {
    id: 'concentrate',
    title: 'From concentrate or hash',
    tooltip:
      'You have a concentrated form of cannabis — kief, hash, wax, shatter, RSO. Skip the decarb step.',
  },
  {
    id: 'avb',
    title: 'From already-used flower (AVB)',
    tooltip:
      "AVB = 'Already Vaped Bud'. The material left in a dry-herb vaporizer after a session. Already decarboxylated; just needs a carrier.",
  },
  {
    id: 'edible',
    title: 'For an edible or recipe',
    tooltip:
      'Decarb + infuse into a fat or oil, then dose into your recipe (brownies, gummies, capsules, etc.).',
  },
  {
    id: 'topical',
    title: 'For a skin or topical product',
    tooltip:
      'Infuse into a carrier oil for a salve, lotion, or balm applied to the skin. No decarb needed.',
  },
]

/**
 * The product-type step. Shown to every branch (no skipIf predicate).
 * The options are static — no per-state filtering yet (week 2 may
 * need to re-order based on commonality).
 */
export const productTypeStep: WizardStep = {
  id: 'product-type',
  title: 'What are you making?',
  description:
    'Pick the starting material. This routes the rest of the wizard down the right path.',
  getOptions: (_state: WizardState): WizardOption[] =>
    PRODUCT_TYPE_OPTIONS.map(opt => ({
      id: opt.id,
      title: opt.title,
      subtitle: '', // product type uses the tooltip for plain-language
      icon: PRODUCT_TYPE_ICONS[opt.id] ?? Sprout,
      tooltip: opt.tooltip,
    })),
}

/* ------------------------------------------------------------------ */
/* Flower Method step                                                  */
/* ------------------------------------------------------------------ */

/**
 * Map of the 6 decarb methods to their plain-language display
 * names from the brief. The engine's `name` field uses a more
 * technical label ("Oven -- Sealed Container") that beginners
 * wouldn't recognise. The brief's labels read better on a tile:
 * "Oven, sealed bag" / "Oven, open tray" / "Sous vide, dry" / etc.
 *
 * The keys are the engine method IDs from `DECARB_METHODS` in
 * `engine/models.ts` — the brief is the source of truth for
 * display order, but the data is the source of truth for IDs and
 * efficiency / temperature / time values.
 */
const METHOD_DISPLAY_NAME: Record<string, string> = {
  oven_sealed: 'Oven, sealed bag',
  oven_open: 'Oven, open tray',
  sv_combined: 'Sous vide, combined',
  sv_fast: 'Sous vide, fast',
  sv_lowtemp: 'Sous vide, low-temp',
  sv_dry: 'Sous vide, dry',
}

/**
 * Badge stamps per the brief. The brief allows "Beginner-friendly"
 * and "Best match" badges where the engine data supports them:
 *  - oven_sealed: "Beginner-friendly" — it is the codebase default
 *    (`DEFAULT_DECARB.presetId = 'oven_sealed'`), the most common
 *    home setup (just an oven + a sealed bag), 90-95% efficiency.
 *  - sv_dry: "Best match" — highest expected efficiency (97%) with
 *    the best terpene retention ("High retention") and lowest CBN
 *    risk ("Low CBN risk"). Matches the architecture doc's
 *    "optimised for the target user" framing.
 */
const METHOD_BADGE: Record<string, string> = {
  oven_sealed: 'Beginner-friendly',
  sv_dry: 'Best match',
}

/**
 * The Flower Method step. Reads the 6 real decarb methods from the
 * engine. Subtitle is the canonical brief in the form
 * "{tempC}°C, {timeMin}-{timeMax} min, {effLow*100}-{effHigh*100}%
 * efficiency" — the same shape the QuickBatch tab renders today
 * (see QuickBatchTab.tsx:1083-1090).
 */
export const flowerMethodStep: WizardStep = {
  id: 'method',
  title: 'Decarb method',
  description:
    'Each method heats your flower to a different temperature for a different length of time. Pick what matches the equipment you have.',
  getOptions: (_state: WizardState): WizardOption[] => {
    // Order: brief's display order. The engine's DECARB_METHODS is
    // already in the same order (oven_sealed, oven_open, sv_combined,
    // sv_fast, sv_lowtemp, sv_dry — see models.ts:232). We iterate
    // the engine array, but stamp the brief's display name on each.
    return DECARB_METHODS.map(m => {
      const tempC = m.tempC
      const timeMin = m.timeMin
      const timeMax = m.timeMax
      const effLow = Math.round(m.efficiency.low * 100)
      const effHigh = Math.round(m.efficiency.high * 100)
      const timeRange =
        timeMin === timeMax ? `${timeMin}` : `${timeMin}-${timeMax}`
      const subtitle = `${tempC}°C, ${timeRange} min, ${effLow}-${effHigh}% efficiency`
      const title = METHOD_DISPLAY_NAME[m.id] ?? m.name
      return {
        id: m.id,
        title,
        subtitle,
        badge: METHOD_BADGE[m.id],
      } satisfies WizardOption
    })
  },
}

/* ------------------------------------------------------------------ */
/* "Coming in week 2" placeholder                                       */
/* ------------------------------------------------------------------ */

/**
 * Week-1 placeholder for any step beyond the Flower Method step.
 * The brief says: "For Week 1, only the Flower branch is
 * end-to-end. Other branches get a 'Coming in week 2' placeholder
 * step." This is the placeholder.
 *
 * `validate` and `skipIf` are not used by the Week-1 runtime, so
 * this step is a static step with a single "OK" option (no
 * selection) and no `selections` key.
 */
export const comingSoonStep: WizardStep = {
  id: 'coming-soon',
  title: 'Coming in week 2',
  description:
    'This branch is wired up next week. The product type you picked is saved; the rest of the steps will appear in build order §7.',
  getOptions: (_state: WizardState): WizardOption[] => [],
}
