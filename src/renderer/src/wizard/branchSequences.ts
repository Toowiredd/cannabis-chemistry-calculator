/**
 * Branch sequences — `branches[branchId] = [steps]`.
 *
 * Per the architecture doc §3.1, the wizard starts with the
 * product-type step (shared across all branches), then continues
 * with branch-specific steps. Week 1 ships:
 *  - flower: [productTypeStep, flowerMethodStep]
 *  - everything else: [productTypeStep, comingSoonStep]
 *
 * Week 2+ will replace the `comingSoonStep` with the real branch
 * steps per §3.1 (Potency → Carrier → Volume → Servings → Start
 * for concentrate, Color → Carrier → Volume → Servings → Start
 * for AVB, etc.).
 */
import { comingSoonStep, flowerMethodStep, productTypeStep } from './steps'
import type { WizardBranchId, WizardStep } from './wizardTypes'

export const BRANCH_SEQUENCES: Record<WizardBranchId, readonly WizardStep[]> = {
  flower: [productTypeStep, flowerMethodStep],
  concentrate: [productTypeStep, comingSoonStep],
  avb: [productTypeStep, comingSoonStep],
  edible: [productTypeStep, comingSoonStep],
  topical: [productTypeStep, comingSoonStep],
}

/**
 * Get the step sequence for a branch. Returns `null` if the
 * branch ID is unknown (defensive — should never happen because
 * `WizardBranchId` is a closed union, but the runtime is more
 * forgiving than the type).
 */
export function getBranchSequence(
  branch: WizardBranchId | null
): readonly WizardStep[] | null {
  if (branch === null) {
    // No branch picked yet — the product-type step is shown
    // alone (no branch sequence). The WizardScreen renders the
    // product-type step directly when `state.branch === null`.
    return null
  }
  return BRANCH_SEQUENCES[branch] ?? null
}
