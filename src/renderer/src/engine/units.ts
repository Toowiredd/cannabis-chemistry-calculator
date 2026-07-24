/** Round a value to a maximum of 1 decimal place. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Convert grams to ounces. 1 oz = 28.3495 g */
export function gToOz(g: number): number {
  return g / 28.3495
}

/** Convert ounces to grams. 1 oz = 28.3495 g */
export function ozToG(oz: number): number {
  return oz * 28.3495
}

/** Convert Celsius to Fahrenheit. F = C * 9/5 + 32 */
export function cToF(c: number): number {
  return (c * 9) / 5 + 32
}

/** Convert Fahrenheit to Celsius. C = (F - 32) * 5/9 */
export function fToC(f: number): number {
  return ((f - 32) * 5) / 9
}

/** Convert milliliters to teaspoons. 1 tsp = 4.929 mL */
export function mlToTsp(ml: number): number {
  return ml / 4.929
}

/** Convert teaspoons to milliliters. 1 tsp = 4.929 mL */
export function tspToMl(tsp: number): number {
  return tsp * 4.929
}

/** Convert milliliters to tablespoons. 1 tbsp = 14.787 mL */
export function mlToTbsp(ml: number): number {
  return ml / 14.787
}

/** Convert tablespoons to milliliters. 1 tbsp = 14.787 mL */
export function tbspToMl(tbsp: number): number {
  return tbsp * 14.787
}

/** Convert milliliters to cups. 1 cup = 236.588 mL */
export function mlToCup(ml: number): number {
  return ml / 236.588
}

/** Convert cups to milliliters. 1 cup = 236.588 mL */
export function cupToMl(cup: number): number {
  return cup * 236.588
}

/**
 * Convert a volume expressed in any supported unit to milliliters.
 * Single canonical entry point so consumers (e.g. JournalTab) don't hand-roll
 * the per-unit switch — which was a drift risk the 2026-07-24 audit flagged.
 *
 * @param value  Numeric volume in `unit`
 * @param unit   'mL' | 'tsp' | 'tbsp' | 'cup'
 * @returns Volume in milliliters. Throws on unknown unit.
 */
export function volumeToMl(value: number, unit: 'mL' | 'tsp' | 'tbsp' | 'cup'): number {
  switch (unit) {
    case 'mL':
      return value
    case 'tsp':
      return tspToMl(value)
    case 'tbsp':
      return tbspToMl(value)
    case 'cup':
      return cupToMl(value)
    default:
      // Exhaustiveness check — if a new unit is added to the union, TS
      // will fail to compile here until the switch is updated.
      throw new Error(`Unknown volume unit: ${String(unit)}`)
  }
}

/** Convert centimeters to inches. 1 in = 2.54 cm */
export function cmToIn(cm: number): number {
  return cm / 2.54
}

/** Convert inches to centimeters. 1 in = 2.54 cm */
export function inToCm(inch: number): number {
  return inch * 2.54
}

/**
 * Convert a weight value from one unit to another. Pure math — caller
 * is responsible for parsing/formatting the string. Used by the
 * calculator tabs when the user toggles weight units: the field's
 * stored value is always in `decarb.weightUnit`; this helper
 * converts it for display in `units.weightUnit` and for engine
 * calls (which expect grams).
 */
export function convertWeight(
  value: number,
  from: 'g' | 'oz',
  to: 'g' | 'oz'
): number {
  if (from === to) return value
  return to === 'oz' ? gToOz(value) : ozToG(value)
}

/**
 * Convert a volume value from one unit to another. Used by
 * InfusionTab and QuickBatchTab to display the volume in the
 * user's current unit without mutating the stored value.
 */
export function convertVolume(
  value: number,
  from: 'mL' | 'tsp' | 'tbsp' | 'cup',
  to: 'mL' | 'tsp' | 'tbsp' | 'cup'
): number {
  if (from === to) return value
  let ml: number
  switch (from) {
    case 'mL':
      ml = value
      break
    case 'tsp':
      ml = tspToMl(value)
      break
    case 'tbsp':
      ml = tbspToMl(value)
      break
    case 'cup':
      ml = cupToMl(value)
      break
  }
  switch (to) {
    case 'mL':
      return ml
    case 'tsp':
      return mlToTsp(ml)
    case 'tbsp':
      return mlToTbsp(ml)
    case 'cup':
      return mlToCup(ml)
  }
}
