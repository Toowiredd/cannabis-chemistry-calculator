/**
 * Pure domain models for the Cannabis Chemistry Calculator.
 * Zero imports from React, Tailwind, Electron, or any UI library.
 */

// ---------------------------------------------------------------------------
// Decarboxylation
// ---------------------------------------------------------------------------

export interface EfficiencyRange {
  /** Lowest expected efficiency [0.0, 1.0] */
  low: number
  /** Most likely efficiency [0.0, 1.0] */
  expected: number
  /** Best-case efficiency [0.0, 1.0] */
  high: number
}

export interface DecarbInput {
  /** Material weight in grams (internal unit) */
  grams: number
  /** THCA percentage [0, 100] */
  thcaPct: number
  /** Already-decarboxylated THC percentage [0, 100] */
  thcPct: number
  /** Decarboxylation efficiency override (null = use preset) */
  efficiencyOverride?: EfficiencyRange | null
}

export interface DecarbOutput {
  /** Theoretical maximum THC in mg (rounded to 1 decimal) */
  theoreticalMax: number
  /** Decarb-adjusted THC range in mg */
  decarbedRange: EfficiencyRange
}

// ---------------------------------------------------------------------------
// Fat Infusion
// ---------------------------------------------------------------------------

export interface InfusionInput {
  /** Decarboxylated THC in mg */
  decarbedThcMg: number
  /** Fat volume in mL (internal unit) */
  volumeMl: number
  /** Extraction efficiency [0.0, 1.0]; null = use preset */
  extractionEffOverride?: number | null
}

export interface InfusionOutput {
  /** Total infused THC in mg (rounded to 1 decimal) */
  infusedThcMg: number
  /** Concentration per mL in mg (rounded to 1 decimal) */
  mgPerMl: number
}

// ---------------------------------------------------------------------------
// Dosing
// ---------------------------------------------------------------------------

export interface DoseInput {
  /** Total infused THC in mg */
  finalThcMg: number
  /** Number of servings */
  servings: number
}

export interface DoseOutput {
  /** THC per serving in mg (rounded to 1 decimal) */
  mgPerServing: number
  /** Classification label */
  classification: DoseClassification
}

export type DoseClassification =
  | 'sub-microdose'
  | 'microdose'
  | 'low'
  | 'moderate'
  | 'strong'
  | 'very strong'
  | 'extreme'

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Decarboxylation method preset */
export interface PresetMethod {
  /** Internal identifier */
  id: string
  /** Human-readable name (text-only, no symbols) */
  name: string
  /** Temperature in Celsius (internal) */
  tempC: number
  /** Minimum time in minutes */
  timeMin: number
  /** Maximum time in minutes */
  timeMax: number
  /** Efficiency range */
  efficiency: EfficiencyRange
  /** Qualitative terpene retention label */
  terpeneLabel: string
  /** Qualitative CBN formation risk label */
  cbnLabel: string
  /** Qualitative oxygen exposure label */
  oxygenLabel: string
}

/** Carrier fat preset */
export interface PresetFat {
  /** Internal identifier */
  id: string
  /** Human-readable name (text-only, no symbols) */
  name: string
  /** Extraction efficiency [0.0, 1.0] */
  extractionEff: number
  /** Simplified multiplier for estimate: grams * THCA% * multiplier */
  simplifiedMultiplier: number
  /** Optional note/description */
  notes?: string
}

// ---------------------------------------------------------------------------
// Method Preset Data -- exactly 6 entries
// ---------------------------------------------------------------------------

export const DECARB_METHODS: readonly PresetMethod[] = [
  {
    id: 'sv_dry',
    name: 'Sous Vide -- Dry',
    tempC: 95,
    timeMin: 90,
    timeMax: 120,
    efficiency: { low: 0.95, expected: 0.97, high: 0.98 },
    terpeneLabel: 'High retention',
    cbnLabel: 'Low CBN risk',
    oxygenLabel: 'Minimal',
  },
  {
    id: 'sv_combined',
    name: 'Sous Vide -- Combined',
    tempC: 85,
    timeMin: 240,
    timeMax: 360,
    efficiency: { low: 0.85, expected: 0.88, high: 0.92 },
    terpeneLabel: 'Moderate retention',
    cbnLabel: 'Low CBN risk',
    oxygenLabel: 'Minimal',
  },
  {
    id: 'sv_fast',
    name: 'Sous Vide -- Fast',
    tempC: 95,
    timeMin: 120,
    timeMax: 180,
    efficiency: { low: 0.95, expected: 0.97, high: 0.98 },
    terpeneLabel: 'Moderate retention',
    cbnLabel: 'Low CBN risk',
    oxygenLabel: 'Minimal',
  },
  {
    id: 'sv_lowtemp',
    name: 'Sous Vide -- Low Temp',
    tempC: 73,
    timeMin: 480,
    timeMax: 720,
    efficiency: { low: 0.6, expected: 0.68, high: 0.75 },
    terpeneLabel: 'Very high retention',
    cbnLabel: 'Very low CBN risk',
    oxygenLabel: 'Minimal',
  },
  {
    id: 'oven_sealed',
    name: 'Oven -- Sealed Container',
    tempC: 113,
    timeMin: 60,
    timeMax: 90,
    efficiency: { low: 0.9, expected: 0.93, high: 0.95 },
    terpeneLabel: 'Moderate retention',
    cbnLabel: 'Moderate CBN risk',
    oxygenLabel: 'Low',
  },
  {
    id: 'oven_open',
    name: 'Oven -- Open Air',
    tempC: 116,
    timeMin: 40,
    timeMax: 40,
    efficiency: { low: 0.88, expected: 0.92, high: 0.95 },
    terpeneLabel: 'Low retention',
    cbnLabel: 'High CBN risk',
    oxygenLabel: 'High',
  },
] as const

// ---------------------------------------------------------------------------
// Fat Preset Data -- exactly 4 entries
// ---------------------------------------------------------------------------

export const INFUSION_FATS: readonly PresetFat[] = [
  {
    id: 'ghee',
    name: 'Ghee',
    extractionEff: 0.85,
    simplifiedMultiplier: 8.5,
    notes:
      'Clarified butter with high smoke point and rich flavor; excellent cannabinoid solubility',
  },
  {
    id: 'coconut',
    name: 'Coconut Oil',
    extractionEff: 0.82,
    simplifiedMultiplier: 8.2,
    notes:
      'High medium-chain triglyceride content; mild coconut aroma and solid at room temperature',
  },
  {
    id: 'mct',
    name: 'MCT Oil',
    extractionEff: 0.92,
    simplifiedMultiplier: 9.2,
    notes:
      'Fractionated coconut oil; very high extraction efficiency, neutral flavor, liquid at room temperature',
  },
  {
    id: 'custom',
    name: 'Custom',
    extractionEff: 0.0,
    simplifiedMultiplier: 0.0,
    notes: 'User-defined carrier fat; set extraction efficiency manually',
  },
] as const
