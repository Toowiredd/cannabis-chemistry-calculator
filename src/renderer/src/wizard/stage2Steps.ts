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
 * Build history:
 *  - Week 3 (commit 66c4818): 2 steps — `preheat-decarb` +
 *    `heatmap-decarb`. The preheat's `duration` was sourced from
 *    the method's `timeMin` for display only; the heatmap's
 *    `progressPct` was a placeholder `0` (the real per-second
 *    engine integration was a Week 4 deliverable).
 *  - Week 4: the Flower branch's Stage 2 path grew to 4 steps
 *    (preheat + heatmap + timer + transition). The completion
 *    step was still future scope per the §7 build order.
 *  - Week 5 (this commit): the Flower branch's Stage 2 path
 *    grows to 8 steps when an infusion is requested
 *    (`selections.fat` is a fat id) and stays at 4 steps when
 *    the Flower "no infusion" path is taken (`selections.fat ===
 *    null` per §3.1). Four new steps land after the decarb
 *    transition:
 *      5. `preheat-infusion` — preheat for the infusion
 *         carrier. `targetTemp` is `method.tempC - 13°C` clamped
 *         to `>= 60°C` (a 13°C drop from decarb preserves
 *         terpenes that already vaporised; clamping at 60°C
 *         avoids a sub-stovetop target for low-temp methods
 *         like `sv_lowtemp` at 73°C → 60°C). Duration is a
 *         static `'30 min'` — the infusion is a low-stakes
 *         simmer, not a precise decarb window.
 *      6. `timer-infusion` — the "active timer" shell for
 *         infusion. `totalSeconds: 1800` (30 min) and
 *         `stirIntervalSeconds: 600` (stir every 10 min). The
 *         stir cadence matches the §4.1 reminder affordance.
 *      7. `transition-infusion` — the transition shell teeing
 *         up the completion step.
 *      8. `completion` — the completion shell. `recipeName` and
 *         `computedTotals` are placeholders here; the consumer
 *         (WizardScreen) overwrites them from local state +
 *         engine output on every render. The builder stays
 *         pure of those derived values.
 *    The Flower "no infusion" path (fat === null) skips the
 *    infusion + transition-infusion + completion steps and ends
 *    at `transition-decarb` — the §3.1 smart-skip rule
 *    generalised to Stage 2: the user opted out of infusion,
 *    so there is no batch to save. The Week 4 §8.1 contract
 *    (re-edit flow) still works because the Stage 2 rows
 *    present in the no-infusion path are the same 4 decarb
 *    steps Week 4 already covered.
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
 * Stable step IDs for the Week 3 + Week 4 + Week 5 Flower decarb
 * + infusion + completion steps. The `execution` slice's
 * `currentStepId` references these strings; they MUST match the
 * `id` field on the rows returned by `buildExecutionSteps`
 * exactly (the store's defensive guard
 * `currentStepId !== stepId` would otherwise reject every
 * advance dispatch).
 */
