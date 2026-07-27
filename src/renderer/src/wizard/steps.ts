/**
 * Wizard step definitions.
 *
 * Each step is a declarative `WizardStep` per the architecture doc
 * §3.4. The wizard's step sequence is `branches[state.branch].steps`
 * (see `branchSequences.ts`); the product-type picker is a special
 * step 0 that every branch shares.
 *
 * Scope (per `docs/wizard-architecture-2026-07-26.md` §7 + the
 * Week 2 build of `branchSequences.ts`):
 * - Product-type step: 5 plain-language options with tooltips
 *   (§8.4). All 5 are shown — every branch is end-to-end wired.
 * - Per-branch steps: 5 real decarb methods from
 *   `engine/models.ts DECARB_METHODS` (Flower + Edible), the
 *   AVB color picker, the Topical application area, etc.
 *   The "Coming in week 2" placeholder was removed in
 *   Week 7's full-codebase-review once all 5 branches
 *   were wired (Week 2 deliverable).
 *   Badges ("Beginner-friendly", "Best match") are stamped
 *   where the engine data supports them.
 */
import {
  Cloud,
  Cookie,
  Croissant,
  Droplets,
  type LucideIcon,
  Pill,
  Sprout,
} from 'lucide-react'
import { AVB_RESIDUAL_THC_RANGES } from 'renderer/src/engine/decarb'
import {
  BAG_PRESETS,
  DECARB_METHODS,
  INFUSION_FATS,
} from 'renderer/src/engine/models'
import type {
  WizardOption,
  WizardState,
  WizardStep,
  WizardStepId,
} from './wizardTypes'

/* ------------------------------------------------------------------ */
/* Product-type step (step 0 for every branch)                         */
/* ------------------------------------------------------------------ */

/**
 * End-product IDs at the wizard's landing. The v2.2 mockup reframes
 * the first decision from "what starting material" to "what end
 * product are you making" — Baked / Gummies / Capsules / Tincture
 * / Salve. These are CATEGORIES, not individual recipes: "Baked"
 * covers brownies / cookies / cakes / pancakes / muffins (anything
 * you bake in the oven with infused butter or oil); "Gummies"
 * covers gummies / jellies / gummy bears; "Capsules" covers
 * capsules / softgels / pills; "Tincture" covers alcohol- or
 * oil-based sublingual drops; "Salve" covers topical balms /
 * lotions / rubs. The end product maps to a starting-material
 * branch for the rest of the wizard (see `END_PRODUCT_TO_BRANCH`
 * in `EndProductCoverflow.tsx`).
 *
 * The 5 end products map to 3 distinct branches in the v1 mapping:
 *  - Baked / Gummies / Capsules → `edible` (shared branch;
 *    future iterations will add a format sub-decision)
 *  - Tincture → `avb`
 *  - Salve → `topical`
 *
 * The `id` field on each option is the END-PRODUCT id (not the
 * branch id) so the `EndProductCoverflow` component can render
 * 5 distinct faces. The branch mapping lives in the coverflow
 * component, not here.
 */
const PRODUCT_TYPE_ICONS: Record<string, LucideIcon> = {
  baked: Croissant,
  gummies: Cookie,
  capsules: Pill,
  tincture: Droplets,
  salve: Cloud,
}

export const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{
  id: 'baked' | 'gummies' | 'capsules' | 'tincture' | 'salve'
  title: string
  tooltip: string
}> = [
  {
    id: 'baked',
    title: 'Baked',
    tooltip:
      'Brownies, cookies, cakes, pancakes, muffins — anything you bake in the oven with infused butter or oil. The workhorse category.',
  },
  {
    id: 'gummies',
    title: 'Gummies',
    tooltip:
      'Fruit-flavored chews — gummies, jellies, gummy bears — made with infused oil + gelatin + juice. Set in a silicone mold, 4–6 mg per piece.',
  },
  {
    id: 'capsules',
    title: 'Capsules',
    tooltip:
      'Capsules, softgels, pills — pre-dosed, swallowed with water. Quick, discreet, dose by the pill.',
  },
  {
    id: 'tincture',
    title: 'Tincture',
    tooltip:
      'Sublingual drops — alcohol or oil-based, fast onset. Long shelf life, dose by the dropper.',
  },
  {
    id: 'salve',
    title: 'Salve',
    tooltip:
      'Topical balms, lotions, rubs — applied to skin for localized relief on joints, muscles, etc. No decarb needed.',
  },
]

