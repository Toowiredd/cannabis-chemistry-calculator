/**
 * Stage 2 execution step sequence builder.
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §4.2, Stage 2 is the
 * "do the work" surface: a vertical stepper that walks the user
 * through the actual batch (preheat, timer, heatmap, transition,
 * completion). The stepper is generic — it accepts a list of
 * `ExecutionStep` rows and renders the matching shell. This file
 * is the *builder* that turns the Stage 1 wizard's branch +
 * selections into the concrete list of steps the stepper should
 * render for that batch.
 *
 * Why a separate builder:
 *  - The ExecutionStepper is owned by design-system; the data
 *    flow (engine → stepper) is owned by ui-tabs. Keeping the
 *    builder next to the wizard types and branch sequences means
 *    the Stage 1 → Stage 2 mapping is one cohesive unit.
 *  - The builder is pure (input: branch + selections, output:
 *    step list). Pure functions are trivial to test and to re-use
 *    from the test harness (the Stage 2 transition test calls
 *    `buildExecutionSteps` directly to assert the expected step
 *    list for each method).
 *
 * Week 3 (this commit) scope:
 *  - Flower branch: 2 steps — `preheat-decarb` + `heatmap-decarb`.
 *    The target temp + duration are sourced from the engine's
 *    `DECARB_METHODS` table via the picked method id.
 *  - All other branches: empty array. Their step definitions
 *    land in weeks 4-6 per the build order.
 *
 * The `isCurrent` + `isComplete` fields on each step are
 * intentionally left as `false` in the builder. The WizardScreen
 * (the consumer) overwrites them from the store's `execution`
 * slice on every render. Keeping the builder pure of execution
 * state means a re-render of the wizard that doesn't change
 * selections produces a stable step list, and the store is the
 * single source of truth for "what step is the user on".
 */
import { DECARB_METHODS, type PresetMethod } from '../engine/models'
import type { ExecutionStep } from '../components/ExecutionStepper'
import type { WizardBranchId, WizardSelections } from './wizardTypes'

/**
 * Stable step IDs for the Week 3 Flower decarb steps. The
 * `execution` slice's `currentStepId` references these strings;
 * they MUST match the `id` field on the rows returned by
 * `buildExecutionSteps` exactly (the store's defensive guard
 * `currentStepId !== stepId` would otherwise reject every
 * advance dispatch).
 */
export const STAGE2_STEP_IDS = {
  preheatDecarb: 'preheat-decarb',
  heatmapDecarb: 'heatmap-decarb',
} as const

/**
 * Look up a decarb method by its engine id. The `id` field on
 * `DECARB_METHODS` is the canonical source for method ids (see
 * `engine/models.ts`); the wizard's `selections.method` stores
 * one of these ids verbatim. Returns `undefined` for unknown
 * ids (defensive — the engine IDs are a closed set today but
 * the wizard's `selections.method` is typed as `string`).
 */
function lookupDecarbMethod(id: string | undefined): PresetMethod | undefined {
  if (!id) return undefined
  return DECARB_METHODS.find(m => m.id === id)
}

/**
 * Build the Stage 2 execution step list for a given branch +
 * selections. The order of the returned array is the order the
 * stepper renders them in (the stepper preserves input order
 * within a phase).
 *
 * For Week 3 only the Flower branch has Stage 2 steps. Other
 * branches return `[]`; the stepper renders the
 * `execution-stepper-empty` state ("No steps to run") for an
 * empty list, which is the desired behaviour when the user
 * finishes a branch whose Stage 2 work hasn't been defined yet
 * (the build order in the architecture doc §7 schedules the
 * remaining branches for weeks 4-6).
 *
 * Defensive: if the Flower branch is asked for its Stage 2
 * steps but no method has been selected yet (a malformed
 * flow — the Method step is required in the Flower branch
 * per §3.1), the builder returns an empty array rather than
 * fabricating a method. The store's `beginExecution` action
 * is still the entry point; an empty list just means the
 * stepper shows the empty state and the user can re-edit
 * their config.
 */
export function buildExecutionSteps(
  branch: WizardBranchId,
  selections: WizardSelections
): ExecutionStep[] {
  if (branch !== 'flower') {
    // Week 3: only the Flower branch has Stage 2 work. The
    // other branches' step definitions land in weeks 4-6.
    return []
  }
  const method = lookupDecarbMethod(selections.method)
  if (!method) {
    // Flower without a method is unreachable via the normal
    // wizard flow (the Method step is always shown), but be
    // defensive: an empty list is preferable to a fabricated
    // step with bogus temperature / duration values.
    return []
  }
  // The preheat step is the canonical "set up the equipment"
  // affordance for the decarb (§4.1 "Pre-action"). Target
  // temp + duration come straight from the engine's method
  // entry — the engine is the source of truth for both
  // numbers, the wizard never re-derives them.
  const preheatStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.preheatDecarb,
    title: 'Preheat oven',
    phase: 'decarb',
    shell: 'preheat',
    targetTemp: method.tempC,
    duration: `${method.timeMin} min`,
    isCurrent: false,
    isComplete: false,
  }
  // The heatmap step is the canonical "watch the work"
  // affordance for the decarb (§4.1 "Visual state"). The
  // initial `currentTemp` mirrors the `targetTemp` — at the
  // start of the decarb window the oven is at temperature and
  // the heatmap is "at steady state". The progress bar starts
  // at 0 and ticks up as the engine integration lands in
  // week 4.
  const heatmapStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.heatmapDecarb,
    title: 'Decarb heatmap',
    phase: 'decarb',
    shell: 'heatmap',
    targetTemp: method.tempC,
    currentTemp: method.tempC,
    progressPct: 0,
    material: 'flower',
    isCurrent: false,
    isComplete: false,
  }
  return [preheatStep, heatmapStep]
}
