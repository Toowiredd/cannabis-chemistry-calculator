import { describe, it, expect } from 'vitest'
import {
  validateDecarbInput,
  validateInfusionInput,
  validateDoseInput,
  type DecarbInput,
  type InfusionInput,
  type DoseInput,
  type ValidationResult,
} from '../validation'

function expectValid<T>(result: ValidationResult<T>) {
  expect(result.success).toBe(true)
  expect(result.errors).toBeUndefined()
}

function expectInvalid<T>(result: ValidationResult<T>) {
  expect(result.success).toBe(false)
  expect(result.errors).toBeDefined()
  expect(result.errors?.length).toBeGreaterThan(0)
}

describe('validation', () => {
  describe('DecarbInput', () => {
    it('accepts valid decarb input', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 20, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectValid(result)
    })

    it('rejects negative weight', () => {
      const input: DecarbInput = { weight: -5, thcaPct: 20, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects zero weight', () => {
      const input: DecarbInput = { weight: 0, thcaPct: 20, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects THCA > 100%', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 110, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects THC > 100%', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 10, thcPct: 105 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects THCA + THC > 100%', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 60, thcPct: 50 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects negative THCA', () => {
      const input: DecarbInput = { weight: 10, thcaPct: -10, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('rejects negative THC', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 10, thcPct: -5 }
      const result = validateDecarbInput(input)
      expectInvalid(result)
    })

    it('warns when THCA + THC > 40%', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 25, thcPct: 20 }
      const result = validateDecarbInput(input)
      expectValid(result)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.length).toBeGreaterThan(0)
      expect(result.warnings?.some(w => w.includes('40'))).toBe(true)
    })

    it('does not warn when THCA + THC <= 40%', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 20, thcPct: 10 }
      const result = validateDecarbInput(input)
      expectValid(result)
      const hasWarning = (result.warnings ?? []).some(w => w.includes('40'))
      expect(hasWarning).toBe(false)
    })

    it('accepts zero THCA and zero THC', () => {
      const input: DecarbInput = { weight: 10, thcaPct: 0, thcPct: 0 }
      const result = validateDecarbInput(input)
      expectValid(result)
    })
  })

  describe('InfusionInput', () => {
    it('accepts valid infusion input', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 100,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectValid(result)
    })

    it('rejects zero volume', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 0,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectInvalid(result)
    })

    it('rejects negative volume', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: -50,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectInvalid(result)
    })

    it('rejects negative decarbed THC', () => {
      const input: InfusionInput = {
        decarbedThcMg: -100,
        volumeMl: 100,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectInvalid(result)
    })

    it('rejects efficiency below 0', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 100,
        extractionEff: -0.1,
      }
      const result = validateInfusionInput(input)
      expectInvalid(result)
    })

    it('rejects efficiency above 1', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 100,
        extractionEff: 1.5,
      }
      const result = validateInfusionInput(input)
      expectInvalid(result)
    })

    it('accepts efficiency exactly 0', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 100,
        extractionEff: 0,
      }
      const result = validateInfusionInput(input)
      expectValid(result)
    })

    it('accepts efficiency exactly 1', () => {
      const input: InfusionInput = {
        decarbedThcMg: 500,
        volumeMl: 100,
        extractionEff: 1.0,
      }
      const result = validateInfusionInput(input)
      expectValid(result)
    })

    it('warns on low fat volume relative to material', () => {
      const input: InfusionInput = {
        decarbedThcMg: 1000,
        volumeMl: 10,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectValid(result)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.length).toBeGreaterThan(0)
      expect(
        result.warnings?.some(w => w.toLowerCase().includes('volume'))
      ).toBe(true)
    })

    it('does not warn on adequate fat volume', () => {
      const input: InfusionInput = {
        decarbedThcMg: 100,
        volumeMl: 100,
        extractionEff: 0.82,
      }
      const result = validateInfusionInput(input)
      expectValid(result)
      const hasVolWarning = (result.warnings ?? []).some(w =>
        w.toLowerCase().includes('volume')
      )
      expect(hasVolWarning).toBe(false)
    })
  })

  describe('DoseInput', () => {
    it('accepts valid dose input', () => {
      const input: DoseInput = { finalThcMg: 50, servings: 10 }
      const result = validateDoseInput(input)
      expectValid(result)
    })

    it('rejects zero servings', () => {
      const input: DoseInput = { finalThcMg: 50, servings: 0 }
      const result = validateDoseInput(input)
      expectInvalid(result)
    })

    it('rejects negative servings', () => {
      const input: DoseInput = { finalThcMg: 50, servings: -1 }
      const result = validateDoseInput(input)
      expectInvalid(result)
    })

    it('rejects negative final THC', () => {
      const input: DoseInput = { finalThcMg: -10, servings: 2 }
      const result = validateDoseInput(input)
      expectInvalid(result)
    })

    it('accepts fractional servings', () => {
      const input: DoseInput = { finalThcMg: 50, servings: 2.5 }
      const result = validateDoseInput(input)
      expectValid(result)
    })
  })
})
