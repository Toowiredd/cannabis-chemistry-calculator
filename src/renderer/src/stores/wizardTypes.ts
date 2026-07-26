/**
 * Stage 1 Configuration Wizard — state + step types.
 *
 * Per the 2026-07-26 wizard-architecture redesign (docs/wizard-architecture-
 * 2026-07-26.md §3.3, §3.4, §6), the ccc primary navigation moves from the
 * current 3D coverflow + 9 tabs to a two-stage flow: a Stage 1 configuration
 * wizard (one decision at a time, branch taxonomy) and a Stage 2 execution
 * stepper (vertical, all steps visible). This file holds the **state shape**
 * and **step definition types** for Stage 1.
 *
 * The previous multi-select kit-configurator wizard (the one that backed
 * FirstTimerGuide) is still present in `appStore.ts` under `wizard` (kept for
 * backward compat — the standalone First-Timer Guide is being deprecated
 * per §8.6 in a later week). The new Stage 1 state is added alongside it
 * as additional optional fields on the same `wizard` slice, behind a
 * `wizardEnabled` feature flag (default `false` in this Week 1 commit).
 *
 * NOTE on type imports: the spec called for `DecarbMethodId` and
 * `BagPresetId` from `engine/decbMethods` and `engine/bagPresets`. Neither
 * type is exported under those names — the actual types live in
 * `engine/models.ts` as the `PresetMethod` and `PresetBag` interfaces
 * (each carrying a string `id`). Per the spec's fallback ("if not exported
 * as named types, use `string` and surface in the commit body"), the
 * `method` and `container` selection keys are typed as plain `string` for
 * now. Tighten once the engine extracts proper ID unions.
 */

// `DecarbMethodId` is the union of method IDs from `engine/models.ts`
// (`DECARB_METHODS[].id`). The engine doesn't export a named union yet —
// see the file header for the note. `string` is the safe default; tighten
// once `engine/decbMethods.ts` (or equivalent) exposes a literal union.
export type DecarbMethodId = string

// `BagPresetId` is the union of bag preset IDs from `engine/models.ts`
// (`BAG_PRESETS[].id`). Same story as `DecarbMethodId` — not yet a named
// export, so `string` for now.
export type BagPresetId = string

/**
 * The five product-type branches the Stage 1 wizard starts with. Per
 * `docs/wizard-architecture-2026-07-26.md` §3.1, each branch returns its
 * own ordered list of steps from `branches[state.branch].steps`.
 *
 * The on-screen labels use the plain-language versions from §8.4
 * ("From raw flower", "From concentrate or hash", etc.) — the IDs stay
 * terse for code/log reasons.
 */
export type ProductType = 'flower' | 'concentrate' | 'avb' | 'edible' | 'topical'

/**
 * The Stage 1 wizard's per-step selections. Every field is optional —
 * the user only fills in the fields relevant to their branch (smart-skip
 * rules in §3.1 hide irrelevant steps entirely).
 *
 * Shape mirrors `docs/wizard-architecture-2026-07-26.md` §3.3 verbatim,
 * with one pragmatic substitution: `method` and `container` are `string`
 * (see file header) and `fat` / `color` / `carrier` are also `string` for
 * the same reason — the engine exposes the data but not yet named literal
 * unions. The wizard's step definitions (`getOptions`) cast at the call
 * site; runtime validation lives in the engine's existing entry points.
 */
export type WizardSelections = Partial<{
  method: DecarbMethodId
  container: BagPresetId
  weight: { value: number; unit: 'g' | 'oz' }
  efficiency: number
  fat: string
  volume: { value: number; unit: 'mL' | 'cup' | 'tsp' | 'tbsp' }
  servings: number
  /** THC % (1-100) — concentrate branch. */
  potency: number
  /** AVB color band — AVB branch. */
  color: string
  /** Topical application area — topical branch. */
  applicationArea: string
  /** Carrier oil for infusion — topical / concentrate branches. */
  carrier: string
}>

/**
 * The Stage 1 wizard's persisted state. Mirrors §3.3 of the design doc
 * with one extension: `stepHistory` (an ordered list of visited step
 * indices) backs the "back" button's restore-to-previous-step behaviour.
 * The head of `stepHistory` is the most recent step the user was on; the
 * tail is the entry point (product-type picker, index 0).
 */
