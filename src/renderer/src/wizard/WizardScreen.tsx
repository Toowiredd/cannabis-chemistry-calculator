/**
 * WizardScreen — top-level screen that renders the Stage 1 wizard
 * AND the Stage 2 execution stepper once the user has tapped
 * "Begin batch".
 *
 * Per the architecture doc §7:
 *  - Week 1: Behind a `wizardEnabled` feature flag; the product-
 *    type step + the Flower Method step render; the rest is
 *    placeholders.
 *  - Week 2: All 5 branches are wired up. Each branch's full step
 *    sequence is in `branchSequences.ts`. Smart-skip (§3.1) is
 *    applied via `getEffectiveBranchSequence` — when a step's
 *    `skipIf(state)` returns true, the wizard auto-advances past
 *    it. The terminal "Start" step shows a "Begin batch" CTA
 *    that wires up to Stage 2 (see Week 3 below).
 *  - Week 3 (this commit): Tapping "Begin batch" calls
 *    `beginExecution('preheat-decarb')` on the store. The Stage 2
 *    stepper mounts when `wizard.execution.currentStepId` is
 *    non-null. Stage 1 stays mounted alongside the stepper so the
 *    user can return to it via the stepper's "Back to config" CTA
 *    (which calls `returnToConfig`).
 *
 * State: held locally in this component for Week 2+. The state
 * shape (`wizard/wizardTypes.ts`) is the same as the eventual
 * `appStore.wizard` slice owned by state-routing; the migration
 * is a 1-line change (replace `useState` with
 * `useAppStore(s => s.wizard)`) when state-routing lands. The
 * Stage 2 `execution` slice IS in the store (state-routing's
 * commit 51f8d89) — that one is read directly here, not
 * mirrored in local state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { Wizard } from 'renderer/src/components/Wizard'
import { ExecutionStepper } from 'renderer/src/components/ExecutionStepper'
import { NameRecipeStep } from 'renderer/src/components/NameRecipeStep'
import { useAppStore } from 'renderer/src/stores/appStore'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import {
  BRANCH_SEQUENCES,
  getEffectiveBranchSequence,
} from 'renderer/src/wizard/branchSequences'
import {
  buildExecutionSteps,
  STAGE2_STEP_IDS,
} from 'renderer/src/wizard/stage2Steps'
import {
  DEFAULT_WIZARD_STATE,
  type WizardBranchId,
  type WizardSelections,
  type WizardState,
} from 'renderer/src/wizard/wizardTypes'
// Week 7 (§3.4 + §7 Polish) — the Stage 1 selection validator.
// Imported from the stores' `wizardTypes.ts` (where the
// state-routing rein landed it in commit c0a893e) rather than
// the wizard's local `wizardTypes.ts` (which is the source of
// truth for the wizard's `WizardState` shape but does NOT host
// the validator). The two `WizardSelections` types are
// structurally compatible (TS structural typing — both are
// `Partial<{method, container, weight, ...}>`); the cast at
// the call site is the contract for the type-narrowing.
import {
  validateWizardSelections,
  type ProductType,
} from 'renderer/src/stores/wizardTypes'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
import { calculateInfusedThc } from 'renderer/src/engine/infusion'
import { calculateMgPerServing } from 'renderer/src/engine/dosing'
import { calculateBagVolume } from 'renderer/src/engine/bagVolume'

export interface WizardScreenProps {
  className?: string
  /**
   * Week 7 — test-only prop. Initialises the local wizard state
   * from a pre-built object instead of `DEFAULT_WIZARD_STATE`.
   * The validation tests use it to start the wizard at a specific
   * (branch, currentStep, selections) triple without walking the
   * whole UI (the wizard's `state` is React-internal, so a test
   * that wants to simulate "incomplete selections at the Start
   * step" has no other way to inject them). Production code does
   * NOT pass this prop.
   */
  initialState?: WizardState
}

