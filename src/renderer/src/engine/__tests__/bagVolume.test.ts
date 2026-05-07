/**
 * Failing tests (RED) for bag volume calculation engine.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/bagVolume.test.ts
 */
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import {
  estimateMaterialVolume,
  calculateFillDepth,
  calculateBagVolume,
  calculateHeadspace,
  getHeadspaceStatus,
  recommendDoubleBag,
  selectBestBag,
} from '../bagVolume'
import { BAG_PRESETS, GRIND_LEVELS } from '../models'

describe('estimateMaterialVolume', () => {
  it('3.5g medium grind → 12.3 cm³ (VAL-BAG-002)', () => {
    // 3.5 × 3.5 = 12.25 → 12.3
    expect(estimateMaterialVolume(3.5, 3.5)).toBe(12.3)
  })

  it('3.5g coarse grind → 21.0 cm³ (VAL-BAG-002)', () => {
    // 3.5 × 6.0 = 21.0
    expect(estimateMaterialVolume(3.5, 6.0)).toBe(21.0)
  })

  it('3.5g fine grind → 7.7 cm³', () => {
    // 3.5 × 2.2 = 7.7
    expect(estimateMaterialVolume(3.5, 2.2)).toBe(7.7)
  })

  it('returns 0.0 for zero weight', () => {
    expect(estimateMaterialVolume(0, 3.5)).toBe(0.0)
  })

  it('rejects negative grams', () => {
    expect(() => estimateMaterialVolume(-1, 3.5)).toThrow(ValidationError)
    expect(() => estimateMaterialVolume(-1, 3.5)).toThrow(
      'grams cannot be negative'
    )
  })

  it('rejects negative grind factor', () => {
    expect(() => estimateMaterialVolume(3.5, -1)).toThrow(ValidationError)
    expect(() => estimateMaterialVolume(3.5, -1)).toThrow(
      'grindCm3PerGram cannot be negative'
    )
  })

  it('handles large weight without overflow', () => {
    // 1000g × 3.5 = 3500.0 cm³
    expect(estimateMaterialVolume(1000, 3.5)).toBe(3500.0)
  })
})

describe('calculateFillDepth', () => {
  it('12.3 cm³ in quart bag (17.8×20.3 cm) → 0.034 cm', () => {
    // 12.3 / (17.8 × 20.3) = 12.3 / 361.34 ≈ 0.034
    expect(calculateFillDepth(12.3, 17.8, 20.3)).toBe(0.034)
  })

  it('21.0 cm³ in quart bag → 0.058 cm', () => {
    expect(calculateFillDepth(21.0, 17.8, 20.3)).toBe(0.058)
  })

  it('returns 0.0 for zero material volume', () => {
    expect(calculateFillDepth(0, 17.8, 20.3)).toBe(0.0)
  })

  it('rejects negative material volume', () => {
    expect(() => calculateFillDepth(-1, 17.8, 20.3)).toThrow(ValidationError)
  })

  it('rejects non-positive bag width', () => {
    expect(() => calculateFillDepth(12.3, 0, 20.3)).toThrow(ValidationError)
    expect(() => calculateFillDepth(12.3, -1, 20.3)).toThrow(ValidationError)
  })

  it('rejects non-positive bag length', () => {
    expect(() => calculateFillDepth(12.3, 17.8, 0)).toThrow(ValidationError)
    expect(() => calculateFillDepth(12.3, 17.8, -1)).toThrow(ValidationError)
  })
})

describe('calculateBagVolume', () => {
  it('quart bag (17.8×20.3×0.17 cm) → 61.4 cm³', () => {
    // 17.8 × 20.3 × 0.17 = 61.438 → 61.4
    expect(calculateBagVolume(17.8, 20.3, 0.17)).toBe(61.4)
  })

  it('gallon bag (28.0×27.9×0.25 cm) → 195.3 cm³', () => {
    expect(calculateBagVolume(28.0, 27.9, 0.25)).toBe(195.3)
  })

  it('returns 0.0 when any dimension is zero', () => {
    expect(calculateBagVolume(0, 20.3, 0.17)).toBe(0.0)
    expect(calculateBagVolume(17.8, 0, 0.17)).toBe(0.0)
    expect(calculateBagVolume(17.8, 20.3, 0)).toBe(0.0)
  })

  it('rejects negative dimensions', () => {
    expect(() => calculateBagVolume(-1, 20.3, 0.17)).toThrow(ValidationError)
    expect(() => calculateBagVolume(17.8, -1, 0.17)).toThrow(ValidationError)
    expect(() => calculateBagVolume(17.8, 20.3, -0.1)).toThrow(ValidationError)
  })
})