/**
 * The product-type step. Shown to every branch (no skipIf predicate).
 * The options are static — no per-state filtering yet (week 2 may
 * need to re-order based on commonality).
 *
 * The selected option id is the end-product id (e.g. 'brownies'),
 * not the branch id. The coverflow component maps end-product →
 * branch via its own table.
 */
export const productTypeStep: WizardStep = {
  id: 'product-type',
  title: 'What are you making?',
  description:
    'Pick the end product. The wizard routes the rest of the recipe down the right path.',
  getOptions: (_state: WizardState): WizardOption[] =>
    PRODUCT_TYPE_OPTIONS.map(opt => ({
      id: opt.id,
      title: opt.title,
      subtitle: '', // product type uses the tooltip for plain-language
      icon: PRODUCT_TYPE_ICONS[opt.id] ?? Cookie,
      tooltip: opt.tooltip,
    })),
  /**
   * Map `state.branch` back to an end-product id so the coverflow
   * shows the right face as the initial center on re-edit.
   *
   * The mapping is many-to-one (3 end products → edible branch) so
   * we default to the first end product for any branch with multiple
   * end products. A future iteration will add `endProduct` to the
   * wizard state to make this lossless.
   */
  getSelectedOptionId: (state: WizardState) => {
    switch (state.branch) {
      case 'flower':
      case 'concentrate':
      case 'edible':
        return 'baked'
      case 'avb':
        return 'tincture'
      case 'topical':
        return 'salve'
      default:
        return null
    }
  },
}

/* ------------------------------------------------------------------ */
/* Material step (the v2.3 "what are you using?" question)              */
/* ------------------------------------------------------------------ */

/**
 * The Material step — slide 2 of the wizard. The user picks
 * their starting material (Flower / AVB / Concentrate) which
 * drives the decarb-side decisions downstream:
 *  - Flower → Method (decarb method) + Efficiency
 *  - AVB    → Color (proxy for residual THC)
 *  - Concentrate → Potency (THC %)
 *
 * Added in v2.3 (2026-07-28) to make the wizard's flow
 * dynamic: a user can now pick any combination of end product
 * (Baked / Gummies / Capsules / Tincture / Salve) AND
 * starting material (Flower / AVB / Concentrate). The old
 * per-branch sequence tables hardcoded 5 end products to 3
 * materials, which prevented e.g. a "Tincture + Flower" path
 * (a real recipe — flower-based alcohol tincture).
 *
 * The Material step writes the user's choice to
 * `state.branch` (overriding the end-product coverflow's
 * default mapping). The Material step is ALWAYS shown after
 * the product-type picker (no smart-skip), so the user has
 * an explicit choice.
 */
export const materialStep: WizardStep = {
  id: 'material',
  title: 'Starting material',
  description:
    'What are you using? This determines whether the wizard walks you through decarb or skips straight to infusion.',
  getOptions: (_state: WizardState): WizardOption[] => [
    {
      id: 'flower',
      title: 'Flower',
      subtitle:
        'Raw flower — the wizard walks you through decarb first.',
    },
    {
      id: 'avb',
      title: 'AVB (already vaped bud)',
      subtitle:
        'Already decarbed; the wizard asks for the color to estimate how much THC is left.',
    },
    {
      id: 'concentrate',
      title: 'Concentrate',
      subtitle: 'Already active — no decarb needed.',
    },
  ],
  getSelectedOptionId: (state: WizardState) => state.branch ?? null,
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
  getSelectedOptionId: (state: WizardState) => state.selections.method ?? null,
}

/* ------------------------------------------------------------------ */
/* Week 2 step definitions (§3.1 branch taxonomy)                       */
/* ------------------------------------------------------------------ */

/**
 * Static weight presets for the Flower + Edible branches. The brief
 * asks for beginner-friendly common amounts in both g and oz. We
 * pick grams as the canonical internal unit (matches the engine's
 * `grams` parameter for decarb / infusion) and surface the oz
 * equivalent on the tile so a US user sees both.
 *
 * Order: smallest → largest so the carousel reads as "ramp up".
 */