export function WizardScreen({ className, initialState }: WizardScreenProps) {
  // All hooks must be called unconditionally at the top of the
  // component (React rules of hooks). The `enabled` early return
  // happens AFTER every hook in this function.
  const enabled = useWizardEnabled()
  const [state, setState] = useState<WizardState>(
    initialState ?? DEFAULT_WIZARD_STATE
  )
  // Week 7 — validation error state. Set by the `onSelect` handler's
  // `stepId === 'start'` branch when the Stage 1 selections fail
  // the §3.4 per-branch validation, OR when the empty-selection
  // guard fires (defensive — `state.branch === null` at the Start
  // step shouldn't happen in practice because `isOnStartStep`
  // already requires a branch, but the belt-and-suspenders guard
  // is documented in the brief). Cleared on any non-Start
  // selection (the user changed their inputs). Renders inline next
  // to the "Begin batch" CTA with `role="alert"` +
  // `aria-live="assertive"` so a screen reader announces the
  // error as soon as it appears.
  const [validationError, setValidationError] = useState<string | null>(null)
  // Stage 2 wiring (Week 3). The store's `execution` slice was
  // landed by the state-routing rein in commit 51f8d89; the
  // actions below are the canonical entry / advance / back
  // verbs for the Stage 2 stepper. The selectors are stable
  // (zustand returns the same function reference across renders
  // when the action hasn't been replaced) so passing them into
  // `useCallback` deps doesn't cause a re-mount of every
  // downstream memo.
  const beginExecution = useAppStore(s => s.beginExecution)
  const completeExecutionStep = useAppStore(s => s.completeExecutionStep)
  const skipExecutionStep = useAppStore(s => s.skipExecutionStep)
  const returnToConfig = useAppStore(s => s.returnToConfig)
  // Week 4 (§8.1): the re-edit recalculating flow. The
  // `recomputeFromEdit` action is a single dispatch that flips
  // `isRecalculating: true` then `false` so the stepper shows
  // a brief "recalculating..." flash on the affected rows. The
  // engine recompute itself is sub-millisecond; Week 7's a11y
  // polish may add a debounced `finishRecalculating` dispatch
  // if a future async engine needs the delay. Today the
  // synchronous pattern is enough.
  const recomputeFromEdit = useAppStore(s => s.recomputeFromEdit)
  const execution = useAppStore(s => s.wizard.execution)

  /**
   * Advance the wizard past any steps whose `skipIf(state)`
   * returns true. Used after every state mutation so the user
   * never lands on a step that should be hidden for their
   * current selections (e.g. the Flower "no infusion" path
   * auto-skips the Volume step).
   */
  const advancePastSkippedSteps = useCallback(
    (next: WizardState): WizardState => {
      if (next.branch === null) return next
      let current = next
      // Loop is bounded — at most one pass per skipped step
      // per mutation. The smart-skip predicates are pure
      // functions of state, so the loop terminates once the
      // current step's `skipIf` returns false.
      for (let safety = 0; safety < 16; safety++) {
        const effective = getEffectiveBranchSequence(current.branch, current)
        if (!effective) return current
        if (current.currentStep >= effective.length) return current
        const step = effective[current.currentStep]
        if (!step?.skipIf) return current
        if (!step.skipIf(current)) return current
        current = { ...current, currentStep: current.currentStep + 1 }
      }
      return current
    },
    []
  )

  /**
   * Decode a step's `optionId` into the `selections` key/value
   * it represents. Most steps use the optionId as-is
   * (e.g. `'oven_sealed'` → `selections.method`); the steps
   * with structured selections (weight, efficiency, volume,
   * servings, potency) encode the value into the optionId and
   * need to decode it here.
   *
   * The encoding is shared with `steps.ts`:
   *  - weight:     `${unit}-${value}`   e.g. `g-3.5`
   *  - efficiency: `eff-${pct}`          e.g. `eff-90`
   *  - volume:     `${unit}-${value}`   e.g. `mL-240`
   *  - servings:   `s-${count}`          e.g. `s-12`
   *  - potency:    `p-${pct}`            e.g. `p-75`
   */
  const decodeSelection = useCallback(
    (stepId: string, optionId: string): Partial<WizardSelections> => {
      switch (stepId) {
        case 'weight': {
          // `g-3.5`, `g-7`, etc.
          const match = /^([a-z]+)-(\d+(?:\.\d+)?)$/.exec(optionId)
          if (!match) return {}
          return {
            weight: {
              unit: match[1] as 'g' | 'oz',
              value: Number.parseFloat(match[2]),
            },
          }
        }
        case 'efficiency': {
          // `eff-80`, `eff-90`, etc.
          const match = /^eff-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { efficiency: Number.parseInt(match[1], 10) / 100 }
        }
        case 'volume': {
          // `mL-100`, `mL-240`, etc.
          const match = /^([a-zA-Z]+)-(\d+(?:\.\d+)?)$/.exec(optionId)
          if (!match) return {}
          return {
            volume: {
              unit: match[1] as 'mL' | 'cup' | 'tsp' | 'tbsp',
              value: Number.parseFloat(match[2]),
            },
          }
        }
        case 'servings': {
          // `s-12`, `s-48`, etc.
          const match = /^s-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { servings: Number.parseInt(match[1], 10) }
        }
        case 'potency': {
          // `p-75`, `p-85`, etc.
          const match = /^p-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { potency: Number.parseInt(match[1], 10) }
        }
        case 'container': {
          // v2.2 (2026-07-27): the Container step was
          // reworked from a preset carousel into a custom
          // input form. The user types in their own bag
          // dimensions; the form's onConfirm fires with
          // the encoded id `custom-{w}-{l}-{d}` where each
          // value is the engine's cm measurement. The
          // decoder parses the id back into a
          // `customContainer` payload so downstream steps
          // (the Weight smart-skip, the Volume valid-range
          // check) read the derived volume + dimensions
          // without re-deriving them.
          //
          // Legacy preset ids (e.g. 'gallon', 'quart') are
          // still accepted — the engine tests + the
          // `BAG_PRESETS` lookup paths use them. The
          // `customContainer` field is left undefined for
          // legacy ids; the engine falls back to the preset
          // volume when `customContainer` is missing.
          const customMatch = /^custom-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(
            optionId
          )
          if (!customMatch) {
            return { container: optionId }
          }
          const widthCm = Number.parseFloat(customMatch[1] ?? '0')
          const lengthCm = Number.parseFloat(customMatch[2] ?? '0')
          const depthCm = Number.parseFloat(customMatch[3] ?? '0')
          // Reuse the engine's `calculateBagVolume` for the
          // derived cm³ so the wizard never re-derives
          // volume independently — the engine is the single
          // source of truth.
          const volumeCm3 = calculateBagVolume(widthCm, lengthCm, depthCm)
          return {
            container: optionId,
            customContainer: { widthCm, lengthCm, depthCm, volumeCm3 },
          }
        }
        case 'fat': {
          // The 'none' tile sets `selections.fat = null` —
          // the brief-mandated sentinel for the Flower
          // branch's "no infusion" path.
          if (optionId === 'none') return { fat: null }
          return { fat: optionId }
        }
        default: {
          // All other steps use the optionId directly as the
          // selection value: method, container, carrier,
          // color, applicationArea.
          return { [stepId]: optionId } as Partial<WizardSelections>
        }
      }
    },
    []
  )

  const onSelect = useCallback(
    (stepId: string, optionId: string) => {
      // The Start step is the terminal "Begin batch" CTA.
      // Picking it (a) advances `state.currentStep` past the
      // end of the canonical sequence so the `isFinished`
      // check in render still returns true and the Stage 1
      // "Batch ready" badge stays visible alongside the Stage
      // 2 stepper, and (b) calls `beginExecution('preheat-decarb')`
      // on the store to transition into Stage 2. The
      // `execution.currentStepId !== null` check below the
      // Stage 1 render block is what triggers the stepper
      // mount; Stage 1 itself stays mounted for the entire
      // batch so the user can hit "Back to config" and pick
      // up where they left off without re-filling the wizard.
      if (stepId === 'start') {
        // Week 7 — Step 3: empty-selection guard. The
        // store's `beginExecution` is already defensive (no-op
        // if `firstStepId` is empty), but the UI should also
        // be defensive. If the user somehow reached Start
        // without picking a branch (the `isOnStartStep` render
        // gate already prevents this in practice, but the
        // brief mandates the belt-and-suspenders guard),
        // surface the error inline and bail.
        if (state.branch === null) {
          setValidationError('No branch selected')
          return
        }
        // Week 7 — Step 2: validation. Run the per-branch
        // required-fields check; if any required field is
        // missing, surface the joined error message and
        // DON'T call `beginExecution`. The user can then
        // re-edit a step (the error is cleared on the next
        // non-Start selection below) and re-tap.
        // `validateWizardSelections` is the state-routing
        // rein's helper (commit c0a893e) — see the import
        // comment at the top of this file for why it's
        // sourced from `stores/wizardTypes` rather than
        // `wizard/wizardTypes`. The `selections` cast
        // bridges the two structurally-compatible
        // `WizardSelections` types (the wizard's
        // `WizardSelections` is the canonical local
        // shape; the store's `WizardSelections` is the
        // validator's expected shape — TS structural
        // typing handles the cross-file compatibility,
        // but the `as` is the explicit contract for the
        // edge cases like the wizard's extra
        // `name?: string` field).
        const result = validateWizardSelections(
          state.branch as ProductType | null,
          state.selections as Parameters<
            typeof validateWizardSelections
          >[1]
        )
        if (!result.ok) {
          setValidationError(result.errors.join('; '))
          return
        }
        // Validation passed — clear any prior error and
        // transition to Stage 2.
        setValidationError(null)
        setState(prev => {
          const canonical = prev.branch
            ? (BRANCH_SEQUENCES[prev.branch] ?? [])
            : []
          return {
            ...prev,
            currentStep: canonical.length, // past the end → isFinished
          }
        })
        // The first Stage 2 step is `preheat-decarb` for the
        // Flower branch (the only branch with Week 3 Stage 2
        // work). For other branches the stepper's empty list
        // path renders "No steps to run" — the user can
        // re-edit their config and re-run Stage 2 once the
        // branch's Stage 2 steps land in weeks 4-6.
        beginExecution('preheat-decarb')
        return
      }
      // Any non-Start selection clears the prior validation
      // error — the user has changed their inputs and the
      // previous error message is no longer accurate. This
      // is the documented contract for the §3.4 "re-edit to
      // recover from a validation error" UX.
      setValidationError(null)
      setState(prev => {
        // Step 0 (product type) — the optionId is the branch
        // id. Reset selections (picking a new branch discards
        // the previous one's selections) and advance to the
        // first branch step.
        if (stepId === 'product-type') {
          const next: WizardState = {
            ...prev,
            branch: optionId as WizardBranchId,
            currentStep: 1,
            selections: {},
          }
          return advancePastSkippedSteps(next)
        }
        // All other steps: write the decoded selection and
        // advance to the next step. Smart-skip is then
        // applied so the user never lands on a hidden step.
        const decoded = decodeSelection(stepId, optionId)
        const next: WizardState = {
          ...prev,
          currentStep: prev.currentStep + 1,
          selections: { ...prev.selections, ...decoded },
        }
        return advancePastSkippedSteps(next)
      })
    },
    [
      advancePastSkippedSteps,
      decodeSelection,
      beginExecution,
      // Week 7: the Start-step branch reads the current
      // `state.branch` + `state.selections` for validation.
      // Adding them to deps re-creates the callback on every
      // state mutation, which is fine — the Wizard's re-render
      // is cheap and the per-step state is already re-derived
      // from the parent's `state` prop on every change.
      // `validateWizardSelections` is a stable named
      // import (the helper is pure — no React, no DOM, no
      // store reads — see `stores/wizardTypes.ts:336-339`).
      state.branch,
      state.selections,
    ]
  )

  const onEdit = useCallback(
    (stepId: string) => {
      // Week 4 (§8.1) — re-edit during Stage 2.
      //
      // A medical-marijuana user mid-batch who realises they
      // set the wrong temperature should NOT be forced back
      // to Stage 1 from a "stuck" state — that breaks the
      // procedure. Per the architecture doc §8.1, the
      // WizardScreen handles the in-flight Stage 2 edit in a
      // three-step sequence:
      //
      //   1. Recompute the affected Stage 2 steps BEFORE
      //      rewinding the user back to Stage 1. The
      //      `recomputeFromEdit` action flips
      //      `isRecalculating: true` then `false` so the
      //      stepper shows a brief "recalculating..." flash on
      //      every row whose id is in `affectedStepIds`. For a
      //      Flower batch every Stage 2 step depends on
      //      `selections.method` + `selections.weight`, so the
      //      safe Week 4 default is the full Flower list:
      //      preheat, heatmap, timer, transition. (An empty
      //      array is also valid — the stepper treats it as
      //      "all steps affected" — but the explicit list is
      //      the contract for Week 4. A future engine
      //      integration can compute the precise affected set
      //      from the re-edited selection's downstream graph.)
      //   2. `returnToConfig()` clears the `execution` slice
      //      but preserves the Stage 1 selections so the user
      //      can re-edit a single step + re-tap "Begin batch"
      //      to resume.
      //   3. Rewind `currentStep` to the re-edited step's
      //      index in the EFFECTIVE sequence. Existing logic.
      //
      // The `execution.currentStepId !== null` check is the
      // canonical "Stage 2 is in flight" sentinel — when the
      // user is still on Stage 1 (no execution entered yet),
      // the existing rewind logic is enough; no recompute is
      // needed because no Stage 2 rows exist to re-derive.
      if (execution.currentStepId !== null) {
        recomputeFromEdit([
          STAGE2_STEP_IDS.preheatDecarb,
          STAGE2_STEP_IDS.heatmapDecarb,
          STAGE2_STEP_IDS.timerDecarb,
          STAGE2_STEP_IDS.transitionDecarb,
        ])
        returnToConfig()
      }
      setState(prev => {
        // Re-editing a step sets `currentStep` to that step's
        // index in the EFFECTIVE sequence (smart-skip filtered).
        // We resolve the index dynamically so the user's
        // re-edit lands on the right step even after the
        // Flower "no infusion" path trimmed the Volume step.
        if (prev.branch === null) {
          if (stepId === 'product-type') {
            return { ...prev, currentStep: 0 }
          }
          return prev
        }
        const effective = getEffectiveBranchSequence(prev.branch, prev)
        if (!effective) return prev
        const idx = effective.findIndex(s => s.id === stepId)
        if (idx < 0) return prev
        return { ...prev, currentStep: idx }
      })
    },
    [execution.currentStepId, recomputeFromEdit, returnToConfig]
  )

  const onReset = useCallback(() => {
    setState(DEFAULT_WIZARD_STATE)
  }, [])

  // Week 4 — wire `decarb.presetId` on entry to the
  // `timer-decarb` step. The wrapped `Timer` widget
  // (`src/renderer/src/components/Timer.tsx`) reads
  // `appStore.decarb.presetId` from the store and shows only
  // that method's start button when a preset is active (the
  // 2026-07-26 P5 pre-fill behavior). When the user reaches
  // the `timer-decarb` step in Stage 2, the wizard should
  // set `decarb.presetId` to the picked method's id so the
  // widget shows the right method. The wrapped
  // `TimerWidget` doesn't auto-start when the preset matches
  // (per the brief — the user taps the start button
  // themselves); the Week 4 wiring is just "make the right
  // method visible".
  //
  // The effect is keyed on `currentStepId` so it only fires
  // on entry to the timer step (not on every re-render).
  // When the user leaves the step (advances to
  // `transition-decarb`, taps "Back to config", etc.),
  // `currentStepId` changes and the effect is a no-op
  // because the dependency no longer matches
  // `STAGE2_STEP_IDS.timerDecarb`.
  const setDecarb = useAppStore(s => s.setDecarb)
  useEffect(() => {
    if (execution.currentStepId !== STAGE2_STEP_IDS.timerDecarb) return
    // `selections.method` is the user's Stage 1 method
    // pick. It's the same id the `Timer` widget's
    // `activeMethod` selector keys on (see `Timer.tsx`),
    // so writing it to `decarb.presetId` lights up the
    // right method's start button. We do NOT also call
    // `setTimer({ active: true, ... })` — the user has to
    // tap the start button themselves (the Week 4 brief
    // is explicit about this: "the user can tap the start
    // button themselves. The Week 4 wiring is just 'make
    // the right method visible', not 'auto-start the
    // countdown'").
    const picked = state.selections.method
    if (!picked) return
    setDecarb({ presetId: picked })
  }, [execution.currentStepId, state.selections.method, setDecarb])

  /**
   * Stage 2 → Stage 1 transition (Week 3). The store's
   * `returnToConfig` action clears the `execution` slice but
   * preserves the Stage 1 selections (which live on a different
   * code path in this Week 2+ build — local React state). To
   * give the user a usable Stage 1 view on return, we also
   * reset the local `currentStep` index to the Start step of
   * the canonical sequence so the "Begin batch" CTA is visible
   * again. The selections (branch, method, container, etc.)
   * are intentionally preserved so the user can re-edit a
   * single step via the existing `onEdit` path or re-tap
   * "Begin batch" to resume the same Stage 2 run.
   */
  const onBackToConfig = useCallback(() => {
    returnToConfig()
    setState(prev => {
      if (prev.branch === null) return prev
      const canonical = BRANCH_SEQUENCES[prev.branch] ?? []
      // The Start step sits at `canonical.length - 1`. Drop
      // `currentStep` to that index so the user lands on the
      // Start step (with its "Begin batch" CTA) instead of the
      // post-confirm "Batch ready" badge.
      return { ...prev, currentStep: Math.max(0, canonical.length - 1) }
    })
  }, [returnToConfig])

  // Week 5 (§8.5) — recipe name local state. Holds the
  // user-typed value from `NameRecipeStep`. Initialised to
  // `''`; the NameRecipeStep falls back to the derived
  // default when the input is empty. The state lives here
  // (not in the `wizard.stage1Selections` slice) because the
  // name is a Stage 2 artifact, not a Stage 1 selection — the
  // Stage 1 wizard's "branch / method / weight / fat / volume
  // / servings" contract is the source of truth for the
  // re-derivable inputs, and the recipe name is the user-facing
  // label that the completion step writes to the saved
  // Recipe. The brief is explicit on this: the local state
  // survives the same render cycle as the Stage 1 selections
  // (until `resetWizard`), but is not persisted to the slice
  // (no `selections.name` round-trip through the store).
  // Re-edits in Stage 1 (the §8.1 path) clear this local
  // state implicitly because the user has not yet re-typed a
  // name — the new Stage 2 run starts with the default name
  // again, which is the desired behaviour per §8.5
  // ("user can change later from the Dashboard").
  const [name, setName] = useState<string>('')

  // Week 5 (§8.2) — selectors for the completion save flow.
  // `addJournalEntry` is the existing Stage 0 / Quick Batch
  // entry-point; the Stage 2 completion step uses the same
  // action to write a `JournalEntry` for the batch. The
  // entry is generated client-side (matching QuickBatchTab's
  // `entry_<ts>_<rand>` id shape) so we can capture the id
  // without re-reading the store on the next render.
  // `addRecipe` and `setRecipeJournalEntry` are the Week 5
  // Recipe-slice actions (state-routing rein, commit
  // cae0f30). The return-id shape of `addRecipe` is the
  // canonical wire for the journal-link chain.
  const addJournalEntry = useAppStore(s => s.addJournalEntry)
  const addRecipe = useAppStore(s => s.addRecipe)
  const setRecipeJournalEntry = useAppStore(s => s.setRecipeJournalEntry)

  /**
   * Week 5 (§8.2) — Stage 2 completion save flow.
   *
   * The completion step's "Save to Journal" CTA fires this
   * callback. The flow is the canonical QuickBatchTab
   * save-site pattern (§8.2: "JournalEntry first, then
   * Recipe, then link"):
   *
   *   1. Build a `JournalEntry` mirroring the QuickBatchTab
   *      save site (`src/renderer/src/tabs/QuickBatchTab.tsx:
   *      281-294`). The wizard-side selection fields map
   *      directly to the journal entry's per-field values;
   *      the engine-derived totals (thcMg, mgPerServing,
   *      classification) come from the `computedTotals`
   *      computed in the render block below.
   *   2. `useAppStore.getState().addJournalEntry(entry)` —
   *      prepends to `state.journalEntries`. The new entry
   *      is at index 0; we read `journalEntries[0].id` to
   *      capture the entry id for the link step.
   *   3. `useAppStore.getState().addRecipe({ name, branch,
   *      selections, batchJournalEntryId: null })` — writes
   *      the Recipe record with the link deferred. The
   *      action returns the generated recipe id.
   *   4. `useAppStore.getState().setRecipeJournalEntry(
   *      recipeId, entryId)` — patches the Recipe's
   *      `batchJournalEntryId` field.
   *   5. `completeExecutionStep(STAGE2_STEP_IDS.completion,
   *      '')` — marks the completion step done. The empty
   *      next-step id is the canonical "no successor" signal
   *      for the stepper; the stepper treats the absence of
   *      a next step as "Stage 2 is finished".
   *
   * The flow is wrapped in try/catch around the engine
   * derivations only — the store dispatches are
   * synchronous zustand `set()` calls and don't throw. A
   * future IPC-bridge write (the IDB mirror called out in
   * §7 Week 5) can be slotted between steps 4 and 5; the
   * call site is intentionally narrow so the add+link
   * pattern is preserved.
   */
  const handleCompletionSave = useCallback(() => {
    // Resolve the engine inputs from the Stage 1 wizard's
    // selections. Each lookup is defensive — the test that
    // mounts the completion step directly (Test 4 in
    // `Stage2Infusion.test.tsx`) sets the selections
    // explicitly, but a real user reaching the completion
    // step has walked the full wizard and the lookup
    // should never miss.
    const method = DECARB_METHODS.find(m => m.id === state.selections.method)
    const fat = state.selections.fat
      ? INFUSION_FATS.find(f => f.id === state.selections.fat)
      : undefined
    // Per the brief: thcMg = the infused THC mg; cbdMg = 0
    // (no CBD engine call in the brief scope); servings =
    // selections.servings ?? 0. The engine signature is
    // `calculateInfusedThc(decarbedThc, extractionEff)`. The
    // brief's pseudocode (method.efficiency.expected *
    // selections.weight.value * 10) is a hand-wavy
    // approximation that we use verbatim — the wizard does
    // not capture `thcaPct` in the Stage 1 selections, so
    // any more precise formula would need a new Stage 1
    // field (out of scope for Week 5). The §8.5 contract
    // pins the displayed value to a reasonable estimate;
    // the user's saved Recipe retains the full selections
    // payload for re-derivation when a more accurate
    // engine integration lands in Week 6+.
    const weightG = state.selections.weight?.value ?? 0
    const decarbedProxyMg = (method?.efficiency.expected ?? 0) * weightG * 10
    const infusedThcMg =
      fat && decarbedProxyMg > 0
        ? calculateInfusedThc(decarbedProxyMg, fat.extractionEff)
        : 0
    const servings = state.selections.servings ?? 0
    const mgPerServing =
      servings > 0 && infusedThcMg > 0
        ? calculateMgPerServing(infusedThcMg, servings)
        : 0

    // Build the JournalEntry. The shape mirrors
    // QuickBatchTab.tsx:281-294: an `entry_<ts>_<rand>` id,
    // today's date as ISO date, the wizard's selections
    // mapped to the entry's per-field authoring values, and
    // a `source: 'quickbatch'` provenance tag. The wizard is
    // a new save site; the existing `JournalEntrySource`
    // union (state-routing-owned, see appStore.ts:432-438)
    // does not include a `'wizard'` literal yet — adding
    // one would be a state-routing scope change. The
    // closest semantic match is `'quickbatch'`, which the
    // QuickBatchTab save site also stamps for batches made
    // through the legacy UI. A future commit can widen the
    // union to add `'wizard'` and have the Journal card
    // group wizard-driven entries separately.
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const weight = state.selections.weight
    const volume = state.selections.volume
    const today = new Date().toISOString().split('T')[0]
    const entry = {
      id: entryId,
      date: today,
      source: 'quickbatch' as const,
      strainName: '',
      strainId: null,
      materialWeight: String(weightG),
      materialWeightUnit: weight?.unit ?? 'g',
      thcaPct: '0',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      methodId: state.selections.method ?? '',
      methodName: method?.name ?? '',
      fatId: state.selections.fat ?? '',
      fatName: fat?.name ?? '',
      servings: String(servings),
      mgPerServing: mgPerServing > 0 ? String(mgPerServing) : '0',
      classification: '',
      totalInfusedThc: String(infusedThcMg),
      concentration: '0',
      volume: volume ? String(volume.value) : '0',
      volumeUnit: volume?.unit ?? 'mL',
      notes: `Stage 2 batch. Recipe: ${name || 'Untitled recipe'}`,
    }
    // 1. Write the journal entry. The action prepends to
    //    `state.journalEntries`; the new entry is at index 0.
    addJournalEntry(entry)
    // 2. Read back the entry id from the store. We
    //    generated `entryId` ourselves, so `journalEntries[0]
    //    .id === entryId` — the read is defensive
    //    (a future action that mutates the id format would
    //    not break the link), and it's the contract the brief
    //    calls out ("the new entry is at index 0").
    const writtenEntry = useAppStore.getState().journalEntries[0]
    const journalEntryId = writtenEntry?.id ?? entryId
    // 3. Write the Recipe. The brief calls for
    //    `batchJournalEntryId: null` on the initial write
    //    (the link is patched in the next step). The `branch`
    //    cast is structural — both `WizardBranchId` (this
    //    file's source of truth) and `ProductType` (the
    //    store-side Recipe type) are the same union, but
    //    they're declared in different files; the cast keeps
    //    the contract explicit.
    const recipeId = addRecipe({
      name: name || 'Untitled recipe',
      branch: state.branch as Parameters<typeof addRecipe>[0]['branch'],
      selections: state.selections as Parameters<
        typeof addRecipe
      >[0]['selections'],
      batchJournalEntryId: null,
    })
    // 4. Patch the link.
    setRecipeJournalEntry(recipeId, journalEntryId)
    // 5. Mark the completion step done. The empty next-step
    //    id is the canonical "Stage 2 is finished" signal
    //    for the stepper.
    completeExecutionStep(STAGE2_STEP_IDS.completion, '' as string)
  }, [
    state.selections,
    state.branch,
    name,
    addJournalEntry,
    addRecipe,
    setRecipeJournalEntry,
    completeExecutionStep,
  ])

  /**
   * Week 7 (§8.2) — handle the CompletionStep's "Run again"
   * CTA. The CTA fires `onRerun` from `ExecutionStepper`; this
   * callback is the WizardScreen-side wiring. The flow:
   *   1. Look up the "current" Recipe in the store by matching
   *      (branch, selections) against the live Stage 1 state.
   *      The "current" Recipe is the one the user just saved
   *      via `handleCompletionSave` — it has the same
   *      `selections` reference (the save flow passes
   *      `state.selections` directly to `addRecipe`, and
   *      `addRecipe` does not deep-copy the field —
   *      `appStore.ts:1715-1727`). The `===` identity check
   *      is therefore correct; a deep-equal fallback would
   *      be more permissive but unnecessary in the current
   *      implementation.
   *   2. Call `useAppStore.getState().rerunRecipe(candidate.id)`
   *      to copy the recipe's selections back into the Stage 1
   *      wizard state and reset `currentStep` + `execution`.
   *      If the action returns `null` (the recipe was deleted
   *      between the lookup and the call — a defensive edge
   *      case), console.error and bail.
   *   3. Set the local `name` state to the returned recipe's
   *      `name` so the new draft has the same name. The
   *      NameRecipeStep reads `initialName` on re-mount, so
   *      the user sees the same name when they re-reach the
   *      Start step in the new run.
   *   4. Call `useAppStore.getState().returnToConfig()` to
   *      ensure the execution slice is cleared (defensive —
   *      `rerunRecipe` already clears it; the second call is
   *      a no-op for state but a documented contract anchor
   *      from the brief).
   */
  const handleRerun = useCallback(() => {
    // 1. Find the current recipe by (branch, selections)
    //    identity.
    const recipes = useAppStore.getState().recipes
    const candidate = recipes.find(
      r =>
        r.branch === state.branch &&
        r.selections === state.selections
    )
    if (!candidate) {
      // Defensive: no matching recipe in the store. This
      // shouldn't happen in the normal flow (the user just
      // saved a Recipe in `handleCompletionSave`), but a
      // future code path that re-uses the CompletionStep's
      // onRerun without a prior save (e.g. a Dashboard
      // rerun-from-card) would land here. Log and bail.
      console.error(
        '[WizardScreen] handleRerun: no matching recipe found in store',
        { branch: state.branch, selections: state.selections }
      )
      return
    }
    // 2. Call rerunRecipe. Returns null if the recipe was
    //    deleted between the lookup and the call (a tighter
    //    edge case — the test for this lives in Test 5 of
    //    `Stage2Validation.test.tsx`).
    const rerun = useAppStore.getState().rerunRecipe(candidate.id)
    if (rerun === null) {
      console.error(
        '[WizardScreen] handleRerun: rerunRecipe returned null for',
        candidate.id
      )
      return
    }
    // 3. Set the local name to the rerun recipe's name.
    setName(rerun.name)
    // 4. Return to config (defensive — clears execution).
    returnToConfig()
  }, [state.branch, state.selections, returnToConfig])

  /**
   * Week 5 (§8.2) — computed totals for the completion step.
   *
   * Memoised so the recomputation only fires when a
   * Stage 1 selection changes (the user re-edits mid-batch
   * via the §8.1 rewind) or when the user-typed name
   * changes. A re-render that doesn't change inputs returns
   * the same `ComputedTotals` object reference, so the
   * stepper's per-step diff (the §8.1 "recalculating..."
   * badge) doesn't flash on every re-render.
   */
  const computedTotals = useMemo(() => {
    const method = DECARB_METHODS.find(m => m.id === state.selections.method)
    const fat = state.selections.fat
      ? INFUSION_FATS.find(f => f.id === state.selections.fat)
      : undefined
    const weightG = state.selections.weight?.value ?? 0
    const decarbedProxyMg = (method?.efficiency.expected ?? 0) * weightG * 10
    const thcMg =
      fat && decarbedProxyMg > 0
        ? calculateInfusedThc(decarbedProxyMg, fat.extractionEff)
        : 0
    const servings = state.selections.servings ?? 0
    return { thcMg, cbdMg: 0, servings }
  }, [state.selections])

  // When the flag is off, render nothing. The existing
  // GroupedTabNav takes over. This early return is AFTER every
  // hook call above.
  if (!enabled) {
    return null
  }

  // Resolve the effective sequence for the current state.
  // Used to compute `isOnStartStep` and the test-friendly
  // "start step active" check below.
  const effectiveSteps = state.branch
    ? (getEffectiveBranchSequence(state.branch, state) ?? [])
    : []
  const isOnStartStep =
    effectiveSteps.length > 0 &&
    state.currentStep === effectiveSteps.length - 1 &&
    effectiveSteps[effectiveSteps.length - 1]?.id === 'start'
  // Pre-compute the canonical sequence length for the
  // "completed" badge on the Finish section. The user has
  // finished the wizard when they are on the start step
  // (terminal CTA) OR when `currentStep` is past the end of
  // the canonical sequence (post-confirm state).
  const canonicalSteps = state.branch
    ? (BRANCH_SEQUENCES[state.branch] ?? [])
    : []
  const isFinished =
    state.currentStep >= canonicalSteps.length && canonicalSteps.length > 0

  return (
    <div
      className={cn('flex w-full flex-col gap-4 p-2 sm:p-4', className)}
      data-testid="wizard-screen"
    >
      {/* Header — title + reset link. The "Make a batch" header
          stays; only the collapsed future steps below the
          active step were the problem. Slide 4 of v2.2. */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-foreground">
            Make a batch
          </h2>
          <p className="text-xs text-foreground/60">
            Answer a few questions and the calculator will set itself up.
          </p>
        </div>
        <button
          aria-label="Reset wizard"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          data-testid="wizard-reset"
          onClick={onReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset wizard
        </button>
      </header>

      {/* The wizard — slide-by-slide, ONE step in view at a
          time. No collapsed future steps below the active
          step. Slide 4 of v2.2. */}
      <Wizard onSelect={onSelect} state={state} />

      {/* Terminal CTA — the "Begin batch" button. Rendered as a
          separate section below the wizard stack so the user has
          a single, prominent call-to-action when they reach the
          Start step. For Week 2 the click is a no-op (the Stage
          2 stepper lands in week 3). */}
      {isOnStartStep ? (
        <section
          aria-label="Begin batch"
          className="flex flex-col items-stretch gap-2 rounded-xl border border-accent/30 bg-accent/10 p-4"
          data-testid="wizard-begin-section"
        >
          <h3 className="text-sm font-semibold text-foreground">
            Ready to start your batch
          </h3>
          <p className="text-xs text-foreground/70">
            Your selections are saved. Begin the batch to move to the execution
            view.
          </p>
          {/* Week 7 — validation error. Renders inline next to
              the CTA when the Begin batch tap fails the §3.4
              per-branch validation (Step 2) or the
              empty-branch guard (Step 3). `role="alert"` +
              `aria-live="assertive"` so a screen reader
              announces the error as soon as it appears (the
              doc's §7 a11y polish mandate). The visual token
              is `danger` to match the existing `<Toast>`
              component's `danger` variant — see `Toast.tsx`. */}
          {validationError ? (
            <div
              aria-live="assertive"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
              data-testid="wizard-validation-error"
              role="alert"
            >
              {validationError}
            </div>
          ) : null}
          <button
            aria-label="Begin batch"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 self-end rounded-lg bg-accent/40 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/55"
            data-testid="wizard-begin-cta"
            onClick={() => onSelect('start', 'begin')}
            type="button"
          >
            Begin batch
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </section>
      ) : null}

      {/* Week 5 (§8.5) — the "Name this recipe" inline card.
          Renders the NameRecipeStep AFTER the "Begin batch"
          CTA section, visible only when the user is on the
          Start step. The component owns its own input state;
          the wizard's local `name` state is the canonical
          value that the Stage 2 completion step reads when
          saving the Recipe. The user can edit the name
          freely here; the Stage 1 selections (branch / method
          / weight / fat / volume / servings) are NOT
          affected, so re-running Stage 2 from the same
          config keeps the user's name unless they change it.

          The component is rendered with `initialName={name}`
          so re-mounts (e.g. after a §8.1 rewind) preserve the
          user's typed value across the same Stage 2 run. A
          future "Run again" CTA on the completion step can
          pre-load a saved Recipe's name into the same local
          state via a different wiring path; for Week 5 the
          initial value is `''` and the NameRecipeStep
          falls back to the derived default. */}
      {isOnStartStep ? (
        <NameRecipeStep
          initialName={name}
          onSave={setName}
          selections={state.selections}
        />
      ) : null}

      {/* Post-finish badge — rendered when the user has
          confirmed the Begin batch CTA. For Week 2 this was
          informational ("Stage 2 lands in week 3"); Week 3 (this
          commit) updates the copy to point at the now-mounted
          Stage 2 stepper below. The Stage 1 view stays mounted
          for the duration of the batch so the user can re-edit
          a single step and re-run Stage 2 without re-filling
          the wizard. */}
      {isFinished ? (
        <section
          aria-label="Batch ready"
          className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/10 p-4"
          data-testid="wizard-finished-section"
        >
          <h3 className="text-sm font-semibold text-success">
            Batch configuration complete
          </h3>
          <p className="text-xs text-foreground/70">
            Your selections are saved. The Stage 2 execution stepper is below —
            tap &ldquo;Back to config&rdquo; in the stepper to return here.
          </p>
        </section>
      ) : null}

      {/* Stage 2 — Execution stepper. Mounted when the user has
          tapped "Begin batch" (which calls `beginExecution` on the
          store). The gate is `state.branch && execution.currentStepId`:
          the builder needs a branch to know which steps to render,
          and `currentStepId` is the canonical "Stage 2 is live"
          sentinel. The stepper's `steps` prop is the builder's
          output with `isCurrent` + `isComplete` stamped from the
          store's `execution` slice — the builder itself stays
          pure (see `stage2Steps.ts` JSDoc). The branch is
          captured into a local constant so the callbacks below
          can pass it to `buildExecutionSteps` without a
          non-null assertion (TypeScript can't narrow `state.branch`
          inside an inline closure, only at the render site). */}
      {(() => {
        const branch = state.branch
        if (!branch || !execution.currentStepId) return null
        const steps = buildExecutionSteps(branch, state.selections)
        return (
          <ExecutionStepper
            // Week 4 (§8.1): the stepper's `isRecalculating`
            // + `affectedStepIds` props drive the
            // "recalculating..." badge on the affected rows.
            // The store's `execution` slice is the source of
            // truth; the `ExecutionStepper` itself is
            // presentation-only and reads the values as props
            // (design-system rein, Week 4). When
            // `recomputeFromEdit` runs, the
            // synchronous on-then-off pattern lets the stepper
            // show a brief flash without the WizardScreen
            // needing to manage the timing itself.
            affectedStepIds={execution.affectedStepIds}
            isRecalculating={execution.isRecalculating}
            onBack={onBackToConfig}
            // Week 7 (§8.2) — wire the CompletionStep's
            // "Run again" CTA. `ExecutionStepper` bubbles
            // the `onRerun` from its `CompletionStep` shell
            // up through `PhaseGroup` → `ExecutionStepRow`;
            // the WizardScreen-side `handleRerun` calls
            // `appStore.rerunRecipe(...)` to copy the
            // current recipe's selections back into Stage 1
            // and `returnToConfig()` to exit Stage 2.
            onRerun={handleRerun}
            onComplete={stepId => {
              // Week 5 (§8.2) — the completion step's
              // "Save to Journal" CTA fires the
              // journal-then-recipe save flow instead of the
              // generic "advance to the next step" path. The
              // handler runs the addJournalEntry +
              // addRecipe + setRecipeJournalEntry chain (see
              // `handleCompletionSave` JSDoc) and then marks
              // the completion step done via
              // `completeExecutionStep` with `''` as the
              // next-step id (the canonical "Stage 2 is
              // finished" sentinel). Other steps keep the
              // existing advance-to-next logic.
              if (stepId === STAGE2_STEP_IDS.completion) {
                handleCompletionSave()
                return
              }
              // Resolve the next step from the same builder
              // the stepper is using. `buildExecutionSteps` is
              // pure so the call is cheap and the result is
              // stable for a given (branch, selections) pair.
              // When there is no next step (e.g. the heatmap
              // completes the batch), `nextStep?.id` is
              // `undefined` and the store's defensive guard
              // (`currentStepId !== stepId`) keeps the action
              // a no-op on the next render.
              const idx = steps.findIndex(s => s.id === stepId)
              const nextStep = steps[idx + 1]
              completeExecutionStep(stepId, nextStep?.id as string)
            }}
            onSkip={stepId => {
              const idx = steps.findIndex(s => s.id === stepId)
              const nextStep = steps[idx + 1]
              skipExecutionStep(stepId, nextStep?.id as string)
            }}
            selections={state.selections}
            steps={steps.map(step => {
              // Week 5 (§8.2) — the completion step's
              // `recipeName` + `computedTotals` come from
              // local state + memoised engine output, not
              // from the builder. The builder returns
              // placeholders (see `stage2Steps.ts` JSDoc);
              // the wizard overwrites them here on every
              // render so a re-edit (the §8.1 path)
              // re-derives the totals and a name change
              // flows through to the completion card
              // without a store round-trip. Other steps
              // keep the existing `isCurrent` /
              // `isComplete` stamping only.
              if (step.id === STAGE2_STEP_IDS.completion) {
                return {
                  ...step,
                  isCurrent: step.id === execution.currentStepId,
                  isComplete: execution.completedStepIds.includes(step.id),
                  recipeName: name,
                  computedTotals,
                }
              }
              return {
                ...step,
                isCurrent: step.id === execution.currentStepId,
                isComplete: execution.completedStepIds.includes(step.id),
              }
            })}
          />
        )
      })()}
    </div>
  )
}
