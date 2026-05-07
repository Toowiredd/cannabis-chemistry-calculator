/**
 * Bag volume calculation engine for sous vide decarboxylation.
 * Pure TypeScript math — zero UI imports.
 */
import { ValidationError } from './errors'
import type { PresetBag } from './models'

/** Round to at most N decimal places */
function roundN(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + 1e-9) * factor) / factor
}

/**
 * Estimate material bulk volume from weight and grind level.
 *
 * Formula: grams * grindCm3PerGram
 *
 * @param grams Material weight in grams
 * @param grindCm3PerGram Bulk volume factor in cm³/g
 * @returns Estimated material volume in cm³, rounded to 1 decimal
 */
export function estimateMaterialVolume(
  grams: number,
  grindCm3PerGram: number
): number {
  if (grams < 0) throw new ValidationError('grams cannot be negative')
  if (grindCm3PerGram < 0) {
    throw new ValidationError('grindCm3PerGram cannot be negative')
  }
  return roundN(grams * grindCm3PerGram, 1)
}

/**
 * Calculate fill depth of material in a flat bag.
 *
 * Formula: materialVolumeCm3 / (bagWidthCm * bagLengthCm)
 *
 * @param materialVolumeCm3 Material volume in cm³
 * @param bagWidthCm Bag width in cm
 * @param bagLengthCm Bag length in cm
 * @returns Fill depth in cm, rounded to 3 decimals
 */
export function calculateFillDepth(
  materialVolumeCm3: number,
  bagWidthCm: number,
  bagLengthCm: number
): number {
  if (materialVolumeCm3 < 0) {
    throw new ValidationError('materialVolumeCm3 cannot be negative')
  }
  if (bagWidthCm <= 0) throw new ValidationError('bagWidthCm must be positive')
  if (bagLengthCm <= 0) {
    throw new ValidationError('bagLengthCm must be positive')
  }
  return roundN(materialVolumeCm3 / (bagWidthCm * bagLengthCm), 3)
}

/**
 * Calculate total bag volume from dimensions.
 *
 * Formula: width * length * depth
 *
 * @param widthCm Width in cm
 * @param lengthCm Length in cm
 * @param depthCm Depth in cm
 * @returns Bag volume in cm³, rounded to 1 decimal
 */
export function calculateBagVolume(
  widthCm: number,
  lengthCm: number,
  depthCm: number
): number {
  if (widthCm < 0) throw new ValidationError('widthCm cannot be negative')
  if (lengthCm < 0) throw new ValidationError('lengthCm cannot be negative')
  if (depthCm < 0) throw new ValidationError('depthCm cannot be negative')
  if (widthCm === 0 || lengthCm === 0 || depthCm === 0) return 0.0
  return roundN(widthCm * lengthCm * depthCm, 1)
}

/**
 * Calculate headspace percentage in a bag.
 *
 * Formula: (bagVolume - materialVolume) / bagVolume * 100
 *
 * @param materialVolumeCm3 Material volume in cm³
 * @param bagVolumeCm3 Bag volume in cm³
 * @returns Headspace percentage, rounded to 1 decimal
 */
export function calculateHeadspace(
  materialVolumeCm3: number,
  bagVolumeCm3: number
): number {
  if (materialVolumeCm3 < 0) {
    throw new ValidationError('materialVolumeCm3 cannot be negative')
  }
  if (bagVolumeCm3 <= 0) {
    throw new ValidationError('bagVolumeCm3 must be positive')
  }
  return roundN(
    ((bagVolumeCm3 - materialVolumeCm3) / bagVolumeCm3) * 100,
    1
  )
}

/**
 * Get qualitative status for a given headspace percentage.
 *
 * Zones:
 * - critical: < 5% or > 40% (or negative = overflow)
 * - tight: 5% – 10%
 * - optimal: 10% – 25%
 * - loose: 25% – 40%
 *
 * @param headspacePct Headspace percentage
 * @returns Status label
 */
export function getHeadspaceStatus(headspacePct: number): string {
  if (headspacePct < 5 || headspacePct > 40) return 'critical'
  if (headspacePct >= 10 && headspacePct <= 25) return 'optimal'
  if (headspacePct < 10) return 'tight'
  return 'loose'
}

/**
 * Recommend double-bagging based on temperature and bag type.
 *
 * @param tempC Decarboxylation temperature in Celsius
 * @param bagType Bag construction type ('zip' | 'vacuum')
 * @param hasStems Whether material contains stems that may puncture
 * @returns true if double-bagging is recommended
 */
export function recommendDoubleBag(
  tempC: number,
  bagType: 'zip' | 'vacuum',
  hasStems: boolean
): boolean {
  if (hasStems) return true
  if (bagType === 'zip' && tempC >= 95) return true
  return false
}

/**
 * Select the best bag and an alternative from a list of presets.
 *
 * Rules:
 * 1. Exclude bags that overflow (materialVolume >= bagVolume)
 * 2. Find bags with optimal headspace (10–25%)
 * 3. If any optimal bags exist, pick the smallest as best, next smallest as alternative
 * 4. If no optimal bags, pick the non-overflowing bag closest to optimal range as best
 *
 * @param materialVolumeCm3 Material volume in cm³
 * @param bagPresets Array of bag presets to evaluate
 * @returns { best, alternative } — PresetBag or null
 */
export function selectBestBag(
  materialVolumeCm3: number,
  bagPresets: readonly PresetBag[]
): { best: PresetBag | null; alternative: PresetBag | null } {
  if (materialVolumeCm3 < 0) {
    throw new ValidationError('materialVolumeCm3 cannot be negative')
  }

  // Filter out overflowing bags
  const candidates = bagPresets
    .map(b => ({
      bag: b,
      headspace: calculateHeadspace(materialVolumeCm3, b.volumeCm3),
    }))
    .filter(c => c.headspace > 0)

  if (candidates.length === 0) {
    return { best: null, alternative: null }
  }

  // Separate optimal from non-optimal
  const optimal = candidates.filter(c => {
    const h = c.headspace
    return h >= 10 && h <= 25
  })

  if (optimal.length > 0) {
    // Sort by bag volume ascending — smallest bag first
    optimal.sort((a, b) => a.bag.volumeCm3 - b.bag.volumeCm3)
    const best = optimal[0].bag
    const alternative = optimal.length > 1 ? optimal[1].bag : null
    return { best, alternative }
  }

  // No optimal bags — pick the one closest to optimal range.
  // Distance is measured from the nearest bound of the optimal range.
  const scored = candidates.map(c => {
    const h = c.headspace
    let distance: number
    if (h < 10) {
      distance = 10 - h
    } else {
      distance = h - 25
    }
    return { ...c, distance }
  })

  scored.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    return a.bag.volumeCm3 - b.bag.volumeCm3
  })
  return { best: scored[0].bag, alternative: null }
}