const WEIGHT_PRESETS: ReadonlyArray<{
  grams: number
  ozLabel: string
}> = [
  { grams: 3.5, ozLabel: '1/8 oz' },
  { grams: 7, ozLabel: '1/4 oz' },
  { grams: 14, ozLabel: '1/2 oz' },
  { grams: 28, ozLabel: '1 oz' },
  { grams: 56, ozLabel: '2 oz' },
]

/**
 * Container step — custom input form (v2.2).
 *
 * The previous carousel of `BAG_PRESETS` (1 Gallon, 1 Quart,
 * etc.) was removed at the user's request: vacuum bags come
 * in many sizes and the user often uses non-standard
 * containers (mason jars, stasher bags, sous-vide pouches
 * from bulk rolls). The user types in their own width,
 * length, and depth in cm; the engine's
 * `calculateBagVolume` derives the volume in cm³; that
 * volume flows downstream to the Weight + Volume +
 * Servings steps via `selections.customContainer`.
 *
 * `getOptions` returns `[]` because the StepCard renders the
 * `renderCustom` form in place of the carousel when the
 * step has a custom renderer. The two paths are mutually
 * exclusive — see the `WizardStep.renderCustom` field's
 * docstring in `wizardTypes.ts`.
 *
 * Used by: Flower (Method → Container), Edible (Method →
 * Container).
 */
export const containerStep: WizardStep = {
  id: 'container',
  title: 'Container dimensions',
  description:
    'Type in the width, length, and depth of the bag or container you will decarb in. The wizard calculates the volume from your measurements.',
  getOptions: (_state: WizardState): WizardOption[] => [],
  getSelectedOptionId: (state: WizardState) => {
    // The v2.2 custom input writes to
    // `selections.customContainer`; legacy preset ids (e.g.
    // 'gallon' / 'quart' from the old carousel) are kept
    // in `selections.container` for the engine tests + the
    // legacy data flows. The custom form is the canonical
    // v2.2 path; the legacy branch is the no-op fallback
    // for callers that haven't migrated yet.
    const c = state.selections.customContainer
    if (c) return `custom-${c.widthCm}-${c.lengthCm}-${c.depthCm}`
    if (state.selections.container) return state.selections.container
    return null
  },
}

/**
 * Weight step — static presets from `WEIGHT_PRESETS` above. Each
 * tile shows the grams value (primary) and the oz equivalent
 * (subtitle), per the brief: "Each tile shows both units."
 *
 * Used by: Flower (after Container), Edible (after Container).
 */
export const weightStep: WizardStep = {
  id: 'weight',
  title: 'Starting weight',
  description:
    'How much raw flower are you starting with? Pick the closest preset; the dose calculation updates from this number.',
  getOptions: (_state: WizardState): WizardOption[] =>
    WEIGHT_PRESETS.map(w => ({
      id: `g-${w.grams}`,
      title: `${w.grams} g`,
      subtitle: w.ozLabel,
    })),
  getSelectedOptionId: (state: WizardState) => {
    const w = state.selections.weight
    if (!w) return null
    return `${w.unit}-${w.value}`
  },
}

/**
 * Efficiency step — static presets with the engine's default
 * efficiency for the picked method stamped as "Recommended".
 * Per the brief: "Use the engine's default efficiency as one of
 * the presets (with a 'Recommended' badge). Other presets: 80%,
 * 85%, 90%, 95%."
 *
 * The engine's default is the `expected` value of the picked
 * method's `efficiency` range. If no method is picked (defensive
 * — the Method step should always precede Efficiency in the
 * Flower branch), we fall back to `FIRST_TIMER_DECARB_EFF` (0.93),
 * the codebase's documented first-timer default.
 *
 * Used by: Flower (after Weight).
 */
const EFFICIENCY_FIXED_PRESETS: ReadonlyArray<number> = [0.8, 0.85, 0.9, 0.95]

/**
 * Look up the picked method's expected decarb efficiency from the
 * engine. Returns `null` when the method id is not on the
 * `DECARB_METHODS` table (defensive — the engine IDs are a closed
 * union but the wizard's `selections.method` is `string`).
 */
function expectedEfficiencyForMethod(
  methodId: string | undefined
): number | null {
  if (!methodId) return null
  const m = DECARB_METHODS.find(dm => dm.id === methodId)
  return m ? m.efficiency.expected : null
}