describe('calculateHeadspace', () => {
  it('12.3 cm³ in quart bag (61.4 cm³) → 80.0%', () => {
    // (61.4 - 12.3) / 61.4 × 100 = 79.967 → 80.0
    expect(calculateHeadspace(12.3, 61.4)).toBe(80.0)
  })

  it('49 cm³ in small vacuum bag (57.9 cm³) → 15.4%', () => {
    // (57.9 - 49) / 57.9 × 100 = 15.371 → 15.4
    expect(calculateHeadspace(49, 57.9)).toBe(15.4)
  })

  it('175 cm³ in gallon bag (195.3 cm³) → 10.4%', () => {
    // (195.3 - 175) / 195.3 × 100 = 10.394 → 10.4
    expect(calculateHeadspace(175, 195.3)).toBe(10.4)
  })

  it('returns 0.0 when material exactly fills bag', () => {
    expect(calculateHeadspace(61.4, 61.4)).toBe(0.0)
  })

  it('returns negative headspace when material overflows bag', () => {
    // (57.9 - 73.5) / 57.9 × 100 = -26.942 → -26.9
    expect(calculateHeadspace(73.5, 57.9)).toBe(-26.9)
  })

  it('rejects negative material volume', () => {
    expect(() => calculateHeadspace(-1, 61.4)).toThrow(ValidationError)
  })

  it('rejects non-positive bag volume', () => {
    expect(() => calculateHeadspace(12.3, 0)).toThrow(ValidationError)
    expect(() => calculateHeadspace(12.3, -1)).toThrow(ValidationError)
  })
})

describe('getHeadspaceStatus', () => {
  it('10–25% → optimal (green zone)', () => {
    expect(getHeadspaceStatus(10.0)).toBe('optimal')
    expect(getHeadspaceStatus(15.0)).toBe('optimal')
    expect(getHeadspaceStatus(25.0)).toBe('optimal')
  })

  it('5–10% → tight (amber zone)', () => {
    expect(getHeadspaceStatus(5.0)).toBe('tight')
    expect(getHeadspaceStatus(7.5)).toBe('tight')
    expect(getHeadspaceStatus(9.9)).toBe('tight')
  })

  it('25–40% → loose (amber zone)', () => {
    expect(getHeadspaceStatus(25.1)).toBe('loose')
    expect(getHeadspaceStatus(30.0)).toBe('loose')
    expect(getHeadspaceStatus(40.0)).toBe('loose')
  })

  it('< 5% or > 40% → critical (red zone)', () => {
    expect(getHeadspaceStatus(4.9)).toBe('critical')
    expect(getHeadspaceStatus(0.0)).toBe('critical')
    expect(getHeadspaceStatus(40.1)).toBe('critical')
    expect(getHeadspaceStatus(80.0)).toBe('critical')
  })

  it('negative headspace → critical', () => {
    expect(getHeadspaceStatus(-10.0)).toBe('critical')
  })
})

describe('recommendDoubleBag', () => {
  it('temp ≥ 95°C + zip bag → true (VAL-BAG-006)', () => {
    expect(recommendDoubleBag(95, 'zip', false)).toBe(true)
    expect(recommendDoubleBag(100, 'zip', false)).toBe(true)
  })

  it('temp < 95°C + zip bag → false', () => {
    expect(recommendDoubleBag(85, 'zip', false)).toBe(false)
    expect(recommendDoubleBag(73, 'zip', false)).toBe(false)
  })

  it('any temp + vacuum bag → false', () => {
    expect(recommendDoubleBag(95, 'vacuum', false)).toBe(false)
    expect(recommendDoubleBag(100, 'vacuum', false)).toBe(false)
    expect(recommendDoubleBag(73, 'vacuum', false)).toBe(false)
  })

  it('has stems → true regardless of temp or bag type', () => {
    expect(recommendDoubleBag(73, 'zip', true)).toBe(true)
    expect(recommendDoubleBag(73, 'vacuum', true)).toBe(true)
    expect(recommendDoubleBag(95, 'zip', true)).toBe(true)
  })
})

