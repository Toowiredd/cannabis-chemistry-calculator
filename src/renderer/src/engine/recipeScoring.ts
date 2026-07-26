/**
 * Recipe scoring engine for SmartSuggest.
 * Pure TypeScript -- zero UI imports.
 */
import { EDIBLE_FORMATS } from './models'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface RecipeData {
  id: string
  name: string
  description: string
  idealMin: number
  idealMax: number
  maxThreshold: number
  formatId: string
  defaultServings: number
  recommendedFat: string | null
  tips: string[]
  difficulty: string
  duration: string
}

export interface ScoredRecipe extends RecipeData {
  score: number
  fatMatch: boolean
  isViable: boolean
}

/* ------------------------------------------------------------------ */
/* Recipe definitions                                                 */
/* ------------------------------------------------------------------ */

export const RECIPES: readonly RecipeData[] = [
  {
    id: 'brownies',
    name: 'Fudgy Brownies',
    description:
      'Classic baked brownies. Dense, chocolate-forward, and forgiving with fat-forward infusions like ghee or butter.',
    idealMin: 5,
    idealMax: 25,
    maxThreshold: 50,
    formatId: 'brownie_9x13',
    defaultServings: 18,
    recommendedFat: 'ghee',
    tips: [
      'Use a water bath in the oven to prevent THC degradation from direct high heat.',
      'A 9x13 pan cut into 18 pieces yields ~20 mg each with a typical infusion.',
      'Ghee or clarified butter provides the best cannabinoid solubility and a clean finish.',
      'Let brownies cool completely before cutting -- warm brownies will smear the dose distribution.',
    ],
    difficulty: 'Easy',
    duration: '45 min',
  },
  {
    id: 'gummies',
    name: 'Fruit Gummies',
    description:
      'Gelatin-based chewy candies. Easy to dose precisely and travel well. Heat-sensitive -- keep temps low.',
    idealMin: 2,
    idealMax: 15,
    maxThreshold: 25,
    formatId: 'gummy_80',
    defaultServings: 80,
    recommendedFat: null,
    tips: [
      'Never let the gelatin mixture exceed 82C (180F) or THC will degrade.',
      'Use a silicone mold on a level surface for even distribution.',
      'A 3mL pipette or squeeze bottle makes filling cavities much faster and cleaner.',
      'Coat with a light citric acid + sugar dusting to prevent sticking in storage.',
    ],
    difficulty: 'Medium',
    duration: '2 hrs',
  },
  {
    id: 'capsules',
    name: 'Oil Capsules',
    description:
      'Precise, discreet, and shelf-stable. Size 00 capsules hold roughly 0.7--0.9 mL of infused oil.',
    idealMin: 1,
    idealMax: 10,
    maxThreshold: 20,
    formatId: 'capsule_00',
    defaultServings: 24,
    recommendedFat: 'mct',
    tips: [
      'MCT oil stays liquid at room temp, making capsule filling much easier than solid coconut oil.',
      'Use a capsule filling machine tray -- hand-filling 24+ capsules is tedious.',
      'Store filled capsules in an amber glass jar away from light and heat.',
      'Label the jar with mg per capsule and the date of creation.',
    ],
    difficulty: 'Easy',
    duration: '30 min',
  },
  {
    id: 'tincture',
    name: 'Alcohol Tincture',
    description:
      'High-proof alcohol extraction. Long shelf life and very fast sublingual onset. Not compatible with oil-based fats.',
    idealMin: 2,
    idealMax: 20,
    maxThreshold: 40,
    formatId: 'custom',
    defaultServings: 30,
    recommendedFat: null,
    tips: [
      'Use 190-proof (95%) food-grade ethanol for best extraction efficiency.',
      'Freeze both the alcohol and the decarbed material before combining -- this reduces chlorophyll extraction.',
      'Shake the jar daily during the 2--4 week steep for even distribution.',
      'A 30mL glass dropper bottle with 1mL markings makes sublingual dosing predictable.',
    ],
    difficulty: 'Hard',
    duration: '3+ weeks',
  },
] as const

