/**
 * Wizard types — shared contract for the Stage 1 configuration wizard.
 *
 * The canonical contract lives in `src/renderer/src/stores/wizardTypes.ts`
 * (owned by state-routing). This file mirrors the wizard rein's
 * local types for components that don't need the store-side
 * helpers (e.g. `validateWizardSelections`, `ExecutionStepState`).
 *
 * Scope (per `docs/wizard-architecture-2026-07-26.md` §7): all 5
 * branches are end-to-end wired (Flower / Concentrate / AVB /
 * Edible / Topical). The "Coming in week 2" placeholder was
 * removed in Week 7's full-codebase-review.
 */
import type { LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Branch taxonomy (§3.1)                                              */
/* ------------------------------------------------------------------ */

/**
 * The five product-type branches. `null` means "no branch picked yet"
 * — the wizard is on the product-type picker (step 0).
 */
export type WizardBranchId =
  | 'flower'
  | 'concentrate'
  | 'avb'
  | 'edible'
  | 'topical'

/* ------------------------------------------------------------------ */
/* Selections (per-branch)                                             */
/* ------------------------------------------------------------------ */

/**
 * `selections` is the per-step user input. The shape mirrors the
 * section-3.3 architecture doc. All 5 branches are end-to-end
 * wired (see `branchSequences.ts` for the per-branch step lists).
 *
 * The `name` field is the §8.5 "Name this recipe" value (the
 * Stage 1 inline card the user fills in before the Begin
 * batch CTA). It's part of the local wizard rein's
 * `WizardSelections` shape but is also wired into the
 * `Recipe` slice when the user saves a batch (see
 * `src/renderer/src/stores/wizardTypes.ts` + the
 * `NameRecipeStep` component for the canonical contract).
 */
export interface WizardSelections {
  method?: string
  container?: string
  weight?: { value: number; unit: 'g' | 'oz' }
  efficiency?: number
  /**
   * Fat type for infusion. `null` is the brief-mandated sentinel for
   * the Flower branch's "No infusion" path (§3.1 — the user picks
   * the 'none' tile on the Fat step, `selections.fat = null`, and the
   * Volume step's smart-skip filters it out). `undefined` means the
   * step hasn't been answered yet.
   */
  fat?: string | null
  volume?: { value: number; unit: 'mL' | 'cup' | 'tsp' | 'tbsp' }
  servings?: number
  potency?: number
  color?: 'light' | 'medium' | 'dark'
  applicationArea?: string
  carrier?: string
  /** The §8.5 "Name this recipe" value the user typed into
   *  the NameRecipeStep card. */
  name?: string
}

/**
 * The Stage 1 wizard state. The persistent copy lives in the
 * `appStore.wizard` slice (state-routing rein — see
 * `src/renderer/src/stores/appStore.ts`); this local type
 * mirrors the slice shape for components that don't need
 * the store's actions. The store-side `WizardState` adds
 * runtime-only fields (the `execution` sub-slice, the
 * `stepHistory` for back-button support, the Stage 2
 * routing).
 */
export interface WizardState {
  branch: WizardBranchId | null
  /** Index into the branch sequence (0 = product-type step). */
  currentStep: number
  selections: WizardSelections
}

/* ------------------------------------------------------------------ */
/* Step + option types (§3.4)                                          */
/* ------------------------------------------------------------------ */

export interface WizardOption {
  /** Unique id; used as the selection value. */
  id: string
  /** 1-line summary shown on the option tile. */
  title: string
  /** Subtitle / 1-line brief shown under the title. */
  subtitle: string
  /** Optional lucide-react icon. */
  icon?: LucideIcon
  /**
   * Optional badge text. The architecture doc specifies two badges
   * for Week 1: "Beginner-friendly" and "Best match". The badge is
   * rendered on the tile in a small pill.
   */
  badge?: string
  /**
   * Optional plain-language tooltip expanded by the
   * ProductTypeTooltip expander. The architecture doc only requires
   * this for the product-type step (where every option has a
   * "what does this mean?" definition), but the field is available
   * on every option for future steps that want one.
   */
  tooltip?: string
}

/**
 * A single step in the wizard. Declarative per the architecture doc
 * §3.4 — the wizard's step sequence is `branches[state.branch].steps`,
 * and the wizard can reconfigure per branch without code changes.
 *
 * `validate` and `skipIf` are called by the runtime on every
 * `getEffectiveBranchSequence` invocation (the smart-skip
 * projection in `branchSequences.ts`). They are declared on
 * the type so the wizard can reconfigure per branch without
 * changing the container.
 */
export interface WizardStep {
  id: string
  title: string
  /** 1-line "what this means" for beginners. */
  description: string
  /** Returns the options for the current step. Stateful — re-runs
   * on every render so `state` can influence the option list. */
  getOptions: (state: WizardState) => WizardOption[]
  /**
   * Returns the option id of the currently-selected option for
   * this step, or `null` if no selection has been made. Optional —
   * the rendering container falls back to `null` when absent.
   *
   * Lives on the step so each step owns its own selection-encoding
   * (e.g. the Weight step encodes `{ value, unit }` as
   * `${unit}-${value}`; the Method step reads `selections.method`
   * directly). The container no longer needs a hardcoded
   * step-id → selection-key switch.
   */
  getSelectedOptionId?: (state: WizardState) => string | null
  /** Returns true if the step's selection is valid. */
  validate?: (state: WizardState) => boolean
  /** Returns true if the step should be hidden for the current
   * branch (smart-skip per §3.1). */
  skipIf?: (state: WizardState) => boolean
}

/* ------------------------------------------------------------------ */
/* Step card states (§3.2)                                             */
/* ------------------------------------------------------------------ */

/**
 * The three visual states a StepCard can take. Matches the
 * architecture doc §3.2 exactly:
 * - `collapsed`: not yet active, grayed-out preview
 * - `active`: currently being decided, full card with options
 * - `collapsed-with-selection`: done, green check + chosen option
 */
export type WizardStepCardState =
  | 'collapsed'
  | 'active'
  | 'collapsed-with-selection'

/* ------------------------------------------------------------------ */
/* Default state                                                       */
/* ------------------------------------------------------------------ */

export const DEFAULT_WIZARD_STATE: WizardState = {
  branch: null,
  currentStep: 0,
  selections: {},
}
