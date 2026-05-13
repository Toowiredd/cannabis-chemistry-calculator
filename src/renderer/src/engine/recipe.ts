/**
 * Recipe engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 *
 * Provides save/load/scale for complete calculator state snapshots.
 */
import { ValidationError } from './errors'
import { calculateTheoreticalMax, calculateRange } from './decarb'
import { calculateInfusedThc, calculateMgPerMl } from './infusion'
import { calculateMgPerServing, classifyDose } from './dosing'
import { DECARB_METHODS, INFUSION_FATS } from './models'

// ---------------------------------------------------------------------------
// Types (mirroring store shapes without importing Zustand/React)
// ---------------------------------------------------------------------------

export interface RecipeUnits {
  tempUnit: 'C' | 'F'
  weightUnit: 'g' | 'oz'
  volumeUnit: 'mL' | 'tsp' | 'tbsp' | 'cup'
  bagUnit: 'cm' | 'in'
}

export interface RecipeDecarb {
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
}

export interface RecipeInfusion {
  decarbedThc: string
  volume: string
  fatId: string
  customEfficiency: string
}

export interface RecipeDose {
  totalThc: string
  servings: string
}

export interface ComputedRecipeOutput {
  /** Theoretical maximum THC in mg (rounded 1 decimal) */
  theoreticalMax: number
  /** Decarb-adjusted low/expected/high in mg */
  decarbedRange: { low: number; expected: number; high: number }
  /** Infused THC total in mg */
  infusedThc: number
  /** mg per mL */
  mgPerMl: number
  /** mg per serving */
  mgPerServing: number
  /** Dose classification label */
  classification: string
}

export interface Recipe {
  version: string
  name: string
  createdAt: string
  units: RecipeUnits
  decarb: RecipeDecarb
  infusion: RecipeInfusion
  dose: RecipeDose
  /** Optional pre-computed downstream values (populated by scaleRecipe) */
  computed?: ComputedRecipeOutput
}

// ---------------------------------------------------------------------------
// Defaults (matching appStore defaults)
// ---------------------------------------------------------------------------

const DEFAULT_DECARB: RecipeDecarb = {
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
}

const DEFAULT_INFUSION: RecipeInfusion = {
  decarbedThc: '',
  volume: '100',
  fatId: 'coconut',
  customEfficiency: '0.82',
}

const DEFAULT_DOSE: RecipeDose = {
  totalThc: '',
  servings: '10',
}

