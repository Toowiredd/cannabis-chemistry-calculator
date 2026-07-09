import { z } from 'zod'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: string[]
  warnings?: string[]
}

/* ------------------------------------------------------------------ */
/* Base schemas (shared primitives)                                    */
/* ------------------------------------------------------------------ */

export const positiveNumberSchema = z
  .number()
  .gt(0, 'Value must be greater than 0')

export const nonNegativeNumberSchema = z
  .number()
  .gte(0, 'Value cannot be negative')

export const percentageSchema = z
  .number()
  .gte(0, 'Percentage cannot be negative')
  .lte(100, 'Percentage cannot exceed 100%')

export const efficiencySchema = z
  .number()
  .gte(0, 'Efficiency must be at least 0')
  .lte(1, 'Efficiency must be at most 1')

/* ------------------------------------------------------------------ */
/* Decarb input                                                        */
/* ------------------------------------------------------------------ */

export const decarbInputSchema = z
  .object({
    weight: positiveNumberSchema,
    thcaPct: percentageSchema,
    thcPct: percentageSchema,
  })
  .refine(data => data.thcaPct + data.thcPct <= 100, {
    message: 'THCA + THC cannot exceed 100%',
    path: ['thcaPct'],
  })

export type DecarbInput = z.infer<typeof decarbInputSchema>

/* ------------------------------------------------------------------ */
/* CBDA/CBD input                                                      */
/* ------------------------------------------------------------------ */

export const cbdaInputSchema = z
  .object({
    weight: positiveNumberSchema,
    cbdaPct: percentageSchema,
    cbdPct: percentageSchema,
  })
  .refine(data => data.cbdaPct + data.cbdPct <= 100, {
    message: 'CBDA + CBD cannot exceed 100%',
    path: ['cbdaPct'],
  })

export type CbdaInput = z.infer<typeof cbdaInputSchema>

/* ------------------------------------------------------------------ */
/* Infusion input                                                      */
/* ------------------------------------------------------------------ */

export const infusionInputSchema = z.object({
  decarbedThcMg: nonNegativeNumberSchema,
  volumeMl: positiveNumberSchema,
  extractionEff: efficiencySchema,
})

export type InfusionInput = z.infer<typeof infusionInputSchema>

/* ------------------------------------------------------------------ */
/* Dose input                                                          */
/* ------------------------------------------------------------------ */

export const doseInputSchema = z.object({
  finalThcMg: nonNegativeNumberSchema,
  servings: positiveNumberSchema,
})

export type DoseInput = z.infer<typeof doseInputSchema>

/* ------------------------------------------------------------------ */
/* Warnings                                                            */
/* ------------------------------------------------------------------ */

function getDecarbWarnings(input: DecarbInput): string[] {
  const warnings: string[] = []
  // TODO(citation): 40% warning threshold is an internal advisory level; it is
  // a display warning only and does not affect calculation. No peer-reviewed
  // "high-cannabinoid" cutoff at 40% cited. See research/academic-references.md
  // audit row #38.
  if (input.thcaPct + input.thcPct > 40) {
    warnings.push(
      'Note: High total cannabinoid percentage (>40%). Verify lab results.'
    )
  }
  return warnings
}

function getCbdaWarnings(input: CbdaInput): string[] {
  const warnings: string[] = []
  // TODO(citation): 40% warning threshold duplicated from getDecarbWarnings
  // above — internal advisory display threshold only. See
  // research/academic-references.md audit row #38.
  if (input.cbdaPct + input.cbdPct > 40) {
    warnings.push(
      'Note: High total cannabinoid percentage (>40%). Verify lab results.'
    )
  }
  return warnings
}

function getInfusionWarnings(input: InfusionInput): string[] {
  const warnings: string[] = []
  // TODO(citation): threshold "volume < decarbedThc / 20" (i.e. 25 mL per
  // 500 mg decarbed THC) is an internal rule-of-thumb. Display warning only;
  // no peer-reviewed source anchors the specific divisor of 20. See
  // research/academic-references.md audit row #39.
  if (
    input.decarbedThcMg > 0 &&
    input.volumeMl > 0 &&
    input.volumeMl < input.decarbedThcMg / 20
  ) {
    warnings.push('Warning: Low fat volume may not fully absorb cannabinoids.')
  }
  return warnings
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function validateCbdaInput(
  input: CbdaInput
): ValidationResult<CbdaInput> {
  const parsed = cbdaInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map(e => e.message),
    }
  }

  const data = parsed.data
  const warnings = getCbdaWarnings(data)
  return {
    success: true,
    data,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

export function validateDecarbInput(
  input: DecarbInput
): ValidationResult<DecarbInput> {
  const parsed = decarbInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map(e => e.message),
    }
  }

  const data = parsed.data
  const warnings = getDecarbWarnings(data)
  return {
    success: true,
    data,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

export function validateInfusionInput(
  input: InfusionInput
): ValidationResult<InfusionInput> {
  const parsed = infusionInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map(e => e.message),
    }
  }

  const data = parsed.data
  const warnings = getInfusionWarnings(data)
  return {
    success: true,
    data,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

export function validateDoseInput(
  input: DoseInput
): ValidationResult<DoseInput> {
  const parsed = doseInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map(e => e.message),
    }
  }

  return { success: true, data: parsed.data }
}
