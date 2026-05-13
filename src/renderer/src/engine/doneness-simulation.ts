/**
 * Doneness simulation engine for the Cannabis Chemistry Calculator.
 * Pure TypeScript math — zero UI imports.
 */
import { round1 } from './units'

/**
 * Simulate the kinetic progression of THCA → THC → CBN over time
 * at a given temperature using a simplified Arrhenius model.
 *
 * @param tempC        Temperature in Celsius
 * @param maxTimeMin   Maximum time to simulate (minutes)
 * @param steps        Number of discrete time steps (default 120)
 * @returns Array of {t, thca, thc, cbn} points, each as rounded percentages
 */
export function simulateDoneness(
  tempC: number,
  maxTimeMin: number,
  steps = 120
): { t: number; thca: number; thc: number; cbn: number }[] {
  const result: { t: number; thca: number; thc: number; cbn: number }[] = []
  const dt = maxTimeMin / steps
  const T_K = tempC + 273.15
  const R = 8.314 // J/(mol*K)
  // Simplified Arrhenius: higher temp = faster reactions
  const Ea1 = 92_000 // THCA→THC (J/mol)
  const Ea2 = 110_000 // THC→CBN (J/mol)
  const A1 = 1.5e12 // pre-exponential factor
  const A2 = 2.0e12

  const k1 = A1 * Math.exp(-Ea1 / (R * T_K)) * 60 // per minute
  const k2 = A2 * Math.exp(-Ea2 / (R * T_K)) * 60 // per minute

  let thca = 1.0
  let thc = 0.0
  let cbn = 0.0

  for (let i = 0; i <= steps; i++) {
    const t = i * dt
    result.push({
      t: round1(t),
      thca: round1(thca * 100),
      thc: round1(thc * 100),
      cbn: round1(cbn * 100),
    })

    const dThca = -k1 * thca * dt
    const dThc = (k1 * thca - k2 * thc) * dt
    const dCbn = k2 * thc * dt

    thca += dThca
    thc += dThc
    cbn += dCbn

    if (thca < 0) thca = 0
    if (thc < 0) thc = 0
    if (cbn < 0) cbn = 0
    const total = thca + thc + cbn
    if (total > 0) {
      thca /= total
      thc /= total
      cbn /= total
    }
    if (cbn > 0.1) {
      cbn = 0.1
      const remaining = thca + thc
      if (remaining > 0) {
        const scale = 0.9 / remaining
        thca *= scale
        thc *= scale
      }
    }
  }

  return result
}

/**
 * Format a duration in minutes into a human-readable string.
 * Examples: 30 → "30m", 90 → "1h 30m", 120 → "2h"
 */
export function timeLabel(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }
  return `${Math.round(minutes)}m`
}
