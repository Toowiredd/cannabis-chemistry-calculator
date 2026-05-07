/**
 * Multi-strain blending engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math -- zero UI imports.
 *
 * Given a set of strains with known potencies, calculates how much of each
 * strain is needed to hit a target total weight and target weighted-average
 * potency. Uses a two-strain bracketing algorithm for determinism.
 */
import { ValidationError } from './errors'

/** Round to at most 1 decimal place with epsilon compensation for floating-point error */
function round1(value: number): number {
  if (value === 0) return 0.0
  return Math.round((value + 1e-9) * 10) / 10
}

/** Input description for a single strain */
export interface BlendStrain {
  /** Human-readable strain name */
  name: string
  /** THCA (or THC) potency percentage [0, 100] */
  potency: number
}

/** Result for a single strain in the blend */
export interface BlendResult {
  name: string
  potency: number
  weightGrams: number
}

/** Overall blend calculation output */
export interface BlendOutput {
  /** Requested total weight in grams */
  totalWeight: number
  /** Requested target potency percentage */
  targetPotency: number
  /** Achieved potency percentage (same as target when achievable) */
  actualPotency: number
  /** Whether the target potency is achievable with the given strains */
  isAchievable: boolean
  /** Per-strain weights; sum equals totalWeight when achievable */
  results: BlendResult[]
}

/**
 * Calculate a multi-strain blend to hit a target weight and potency.
 *
 * Algorithm:
 * 1. Find the strain with potency closest to and ≤ target (lower bracket).
 * 2. Find the strain with potency closest to and ≥ target (upper bracket).
 * 3. If target exactly matches a strain potency, use only that strain.
 * 4. Otherwise, solve the two-strain linear system:
 *    w_low + w_high = totalWeight
 *    w_low*p_low + w_high*p_high = totalWeight*targetPotency
 * 5. All other strains receive 0 g.
 *
 * @param strains       Array of strain definitions (at least 2)
 * @param totalWeight   Desired total weight in grams (> 0)
 * @param targetPotency Desired weighted-average potency [0, 100]
 * @returns BlendOutput with per-strain weights and achievability flag
 */
export function calculateBlend(
  strains: BlendStrain[],
  totalWeight: number,
  targetPotency: number
): BlendOutput {
  /* ---------------- validation ---------------- */
  if (!strains || strains.length === 0) {
    throw new ValidationError('At least one strain is required')
  }
  if (strains.length < 2) {
    throw new ValidationError('At least two strains are required for blending')
  }
  if (totalWeight <= 0) {
    throw new ValidationError('totalWeight must be greater than 0')
  }
  if (targetPotency < 0) {
    throw new ValidationError('targetPotency cannot be negative')
  }
  if (targetPotency > 100) {
    throw new ValidationError('targetPotency cannot exceed 100%')
  }

  for (const strain of strains) {
    if (strain.potency < 0) {
      throw new ValidationError(`potency for "${strain.name}" cannot be negative`)
    }
    if (strain.potency > 100) {
      throw new ValidationError(`potency for "${strain.name}" cannot exceed 100%`)
    }
  }

  /* ---------------- determine achievability ---------------- */
  const potencies = strains.map(s => s.potency)
  const minPotency = Math.min(...potencies)
  const maxPotency = Math.max(...potencies)

  if (targetPotency < minPotency || targetPotency > maxPotency) {
    return {
      totalWeight,
      targetPotency,
      actualPotency: round1(
        targetPotency < minPotency ? minPotency : maxPotency
      ),
      isAchievable: false,
      results: strains.map(s => ({
        name: s.name,
        potency: s.potency,
        weightGrams: 0.0,
      })),
    }
  }

  /* ---------------- exact match ---------------- */
  const exactMatch = strains.find(s => s.potency === targetPotency)
  if (exactMatch) {
    return {
      totalWeight,
      targetPotency,
      actualPotency: round1(targetPotency),
      isAchievable: true,
      results: strains.map(s => ({
        name: s.name,
        potency: s.potency,
        weightGrams: s.name === exactMatch.name ? round1(totalWeight) : 0.0,
      })),
    }
  }

  /* ---------------- two-strain bracketing ---------------- */
  // Sort by potency ascending to find brackets deterministically
  const sorted = strains
    .map((s, idx) => ({ ...s, originalIndex: idx }))
    .sort((a, b) => a.potency - b.potency)

  let lower = sorted[0]
  let upper = sorted[sorted.length - 1]

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].potency < targetPotency && sorted[i + 1].potency > targetPotency) {
      lower = sorted[i]
      upper = sorted[i + 1]
      break
    }
  }

  // Solve the linear system
  const pLow = lower.potency
  const pHigh = upper.potency
  const wHigh = (totalWeight * (targetPotency - pLow)) / (pHigh - pLow)
  const wLow = totalWeight - wHigh

  const weightMap = new Map<string, number>()
  weightMap.set(lower.name, round1(wLow))
  weightMap.set(upper.name, round1(wHigh))

  // Preserve input order in results
  const results: BlendResult[] = strains.map(s => ({
    name: s.name,
    potency: s.potency,
    weightGrams: round1(weightMap.get(s.name) ?? 0),
  }))

  // Adjust for rounding drift: ensure sum equals totalWeight
  const currentSum = results.reduce((sum, r) => sum + r.weightGrams, 0)
  const drift = round1(totalWeight - currentSum)
  if (Math.abs(drift) > 0) {
    // Add drift to the lower-potency strain (arbitrary but deterministic)
    const lowerResult = results.find(r => r.name === lower.name)!
    lowerResult.weightGrams = round1(lowerResult.weightGrams + drift)
  }

  return {
    totalWeight,
    targetPotency,
    actualPotency: round1(targetPotency),
    isAchievable: true,
    results,
  }
}
