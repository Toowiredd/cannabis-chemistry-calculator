/**
 * Wizard flow — the dynamic `getNextStep` DAG.
 *
 * 2026-07-28 (refactor): the wizard's step sequence is no
 * longer per-branch. The old `BRANCH_SEQUENCES` table mapped
 * each of the 5 starting-material branches to a hardcoded
 * ordered list of steps; the Material step now lives in ALL 5
 * branches (the user can pick any material for any end
 * product), so a per-branch table would have to enumerate 5
 * end products × 3 materials = 15 paths. The DAG collapses
 * the 15 paths into one function: read the user's
 * `(endProduct, branch, selections)` and return the next step
 * id, OR `'start'` when the user is on the terminal step.
 *
 * DAG rules (from the user, 2026-07-27):
 *  - product-type is always first
 *  - material is always second
 *  - method appears only if material=flower (raw flower
 *    needs decarb)
 *  - efficiency appears only if material=flower (AVB already
 *    extracted, concentrate already active)
 *  - color appears only if material=avb (proxy for residual
 *    THC)
 *  - potency appears only if material=concentrate
 *  - container + weight are always required (the user is
 *    decarbing or infusing some amount of something)
 *  - fat appears for end products baked/gummies/capsules
 *    (need infusion into a fat)
 *  - carrier appears for end products tincture/salve
 *    (dissolve into a liquid)
 *  - volume is always required when infusion is in scope
 *    (skipped when the user picked the "no infusion" tile on
 *    the Fat step)
 *  - servings appears for baked/gummies/capsules/tincture,
 *    NOT for salve
 *  - app-area appears only for salve
 *  - name is always required
 *  - start is the terminal step
 *
 * The DAG is the single source of truth for "what step is the
 * user on right now". The wizard's `currentStepId` is whatever
 * `getNextStep(state)` returns on every render (after each
 * `onSelect`, the new state is passed through `getNextStep` to
 * compute the next id).
 *
 * `null` return is reserved for "the wizard is finished" (the
 * user has tapped Begin batch on the Start step and Stage 2 is
 * mounted). The DAG itself never returns `null` — the wizard
 * is "finished" when the Begin batch handler runs
 * `currentStepId = null` directly.
 */
import type { WizardState, WizardStepId } from './wizardTypes'

/**
 * Returns the next step id given the current wizard state, OR
 * `'start'` when the user is on the terminal step (the Begin
 * batch CTA). The DAG never returns `null` — that is reserved
 * for the post-Begin-batch state (the wizard is finished and
 * the Stage 2 stepper is mounted).
 */
export function getNextStep(state: WizardState): WizardStepId {
  if (!state.endProduct) return 'product-type'
  if (!state.branch) return 'material'
  if (state.branch === 'flower' && !state.selections.method) return 'method'
  if (!state.selections.container) return 'container'
  if (!state.selections.weight) return 'weight'
  if (state.branch === 'flower' && state.selections.efficiency === undefined)
    return 'efficiency'
  if (state.branch === 'avb' && !state.selections.color) return 'color'
  if (state.branch === 'concentrate' && state.selections.potency === undefined)
    return 'potency'
  // Fat or carrier depending on end product. The end
  // product drives the infusion-side decisions (fat vs
  // carrier, servings vs app-area) — material drives the
  // decarb-side decisions above.
  const isEdible =
    state.endProduct === 'baked' ||
    state.endProduct === 'gummies' ||
    state.endProduct === 'capsules'
  const isTincture = state.endProduct === 'tincture'
  const isSalve = state.endProduct === 'salve'
  if (isEdible && state.selections.fat === undefined) return 'fat'
  if ((isTincture || isSalve) && !state.selections.carrier) return 'carrier'
  // The "no infusion" path: when the user picked the
  // 'none' tile on the Fat step (`selections.fat === null`),
  // volume and servings are skipped — the user is just
  // decarbing without infusing into a fat. The brief-mandated
  // sentinel per §3.1.
  const noInfusion = state.selections.fat === null
  if (!noInfusion && !state.selections.volume) return 'volume'
  if (!noInfusion && (isEdible || isTincture) && state.selections.servings === undefined)
    return 'servings'
  if (isSalve && !state.selections.applicationArea) return 'app-area'
  if (!state.selections.name) return 'name'
  return 'start'
}

/**
 * Returns true when the wizard is on the terminal Start step
 * (the Begin batch CTA is visible). Equivalent to
 * `getNextStep(state) === 'start'` but reads more naturally
 * in the screen's render block.
 */
export function isOnStartStep(state: WizardState): boolean {
  return getNextStep(state) === 'start'
}

/**
 * Returns true when the user has finished the wizard — i.e.
 * the Begin batch CTA has been tapped and Stage 2 is mounted.
 * The wizard screen sets `currentStepId = null` after Begin
 * batch to mark this state.
 */
export function isFinished(state: WizardState): boolean {
  return state.currentStepId === null && !!state.endProduct && !!state.branch
}

/**
 * Returns true when the wizard should show the
 * "double-bag for sous vide?" interjection. Per Fix 6: the
 * interjection fires when
 *   1. material=flower
 *   2. method starts with `sv_` (the 4 sous vide methods)
 *   3. the user picked the 19cm bag (smaller bag = higher
 *      puncture risk for stems)
 * The interjection does NOT fire for the 28cm bag (large
 * enough that single-bag is fine) or for oven methods
 * (no puncturing risk).
 */
export function shouldRecommendDoubleBag(state: WizardState): boolean {
  if (state.branch !== 'flower') return false
  const method = state.selections.method
  if (!method || !method.startsWith('sv_')) return false
  return state.selections.containerWidthCm === 19
}
