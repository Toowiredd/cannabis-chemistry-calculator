/**
 * Curated option sets + lift-out presets for the first-time wizard.
 *
 * Pure TypeScript — zero UI, React, Tailwind, or Electron imports.
 *
 * Derives `WIZARD_RECIPES`, `DECARB_METHOD_CARDS`, and `FAT_CARDS` directly
 * from `EDIBLE_FORMATS`, `DECARB_METHODS`, and `INFUSION_FATS` in
 * `./models.ts`. The wizard therefore stays in lock-step with the canonical
 * preset tables: add/remove an entry there and the wizard card surfaces it
 * automatically.
 *
 * The human prose (recipe sketches, "when to use this method", "why pick this
 * fat", and per-recipe default values) is intentionally separate, keyed by
 * preset id. If a preset id is added to models.ts without a matching entry
 * here, the wizard falls back to a generic string so the UI never breaks;
 * `__tests__/wizardPresets.test.ts` asserts that every current preset id
 * DOES have a curated entry so a new id added to models.ts will fail tests
 * until curated prose is provided.
 */
import {
  DECARB_METHODS,
  EDIBLE_FORMATS,
  type EdibleFormat,
  INFUSION_FATS,
  type PresetFat,
  type PresetMethod,
} from './models'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Wizard-facing recipe card. Derived from EdibleFormat + curated prose. */
export interface WizardRecipe {
  /** Preset id (matches EdibleFormat.id) */
  id: string
  /** Short label for the card title */
  label: string
  /** Suggested serving count (override or pass-through) */
  suggestedServings: number
  /** 1–2 sentence real-world recipe sketch */
  humanRecipe: string
}

/** Wizard-facing decarb method card. Derived from PresetMethod + curated prose. */
export interface DecarbMethodCard {
  /** Preset id (matches PresetMethod.id) */
  id: string
  /** Card title */
  label: string
  /** Temperature in °C (copied from source) */
  tempC: number
  /** Minimum time in minutes (copied from source) */
  timeMin: number
  /** Maximum time in minutes (copied from source) */
  timeMax: number
  /** Decarb efficiency range (copied from source) */
  efficiency: { low: number; expected: number; high: number }
  /** Terpene retention label (copied from source) */
  terpeneLabel: string
  /** CBN formation risk label (copied from source) */
  cbnLabel: string
  /** 1 sentence explaining when this method is the right call */
  humanNote: string
}

/** Wizard-facing carrier-fat card. Derived from PresetFat + curated prose. */
export interface FatCard {
  /** Preset id (matches PresetFat.id) */
  id: string
  /** Card title */
  label: string
  /** Extraction efficiency [0.0, 1.0] (copied from source) */
  extractionEff: number
  /** 1 sentence about why you'd pick this fat */
  humanNote: string
}

/** Minimum-viable defaults the wizard can pre-fill when a recipe is picked. */
export interface WizardRecipeDefaults {
  /** Starting flower weight in grams */
  grams: number
  /** Starting THCA percentage */
  thcaPct: number
  /** Starting serving count */
  servings: number
}

/** Result of `suggestionsForRecipe`. */
export interface WizardRecipeSuggestion {
  defaults: WizardRecipeDefaults
  /** Recipe-specific tips to show alongside the defaults */
  notes: string[]
}

// ---------------------------------------------------------------------------
// Lifted constants — these replace the hardcoded values in
// FirstTimerGuide.tsx. ui-tabs can import these and rewire the wizard.
// ---------------------------------------------------------------------------

// TODO(citation): FIRST_TIMER_* constants below are carry-overs from
// FirstTimerGuide.tsx — see research/academic-references.md audit row #55.
// Each value derives from an already-audited source:
//   - FIRST_TIMER_DECARB_EFF  → DECARB_METHODS['oven_sealed'].efficiency.expected (row #19)
//   - FIRST_TIMER_FAT_EFF     → INFUSION_FATS['coconut'].extractionEff (row #18)
//   - FIRST_TIMER_DEFAULT_SERVINGS → midpoint of EDIBLE_FORMATS['brownie_8x8'] and ['brownie_9x13'] (row #22)
//   - FIRST_TIMER_DEFAULT_GRAMS / THCA_PCT → home-cook engineering defaults; no peer-reviewed source
// wizardPresets.test.ts asserts the first three stay in sync with the source rows.

