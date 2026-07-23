import { describe, it, expect } from 'vitest'
import {
  countSigFigs,
  roundToSigFigs,
  formatWithSigFigs,
  minSigFigs,
  round1n,
  fmt1,
} from '../formatting'

describe('countSigFigs', () => {
  it('counts non-zero digits', () => {
    expect(countSigFigs('20')).toBe(2)
    expect(countSigFigs('123')).toBe(3)
  })

  it('counts trailing zeros after decimal', () => {
    expect(countSigFigs('20.0')).toBe(3)
    expect(countSigFigs('1.00')).toBe(3)
  })

  it('ignores leading zeros', () => {
    expect(countSigFigs('0.05')).toBe(1)
    expect(countSigFigs('00.20')).toBe(2)
  })

  it('treats integer digits as significant', () => {
    expect(countSigFigs('100')).toBe(3)
  })

  it('returns Infinity for empty/invalid strings', () => {
    expect(countSigFigs('')).toBe(Infinity)
    expect(countSigFigs('abc')).toBe(Infinity)
  })
})

describe('roundToSigFigs', () => {
  it('rounds to 2 significant figures', () => {
    expect(roundToSigFigs(1754, 2)).toBe(1800)
    expect(roundToSigFigs(613.9, 2)).toBe(610)
  })

  it('rounds to 3 significant figures', () => {
    expect(roundToSigFigs(613.9, 3)).toBe(614)
    expect(roundToSigFigs(1754, 3)).toBe(1750)
  })

  it('handles zero', () => {
    expect(roundToSigFigs(0, 2)).toBe(0)
  })
})

describe('formatWithSigFigs', () => {
  it('formats with matching precision', () => {
    expect(formatWithSigFigs(613.9, 2)).toBe('610')
    expect(formatWithSigFigs(613.9, 3)).toBe('614')
    expect(formatWithSigFigs(1754, 2)).toBe('1800')
  })

  it('caps decimals at 1', () => {
    expect(formatWithSigFigs(12.34, 3)).toBe('12.3')
  })
})

describe('minSigFigs', () => {
  it('returns minimum across inputs', () => {
    expect(minSigFigs('20', '10', '0')).toBe(1)
    expect(minSigFigs('20.0', '10.0')).toBe(3)
  })

  it('ignores invalid strings', () => {
    expect(minSigFigs('20', '')).toBe(2)
  })

  it('returns default 3 when all invalid', () => {
    expect(minSigFigs('', 'abc')).toBe(3)
  })
})

describe('round1n', () => {
  it('rounds to 1 decimal with epsilon compensation', () => {
    // The classic case the epsilon was added for: 1.05 - 0.05 = 1.0
    // without epsilon but 1.0000000000000002 with floating-point error.
    expect(round1n(1.05 - 0.05)).toBe(1.0)
    expect(round1n(0.1 + 0.2)).toBe(0.3)
    expect(round1n(613.9)).toBe(613.9)
    expect(round1n(0.04)).toBe(0)
  })

  it('returns 0 for null/NaN (safe default for the most common tab pattern)', () => {
    expect(round1n(NaN)).toBe(0)
    expect(round1n(null as unknown as number)).toBe(0)
  })
})

describe('fmt1', () => {
  it('formats with at most 1 decimal place', () => {
    expect(fmt1(613.9)).toBe('613.9')
    expect(fmt1(0)).toBe('0.0')
    expect(fmt1(1754)).toBe('1754.0')
  })

  it('returns empty string for null/undefined/NaN (most common tab convention)', () => {
    expect(fmt1(null)).toBe('')
    expect(fmt1(undefined)).toBe('')
    expect(fmt1(NaN)).toBe('')
  })

  it('matches the per-tab local copies that were the source of truth', () => {
    // The exact values the per-tab local fmt1 functions returned before the
    // consolidation. If any future change to the canonical version breaks
    // a tab's display, this test catches it.
    expect(fmt1(273.06)).toBe('273.1')
    expect(fmt1(33.3)).toBe('33.3')
    expect(fmt1(7.5)).toBe('7.5')
  })
})
