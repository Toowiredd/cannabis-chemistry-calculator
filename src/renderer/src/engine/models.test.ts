/**
 * Data integrity tests for domain models and preset arrays.
 * Pure data assertions -- no calculation logic.
 */
import { describe, expect, it } from 'vitest'
import {
  DECARB_METHODS,
  INFUSION_FATS,
  type PresetMethod,
  type PresetFat,
  type EfficiencyRange,
} from './models'

describe('DECARB_METHODS preset array', () => {
  it('contains exactly 6 entries', () => {
    expect(DECARB_METHODS).toHaveLength(6)
  })

  it('contains the correct method ids in order', () => {
    const ids = DECARB_METHODS.map(m => m.id)
    expect(ids).toEqual([
      'sv_dry',
      'sv_combined',
      'sv_fast',
      'sv_lowtemp',
      'oven_sealed',
      'oven_open',
    ])
  })

  it.each(
    DECARB_METHODS.map((m, i) => ({ m, i }))
  )('entry $i ($m.id) has all required fields', ({
    m,
  }: {
    m: PresetMethod
  }) => {
    expect(typeof m.id).toBe('string')
    expect(m.id.length).toBeGreaterThan(0)
    expect(typeof m.name).toBe('string')
    expect(m.name.length).toBeGreaterThan(0)
    expect(typeof m.tempC).toBe('number')
    expect(typeof m.timeMin).toBe('number')
    expect(typeof m.timeMax).toBe('number')
    expect(typeof m.efficiency).toBe('object')
    expect(typeof m.terpeneLabel).toBe('string')
    expect(typeof m.cbnLabel).toBe('string')
    expect(typeof m.oxygenLabel).toBe('string')
  })

  it('temperatures are between 73C and 116C', () => {
    for (const m of DECARB_METHODS) {
      expect(m.tempC).toBeGreaterThanOrEqual(73)
      expect(m.tempC).toBeLessThanOrEqual(116)
    }
  })

  it('time values are positive', () => {
    for (const m of DECARB_METHODS) {
      expect(m.timeMin).toBeGreaterThan(0)
      expect(m.timeMax).toBeGreaterThan(0)
      expect(m.timeMax).toBeGreaterThanOrEqual(m.timeMin)
    }
  })

  it('efficiency values are within [0.0, 1.0] with low <= expected <= high', () => {
    for (const m of DECARB_METHODS) {
      const { low, expected, high } = m.efficiency
      expect(low).toBeGreaterThanOrEqual(0)
      expect(low).toBeLessThanOrEqual(1)
      expect(expected).toBeGreaterThanOrEqual(0)
      expect(expected).toBeLessThanOrEqual(1)
      expect(high).toBeGreaterThanOrEqual(0)
      expect(high).toBeLessThanOrEqual(1)
      expect(low).toBeLessThanOrEqual(expected)
      expect(expected).toBeLessThanOrEqual(high)
    }
  })

  it('qualitative labels contain no emojis or Unicode symbols', () => {
    // Emoji ranges per AGENTS.md: U+1F300-U+1F9FF, U+2600-U+26FF, U+2700-U+27BF
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    for (const m of DECARB_METHODS) {
      expect(m.terpeneLabel).not.toMatch(emojiRegex)
      expect(m.cbnLabel).not.toMatch(emojiRegex)
      expect(m.oxygenLabel).not.toMatch(emojiRegex)
      expect(m.name).not.toMatch(emojiRegex)
    }
  })
})

describe('INFUSION_FATS preset array', () => {
  it('contains exactly 4 entries', () => {
    expect(INFUSION_FATS).toHaveLength(4)
  })

  it('contains the correct fat ids in order', () => {
    const ids = INFUSION_FATS.map(f => f.id)
    expect(ids).toEqual(['ghee', 'coconut', 'mct', 'custom'])
  })

  it.each(
    INFUSION_FATS.map((f, i) => ({ f, i }))
  )('entry $i ($f.id) has all required fields', ({ f }: { f: PresetFat }) => {
    expect(typeof f.id).toBe('string')
    expect(f.id.length).toBeGreaterThan(0)
    expect(typeof f.name).toBe('string')
    expect(f.name.length).toBeGreaterThan(0)
    expect(typeof f.extractionEff).toBe('number')
    expect(typeof f.simplifiedMultiplier).toBe('number')
  })

  it('extractionEff values are within [0.0, 1.0] for presets (custom may be 0)', () => {
    for (const f of INFUSION_FATS) {
      expect(f.extractionEff).toBeGreaterThanOrEqual(0)
      expect(f.extractionEff).toBeLessThanOrEqual(1)
    }
  })

  it('qualitative labels contain no emojis or Unicode symbols', () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    for (const f of INFUSION_FATS) {
      expect(f.name).not.toMatch(emojiRegex)
    }
  })
})