/**
 * The decarb efficiency the first-timer wizard uses for its running example
 * (matches `DECARB_METHODS['oven_sealed'].efficiency.expected` = 0.93).
 */
export const FIRST_TIMER_DECARB_EFF = 0.93

/**
 * The infusion-fat efficiency the first-timer wizard uses for its running
 * example (matches `INFUSION_FATS['coconut'].extractionEff` = 0.82).
 */
export const FIRST_TIMER_FAT_EFF = 0.82

/**
 * Default serving count the first-timer wizard starts with for the "dose"
 * step. Sits between `brownie_8x8` (12) and `brownie_9x13` (18) so the
 * example dose calculation lands in the "low/moderate" range for typical
 * flower potency.
 */
export const FIRST_TIMER_DEFAULT_SERVINGS = 16

/**
 * Default grams + THCA% the first-timer wizard starts with. 3.5 g is a
 * typical "eighth" starter batch; 20% THCA is mid-shelf flower.
 */
export const FIRST_TIMER_DEFAULT_GRAMS = 3.5
export const FIRST_TIMER_DEFAULT_THCA_PCT = 20

// ---------------------------------------------------------------------------
// Curated prose maps
// ---------------------------------------------------------------------------

// TODO(citation): humanRecipe prose below is culinary / home-cook guidance,
// not from a peer-reviewed source. See research/academic-references.md
// audit row #51.
const RECIPE_HUMAN_RECIPE: Record<string, string> = {
  brownie_9x13:
    'Classic 9×13 pan of baked brownies. Stir your infused butter or coconut oil into the batter 1-for-1 in place of the recipe fat, bake at about 350°F (175°C) for 25–30 minutes, and let cool fully before cutting so the dose distributes evenly.',
  brownie_8x8:
    'Thicker 8×8 brownie pan — fewer, more potent pieces. Same workflow as the 9×13 pan; cut into 9–12 squares instead of 18.',
  gummy_80:
    'Silicone 80-cavity gummy mold. Bloom gelatin in cold liquid, melt with infused MCT oil while keeping the mixture below 82°C (180°F) so the THC does not degrade, then pipette into the cavities.',
  gummy_160:
    'Double-row 160-cavity mold for higher-volume runs. Same low-heat gelatin workflow as the 80-cavity mold; each cavity is roughly half the dose.',
  capsule_00:
    'Size 00 gelatin capsules filled with infused MCT oil using a capsule-filling tray. Most precise per-piece dose, most discreet to store, longest shelf life.',
  custom:
    'Pick this when you already know your batch size. Enter grams, THCA percentage, and serving count manually to match whatever you are actually making.',
}

// TODO(citation): humanNote prose below for decarb methods is decision-support
// framing for a first-timer; not from a peer-reviewed source. The temperatures
// and efficiencies themselves come from DECARB_METHODS (see audit row #19).
// See research/academic-references.md audit row #52.
const DECARB_METHOD_HUMAN_NOTE: Record<string, string> = {
  sv_dry:
    'Pick this when you want near-maximum conversion with the highest terpene retention and only have a sous vide circulator available.',
  sv_combined:
    'Pick this when you are decarbing and infusing in the same bag — the longer lower-temp run preserves cannabinoids already dissolved in the fat.',
  sv_fast:
    'Pick this when you want a quick, near-maximum conversion and do not mind giving up a bit of terpene character.',
  sv_lowtemp:
    'Pick this when flavor matters most — you will sacrifice some conversion for the best terpene preservation of any method.',
  oven_sealed:
    'Pick this for a familiar kitchen workflow with no special gear; the foil seal keeps enough vapor in to retain most of the terpenes.',
  oven_open:
    'Pick this only when speed matters more than flavor — fastest conversion, but you lose the most terpenes and risk CBN formation.',
}

