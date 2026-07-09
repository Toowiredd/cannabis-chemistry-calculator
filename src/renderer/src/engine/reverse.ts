/**
 * Reverse / inverse calculator engine for the Cannabis Chemistry Calculator.
 * Given desired outputs, solves backward for required material weight.
 * Pure TypeScript math — zero UI imports.
 */
import { ValidationError } from './errors'

/** Molecular weight ratio: THC / THCA ≈ 0.877 — Filer 2022 (#1, see research/academic-references.md). */
const THCA_TO_THC_FACTOR = 0.877

/** Round to 2 decimal places with epsilon compensation for floating-point error */
function round2(value: number): number {
  if (value === 0) return 0
  return Math.round((value + 1e-9) * 100) / 100
}

export interface ReverseDecarbInput {
  /** Desired decarboxylated THC in mg */
  desiredDecarbedThcMg: number
  /** THCA percentage of material [0, 100] */
  thcaPct: number
  /** Already-decarboxylated THC percentage of material [0, 100] */
  thcPct: number
  /** Decarboxylation efficiency [0.0, 1.0] */
  decarbEfficiency: number
}

export interface ReverseFullWorkflowInput {
  /** Desired mg of THC per serving */
  desiredMgPerServing: number
  /** Number of servings */
  servings: number
  /** THCA percentage of material [0, 100] */
  thcaPct: number
  /** Already-decarboxylated THC percentage of material [0, 100] */
  thcPct: number
  /** Decarboxylation efficiency [0.0, 1.0] */
  decarbEfficiency: number
  /** Fat extraction efficiency [0.0, 1.0] */
  extractionEfficiency: number
}

/**
 * Reverse decarboxylation: given desired decarbed THC output,
 * solve backward for required material weight in grams.
 *
 * Forward: theoretical = grams * ((thcaPct/100)*0.877 + thcPct/100) * 1000
 *          decarbed   = theoretical * decarbEfficiency
 *
 * Reverse: theoretical = desiredDecarbedThcMg / decarbEfficiency
 *          grams      = theoretical / (((thcaPct/100)*0.877 + thcPct/100) * 1000)
 *
 * @returns Required material weight in grams, rounded to 2 decimals
 */
export function reverseDecarb(input: ReverseDecarbInput): number {
  const { desiredDecarbedThcMg, thcaPct, thcPct, decarbEfficiency } = input

  if (desiredDecarbedThcMg < 0) {
    throw new ValidationError('desiredDecarbedThcMg cannot be negative')
  }
  if (desiredDecarbedThcMg === 0) return 0

  if (thcaPct < 0) throw new ValidationError('thcaPct cannot be negative')
  if (thcPct < 0) throw new ValidationError('thcPct cannot be negative')
  if (thcaPct > 100) throw new ValidationError('thcaPct cannot exceed 100%')
  if (thcaPct + thcPct > 100) {
    throw new ValidationError('thcaPct + thcPct cannot exceed 100%')
  }

  if (decarbEfficiency < 0) {
    throw new ValidationError('decarbEfficiency cannot be negative')
  }
  if (decarbEfficiency > 1) {
    throw new ValidationError('decarbEfficiency cannot exceed 1.0')
  }
  if (decarbEfficiency === 0) {
    throw new ValidationError(
      'decarbEfficiency must be greater than 0 when desired output is positive'
    )
  }

  const theoreticalMax = desiredDecarbedThcMg / decarbEfficiency
  const potencyFactor =
    ((thcaPct / 100) * THCA_TO_THC_FACTOR + thcPct / 100) * 1000

  if (potencyFactor === 0) {
    throw new ValidationError('total potency must be greater than 0')
  }

  return round2(theoreticalMax / potencyFactor)
}

/**
 * Reverse full workflow: given desired mg per serving and number of servings,
 * solve backward through infusion and decarb steps for required material weight.
 *
 * Forward: finalThc     = mgPerServing * servings
 *          decarbed     = finalThc / extractionEfficiency
 *          theoretical  = decarbed / decarbEfficiency
 *          grams        = theoretical / potencyFactor
 *
 * @returns Required material weight in grams, rounded to 2 decimals
 */
export function reverseFullWorkflow(input: ReverseFullWorkflowInput): number {
  const {
    desiredMgPerServing,
    servings,
    thcaPct,
    thcPct,
    decarbEfficiency,
    extractionEfficiency,
  } = input

  if (desiredMgPerServing < 0) {
    throw new ValidationError('desiredMgPerServing cannot be negative')
  }
  if (servings < 0) throw new ValidationError('servings cannot be negative')

  if (desiredMgPerServing === 0 || servings === 0) return 0

  if (thcaPct < 0) throw new ValidationError('thcaPct cannot be negative')
  if (thcPct < 0) throw new ValidationError('thcPct cannot be negative')
  if (thcaPct > 100) throw new ValidationError('thcaPct cannot exceed 100%')
  if (thcaPct + thcPct > 100) {
    throw new ValidationError('thcaPct + thcPct cannot exceed 100%')
  }

  if (decarbEfficiency < 0) {
    throw new ValidationError('decarbEfficiency cannot be negative')
  }
  if (decarbEfficiency > 1) {
    throw new ValidationError('decarbEfficiency cannot exceed 1.0')
  }
  if (decarbEfficiency === 0) {
    throw new ValidationError(
      'decarbEfficiency must be greater than 0 when desired output is positive'
    )
  }

  if (extractionEfficiency < 0) {
    throw new ValidationError('extractionEfficiency cannot be negative')
  }
  if (extractionEfficiency > 1) {
    throw new ValidationError('extractionEfficiency cannot exceed 1.0')
  }
  if (extractionEfficiency === 0) {
    throw new ValidationError(
      'extractionEfficiency must be greater than 0 when desired output is positive'
    )
  }

  const finalThcMg = desiredMgPerServing * servings
  const decarbedThcMg = finalThcMg / extractionEfficiency
  const theoreticalMax = decarbedThcMg / decarbEfficiency
  const potencyFactor =
    ((thcaPct / 100) * THCA_TO_THC_FACTOR + thcPct / 100) * 1000

  if (potencyFactor === 0) {
    throw new ValidationError('total potency must be greater than 0')
  }

  return round2(theoreticalMax / potencyFactor)
}