describe('selectBestBag', () => {
  it('picks smallest bag with 10–25% headspace as best (VAL-BAG-007)', () => {
    // 49 cm³ (14g medium grind) → small_vac has 15.4% headspace, quart has 20.2%
    // Both optimal. Smallest volume = small_vac (57.9 < 61.4)
    const result = selectBestBag(49, BAG_PRESETS)
    expect(result.best).toBeDefined()
    expect(result.best!.id).toBe('small_vac')
  })

  it('provides alternative when multiple bags are optimal', () => {
    // 49 cm³ → small_vac (best), quart (alternative, next smallest optimal)
    const result = selectBestBag(49, BAG_PRESETS)
    expect(result.best!.id).toBe('small_vac')
    expect(result.alternative).toBeDefined()
    expect(result.alternative!.id).toBe('quart')
  })

  it('picks closest-to-optimal when no bag has 10–25% headspace', () => {
    // 12.3 cm³ (3.5g medium grind) → all bags have >40% headspace
    // Closest to optimal range: small_vac with 57.7% headspace
    const result = selectBestBag(12.3, BAG_PRESETS)
    expect(result.best).toBeDefined()
    expect(result.best!.id).toBe('small_vac')
    expect(result.alternative).toBeNull()
  })

  it('filters out bags that overflow (material > bag volume)', () => {
    // 250 cm³ overflows all bags except 2-gallon (433.7 cm³)
    const result = selectBestBag(250, BAG_PRESETS)
    expect(result.best!.id).toBe('2gallon')
    expect(result.alternative).toBeNull()
  })

  it('prefers closest-to-optimal non-overflowing bag when smaller bags overflow', () => {
    // 65 cm³ overflows small_vac (57.9) and quart (61.4)
    // gallon headspace = (195.3 - 65) / 195.3 * 100 = 66.7% → distance = 41.7
    // large_vac headspace = (128.5 - 65) / 128.5 * 100 = 49.4% → distance = 24.4
    // large_vac is closer to optimal, so it is best
    const result = selectBestBag(65, BAG_PRESETS)
    expect(result.best!.id).toBe('large_vac')
  })

  it('returns null best when no bag can fit the material', () => {
    // 500 cm³ overflows all bags
    const result = selectBestBag(500, BAG_PRESETS)
    expect(result.best).toBeNull()
    expect(result.alternative).toBeNull()
  })

  it('handles zero material volume', () => {
    const result = selectBestBag(0, BAG_PRESETS)
    // All bags have 100% headspace. Smallest bag = small_vac
    expect(result.best!.id).toBe('small_vac')
  })
})

describe('Preset data integrity', () => {
  it('BAG_PRESETS contains exactly 5 entries', () => {
    expect(BAG_PRESETS).toHaveLength(5)
  })

  it('GRIND_LEVELS contains exactly 3 entries', () => {
    expect(GRIND_LEVELS).toHaveLength(3)
  })

  it('all bag preset ids are unique', () => {
    const ids = BAG_PRESETS.map(b => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all bag dimensions are positive', () => {
    for (const b of BAG_PRESETS) {
      expect(b.widthCm).toBeGreaterThan(0)
      expect(b.lengthCm).toBeGreaterThan(0)
      expect(b.depthCm).toBeGreaterThan(0)
      expect(b.volumeCm3).toBeGreaterThan(0)
    }
  })

  it('grind levels have correct cm³/g values', () => {
    const coarse = GRIND_LEVELS.find(g => g.id === 'coarse')
    const medium = GRIND_LEVELS.find(g => g.id === 'medium')
    const fine = GRIND_LEVELS.find(g => g.id === 'fine')
    expect(coarse!.cm3PerGram).toBe(6.0)
    expect(medium!.cm3PerGram).toBe(3.5)
    expect(fine!.cm3PerGram).toBe(2.2)
  })

  it('bag names contain no emojis', () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    for (const b of BAG_PRESETS) {
      expect(b.name).not.toMatch(emojiRegex)
    }
    for (const g of GRIND_LEVELS) {
      expect(g.name).not.toMatch(emojiRegex)
    }
  })
})