const DEFAULT_UNITS: RecipeUnits = {
  tempUnit: 'C',
  weightUnit: 'g',
  volumeUnit: 'mL',
  bagUnit: 'cm',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function _numberish(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value
  const n = typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : fallback
}

/** Parse a string to a finite number, returning NaN if invalid */
function parseFinite(str: string): number {
  const n = Number(str)
  return Number.isFinite(n) ? n : NaN
}

/** Round to at most 1 decimal place */
function round1(value: number): number {
  if (!Number.isFinite(value)) return value
  return Math.round((value + 1e-9) * 10) / 10
}

/** Scale a string number by a factor, returning rounded string */
function scaleString(str: string, factor: number): string {
  const n = parseFinite(str)
  if (Number.isNaN(n)) return str
  return String(round1(n * factor))
}

/** Build a RecipeDecarb from a partial object, filling defaults */
function buildDecarb(source: Record<string, unknown>): RecipeDecarb {
  return {
    weight: stringish(source.weight, DEFAULT_DECARB.weight),
    thcaPct: stringish(source.thcaPct, DEFAULT_DECARB.thcaPct),
    thcPct: stringish(source.thcPct, DEFAULT_DECARB.thcPct),
    cbdaPct: stringish(source.cbdaPct, DEFAULT_DECARB.cbdaPct),
    cbdPct: stringish(source.cbdPct, DEFAULT_DECARB.cbdPct),
    presetId: stringish(source.presetId, DEFAULT_DECARB.presetId),
    tempOverride: nullableStringish(source.tempOverride),
    timeOverride: nullableStringish(source.timeOverride),
    effLowOverride: nullableStringish(source.effLowOverride),
    effExpectedOverride: nullableStringish(source.effExpectedOverride),
    effHighOverride: nullableStringish(source.effHighOverride),
    bagExpanded:
      typeof source.bagExpanded === 'boolean'
        ? source.bagExpanded
        : DEFAULT_DECARB.bagExpanded,
    bagGrindId: stringish(source.bagGrindId, DEFAULT_DECARB.bagGrindId),
    bagPresetId: stringish(source.bagPresetId, DEFAULT_DECARB.bagPresetId),
    bagWidthOverride: nullableStringish(source.bagWidthOverride),
    bagLengthOverride: nullableStringish(source.bagLengthOverride),
    bagHasStems:
      typeof source.bagHasStems === 'boolean'
        ? source.bagHasStems
        : DEFAULT_DECARB.bagHasStems,
  }
}

/** Build a RecipeInfusion from a partial object, filling defaults */
function buildInfusion(source: Record<string, unknown>): RecipeInfusion {
  return {
    decarbedThc: stringish(source.decarbedThc, DEFAULT_INFUSION.decarbedThc),
    volume: stringish(source.volume, DEFAULT_INFUSION.volume),
    fatId: stringish(source.fatId, DEFAULT_INFUSION.fatId),
    customEfficiency: stringish(
      source.customEfficiency,
      DEFAULT_INFUSION.customEfficiency
    ),
  }
}

/** Build a RecipeDose from a partial object, filling defaults */
function buildDose(source: Record<string, unknown>): RecipeDose {
  return {
    totalThc: stringish(source.totalThc, DEFAULT_DOSE.totalThc),
    servings: stringish(source.servings, DEFAULT_DOSE.servings),
  }
}

/** Build RecipeUnits from a partial object, filling defaults */
function buildUnits(source: Record<string, unknown>): RecipeUnits {
  return {
    tempUnit:
      source.tempUnit === 'C' || source.tempUnit === 'F'
        ? (source.tempUnit as 'C' | 'F')
        : DEFAULT_UNITS.tempUnit,
    weightUnit:
      source.weightUnit === 'g' || source.weightUnit === 'oz'
        ? (source.weightUnit as 'g' | 'oz')
        : DEFAULT_UNITS.weightUnit,
    volumeUnit:
      source.volumeUnit === 'mL' ||
      source.volumeUnit === 'tsp' ||
      source.volumeUnit === 'tbsp' ||
      source.volumeUnit === 'cup'
        ? (source.volumeUnit as 'mL' | 'tsp' | 'tbsp' | 'cup')
        : DEFAULT_UNITS.volumeUnit,
    bagUnit:
      source.bagUnit === 'cm' || source.bagUnit === 'in'
        ? (source.bagUnit as 'cm' | 'in')
        : DEFAULT_UNITS.bagUnit,
  }
}

// ---------------------------------------------------------------------------
// saveRecipe
// ---------------------------------------------------------------------------

/**
 * Save a complete snapshot of calculator state as a Recipe.
 *
 * @param name     User-provided recipe name
 * @param units    Current unit preferences
 * @param decarb   Current Decarb tab state
 * @param infusion Current Infusion tab state
 * @param dose     Current Dose tab state
 * @returns Recipe object ready for JSON serialization
 */
export function saveRecipe(
  name: string,
  units: RecipeUnits,
  decarb: RecipeDecarb,
  infusion: RecipeInfusion,
  dose: RecipeDose
): Recipe {
  return {
    version: '1.0.0',
    name,
    createdAt: new Date().toISOString(),
    units: { ...units },
    decarb: { ...decarb },
    infusion: { ...infusion },
    dose: { ...dose },
  }
}

// ---------------------------------------------------------------------------
// loadRecipe
// ---------------------------------------------------------------------------

/**
 * Load a Recipe and return a plain object with all tab states restored.
 *
 * @param recipe Unknown value (e.g. parsed JSON) to validate and load
 * @returns Object containing units, decarb, infusion, dose
 * @throws ValidationError if recipe is not a valid object
 */
export function loadRecipe(recipe: unknown): {
  units: RecipeUnits
  decarb: RecipeDecarb
  infusion: RecipeInfusion
  dose: RecipeDose
} {
  if (!isRecord(recipe)) {
    throw new ValidationError('recipe must be an object')
  }

  const rawUnits = isRecord(recipe.units) ? recipe.units : {}
  const rawDecarb = isRecord(recipe.decarb) ? recipe.decarb : {}
  const rawInfusion = isRecord(recipe.infusion) ? recipe.infusion : {}
  const rawDose = isRecord(recipe.dose) ? recipe.dose : {}

  return {
    units: buildUnits(rawUnits),
    decarb: buildDecarb(rawDecarb),
    infusion: buildInfusion(rawInfusion),
    dose: buildDose(rawDose),
  }
}

// ---------------------------------------------------------------------------
// scaleRecipe
// ---------------------------------------------------------------------------

/**
 * Scale a recipe by a factor, recalculating all downstream values proportionally.
 *
 * Scaled fields:
 *   - decarb.weight  (material weight)
 *   - dose.servings  (number of servings)
 *   - infusion.volume (fat volume, to keep concentration constant)
 *
 * Recomputed fields (attached as `computed`):
 *   - theoreticalMax, decarbedRange, infusedThc, mgPerMl,
 *     mgPerServing, classification
 *
 * @param recipe Recipe to scale
 * @param factor Positive finite number (e.g. 2.0 = double, 0.5 = halve)
 * @returns New Recipe with scaled inputs and recomputed outputs
 * @throws ValidationError if factor is zero, negative, NaN, or infinite
 */
export function scaleRecipe(recipe: Recipe, factor: number): Recipe {
  if (!Number.isFinite(factor) || Number.isNaN(factor)) {
    throw new ValidationError('scale factor must be a finite number')
  }
  if (factor <= 0) {
    throw new ValidationError('scale factor must be greater than 0')
  }

  const scaledDecarb: RecipeDecarb = {
    ...recipe.decarb,
    weight: scaleString(recipe.decarb.weight, factor),
  }

  const scaledDose: RecipeDose = {
    ...recipe.dose,
    servings: scaleString(recipe.dose.servings, factor),
  }

  const scaledInfusion: RecipeInfusion = {
    ...recipe.infusion,
    volume: scaleString(recipe.infusion.volume, factor),
  }

  // -----------------------------------------------------------------------
  // Recompute downstream values using the engine
  // -----------------------------------------------------------------------

  const grams = parseFinite(scaledDecarb.weight)
  const thcaPct = parseFinite(scaledDecarb.thcaPct)
  const thcPct = parseFinite(scaledDecarb.thcPct)

  const method = DECARB_METHODS.find(m => m.id === scaledDecarb.presetId)

  // Resolve efficiency: use overrides if present, otherwise preset defaults
  const effLow = parseFinite(
    scaledDecarb.effLowOverride ?? String(method?.efficiency.low ?? 0.9)
  )
  const effExpected = parseFinite(
    scaledDecarb.effExpectedOverride ??
      String(method?.efficiency.expected ?? 0.95)
  )
  const effHigh = parseFinite(
    scaledDecarb.effHighOverride ?? String(method?.efficiency.high ?? 0.98)
  )

  // Decarb math
  const theoreticalMax =
    Number.isFinite(grams) &&
    Number.isFinite(thcaPct) &&
    Number.isFinite(thcPct)
      ? calculateTheoreticalMax(grams, thcaPct, thcPct)
      : 0

  const decarbedRange = Number.isFinite(theoreticalMax)
    ? calculateRange(theoreticalMax, effLow, effExpected, effHigh)
    : { low: 0, expected: 0, high: 0 }

  // Infusion math
  const fat = INFUSION_FATS.find(f => f.id === scaledInfusion.fatId)
  const extractionEff =
    scaledInfusion.fatId === 'custom'
      ? parseFinite(scaledInfusion.customEfficiency)
      : (fat?.extractionEff ?? 0.82)

  const infusedThc = calculateInfusedThc(decarbedRange.expected, extractionEff)

  const volumeMl = parseFinite(scaledInfusion.volume)
  const mgPerMl =
    Number.isFinite(volumeMl) && volumeMl > 0
      ? calculateMgPerMl(infusedThc, volumeMl)
      : 0

  // Dose math
  const servings = parseFinite(scaledDose.servings)
  const mgPerServing =
    Number.isFinite(servings) && servings > 0
      ? calculateMgPerServing(infusedThc, servings)
      : 0

  const classification = classifyDose(mgPerServing)

  const computed: ComputedRecipeOutput = {
    theoreticalMax,
    decarbedRange,
    infusedThc,
    mgPerMl,
    mgPerServing,
    classification,
  }

  // Sync upstream fields so downstream tabs show consistent values
  scaledInfusion.decarbedThc = String(decarbedRange.expected)
  scaledDose.totalThc = String(infusedThc)

  return {
    ...recipe,
    decarb: scaledDecarb,
    infusion: scaledInfusion,
    dose: scaledDose,
    computed,
  }
}