export type WizardState = {
  /** Which of the 5 branches the user picked at step 0. `null` = not yet picked. */
  branch: ProductType | null
  /** Current step index in the branch's step list. 0 = product-type picker. */
  currentStep: number
  /** Per-step selections. Every field optional. */
  selections: WizardSelections
  /**
   * Visited step indices, in order. The "back" button pops the head and
   * restores `currentStep` to the new head. Reset by `resetWizard`.
   */
  stepHistory: number[]
}

/**
 * A single option the user can pick on a given wizard step. The wizard
 * renders these as `<OptionTile>` cards in a horizontal scroll-snap
 * carousel. Per §3.2, the active step's option carousel is the only
 * place Stage 1 takes user input.
 */
export type WizardOption = {
  /** Stable id (matches the value written to `WizardSelections[field]`). */
  id: string
  /** 1-2 word title shown on the tile. */
  title: string
  /** 1-line "what this means" for beginners (per the target user). */
  subtitle: string
  /** Optional emoji / icon character. */
  icon?: string
  /** Optional badge text ("Recommended", "Beginner", etc.). */
  badge?: string
  /** Optional tooltip — shown on hover / focus for jargon terms. */
  tooltip?: string
}

/**
 * Stage 2 Execution stepper — runtime-only state (Week 3).
 *
 * Per `docs/wizard-architecture-2026-07-26.md` §4, Stage 2 is the
 * "do the work" surface that takes over once the user taps "Begin
 * batch" in Stage 1. It is a vertical stepper (all steps visible,
 * current step highlighted) — distinct from Stage 1's one-card-at-
 * a-time carousel. The two stages share the `wizard` slice in
 * `appStore.ts` so cross-stage handoffs (e.g. "Return to config"
 * from Stage 2 → Stage 1 selections preserved) are trivial.
 *
 * `ExecutionStage` discriminates between the two top-level wizard
 * modes. The runtime is a Stage-1-or-Stage-2 machine, not a
 * free-for-all; components read this to know which surface to
 * render. `'config'` is the default; `'execution'` is set by
 * `beginExecution` and cleared by `returnToConfig`.
 */
export type ExecutionStage = 'config' | 'execution'

/**
 * The Stage 2 stepper's runtime state. Tracks which execution
 * step is currently in focus, which the user has already finished
 * (rendered with a checkmark + dimmed state), and which they
 * skipped (rendered with a "skipped" badge so they can re-visit
 * later if they want).
 *
 * EPHEMERAL BY DESIGN: per the Week 3 brief, Stage 2 state does
 * NOT survive a reload. If the user reopens the app mid-batch,
 * the wizard goes back to Stage 1 (the `ExecutionStage` is
 * `'config'` again, lists are empty, `currentStepId` is null).
 * The decision was deliberate: resuming a half-finished execution
 * is dangerous (the timer / heatmap / "stir now" prompts are
 * physical-world state that the app cannot reliably re-derive),
 * and the Stage 1 selections are preserved so the user can re-
 * run Stage 2 from the top in two taps. The store enforces the
 * ephemerality by NOT persisting `execution` (see
 * `appStore.ts` partialize + merge).
 */
export interface ExecutionStepState {
  /** ID of the currently-active Stage 2 step. `null` when no step is current. */
  currentStepId: string | null
  /** Ordered list of completed Stage 2 step IDs. */
  completedStepIds: string[]
  /** Ordered list of skipped Stage 2 step IDs. */
  skippedStepIds: string[]
}

/**
 * Declarative step definition. The wizard composes its visible steps
 * from `branches[state.branch].steps` (per §3.4), so adding a new step
 * is a one-line config change rather than a code change.
 *
 * `getOptions` / `validate` / `skipIf` all receive the current
 * `WizardState` so steps can be conditional on prior selections
 * (e.g., a "Servings" step that's hidden for topicals via `skipIf`).
 */
export type WizardStep = {
  /** Stable id; matches the key in `WizardSelections` this step writes. */
  id: string
  /** Card title shown when the step is active. */
  title: string
  /** 1-line plain-language "what this means" description. */
  description: string
  /** Returns the option tiles for this step, given the current state. */
  getOptions: (state: WizardState) => WizardOption[]
  /** True when this step's selection is valid and the user can advance. */
  validate: (state: WizardState) => boolean
  /** True when this step should be hidden (smart-skip). */
  skipIf: (state: WizardState) => boolean
}
