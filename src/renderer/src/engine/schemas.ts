/**
 * Central Zod schemas for cannabis chemistry calculator inputs.
 *
 * These schemas describe the contract between the UI input fields
 * and the calculation engine. They validate the same conditions as
 * the existing per-tab validation functions, producing human-readable
 * errors and providing TypeScript type inference.
 *
 * Pure TypeScript / Zod — zero UI imports.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const asNumber = (val: unknown) => {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.trim())
  return NaN
}

const isValidNumber = (n: number) => !Number.isNaN(n)

const percentageMessage = (field: string) => ({
  invalid: () => `That does not look like a number`,
  negative: () => `${field} cannot be negative -- percentages start at zero`,
  over100: () =>
    `${field} cannot be above 100% -- that would be quite the plant`,
})

/* ------------------------------------------------------------------ */
/* Decarboxylation Input                                              */
/* ------------------------------------------------------------------ */

export const decarbInputSchema = z
  .object({
    weight: z
      .string()
      .trim()
      .min(1, 'Tell us how much material you are working with')
      .transform(asNumber)
      .refine(isValidNumber, 'That does not look like a number')
      .refine(v => v > 0, 'Weight needs to be a positive number'),

    thcaPct: z
      .string()
      .trim()
      .min(1, 'We need a THCA percentage')
      .transform(asNumber)
      .refine(isValidNumber, 'That does not look like a number')
      .refine(
        v => v >= 0,
        'THCA cannot be negative -- percentages start at zero'
      )
      .refine(
        v => v <= 100,
        'THCA cannot be above 100% -- that would be quite the plant'
      ),

    thcPct: z
      .string()
      .trim()
      .min(1, 'We need an existing THC percentage')
      .transform(asNumber)
      .refine(isValidNumber, 'That does not look like a number')
      .refine(
        v => v >= 0,
        'THC cannot be negative -- percentages start at zero'
      )
      .refine(
        v => v <= 100,
        'THC cannot be above 100% -- that would be quite the plant'
      ),

    cbdaPct: z
      .string()
      .trim()
      .min(1, 'We need a CBDA percentage')
      .transform(asNumber)
      .refine(isValidNumber, 'That does not look like a number')
      .refine(
        v => v >= 0,
        'CBDA cannot be negative -- percentages start at zero'
      )
      .refine(
        v => v <= 100,
        'CBDA cannot be above 100% -- that would be quite the plant'
      ),

    cbdPct: z
      .string()
      .trim()
      .min(1, 'We need an existing CBD percentage')
      .transform(asNumber)
      .refine(isValidNumber, 'That does not look like a number')
      .refine(
        v => v >= 0,
        'CBD cannot be negative -- percentages start at zero'
      )
      .refine(
        v => v <= 100,
        'CBD cannot be above 100% -- that would be quite the plant'
      ),

    /** Optional temperature override */
    tempOverride: z.string().nullish(),
    /** Optional time override */
    timeOverride: z.string().nullish(),
    /** Optional efficiency overrides */
    effLowOverride: z.string().nullish(),
    effExpectedOverride: z.string().nullish(),
    effHighOverride: z.string().nullish(),
  })
  .refine(
    data => {
      const t = data.thcaPct || 0
      const h = data.thcPct || 0
      return t + h <= 100
    },
    { message: "THCA plus THC can't go past 100%", path: ['thcaPct'] }
  )
  .refine(
    data => {
      const c = data.cbdaPct || 0
      const b = data.cbdPct || 0
      return c + b <= 100
    },
    { message: "CBDA plus CBD can't go past 100%", path: ['cbdaPct'] }
  )

export type DecarbInput = z.infer<typeof decarbInputSchema>

/** Warnings that don't block calculation but should be surfaced */
export function getDecarbWarnings(data: DecarbInput): string[] {
  const warnings: string[] = []
  const t = data.thcaPct || 0
  const h = data.thcPct || 0
  if (t + h > 40) {
    warnings.push(
      'High cannabinoid levels -- worth double-checking your lab report (>40%)'
    )
  }
  const c = data.cbdaPct || 0
  const b = data.cbdPct || 0
  if (c + b > 40) {
    warnings.push(
      'High CBD levels -- worth double-checking your lab report (>40%)'
    )
  }
  return warnings
}

/* ------------------------------------------------------------------ */
/* Infusion Input                                                     */
/* ------------------------------------------------------------------ */

export const infusionInputSchema = z.object({
  decarbedThc: z
    .string()
    .trim()
    .min(1, 'We need your decarbed THC amount')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0, 'THC cannot be negative'),

  volume: z
    .string()
    .trim()
    .min(1, 'Tell us how much fat you are using')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v > 0, 'Volume needs to be a positive number'),

  customEfficiency: z
    .string()
    .trim()
    .min(1, 'Custom fat needs an efficiency value')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(
      v => v >= 0 && v <= 1,
      'Efficiency needs to be between 0 and 1 (like 0.85 for 85%)'
    )
    .optional(),
})

export type InfusionInput = z.infer<typeof infusionInputSchema>

export function getInfusionWarnings(
  decarbedThc: number,
  volume: number
): string[] {
  const warnings: string[] = []
  if (decarbedThc > 0 && volume > 0 && volume < decarbedThc / 20) {
    warnings.push(
      'Not much fat volume here -- may not absorb all the cannabinoids.'
    )
  }
  return warnings
}