// TODO(citation): humanNote prose below for carrier fats is decision-support
// framing for a first-timer; not from a peer-reviewed source. The extraction
// efficiencies themselves come from INFUSION_FATS (see audit row #18).
// See research/academic-references.md audit row #53.
const FAT_HUMAN_NOTE: Record<string, string> = {
  ghee: 'Pick ghee for brownies or any baked good — high smoke point, rich flavor, and excellent cannabinoid solubility.',
  coconut:
    'Pick coconut oil for solid-at-room-temperature end products like capsules or candy; mild coconut aroma.',
  mct: 'Pick MCT for tinctures, capsules, or gummies — neutral flavor, stays liquid at room temperature, highest extraction efficiency.',
  custom:
    'Pick custom when you have your own carrier fat; you will set the extraction efficiency yourself.',
}

// TODO(citation): per-recipe defaults (grams, thcaPct, servings) below are
// home-cook starter-batch heuristics, not from a peer-reviewed source. See
// research/academic-references.md audit row #54.
const RECIPE_DEFAULTS: Record<
  string,
  { defaults: WizardRecipeDefaults; notes: string[] }
> = {
  brownie_9x13: {
    defaults: { grams: 3.5, thcaPct: 20, servings: 18 },
    notes: [
      'Most 9×13 brownie mixes call for ½ cup (1 stick) of butter or ½ cup of oil — substitute your infused fat 1-for-1.',
      'Stir the infused fat in last so the batter stays cool; very hot batter can flash off terpenes.',
    ],
  },
  brownie_8x8: {
    defaults: { grams: 3.5, thcaPct: 20, servings: 12 },
    notes: [
      'Same workflow as the 9×13 pan; fewer pieces means each serving carries more THC.',
      'A water bath in the oven (set the pan inside a larger pan of hot water) keeps the bake below 100°C and protects THC.',
    ],
  },
  gummy_80: {
    defaults: { grams: 1.5, thcaPct: 18, servings: 80 },
    notes: [
      'Keep the gelatin-and-oil mixture under 82°C (180°F) at all times — above that THC starts to degrade.',
      'A 3 mL pipette or squeeze bottle makes filling 80 cavities much faster than pouring.',
    ],
  },
  gummy_160: {
    defaults: { grams: 2.5, thcaPct: 18, servings: 160 },
    notes: [
      'Same low-heat workflow as the 80-cavity mold; smaller cavities mean roughly half the dose per piece.',
      'Coat finished gummies lightly with a citric-acid-and-sugar dusting so they do not stick together in storage.',
    ],
  },
  capsule_00: {
    defaults: { grams: 3.5, thcaPct: 22, servings: 24 },
    notes: [
      'MCT stays liquid at room temperature, which makes filling 24+ capsules much easier than solid coconut oil.',
      'A capsule-filling tray takes the tedium out of the run; hand-filling is fine for 10 caps but painful beyond that.',
    ],
  },
  custom: {
    defaults: {
      grams: FIRST_TIMER_DEFAULT_GRAMS,
      thcaPct: FIRST_TIMER_DEFAULT_THCA_PCT,
      servings: FIRST_TIMER_DEFAULT_SERVINGS,
    },
    notes: [
      'These are just starter numbers — change any of them to match what you are actually making.',
      'A kitchen scale and a rough THCA percentage are enough to get a useful estimate; you can always re-cut the batch later.',
    ],
  },
}

// ---------------------------------------------------------------------------
// Fallback prose (used if a preset id is added to models.ts without a
// curated entry here). Keeps the UI from crashing on an unknown id.
// ---------------------------------------------------------------------------

const FALLBACK_HUMAN_RECIPE =
  'Recipe sketch not yet provided for this format. Treat the defaults below as a generic edible and adjust to your batch.'

const FALLBACK_METHOD_HUMAN_NOTE =
  'Decision guidance not yet provided for this method. Use the temperature and time shown on the card as-is.'

const FALLBACK_FAT_HUMAN_NOTE =
  'Decision guidance not yet provided for this fat. Use the extraction efficiency shown on the card as-is.'

const FALLBACK_RECIPE_NOTES: string[] = [
  'No recipe-specific tips yet for this format. The generic defaults below are a reasonable starting point.',
]

// ---------------------------------------------------------------------------
// Derived arrays (built once at module load)
// ---------------------------------------------------------------------------

