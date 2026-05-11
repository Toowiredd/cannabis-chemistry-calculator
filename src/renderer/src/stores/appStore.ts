import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Strain } from 'renderer/src/engine/models'

export type TabId =
  | 'decarb'
  | 'infusion'
  | 'dose'
  | 'methods'
  | 'fats'
  | 'knowledge'
  | 'journal'
  | 'dashboard'
  | 'quickbatch'

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

const DEFAULT_DECARB: DecarbState = {
  weight: '3.5',
  thcaPct: '20',
  thcPct: '0',
  cbdaPct: '0',
  cbdPct: '0',
  presetId: 'sv_dry',
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

const DEFAULT_INFUSION: InfusionState = {
  decarbedThc: '',
  volume: '100',
  fatId: 'coconut',
  customEfficiency: '0.82',
}

const DEFAULT_DOSE: DoseState = {
  totalThc: '',
  servings: '10',
  formatId: 'custom',
  reverseMode: false,
  desiredMgPerServing: '10',
}

interface AppStore {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

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

      label: { ...DEFAULT_LABEL },
      setLabel: partial =>
        set(state => ({ label: { ...state.label, ...partial } })),
      resetLabel: () => set({ label: { ...DEFAULT_LABEL } }),
      incrementBatchNumber: () =>
        set(state => ({
          label: { ...state.label, batchNumber: state.label.batchNumber + 1 },
        })),

      lastDecarbExpected: '',
      setLastDecarbExpected: val => set({ lastDecarbExpected: val }),

      lastInfusedThc: '',
      setLastInfusedThc: val => set({ lastInfusedThc: val }),

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
      dismissFirstRun: () => set({ firstRunDismissed: true }),

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
      partialize: state => ({
        units: state.units,
        theme: state.theme,
        label: state.label,
        inventory: state.inventory,
        firstRunDismissed: state.firstRunDismissed,
      }),
    }
  )
)
