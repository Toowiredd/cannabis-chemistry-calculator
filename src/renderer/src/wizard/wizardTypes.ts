/**
 * Wizard types — shared contract for the Stage 1 configuration wizard.
 *
 * This file is the import target for both ui-tabs (this week's work) and
 * state-routing (parallel slice work). ui-tabs owns this initial cut.
 * When state-routing lands their `wizard` slice + `wizardTypes.ts` in
 * `src/renderer/src/stores/`, this file becomes the downstream surface —
 * either re-exported by their module or moved outright. The contract
 * (field names + types) is what matters; the file location is fluid.
 *
 * Week 1 scope (§7 of docs/wizard-architecture-2026-07-26.md): the
 * Flower branch end-to-end (product-type step + Method step). Other
 * branches get a "Coming in week 2" placeholder.
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
 * section-3.3 architecture doc; for Week 1 we only wire `method`
 * (the Flower branch's first decision after product type).
 *
 * The "Name this recipe" step (§8.5) is a placeholder text field for
 * Week 1 — full implementation lands in week 5 alongside
 * `appStore.recipes[]`.
 */
export interface WizardSelections {
  method?: string
  container?: string
  weight?: { value: number; unit: 'g' | 'oz' }
  efficiency?: number
  fat?: string
  volume?: { value: number; unit: 'mL' | 'cup' | 'tsp' | 'tbsp' }
  servings?: number
  potency?: number
  color?: 'light' | 'medium' | 'dark'
  applicationArea?: string
  carrier?: string
  /** Week-1 placeholder for the §8.5 "Name this recipe" step. */
  name?: string
}

/**
 * The Stage 1 wizard state. For Week 1 this is held in a local
 * React state in the WizardScreen — when state-routing lands their
 * `appStore.wizard` slice, this exact shape migrates there.
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
 * For Week 1, the runtime doesn't call `validate` / `skipIf` (the
 * architecture doc's smart-skip rules land in week 2). They are
 * declared on the type so week-2 code can call them without
 * changing the type.
 */
export interface WizardStep {
  id: string
  title: string
  /** 1-line "what this means" for beginners. */
  description: string
  /** Returns the options for the current step. Stateful — re-runs
   * on every render so `state` can influence the option list. */
  getOptions: (state: WizardState) => WizardOption[]
  /** Returns true if the step's selection is valid. */
  validate?: (state: WizardState) => boolean
  /** Returns true if the step should be hidden for the current
   * branch (smart-skip). Week 2+ feature. */
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
