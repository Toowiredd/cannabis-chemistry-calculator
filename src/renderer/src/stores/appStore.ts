import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Strain } from 'renderer/src/engine/models'
// Stage 1 Configuration Wizard types (2026-07-26 wizard Week 1, per
// docs/wizard-architecture-2026-07-26.md §3.3, §3.4, §6). The new
// `WizardSelections` shape is aliased to `Stage1WizardSelections` to
// avoid colliding with the legacy kit-configurator `WizardSelections`
// in this file (the kit configurator backs FirstTimerGuide and is
// being deprecated per §8.6 in a later week — for now both shapes
// coexist on the `wizard` slice, with the Stage 1 fields added as
// first-class members of `WizardState`).
// Week 5 (2026-07-26 wizard build, §8.2 + §8.5): the new `Recipe`
// type is the persisted record of a completed Stage 2 batch. The
// slice + actions live in this store; the type itself is in
// `wizardTypes.ts` so other modules (NameRecipeStep, the Stage 2
// completion step) can import it without a circular dep on the
// store.
import type {
  ProductType,
  Recipe,
  WizardSelections as Stage1WizardSelections,
  ExecutionStepState,
} from './wizardTypes'

export type TabId =
  | 'decarb'
  | 'infusion'
  | 'dose'
  | 'methods'
  | 'advanced'
  | 'knowledge'
  | 'journal'
  | 'dashboard'
  | 'quickbatch'

export type StartupIntent =
  | 'make_batch'
  | 'resume_repeat'
  | 'history_learn'
  | 'manual_calculator'

export type StartupConfidence = 'low' | 'medium' | 'high'

export type AdvancedToolSubTab = 'fats' | 'concentrate' | 'blending' | 'cost'

export type Theme = 'dark' | 'light'

export interface UnitPreferences {
  tempUnit: 'C' | 'F'
  weightUnit: 'g' | 'oz'
  volumeUnit: 'mL' | 'tsp' | 'tbsp' | 'cup'
  bagUnit: 'cm' | 'in'
}

export interface DecarbState {
  weight: string
  /**
   * Unit the stored `weight` value is in. The 2026-07-24 user-journey
   * verification round 3 found the weight-unit toggle was losing
   * precision because the value was converted-and-rounded on every
   * toggle. The fix: store the value in whatever unit the user typed
   * it in, and convert for display only. The toggle changes
   * `units.weightUnit` for the next display, but `weight` itself is
   * preserved. Defaults to 'g'; migrated to 'g' on first read for
   * legacy state that doesn't have the field.
   */
  weightUnit: 'g' | 'oz'
  thcaPct: string
  thcPct: string
  cbdaPct: string
  cbdPct: string
  presetId: string
  /**
   * Unit the stored `tempOverride` value is in. The 2026-07-25
   * dose-units audit (validation_report_dose_units.md §6 B6) found
   * the temperature toggle was doing convert-and-replace with
   * `fmt1(round1n(...))`, which drifts on values not at the rounded
   * boundary (240.1°C → 464.18°F → 240.1°C accumulated 0.01°C drift
   * per round-trip). The fix: per-field unit tracking, same pattern
   * as `weightUnit` and `volumeUnit`.
   */
  tempOverrideUnit: 'C' | 'F'
  tempOverride: string | null
  timeOverride: string | null
  effLowOverride: string | null
  effExpectedOverride: string | null
  effHighOverride: string | null
  bagExpanded: boolean
  bagGrindId: string
  bagPresetId: string
  /**
   * Unit the stored `bagWidthOverride` value is in. The 2026-07-25
   * dose-units audit (validation_report_dose_units.md §6 B5) found
   * the bag unit toggle was doing convert-and-replace with
   * `fmt1(round1(...))`, which drifts on every toggle. The fix:
   * per-field unit tracking, same pattern as `weightUnit`.
   */
  bagWidthOverrideUnit: 'cm' | 'in'
  bagWidthOverride: string | null
  bagLengthOverrideUnit: 'cm' | 'in'
  bagLengthOverride: string | null
  bagHasStems: boolean
  strainId: string | null
  /**
   * Toggle between flower, concentrate, and AVB (already-vaped bud) mode.
   * AVB is the community term for material left in a dry-herb vaporizer
   * after a session — it is already decarboxylated, so the decarb
   * calculator skips the heating step and only computes a residual-THC
   * read using `AVB_RESIDUAL_THC_RANGES` from the engine. Added in the
   * 2026-07-25 AVB feature round; legacy persisted state (pre-v3) that
   * lacks the `'avb'` value is left untouched by the v2→v3 migration
   * (the existing `'flower' | 'concentrate'` union is still valid).
   */
  materialMode: 'flower' | 'concentrate' | 'avb'
  /** Selected concentrate type ID (e.g. 'wax', 'shatter') */
  concentrateTypeId: string
}

export interface InfusionState {
  decarbedThc: string
  volume: string
  /**
   * Unit the stored `volume` value is in. See `DecarbState.weightUnit`
   * for the rationale — same per-field unit tracking to prevent
   * precision loss on toggle. Defaults to 'mL'.
   */
  volumeUnit: 'mL' | 'tsp' | 'tbsp' | 'cup'
  fatId: string
  customEfficiency: string
}

export interface DoseState {
  totalThc: string
  servings: string
  formatId: string
  /** Toggle reverse mode: user enters desired mg/serving, calculator works backward */
  reverseMode: boolean
  /** Desired mg per serving (reverse mode) */
  desiredMgPerServing: string
}

export interface AdvancedConcentrateState {
  concentrateTypeId: string
  weight: string
  thcaOverride: string
  thcOverride: string
  customEff: string
}

export interface AdvancedBlendStrain {
  name: string
  potency: number
}

export interface AdvancedBlendingState {
  strains: AdvancedBlendStrain[]
  targetWeight: string
  targetPotency: string
}

export interface AdvancedCostState {
  materialCost: string
  weightG: string
  thcaPct: string
  thcPct: string
  extractionEff: string
  targetDose: string
  servings: string
}

export interface AdvancedToolsState {
  subTab: AdvancedToolSubTab
  concentrate: AdvancedConcentrateState
  blending: AdvancedBlendingState
  cost: AdvancedCostState
}

export interface StartupRoutingState {
  launchCount: number
  chooserShownCount: number
  lastChooserIntent: StartupIntent | null
  lastSuccessfulIntent: StartupIntent | null
  lastSuccessfulTab: TabId | null
  successCounts: Record<StartupIntent, number>
}

export interface LabelState {
  productName: string
  ingredients: string
  storage: string
  batchNumber: number
  facilityNuts: boolean
  facilityDairy: boolean
  facilityGluten: boolean
  productionDate: string
}

/**
 * Wizard (multi-select kit configurator) state.
 *
 * The wizard is intentionally multi-select: every checkbox field is an array
 * and may contain zero, one, or many entries. The store treats empty arrays
 * as the default / "no selection yet" state — that is the correct semantics
 * for check-all-that-apply pickers.
 *
 * Persistence rules (see partialize below):
 * - `dismissed` and `selections` survive reload.
 * - `active` and `stepIndex` are session-only. Reload always lands on a
 *   closed wizard at step 0; the boot effect in `screens/main.tsx` decides
 *   whether to reopen based on `firstRunDismissed` and `wizard.dismissed`.
 */
export type WizardSelectionField =
  | 'equipment'
  | 'decarbMethodIds'
  | 'fatIds'
  | 'formatIds'

export type WizardNumberField = 'grams' | 'thcaPct' | 'servings' | 'fatVolume'

export interface WizardSelections {
  /** Checked equipment names (free-form string ids). */
  equipment: string[]
  /** Material weight in grams. */
  grams?: number
  /** THCA percentage (1-100). */
  thcaPct?: number
  /** Check-all-that-apply: decarb method ids. */
  decarbMethodIds: string[]
  /** Check-all-that-apply: fat ids. */
  fatIds: string[]
  /** Check-all-that-apply: dose format ids. */
  formatIds: string[]
  /** Number of servings. */
  servings?: number
  /**
   * Fat volume in mL — what the user is actually infusing into. The
   * First-Timer Guide asks for this on a dedicated step so the
   * "Save to Journal" concentration is computed against the user's
   * batch, not against the Infusion tab's default of 100 mL.
   * Added in the 2026-07-25 ccc Infusion audit (MINOR #3 fix).
   */
  fatVolume?: number
}

export interface WizardState {
  /** True while the wizard modal is open in the current session. */
  active: boolean
  /**
   * Persistent user-level dismiss. Once true, the wizard should never
   * re-prompt automatically — only an explicit "Show guide" / "?" action
   * can reopen it.
   */
  dismissed: boolean
  /** Current step (0..5). Session-only. */
  stepIndex: number
  /** Legacy multi-select kit-configurator selections. See `WizardSelections`. */
  selections: WizardSelections
  // ---------------------------------------------------------------------
  // Stage 1 Configuration Wizard (2026-07-26, wizard Week 1).
  //
  // The fields below are the persisted state for the new two-stage
  // flow described in docs/wizard-architecture-2026-07-26.md §3.3.
  // They live on the same `wizard` slice as the legacy kit configurator
  // (which backs FirstTimerGuide, being deprecated per §8.6 in a later
  // week) so the slice name stays stable. The new Stage 1 UI is
  // feature-flagged behind `wizardEnabled: false` (see the top-level
  // `wizardEnabled` field on `AppStore`) and is a no-op for users
  // who haven't opted in. The v7→v8 migration initializes these
  // fields to a clean empty state so consumers can rely on
  // present-but-default values after the one-time upgrade.
  // ---------------------------------------------------------------------

  /**
   * Which of the 5 product-type branches the user picked at step 0.
   * `null` = not yet picked (the wizard opens on the product-type
   * picker). Per §3.1, the branch drives which ordered step list the
   * wizard renders (`branches[state.branch].steps`).
   */
  branch: ProductType | null
  /**
   * Current step index in the branch's step list. `0` = product-type
   * picker. Persisted so a mid-wizard abandon can resume on the same
   * step (per §3.5).
   */
  currentStep: number
  /**
   * Per-step selections for the Stage 1 wizard. Distinct from the
   * legacy `selections` field above (which holds the multi-select
   * kit-configurator shape). Named to avoid the collision while
   * both shapes coexist during the deprecation window.
   */
  stage1Selections: Stage1WizardSelections
  /**
   * Visited step indices, in order. The head is the most recent
   * step the user was on; the tail is the entry point (step 0).
   * Backs the "back" button's restore-to-previous-step behaviour
   * in `prevStep`.
   */
  stepHistory: number[]
  /**
   * Stage 2 Execution stepper state (Week 3, 2026-07-26 wizard
   * build). Lives on the `wizard` slice alongside `stage1Selections`
   * and `stepHistory`. EPHEMERAL — see `ExecutionStepState` JSDoc
   * in `wizardTypes.ts` for the full rationale. The `partialize`
   * block below does NOT write `execution` to the persisted
   * envelope, and the `merge` block defensively drops any stale
   * `execution` key from a rehydrated envelope.
   */
  execution: ExecutionStepState
}

export const DEFAULT_WIZARD_SELECTIONS: WizardSelections = {
  equipment: [],
  decarbMethodIds: [],
  fatIds: [],
  formatIds: [],
}

/** Default Stage 1 Configuration Wizard selections (empty object — all fields optional). */
export const DEFAULT_STAGE1_WIZARD_SELECTIONS: Stage1WizardSelections = {}

/**
 * Default Stage 2 Execution stepper state. The empty form of
 * `ExecutionStepState` — no current step, no completed steps, no
 * skipped steps. This is the "Stage 2 has not been entered yet"
 * shape; the `beginExecution` action is the only legitimate way
 * to leave it.
 */
export const DEFAULT_EXECUTION_STEP_STATE: ExecutionStepState = {
  currentStepId: null,
  completedStepIds: [],
  skippedStepIds: [],
  // Week 4 (2026-07-26 wizard build, §8.1): the recalculating
  // flag flips on when the user re-edits a Stage 1 selection
  // mid-batch and the engine recomputes the totals. The stepper
  // reads these two fields to render a "recalculating..." badge
  // on the affected rows. Both reset to their no-op defaults
  // here so `resetWizard` / `returnToConfig` / rehydrate (via
  // the `merge` function) all clear them automatically — the
  // `merge` block drops the whole `execution` slice on rehydrate
  // and reseeds it with this default.
  isRecalculating: false,
  affectedStepIds: [],
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  active: false,
  dismissed: false,
  stepIndex: 0,
  selections: DEFAULT_WIZARD_SELECTIONS,
  // Stage 1 Configuration Wizard defaults (2026-07-26, wizard Week 1).
  branch: null,
  currentStep: 0,
  stage1Selections: DEFAULT_STAGE1_WIZARD_SELECTIONS,
  stepHistory: [],
  // Stage 2 Execution stepper defaults (2026-07-26, wizard Week 3).
  // Runtime-only — see `partialize` + `merge` for the
  // not-persisted contract. On every fresh boot, the user lands
  // here and the wizard opens at Stage 1 (Stage 2 must be entered
  // via `beginExecution`).
  execution: { ...DEFAULT_EXECUTION_STEP_STATE },
}

