/**
 * Tests for the engine's bag-volume math (v2.3 wizard).
 *
 * Coverage:
 *  - getRequiredBagLengthCm(weight, width, grind?) returns the
 *    minimum bag length in cm (rounded up to whole cm) for
 *    a flat-layer spread.
 *  - Default grind is 1.5 cm³/g (typical medium grind).
 *  - Coarser grinds need more bag length; finer grinds need
 *    less.
 *  - Edge cases: 0 weight returns 0; negative weight throws.
 */
import { describe, expect, it } from 'vitest'
import { getRequiredBagLengthCm } from '../bagVolume'

describe('getRequiredBagLengthCm — canonical formulas', () => {
  it('returns the minimum length for a 7g batch in a 19cm bag (default grind)', () => {
    // materialVolume = 7 * 1.5 = 10.5 cm³
    // target fill depth = 0.5 cm
    // length = 10.5 / (19 * 0.5) = 1.105 cm → rounded up to 2 cm
    expect(getRequiredBagLengthCm(7, 19)).toBe(2)
  })

  it('returns the minimum length for a 28g batch in a 28cm bag', () => {
    // materialVolume = 28 * 1.5 = 42 cm³
    // length = 42 / (28 * 0.5) = 3 cm
    expect(getRequiredBagLengthCm(28, 28)).toBe(3)
  })

  it('rounds up fractional lengths to whole cm', () => {
    // materialVolume = 3.5 * 1.5 = 5.25 cm³
    // length = 5.25 / (19 * 0.5) = 0.553 cm → rounded up to 1 cm
    expect(getRequiredBagLengthCm(3.5, 19)).toBe(1)
  })

  it('uses a custom grind factor when provided', () => {
    // Finer grind (1.0 cm³/g) needs less bag length than
    // the default (1.5 cm³/g) for the same amount.
    // 7g * 1.0 = 7 cm³ → 7 / (19 * 0.5) = 0.74 cm → 1 cm
    expect(getRequiredBagLengthCm(7, 19, 1.0)).toBe(1)
    // Coarser grind (3.0 cm³/g — kief-grade) needs more.
    // 7g * 3.0 = 21 cm³ → 21 / (19 * 0.5) = 2.21 cm → 3 cm
    expect(getRequiredBagLengthCm(7, 19, 3.0)).toBe(3)
  })
})

describe('getRequiredBagLengthCm — edge cases', () => {
  it('returns 0 for 0 weight (no material to spread)', () => {
    expect(getRequiredBagLengthCm(0, 19)).toBe(0)
  })

  it('throws on negative weight', () => {
    expect(() => getRequiredBagLengthCm(-1, 19)).toThrow()
  })

  it('throws on non-positive width', () => {
    expect(() => getRequiredBagLengthCm(7, 0)).toThrow()
    expect(() => getRequiredBagLengthCm(7, -5)).toThrow()
  })

  it('throws on negative grind factor', () => {
    expect(() => getRequiredBagLengthCm(7, 19, -1)).toThrow()
  })
})
