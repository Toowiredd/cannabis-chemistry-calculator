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

// Week 7 (2026-07-28 wizard build, §7 Polish + §6 Validation):
// the `validateWizardSelections` helper at the bottom of this
// file validates Stage 1 selections against the engine's
// known method / fat ids. The helper is the closest
// collaborator of the types declared here, so it lives in
// the same module (rather than a new `wizardValidation.ts`
// file) — the UI consumer (WizardScreen) already imports
// `WizardSelections` from this module, so colocating the
// validator avoids a second import. The helper is pure
// (no React, no DOM, no store reads).
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'

// `DecarbMethodId` is the union of method IDs from `engine/models.ts`
// (`DECARB_METHODS[].id`). The engine doesn't export a named union yet —
// see the file header for the note. `string` is the safe default; tighten
// once `engine/decbMethods.ts` (or equivalent) exposes a literal union.
export type DecarbMethodId = string

// `BagPresetId` is the union of bag preset IDs from `engine/models.ts`
// (`BAG_PRESETS[].id`). Same story as `DecarbMethodId` — not yet a named
// export, so `string` for now.
export type BagPresetId = string

// `InfusionFatId` is the union of fat/carrier IDs from `engine/models.ts`
// (`INFUSION_FATS[].id`). Same story as the two above — not yet a named
// export, so `string` for now. Tighten once `engine/models.ts` exposes
// a literal union. The wizard uses this same type for both the edible /
// flower `fat` field AND the concentrate / avb / topical `carrier`
// field — the engine treats them as the same id-space.
export type InfusionFatId = string

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
 * Type-guard for the Stage 1 wizard's product-type branch literal.
 * Mirrors the private `isProductType` helper in `appStore.ts` — kept
 * here as a standalone so `validateWizardSelections` can validate
 * against the same 5-literal union without taking a runtime
 * dependency on the store module (the helper is meant to be pure
 * — no store reads, no React, no DOM). The duplication is
 * intentional: pulling the type-guard out of the store would
 * invert the import direction (`wizardTypes` is a leaf module,
 * the store depends on it, not the other way around).
 */
export function isProductType(value: unknown): value is ProductType {
  return (
    value === 'flower' ||
    value === 'concentrate' ||
    value === 'avb' ||
    value === 'edible' ||
    value === 'topical'
  )
}

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
  /**
   * Fat / carrier id for the edible / flower branches. `null` is
   * a valid value — the "no infusion" path per §3.1 (e.g. a user
   * who just decarbed flower without infusing into a fat). The
   * `Partial<...>` wrapper means `undefined` is the "not yet
   * picked" sentinel; `null` is the explicit "I chose no fat"
   * sentinel; a string is an `INFUSION_FATS` id.
   */
  fat: string | null
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
  /**
   * When `true`, the engine is recomputing the totals after a
   * Stage 1 re-edit. Stage 2's stepper shows a "recalculating..."
   * badge on every step whose data is affected (see
   * `affectedStepIds`). Resets to `false` once the engine finishes
   * (or after a short timeout if the engine is synchronous —
   * Week 4 is the synchronous case; Week 7's a11y polish may
   * add an explicit `finishRecalculating` dispatch if needed).
   * Per `docs/wizard-architecture-2026-07-26.md` §8.1.
   */
  isRecalculating: boolean
  /**
   * Step IDs whose data is being recomputed. The stepper
   * stamps each member with `data-recalculating="true"` so
   * the UI can show the badge on just the affected rows
   * (not on the whole list). Empty when `isRecalculating` is
   * false.
   */
  affectedStepIds: string[]
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

/**
 * Week 5 (per `docs/wizard-architecture-2026-07-26.md` §8.2 +
 * §8.5). A Recipe is the persisted record of a completed Stage 2
 * batch. The `selections` field is the full Stage 1
 * `WizardSelections` shape; the engine re-derives everything
 * else when the user re-runs the recipe. The `batchJournalEntryId`
 * links the Recipe to the existing `JournalEntry` for the same
 * batch (so the Journal can show "this batch was made from
 * recipe <X>" without duplicating the entry).
 */
export interface Recipe {
  id: string
  createdAt: string  // ISO timestamp
  name: string  // user-supplied from NameRecipeStep
  branch: ProductType  // 'flower' | 'concentrate' | etc.
  selections: WizardSelections
  /** Optional link to the JournalEntry written for this batch. */
  batchJournalEntryId: string | null
}

/**
 * Week 7 (per `docs/wizard-architecture-2026-07-26.md` §7
 * Polish + §6 Validation). A pure helper that checks a
 * Stage 1 `WizardSelections` for the minimum fields the
 * engine needs to compute the Stage 2 totals. Used by
 * `WizardScreen` to gate the Begin batch CTA + by
 * `handleCompletionSave` to gate the Save to Journal CTA.
 *
 * Returns a `ValidationResult` shape with a boolean
 * flag + a list of human-readable error messages. The
 * shape is intentionally explicit (not a thrown error)
 * because the wizard's UX is "show all the problems at
 * once" — a thrown error would short-circuit on the
 * first issue. The error list drives the Toast the
 * UI renders when validation fails.
 */
