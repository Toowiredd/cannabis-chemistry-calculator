/**
 * Cost-per-dose engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 */
import { ValidationError } from './errors'

/** Round to at most 2 decimal places with epsilon compensation for floating-point error */
function round2(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 100) / 100
}

/** Round to at most 3 decimal places with epsilon compensation */
function round3(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 1000) / 1000
}

/** Round to at most 1 decimal place */
function round1(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 10) / 10
}

/** Molecular weight ratio: THC / THCA ≈ 0.877 — Filer 2022 (#1, see research/academic-references.md). */
const THCA_TO_THC_FACTOR = 0.877

/**
 * Calculate cost per dose in currency units.
 *
 * Formula: materialCost / servings
 *
 * @param materialCost Total material cost (must be >= 0)
 * @param servings     Number of servings produced (must be > 0)
 * @returns Cost per dose, rounded to 2 decimal places
 */
export function calculateCostPerDose(
  materialCost: number,
  servings: number
): number {
  if (materialCost < 0) {
    throw new ValidationError('materialCost cannot be negative')
  }
  if (servings <= 0) {
    throw new ValidationError('servings must be greater than 0')
  }

  const result = materialCost / servings
  return round2(result)
}

/**
 * Calculate cost per mg of THC in currency units.
 *
 * Formula: materialCost / totalThcMg
 *
 * @param materialCost Total material cost (must be >= 0)
 * @param totalThcMg   Total THC yield in mg (must be > 0)
 * @returns Cost per mg, rounded to 3 decimal places
 */
export function calculateCostPerMg(
  materialCost: number,
  totalThcMg: number
): number {
  if (materialCost < 0) {
    throw new ValidationError('materialCost cannot be negative')
  }
  if (totalThcMg <= 0) {
    throw new ValidationError('totalThcMg must be greater than 0')
  }

  const result = materialCost / totalThcMg
  return round3(result)
}

/** Method description for cost comparison */
export interface ComparisonMethod {
  id: string
  name: string
  efficiency: number
}

/** Single result row from compareMethodCosts */
export interface CostComparisonResult {
  /** Method identifier */
  methodId: string
  /** Method name */
  methodName: string
  /** Decarb efficiency used */
  decarbEfficiency: number
  /** Total infused THC in mg */
  totalThcMg: number
  /** Number of servings at target dose */
  servings: number
  /** Cost per serving */
  costPerDose: number
  /** Cost per mg of THC */
  costPerMg: number
  /** True when infusedThc is zero, guarding against division-by-zero */
  zeroYield: boolean
}

/**
 * Compare costs across multiple decarboxylation methods.
 *
 * For each method, computes the full workflow:
 *   theoreticalMax = grams * ((thcaPct / 100) * 0.877 + (thcPct / 100)) * 1000
 *   decarbedThc    = theoreticalMax * method.efficiency
 *   infusedThc     = decarbedThc * extractionEff
 *   servings       = infusedThc / targetDose
 *   costPerDose    = materialCost / servings
 *   costPerMg      = materialCost / infusedThc
 *
 * @param materialCost  Total material cost (must be >= 0)
 * @param grams         Material weight in grams (must be >= 0)
 * @param thcaPct       THCA percentage [0, 100]
 * @param thcPct        Already-decarboxylated THC percentage [0, 100]
 * @param methods       Array of methods to compare
 * @param extractionEff Fat extraction efficiency [0.0, 1.0]
 * @param targetDose    Target mg per serving (must be > 0)
 * @returns Array of CostComparisonResult, one per method
 */
export function compareMethodCosts(
  materialCost: number,
  grams: number,
  thcaPct: number,
  thcPct: number,
  methods: ComparisonMethod[],
  extractionEff: number,
  targetDose: number
): CostComparisonResult[] {
  if (materialCost < 0) {
    throw new ValidationError('materialCost cannot be negative')
  }
  if (grams < 0) {
    throw new ValidationError('grams cannot be negative')
  }
  if (thcaPct < 0 || thcaPct > 100) {
    throw new ValidationError('thcaPct must be in [0, 100]')
  }
  if (thcPct < 0 || thcPct > 100) {
    throw new ValidationError('thcPct must be in [0, 100]')
  }
  if (thcaPct + thcPct > 100) {
    throw new ValidationError('thcaPct + thcPct cannot exceed 100%')
  }
  if (extractionEff < 0 || extractionEff > 1) {
    throw new ValidationError('extractionEff must be in [0.0, 1.0]')
  }
  if (targetDose <= 0) {
    throw new ValidationError('targetDose must be greater than 0')
  }

  for (const method of methods) {
    if (method.efficiency < 0 || method.efficiency > 1) {
      throw new ValidationError('method efficiency must be in [0.0, 1.0]')
    }
  }

  const theoreticalMax =
    grams * ((thcaPct / 100) * THCA_TO_THC_FACTOR + thcPct / 100) * 1000

  return methods.map(method => {
    const decarbedThc = theoreticalMax * method.efficiency
    const infusedThc = decarbedThc * extractionEff
    const zeroYield = infusedThc === 0

    if (zeroYield) {
      return {
        methodId: method.id,
        methodName: method.name,
        decarbEfficiency: method.efficiency,
        totalThcMg: 0,
        servings: 0,
        costPerDose: 0,
        costPerMg: 0,
        zeroYield: true,
      }
    }

    const servings = infusedThc / targetDose

    return {
      methodId: method.id,
      methodName: method.name,
      decarbEfficiency: method.efficiency,
      totalThcMg: round1(infusedThc),
      servings: round1(servings),
      costPerDose: round2(materialCost / servings),
      costPerMg: round3(materialCost / infusedThc),
      zeroYield: false,
    }
  })
}