export const efficiencyStep: WizardStep = {
  id: 'efficiency',
  title: 'Decarb efficiency',
  description:
    'How much of the available THCA converts to active THC. The recommended value is the engine default for your method; pick lower if you ran a cooler / shorter session.',
  getOptions: (state: WizardState): WizardOption[] => {
    // Resolve the recommended value from the picked method, or
    // fall back to the codebase's first-timer default.
    const recommended =
      expectedEfficiencyForMethod(state.selections.method) ?? 0.93
    const recommendedTile: WizardOption = {
      id: `eff-${Math.round(recommended * 100)}`,
      title: `${Math.round(recommended * 100)}%`,
      subtitle: 'Recommended for your method',
      badge: 'Recommended',
    }
    const fixedTiles: WizardOption[] = EFFICIENCY_FIXED_PRESETS.map(pct => ({
      id: `eff-${Math.round(pct * 100)}`,
      title: `${Math.round(pct * 100)}%`,
      subtitle:
        Math.abs(pct - recommended) < 0.001
          ? 'Same as recommended'
          : pct < recommended
            ? 'Conservative — assume some loss'
            : 'Optimistic — assume ideal conversion',
    }))
    // De-dupe: if the recommended value collides with a fixed
    // preset, drop the fixed one so the user sees the recommended
    // tile once.
    const dedupedFixed = fixedTiles.filter(t => t.id !== recommendedTile.id)
    return [recommendedTile, ...dedupedFixed]
  },
  getSelectedOptionId: (state: WizardState) => {
    const eff = state.selections.efficiency
    if (eff === undefined) return null
    return `eff-${Math.round(eff * 100)}`
  },
}

/**
 * Fat step — reads the real fat presets from
 * `engine/models.ts INFUSION_FATS`. Per the brief: "Common fats:
 * coconut oil, butter, ghee, olive oil, MCT oil." The engine
 * ships ghee / coconut / mct / custom (4 entries); butter and
 * olive are engine gaps — surfaced in the commit body.
 *
 * The Flower branch adds a "No infusion" tile (per §3.1) so the
 * user can skip infusion when they only want decarbed flower.
 * Picking that tile sets `selections.fat = null`, which the
 * Volume step's smart-skip predicate reads to skip downstream.
 *
 * The Edible branch does NOT show the "No infusion" tile — the
 * user picked the Edible branch to make an edible, so they
 * always need a fat.
 *
 * Used by: Flower (after Efficiency, optional via "No infusion"),
 * Edible (after Weight, required).
 */
const FAT_NO_INFUSION_ID = 'none'

export const fatStep: WizardStep = {
  id: 'fat',
  title: 'Infusion fat',
  description:
    'The fat or oil you will infuse the decarbed material into. Saturated fats (ghee, coconut, MCT) dissolve cannabinoids most efficiently.',
  getOptions: (state: WizardState): WizardOption[] => {
    const fatTiles: WizardOption[] = INFUSION_FATS.map(f => ({
      id: f.id,
      title: f.name,
      subtitle:
        f.notes ??
        `${Math.round(f.extractionEff * 100)}% extraction efficiency`,
    }))
    if (state.branch === 'flower') {
      // Flower branch: add the "No infusion" tile so the user
      // can skip the optional infusion path (§3.1).
      fatTiles.push({
        id: FAT_NO_INFUSION_ID,
        title: 'No infusion',
        subtitle:
          "I'll dose the decarbed flower directly — no fat or volume needed.",
      })
    }
    return fatTiles
  },
  getSelectedOptionId: (state: WizardState) => {
    const fat = state.selections.fat
    if (fat === undefined) return null
    if (fat === null) return FAT_NO_INFUSION_ID
    return fat
  },
  /**
   * Per §3.1 + the brief: the Fat step is the "do you want to
   * infuse?" question in the Flower branch. The smart-skip rule
   * for downstream Volume is encoded there, not here. The Fat
   * step itself is always shown to the Flower branch.
   */
}

/**
 * Volume step — static presets in mL. Per the brief: "Common
 * volumes in mL: 100mL, 240mL, 480mL, 960mL." We show the mL
 * value (primary) and the cup equivalent (subtitle) so a US
 * user has a familiar reference. The canonical unit stored in
 * `selections.volume.unit` is 'mL'.
 *
 * Used by: Flower (optional after Fat), Edible, Concentrate,
 * AVB, Topical.
 *
 * Smart-skip: the Flower branch's "no infusion" path skips
 * Volume (when `selections.fat === null`). Edible / Concentrate
 * / AVB / Topical always show Volume.
 */