export const STAGE2_STEP_IDS = {
  preheatDecarb: 'preheat-decarb',
  heatmapDecarb: 'heatmap-decarb',
  timerDecarb: 'timer-decarb',
  transitionDecarb: 'transition-decarb',
  preheatInfusion: 'preheat-infusion',
  timerInfusion: 'timer-infusion',
  transitionInfusion: 'transition-infusion',
  completion: 'completion',
  // Non-decarb branches (avb / concentrate / topical) get a
  // dedicated preheat step. The Flower / Edible branches use
  // the same `preheatInfusion` id but with the method-derived
  // temperature; the non-decarb branches use a static 80°C
  // for the carrier steep. Distinguishing the ids keeps the
  // ExecutionStepper's per-step re-edit flow clean — when the
  // user re-edits the preheat, the wizard knows whether the
  // previous value came from the decarb method or a static
  // branch default.
  preheatSteep: 'preheat-steep',
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
 * Per-branch default steep temperature for the non-decarb
 * branches (avb / concentrate / topical). The brief calls for
 * a low-temperature steep to preserve cannabinoids that have
 * already been activated:
 *  - AVB: ~80°C — the AVB is already decarbed; the steep is
 *    a 2-4 hour dissolve in the carrier (alcohol or oil).
 *  - Concentrate: ~80°C — the concentrate is already active;
 *    the steep is a 30-60 min dissolve in the carrier.
 *  - Topical: ~70°C — the topical is already decarbed; the
 *    steep is a 1-2 hour melt with the carrier (beeswax +
 *    oil). 70°C is well below the beeswax smoke point and
 *    preserves the topical's therapeutic cannabinoids.
 *
 * Each branch's preheat step renders this temp as the
 * `targetTemp`; the user can adjust it from the
 * execution stepper's "Adjust" affordance if their stovetop
 * runs hot or cold (the brief leaves that affordance as a
 * Week 7+ extension; the static default is the v1 contract).
 */
const STEEP_TEMP_BY_BRANCH: Partial<Record<WizardBranchId, number>> = {
  avb: 80,
  concentrate: 80,
  topical: 70,
}

/**
 * Per-branch steep duration (in seconds) for the non-decarb
 * branches. The brief's contract:
 *  - AVB: 2 hours (7200s) — long steep to maximise cannabinoid
 *    transfer from the already-vaped material into the carrier.
 *  - Concentrate: 45 min (2700s) — the concentrate dissolves
 *    quickly; longer steeps do not increase yield.
 *  - Topical: 1 hour (3600s) — the beeswax + oil needs time
 *    to fully incorporate the decarbed material.
 *
 * The Flower / Edible branches reuse `computeTimerTotalSeconds`
 * (derived from the picked method's `timeMin` / `timeMax`).
 */
const STEEP_SECONDS_BY_BRANCH: Partial<Record<WizardBranchId, number>> = {
  avb: 7200,
  concentrate: 2700,
  topical: 3600,
}

/**
 * Compute the timer's `totalSeconds` from a decarb method's
 * `timeMin`/`timeMax` range. The brief specifies the midpoint
 * (rounded) — that matches the brief's "typical" runtime
 * semantic and avoids the Week 3 placeholder of `timeMin`-only
 * (which under-represents the real-world runtime for most
 * methods, e.g. `oven_sealed`'s 60-90 min would otherwise be
 * capped at 60 min when the canonical "typical" is 75 min).
 *
 * Example: `oven_sealed` is `timeMin: 60, timeMax: 90` →
 *   midpoint = round((60+90)/2) = 75 min → 4500 seconds.
 * `oven_open` is `timeMin: 40, timeMax: 40` (single point)
 *   → midpoint = 40 min → 2400 seconds.
 *
 * Centralised as a free function so the Week 5+ infusion timer
 * can reuse it for the infusion / decarb-to-infusion handoff.
 */
function computeTimerTotalSeconds(method: PresetMethod): number {
  const midpointMin = Math.round((method.timeMin + method.timeMax) / 2)
  return Math.max(0, midpointMin) * 60
}

/**
 * Build the Stage 2 execution step list for a given branch +
 * selections. The order of the returned array is the order the
 * stepper renders them in (the stepper preserves input order
 * within a phase).
 *
 * Branches are partitioned per the §3.1 taxonomy:
 *  - `flower` + `edible` → `buildFlowerOrEdibleSteps`. The
 *    Flower branch supports a "no infusion" path
 *    (`selections.fat === null`) which short-circuits to 4
 *    decarb steps only. The Edible branch always requires a
 *    fat (the "No infusion" tile is Flower-only per the brief)
 *    and returns 8 steps.
 *  - `avb` + `concentrate` + `topical` → `buildNonDecarbSteps`.
 *    No decarb phase. A preheat-temp + timer shell + transition
 *    + completion. The 3 branches differ only in the static
 *    steep temp + duration (see `STEEP_TEMP_BY_BRANCH` +
 *    `STEEP_SECONDS_BY_BRANCH`).
 *  - Unknown branch id → empty list. Defensive; should be
 *    unreachable because `WizardBranchId` is a closed union
 *    and the wizard's branch selection routes through
 *    `BRANCH_SEQUENCES`.
 *
 * Week 5 update: the Flower branch's Stage 2 path is conditional
 * on `selections.fat`. The default Flower path (fat is a string
 * id — ghee / coconut / mct / custom) returns 8 steps: 4 decarb
 * steps (preheat + heatmap + timer + transition) + 4 infusion
 * + completion steps (preheat-infusion + timer-infusion +
 * transition-infusion + completion). The Flower "no infusion"
 * path (fat === null per §3.1) returns 4 steps: the decarb
 * steps only, ending at `transition-decarb`. The §3.1 smart-skip
 * rule that filters out the Volume step in Stage 1 generalises
 * to Stage 2: if the user opted out of infusion, there is no
 * batch to save, so the completion step doesn't render.
 *
 * Defensive: if the Flower / Edible branch is asked for its
 * Stage 2 steps but no method has been selected yet (a malformed
 * flow — the Method step is required in the Flower / Edible
 * branch per §3.1), the builder returns an empty array rather
 * than fabricating a method. The store's `beginExecution` action
 * is still the entry point; an empty list just means the
 * stepper shows the empty state and the user can re-edit
 * their config.
 */
export function buildExecutionSteps(
  branch: WizardBranchId,
  selections: WizardSelections
): ExecutionStep[] {
  if (branch === 'flower' || branch === 'edible') {
    return buildFlowerOrEdibleSteps(branch, selections)
  }
  if (branch === 'avb' || branch === 'concentrate' || branch === 'topical') {
    return buildNonDecarbSteps(branch, selections)
  }
  // Unknown branch — defensive. Should be unreachable because
  // `WizardBranchId` is a closed union and the wizard's branch
  // selection routes through `BRANCH_SEQUENCES`. An empty list
  // renders the "No steps to run" empty state, which is the
  // safe fallback.
  return []
}

/**
 * Flower + Edible branches both have a decarb phase (the
 * Edible branch shares the `flowerMethodStep` in the
 * `branchSequences.ts` definition) + an infusion phase +
 * completion. The Flower branch also supports a "no infusion"
 * path (`selections.fat === null`) which short-circuits to the
 * 4 decarb steps only. The Edible branch requires a fat — the
 * "No infusion" tile is Flower-only per the brief — so the
 * Edible path always returns 8 steps.
 *
 * Extracted as a helper so the main `buildExecutionSteps` is a
 * clean dispatch table (the §3.1 branch taxonomy is the
 * natural partition: with-decarb / without-decarb).
 */
function buildFlowerOrEdibleSteps(
  branch: 'flower' | 'edible',
  selections: WizardSelections
): ExecutionStep[] {
  const method = lookupDecarbMethod(selections.method)
  if (!method) {
    // Flower / Edible without a method is unreachable via the
    // normal wizard flow (the Method step is always shown), but
    // be defensive: an empty list is preferable to a fabricated
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
  // Week 4 — `timer-decarb` (the active-timer shell from §4.1).
  // The total duration is the midpoint of the engine's
  // `timeMin`/`timeMax` range, converted to seconds via
  // `computeTimerTotalSeconds` above (centralised so the
  // Week 5+ infusion timer can reuse it). The
  // `stirIntervalSeconds` is the halfway point of the total
  // — the "stir at the halfway mark" reminder. Both fields
  // are documented on the builder + the test file so a future
  // engineer can pin the values to the engine data without
  // guessing.
  const totalSeconds = computeTimerTotalSeconds(method)
  const stirIntervalSeconds = Math.floor(totalSeconds / 2)
  const timerStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.timerDecarb,
    title: 'Decarb timer',
    phase: 'decarb',
    shell: 'timer',
    totalSeconds,
    stirIntervalSeconds,
    isCurrent: false,
    isComplete: false,
  }
  // Week 4 — `transition-decarb` (the transition shell from
  // §4.1). The message tees up the (still future) infusion
  // phase; the completion step that would land after this one
  // is Week 5+ scope. The static string is intentional — the
  // Phase 4 §4.1 spec keeps the transition message terse so
  // the user reads it once and taps "Continue" without
  // context-switching into the engine state.
  const transitionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.transitionDecarb,
    title: 'Decarb complete',
    phase: 'transition',
    shell: 'transition',
    message: 'Decarb complete. Move to infusion →',
    isCurrent: false,
    isComplete: false,
  }
  // The brief's sentinel is `selections.fat === null` (the
  // §3.1 'none' tile on the Fat step). We ALSO treat
  // `undefined` the same way: a builder call with no `fat`
  // field at all (the user never reached the Fat step, e.g.
  // a §8.1 re-edit fast-forward or a pre-Week 5 persisted
  // state) should NOT suddenly gain an infusion phase +
  // completion step. The Week 3 + Week 4 tests assert the
  // 4-step shape for `{ method: 'oven_sealed' }` (no fat
  // field); preserving that shape for the no-fat case is
  // the §8.1 contract: the `recomputeFromEdit` action
  // re-stamps the same 4-step list, not a freshly-grown
  // 8-step list.
  if (selections.fat === null || selections.fat === undefined) {
    return [preheatStep, heatmapStep, timerStep, transitionStep]
  }
  const infusionTargetTemp = Math.max(60, method.tempC - 13)
  const preheatInfusionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.preheatInfusion,
    title: 'Preheat for infusion',
    phase: 'infusion',
    shell: 'preheat',
    targetTemp: infusionTargetTemp,
    duration: '30 min',
    isCurrent: false,
    isComplete: false,
  }
  const infusionTimerStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.timerInfusion,
    title: 'Infusion timer',
    phase: 'infusion',
    shell: 'timer',
    totalSeconds: 1800,
    stirIntervalSeconds: 600,
    isCurrent: false,
    isComplete: false,
  }
  const transitionInfusionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.transitionInfusion,
    title: 'Infusion complete',
    phase: 'transition',
    shell: 'transition',
    message: 'Infusion complete. Dose and save recipe →',
    isCurrent: false,
    isComplete: false,
  }
  const completionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.completion,
    title: 'Save recipe',
    phase: 'completion',
    shell: 'completion',
    recipeName: '',
    computedTotals: { thcMg: 0, cbdMg: 0, servings: 0 },
    isCurrent: false,
    isComplete: false,
  }
  return [
    preheatStep,
    heatmapStep,
    timerStep,
    transitionStep,
    preheatInfusionStep,
    infusionTimerStep,
    transitionInfusionStep,
    completionStep,
  ]
}

