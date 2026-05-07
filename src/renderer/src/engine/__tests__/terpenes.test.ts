/**
 * Data integrity tests for terpene boiling points.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/terpenes.test.ts
 */
import { describe, expect, it } from 'vitest'
import { TERPENES, type TerpeneData } from '../terpenes'

describe('TERPENES data array', () => {
  it('contains exactly 5 entries', () => {
    expect(TERPENES).toHaveLength(5)
  })

  it.each(
    TERPENES.map((t, i) => ({ t, i }))
  )('entry $i ($t.name) has all required fields', ({
    t,
  }: {
    t: TerpeneData
  }) => {
    expect(typeof t.name).toBe('string')
    expect(t.name.length).toBeGreaterThan(0)
    expect(typeof t.boilingPointC).toBe('number')
    expect(typeof t.citation).toBe('string')
    expect(t.citation.length).toBeGreaterThan(0)
  })

  it('contains myrcene with boiling point 168°C (VAL-TERP-001)', () => {
    const t = TERPENES.find(x => x.name === 'Myrcene')
    expect(t).toBeDefined()
    expect(t?.boilingPointC).toBe(168)
  })

  it('contains limonene with boiling point 176°C (VAL-TERP-001)', () => {
    const t = TERPENES.find(x => x.name === 'Limonene')
    expect(t).toBeDefined()
    expect(t?.boilingPointC).toBe(176)
  })

  it('contains alpha-pinene with boiling point 156°C (VAL-TERP-001)', () => {
    const t = TERPENES.find(x => x.name === 'alpha-Pinene')
    expect(t).toBeDefined()
    expect(t?.boilingPointC).toBe(156)
  })

  it('contains linalool with boiling point 198°C (VAL-TERP-001)', () => {
    const t = TERPENES.find(x => x.name === 'Linalool')
    expect(t).toBeDefined()
    expect(t?.boilingPointC).toBe(198)
  })

  it('contains beta-caryophyllene with boiling point 262°C (VAL-TERP-001)', () => {
    const t = TERPENES.find(x => x.name === 'beta-Caryophyllene')
    expect(t).toBeDefined()
    expect(t?.boilingPointC).toBe(262)
  })

  it('every entry cites Eyal et al. (2023) (VAL-TERP-001)', () => {
    for (const t of TERPENES) {
      expect(t.citation).toMatch(/Eyal et al\. \(2023\)/i)
    }
  })

  it('qualitative labels contain no emojis or Unicode symbols', () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    for (const t of TERPENES) {
      expect(t.name).not.toMatch(emojiRegex)
    }
  })
})