const VOLUME_PRESETS: ReadonlyArray<{ ml: number; cupLabel: string }> = [
  { ml: 100, cupLabel: '~0.4 cup' },
  { ml: 240, cupLabel: '1 cup' },
  { ml: 480, cupLabel: '2 cups' },
  { ml: 960, cupLabel: '4 cups' },
]

export const volumeStep: WizardStep = {
  id: 'volume',
  title: 'Liquid volume',
  description:
    'Total liquid volume you will infuse into. Larger volumes spread the dose thinner; smaller volumes concentrate it.',
  getOptions: (_state: WizardState): WizardOption[] =>
    VOLUME_PRESETS.map(v => ({
      id: `mL-${v.ml}`,
      title: `${v.ml} mL`,
      subtitle: v.cupLabel,
    })),
  getSelectedOptionId: (state: WizardState) => {
    const v = state.selections.volume
    if (!v) return null
    return `${v.unit}-${v.value}`
  },
  skipIf: (state: WizardState) =>
    // Per the brief's smart-skip rules (§3.1): the Flower
    // branch's "no infusion" path (selections.fat === null)
    // skips the Volume step.
    state.branch === 'flower' && state.selections.fat === null,
}

/**
 * Servings step — static presets. Per the brief: "Common batch
 * sizes: 4, 8, 12, 16, 24, 48." Each tile shows the count and
 * a 1-line context (small/standard/large batch).
 *
 * Used by: Flower (optional), Edible, Concentrate, AVB.
 *
 * Smart-skip: the Topical branch skips Servings — topicals are
 * not dose-divided (the user applies by need, not per-piece).
 */
const SERVING_PRESETS: ReadonlyArray<{
  count: number
  context: string
}> = [
  { count: 4, context: 'Strong dose per piece' },
  { count: 8, context: 'Large batch, strong per piece' },
  { count: 12, context: 'Standard batch' },
  { count: 16, context: 'Standard batch, lighter per piece' },
  { count: 24, context: 'Small per piece, long-lasting supply' },
  { count: 48, context: 'Microdose per piece' },
]

export const servingsStep: WizardStep = {
  id: 'servings',
  title: 'Servings',
  description:
    'How many pieces / doses will you cut this batch into? The per-serving dose is calculated from this number.',
  getOptions: (_state: WizardState): WizardOption[] =>
    SERVING_PRESETS.map(s => ({
      id: `s-${s.count}`,
      title: `${s.count} servings`,
      subtitle: s.context,
    })),
  getSelectedOptionId: (state: WizardState) => {
    const s = state.selections.servings
    if (s === undefined) return null
    return `s-${s}`
  },
  /**
   * Per the brief's smart-skip rules (§3.1): the Topical
   * branch skips Servings. Topicals are applied as-needed,
   * not divided into per-piece doses.
   */
  skipIf: (state: WizardState) => state.branch === 'topical',
}

/**
 * Carrier step — local constant because the engine has no
 * "carrier" preset table distinct from `INFUSION_FATS`. The
 * carrier list is broader (includes alcohol + glycerin for
 * tinctures, which the fat list does not).
 *
 * Per the brief: "Common carriers: alcohol (for tinctures),
 * glycerin (VG), MCT oil, olive oil, coconut oil." We surface
 * this as a commit-body note that the carrier list is local
 * wizard data, not engine data.
 *
 * Used by: Concentrate, AVB, Topical.
 */
const CARRIER_PRESETS: ReadonlyArray<{
  id: string
  title: string
  description: string
}> = [
  {
    id: 'alcohol',
    title: 'Alcohol (high-proof)',
    description:
      'For tinctures — fast extraction, long shelf life, easy to dose drop-by-drop.',
  },
  {
    id: 'glycerin',
    title: 'Glycerin (VG)',
    description:
      'Sweet, alcohol-free tincture base. Lower potency than alcohol; good for sensitive users.',
  },
  {
    id: 'mct',
    title: 'MCT oil',
    description:
      'Stays liquid, neutral flavor, highest cannabinoid solubility — good for sublingual drops.',
  },
  {
    id: 'olive',
    title: 'Olive oil',
    description:
      'Familiar kitchen oil, gentle flavor. Best for topicals or low-and-slow infusions.',
  },
  {
    id: 'coconut',
    title: 'Coconut oil',
    description:
      'Solid at room temperature, mild coconut aroma. Good for capsules or salves.',
  },
]

