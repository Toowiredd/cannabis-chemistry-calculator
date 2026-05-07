/**
 * THC degradation engine for the Cannabis Chemistry Calculator.
 * First-order kinetics model for THC -> CBN conversion at different temperatures.
 * Rate constants based on Jaidee 2022 data.
 *
 * Formula (first-order): C(t) = C0 * e^(-k * t)
 *   where C0 = initial concentration, k = rate constant, t = time in days
 *
 * All outputs are labeled as estimates.
 */
import { ValidationError } from './errors'

/** Round to at most 1 decimal place with epsilon compensation */
function round1(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

/** Degradation rate preset at a given temperature */
export interface DegradationRate {
  /** Temperature in Celsius */
  tempC: number
  /** First-order rate constant in day^-1 */
  ratePerDay: number
  /** Human-readable label */
  label: string
}

/** Degradation calculation result */
export interface DegradationResult {
  /** Number of days */
  days: number
  /** Temperature in Celsius */
  tempC: number
  /** Rate constant used */
  ratePerDay: number
  /** THC remaining as percentage of initial */
  thcRemainingPercent: number
  /** CBN formed as percentage of initial THC */
  cbnFormedPercent: number
  /** Half-life in days for this temperature */
  halfLifeDays: number
  /** Human-readable temperature label */
  label: string
  /** All outputs are estimates */
  isEstimate: true
}

// ---------------------------------------------------------------------------
// Rate presets -- Jaidee 2022 temperature-dependent kinetics
// ---------------------------------------------------------------------------

export const DEGRADATION_RATES: readonly DegradationRate[] = [
  { tempC: 4, ratePerDay: 0.00005, label: 'Refrigerated' },
  { tempC: 25, ratePerDay: 0.0005, label: 'Room Temperature' },
  { tempC: 40, ratePerDay: 0.002, label: 'Warm Storage' },
] as const

/** Natural log of 2, used for half-life calculation */
const LN2 = Math.log(2)

/**
 * Calculate the percentage of THC remaining after `days` at a given rate.
 *
 * Formula: 100 * e^(-ratePerDay * days)
 *
 * @param days      Duration in days (must be >= 0)
 * @param ratePerDay First-order rate constant in day^-1 (must be >= 0)
 * @returns Percentage of THC remaining, rounded to 1 decimal
 */
export function calculateRemainingThcPercent(
  days: number,
  ratePerDay: number
): number {
  if (days < 0) throw new ValidationError('days cannot be negative')
  if (ratePerDay < 0) throw new ValidationError('ratePerDay cannot be negative')

  const remaining = 100 * Math.exp(-ratePerDay * days)
  return round1(remaining)
}

/**
 * Calculate the percentage of CBN formed (degraded THC) after `days`.
 *
 * Formula: 100 - remainingThcPercent
 *
 * @param days      Duration in days (must be >= 0)
 * @param ratePerDay First-order rate constant in day^-1 (must be >= 0)
 * @returns Percentage of CBN formed, rounded to 1 decimal
 */
export function calculateCbnFormedPercent(
  days: number,
  ratePerDay: number
): number {
  if (days < 0) throw new ValidationError('days cannot be negative')
  if (ratePerDay < 0) throw new ValidationError('ratePerDay cannot be negative')

  const formed = 100 - calculateRemainingThcPercent(days, ratePerDay)
  return round1(formed)
}

/**
 * Calculate the half-life (in days) for a given first-order rate constant.
 *
 * Formula: ln(2) / ratePerDay
 *
 * @param ratePerDay First-order rate constant in day^-1 (must be > 0)
 * @returns Half-life in days, rounded to 1 decimal
 */
export function calculateHalfLifeDays(ratePerDay: number): number {
  if (ratePerDay <= 0) {
    throw new ValidationError('ratePerDay must be greater than 0')
  }

  return round1(LN2 / ratePerDay)
}

/**
 * Look up the degradation rate for a supported temperature.
 *
 * @param tempC Temperature in Celsius
 * @returns Matching DegradationRate
 * @throws ValidationError if temperature is not supported
 */
function getRateForTemperature(tempC: number): DegradationRate {
  const rate = DEGRADATION_RATES.find(r => r.tempC === tempC)
  if (!rate) {
    throw new ValidationError(
      `Unsupported temperature: ${tempC}°C. Supported: ${DEGRADATION_RATES.map(r => r.tempC).join(', ')}°C`
    )
  }
  return rate
}

/**
 * Full degradation calculation: remaining THC, CBN formed, and half-life.
 *
 * @param days  Duration in days (must be >= 0)
 * @param tempC Temperature in Celsius (must be in DEGRADATION_RATES)
 * @returns DegradationResult with all values labeled as estimates
 */
export function calculateDegradation(
  days: number,
  tempC: number
): DegradationResult {
  if (days < 0) throw new ValidationError('days cannot be negative')

  const rate = getRateForTemperature(tempC)

  return {
    days,
    tempC,
    ratePerDay: rate.ratePerDay,
    thcRemainingPercent: calculateRemainingThcPercent(days, rate.ratePerDay),
    cbnFormedPercent: calculateCbnFormedPercent(days, rate.ratePerDay),
    halfLifeDays: calculateHalfLifeDays(rate.ratePerDay),
    label: rate.label,
    isEstimate: true,
  }
}
