import { create } from 'zustand'

export type TabId =
  | 'decarb'
  | 'infusion'
  | 'dose'
  | 'methods'
  | 'fats'
  | 'knowledge'

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
}

export const useAppStore = create<AppStore>(set => ({
  activeTab: 'decarb',
  setActiveTab: tab => set({ activeTab: tab }),

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
  setDose: partial => set(state => ({ dose: { ...state.dose, ...partial } })),
  resetDose: () => set({ dose: { ...DEFAULT_DOSE } }),
}))