export const carrierStep: WizardStep = {
  id: 'carrier',
  title: 'Carrier',
  description:
    'The liquid you will infuse the material into. Different carriers suit different end products (tincture, salve, topical, etc.).',
  getOptions: (_state: WizardState): WizardOption[] =>
    CARRIER_PRESETS.map(c => ({
      id: c.id,
      title: c.title,
      subtitle: c.description,
    })),
  getSelectedOptionId: (state: WizardState) => state.selections.carrier ?? null,
}

/**
 * Potency step — static presets. Per the brief: "Common: 50%,
 * 65%, 75%, 85% THC." We add a 1-line note on each tile so the
 * user has context (e.g. "Distillate — high potency, low
 * flavor").
 *
 * Used by: Concentrate (first step — picks the potency of the
 * starting material).
 */
const POTENCY_PRESETS: ReadonlyArray<{ pct: number; note: string }> = [
  { pct: 50, note: 'Hash / kief — moderate potency, full flavor' },
  { pct: 65, note: 'Mid-grade concentrate — solid baseline' },
  { pct: 75, note: 'High-grade oil / wax — strong dose per gram' },
  { pct: 85, note: 'Distillate — very high potency, low flavor' },
]

export const potencyStep: WizardStep = {
  id: 'potency',
  title: 'Concentrate potency',
  description:
    'The THC percentage of the concentrate you are dosing from. The label or dispensary listing usually shows this number.',
  getOptions: (_state: WizardState): WizardOption[] =>
    POTENCY_PRESETS.map(p => ({
      id: `p-${p.pct}`,
      title: `${p.pct}% THC`,
      subtitle: p.note,
    })),
  getSelectedOptionId: (state: WizardState) => {
    const p = state.selections.potency
    if (p === undefined) return null
    return `p-${p}`
  },
}

/**
 * Color step — reads the real residual-THC ranges from
 * `engine/decarb.ts AVB_RESIDUAL_THC_RANGES`. Per the brief:
 * "Each tile: color + the residual THC range from
 * `AVB_RESIDUAL_THC_RANGES` (e.g., 'Light — 5-8% residual
 * THC')." The engine's range is `{ minPct, midPct, maxPct }`;
 * the tile surfaces the min–max spread.
 *
 * Used by: AVB (first step — the color of the user's AVB is
 * the proxy for how much THC is left to extract).
 */
export const colorStep: WizardStep = {
  id: 'color',
  title: 'AVB color',
  description:
    'How dark is your already-vaped bud? Lighter AVB retains more THC; darker AVB has been more thoroughly extracted in the vaporizer.',
  getOptions: (_state: WizardState): WizardOption[] => {
    const colors: Array<'light' | 'medium' | 'dark'> = [
      'light',
      'medium',
      'dark',
    ]
    return colors.map(c => {
      const range = AVB_RESIDUAL_THC_RANGES[c]
      return {
        id: c,
        title:
          c === 'light'
            ? 'Light (golden / light brown)'
            : c === 'medium'
              ? 'Medium (medium brown)'
              : 'Dark (dark brown / near-black)',
        subtitle: `${range.minPct}-${range.maxPct}% residual THC remaining`,
      } satisfies WizardOption
    })
  },
  getSelectedOptionId: (state: WizardState) => state.selections.color ?? null,
}

/**
 * Application area step — static presets. Per the brief:
 * "Common application areas: face, body, joint, muscle. Each
 * tile: area + 1-line description."
 *
 * Used by: Topical (after Volume).
 */
const APPLICATION_AREA_PRESETS: ReadonlyArray<{
  id: string
  title: string
  description: string
}> = [
  {
    id: 'face',
    title: 'Face',
    description:
      'Gentler concentration — facial skin is thinner and more sensitive.',
  },
  {
    id: 'body',
    title: 'Body (general)',
    description: 'Standard concentration for broad skin application.',
  },
  {
    id: 'joint',
    title: 'Joints / arthritis',
    description:
      'Higher concentration for deeper penetration into joint tissue.',
  },
  {
    id: 'muscle',
    title: 'Muscle / sore areas',
    description: 'Targeted relief — apply to the specific area that needs it.',
  },
]