export interface ValidationResult {
  ok: boolean
  errors: string[]
}

// ---------------------------------------------------------------------------
// Week 7 (2026-07-28 wizard build, §7 Polish + §6 Validation) — Stage 1
// selection validation helper. Implemented in this file (rather than a
// new `wizardValidation.ts` file) because the helper is the closest
// collaborator of the `WizardSelections` + `ProductType` types it
// validates — the UI consumer (WizardScreen) already imports
// `WizardSelections` from this module, so colocating the validator
// with the type avoids a second import. The helper is pure (no
// React, no DOM, no store reads) so the placement does not pull
// any side effects into the type file.
// ---------------------------------------------------------------------------

/**
 * Validate a Stage 1 wizard selection set.
 *
 * Checks (per §3.1, §3.3, §4.2):
 *  - `method` is set + is a known `DECARB_METHODS` id
 *    (for the Flower + Edible branches; Concentrate /
 *    AVB / Topical skip the decarb step)
 *  - `weight` is set + is > 0 (for Flower + Edible)
 *  - `fat` is set + is a known `INFUSION_FATS` id, OR
 *    is null (the Flower "no infusion" path) — undefined
 *    is a soft fail
 *  - `volume` is set + is > 0 (when fat is set; null-fat
 *    skips the volume step)
 *  - `servings` is set + is > 0 (for non-Topical
 *    branches when fat is set; Topical smart-skips per
 *    §3.1, and Flower + null-fat smart-skips both volume
 *    and servings because the no-infusion path doesn't
 *    produce a dose to divide)
 *  - `potency` is set for the Concentrate branch
 *  - `color` is set for the AVB branch
 *  - `applicationArea` is set for the Topical branch
 *
 * Pure (no React, no DOM, no store reads). The `branch`
 * is read from a separate argument so the helper can
 * validate the (branch, selections) pair without
 * requiring a full `WizardState` context.
 *
 * Returns `{ ok: true, errors: [] }` when the selection
 * set is valid for the given branch, otherwise
 * `{ ok: false, errors: [...] }` with one human-readable
 * error per missing-or-invalid field.
 */