/* ------------------------------------------------------------------ */
/* Fat comparison (partial infusion without volume)                  */
/* ------------------------------------------------------------------ */

export const fatCompareInputSchema = z.object({
  decarbedThc: z
    .string()
    .trim()
    .min(1, 'We need your decarbed THC amount')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0, 'THC cannot be negative'),

  customEfficiency: z
    .string()
    .trim()
    .min(1, 'We need an efficiency value')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0 && v <= 1, 'Efficiency needs to be between 0 and 1'),
})

export type FatCompareInput = z.infer<typeof fatCompareInputSchema>

/* ------------------------------------------------------------------ */
/* Dose Input                                                         */
/* ------------------------------------------------------------------ */

export const doseInputSchema = z.object({
  totalThc: z
    .string()
    .trim()
    .min(1, 'How much total THC is in your infusion?')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0, 'THC amount cannot be negative'),

  servings: z
    .string()
    .trim()
    .min(1, 'How many servings are you planning?')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v > 0, 'Servings needs to be a positive number'),
})

export type DoseInput = z.infer<typeof doseInputSchema>

/* ------------------------------------------------------------------ */
/* Reverse Dose Input                                                 */
/* ------------------------------------------------------------------ */

export const reverseDoseInputSchema = z.object({
  desiredMgPerServing: z
    .string()
    .trim()
    .min(1, 'What dose do you want per serving?')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0, 'Dose cannot be negative')
    .refine(
      v => v <= 500,
      'That is an extraordinarily high dose. Double-check your units.'
    ),

  servings: z
    .string()
    .trim()
    .min(1, 'How many servings are you planning?')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v > 0, 'Servings needs to be a positive number'),
})

export type ReverseDoseInput = z.infer<typeof reverseDoseInputSchema>

/* ------------------------------------------------------------------ */
/* Cost Analysis Input                                                */
/* ------------------------------------------------------------------ */

export const costAnalysisInputSchema = z.object({
  materialCost: z
    .string()
    .trim()
    .min(1, 'We need a material cost')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0, 'Material cost cannot be negative'),

  weightG: z
    .string()
    .trim()
    .min(1, 'We need a weight in grams')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v > 0, 'Weight needs to be a positive number'),

  thcaPct: z
    .string()
    .trim()
    .min(1, 'We need a THCA percentage')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0 && v <= 100, 'THCA must be between 0 and 100%'),

  thcPct: z
    .string()
    .trim()
    .transform(asNumber)
    .refine(
      v => Number.isNaN(v) || (v >= 0 && v <= 100),
      'THC must be between 0 and 100%'
    )
    .optional(),

  extractionEff: z
    .string()
    .trim()
    .min(1, 'We need an extraction efficiency')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v >= 0 && v <= 1, 'Efficiency needs to be between 0 and 1'),

  targetDose: z
    .string()
    .trim()
    .min(1, 'We need a target dose per serving')
    .transform(asNumber)
    .refine(isValidNumber, 'That does not look like a number')
    .refine(v => v > 0, 'Target dose needs to be a positive number'),
})

export type CostAnalysisInput = z.infer<typeof costAnalysisInputSchema>

/* ------------------------------------------------------------------ */
/* Blending Input                                                     */
/* ------------------------------------------------------------------ */

export const blendInputSchema = z.object({
  strains: z
    .array(
      z.object({
        name: z.string().min(1, 'Strain name cannot be empty'),
        potency: z
          .number()
          .min(0, 'Potency cannot be negative')
          .max(100, 'Potency cannot exceed 100%'),
      })
    )
    .min(2, 'At least two strains are required for blending'),

  totalWeight: z
    .number()
    .positive('Total weight needs to be a positive number')
    .refine(v => !Number.isNaN(v), 'That does not look like a number'),

  targetPotency: z
    .number()
    .min(0, 'Target potency cannot be negative')
    .max(100, 'Target potency cannot exceed 100%')
    .refine(v => !Number.isNaN(v), 'That does not look like a number'),
})

export type BlendInput = z.infer<typeof blendInputSchema>

/* ------------------------------------------------------------------ */
/* Preset ID                                                          */
/* ------------------------------------------------------------------ */

/** Known decarb methods */
export const methodIdSchema = z.enum([
  'sv_dry',
  'sv_combined',
  'sv_fast',
  'sv_lowtemp',
  'oven_sealed',
  'oven_open',
])

/** Known fat types */
export const fatIdSchema = z.enum(['ghee', 'coconut', 'mct', 'custom'])

/** Known concentrate types */
export const concentrateIdSchema = z.enum([
  'wax',
  'shatter',
  'distillate',
  'hash',
  'kief',
  'rso',
])

/* ------------------------------------------------------------------ */
/* Bridge: Zod issues → field errors map                                */
/* ------------------------------------------------------------------ */

/**
 * Convert a Zod safeParse error into a flat field-errors object.
 * Each key gets the message from the first issue at that path.
 */
export function zodIssuesToFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]?.toString()
    if (key && !map[key]) {
      map[key] = issue.message
    }
  }
  return map
}

/** Known bag presets */
export const bagPresetIdSchema = z.enum([
  'quart',
  'gallon',
  '2gallon',
  'small_vac',
  'large_vac',
])