/**
 * Short labels for the wizard recipe cards. We strip the parenthetical from
 * the long EdibleFormat.name (e.g. "Brownie (9×13 pan, 12-24 servings)" →
 * "Brownie") so the card titles stay compact. If models.ts changes the name,
 * this strip falls through to the full name rather than throwing.
 */
function _shortLabel(fmt: EdibleFormat): string {
  const parenIdx = fmt.name.indexOf(' (')
  return parenIdx > 0 ? fmt.name.slice(0, parenIdx) : fmt.name
}

// TODO(citation): see audit row #51 — recipe sketches / labels are home-cook
// framing, not peer-reviewed.
export const WIZARD_RECIPES: readonly WizardRecipe[] = EDIBLE_FORMATS.map(
  (fmt): WizardRecipe => ({
    id: fmt.id,
    label: _shortLabel(fmt),
    suggestedServings: fmt.suggestedServings,
    humanRecipe: RECIPE_HUMAN_RECIPE[fmt.id] ?? FALLBACK_HUMAN_RECIPE,
  })
)

// TODO(citation): see audit rows #19, #52 — temperatures and efficiencies
// are inherited from DECARB_METHODS (already TODO-flagged at row #19); the
// humanNote prose is engineering decision-support (audit row #52).
export const DECARB_METHOD_CARDS: readonly DecarbMethodCard[] =
  DECARB_METHODS.map(
    (m: PresetMethod): DecarbMethodCard => ({
      id: m.id,
      label: m.name,
      tempC: m.tempC,
      timeMin: m.timeMin,
      timeMax: m.timeMax,
      efficiency: m.efficiency,
      terpeneLabel: m.terpeneLabel,
      cbnLabel: m.cbnLabel,
      humanNote: DECARB_METHOD_HUMAN_NOTE[m.id] ?? FALLBACK_METHOD_HUMAN_NOTE,
    })
  )

// TODO(citation): see audit rows #18, #53 — extraction efficiencies are
// inherited from INFUSION_FATS (already TODO-flagged at row #18); the
// humanNote prose is engineering decision-support (audit row #53).
export const FAT_CARDS: readonly FatCard[] = INFUSION_FATS.map(
  (f: PresetFat): FatCard => ({
    id: f.id,
    label: f.name,
    extractionEff: f.extractionEff,
    humanNote: FAT_HUMAN_NOTE[f.id] ?? FALLBACK_FAT_HUMAN_NOTE,
  })
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lookup a curated recipe card by id. Returns null if no recipe exists for
 * the given id (so the wizard can render an explicit "not found" state
 * rather than crashing).
 */
export function getWizardRecipe(id: string): WizardRecipe | null {
  return WIZARD_RECIPES.find(r => r.id === id) ?? null
}

/**
 * Lookup a curated decarb method card by id. Returns null if not found.
 */
export function getDecarbMethodCard(id: string): DecarbMethodCard | null {
  return DECARB_METHOD_CARDS.find(m => m.id === id) ?? null
}

/**
 * Lookup a curated fat card by id. Returns null if not found.
 */
export function getFatCard(id: string): FatCard | null {
  return FAT_CARDS.find(f => f.id === id) ?? null
}

// TODO(citation): per-recipe defaults are engineering heuristics — see
// research/academic-references.md audit row #54.
export function suggestionsForRecipe(
  recipeId: string
): WizardRecipeSuggestion | null {
  const curated = RECIPE_DEFAULTS[recipeId]
  const recipe = getWizardRecipe(recipeId)
  if (!recipe) return null

  if (curated) {
    return {
      defaults: { ...curated.defaults },
      notes: [...curated.notes],
    }
  }

  // Generic fallback: serve-count from the recipe, generic grams/thca, and
  // a fallback note. Keeps the wizard functional when a new preset id is
  // added to models.ts without curated defaults yet.
  return {
    defaults: {
      grams: FIRST_TIMER_DEFAULT_GRAMS,
      thcaPct: FIRST_TIMER_DEFAULT_THCA_PCT,
      servings: recipe.suggestedServings,
    },
    notes: [...FALLBACK_RECIPE_NOTES],
  }
}
