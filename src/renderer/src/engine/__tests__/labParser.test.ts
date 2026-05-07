import { describe, it, expect } from 'vitest'
import {
  parseLabText,
  parseLabTextStrict,
  looksLikeLabData,
} from '../labParser'
import { ValidationError } from '../errors'

describe('labParser', () => {
  describe('parseLabText', () => {
    it('parses standard format "THCA: 22.4%"', () => {
      const result = parseLabText('THCA: 22.4%')
      expect(result.thcaPct).toBe(22.4)
      expect(result.thcPct).toBeNull()
    })

    it('parses "THC: 0.8%"', () => {
      const result = parseLabText('THC: 0.8%')
      expect(result.thcPct).toBe(0.8)
      expect(result.thcaPct).toBeNull()
    })

    it('parses mixed format "CBDA = 15.2"', () => {
      const result = parseLabText('CBDA = 15.2')
      expect(result.cbdaPct).toBe(15.2)
    })

    it('parses "CBD: 0.5%"', () => {
      const result = parseLabText('CBD: 0.5%')
      expect(result.cbdPct).toBe(0.5)
    })

    it('parses full lab report text', () => {
      const text = `
        Cannabinoid Analysis
        THCA: 22.4%
        THC:  0.8%
        CBDA: 0.1%
        CBD:  0.0%
        Total Cannabinoids: 23.2%
      `
      const result = parseLabText(text)
      expect(result.thcaPct).toBe(22.4)
      expect(result.thcPct).toBe(0.8)
      expect(result.cbdaPct).toBe(0.1)
      expect(result.cbdPct).toBe(0.0)
    })

    it('parses delta-9-THC format', () => {
      const result = parseLabText('Delta-9-THC: 1.2%')
      expect(result.thcPct).toBe(1.2)
    })

    it('parses case-insensitive labels', () => {
      const result = parseLabText('thca 18.5%, thc 0.5%')
      expect(result.thcaPct).toBe(18.5)
      expect(result.thcPct).toBe(0.5)
    })

    it('returns nulls for malformed text', () => {
      const result = parseLabText('This is just random text about gardening')
      expect(result.thcaPct).toBeNull()
      expect(result.thcPct).toBeNull()
      expect(result.cbdaPct).toBeNull()
      expect(result.cbdPct).toBeNull()
    })

    it('returns nulls for empty string', () => {
      const result = parseLabText('')
      expect(result.thcaPct).toBeNull()
      expect(result.thcPct).toBeNull()
    })

    it('returns nulls for whitespace-only', () => {
      const result = parseLabText('   \n\t   ')
      expect(result.thcaPct).toBeNull()
      expect(result.thcPct).toBeNull()
    })

    it('handles mg/g values (>100) by converting', () => {
      // 224 mg/g = 22.4%
      const result = parseLabText('THCA 224 mg/g')
      expect(result.thcaPct).toBe(22.4)
    })

    it('uses first match when multiple values present', () => {
      const result = parseLabText('THCA: 20% and also THCA: 25%')
      expect(result.thcaPct).toBe(20)
    })

    it('handles values without % symbol', () => {
      const result = parseLabText('THCA 22.4')
      expect(result.thcaPct).toBe(22.4)
    })

    it('handles "Total THCA" format', () => {
      const result = parseLabText('Total THCA: 19.8%')
      expect(result.thcaPct).toBe(19.8)
    })

    it('handles tab-separated lab data', () => {
      const text = 'THCA\t22.4%\nTHC\t0.8%\nCBDA\t0.1%\nCBD\t0.0%'
      const result = parseLabText(text)
      expect(result.thcaPct).toBe(22.4)
      expect(result.thcPct).toBe(0.8)
      expect(result.cbdaPct).toBe(0.1)
      expect(result.cbdPct).toBe(0.0)
    })
  })

  describe('parseLabTextStrict', () => {
    it('returns result when values found', () => {
      const result = parseLabTextStrict('THCA: 22.4%')
      expect(result.thcaPct).toBe(22.4)
    })

    it('throws ValidationError for no cannabinoid data', () => {
      expect(() => parseLabTextStrict('Hello world')).toThrow(ValidationError)
      expect(() => parseLabTextStrict('Hello world')).toThrow(
        'No cannabinoid values detected'
      )
    })

    it('throws ValidationError for empty string', () => {
      expect(() => parseLabTextStrict('')).toThrow(ValidationError)
    })
  })

  describe('looksLikeLabData', () => {
    it('returns true when THCA found', () => {
      expect(looksLikeLabData('THCA: 20%')).toBe(true)
    })

    it('returns true when CBD found', () => {
      expect(looksLikeLabData('CBD 0.5')).toBe(true)
    })

    it('returns false for random text', () => {
      expect(looksLikeLabData('The quick brown fox')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(looksLikeLabData('')).toBe(false)
    })
  })
})
