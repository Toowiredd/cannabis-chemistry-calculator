import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabId =
  | 'decarb'
  | 'infusion'
  | 'dose'
  | 'methods'
  | 'fats'
  | 'knowledge'

export type Theme = 'dark' | 'light'

export interface UnitPreferences {
  tempUnit: 'C' | 'F'
  weightUnit: 'g' | 'oz'
  volumeUnit: 'mL' | 'tsp' | 'tbsp' | 'cup'
}

export interface DecarbState {
  weight: string
  thcaPct: string
  thcPct: string
  presetId: string
  tempOverride: string | null
  timeOverride: string | null
  effLowOverride: string | null
  effExpectedOverride: string | null
  effHighOverride: string | null
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
}

const DEFAULT_DECARB: DecarbState = {
  weight: '3.5',
  thcaPct: '20',
  thcPct: '0',
  presetId: 'sv_dry',
  tempOverride: null,
  timeOverride: null,
  effLowOverride: null,
  effExpectedOverride: null,
  effHighOverride: null,
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

  /** Last computed decarb expected mg for downstream carry-forward */
  lastDecarbExpected: string
  setLastDecarbExpected: (val: string) => void

  /** Last computed infused THC mg for downstream carry-forward */
  lastInfusedThc: string
  setLastInfusedThc: (val: string) => void

  loadFromPreset: (preset: unknown) => void
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

      lastDecarbExpected: '',
      setLastDecarbExpected: val => set({ lastDecarbExpected: val }),

      lastInfusedThc: '',
      setLastInfusedThc: val => set({ lastInfusedThc: val }),

      loadFromPreset: (preset: unknown) => {
        if (!isRecord(preset)) return

        const tabs = isRecord(preset.tabs) ? preset.tabs : {}

        const loadedUnits: UnitPreferences = {
          tempUnit: 'C',
          weightUnit: 'g',
          volumeUnit: 'mL',
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
        }

        let loadedDecarb = { ...DEFAULT_DECARB }
        if (isRecord(tabs.decarb)) {
          const d = tabs.decarb
          const di = isRecord(d.inputs) ? d.inputs : d
          loadedDecarb = {
            weight: stringish(di.weight, DEFAULT_DECARB.weight),
            thcaPct: stringish(di.thcaPct, DEFAULT_DECARB.thcaPct),
            thcPct: stringish(di.thcPct, DEFAULT_DECARB.thcPct),
            presetId: stringish(di.presetId, DEFAULT_DECARB.presetId),
            tempOverride: nullableStringish(di.tempOverride),
            timeOverride: nullableStringish(di.timeOverride),
            effLowOverride: nullableStringish(di.effLowOverride),
            effExpectedOverride: nullableStringish(di.effExpectedOverride),
            effHighOverride: nullableStringish(di.effHighOverride),
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
          }
        }

        set({
          units: loadedUnits,
          decarb: loadedDecarb,
          infusion: loadedInfusion,
          dose: loadedDose,
        })
      },
    }),
    {
      name: 'cannabis-chem-units',
      partialize: state => ({ units: state.units, theme: state.theme }),
    }
  )
)