/* ------------------------------------------------------------------ */
/* Scoring                                                            */
/* ------------------------------------------------------------------ */

// TODO(citation): SmartSuggest ranking weights (70 / 30 / 15 / 15), the
// `*20` mg-distance scaling factor, and the `+10` inside-ideal-range bonus are
// engineering scoring heuristics; no peer-reviewed source defines these exact
// numbers. See research/academic-references.md audit rows #34–36.
const MG_WEIGHT = 70
const FAT_MATCH_WEIGHT = 30
const FAT_PARTIAL_WEIGHT = 15
const FAT_ANY_WEIGHT = 15

/**
 * Score a single recipe against current dose context.
 *
 * Scoring algorithm:
 * 1. Viability: mgPerServing must be > 0 and <= maxThreshold
 * 2. mgScore (0--70): based on how close mgPerServing is to the center
 *    of the recipe's ideal range.
 * 3. fatScore (0--30): exact match = 30, custom fat or "any" recipe = 15,
 *    mismatch = 0.
 * 4. Tie-breaker: fatMatch true > false, then smaller distance to ideal center.
 *
 * @param mgPerServing  Calculated mg per serving (must be >= 0)
 * @param fatId         Selected infusion fat id (e.g. 'ghee', 'custom')
 * @param recipe        Recipe data to score
 * @returns Scored recipe with numeric score and viability flags
 */
export function scoreRecipe(
  mgPerServing: number,
  fatId: string,
  recipe: RecipeData
): ScoredRecipe {
  const isViable =
    Number.isFinite(mgPerServing) &&
    mgPerServing > 0 &&
    mgPerServing <= recipe.maxThreshold

  if (!isViable) {
    return { ...recipe, score: 0, fatMatch: false, isViable: false }
  }

  const center = (recipe.idealMin + recipe.idealMax) / 2
  const halfRange = Math.max(1, (recipe.idealMax - recipe.idealMin) / 2)
  const dist = Math.abs(mgPerServing - center)
  let mgScore = Math.max(0, MG_WEIGHT - (dist / halfRange) * 20)

  // Bonus for being inside the ideal range
  if (mgPerServing >= recipe.idealMin && mgPerServing <= recipe.idealMax) {
    mgScore += 10
  }

  // Fat matching
  let fatScore = 0
  let fatMatch = false
  if (recipe.recommendedFat === null) {
    fatScore = FAT_ANY_WEIGHT
    fatMatch = true // any fat is acceptable for this recipe
  } else if (fatId === recipe.recommendedFat) {
    fatScore = FAT_MATCH_WEIGHT
    fatMatch = true
  } else if (fatId === 'custom') {
    fatScore = FAT_PARTIAL_WEIGHT
    fatMatch = false
  }

  const score = mgScore + fatScore

  return { ...recipe, score, fatMatch, isViable }
}

/**
 * Sort comparator for scored recipes.
 * Primary: descending score.
 * Tie-breaker 1: fatMatch true first.
 * Tie-breaker 2: smaller range tightness first.
 */
export function compareRecipes(a: ScoredRecipe, b: ScoredRecipe): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.fatMatch !== b.fatMatch) return a.fatMatch ? -1 : 1
  const aTightness = a.idealMax - a.idealMin
  const bTightness = b.idealMax - b.idealMin
  return aTightness - bTightness
}

/**
 * Score all recipes and return viable ones sorted by best match.
 *
 * @param mgPerServing  Calculated mg per serving
 * @param fatId         Selected infusion fat id
 * @returns Array of scored recipes, sorted best-first. Empty if dose exceeds all thresholds.
 */
export function scoreAllRecipes(
  mgPerServing: number,
  fatId: string
): ScoredRecipe[] {
  const scored = RECIPES.map(r => scoreRecipe(mgPerServing, fatId, r))
  const viable = scored.filter(r => r.isViable)
  viable.sort(compareRecipes)
  return viable
}

/**
 * Lookup an edible format name by id.
 */
export function formatName(formatId: string): string {
  const fmt = EDIBLE_FORMATS.find(f => f.id === formatId)
  return fmt?.name ?? formatId
}