export function validateWizardSelections(
  branch: ProductType | null,
  selections: WizardSelections
): ValidationResult {
  const errors: string[] = []

  // Stage 1 step 0 — the user must pick a branch before
  // any of the per-branch validation can run. The
  // "branch not picked" error is the gate; per-branch
  // checks below would all be noise without it.
  if (branch === null) {
    errors.push('Branch not picked — pick a product type to continue')
    return { ok: false, errors }
  }

  // The engine's id-spaces. Pulled from the engine at
  // module load (they are `as const` arrays, so the
  // Set construction is a one-time cost per module
  // import — fine for a UI-side validator).
  const knownMethodIds = new Set(DECARB_METHODS.map(m => m.id))
  const knownFatIds = new Set(INFUSION_FATS.map(f => f.id))

  if (branch === 'flower' || branch === 'edible') {
    // Method: required + must be a known DECARB_METHODS id.
    const method = selections.method
    if (method === undefined) {
      errors.push('Decarb method not picked')
    } else if (!knownMethodIds.has(method)) {
      errors.push(`Unknown decarb method id: "${method}"`)
    }

    // Weight: required + value > 0.
    const weight = selections.weight
    if (weight === undefined) {
      errors.push('Weight not picked')
    } else if (typeof weight.value !== 'number' || weight.value <= 0) {
      errors.push('Weight must be greater than 0')
    }

    // Fat: required (set to a known INFUSION_FATS id or null
    // for the no-infusion path). `undefined` is a soft fail.
    const fat = selections.fat
    if (fat === undefined) {
      errors.push('Fat not picked')
    } else if (fat !== null && !knownFatIds.has(fat)) {
      errors.push(`Unknown fat id: "${fat}"`)
    }

    // Volume: required when fat is set (the infusion
    // path). When fat is null (the no-infusion path),
    // the user is just decarbing without producing a
    // dose, so volume is intentionally skipped.
    //
    // Servings: the Flower branch sequence has NO
    // servings step (per `branchSequences.ts:62-71` —
    // the canonical Flower sequence ends at `startStep`
    // after the optional `volumeStep`). The Edible
    // branch sequence (`branchSequences.ts:94-103`)
    // has `servingsStep` and requires it; the
    // concentrate + avb branches always require it.
    // The Flower-with-infusion path therefore
    // intentionally does NOT require servings here —
    // the engine's `calculateMgPerServing` is not
    // called for Flower batches.
    if (fat !== null && fat !== undefined) {
      const volume = selections.volume
      if (volume === undefined) {
        errors.push('Volume not picked')
      } else if (typeof volume.value !== 'number' || volume.value <= 0) {
        errors.push('Volume must be greater than 0')
      }
    }

    // Edible branch (the `flower || edible` block above
    // also covers Edible per §3.1 — the Edible branch
    // sequence has a `servingsStep` and the engine's
    // `calculateMgPerServing` is called for Edible
    // batches. Flower does NOT require servings.)
    if (branch === 'edible') {
      const servings = selections.servings
      if (servings === undefined) {
        errors.push('Servings not picked')
      } else if (typeof servings !== 'number' || servings <= 0) {
        errors.push('Servings must be greater than 0')
      }
    }
  } else if (branch === 'concentrate') {
    // Potency: required (a % in the 0..100 range; the
    // engine bounds the upper end, but the wizard just
    // needs a present + positive value here).
    const potency = selections.potency
    if (potency === undefined) {
      errors.push('Potency not picked')
    } else if (typeof potency !== 'number' || potency <= 0) {
      errors.push('Potency must be greater than 0')
    }

    // Carrier: required (any non-empty string). The
    // concentrate branch reuses the fat id-space loosely
    // — the engine accepts any carrier id, not just the
    // four `INFUSION_FATS` presets. The spec's test
    // case (e.g. `carrier: 'mct'`) is a known good
    // value, but the validator doesn't enforce that —
    // a future carrier (e.g. `'ethanol'`, `'pg'`) added
    // to the engine would not need a validator update.
    const carrier = selections.carrier
    if (carrier === undefined || carrier === '') {
      errors.push('Carrier not picked')
    }

    // Volume + servings: always required for concentrate
    // (the no-infusion path doesn't apply — the user is
    // always infusing the concentrate into a carrier).
    const volume = selections.volume
    if (volume === undefined) {
      errors.push('Volume not picked')
    } else if (typeof volume.value !== 'number' || volume.value <= 0) {
      errors.push('Volume must be greater than 0')
    }

    const servings = selections.servings
    if (servings === undefined) {
      errors.push('Servings not picked')
    } else if (typeof servings !== 'number' || servings <= 0) {
      errors.push('Servings must be greater than 0')
    }
  } else if (branch === 'avb') {
    // Color: required (a band id from the AVB engine model;
    // the engine isn't loading a literal union today, so the
    // wizard accepts any non-empty string here).
    const color = selections.color
    if (color === undefined || color === '') {
      errors.push('AVB color not picked')
    }

    // Carrier: required (any non-empty string). The AVB
    // branch accepts carrier ids that are NOT in the
    // `INFUSION_FATS` id-space — the spec's test case
    // (e.g. `carrier: 'alcohol'`) is a real carrier for
    // AVB that's outside the edible/flower fat
    // catalogue. The validator only checks "is it
    // present + non-empty"; the engine accepts any
    // carrier id.
    const carrier = selections.carrier
    if (carrier === undefined || carrier === '') {
      errors.push('Carrier not picked')
    }

    // Volume + servings: always required for AVB.
    const volume = selections.volume
    if (volume === undefined) {
      errors.push('Volume not picked')
    } else if (typeof volume.value !== 'number' || volume.value <= 0) {
      errors.push('Volume must be greater than 0')
    }

    const servings = selections.servings
    if (servings === undefined) {
      errors.push('Servings not picked')
    } else if (typeof servings !== 'number' || servings <= 0) {
      errors.push('Servings must be greater than 0')
    }
  } else if (branch === 'topical') {
    // Carrier: required (any non-empty string). The
    // topical branch accepts carrier ids that are NOT in
    // the `INFUSION_FATS` id-space — the spec's test
    // case (e.g. `carrier: 'olive'`) is a real carrier
    // for topicals (olive oil, coconut oil, shea
    // butter, etc.) that's outside the edible/flower
    // fat catalogue. The validator only checks "is it
    // present + non-empty"; the engine accepts any
    // carrier id.
    const carrier = selections.carrier
    if (carrier === undefined || carrier === '') {
      errors.push('Carrier not picked')
    }

    // Volume: required for topical (the user is infusing
    // the carrier, even though there's no "servings"
    // concept for a topical).
    const volume = selections.volume
    if (volume === undefined) {
      errors.push('Volume not picked')
    } else if (typeof volume.value !== 'number' || volume.value <= 0) {
      errors.push('Volume must be greater than 0')
    }

    // Application area: required.
    const applicationArea = selections.applicationArea
    if (applicationArea === undefined || applicationArea === '') {
      errors.push('Application area not picked')
    }

    // Servings: intentionally NOT checked. Per §3.1,
    // topicals smart-skip the servings step — a topical
    // batch has no per-serving dose to compute.
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}