export const applicationAreaStep: WizardStep = {
  id: 'app-area',
  title: 'Application area',
  description:
    'Where will you apply the topical? Different areas have different skin sensitivity, which affects the right concentration.',
  getOptions: (_state: WizardState): WizardOption[] =>
    APPLICATION_AREA_PRESETS.map(a => ({
      id: a.id,
      title: a.title,
      subtitle: a.description,
    })),
  getSelectedOptionId: (state: WizardState) =>
    state.selections.applicationArea ?? null,
}

/**
 * Start step — the terminal step per §3.1. Shows a single
 * "Begin batch" option that the user picks to confirm the
 * configuration and transition to Stage 2 (which lands in
 * week 3 per the build order). For week 2, picking
 * "Begin batch" is a local no-op — the WizardScreen wires it
 * to a local `onWizardComplete` callback that does nothing
 * yet (the Stage 2 stepper is not yet built).
 *
 * The step's `getSelectedOptionId` always returns 'begin' once
 * the user has reached this step in the collapsed-with-
 * selection state. The selection encoding is simpler than
 * the other steps because there is only one option.
 *
 * Used by: every branch's final step.
 */
export const startStep: WizardStep = {
  id: 'start',
  title: 'Ready to start',
  description:
    'Your selections are saved. Tap "Begin batch" to lock in the configuration and move to the execution view.',
  getOptions: (_state: WizardState): WizardOption[] => [
    {
      id: 'begin',
      title: 'Begin batch',
      subtitle: 'Lock in these selections and move to the execution view.',
    },
  ],
  getSelectedOptionId: (_state: WizardState) => 'begin',
}

/* ------------------------------------------------------------------ */
/* Name step (the §8.5 "Name this recipe" question)                     */
/* ------------------------------------------------------------------ */

/**
 * The Name step — the user types a recipe name. The name is
 * stored on `selections.name` (per the §8.5 contract) and
 * flows to the Stage 2 completion step's "Save recipe" tile.
 *
 * The actual input widget lives in `NameRecipeStep.tsx`
 * (rendered by WizardScreen below the Begin batch CTA on the
 * Start step). The wizard's "Name" step is a single
 * "Type a name →" tile that the user taps to focus the input
 * — the input itself is the NameRecipeStep inline card.
 *
 * For the v2.3 DAG this is a minimal step: a single option
 * that the user taps to acknowledge they've seen the name
 * prompt. Future iterations can make the name input the step
 * itself (the wizard advances when the user types a name +
 * taps "Continue").
 */
export const nameStep: WizardStep = {
  id: 'name',
  title: 'Name this recipe',
  description:
    'Give this batch a name so you can find it later. The name appears on the Journal card and the saved Recipe.',
  getOptions: (_state: WizardState): WizardOption[] => [
    {
      id: 'named',
      title: 'Name saved',
      subtitle: 'Tap to confirm — the typed name is the recipe name.',
    },
  ],
  getSelectedOptionId: (state: WizardState) =>
    state.selections.name ? 'named' : null,
}

/* ------------------------------------------------------------------ */
/* Step map (DAG lookup)                                               */
/* ------------------------------------------------------------------ */

/**
 * The map from `WizardStepId` to the `WizardStep` definition.
 * Replaces the old `BRANCH_SEQUENCES[id]` array indexing — the
 * Wizard now looks up the current step by id rather than by a
 * numeric index into a per-branch sequence. The map covers
 * every step id in the `WizardStepId` union, so TypeScript will
 * fail to compile if a new step is added but not registered.
 *
 * The `productTypeStep` is the only step that has a custom
 * renderer (`EndProductCoverflow`); all other steps render the
 * `OptionCarousel` with their `getOptions(state)` tiles. The
 * StepCard branches on `step.id === 'product-type'` to pick
 * the coverflow vs carousel.
 */
export const STEP_MAP: Record<WizardStepId, WizardStep> = {
  'product-type': productTypeStep,
  material: materialStep,
  method: flowerMethodStep,
  container: containerStep,
  weight: weightStep,
  efficiency: efficiencyStep,
  potency: potencyStep,
  color: colorStep,
  fat: fatStep,
  carrier: carrierStep,
  volume: volumeStep,
  servings: servingsStep,
  'app-area': applicationAreaStep,
  name: nameStep,
  start: startStep,
}
