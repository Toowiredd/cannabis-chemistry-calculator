/**
 * Pure geometry logic for the DecarbHeatmap temperature bar.
 * Zero UI imports — deterministic, side-effect-free.
 */

import type { PresetMethod } from 'renderer/src/engine/models'

const MIN_TEMP = 73
const MAX_TEMP = 130
const RANGE = MAX_TEMP - MIN_TEMP

export { MIN_TEMP, MAX_TEMP }

const GREEN_YELLOW_BOUNDARY = 90
const YELLOW_RED_BOUNDARY = 116

/** Map a Celsius temperature to a 0–100 percentage on the 73°C→130°C bar. */
export function needlePosition(tempC: number): number {
  const clamped = Math.max(MIN_TEMP, Math.min(MAX_TEMP, tempC))
  return ((clamped - MIN_TEMP) / RANGE) * 100
}

/** Return the semantic zone for a given temperature. */
export type HeatmapZone = 'green' | 'yellow' | 'red'

export function zoneColor(tempC: number): HeatmapZone {
  if (tempC < GREEN_YELLOW_BOUNDARY) return 'green'
  if (tempC < YELLOW_RED_BOUNDARY) return 'yellow'
  return 'red'
}

/** Human-readable tooltip / warning for each zone. */
export function zoneTooltip(zone: HeatmapZone): string {
  switch (zone) {
    case 'green':
      return 'Terpene-preserving temperatures. Slower decarb but maximum flavor retention.'
    case 'yellow':
      return 'Standard decarb range. Good balance of efficiency and terpene preservation.'
    case 'red':
      return 'CBN degradation risk increases above 116°C. Fast decarb but significant terpene loss.'
  }
}

/** Build a dynamic sentence describing the efficiency/terpene trade-off. */
export function tradeOffSentence(
  tempC: number,
  preset: PresetMethod,
  isOverridden: boolean
): string {
  const zone = zoneColor(tempC)
  const lowPct = Math.round(preset.efficiency.low * 100)
  const highPct = Math.round(preset.efficiency.high * 100)

  const prefix = isOverridden
    ? `Custom override at ${tempC.toFixed(0)}°C`
    : `${preset.name} at ${tempC.toFixed(0)}°C`

  let suffix: string
  switch (zone) {
    case 'green':
      suffix = `Maximum terpene retention. Slower decarb but preserves flavor. Efficiency ${lowPct}–${highPct}%.`
      break
    case 'yellow':
      suffix = `Standard decarb balance. Good efficiency with moderate terpene preservation. Efficiency ${lowPct}–${highPct}%.`
      break
    case 'red':
      suffix = `CBN degradation risk increases. Fast decarb but significant terpene loss. Efficiency ${lowPct}–${highPct}%.`
      break
  }

  return `${prefix} — ${suffix}`
}

/** Returns true if the temperature is outside the practical decarb range. */
export function isOutOfRange(tempC: number): boolean {
  return tempC < MIN_TEMP || tempC > MAX_TEMP
}

/** Glow color hex for the needle based on zone. */
export function needleGlow(zone: HeatmapZone): string {
  switch (zone) {
    case 'green':
      return 'rgba(16,185,129,0.6)'
    case 'yellow':
      return 'rgba(245,158,11,0.6)'
    case 'red':
      return 'rgba(239,68,68,0.6)'
  }
}

/** Flex grow ratios for the three zones (must sum to 57). */
export const ZONE_RATIOS = {
  green: 17, // 90 - 73
  yellow: 26, // 116 - 90
  red: 14, // 130 - 116
} as const
