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
import type { WizardSelections, WizardState, WizardStepId } from './wizardTypes'

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

/* ------------------------------------------------------------------ */
/* Step path (dynamic step counter)                                    */
/* ------------------------------------------------------------------ */

/**
 * Sentinel values used to "fill in" a step the user hasn't
 * answered yet so the DAG can walk forward. Each step id has
 * a dummy value that satisfies the DAG's "is this answered?"
 * guard (e.g. `state.selections.method` is a string, so any
 * non-empty string works). The dummy is NEVER shown to the
 * user — it's only used to compute the step path.
 */
const DUMMY_VALUES: Readonly<Record<string, unknown>> = {
  method: 'oven_sealed',
  container: 'vac-19',
  containerWidthCm: 19,
  weight: { value: 7, unit: 'g' as const },
  efficiency: 0.9,
  color: 'medium' as const,
  potency: 75,
  fat: 'ghee',
  carrier: 'mct',
  volume: { value: 240, unit: 'mL' as const },
  servings: 12,
  applicationArea: 'body',
  name: 'Dummy',
}

/**
 * Fill in a dummy value for the given step so the DAG can
 * walk past it. Returns a `Partial<WizardSelections>` patch.
 * Unknown step ids return an empty patch (defensive — the
 * DAG's 'product-type' and 'material' steps don't write to
 * `selections`; they write to `state.endProduct` and
 * `state.branch`).
 */
function dummyPatchFor(stepId: WizardStepId): Partial<WizardSelections> {
  switch (stepId) {
    case 'method':
      return { method: DUMMY_VALUES.method as string }
    case 'container':
      return {
        container: DUMMY_VALUES.container as string,
        containerWidthCm: DUMMY_VALUES.containerWidthCm as number,
      }
    case 'weight':
      return { weight: DUMMY_VALUES.weight as WizardSelections['weight'] }
    case 'efficiency':
      return { efficiency: DUMMY_VALUES.efficiency as number }
    case 'color':
      return { color: DUMMY_VALUES.color as 'light' | 'medium' | 'dark' }
    case 'potency':
      return { potency: DUMMY_VALUES.potency as number }
    case 'fat':
      return { fat: DUMMY_VALUES.fat as string }
    case 'carrier':
      return { carrier: DUMMY_VALUES.carrier as string }
    case 'volume':
      return { volume: DUMMY_VALUES.volume as WizardSelections['volume'] }
    case 'servings':
      return { servings: DUMMY_VALUES.servings as number }
    case 'app-area':
      return { applicationArea: DUMMY_VALUES.applicationArea as string }
    case 'name':
      return { name: DUMMY_VALUES.name as string }
    default:
      return {}
  }
}

/**
 * Returns the ordered list of step ids the user will walk
 * through for the current `(endProduct, branch)` combination.
 * The current step is `path[0]` (or whichever step the user
 * is currently on) and `path[path.length - 1]` is `'start'`
 * (the terminal "Begin batch" step).
 *
 * The path is computed by walking the DAG forward from a
 * "ghost" state — the current state with all unanswered
 * fields filled in with dummy values. This is the same
 * technique QuickBatchTab uses to compute the per-row
 * downstream of a partial selection. The dummy values are
 * local to this module and never escape to the user.
 *
 * Returns an empty array if the user is on the very first
 * step and hasn't picked anything yet (the wizard can't
 * know the total path length without `endProduct` and
 * `branch`).
 */
export function getStepPath(state: WizardState): WizardStepId[] {
  // If the user hasn't picked an end product, the only
  // known step is 'product-type'. The wizard can't
  // determine the total path without both endProduct and
  // branch, so return a single-element path.
  if (!state.endProduct) return ['product-type']
  if (!state.branch) return ['product-type', 'material']

  // From here, both endProduct and branch are set — we can
  // walk the DAG forward. Build a ghost state starting from
  // the user's actual selections, then fill in the rest with
  // dummies.
  const ghost: WizardState = {
    endProduct: state.endProduct,
    branch: state.branch,
    currentStepId: state.currentStepId,
    selections: { ...state.selections },
  }

  const path: WizardStepId[] = ['product-type', 'material']
  // Hard cap so a misbehaving DAG can't loop forever.
  for (let i = 0; i < 30; i++) {
    const next = getNextStep(ghost)
    if (path.includes(next)) break // safety: shouldn't happen
    path.push(next)
    if (next === 'start') break
    // Fill in a dummy so the DAG advances on the next iter.
    const patch = dummyPatchFor(next)
    ghost.selections = { ...ghost.selections, ...patch }
  }
  return path
}

/**
 * Returns `{ stepNumber, totalSteps }` for the wizard's
 * step counter. `stepNumber` is the 1-indexed position of
 * the current step in the path; `totalSteps` is the path
 * length.
 *
 * When the user is on the product-type step (endProduct
 * not yet set), returns `{ 1, 1 }` — the path isn't known
 * yet, so the counter just shows "1 / 1" until the user
 * picks an end product. When the user is on the material
 * step (endProduct set, branch not yet set), returns the
 * partial path (2 steps).
 *
 * This is the canonical source of truth for the counter
 * widget; the Wizard component reads from it on every
 * render.
 */
export function getStepCounter(
  state: WizardState
): { stepNumber: number; totalSteps: number } {
  const path = getStepPath(state)
  const currentStepId = state.currentStepId ?? getNextStep(state)
  const idx = path.indexOf(currentStepId)
  // The "current step" should always be in the path. If it
  // isn't (defensive — the DAG should always return a step
  // id that's in the path), fall back to "1 / N" so the
  // counter still renders something reasonable.
  if (idx < 0) {
    return { stepNumber: 1, totalSteps: path.length || 1 }
  }
  return { stepNumber: idx + 1, totalSteps: path.length }
}