/**
 * Build the Stage 2 step list for the non-decarb branches
 * (AVB / Concentrate / Topical). The material is already
 * decarbed, so the Stage 2 path is:
 *  1. Preheat the carrier (low-temp, per branch default in
 *     `STEEP_TEMP_BY_BRANCH`).
 *  2. Steep timer (per branch default in `STEEP_SECONDS_BY_BRANCH`).
 *  3. Transition (tee up the completion step).
 *  4. Completion (save the recipe to the Journal).
 *
 * No heatmap step is rendered for the non-decarb branches — the
 * heatmap is the canonical "watch the decarb happen" affordance
 * from §4.1, and there's no decarb to watch. A future iteration
 * may add a "watch the carrier infuse" heatmap; for v1 the
 * timer is the primary affordance.
 *
 * Defensive: if the carrier is missing (the user somehow
 * reached Start without picking a carrier — the §3.1 Carrier
 * step is always shown for these 3 branches, so this should be
 * unreachable via the wizard UI), the builder still returns a
 * 4-step list with the static defaults. The carrier only
 * affects the post-step engine derivation (THC mg, mg/mL), not
 * the Stage 2 step list itself.
 */
function buildNonDecarbSteps(
  branch: 'avb' | 'concentrate' | 'topical',
  selections: WizardSelections
): ExecutionStep[] {
  const targetTemp = STEEP_TEMP_BY_BRANCH[branch] ?? 80
  const totalSeconds = STEEP_SECONDS_BY_BRANCH[branch] ?? 3600
  const stirIntervalSeconds = Math.floor(totalSeconds / 4)
  // Per-branch phase label — the non-decarb branches have
  // different "what is happening" semantics:
  //  - AVB: "steep" — the AVB is dissolving into the carrier
  //  - Concentrate: "dissolve" — the concentrate is being
  //    incorporated into the carrier
  //  - Topical: "infuse" — the decarbed material is being
  //    incorporated into the beeswax + oil base
  const phaseVerb =
    branch === 'avb'
      ? 'steep'
      : branch === 'concentrate'
        ? 'dissolve'
        : 'infuse'
  // The material is the wizard's branch — the heatmap step
  // (when added in a future iteration) would render the
  // `material` prop to choose the right geometry. For v1
  // the non-decarb branches don't render a heatmap, but
  // tagging the `phase` correctly means the per-phase
  // stepper grouping (§4.2) shows the right label.
  const preheatStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.preheatSteep,
    title: `Preheat for ${phaseVerb}`,
    phase: 'infusion',
    shell: 'preheat',
    targetTemp,
    duration: `${Math.round(totalSeconds / 60)} min`,
    isCurrent: false,
    isComplete: false,
  }
  const timerStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.timerInfusion,
    title: `${branch === 'avb' ? 'Steep' : branch === 'concentrate' ? 'Dissolve' : 'Infuse'} timer`,
    phase: 'infusion',
    shell: 'timer',
    totalSeconds,
    stirIntervalSeconds,
    isCurrent: false,
    isComplete: false,
  }
  const transitionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.transitionInfusion,
    title: `${branch === 'avb' ? 'Steep' : branch === 'concentrate' ? 'Dissolve' : 'Infuse'} complete`,
    phase: 'transition',
    shell: 'transition',
    message: `${branch === 'avb' ? 'Steep' : branch === 'concentrate' ? 'Dissolve' : 'Infuse'} complete. Dose and save recipe →`,
    isCurrent: false,
    isComplete: false,
  }
  const completionStep: ExecutionStep = {
    id: STAGE2_STEP_IDS.completion,
    title: 'Save recipe',
    phase: 'completion',
    shell: 'completion',
    recipeName: '',
    computedTotals: { thcMg: 0, cbdMg: 0, servings: 0 },
    isCurrent: false,
    isComplete: false,
  }
  return [preheatStep, timerStep, transitionStep, completionStep]
}
