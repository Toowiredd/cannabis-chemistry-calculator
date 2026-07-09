import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Strain } from 'renderer/src/engine/models'

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
  thcaPct: string
  thcPct: string
  cbdaPct: string
  cbdPct: string
  presetId: string
  tempOverride: string | null
  timeOverride: string | null
  effLowOverride: string | null
  effExpectedOverride: string | null
  effHighOverride: string | null
  bagExpanded: boolean
  bagGrindId: string
  bagPresetId: string
  bagWidthOverride: string | null
  bagLengthOverride: string | null
  bagHasStems: boolean
  strainId: string | null
  /** Toggle between flower and concentrate mode */
  materialMode: 'flower' | 'concentrate'
  /** Selected concentrate type ID (e.g. 'wax', 'shatter') */
  concentrateTypeId: string
}

export interface InfusionState {
  decarbedThc: string
  volume: string
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

export type WizardNumberField = 'grams' | 'thcaPct' | 'servings'

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
  selections: WizardSelections
}

export const DEFAULT_WIZARD_SELECTIONS: WizardSelections = {
  equipment: [],
  decarbMethodIds: [],
  fatIds: [],
  formatIds: [],
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  active: false,
  dismissed: false,
  stepIndex: 0,
  selections: DEFAULT_WIZARD_SELECTIONS,
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
}

export interface InventoryState {
  items: InventoryItem[]
  lowStockThreshold: string
}

const DEFAULT_INVENTORY: InventoryState = {
  items: [],
  lowStockThreshold: '3.5',
}
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
}

export interface TimerState {
  active: boolean
  endTime: number | null
  totalSeconds: number
  methodName: string
}

export const DEFAULT_DECARB: DecarbState = {
  weight: '3.5',
  thcaPct: '20',
  thcPct: '0',
  cbdaPct: '0',
  cbdPct: '0',
  presetId: 'oven_sealed',
  tempOverride: null,
  timeOverride: null,
  effLowOverride: null,
  effExpectedOverride: null,
  effHighOverride: null,
  bagExpanded: true,
  bagGrindId: 'medium',
  bagPresetId: 'quart',
  bagWidthOverride: null,
  bagLengthOverride: null,
  bagHasStems: false,
  strainId: null,
  materialMode: 'flower',
  concentrateTypeId: 'wax',
}

export const DEFAULT_INFUSION: InfusionState = {
  decarbedThc: '',
  volume: '100',
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
  dismissFirstRun: () => void

  firstTimerOpen: boolean
  setFirstTimerOpen: (open: boolean) => void

  /**
   * Multi-select wizard (kit configurator) slice. See `WizardState` for
   * field-level semantics. `firstTimerOpen` is kept in sync with
   * `wizard.active` as a transient alias so legacy readers
   * (`FirstTimerGuide.tsx`) keep working during the migration.
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
   * User-level dismiss: sets `wizard.dismissed = true` and closes the modal
   * in the current session. Persistent — once dismissed, the wizard never
   * re-prompts automatically. Only an explicit "Show guide" / "?" action
   * can reopen it.
   */
  dismissWizard: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
      dismissFirstRun: () =>
        set(state => ({
          firstRunDismissed: true,
          firstTimerOpen: false,
          wizard: { ...state.wizard, active: false },
        })),

      firstTimerOpen: false,
      setFirstTimerOpen: open =>
        set(state => ({
          firstTimerOpen: open,
          wizard: { ...state.wizard, active: open },
        })),

      wizard: {
        ...DEFAULT_WIZARD_STATE,
        selections: { ...DEFAULT_WIZARD_SELECTIONS },
      },
      setWizardActive: active =>
        set(state => ({
          wizard: { ...state.wizard, active },
          firstTimerOpen: active,
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
      dismissWizard: () =>
        set(state => ({
          wizard: {
            ...state.wizard,
            active: false,
            dismissed: true,
          },
          firstTimerOpen: false,
        })),

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
            thcaPct: stringish(di.thcaPct, DEFAULT_DECARB.thcaPct),
            thcPct: stringish(di.thcPct, DEFAULT_DECARB.thcPct),
            cbdaPct: stringish(di.cbdaPct, DEFAULT_DECARB.cbdaPct),
            cbdPct: stringish(di.cbdPct, DEFAULT_DECARB.cbdPct),
            presetId: stringish(di.presetId, DEFAULT_DECARB.presetId),
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
            bagWidthOverride: nullableStringish(di.bagWidthOverride),
            bagLengthOverride: nullableStringish(di.bagLengthOverride),
            bagHasStems:
              typeof di.bagHasStems === 'boolean'
                ? di.bagHasStems
                : DEFAULT_DECARB.bagHasStems,
            strainId: nullableStringish(di.strainId),
            materialMode:
              di.materialMode === 'flower' || di.materialMode === 'concentrate'
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
      name: 'cannabis-chem-units',
      // Bumped to v1 when the multi-select wizard slice was added. Older v0
      // snapshots have no wizard fields at all; the migration backfills
      // missing array keys with `[]` so `toggleWizardSelection` never has
      // to defend against `undefined`. Partializing only `dismissed` +
      // `selections` keeps the on-disk shape minimal and the runtime fields
      // (`active`, `stepIndex`) reset to defaults on every reload.
      version: 1,
      migrate: (persistedState: unknown, version: number): unknown => {
        if (!isRecord(persistedState)) return persistedState

        // v0 -> v1: the wizard slice is new. Backfill any missing array
        // keys with `[]` so consumers see a consistent shape regardless of
        // which version the user originally installed.
        if (version < 1) {
          const existingWizard = isRecord(persistedState.wizard)
            ? persistedState.wizard
            : {}
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

          return {
            ...persistedState,
            wizard: {
              dismissed:
                typeof existingWizard.dismissed === 'boolean'
                  ? existingWizard.dismissed
                  : false,
              selections: backfilledSelections,
            },
          }
        }

        return persistedState
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

          base.wizard = {
            ...DEFAULT_WIZARD_STATE,
            ...persistedWizard,
            selections: mergedSelections,
            active: false,
            stepIndex: 0,
          }
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
        // Wizard: only `dismissed` and `selections` are persisted.
        // `active` and `stepIndex` are runtime-only — they must reset to
        // `false` / `0` on every reload so the modal never opens itself.
        wizard: {
          dismissed: state.wizard.dismissed,
          selections: state.wizard.selections,
        },
      }),
    }
  )
)
