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
 *
 * 2026-07-28 update: the wizard is now driven by a `getNextStep`
 * DAG (see `wizardFlow.ts`) rather than per-branch sequence
 * arrays. The DAG's step ids are declared here as `WizardStepId`
 * so both the flow module and the screen can import the closed
 * union without a circular dependency on `wizardFlow.ts`. The
 * end product + starting material are split into two separate
 * fields (`endProduct` + `branch`) so a user can pick any
 * combination (e.g. Baked + Flower, Tincture + AVB).
 */
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EndProductId } from 'renderer/src/components/EndProductCoverflow'

/* ------------------------------------------------------------------ */
/* Branch taxonomy (§3.1)                                              */
/* ------------------------------------------------------------------ */

/**
 * The five starting-material branches. `null` means "no branch
 * picked yet" — the wizard is on the product-type picker.
 *
 * The branch is now set by the Material step (the user's choice
 * of starting material), not the end-product coverflow. The
 * coverflow sets `endProduct`; the Material step sets `branch`.
 * The two are independent: a user can pick "Baked" + "Flower"
 * (canonical edible+flower batch) OR "Tincture" + "Concentrate"
 * (concentrate-based tincture).
 */
export type WizardBranchId =
  | 'flower'
  | 'concentrate'
  | 'avb'
  | 'edible'
  | 'topical'

/* ------------------------------------------------------------------ */
/* Step IDs (DAG)                                                      */
/* ------------------------------------------------------------------ */

/**
 * The 14 step ids the dynamic `getNextStep` DAG returns. Listed
 * as a closed union so the Wizard's STEP_MAP (`steps.ts`) can
 * be a `Record<WizardStepId, WizardStep>` and TypeScript can
 * guarantee the map covers every reachable step.
 *
 * The id is the canonical key for both the step definition
 * (`steps.ts`) and the wizard state's `currentStepId`. `null`
 * means "past the Start step" (the wizard is finished; the
 * Stage 2 stepper is mounted).
 */
export type WizardStepId =
  | 'product-type'
  | 'material'
  | 'method'
  | 'container'
  | 'weight'
  | 'efficiency'
  | 'potency'
  | 'color'
  | 'fat'
  | 'carrier'
  | 'volume'
  | 'servings'
  | 'app-area'
  | 'name'
  | 'start'

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
  /**
   * Container id from the v2.3 wizard. Two vacuum bag widths
   * (`vac-19`, `vac-28`) — the user picks the width and the
   * engine derives the length from the material amount. The
   * legacy `BAG_PRESETS` ids (gallon, quart, etc.) are still
   * accepted by the decoder for the engine tests + the
   * legacy data flows, but the wizard's UI is the 2-width
   * carousel.
   */
  container?: string
  /**
   * Width of the chosen vacuum bag in cm. The 2-width carousel
   * (19cm / 28cm) sets this when the user taps a tile. The
   * engine's `getRequiredBagLengthCm(weight, width)` uses it
   * to compute the minimum bag length for the user's amount.
   */
  containerWidthCm?: number
  /**
   * Calculated minimum bag length in cm. Set by the wizard
   * when the user picks a Weight; the engine re-derives it
   * any time the weight changes. Used by Stage 2 / dosing
   * derivations downstream.
   */
  containerLengthCm?: number
  /**
   * Sous vide double-bag interjection answer. `true` when
   * the user confirmed they're using an outer bag for
   * sous vide (the engine's `recommendDoubleBag` heuristic
   * also flags this when method is sous vide + width is
   * 19cm). `false` when the user explicitly chose a single
   * bag. `undefined` when the interjection hasn't fired
   * yet (i.e. user picked a non-sous-vide method, or picked
   * a 28cm bag where double-bagging isn't recommended).
   */
  doubleBagged?: boolean
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
 *
 * 2026-07-28 update: the `currentStep` (numeric index)
 * field is dropped in commit 5. The DAG's `getNextStep`
 * (see `wizardFlow.ts`) computes the step id on every
 * render; `currentStepId` is the canonical source of truth.
 * `null` means the wizard is finished (Stage 2 is mounted).
 */
export interface WizardState {
  /** The user's end product (Baked / Gummies / Capsules /
   *  Tincture / Salve). Set by the coverflow on slide 1. */
  endProduct?: EndProductId | null
  /** The user's starting material (set by the Material step).
   *  `null` means the Material step hasn't been answered yet. */
  branch: WizardBranchId | null
  /** The current step the wizard is on. `null` means the
   *  wizard is finished (Stage 2 is mounted). */
  currentStepId: WizardStepId | null
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
   * Optional custom-input renderer. When set, the StepCard
   * renders this node in place of the option carousel. Used
   * for steps where the user types in their own data (e.g.
   * the Container step's bag-dimension form) rather than
   * picking from a preset list. The custom renderer is
   * responsible for firing `onConfirm(optionId)` when the
   * user has entered a valid value.
   *
   * When `renderCustom` is set, `getOptions` should return an
   * empty array (the StepCard renders the custom renderer
   * instead of the carousel). The two paths are mutually
   * exclusive — a step either shows a carousel of options or
   * a custom input, never both.
   */
  renderCustom?: (props: {
    state: WizardState
    selectedOptionId: string | null
    onConfirm: (optionId: string) => void
  }) => React.ReactNode
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
  endProduct: null,
  currentStepId: null,
  selections: {},
}
