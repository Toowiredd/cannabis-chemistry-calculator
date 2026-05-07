import { describe, it, expect } from 'vitest'
import {
  countSigFigs,
  roundToSigFigs,
  formatWithSigFigs,
  minSigFigs,
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