function todayIso(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const DEFAULT_LABEL: LabelState = {
  productName: '',
  ingredients: '',
  storage: 'Store in a cool, dark place. Keep sealed.',
  batchNumber: 1,
  facilityNuts: false,
  facilityDairy: false,
  facilityGluten: false,
  productionDate: todayIso(),
}

export interface InventoryItem {
  id: string
  date: string
  type: 'purchase' | 'usage'
  name: string
  amountGrams: string
  cost?: string
  notes?: string
  /**
   * Material semantic: is this AVB (already-vaped bud), raw flower, or
   * concentrate? Distinct from `type` (transaction semantic: did I buy
   * or use this item — `type` is unchanged). Added in the 2026-07-25
   * AVB feature round. Optional on the interface so legacy call sites
   * (Dashboard inventory form) keep typechecking before ui-tabs wires
   * each save site to pass the correct literal. The v2→v3 persist
   * migration (`appStore.ts` migrate) backfills any legacy item that
   * pre-dates the field with `kind: 'flower'`, so consumers can rely
   * on a present-but-default value after a one-time upgrade. The
   * migration is idempotent — items that already have a valid `kind`
   * (including `'avb'`) are preserved unchanged.
   */
  kind?: 'flower' | 'concentrate' | 'avb'
}

export interface InventoryState {
  items: InventoryItem[]
  lowStockThreshold: string
}

const DEFAULT_INVENTORY: InventoryState = {
  items: [],
  lowStockThreshold: '3.5',
}
/**
 * Provenance tag for a `JournalEntry`. Records which UI surface
 * saved the entry so the Journal tab can label entries by source
 * (Quick Batch, First-Timer Guide, Journal form, Advanced Tools,
 * AVB — already-vaped bud batches).
 *
 * `'unknown'` is the legacy sentinel: it is stamped on any entry
 * that pre-dates the v1→v2 persist migration (see appStore.ts
 * `migrate` block) and on any code path that doesn't yet pass a
 * known source. The 2026-07-25 ccc-uiux-reviewer (BLOCKER B1) and
 * ccc-workflow-validator reports both flagged that `JournalEntry`
 * had no `source` field — every save was dropping provenance.
 *
 * `'avb'` was added in the 2026-07-25 AVB feature round so the
 * Journal tab can group / colour-code AVB-originated batches. The
 * v2→v3 migration does NOT stamp `'avb'` on legacy entries — it
 * is intentionally write-only from the AVB save site in ui-tabs.
 */
export type JournalEntrySource =
  | 'quickbatch'
  | 'first_timer_guide'
  | 'journal_form'
  | 'advanced_tools'
  | 'avb'
  | 'unknown'

export interface JournalEntry {
  id: string
  date: string
  strainName: string
  strainId: string | null
  materialWeight: string
  thcaPct: string
  thcPct: string
  cbdaPct: string
  cbdPct: string
  methodId: string
  methodName: string
  fatId: string
  fatName: string
  servings: string
  mgPerServing: string
  classification: string
  totalInfusedThc: string
  concentration: string
  volume: string
  volumeUnit: string
  notes: string
  /**
   * Which UI surface wrote this entry. Optional in the interface so
   * legacy call sites (QuickBatch / First-Timer Guide / Journal
   * form) keep typechecking before `ui-tabs`'s parallel dispatch
   * wires each save site to pass the correct literal — those
   * call sites will spread `{ ...entry, source: '<literal>' }`
   * into `addJournalEntry` / `setJournalEntries`. The v1→v2
   * persist migration (appStore.ts `migrate`) backfills this to
   * `'unknown'` on legacy snapshots so consumers can rely on a
   * present-but-default value after a one-time upgrade.
   */
  source?: JournalEntrySource
  /**
   * The unit the material weight was authored in. Required for
   * correct display on the Journal card — without this field, the
   * display side has to guess, and a 0.12 oz entry shows as
   * "0.12 g" (a 28x under-report). The b02a259 commit message
   * claimed this field was added as "new optional field on
   * JournalEntry; legacy falls back to 'g'", but the field was
   * never actually landed on the interface (the Journal card
   * was reading it via a type cast on `entry as unknown as {
   * materialWeightUnit?: ... }`). The 2026-07-25
   * ccc-validation-orchestrator cross-tab data flow audit
   * caught the gap as MAJOR M1. This declaration is the real
   * landing site. The v3→v4 persist migration backfills
   * `'g'` on every legacy entry that lacks a valid value, so
   * consumers can rely on a present-but-default value after a
   * one-time upgrade. The migration is idempotent — entries
   * that already have a valid `'g' | 'oz'` are preserved
   * unchanged. Legacy entries (pre-v4) default to `'g'` on the
   * migration (safe default — assumes pre-v4 users saved in
   * grams, which was the only well-tested path before the
   * per-field unit refactor).
   */
  materialWeightUnit?: 'g' | 'oz'
}

export interface TimerState {
  active: boolean
  endTime: number | null
  totalSeconds: number
  methodName: string
}

export const DEFAULT_DECARB: DecarbState = {
  weight: '3.5',
  weightUnit: 'g',
  thcaPct: '20',
  thcPct: '0',
  cbdaPct: '0',
  cbdPct: '0',
  presetId: 'oven_sealed',
  tempOverrideUnit: 'C',
  tempOverride: null,
  timeOverride: null,
  effLowOverride: null,
  effExpectedOverride: null,
  effHighOverride: null,
  bagExpanded: true,
  bagGrindId: 'medium',
  bagPresetId: 'quart',
  bagWidthOverrideUnit: 'cm',
  bagWidthOverride: null,
  bagLengthOverrideUnit: 'cm',
  bagLengthOverride: null,
  bagHasStems: false,
  strainId: null,
  materialMode: 'flower',
  concentrateTypeId: 'wax',
}

export const DEFAULT_INFUSION: InfusionState = {
  decarbedThc: '',
  volume: '100',
  volumeUnit: 'mL',
  fatId: 'coconut',
  customEfficiency: '0.82',
}

export const DEFAULT_DOSE: DoseState = {
  totalThc: '',
  servings: '10',
  formatId: 'custom',
  reverseMode: false,
  desiredMgPerServing: '10',
}

export const DEFAULT_ADVANCED_TOOLS: AdvancedToolsState = {
  subTab: 'fats',
  concentrate: {
    concentrateTypeId: 'wax',
    weight: '1.0',
    thcaOverride: '',
    thcOverride: '',
    customEff: '',
  },
  blending: {
    strains: [
      { name: 'Strain A', potency: 18 },
      { name: 'Strain B', potency: 25 },
    ],
    targetWeight: '10',
    targetPotency: '20',
  },
  cost: {
    materialCost: '50',
    weightG: '3.5',
    thcaPct: '20',
    thcPct: '0',
    extractionEff: '0.82',
    targetDose: '10',
    servings: '',
  },
}

export const DEFAULT_STARTUP_ROUTING: StartupRoutingState = {
  launchCount: 0,
  chooserShownCount: 0,
  lastChooserIntent: null,
  lastSuccessfulIntent: null,
  lastSuccessfulTab: null,
  successCounts: {
    make_batch: 0,
    resume_repeat: 0,
    history_learn: 0,
    manual_calculator: 0,
  },
}

interface AppStore {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Startup routing note:
  // `activeTab` is not a strong signal for launch routing by itself. The next
  // startup system should prefer a tiny intent chooser first, then graduate to
  // a persisted "last successful path" heuristic based on completed outcomes
  // like saved batches, resumed work, or journal/log actions. Do not treat
  // "last tab clicked" as equivalent to "best launch destination".

  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  units: UnitPreferences
  setUnits: (units: Partial<UnitPreferences>) => void

  decarb: DecarbState
  setDecarb: (partial: Partial<DecarbState>) => void
  resetDecarb: () => void

  infusion: InfusionState
  setInfusion: (partial: Partial<InfusionState>) => void
  resetInfusion: () => void

  dose: DoseState
  setDose: (partial: Partial<DoseState>) => void
  resetDose: () => void

  advancedTools: AdvancedToolsState
  setAdvancedSubTab: (subTab: AdvancedToolSubTab) => void
  setAdvancedConcentrate: (partial: Partial<AdvancedConcentrateState>) => void
  setAdvancedBlending: (partial: Partial<AdvancedBlendingState>) => void
  setAdvancedCost: (partial: Partial<AdvancedCostState>) => void
  resetAdvancedTools: () => void

  startupRouting: StartupRoutingState
  recordStartupLaunch: () => void
  recordStartupChooserShown: () => void
  recordStartupIntent: (intent: StartupIntent) => void
  recordSuccessfulPath: (intent: StartupIntent, tab: TabId) => void

  label: LabelState
  setLabel: (partial: Partial<LabelState>) => void
  resetLabel: () => void
  incrementBatchNumber: () => void

  /** Last computed decarb expected mg for downstream carry-forward */
  lastDecarbExpected: string
  setLastDecarbExpected: (val: string) => void

  /** Last computed infused THC mg for downstream carry-forward */
  lastInfusedThc: string
  setLastInfusedThc: (val: string) => void

  loadFromPreset: (preset: unknown) => void

  /** Strain library */
  strains: Strain[]
  setStrains: (strains: Strain[]) => void
  addStrain: (strain: Strain) => void
  updateStrain: (strain: Strain) => void
  deleteStrain: (id: string) => void

  /** Journal entries (loaded from disk on demand) */
  journalEntries: JournalEntry[]
  setJournalEntries: (entries: JournalEntry[]) => void
  addJournalEntry: (entry: JournalEntry) => void
  deleteJournalEntry: (id: string) => void

  /** Timer state */
  timer: TimerState
  setTimer: (partial: Partial<TimerState>) => void
  resetTimer: () => void

  /** Dashboard inventory */
  inventory: InventoryState
  setInventory: (partial: Partial<InventoryState>) => void
  addInventoryItem: (item: InventoryItem) => void
  deleteInventoryItem: (id: string) => void

  firstRunDismissed: boolean
  /**
   * @deprecated Kept as a thin shim for external callers; internally
   * `dismissOnboarding` is the single source of truth. New code MUST
   * call `dismissOnboarding` directly. Removed in a future migration.
   */
  dismissFirstRun: () => void

  /**
   * Multi-select wizard (kit configurator) slice. See `WizardState` for
   * field-level semantics. The previous `firstTimerOpen` alias was
   * collapsed into `wizard.active` in the 2026-07-25 Cluster C
   * refactor (F2.4) — `wizard.active` is now the single source of
   * truth for "is the wizard open right now".
   */
  wizard: WizardState
  /** Open or close the wizard modal. Runtime only; not persisted. */
  setWizardActive: (active: boolean) => void
  /** Jump to a specific wizard step (0..5). Runtime only; not persisted. */
  setWizardStep: (stepIndex: number) => void
  /**
   * Multi-select primitive. If `id` is already in `selections[field]`,
   * removes it; otherwise appends it. Field must be one of the array-typed
   * selection keys (`equipment`, `decarbMethodIds`, `fatIds`, `formatIds`).
   * Persisted.
   */
  toggleWizardSelection: (field: WizardSelectionField, id: string) => void
  /**
   * Set / clear a numeric selection field (`grams` | `thcaPct` | `servings`).
   * Pass `undefined` to remove the field. Persisted.
   */
  setWizardNumberField: (
    field: WizardNumberField,
    value: number | undefined
  ) => void
  /**
   * Reset every wizard selection back to the empty-array default. Keeps
   * `dismissed`, `active`, and `stepIndex` as-is so the user can be shown
   * a fresh wizard without losing their "never re-prompt" preference.
   */
  clearWizardSelections: () => void
  /**
   * User-level dismiss: sets `wizard.dismissed = true` AND
   * `firstRunDismissed = true`, and closes the modal in the current
   * session. Persistent — once dismissed, the wizard never re-prompts
   * automatically. Only an explicit "Show guide" / "?" action can
   * reopen it. This is the unified successor to the prior
   * `dismissFirstRun` + `dismissWizard` pair, which were near-
   * identical and merged in the 2026-07-25 Cluster C refactor (F2.22).
   */
  dismissOnboarding: () => void
  /**
   * @deprecated Kept as a thin shim for external callers; internally
   * `dismissOnboarding` is the single source of truth. New code MUST
   * call `dismissOnboarding` directly. Removed in a future migration.
   */
  dismissWizard: () => void

  // ---------------------------------------------------------------------
  // Stage 1 Configuration Wizard (2026-07-26, wizard Week 1).
  //
  // The new two-stage flow per docs/wizard-architecture-2026-07-26.md
  // §3.3, §3.4, §6. Behind a feature flag (`wizardEnabled: false` by
  // default) so the new UI is opt-in while the legacy kit configurator
  // (above) continues to back FirstTimerGuide. The flag is read in
  // `src/renderer/screens/main.tsx` to decide whether to render the new
  // WizardScreen or the existing GroupedTabNav. The Stage 1 actions
  // are all no-ops for users with the flag off — they only mutate the
  // new `wizard.branch / currentStep / stage1Selections / stepHistory`
  // fields, which are isolated from the legacy kit-configurator fields.
  // ---------------------------------------------------------------------

  /**
   * Feature flag for the new Stage 1 Configuration Wizard UI. Default
   * `false` (opt-in). The `main.tsx` boot effect reads this flag and
   * renders the WizardScreen when `true`, GroupedTabNav otherwise.
   * Persisted in localStorage so the user's preference survives
   * reloads (per §7 Week 1: "Behind a feature flag").
   */
  wizardEnabled: boolean
  /** Set the Stage 1 wizard feature flag. */
  setWizardEnabled: (enabled: boolean) => void
  /**
   * Pick a product-type branch at step 0. Resets the rest of the
   * Stage 1 wizard state (currentStep, stage1Selections, stepHistory)
   * to a clean empty state so the user starts the new branch from
   * scratch. Persisted.
   */
  setProductType: (branch: ProductType) => void
  /**
   * Write a single Stage 1 selection key. `key` is a member of
   * `Stage1WizardSelections`; `value` must be the non-undefined
   * shape of that key (e.g. `{ value: 28, unit: 'g' }` for `weight`).
   * Pass `undefined` to clear the key. Persisted.
   */
  setSelection: <K extends keyof Stage1WizardSelections>(
    key: K,
    value: NonNullable<Stage1WizardSelections[K]> | undefined
  ) => void
  /**
   * Advance to the next step. Pushes the current `currentStep` onto
   * `stepHistory` and increments `currentStep` by 1. Persisted.
   */
  nextStep: () => void
  /**
   * Go back to the previous step. Pops the head of `stepHistory` and
   * sets `currentStep` to that value. If `stepHistory` is empty, this
   * is a no-op (we're already at step 0, which has no "back"). Persisted.
   */
  prevStep: () => void
  /**
   * Reset every Stage 1 field back to the empty defaults. Keeps the
   * legacy kit-configurator fields (`active`, `dismissed`, `stepIndex`,
   * legacy `selections`) and the `wizardEnabled` feature flag as-is.
   * Persisted.
   */
  resetWizard: () => void

  // ---------------------------------------------------------------------
  // Stage 2 Execution stepper (2026-07-26, wizard Week 3).
  //
  // The "do the work" half of the two-stage wizard per
  // docs/wizard-architecture-2026-07-26.md §4. Stage 2 takes over
  // after the user taps "Begin batch" in Stage 1 and renders a
  // vertical stepper (all steps visible, current step highlighted,
  // "Mark complete" per step). The actions below are the store
  // surface for the stepper's state machine.
  //
  // Stage 2 state is EPHEMERAL — it is NOT persisted (see
  // `partialize` + `merge` below). On reload, the wizard goes back
  // to Stage 1 with the user's selections intact; the user can
  // re-enter Stage 2 in one tap via `beginExecution`. The decision
  // is deliberate: resuming a half-finished execution is dangerous
  // (the timer / heatmap / "stir now" prompts are physical-world
  // state that the app cannot reliably re-derive).
  //
  // Storage: `execution` lives on the `wizard` slice (alongside
  // `stage1Selections` + `stepHistory`). Components read
  // `state.wizard.execution` and the actions below mutate
  // `state.wizard.execution` directly. This is consistent with
  // the existing Stage 1 pattern (`wizard.stage1Selections` is
  // the storage for the Stage 1 selections; the top-level
  // `wizardEnabled` boolean is a flag, not data). The spec
  // asked for a top-level `execution: ExecutionStepState` field
  // on the AppStore as well, but that would be a shadow of
  // `wizard.execution` and the two could drift out of sync
  // across `resetWizard` / `returnToConfig` / rehydrate. One
  // canonical storage location is the safer choice.
  // ---------------------------------------------------------------------

  /**
   * Transition to Stage 2: set `execution.currentStepId` to the
   * first step of the execution sequence and clear the completed /
   * skipped lists. Called when the user taps "Begin batch" in the
   * Stage 1 WizardScreen. No-op if `firstStepId` is empty (defensive
   * — the caller should always pass a valid first step id, but a
   * malformed dispatch from a future bug shouldn't put the wizard
   * into a half-initialized Stage 2).
   */
  beginExecution: (firstStepId: string) => void
  /**
   * Mark the current Stage 2 step complete and advance to
   * `nextStepId`. Appends `stepId` to `completedStepIds`. No-op
   * unless `state.wizard.execution.currentStepId === stepId` —
   * the stepper should only complete the CURRENT step, and a
   * defensive guard here means a stale dispatch from a previous
   * step can't accidentally mark a step the user isn't on.
   */
  completeExecutionStep: (stepId: string, nextStepId: string) => void
  /**
   * Skip the current Stage 2 step and advance to `nextStepId`.
   * Appends `stepId` to `skippedStepIds`. No-op unless
   * `state.wizard.execution.currentStepId === stepId` — same
   * defensive rationale as `completeExecutionStep`.
   */
  skipExecutionStep: (stepId: string, nextStepId: string) => void
  /**
   * Mark Stage 2 as recalculating after the user re-edits a
   * Stage 1 selection mid-batch. Sets `isRecalculating: true` and
   * `affectedStepIds` to the provided array. If `affectedStepIds`
   * is empty, the stepper treats that as "all steps affected" (the
   * empty-array semantic is the caller's signal — ui-tabs decides
   * whether to broadcast or be specific). No-op if Stage 2 isn't
   * active (`currentStepId === null`) — you can't recalculate a
   * Stage 2 that isn't running. Per §8.1 of the wizard arch doc.
   * Week 4 commit; Week 7's a11y polish may add a debounced
   * `finishRecalculating` dispatch if needed.
   */
  markRecalculating: (affectedStepIds: string[]) => void
  /**
   * Clear the recalculating flag. Sets `isRecalculating: false`
   * and `affectedStepIds: []`. No-op if not currently recalculating
   * (idempotent — calling this on a stable stepper is a no-op
   * rather than a spurious re-render). Per §8.1.
   */
  finishRecalculating: () => void
  /**
   * Convenience action for the §8.1 re-edit UX: a single
   * dispatch that flips the recalculating flag on and off so
   * the stepper shows a brief "recalculating..." flash. The
   * Week 4 engine recompute is sub-millisecond so the two
   * `set()` calls happen back-to-back synchronously; Week 7's
   * polish can swap this for a debounced version if a future
   * async engine needs the delay. No-op if Stage 2 isn't active.
   * This is the action the WizardScreen will call when the user
   * re-edits a Stage 1 selection mid-batch.
   */
  recomputeFromEdit: (affectedStepIds: string[]) => void
  /**
   * Return to Stage 1 from Stage 2. Resets `execution` to the
   * empty defaults (currentStepId null, lists empty). The Stage 1
   * selections (`branch`, `currentStep`, `stage1Selections`,
   * `stepHistory`) are preserved — the user can re-edit their
   * config and re-run Stage 2 in two taps. Called from the
   * "Back to config" CTA in the Stage 2 stepper.
   */
  returnToConfig: () => void

  // -----------------------------------------------------------------
  // Stage 2 Recipes slice (2026-07-26, wizard Week 5).
  //
  // Per docs/wizard-architecture-2026-07-26.md §8.2, every completed
  // Stage 2 batch writes a Recipe record. This is the "repeatable
  // workflow" promise — the user can look back at past batches,
  // compare results, see what worked. Stage 2's completion step
  // has a "Run again" CTA that copies the current Recipe's
  // selections into a new draft Recipe and restarts Stage 2 (no
  // need to re-run Stage 1 if nothing changed).
  //
  // Per §8.5, the Recipe's `name` is sourced from the
  // `NameRecipeStep` (the user can edit; the default placeholder
  // is derived from the Stage 1 selections). The
  // `batchJournalEntryId` field is the soft-FK link to the
  // `JournalEntry` written for the same batch — the Journal
  // shows the Recipe as provenance ("this batch was made from
  // recipe <X>") without duplicating the entry. The link is
  // optional: a Recipe written before the Journal entry, or
  // by a save site that doesn't go through the Journal flow,
  // has `batchJournalEntryId: null`.
  //
  // Persistence: the slice is included in the persist envelope
  // (see `partialize` below). The v8→v9 migration backfills
  // `recipes: []` on legacy v8 envelopes so consumers can rely
  // on a present-but-default value after the one-time upgrade.
  // The IDB mirror (per §7 Week 5: "Recipe save: `NameRecipeStep`
  // + `appStore.recipes[]` slice + IDB mirror") is out of scope
  // for this commit — the localStorage write via `partialize` is
  // the canonical store; the IDB mirror is a separate write that
  // ui-tabs can wire in a follow-up. Same pattern as the
  // existing Journal entries (which live on disk in localStorage /
  // IPC via the Journal tab's load-on-mount) — the store owns
  // the canonical record, the IDB mirror is a derived view.
  // -----------------------------------------------------------------

  /**
   * Saved Recipes (Week 5, per §8.2). Every completed Stage 2
   * batch writes a Recipe here. The `name` is sourced from
   * `NameRecipeStep` (the user can edit; the default placeholder
   * is derived from the Stage 1 selections per §8.5). Persisted
   * in localStorage — Recipes are the "records" the §8.2
   * "repeatable workflow" promise needs.
   */
  recipes: Recipe[]
  /**
   * Add a new Recipe. Returns the generated id (so the caller
   * can chain the JournalEntry + Recipe.batchJournalEntryId
   * link). Defensive: a duplicate id is rejected (no-op + the
   * existing id is returned).
   */
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => string
  /**
   * Update an existing Recipe's name (the only field the user
   * can edit post-save). No-op if the id doesn't exist. Persisted.
   */
  renameRecipe: (id: string, name: string) => void
  /**
   * Delete a Recipe. The linked JournalEntry is NOT deleted —
   * the Journal keeps the entry; only the Recipe record is
   * removed. No-op if the id doesn't exist. Persisted.
   */
  deleteRecipe: (id: string) => void
  /**
   * Link a JournalEntry id to a Recipe. Used by the Stage 2
   * completion step's "Save to Journal" flow — the entry is
   * written first (via `addJournalEntry`), then the recipe
   * is patched with the new entry id. No-op if the recipe
   * doesn't exist. Persisted.
   */
  setRecipeJournalEntry: (recipeId: string, journalEntryId: string) => void

  // -----------------------------------------------------------------
  // Week 6 (2026-07-27 wizard build): Resume + Re-run actions for
  // §3.5 ("Resume last" on app launch) and §8.2 ("Run again" CTA
  // on Stage 2 completion). Both are additive — they read existing
  // persisted state (the `wizard` Stage 1 slice + the `recipes[]`
  // slice) and write to the Stage 1 slice. Stage 2 (`execution`)
  // is NOT touched by Resume (Stage 2 stays ephemeral; re-engagement
  // is via `beginExecution` after the user re-enters Stage 1).
  // Re-run DOES reset `execution` to the empty defaults because
  // the user is starting a fresh batch.
  //
  // See docs/wizard-architecture-2026-07-26.md §3.5 + §8.2 + the
  // §7 build order (Week 6: "Resume last" entry + "Re-run saved
  // Recipe" UX). The two actions here are the store-side surface
  // for those flows — the WizardScreen and Dashboard components
  // call them; the store owns the in-memory state and the
  // persistence rules.
  // -----------------------------------------------------------------

  /**
   * Week 6 (§3.5): resume the user's last in-flight Stage 1
   * wizard state. Returns `null` when there are no Stage 1
   * selections to resume (the wizard is at the default empty
   * state — `branch === null` or `stage1Selections` is empty).
   * Otherwise restores `currentStep` to the user's last position
   * (idempotent re-set, defensive against a future bug that
   * could zero the step out) and returns `{ branch, lastStep }`
   * so the caller can route the UI (e.g., the Dashboard's
   * "Resume last" CTA calls this, then opens the wizard at the
   * returned step). The Stage 2 `execution` slice is NOT
   * touched — Stage 2 is ephemeral by design (re-entering
   * Stage 2 with `beginExecution('preheat-decarb')` after
   * resume is the canonical re-engagement path).
   */
  resumeLastInFlight: () => { branch: ProductType; lastStep: number } | null
  /**
   * Week 6 (§8.2): "Run again" CTA on the Stage 2 completion
   * step. Copies the named Recipe's `selections` + `branch` into
   * the Stage 1 wizard state and resets `currentStep` to 0 +
   * clears `stepHistory` so the user re-enters Stage 1 at the
   * product-type picker (the wizard walks the user back through
   * their selections in order — the selections are pre-filled,
   * so the user can confirm each one and immediately transition
   * to Stage 2 again). Resets `execution` to the empty
   * defaults so a fresh Stage 2 run starts cleanly. Returns
   * the Recipe on success, `null` when the id is not found.
   *
   * The caller is responsible for copying `recipe.name` into
   * the local `name` state of the WizardScreen — name is
   * component-local, not persisted in `wizard.stage1Selections`.
   * The returned Recipe gives the caller access to the name
   * (and any other field) without re-looking it up in
   * `state.recipes`.
   */
  rerunRecipe: (recipeId: string) => Recipe | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Type-guard for the Stage 1 wizard's product-type branch literal.
 * Used in the `merge` function and the v7→v8 migration to coerce a
 * potentially-`undefined` / potentially-corrupted persisted value into
 * one of the 5 valid `ProductType` literals. Returns `false` for
 * `null`, `undefined`, or any string outside the union.
 */
function isProductType(value: unknown): value is ProductType {
  return (
    value === 'flower' ||
    value === 'concentrate' ||
    value === 'avb' ||
    value === 'edible' ||
    value === 'topical'
  )
}

function stringish(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function nullableStringish(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value === null) return null
  return null
}

export const useAppStore = create<AppStore>()(
  persist(
    set => ({
      // Temporary default only. Product direction should replace this static
      // boot target with:
      // 1. First run -> First-Timer Guide with Quick Batch underneath
      // 2. Low-confidence return -> tiny startup chooser (Make / Resume / History)
      // 3. High-confidence return -> persisted last-successful-path routing
      activeTab: 'decarb',
      setActiveTab: tab => set({ activeTab: tab }),

      theme: 'dark',
      setTheme: theme => set({ theme }),
      toggleTheme: () =>
        set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      units: {
        tempUnit: 'C',
        weightUnit: 'g',
        volumeUnit: 'mL',
        bagUnit: 'cm',
      },
      setUnits: partial =>
        set(state => ({ units: { ...state.units, ...partial } })),

      decarb: { ...DEFAULT_DECARB },
      setDecarb: partial =>
        set(state => ({ decarb: { ...state.decarb, ...partial } })),
      resetDecarb: () => set({ decarb: { ...DEFAULT_DECARB } }),

      infusion: { ...DEFAULT_INFUSION },
      setInfusion: partial =>
        set(state => ({ infusion: { ...state.infusion, ...partial } })),
      resetInfusion: () => set({ infusion: { ...DEFAULT_INFUSION } }),

      dose: { ...DEFAULT_DOSE },
      setDose: partial =>
        set(state => ({ dose: { ...state.dose, ...partial } })),
      resetDose: () => set({ dose: { ...DEFAULT_DOSE } }),

      advancedTools: { ...DEFAULT_ADVANCED_TOOLS },
      setAdvancedSubTab: subTab =>
        set(state => ({
          advancedTools: { ...state.advancedTools, subTab },
        })),
      setAdvancedConcentrate: partial =>
        set(state => ({
          advancedTools: {
            ...state.advancedTools,
            concentrate: {
              ...state.advancedTools.concentrate,
              ...partial,
            },
          },
        })),
      setAdvancedBlending: partial =>
        set(state => ({
          advancedTools: {
            ...state.advancedTools,
            blending: {
              ...state.advancedTools.blending,
              ...partial,
            },
          },
        })),
      setAdvancedCost: partial =>
        set(state => ({
          advancedTools: {
            ...state.advancedTools,
            cost: {
              ...state.advancedTools.cost,
              ...partial,
            },
          },
        })),
      resetAdvancedTools: () =>
        set({
          advancedTools: { ...DEFAULT_ADVANCED_TOOLS },
        }),

      startupRouting: { ...DEFAULT_STARTUP_ROUTING },
      recordStartupLaunch: () =>
        set(state => ({
          startupRouting: {
            ...state.startupRouting,
            launchCount: state.startupRouting.launchCount + 1,
          },
        })),
      recordStartupChooserShown: () =>
        set(state => ({
          startupRouting: {
            ...state.startupRouting,
            chooserShownCount: state.startupRouting.chooserShownCount + 1,
          },
        })),
      recordStartupIntent: intent =>
        set(state => ({
          startupRouting: {
            ...state.startupRouting,
            lastChooserIntent: intent,
          },
        })),
      recordSuccessfulPath: (intent, tab) =>
        set(state => ({
          startupRouting: {
            ...state.startupRouting,
            lastSuccessfulIntent: intent,
            lastSuccessfulTab: tab,
            successCounts: {
              ...state.startupRouting.successCounts,
              [intent]: state.startupRouting.successCounts[intent] + 1,
            },
          },
        })),

      label: { ...DEFAULT_LABEL },
      setLabel: partial =>
        set(state => ({ label: { ...state.label, ...partial } })),
      resetLabel: () => set({ label: { ...DEFAULT_LABEL } }),
      incrementBatchNumber: () =>
        set(state => ({
          label: { ...state.label, batchNumber: state.label.batchNumber + 1 },
        })),

      lastDecarbExpected: '',
      setLastDecarbExpected: val =>
        set(state => {
          if (state.lastDecarbExpected === val) return {} // no-op
          return { lastDecarbExpected: val }
        }),

      lastInfusedThc: '',
      setLastInfusedThc: val =>
        set(state => {
          if (state.lastInfusedThc === val) return {} // no-op
          return { lastInfusedThc: val }
        }),

      journalEntries: [],
      setJournalEntries: entries => set({ journalEntries: entries }),
      addJournalEntry: entry =>
        set(state => ({
          journalEntries: [entry, ...state.journalEntries],
        })),
      deleteJournalEntry: id =>
        set(state => ({
          journalEntries: state.journalEntries.filter(e => e.id !== id),
        })),

      timer: {
        active: false,
        endTime: null,
        totalSeconds: 0,
        methodName: '',
      },
      setTimer: partial =>
        set(state => ({ timer: { ...state.timer, ...partial } })),
      resetTimer: () =>
        set({
          timer: {
            active: false,
            endTime: null,
            totalSeconds: 0,
            methodName: '',
          },
        }),

      inventory: { ...DEFAULT_INVENTORY },
      setInventory: partial =>
        set(state => ({ inventory: { ...state.inventory, ...partial } })),
      addInventoryItem: item =>
        set(state => ({
          inventory: {
            ...state.inventory,
            items: [item, ...state.inventory.items],
          },
        })),
      deleteInventoryItem: id =>
        set(state => ({
          inventory: {
            ...state.inventory,
            items: state.inventory.items.filter(i => i.id !== id),
          },
        })),

      firstRunDismissed: false,
      // Unified successor to dismissFirstRun + dismissWizard. All
      // three actions (the canonical one + the two legacy shims)
      // share the same body — they were near-identical in v4 and
      // the difference between them was the field each wrote to
      // (firstRunDismissed vs wizard.dismissed). F2.22 collapsed
      // them into a single user-level dismiss that writes to both
      // for backward compat with the runtime gate in
      // `screens/main.tsx`. The shims are kept (without the
      // self-reference to `useAppStore`, which would break the
      // StateCreator inference at create() time) so external
      // callers that still use the old names keep working.
      dismissOnboarding: () =>
        set(state => ({
          firstRunDismissed: true,
          wizard: {
            ...state.wizard,
            active: false,
            dismissed: true,
          },
        })),
      // Legacy shim — same body as `dismissOnboarding`. Kept
      // because some external test fixtures (and any out-of-tree
      // consumers) still invoke the old name. Removed in a future
      // migration. New code MUST call `dismissOnboarding` directly.
      dismissFirstRun: () =>
        set(state => ({
          firstRunDismissed: true,
          wizard: {
            ...state.wizard,
            active: false,
            dismissed: true,
          },
        })),

      wizard: {
        ...DEFAULT_WIZARD_STATE,
        selections: { ...DEFAULT_WIZARD_SELECTIONS },
        // Stage 1 Configuration Wizard defaults (2026-07-26, wizard
        // Week 1). The new fields are already set on DEFAULT_WIZARD_STATE
        // but we re-assert the empty selections here for clarity (and
        // to give a future engineer a single grep target for the
        // Stage 1 initial state).
        stage1Selections: { ...DEFAULT_STAGE1_WIZARD_SELECTIONS },
        // Stage 2 Execution stepper defaults (2026-07-26, wizard
        // Week 3). Runtime-only — see `partialize` below.
        execution: { ...DEFAULT_EXECUTION_STEP_STATE },
      },
      setWizardActive: active =>
        set(state => ({
          wizard: { ...state.wizard, active },
        })),
      setWizardStep: stepIndex =>
        set(state => {
          const safeIndex = stepIndex < 0 ? 0 : Math.floor(stepIndex)
          if (state.wizard.stepIndex === safeIndex) return {}
          return { wizard: { ...state.wizard, stepIndex: safeIndex } }
        }),
      toggleWizardSelection: (field, id) =>
        set(state => {
          const current = state.wizard.selections[field]
          if (!Array.isArray(current)) {
            // Defensive: migration + defaults always seed `[]`. If somehow
            // missing (corrupted localStorage), treat as empty and append.
            return {
              wizard: {
                ...state.wizard,
                selections: {
                  ...state.wizard.selections,
                  [field]: [id],
                },
              },
            }
          }
          const next = current.includes(id)
            ? current.filter(x => x !== id)
            : [...current, id]
          return {
            wizard: {
              ...state.wizard,
              selections: {
                ...state.wizard.selections,
                [field]: next,
              },
            },
          }
        }),
      setWizardNumberField: (field, value) =>
        set(state => {
          const nextSelections = { ...state.wizard.selections }
          if (value === undefined) {
            delete nextSelections[field]
          } else {
            nextSelections[field] = value
          }
          return {
            wizard: { ...state.wizard, selections: nextSelections },
          }
        }),
      clearWizardSelections: () =>
        set(state => ({
          wizard: {
            ...state.wizard,
            selections: { ...DEFAULT_WIZARD_SELECTIONS },
          },
        })),
      // Legacy shim — same body as `dismissOnboarding`. Kept
      // because FirstTimerGuide.tsx and the wizard test file still
      // invoke the old name. Removed in a future migration. New
      // code MUST call `dismissOnboarding` directly.
      dismissWizard: () =>
        set(state => ({
          firstRunDismissed: true,
          wizard: {
            ...state.wizard,
            active: false,
            dismissed: true,
          },
        })),

      // -----------------------------------------------------------------
      // Stage 1 Configuration Wizard implementations (2026-07-26,
      // wizard Week 1). Feature-flagged behind `wizardEnabled: false`
      // by default; the flag is read by `main.tsx` to decide which
      // surface to render. The new fields are isolated from the legacy
      // kit-configurator fields so the old flow keeps working
      // untouched for users who haven't opted in.
      // -----------------------------------------------------------------

      // Default the feature flag to `false` so the new UI is opt-in.
      // The flag is persisted (see partialize below) so a user who
      // enables it keeps it across reloads. A user who never touches
      // the flag stays on the legacy GroupedTabNav + FirstTimerGuide
      // surface indefinitely.
      wizardEnabled: false,
      setWizardEnabled: enabled =>
        set(state => {
          if (state.wizardEnabled === enabled) return {}
          return { wizardEnabled: enabled }
        }),
      // Picking a branch resets every Stage 1 field so the user
      // starts the new branch from a clean slate. The legacy
      // kit-configurator fields are untouched.
      setProductType: branch =>
        set(state => ({
          wizard: {
            ...state.wizard,
            branch,
            currentStep: 0,
            stage1Selections: DEFAULT_STAGE1_WIZARD_SELECTIONS,
            stepHistory: [],
          },
        })),
      // Single-key write into `stage1Selections`. Passing `undefined`
      // deletes the key (Partial<...> semantics). No-op when the new
      // value === the existing value, so a re-render of the same
      // selection doesn't trigger a persist flush.
      setSelection: (key, value) =>
        set(state => {
          const current = state.wizard.stage1Selections[key]
          if (current === value) return {}
          const nextSelections: Stage1WizardSelections =
            value === undefined
              ? { ...state.wizard.stage1Selections }
              : { ...state.wizard.stage1Selections, [key]: value }
          if (value === undefined) {
            delete (nextSelections as Record<string, unknown>)[key as string]
          }
          return {
            wizard: { ...state.wizard, stage1Selections: nextSelections },
          }
        }),
      // Advance: push the current step onto history, then increment.
      // The push-then-increment order means `stepHistory[head] ===
      // currentStep` BEFORE the increment, which is the "step the user
      // is leaving" — the right value to pop on `prevStep` to restore.
      nextStep: () =>
        set(state => {
          const prev = state.wizard.currentStep
          const next = prev + 1
          // Guard against runaway increments (defensive — the UI
          // shouldn't allow advancing past the last step, but the
          // store is the last line of defense).
          if (next > 999) return {}
          return {
            wizard: {
              ...state.wizard,
              currentStep: next,
              stepHistory: [...state.wizard.stepHistory, prev],
            },
          }
        }),
      // Go back: pop the head of stepHistory and set currentStep to
      // that value. If history is empty (we're at step 0), this is a
      // no-op — there's no "back" from the product-type picker.
      prevStep: () =>
        set(state => {
          const history = state.wizard.stepHistory
          if (history.length === 0) return {}
          const newHistory = history.slice(0, -1)
          const restoredStep = history[history.length - 1] ?? 0
          return {
            wizard: {
              ...state.wizard,
              currentStep: restoredStep,
              stepHistory: newHistory,
            },
          }
        }),
      // Reset every Stage 1 field to its empty default. Keeps the
      // legacy kit-configurator fields and `wizardEnabled` flag
      // untouched so the user's "never re-prompt" preference and
      // feature-flag opt-in survive a reset. Also resets the
      // Stage 2 `execution` slice to its empty default (Week 3) —
      // a wizard reset implies the user is throwing away their
      // current run, so a half-finished Stage 2 execution should
      // not survive the reset.
      resetWizard: () =>
        set(state => ({
          wizard: {
            ...state.wizard,
            branch: null,
            currentStep: 0,
            stage1Selections: DEFAULT_STAGE1_WIZARD_SELECTIONS,
            stepHistory: [],
            execution: { ...DEFAULT_EXECUTION_STEP_STATE },
          },
        })),

      // -----------------------------------------------------------------
      // Stage 2 Execution stepper implementations (2026-07-26,
      // wizard Week 3). Runtime-only — see `partialize` below for
      // the not-persisted contract.
      // -----------------------------------------------------------------

      // Transition to Stage 2. No-op if `firstStepId` is empty
      // (defensive — a malformed dispatch shouldn't put the wizard
      // into a half-initialized state). `beginExecution` is a
      // fresh-start action: it seeds the execution slice from
      // `DEFAULT_EXECUTION_STEP_STATE` so any in-progress
      // `isRecalculating` / `affectedStepIds` from a previous run
      // are cleared. Week 4 added the two new fields to
      // `DEFAULT_EXECUTION_STEP_STATE`; this action picks them
      // up automatically through the spread.
      beginExecution: firstStepId =>
        set(state => {
          if (firstStepId.length === 0) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...DEFAULT_EXECUTION_STEP_STATE,
                currentStepId: firstStepId,
              },
            },
          }
        }),
      // Mark a step complete and advance. The
      // `currentStepId === stepId` guard is the contract: a stale
      // dispatch from a previous step (e.g. a delayed click after
      // the user already advanced) is a no-op rather than
      // corrupting the completed list. Spreads the previous
      // execution so the Week 4 recalculating fields
      // (`isRecalculating`, `affectedStepIds`) are preserved
      // across the transition — a "Mark complete" click during a
      // re-edit is a legitimate sequence and must not flash the
      // badge off.
      completeExecutionStep: (stepId, nextStepId) =>
        set(state => {
          if (state.wizard.execution.currentStepId !== stepId) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                currentStepId: nextStepId,
                completedStepIds: [
                  ...state.wizard.execution.completedStepIds,
                  stepId,
                ],
              },
            },
          }
        }),
      // Skip a step and advance. Same defensive guard as
      // `completeExecutionStep`. Same spread-the-existing-
      // execution rationale for the Week 4 recalculating fields.
      skipExecutionStep: (stepId, nextStepId) =>
        set(state => {
          if (state.wizard.execution.currentStepId !== stepId) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                currentStepId: nextStepId,
                skippedStepIds: [
                  ...state.wizard.execution.skippedStepIds,
                  stepId,
                ],
              },
            },
          }
        }),
      // §8.1 re-edit UX (Week 4, 2026-07-26 wizard build). Mark
      // Stage 2 as recalculating so the stepper can render a
      // "recalculating..." badge on the affected rows. No-op if
      // Stage 2 isn't running (you can't recalculate a Stage 2
      // that isn't active). The `affectedStepIds` array is
      // forwarded as-is — an empty array is a valid input that
      // semantically means "all steps affected" (the caller's
      // signal; ui-tabs owns the stepper-side "all" logic).
      markRecalculating: affectedStepIds =>
        set(state => {
          if (state.wizard.execution.currentStepId === null) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                isRecalculating: true,
                affectedStepIds,
              },
            },
          }
        }),
      // §8.1: clear the recalculating flag. No-op if not
      // currently recalculating (idempotent — calling this on
      // a stable stepper is a no-op rather than a spurious
      // re-render that could flicker the badge off and on).
      finishRecalculating: () =>
        set(state => {
          if (!state.wizard.execution.isRecalculating) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                isRecalculating: false,
                affectedStepIds: [],
              },
            },
          }
        }),
      // §8.1: convenience action for the WizardScreen — a
      // single dispatch that flips the recalculating flag on
      // and off so the stepper shows a brief "recalculating..."
      // flash. The Week 4 engine recompute is synchronous
      // (sub-millisecond) so the two `set()` calls happen
      // back-to-back; a subscriber listening to the store will
      // see the intermediate `isRecalculating: true` state
      // between the two writes. Week 7's a11y polish may
      // replace this with a debounced version if a future
      // async engine needs the delay. No-op if Stage 2 isn't
      // running.
      recomputeFromEdit: affectedStepIds => {
        set(state => {
          if (state.wizard.execution.currentStepId === null) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                isRecalculating: true,
                affectedStepIds,
              },
            },
          }
        })
        set(state => {
          if (state.wizard.execution.currentStepId === null) return {}
          return {
            wizard: {
              ...state.wizard,
              execution: {
                ...state.wizard.execution,
                isRecalculating: false,
                affectedStepIds: [],
              },
            },
          }
        })
      },
      // Return to Stage 1 from Stage 2. Stage 1 fields (branch,
      // currentStep, stage1Selections, stepHistory) are preserved
      // so the user can re-edit their config and re-run Stage 2
      // without re-picking every option.
      returnToConfig: () =>
        set(state => ({
          wizard: {
            ...state.wizard,
            execution: { ...DEFAULT_EXECUTION_STEP_STATE },
          },
        })),

      // -----------------------------------------------------------------
      // Stage 2 Recipes slice implementations (2026-07-26,
      // wizard Week 5). Per §8.2 + §8.5. See the AppStore
      // interface JSDoc above for the slice contract.
      // -----------------------------------------------------------------

      // Default to an empty array. The v8→v9 migration backfills
      // `recipes: []` on legacy envelopes so a returning user
      // sees a present-but-default value after the one-time
      // upgrade. New recipes are prepended (newest first) so the
      // Dashboard's "Recent recipes" list renders in the right
      // order without an extra sort.
      recipes: [],
      // Add a Recipe. The id is generated via `crypto.randomUUID()`
      // (a standard browser API in the Electron renderer) when
      // the caller doesn't supply one — useful for tests, which
      // often want a stable id for assertions. `createdAt`
      // defaults to `new Date().toISOString()`. A duplicate id
      // is rejected (no-op + the existing id is returned) so
      // the caller can safely re-issue an add and get a
      // idempotent response (the linked JournalEntry flow
      // chains addJournalEntry + setRecipeJournalEntry; a
      // re-issue must not corrupt the list).
      addRecipe: recipe => {
        const id = recipe.id ?? crypto.randomUUID()
        const createdAt = recipe.createdAt ?? new Date().toISOString()
        set(state => {
          if (state.recipes.some(r => r.id === id)) return {}  // dedupe no-op
          return {
            recipes: [
              {
                id,
                createdAt,
                name: recipe.name,
                branch: recipe.branch,
                selections: recipe.selections,
                batchJournalEntryId: recipe.batchJournalEntryId,
              },
              ...state.recipes,
            ],
          }
        })
        return id
      },
      // Rename a Recipe. The only post-save editable field is
      // `name` (selections and the journal link are immutable
      // from the user's perspective — re-running the recipe
      // goes through the wizard, not an in-place edit). No-op
      // if the id doesn't exist (the `map` is a no-op for
      // an empty match set, but we still incur the spread
      // cost; that's fine — the call is rare and the state
      // is structurally the same).
      renameRecipe: (id, name) => {
        set(state => ({
          recipes: state.recipes.map(r =>
            r.id === id ? { ...r, name } : r
          ),
        }))
      },
      // Delete a Recipe. The linked JournalEntry is NOT
      // deleted — `deleteRecipe` is a Recipe-only action, and
      // the Journal keeps its entry (the entry's source may
      // still be `wizard` for entries that pre-date the
      // Week 5 link; deleting the Recipe doesn't retroactively
      // change the source). No-op if the id doesn't exist.
      deleteRecipe: id => {
        set(state => ({
          recipes: state.recipes.filter(r => r.id !== id),
        }))
      },
      // Patch a Recipe's `batchJournalEntryId`. Used by the
      // Stage 2 completion step's "Save to Journal" flow: the
      // entry is written first (via `addJournalEntry`, which
      // returns nothing — the caller already has the id),
      // then the recipe is patched with the new entry id.
      // No-op if the recipe doesn't exist.
      setRecipeJournalEntry: (recipeId, journalEntryId) => {
        set(state => ({
          recipes: state.recipes.map(r =>
            r.id === recipeId ? { ...r, batchJournalEntryId: journalEntryId } : r
          ),
        }))
      },

      // -----------------------------------------------------------------
      // Week 6 Resume + Re-run action implementations (2026-07-27
      // wizard build). See the AppStore interface JSDoc above for
      // the contract — the implementations below mirror that
      // contract exactly. See docs/wizard-architecture-2026-07-26.md
      // §3.5 (Resume last) + §8.2 (Run again) + the §7 build
      // order Week 6.
      // -----------------------------------------------------------------

      // §3.5 Resume last. The action reads `state.wizard` via
      // the setter callback (the existing convention in this
      // store — `addRecipe` does the same; we don't switch the
      // outer destructuring to `(set, get) =>` just for one
      // action). Returns `null` when there's no in-flight
      // Stage 1 state to resume (branch is null OR
      // stage1Selections is empty). When resume IS possible,
      // re-anchors `currentStep` to the user's last position
      // (defensive — currentStep is already restored from
      // persistence on rehydrate, so this is a no-op in the
      // normal flow; the re-set makes the action idempotent
      // against a future bug that could zero the step out,
      // e.g., an errant `resetWizard` from another surface).
      // The returned `{ branch, lastStep }` lets the caller
      // (Dashboard "Resume last" CTA) route the wizard to the
      // user's last step without re-reading the store.
      resumeLastInFlight: () => {
        let result: { branch: ProductType; lastStep: number } | null = null
        set(state => {
          const w = state.wizard
          if (w.branch === null) return {}
          // Defensive: require at least one Stage 1 selection
          // before claiming "in-flight". The §3.5 spec says
          // "App launch with a saved Recipe: Dashboard offers
          // Resume last" — a user with no selections is
          // functionally equivalent to a fresh launch, so
          // return null. The `v !== undefined` check covers
          // the case where `setSelection(key, undefined)` was
          // called (the field is removed entirely; the
          // remaining keys are what matters).
          const hasSelections = Object.values(w.stage1Selections).some(
            v => v !== undefined
          )
          if (!hasSelections) return {}
          // The "last step" is the user's current position in
          // the wizard. stepHistory tracks the path to that
          // position but the head is one step behind currentStep
          // (nextStep pushes the current step onto history
          // BEFORE incrementing, so the head is the step the
          // user advanced FROM, not the step they advanced TO).
          // currentStep is therefore the right source of truth
          // for "the last step the user was on".
          const lastStep = w.currentStep
          result = { branch: w.branch, lastStep }
          // Defensive re-set. `execution` is preserved because
          // the spread `{ ...w }` carries it through; we only
          // override `currentStep`. Stage 2 stays ephemeral.
          return {
            wizard: { ...w, currentStep: lastStep },
          }
        })
        return result
      },
      // §8.2 Run again. Looks up the Recipe by id; returns
      // `null` if not found. On success, copies the recipe's
      // `selections` + `branch` into the Stage 1 wizard state
      // and resets `currentStep` + `stepHistory` so the user
      // re-enters Stage 1 at the product-type picker (the
      // selections are pre-filled, so the user can confirm each
      // step and immediately transition to Stage 2). Resets
      // `execution` to the empty defaults because the user is
      // starting a fresh batch — any in-progress Stage 2
      // markers from the previous run are stale.
      //
      // The caller (WizardScreen's CompletionStep) is
      // responsible for copying `recipe.name` into the
      // component-local `name` state — name is component-local,
      // not persisted. The action returns the recipe so the
      // caller has the name without re-looking it up.
      rerunRecipe: recipeId => {
        let found: Recipe | null = null
        set(state => {
          const recipe = state.recipes.find(r => r.id === recipeId)
          if (!recipe) return {}
          found = recipe
          return {
            wizard: {
              ...state.wizard,
              branch: recipe.branch,
              // Re-enter at the product-type picker (step 0)
              // with an empty stepHistory so the user re-walks
              // from the top. The selections are pre-filled
              // via `stage1Selections` below, so each step
              // shows up already-selected and the user can
              // either confirm or re-edit before advancing.
              currentStep: 0,
              // Shallow-copy the selections so a future
              // `setSelection` on the live wizard doesn't
              // mutate the stored Recipe.
              stage1Selections: { ...recipe.selections },
              stepHistory: [],
              // Fresh Stage 2 — any in-progress markers from
              // the previous run are stale.
              execution: { ...DEFAULT_EXECUTION_STEP_STATE },
            },
          }
        })
        return found
      },

      loadFromPreset: (preset: unknown) => {
        if (!isRecord(preset)) return

        const tabs = isRecord(preset.tabs) ? preset.tabs : {}

        const loadedUnits: UnitPreferences = {
          tempUnit: 'C',
          weightUnit: 'g',
          volumeUnit: 'mL',
          bagUnit: 'cm',
        }
        if (isRecord(preset.units)) {
          const u = preset.units
          if (u.tempUnit === 'C' || u.tempUnit === 'F')
            loadedUnits.tempUnit = u.tempUnit
          if (u.weightUnit === 'g' || u.weightUnit === 'oz')
            loadedUnits.weightUnit = u.weightUnit
          if (
            u.volumeUnit === 'mL' ||
            u.volumeUnit === 'tsp' ||
            u.volumeUnit === 'tbsp' ||
            u.volumeUnit === 'cup'
          )
            loadedUnits.volumeUnit = u.volumeUnit
          if (u.bagUnit === 'cm' || u.bagUnit === 'in')
            loadedUnits.bagUnit = u.bagUnit
        }

        let loadedDecarb = { ...DEFAULT_DECARB }
        if (isRecord(tabs.decarb)) {
          const d = tabs.decarb
          const di = isRecord(d.inputs) ? d.inputs : d
          loadedDecarb = {
            weight: stringish(di.weight, DEFAULT_DECARB.weight),
            // 2026-07-24 user-journey verification round 3: weightUnit
            // added to fix precision loss on weight toggle. Legacy
            // persisted state (pre-fix) has no field — default to
            // 'g' so the value interprets as the user typed it.
            weightUnit:
              di.weightUnit === 'g' || di.weightUnit === 'oz'
                ? di.weightUnit
                : DEFAULT_DECARB.weightUnit,
            thcaPct: stringish(di.thcaPct, DEFAULT_DECARB.thcaPct),
            thcPct: stringish(di.thcPct, DEFAULT_DECARB.thcPct),
            cbdaPct: stringish(di.cbdaPct, DEFAULT_DECARB.cbdaPct),
            cbdPct: stringish(di.cbdPct, DEFAULT_DECARB.cbdPct),
            presetId: stringish(di.presetId, DEFAULT_DECARB.presetId),
            tempOverrideUnit:
              di.tempOverrideUnit === 'C' || di.tempOverrideUnit === 'F'
                ? di.tempOverrideUnit
                : DEFAULT_DECARB.tempOverrideUnit,
            tempOverride: nullableStringish(di.tempOverride),
            timeOverride: nullableStringish(di.timeOverride),
            effLowOverride: nullableStringish(di.effLowOverride),
            effExpectedOverride: nullableStringish(di.effExpectedOverride),
            effHighOverride: nullableStringish(di.effHighOverride),
            bagExpanded:
              typeof di.bagExpanded === 'boolean'
                ? di.bagExpanded
                : DEFAULT_DECARB.bagExpanded,
            bagGrindId: stringish(di.bagGrindId, DEFAULT_DECARB.bagGrindId),
            bagPresetId: stringish(di.bagPresetId, DEFAULT_DECARB.bagPresetId),
            bagWidthOverrideUnit:
              di.bagWidthOverrideUnit === 'cm' ||
              di.bagWidthOverrideUnit === 'in'
                ? di.bagWidthOverrideUnit
                : DEFAULT_DECARB.bagWidthOverrideUnit,
            bagWidthOverride: nullableStringish(di.bagWidthOverride),
            bagLengthOverrideUnit:
              di.bagLengthOverrideUnit === 'cm' ||
              di.bagLengthOverrideUnit === 'in'
                ? di.bagLengthOverrideUnit
                : DEFAULT_DECARB.bagLengthOverrideUnit,
            bagLengthOverride: nullableStringish(di.bagLengthOverride),
            bagHasStems:
              typeof di.bagHasStems === 'boolean'
                ? di.bagHasStems
                : DEFAULT_DECARB.bagHasStems,
            strainId: nullableStringish(di.strainId),
            // 2026-07-25 AVB feature: 'avb' is now a valid materialMode
            // (Already Vaped Bud — already-decarboxylated material, see
            // the DecarbState.materialMode JSDoc). Legacy persisted
            // state (pre-v3) has no 'avb' value; a non-matching value
            // falls back to the runtime default 'flower' so a corrupted
            // snapshot can't sneak an invalid mode into the calculator.
            materialMode:
              di.materialMode === 'flower' ||
              di.materialMode === 'concentrate' ||
              di.materialMode === 'avb'
                ? di.materialMode
                : DEFAULT_DECARB.materialMode,
            concentrateTypeId: stringish(
              di.concentrateTypeId,
              DEFAULT_DECARB.concentrateTypeId
            ),
          }
        }

        let loadedInfusion = { ...DEFAULT_INFUSION }
        if (isRecord(tabs.infusion)) {
          const i = tabs.infusion
          const ii = isRecord(i.inputs) ? i.inputs : i
          loadedInfusion = {
            decarbedThc: stringish(
              ii.decarbedThc,
              DEFAULT_INFUSION.decarbedThc
            ),
            volume: stringish(ii.volume, DEFAULT_INFUSION.volume),
            // Same migration story as weightUnit above. Legacy
            // state defaults to 'mL'.
            volumeUnit:
              ii.volumeUnit === 'mL' ||
              ii.volumeUnit === 'tsp' ||
              ii.volumeUnit === 'tbsp' ||
              ii.volumeUnit === 'cup'
                ? ii.volumeUnit
                : DEFAULT_INFUSION.volumeUnit,
            fatId: stringish(ii.fatId, DEFAULT_INFUSION.fatId),
            customEfficiency: stringish(
              ii.customEfficiency,
              DEFAULT_INFUSION.customEfficiency
            ),
          }
        }

        let loadedDose = { ...DEFAULT_DOSE }
        if (isRecord(tabs.dose)) {
          const d = tabs.dose
          const di = isRecord(d.inputs) ? d.inputs : d
          loadedDose = {
            totalThc: stringish(di.totalThc, DEFAULT_DOSE.totalThc),
            servings: stringish(di.servings, DEFAULT_DOSE.servings),
            formatId: stringish(di.formatId, DEFAULT_DOSE.formatId),
            reverseMode:
              typeof di.reverseMode === 'boolean'
                ? di.reverseMode
                : DEFAULT_DOSE.reverseMode,
            desiredMgPerServing: stringish(
              di.desiredMgPerServing,
              DEFAULT_DOSE.desiredMgPerServing
            ),
          }
        }

        set({
          units: loadedUnits,
          decarb: loadedDecarb,
          infusion: loadedInfusion,
          dose: loadedDose,
        })
      },

      strains: [],
      setStrains: strains => set({ strains }),
      addStrain: strain =>
        set(state => ({
          strains: [...state.strains, strain],
        })),
      updateStrain: strain =>
        set(state => ({
          strains: state.strains.map(s => (s.id === strain.id ? strain : s)),
        })),
      deleteStrain: id =>
        set(state => ({
          strains: state.strains.filter(s => s.id !== id),
        })),
    }),
    {
      // Renamed from `'cannabis-chem-units'` to `'ccc-app-state'` in
      // the 2026-07-25 Cluster C refactor (F2.1) — the old name was
      // misleading because the partialize persists 10 slices, not
      // just `units`. The actual key-rename plumbing is in the
      // custom `storage` adapter below: on first rehydrate, the
      // adapter reads from the OLD key (`cannabis-chem-units`) when
      // the NEW key (`ccc-app-state`) is empty, hands the envelope
      // to the `migrate` function, and writes the migrated
      // envelope back to the NEW key. The OLD key is left in
      // localStorage as harmless dead bytes (no consumers read it
      // any more after this refactor).
      name: 'ccc-app-state',
      // Custom storage adapter: the standard `createJSONStorage(() =>
      // localStorage)` writes to whatever `name:` says. We override
      // it so the Cluster C key-rename (F2.1) can rehydrate from
      // the OLD `cannabis-chem-units` key on the first launch after
      // the rename, even though `name:` now points at the new
      // `ccc-app-state` key. The adapter drops the old envelope
      // after copying it — localStorage cleanup is cheap and
      // avoids accidental rollbacks to a stale v4 envelope if a
      // user downgrades. The migration is one-time: after the
      // first rehydrate, the new key is populated and the old
      // key is gone, so the adapter is a no-op on subsequent
      // launches.
      storage: createJSONStorage(() => {
        const OLD_KEY = 'cannabis-chem-units'
        return {
          getItem: name => {
            // Prefer the new key. Fall back to the old key on the
            // first rehydrate after the rename — the v4→v7
            // migration will run on whatever envelope we hand
            // back here, so the user sees their data either way.
            const fromNew = localStorage.getItem(name)
            if (fromNew != null) return fromNew
            return localStorage.getItem(OLD_KEY)
          },
          setItem: (name, value) => {
            localStorage.setItem(name, value)
            // After the new key is populated, drop the orphan
            // old-key entry. This is safe because the v4→v7
            // migration is idempotent — a future rehydrate from
            // the new key will not re-trigger the rename path.
            if (localStorage.getItem(OLD_KEY) != null) {
              localStorage.removeItem(OLD_KEY)
            }
          },
          removeItem: name => localStorage.removeItem(name),
        }
      }),
      // Bumped to v7 in the 2026-07-25 Cluster C refactor (F2.1 +
      // F2.4 + F2.22). The v4→v7 migration is a single chained
      // upgrade that does three things in order on a v4 envelope:
      //   1. collapses the `firstTimerOpen` boolean alias into
      //      `wizard.active` (F2.4). The migration copies the
      //      boolean into `wizard.active` only when the latter is
      //      undefined (a v4 envelope that already has a defined
      //      `wizard.active` keeps its own value). The
      //      `firstTimerOpen` field is then dropped from the
      //      envelope. The migration is idempotent: a v4
      //      envelope that already has `wizard.active`
      //      defined keeps its own value, and `firstTimerOpen`
      //      is dropped on the first run regardless.
      //   2. consolidates `firstRunDismissed` + `wizard.dismissed`
      //      into a single semantic `wizard.dismissed` flag. The
      //      v4 store had two near-identical actions
      //      (`dismissFirstRun` + `dismissWizard`) that wrote
      //      to two different fields. The v4→v7 migration
      //      preserves the v4 semantic distinction: a v4
      //      `dismissFirstRun` caller had TEMPORARY close
      //      semantics, not a permanent opt-out, so
      //      `wizard.dismissed` stays false. A v4
      //      `dismissWizard` caller (who hit the wizard's
      //      X button) had PERMANENT opt-out, so
      //      `wizard.dismissed` stays true.
      //   3. (handled by the custom `storage` adapter above, not
      //      by `migrate`) the persist key rename — when
      //      rehydrate runs against a v4 envelope sitting at
      //      the OLD key, the storage adapter reads it, hands
      //      the envelope to `migrate`, and writes the
      //      migrated envelope to the NEW key on flush.
      //
      // Bumped to v4 in the 2026-07-25 ccc-validation-orchestrator
      // audit cycle (MAJOR M1) — `JournalEntry.materialWeightUnit`
      // was claimed in the b02a259 commit message but never actually
      // landed on the interface. The Journal card was reading the
      // field via a type cast, and no save site wrote it, so a 0.12
      // oz entry would round-trip as "0.12 g" on the card (a 28x
      // under-report). The v3→v4 migration backfills
      // `materialWeightUnit: 'g'` on every legacy journal entry that
      // lacks a valid value, so consumers can rely on a present-but-
      // default value after a one-time upgrade. The migration is
      // idempotent — entries that already have a valid `'g' | 'oz'`
      // are preserved unchanged. The v4 partialize shape is otherwise
      // unchanged from v3: the field is a new optional member of
      // `JournalEntry` and ui-tabs's parallel dispatch is responsible
      // for writing it at the save sites (QuickBatchTab,
      // FirstTimerGuide, JournalTab). Once ui-tabs's parallel
      // dispatch lands, a v4 reader will start seeing real values
      // from new saves; the migration handles everything in the
      // meantime.
      //
      // Bumped to v3 in the 2026-07-25 AVB feature round when
      // `InventoryItem.kind` was added. The migration backfills
      // `kind: 'flower'` on every legacy inventory item that pre-dates
      // the field, so consumers can rely on a present value after a
      // one-time upgrade. The migration is idempotent — items that
      // already have a valid `kind` (including `'avb'`) are preserved
      // unchanged. The v3 partialize shape is otherwise unchanged from
      // v2: `decarb.materialMode` widening to include `'avb'` is
      // shape-compatible (a v2 reader that sees a v3 envelope with
      // `materialMode: 'avb'` will simply fall back to the default in
      // the loadFromPreset guard).
      //
      // Bumped to v2 when `JournalEntry.source` (provenance) was added.
      // The v1 partialize never persisted `journalEntries` (they live on
      // disk in localStorage / IPC), but the migration defensively
      // backfills any `journalEntries` array it finds in the persisted
      // snapshot with `source: 'unknown'` so consumers can rely on a
      // present-but-default value after a one-time upgrade.
      //
      // Bumped to v10 in the 2026-07-27 wizard Week 6 commit. The
      // v9→v10 migration is a normalisation pass over the
      // `recipes[]` slice (added in v9) — every entry is coerced
      // to the v9 Recipe shape (id, createdAt, name, branch,
      // selections, batchJournalEntryId) with sensible defaults
      // applied to missing or invalid fields. The migration
      // exists so the Week 6 Resume (§3.5) and Re-run (§8.2)
      // actions can rely on every Recipe in the slice being
      // fully shaped (e.g., a missing `createdAt` would surface
      // as `undefined` on the Dashboard's "Recent recipes" list
      // and break the "X days ago" rendering). The migration is
      // idempotent — running it on a v10-shaped envelope is a
      // no-op because every field check passes on the second
      // pass. The v10 schema itself does NOT add a new top-level
      // slice; the `recipes[]` slice from v9 is the persistent
      // home for the new actions, so `partialize` is unchanged
      // from v9.
      //
      // Bumped to v9 in the 2026-07-26 wizard Week 5 commit. The
      // v8→v9 migration initializes the Stage 2 Recipes slice
      // (`recipes: []` on the top-level envelope). The migration
      // is idempotent — running it on a v9-shaped envelope is a
      // no-op because the `Array.isArray` check passes on the
      // second pass. The slice is the canonical store for Recipe
      // records (per §8.2 + §8.5); the IDB mirror called out in
      // §7 Week 5 is out of scope for this commit and lands in
      // a follow-up (the localStorage write via `partialize` is
      // the canonical record).
      //
      // Bumped to v8 in the 2026-07-26 wizard Week 1 commit. The
      // v7→v8 migration initializes the Stage 1 Configuration Wizard
      // fields on the `wizard` slice (`branch: null`, `currentStep: 0`,
      // `stage1Selections: {}`, `stepHistory: []`) and the top-level
      // `wizardEnabled: false` feature flag. The migration is
      // idempotent — running it on a v8-shaped envelope is a no-op
      // because every field check passes on the second pass.
      //
      // The legacy kit-configurator fields (`active`, `dismissed`,
      // `stepIndex`, `selections`) are untouched by the v7→v8
      // migration. They were already shaped correctly in v7 and
      // remain the backing store for FirstTimerGuide until the §8.6
      // deprecation lands in a later week.
      version: 10,
      migrate: (persistedState: unknown, version: number): unknown => {
        if (!isRecord(persistedState)) return persistedState

        // Chain v0→v1 and v1→v2 by rebinding through `state` rather than
        // early-returning inside the v0→v1 block, so a v0→v2 upgrade runs
        // both migrations in order on the same envelope.
        let state: Record<string, unknown> = persistedState

        // v0 -> v1: the wizard slice is new. Backfill any missing array
        // keys with `[]` so consumers see a consistent shape regardless of
        // which version the user originally installed.
        if (version < 1) {
          const existingWizard = isRecord(state.wizard) ? state.wizard : {}
          const existingSelections = isRecord(existingWizard.selections)
            ? existingWizard.selections
            : {}

          const backfilledSelections: Record<string, unknown> = {
            equipment: Array.isArray(existingSelections.equipment)
              ? existingSelections.equipment
              : [],
            decarbMethodIds: Array.isArray(existingSelections.decarbMethodIds)
              ? existingSelections.decarbMethodIds
              : [],
            fatIds: Array.isArray(existingSelections.fatIds)
              ? existingSelections.fatIds
              : [],
            formatIds: Array.isArray(existingSelections.formatIds)
              ? existingSelections.formatIds
              : [],
          }

          // Numeric selection fields are optional. Carry them over only if
          // they were already defined as finite numbers (defensive against
          // accidental string-coercion from older builds).
          for (const numField of ['grams', 'thcaPct', 'servings'] as const) {
            const raw = existingSelections[numField]
            if (typeof raw === 'number' && Number.isFinite(raw)) {
              backfilledSelections[numField] = raw
            }
          }

          state = {
            ...state,
            wizard: {
              dismissed:
                typeof existingWizard.dismissed === 'boolean'
                  ? existingWizard.dismissed
                  : false,
              selections: backfilledSelections,
            },
          }
        }

        // v1 -> v2: `JournalEntry.source` (provenance) is new. Backfill any
        // existing journal entries with `source: 'unknown'` so consumers
        // can rely on a present value. The v1 partialize never wrote
        // `journalEntries` to disk (they live on disk in localStorage /
        // IPC via the Journal tab's load-on-mount), but the migration runs
        // defensively in case a future snapshot or a hand-edited local
        // dev envelope has the field. The 2026-07-25 ccc-uiux-reviewer
        // (BLOCKER B1) and ccc-workflow-validator reports both flagged the
        // missing provenance; this backfill closes the gap on legacy
        // entries without forcing the user to re-save.
        if (version < 2) {
          if (Array.isArray(state.journalEntries)) {
            const rawEntries = state.journalEntries as unknown[]
            state = {
              ...state,
              journalEntries: rawEntries.map(entry => {
                if (!isRecord(entry)) {
                  // Non-object entry — shouldn't happen in a well-formed
                  // snapshot, but be defensive. Stamping a sentinel so
                  // downstream code never has to defend against `undefined`.
                  return { source: 'unknown' as JournalEntrySource }
                }
                // Preserve any pre-existing valid source; otherwise stamp
                // 'unknown'. This makes the migration idempotent — running
                // it twice on a v2-shaped snapshot leaves entries intact.
                const existing = entry.source
                const valid =
                  existing === 'quickbatch' ||
                  existing === 'first_timer_guide' ||
                  existing === 'journal_form' ||
                  existing === 'advanced_tools' ||
                  existing === 'unknown'
                return {
                  ...entry,
                  source: valid
                    ? (existing as JournalEntrySource)
                    : ('unknown' as JournalEntrySource),
                }
              }),
            }
          }
        }

        // v2 -> v3: `InventoryItem.kind` (material semantic) is new in
        // the 2026-07-25 AVB feature round. Backfill any existing
        // inventory item that lacks a valid `kind` with `'flower'`
        // (the safe legacy default — a v2 user can only have raw
        // flower or concentrate in stock, never AVB, because AVB is a
        // new concept). The migration is idempotent: items that
        // already have a valid `kind` literal (including `'avb'`,
        // which can be injected manually for testing or by a future
        // build that beat the migration) are preserved unchanged.
        //
        // We intentionally do NOT stamp `source: 'avb'` on legacy
        // journal entries here — the v1→v2 source backfill already
        // stamped `'unknown'` on every pre-provenance entry, and the
        // AVB source is a forward-only value written by the AVB save
        // site in ui-tabs. Reclassifying old journal entries as
        // `'avb'` would be a data-integrity bug, not a migration.
        //
        // We also do NOT touch `decarb.materialMode` here — a v2
        // snapshot with `materialMode: 'flower' | 'concentrate'` is
        // still a valid v3 value, and the v2→v3 type widening in
        // `DecarbState` is purely additive. The v3 partialize shape
        // is otherwise unchanged from v2.
        if (version < 3) {
          if (
            isRecord(state.inventory) &&
            Array.isArray(state.inventory.items)
          ) {
            const rawItems = state.inventory.items as unknown[]
            state = {
              ...state,
              inventory: {
                ...state.inventory,
                items: rawItems.map(item => {
                  if (!isRecord(item)) {
                    // Defensive: a non-object item shouldn't appear in
                    // a well-formed snapshot. Leave it alone rather
                    // than stamp a fake `kind` on something that
                    // isn't an object — the runtime will surface a
                    // type error sooner this way.
                    return item
                  }
                  const existing = item.kind
                  if (
                    existing === 'flower' ||
                    existing === 'concentrate' ||
                    existing === 'avb'
                  ) {
                    // Already a v3-shaped item (or a v2 snapshot
                    // that was hand-edited to inject `kind`).
                    // Preserve the existing value — this makes the
                    // migration idempotent. Running it twice on a
                    // v3-shaped snapshot is a no-op.
                    return item
                  }
                  // Legacy v2 item (no `kind` field) or invalid
                  // value: stamp `'flower'` so consumers can rely
                  // on a present value.
                  return { ...item, kind: 'flower' as const }
                }),
              },
            }
          }
        }

        // v3 -> v4: `JournalEntry.materialWeightUnit` (per-entry
        // authoring unit) is new. The b02a259 commit message
        // claimed the field was added but it was never actually
        // landed on the `JournalEntry` interface — the Journal
        // card was reading it via a type cast, and no save site
        // was writing it, so a 0.12 oz entry would round-trip as
        // "0.12 g" on the card (a 28x under-report). The
        // 2026-07-25 ccc-validation-orchestrator cross-tab data
        // flow audit caught the gap as MAJOR M1. Backfill every
        // legacy journal entry that lacks a valid value with
        // `'g'` (the safe legacy default — pre-v4 users only
        // had a well-tested path that saved in grams; ounce
        // support is a v4-era write by ui-tabs's parallel
        // dispatch). The migration is idempotent — entries
        // that already have a valid `'g' | 'oz'` literal are
        // preserved unchanged. Invalid values (e.g. `'lb'`,
        // `42`, `null`) are coerced to `'g'` rather than
        // propagated, so consumers never have to defend against
        // a value outside the literal union.
        //
        // We intentionally do NOT pull from `units.weightUnit`
        // (the global unit preference) on the migration. The
        // global pref and the per-entry authoring unit are
        // independent signals — a user who toggled the global
        // pref to `'oz'` may still have legacy entries saved
        // in `'g'` (the only path that wrote entries pre-v4).
        // Treating the global pref as authoritative would
        // over-write that distinction. `'g'` is the safe
        // pre-v4 default; v4+ saves from ui-tabs write the
        // real value.
        //
        // Like the v1→v2 source backfill, the v3 partialize
        // never persisted `journalEntries` to disk (they live on
        // disk in localStorage / IPC via the Journal tab's
        // load-on-mount), but the migration runs defensively
        // in case a future snapshot or a hand-edited local dev
        // envelope has the field. If `state.journalEntries` is
        // missing or not an array, this block is a no-op.
        if (version < 4) {
          if (Array.isArray(state.journalEntries)) {
            const rawEntries = state.journalEntries as unknown[]
            state = {
              ...state,
              journalEntries: rawEntries.map(entry => {
                if (!isRecord(entry)) {
                  // Defensive: a non-object entry shouldn't appear
                  // in a well-formed snapshot. Stamping a sentinel
                  // so downstream code never has to defend against
                  // `undefined`.
                  return {
                    materialWeightUnit: 'g' as JournalEntry['materialWeightUnit'],
                  }
                }
                const existing = entry.materialWeightUnit
                if (existing === 'g' || existing === 'oz') {
                  // Already a v4-shaped entry (or a v3 snapshot
                  // that was hand-edited to inject the field).
                  // Preserve the existing value — this makes the
                  // migration idempotent. Running it twice on a
                  // v4-shaped entry is a no-op.
                  return entry
                }
                // Legacy v3 entry (no `materialWeightUnit` field)
                // or invalid value: stamp `'g'` so consumers can
                // rely on a present value. The pre-v4 save path
                // was grams-only, so this is the correct default
                // for entries that didn't record the unit.
                return { ...entry, materialWeightUnit: 'g' as const }
              }),
            }
          }
        }

        // v4 -> v7: Cluster C refactor (F2.1 + F2.4 + F2.22).
        // This single chained block does three things on a v4
        // envelope (a v5/v6 envelope is a no-op because the v4
        // sub-migrations are idempotent — see the comment on
        // `version: 7` above for the reasoning):
        //
        //   1. Collapse the `firstTimerOpen` boolean alias into
        //      `wizard.active` (F2.4). The previous dual-state
        //      invariant ("wizard.active === firstTimerOpen") was
        //      enforced by hand-rolled setters in the store; that
        //      contract is no longer guaranteed because
        //      `firstTimerOpen` has been removed from the AppStore
        //      interface. The migration copies the boolean into
        //      `wizard.active` only when the latter is undefined
        //      (a v4 envelope that already has a defined
        //      `wizard.active` keeps its own value). The
        //      `firstTimerOpen` field is then dropped from the
        //      envelope. The migration is idempotent.
        //
        //   2. Consolidate the dual "user dismissed the wizard"
        //      flag into a single `wizard.dismissed` (F2.22). The
        //      v4 store had two NEAR-IDENTICAL actions
        //      (`dismissFirstRun` + `dismissWizard`) that wrote
        //      to two different fields with DIFFERENT semantics:
        //        - `dismissFirstRun` (v4): TEMPORARY close.
        //          Set `firstRunDismissed: true`, closed the
        //          modal in the current session, did NOT set
        //          `wizard.dismissed`.
        //        - `dismissWizard` (v4): PERMANENT close. Set
        //          `wizard.dismissed: true`, closed the modal,
        //          also set `firstRunDismissed: true`.
        //      The Cluster C refactor merges the two ACTIONS
        //      into one (`dismissOnboarding`) but preserves
        //      their semantic distinction. The migration
        //      therefore only stamps `wizard.dismissed: true`
        //      if it was already true on the v4 envelope (a
        //      v4 `dismissWizard` caller). A v4
        //      `dismissFirstRun` caller has `wizard.dismissed:
        //      false` on the envelope, and the migration
        //      leaves it as false.
        //      `firstRunDismissed` is left intact on the
        //      envelope so the runtime gate in
        //      `screens/main.tsx` keeps working. The
        //      `dismissOnboarding` action writes to BOTH fields,
        //      so going forward the two flags stay in lockstep.
        //
        //   3. The persist key rename from `cannabis-chem-units`
        //      to `ccc-app-state` (F2.1) is handled by the
        //      custom `storage` adapter above, not by the
        //      `migrate` function — `migrate` only sees the
        //      state envelope, not the localStorage key. The
        //      adapter is the one that reads the OLD key, hands
        //      the envelope to `migrate`, and writes the
        //      migrated envelope to the NEW key.
        if (version < 7) {
          // F2.4: collapse firstTimerOpen alias into wizard.active.
          // Read the boolean (may be missing on hand-rolled v4
          // envelopes — treat missing as `false`).
          const legacyFirstTimerOpen =
            typeof state.firstTimerOpen === 'boolean'
              ? state.firstTimerOpen
              : false
          // Drop firstTimerOpen from the envelope — it's gone for
          // good.
          const { firstTimerOpen: _droppedFirstTimerOpen, ...rest } = state
          void _droppedFirstTimerOpen

          // F2.4: if wizard.active is undefined on the v4
          // envelope, copy firstTimerOpen into it. If wizard.active
          // is already defined (a v4 reader that saw
          // `wizard.active: false` at flush time), keep it —
          // the user's last-saved wizard.active wins.
          const existingWizard = isRecord(rest.wizard) ? rest.wizard : {}
          const existingWizardActive = (existingWizard as { active?: unknown })
            .active
          const nextWizardActive =
            typeof existingWizardActive === 'boolean'
              ? existingWizardActive
              : legacyFirstTimerOpen
          const nextWizard = {
            ...existingWizard,
            active: nextWizardActive,
          }

          // F2.22: preserve the existing `wizard.dismissed`
          // value. The migration does NOT OR with
          // `firstRunDismissed` because in v4 the two flags
          // had DIFFERENT semantics (see the migration
          // comment above): `dismissFirstRun` was a temporary
          // close, not a permanent opt-out. Confusing the two
          // would silently upgrade a v4 "Skip" user into a v7
          // "never re-prompt" user — a behavior change the
          // user did NOT request. The `dismissOnboarding`
          // action now writes to both fields, so going
          // forward the two flags stay in lockstep.
          const existingWizardDismissed =
            typeof (existingWizard as { dismissed?: unknown }).dismissed ===
            'boolean'
              ? (existingWizard as { dismissed: boolean }).dismissed
              : false
          const finalWizard = {
            ...nextWizard,
            dismissed: existingWizardDismissed,
          }

          state = {
            ...rest,
            wizard: finalWizard,
          }

          // v4 -> v7: normalize the per-tab unit fields. A
          // v3 envelope (or a hand-rolled v4 envelope) may
          // have an `infusion` / `decarb` / `dose` slice
          // that's missing `volumeUnit` / `weightUnit` /
          // `formatId` respectively, or has an invalid value
          // (e.g. a string the v1-v3 migrations never
          // normalized). Without this step, a returning user
          // whose localStorage envelope has, e.g.,
          // `infusion: { volume: '14' }` (no volumeUnit)
          // hits `volumeToMl(14, undefined)` on the first
          // render of QuickBatchTab and crashes the tab with
          // "Unknown volume unit: undefined" at units.ts:85.
          //
          // The v3->v4 migration at appStore.ts:1428 only
          // normalized `journalEntries[].materialWeightUnit`,
          // not the analog field on the active-tab slices.
          // This block closes that gap as part of the v4->v7
          // chained migration. The same valid-set coercion
          // pattern that `loadFromPreset` uses at
          // appStore.ts:1032-1057 is applied here for
          // consistency.
          //
          // Each block is independent — a slice that's
          // already a valid v7 shape is a no-op, a slice
          // with a missing field gets the default, a slice
          // with an invalid value gets the default. The
          // migration is idempotent: running it twice on a
          // v7 envelope is a no-op because the valid-set
          // check passes on the second pass.
          if (isRecord(state.infusion)) {
            const i = state.infusion
            const ii = isRecord(i.inputs) ? i.inputs : i
            const vu = ii.volumeUnit
            const coercedVu =
              vu === 'mL' ||
              vu === 'tsp' ||
              vu === 'tbsp' ||
              vu === 'cup'
                ? vu
                : DEFAULT_INFUSION.volumeUnit
            state = {
              ...state,
              infusion: {
                ...i,
                volumeUnit: coercedVu,
              },
            }
          }
          if (isRecord(state.decarb)) {
            const d = state.decarb
            const dd = isRecord(d.inputs) ? d.inputs : d
            const wu = dd.weightUnit
            const coercedWu =
              wu === 'g' || wu === 'oz' ? wu : DEFAULT_DECARB.weightUnit
            state = {
              ...state,
              decarb: {
                ...d,
                weightUnit: coercedWu,
              },
            }
          }
          if (isRecord(state.dose)) {
            const ds = state.dose
            const dsi = isRecord(ds.inputs) ? ds.inputs : ds
            const fi = dsi.formatId
            const coercedFi =
              typeof fi === 'string' && fi.length > 0
                ? fi
                : DEFAULT_DOSE.formatId
            state = {
              ...state,
              dose: {
                ...ds,
                formatId: coercedFi,
              },
            }
          }
        }

        // v7 -> v8: 2026-07-26 wizard Week 1. The Stage 1 Configuration
        // Wizard is added behind a feature flag (`wizardEnabled: false`).
        // The migration:
        //
        //   1. Initializes the new Stage 1 fields on the `wizard` slice
        //      — `branch: null`, `currentStep: 0`, `stage1Selections: {}`,
        //      `stepHistory: []` — so consumers can rely on
        //      present-but-default values after the one-time upgrade.
        //      A v7 envelope that already has these fields (a v8
        //      snapshot that was hand-edited, or a test fixture) keeps
        //      its own values; the migration only writes the defaults
        //      when a field is missing. Invalid values (e.g.
        //      `branch: 'banana'`, `currentStep: -3`) are coerced to
        //      the default rather than propagated.
        //
        //   2. Initializes the top-level `wizardEnabled: false` feature
        //      flag on the envelope. The flag is read by
        //      `src/renderer/screens/main.tsx` to decide whether to
        //      render the new WizardScreen. Default `false` keeps the
        //      new UI opt-in — existing users see the legacy
        //      GroupedTabNav + FirstTimerGuide surface until they
        //      explicitly enable it (a future commit).
        //
        // The migration is idempotent: a v8-shaped envelope already has
        // the new fields, so the second pass is a no-op.
        if (version < 8) {
          // Stage 1 wizard fields. Read the existing values defensively
          // and write them back with defaults applied only where
          // missing or invalid. The `isProductType` type-guard and the
          // finite-number check on `currentStep` mirror the coercion
          // pattern in the `merge` function below.
          const existingWizard = isRecord(state.wizard) ? state.wizard : {}
          const existingBranch = (existingWizard as { branch?: unknown }).branch
          const existingCurrentStep = (existingWizard as { currentStep?: unknown })
            .currentStep
          const existingStage1Selections = isRecord(
            (existingWizard as { stage1Selections?: unknown }).stage1Selections
          )
            ? (existingWizard as { stage1Selections: Record<string, unknown> })
                .stage1Selections
            : {}
          const existingStepHistoryValue = (
            existingWizard as { stepHistory?: unknown }
          ).stepHistory
          const existingStepHistory = Array.isArray(existingStepHistoryValue)
            ? (existingStepHistoryValue as unknown[]).filter(
                (n): n is number => typeof n === 'number' && Number.isFinite(n)
              )
            : []

          const nextBranch = isProductType(existingBranch) ? existingBranch : null
          const nextCurrentStep =
            typeof existingCurrentStep === 'number' &&
            Number.isFinite(existingCurrentStep) &&
            existingCurrentStep >= 0
              ? Math.floor(existingCurrentStep)
              : 0

          state = {
            ...state,
            wizard: {
              ...existingWizard,
              branch: nextBranch,
              currentStep: nextCurrentStep,
              stage1Selections: { ...existingStage1Selections },
              stepHistory: existingStepHistory,
            },
            // `wizardEnabled` is a top-level boolean. Coerce
            // non-boolean / missing values to `false` (the safe
            // default — opt-in).
            wizardEnabled:
              typeof (state as { wizardEnabled?: unknown }).wizardEnabled ===
              'boolean'
                ? (state as { wizardEnabled: boolean }).wizardEnabled
                : false,
          }
        }

        // v8 -> v9: Stage 2 Recipes slice (Week 5, per §8.2).
        // Legacy v8 state has no `recipes` key on the top-level
        // envelope — backfill to `[]` so consumers can rely on
        // a present-but-default value after a one-time upgrade.
        // The migration is idempotent — the v7→v8 migration
        // doesn't touch this key, and a v9→v9 re-run is a no-op
        // (the `Array.isArray` check passes on the second pass,
        // so the spread-and-default is a no-op for a valid
        // array). The `merge` function also defensively
        // coerces a non-array value to `[]`; this migration
        // is the canonical "first run on a v8 envelope" backfill,
        // the merge coercion is the runtime defense against a
        // hand-rolled or corrupted envelope.
        if (version < 9) {
          if (!Array.isArray(state.recipes)) {
            state = { ...state, recipes: [] }
          }
        }

        // v9 -> v10: Week 6 (2026-07-27 wizard build). The v10
        // schema itself doesn't add a new top-level slice — the
        // `recipes[]` slice added in v9 is the persistent home for
        // the Week 6 Resume (§3.5) and Re-run (§8.2) actions. The
        // migration's job is purely a normalisation pass: every
        // entry in `recipes[]` is coerced to the v9 Recipe shape
        // (id, createdAt, name, branch, selections,
        // batchJournalEntryId) with sensible defaults applied to
        // missing or invalid fields. This protects the Week 6
        // actions from a hand-rolled v9 envelope (dev tooling,
        // test fixture, a future build that beat the migration
        // and wrote a partial Recipe) — a missing `createdAt`
        // would surface as `undefined` on `recipe.createdAt` in
        // the Dashboard's "Recent recipes" list and break the
        // "X days ago" rendering. The migration is idempotent —
        // re-running it on a v10-shaped envelope is a no-op
        // because every field check passes on the second pass.
        // Legacy state without `recipes` is backfilled to `[]`
        // (defensively, even though the v8→v9 migration already
        // does this for v8 envelopes).
        if (version < 10) {
          if (!Array.isArray(state.recipes)) {
            state = { ...state, recipes: [] }
          } else {
            const now = new Date().toISOString()
            const rawRecipes = state.recipes as unknown[]
            state = {
              ...state,
              recipes: rawRecipes.map(r => {
                if (!isRecord(r)) {
                  // Defensive: a non-object entry shouldn't appear
                  // in a well-formed snapshot, but stamp a
                  // sentinel so downstream code never has to
                  // defend against an invalid entry. The id is
                  // generated (not preserved) because there's no
                  // id to preserve on a non-object.
                  return {
                    id: crypto.randomUUID(),
                    createdAt: now,
                    name: 'Untitled recipe',
                    branch: 'flower' as ProductType,
                    selections: {},
                    batchJournalEntryId: null,
                  }
                }
                return {
                  id:
                    typeof r.id === 'string'
                      ? r.id
                      : crypto.randomUUID(),
                  createdAt:
                    typeof r.createdAt === 'string'
                      ? r.createdAt
                      : now,
                  name:
                    typeof r.name === 'string'
                      ? r.name
                      : 'Untitled recipe',
                  branch: isProductType(r.branch) ? r.branch : 'flower',
                  selections:
                    typeof r.selections === 'object' &&
                    r.selections !== null
                      ? (r.selections as Recipe['selections'])
                      : {},
                  batchJournalEntryId:
                    typeof r.batchJournalEntryId === 'string'
                      ? r.batchJournalEntryId
                      : null,
                }
              }),
            }
          }
        }

        return state
      },
      // Custom merge: shallow per-top-level key, BUT the `wizard` slice gets
      // a deep-merge that always re-applies the runtime defaults
      // (`active: false`, `stepIndex: 0`) and the empty-array selection
      // defaults. This guarantees the modal never re-opens itself after a
      // reload and that every array-typed selection key is present even if
      // the persisted snapshot pre-dates this field.
      merge: (persistedState, currentState): AppStore => {
        const base = {
          ...(currentState as object),
          ...(persistedState as object),
        } as AppStore
        if (isRecord(persistedState) && isRecord(persistedState.wizard)) {
          // Persisted wizard only has `dismissed` + `selections`; runtime
          // fields must always reset to defaults on reload, and any
          // missing array keys must be filled in with `[]`.
          const persistedWizard = persistedState.wizard as Partial<WizardState>
          const persistedSelections = isRecord(persistedWizard.selections)
            ? (persistedWizard.selections as Partial<WizardSelections>)
            : {}

          const mergedSelections: WizardSelections = {
            ...DEFAULT_WIZARD_SELECTIONS,
            ...persistedSelections,
            equipment: Array.isArray(persistedSelections.equipment)
              ? (persistedSelections.equipment as string[])
              : [],
            decarbMethodIds: Array.isArray(persistedSelections.decarbMethodIds)
              ? (persistedSelections.decarbMethodIds as string[])
              : [],
            fatIds: Array.isArray(persistedSelections.fatIds)
              ? (persistedSelections.fatIds as string[])
              : [],
            formatIds: Array.isArray(persistedSelections.formatIds)
              ? (persistedSelections.formatIds as string[])
              : [],
          }

          // Stage 1 Configuration Wizard (2026-07-26, wizard Week 1).
          // The v7→v8 migration initializes the Stage 1 fields to
          // clean empty defaults, so a v8-shaped persisted envelope
          // has all of them. A pre-v8 envelope (or a hand-rolled
          // envelope from testing) is missing the new fields; the
          // merge falls back to the runtime defaults so consumers
          // never see `undefined` on the new keys.
          const persistedStage1Selections = isRecord(
            persistedWizard.stage1Selections
          )
            ? (persistedWizard.stage1Selections as Stage1WizardSelections)
            : {}
          const persistedStepHistory = Array.isArray(
            persistedWizard.stepHistory
          )
            ? (persistedWizard.stepHistory as number[])
            : []

          base.wizard = {
            ...DEFAULT_WIZARD_STATE,
            ...persistedWizard,
            selections: mergedSelections,
            active: false,
            stepIndex: 0,
            // Stage 1 fields: coerce to the expected shape on rehydrate.
            // `branch` defaults to null (not yet picked) when missing
            // or when the persisted value isn't one of the 5 valid
            // literals. `currentStep` clamps to a non-negative integer.
            branch: isProductType(persistedWizard.branch)
              ? persistedWizard.branch
              : null,
            currentStep:
              typeof persistedWizard.currentStep === 'number' &&
              Number.isFinite(persistedWizard.currentStep) &&
              persistedWizard.currentStep >= 0
                ? Math.floor(persistedWizard.currentStep)
                : 0,
            stage1Selections: {
              ...DEFAULT_STAGE1_WIZARD_SELECTIONS,
              ...persistedStage1Selections,
            },
            stepHistory: persistedStepHistory,
            // Stage 2 `execution` is EPHEMERAL by design (Week 3) —
            // see `ExecutionStepState` JSDoc. Even though the
            // `partialize` block below does not write `execution`
            // to the persisted envelope, a hand-rolled snapshot
            // (dev tooling, test fixtures, a future build that
            // regressed on the not-persisted contract) could
            // carry an `execution` key across the wire. We drop
            // it on rehydrate so a stale half-finished Stage 2
            // run can never leak into a fresh session. The
            // user always lands back at Stage 1 with their
            // selections intact and can re-enter Stage 2 in one
            // tap via `beginExecution`.
            execution: { ...DEFAULT_EXECUTION_STEP_STATE },
          }
        }
        // `wizardEnabled` feature flag: coerce to a boolean on
        // rehydrate so a corrupted snapshot can't sneak a non-boolean
        // value past the type system. Missing → false (opt-in default).
        if (isRecord(persistedState)) {
          const persistedFlag = (persistedState as { wizardEnabled?: unknown })
            .wizardEnabled
          ;(base as { wizardEnabled: boolean }).wizardEnabled =
            typeof persistedFlag === 'boolean' ? persistedFlag : false
          // Week 5 (per §8.2 + §8.5): the `recipes` slice. A
          // v8 envelope is missing this key (the v8→v9 migration
          // backfills `[]` on the persisted envelope, but a
          // hand-rolled v8 snapshot from a test fixture or dev
          // tooling could carry a non-array value). Coerce to
          // `[]` so a corrupted snapshot can't sneak a non-array
          // past the type system. The runtime default is also
          // `[]`, so the no-op case (missing key → currentState
          // value flows through) is correct.
          const persistedRecipes = (persistedState as { recipes?: unknown })
            .recipes
          ;(base as { recipes: Recipe[] }).recipes = Array.isArray(
            persistedRecipes
          )
            ? (persistedRecipes as Recipe[])
            : []
        }
        return base
      },
      partialize: state => ({
        // `activeTab` is intentionally not persisted today because raw tab
        // persistence would replay accidental visits and stale routes. When the
        // startup heuristic is implemented, persist explicit routing signals
        // instead: chooser intent, resume target, last successful path, and
        // confidence metadata.
        decarb: state.decarb,
        infusion: state.infusion,
        dose: state.dose,
        advancedTools: state.advancedTools,
        startupRouting: state.startupRouting,
        units: state.units,
        theme: state.theme,
        label: state.label,
        inventory: state.inventory,
        firstRunDismissed: state.firstRunDismissed,
        // Wizard: `dismissed` + legacy `selections` (kit configurator) +
        // Stage 1 fields (`branch`, `currentStep`, `stage1Selections`,
        // `stepHistory`) + `wizardEnabled` feature flag are persisted.
        // `active` and `stepIndex` are runtime-only — they must reset to
        // `false` / `0` on every reload so the modal never opens itself.
        // The Stage 1 fields survive reload so a mid-wizard abandon
        // resumes on the same step (per §3.5).
        //
        // Stage 2 `execution` (Week 3) is intentionally NOT in this
        // object — the Execution stepper state is ephemeral by
        // design (resuming a half-finished execution is dangerous —
        // see `ExecutionStepState` JSDoc in `wizardTypes.ts`). The
        // `merge` block above defensively drops any stale
        // `execution` key from a rehydrated envelope so a future
        // build that regressed on the not-persisted contract can't
        // leak a half-finished run across reloads.
        wizard: {
          dismissed: state.wizard.dismissed,
          selections: state.wizard.selections,
          branch: state.wizard.branch,
          currentStep: state.wizard.currentStep,
          stage1Selections: state.wizard.stage1Selections,
          stepHistory: state.wizard.stepHistory,
        },
        // Stage 1 Configuration Wizard feature flag (2026-07-26, wizard
        // Week 1). Persisted so the user's opt-in survives reloads.
        wizardEnabled: state.wizardEnabled,
        // Stage 2 Recipes slice (2026-07-26, wizard Week 5, per
        // §8.2 + §8.5). The canonical store for Recipe records —
        // every completed Stage 2 batch writes a Recipe here. The
        // IDB mirror called out in §7 Week 5 ("`NameRecipeStep` +
        // `appStore.recipes[]` slice + IDB mirror") is out of
        // scope for this commit; localStorage via `partialize`
        // is the canonical write, and a future ui-tabs commit
        // can wire the IDB mirror as a separate write.
        recipes: state.recipes,
      }),
    }
  )
)
