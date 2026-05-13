import { describe, it, expect } from 'vitest'
import {
  decarbInputSchema,
  infusionInputSchema,
  doseInputSchema,
  getDecarbWarnings,
  getInfusionWarnings,
  type DecarbInput,
} from '../schemas'

describe('schemas', () => {
  /* ------------------------------------------------------------------ */
  /* decarbInputSchema                                                    */
  /* ------------------------------------------------------------------ */

  describe('decarbInputSchema', () => {
    function expectValid(data: Record<string, unknown>) {
      const result = decarbInputSchema.safeParse(data)
      expect(result.success).toBe(true)
    }

    function expectInvalid(
      data: Record<string, unknown>,
      expectedField?: string
    ) {
      const result = decarbInputSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success && expectedField) {
        const fields = result.error.issues.map(i => i.path[0])
        expect(fields).toContain(expectedField)
      }
    }

    it('accepts valid string input', () => {
      expectValid({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        cbdaPct: '0',
        cbdPct: '0',
      })
    })

    it('rejects empty weight', () => {
      expectInvalid(
        {
          weight: '',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'weight'
      )
    })

    it('rejects non-numeric weight', () => {
      expectInvalid(
        {
          weight: 'abc',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'weight'
      )
    })

    it('rejects zero weight', () => {
      expectInvalid(
        {
          weight: '0',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'weight'
      )
    })

    it('rejects negative weight', () => {
      expectInvalid(
        {
          weight: '-5',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'weight'
      )
    })

    it('rejects THCA > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '110',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'thcaPct'
      )
    })

    it('rejects THC > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '10',
          thcPct: '105',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'thcPct'
      )
    })

    it('rejects THCA + THC > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '60',
          thcPct: '50',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'thcaPct'
      )
    })

    it('rejects negative THCA', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '-10',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'thcaPct'
      )
    })

    it('rejects negative THC', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '10',
          thcPct: '-5',
          cbdaPct: '0',
          cbdPct: '0',
        },
        'thcPct'
      )
    })

    it('warns when THCA + THC > 40%', () => {
      const result = decarbInputSchema.safeParse({
        weight: '10',
        thcaPct: '25',
        thcPct: '20',
        cbdaPct: '0',
        cbdPct: '0',
      })
      expect(result.success).toBe(true)
      const warnings = getDecarbWarnings(result.data as DecarbInput)
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some(w => w.includes('40'))).toBe(true)
    })

    it('does not warn when THCA + THC <= 40%', () => {
      const result = decarbInputSchema.safeParse({
        weight: '10',
        thcaPct: '20',
        thcPct: '10',
        cbdaPct: '0',
        cbdPct: '0',
      })
      expect(result.success).toBe(true)
      const warnings = getDecarbWarnings(result.data as DecarbInput)
      const hasWarning = warnings.some(w => w.includes('40'))
      expect(hasWarning).toBe(false)
    })

    it('accepts zero THCA and zero THC', () => {
      expectValid({
        weight: '10',
        thcaPct: '0',
        thcPct: '0',
        cbdaPct: '0',
        cbdPct: '0',
      })
    })

    it('rejects CBDA > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '110',
          cbdPct: '0',
        },
        'cbdaPct'
      )
    })

    it('rejects CBD > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '10',
          cbdPct: '105',
        },
        'cbdPct'
      )
    })

    it('rejects CBDA + CBD > 100%', () => {
      expectInvalid(
        {
          weight: '10',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '60',
          cbdPct: '50',
        },
        'cbdaPct'
      )
    })

    it('accepts optional overrides', () => {
      expectValid({
        weight: '10',
        thcaPct: '20',
        thcPct: '0',
        cbdaPct: '0',
        cbdPct: '0',
        tempOverride: '110',
        timeOverride: '90',
      })
    })
  })

  /* ------------------------------------------------------------------ */
  /* infusionInputSchema                                                  */
  /* ------------------------------------------------------------------ */

  describe('infusionInputSchema', () => {
    function expectValid(data: Record<string, unknown>) {
      const result = infusionInputSchema.safeParse(data)
      expect(result.success).toBe(true)
    }

    function expectInvalid(
      data: Record<string, unknown>,
      expectedField?: string
    ) {
      const result = infusionInputSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success && expectedField) {
        const fields = result.error.issues.map(i => i.path[0])
        expect(fields).toContain(expectedField)
      }
    }

    it('accepts valid input', () => {
      expectValid({
        decarbedThc: '500',
        volume: '100',
        customEfficiency: '0.82',
      })
    })

    it('rejects empty decarbedThc', () => {
      expectInvalid(
        {
          decarbedThc: '',
          volume: '100',
          customEfficiency: '0.82',
        },
        'decarbedThc'
      )
    })

    it('rejects empty volume', () => {
      expectInvalid(
        {
          decarbedThc: '500',
          volume: '',
          customEfficiency: '0.82',
        },
        'volume'
      )
    })

    it('rejects zero volume', () => {
      expectInvalid(
        {
          decarbedThc: '500',
          volume: '0',
          customEfficiency: '0.82',
        },
        'volume'
      )
    })

    it('rejects negative volume', () => {
      expectInvalid(
        {
          decarbedThc: '500',
          volume: '-50',
          customEfficiency: '0.82',
        },
        'volume'
      )
    })

    it('rejects negative decarbedThc', () => {
      expectInvalid(
        {
          decarbedThc: '-100',
          volume: '100',
          customEfficiency: '0.82',
        },
        'decarbedThc'
      )
    })

    it('rejects efficiency below 0', () => {
      expectInvalid(
        {
          decarbedThc: '500',
          volume: '100',
          customEfficiency: '-0.1',
        },
        'customEfficiency'
      )
    })

    it('rejects efficiency above 1', () => {
      expectInvalid(
        {
          decarbedThc: '500',
          volume: '100',
          customEfficiency: '1.5',
        },
        'customEfficiency'
      )
    })

    it('accepts efficiency exactly 0', () => {
      expectValid({
        decarbedThc: '500',
        volume: '100',
        customEfficiency: '0',
      })
    })

    it('accepts efficiency exactly 1', () => {
      expectValid({
        decarbedThc: '500',
        volume: '100',
        customEfficiency: '1.0',
      })
    })

    it('warns on low fat volume relative to material', () => {
      const result = infusionInputSchema.safeParse({
        decarbedThc: '1000',
        volume: '10',
        customEfficiency: '0.82',
      })
      expect(result.success).toBe(true)
      const warnings = getInfusionWarnings(
        (result.data as { decarbedThc: number }).decarbedThc,
        (result.data as { volume: number }).volume
      )
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some(w => w.toLowerCase().includes('volume'))).toBe(true)
    })

    it('does not warn on adequate fat volume', () => {
      const result = infusionInputSchema.safeParse({
        decarbedThc: '100',
        volume: '100',
        customEfficiency: '0.82',
      })
      expect(result.success).toBe(true)
      const warnings = getInfusionWarnings(
        (result.data as { decarbedThc: number }).decarbedThc,
        (result.data as { volume: number }).volume
      )
      const hasVolWarning = warnings.some(w =>
        w.toLowerCase().includes('volume')
      )
      expect(hasVolWarning).toBe(false)
    })
  })

  /* ------------------------------------------------------------------ */
  /* doseInputSchema                                                      */
  /* ------------------------------------------------------------------ */

  describe('doseInputSchema', () => {
    function expectValid(data: Record<string, unknown>) {
      const result = doseInputSchema.safeParse(data)
      expect(result.success).toBe(true)
    }

    function expectInvalid(
      data: Record<string, unknown>,
      expectedField?: string
    ) {
      const result = doseInputSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success && expectedField) {
        const fields = result.error.issues.map(i => i.path[0])
        expect(fields).toContain(expectedField)
      }
    }

    it('accepts valid input', () => {
      expectValid({ totalThc: '50', servings: '10' })
    })

    it('rejects zero servings', () => {
      expectInvalid({ totalThc: '50', servings: '0' }, 'servings')
    })

    it('rejects negative servings', () => {
      expectInvalid({ totalThc: '50', servings: '-1' }, 'servings')
    })

    it('rejects negative totalThc', () => {
      expectInvalid({ totalThc: '-10', servings: '2' }, 'totalThc')
    })

    it('accepts fractional servings', () => {
      expectValid({ totalThc: '50', servings: '2.5' })
    })
  })
})