describe('Preset cross-checks (contract-mandated values)', () => {
  it('sv_dry has 95C, 90-120min, 0.95-0.98 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'sv_dry')!
    expect(m.tempC).toBe(95)
    expect(m.timeMin).toBe(90)
    expect(m.timeMax).toBe(120)
    expect(m.efficiency.low).toBe(0.95)
    expect(m.efficiency.expected).toBe(0.97)
    expect(m.efficiency.high).toBe(0.98)
  })

  it('sv_combined has 85C, 240-360min, 0.85-0.92 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'sv_combined')!
    expect(m.tempC).toBe(85)
    expect(m.timeMin).toBe(240)
    expect(m.timeMax).toBe(360)
    expect(m.efficiency.low).toBe(0.85)
    expect(m.efficiency.expected).toBe(0.88)
    expect(m.efficiency.high).toBe(0.92)
  })

  it('sv_fast has 95C, 120-180min, 0.95-0.98 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'sv_fast')!
    expect(m.tempC).toBe(95)
    expect(m.timeMin).toBe(120)
    expect(m.timeMax).toBe(180)
    expect(m.efficiency.low).toBe(0.95)
    expect(m.efficiency.expected).toBe(0.97)
    expect(m.efficiency.high).toBe(0.98)
  })

  it('sv_lowtemp has 73C, 480-720min, 0.60-0.75 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'sv_lowtemp')!
    expect(m.tempC).toBe(73)
    expect(m.timeMin).toBe(480)
    expect(m.timeMax).toBe(720)
    expect(m.efficiency.low).toBe(0.6)
    expect(m.efficiency.expected).toBe(0.68)
    expect(m.efficiency.high).toBe(0.75)
  })

  it('oven_sealed has 113C, 60-90min, 0.90-0.95 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'oven_sealed')!
    expect(m.tempC).toBe(113)
    expect(m.timeMin).toBe(60)
    expect(m.timeMax).toBe(90)
    expect(m.efficiency.low).toBe(0.9)
    expect(m.efficiency.expected).toBe(0.93)
    expect(m.efficiency.high).toBe(0.95)
  })

  it('oven_open has 116C, 40min, 0.88-0.95 efficiency', () => {
    const m = DECARB_METHODS.find(x => x.id === 'oven_open')!
    expect(m.tempC).toBe(116)
    expect(m.timeMin).toBe(40)
    expect(m.timeMax).toBe(40)
    expect(m.efficiency.low).toBe(0.88)
    expect(m.efficiency.expected).toBe(0.92)
    expect(m.efficiency.high).toBe(0.95)
  })

  it('ghee has extractionEff 0.85, multiplier 8.5', () => {
    const f = INFUSION_FATS.find(x => x.id === 'ghee')!
    expect(f.extractionEff).toBe(0.85)
    expect(f.simplifiedMultiplier).toBe(8.5)
  })

  it('coconut has extractionEff 0.82, multiplier 8.2', () => {
    const f = INFUSION_FATS.find(x => x.id === 'coconut')!
    expect(f.extractionEff).toBe(0.82)
    expect(f.simplifiedMultiplier).toBe(8.2)
  })

  it('mct has extractionEff 0.92, multiplier 9.2', () => {
    const f = INFUSION_FATS.find(x => x.id === 'mct')!
    expect(f.extractionEff).toBe(0.92)
    expect(f.simplifiedMultiplier).toBe(9.2)
  })

  it('custom has extractionEff 0.0, multiplier 0.0', () => {
    const f = INFUSION_FATS.find(x => x.id === 'custom')!
    expect(f.extractionEff).toBe(0.0)
    expect(f.simplifiedMultiplier).toBe(0.0)
  })
})
