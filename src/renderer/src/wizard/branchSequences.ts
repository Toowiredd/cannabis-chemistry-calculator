/**
 * Branch sequences — `branches[branchId] = [steps]`.
 *
 * Per the architecture doc §3.1, the wizard starts with the
 * product-type step (shared across all branches), then continues
 * with branch-specific steps. The 5 branches per §3.1:
 *
 *  - flower:      Method → Container → Weight → Efficiency →
 *                 (optional: Fat → Volume) → Start
 *  - concentrate: Potency → Carrier → Volume → Servings → Start
 *  - avb:         Color → Carrier → Volume → Servings → Start
 *  - edible:      Method → Container → Weight → Fat → Volume →
 *                 Servings → Start
 *  - topical:     Carrier → Volume → ApplicationArea → Start
 *
 * Each branch sequence is the full ordered list. Smart-skip is
 * applied at runtime by `getEffectiveBranchSequence(branch,
 * state)`, which filters out steps whose `skipIf(state)` returns
 * true. The sequence definitions below are the canonical
 * "everything that could appear" — the smart-skip is dynamic.
 *
 * Smart-skip rules per the brief (Week 2):
 *  - `Method` step: in the concentrate / avb / topical branch
 *    sequences, the Method step is simply absent (the user has
 *    no decarb to do). No runtime `skipIf` is needed.
 *  - `Fat` step (Flower branch only): the user is asked "do you
 *    want to infuse?" via a 'none' tile that sets
 *    `selections.fat = null`. The Fat step itself is always
 *    shown in the Flower branch; the Volume step downstream
 *    skips when `selections.fat === null` (see `volumeStep`).
 *  - `Volume` step: skipped in the Flower branch when the user
 *    picked the "no infusion" tile (see `volumeStep.skipIf`).
 *  - `Servings` step: skipped in the Topical branch — topicals
 *    are applied as-needed, not divided into per-piece doses
 *    (see `servingsStep.skipIf`).
 */
import {
  applicationAreaStep,
  carrierStep,
  colorStep,
  containerStep,
  efficiencyStep,
  fatStep,
  flowerMethodStep,
  potencyStep,
  productTypeStep,
  servingsStep,
  startStep,
  volumeStep,
  weightStep,
} from './steps'
import type { WizardBranchId, WizardState, WizardStep } from './wizardTypes'

/* ------------------------------------------------------------------ */
/* Branch sequences (canonical, pre-smart-skip)                        */
/* ------------------------------------------------------------------ */

export const BRANCH_SEQUENCES: Record<WizardBranchId, readonly WizardStep[]> = {
  // Flower: decarb + optional infusion + start.
  // Container / Weight / Efficiency are required; Fat / Volume
  // are optional via the "No infusion" tile on the Fat step.
  flower: [
    productTypeStep,
    flowerMethodStep,
    containerStep,
    weightStep,
    efficiencyStep,
    fatStep,
    volumeStep,
    startStep,
  ],
  // Concentrate: skip decarb entirely. The Method step is
  // absent from this sequence.
  concentrate: [
    productTypeStep,
    potencyStep,
    carrierStep,
    volumeStep,
    servingsStep,
    startStep,
  ],
  // AVB: already decarbed (skip Method). Color → Carrier →
  // Volume → Servings.
  avb: [
    productTypeStep,
    colorStep,
    carrierStep,
    volumeStep,
    servingsStep,
    startStep,
  ],
  // Edible: decarb + infuse + dose. Fat is required (the
  // "No infusion" tile is Flower-only).
  edible: [
    productTypeStep,
    flowerMethodStep,
    containerStep,
    weightStep,
    fatStep,
    volumeStep,
    servingsStep,
    startStep,
  ],
  // Topical: infusion only, no decarb, no servings (topicals
  // are applied as-needed).
  topical: [
    productTypeStep,
    carrierStep,
    volumeStep,
    applicationAreaStep,
    startStep,
  ],
}

/* ------------------------------------------------------------------ */
/* Smart-skip helper (§3.1)                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve the step sequence for a branch, applying smart-skip
 * to filter out steps whose `skipIf(state)` returns true. This
 * is the runtime view: it returns the steps the user actually
 * sees given their current selections.
 *
 * The canonical `BRANCH_SEQUENCES` table stays untouched — the
 * smart-skip is a pure projection that the wizard's `currentStep`
 * index is computed against.
 *
 * Returns `null` if the branch ID is unknown (defensive — should
 * never happen because `WizardBranchId` is a closed union, but
 * the runtime is more forgiving than the type).
 */
export function getEffectiveBranchSequence(
  branch: WizardBranchId | null,
  state: WizardState
): readonly WizardStep[] | null {
  if (branch === null) {
    // No branch picked yet — the product-type step is shown
    // alone. Smart-skip is a no-op here.
    return [productTypeStep]
  }
  const canonical = BRANCH_SEQUENCES[branch]
  if (!canonical) return null
  return canonical.filter(step => !step.skipIf?.(state))
}

/**
 * Legacy `getBranchSequence` — returns the canonical (pre-skip)
 * sequence. Kept for callers that need the unfiltered list
 * (e.g. the test that asserts each branch's step ordering
 * before smart-skip is applied). New callers should prefer
 * `getEffectiveBranchSequence`.
 */
export function getBranchSequence(
  branch: WizardBranchId | null
): readonly WizardStep[] | null {
  if (branch === null) {
    return null
  }
  return BRANCH_SEQUENCES[branch] ?? null
}
