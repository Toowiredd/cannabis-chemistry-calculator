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
 * This is also the canonical replacement for the local `displayVolumeToMl`
 * helper that was previously duplicated in `InfusionTab.tsx` and
 * `AdvancedToolsTab.tsx` (Infusion run + 2026-07-25 audit). For string inputs
 * (raw `<input>` values), call `displayVolumeToMl` instead — it parses the
 * string first and returns `NaN` on empty/invalid input, which is what the
 * UI calculators expect when the field is blank.
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

/**
 * String-input variant of `volumeToMl` for the calculator tabs. Parses a raw
 * `<input>` value (string) and returns the equivalent volume in milliliters.
 * Returns `NaN` if the input string is empty or unparseable — this matches
 * the pre-refactor local helpers in `InfusionTab.tsx` and
 * `AdvancedToolsTab.tsx` (Fats sub-tab) that this function replaces.
 *
 * The conversion itself delegates to `volumeToMl` so the per-unit switch and
 * exhaustiveness check stay single-sourced.
 *
 * @param value  Raw string from the volume `<input>` (e.g. "100", "0.5")
 * @param unit   'mL' | 'tsp' | 'tbsp' | 'cup'
 * @returns Volume in milliliters, or `NaN` if `value` is not a valid number.
 */
export function displayVolumeToMl(
  value: string,
  unit: 'mL' | 'tsp' | 'tbsp' | 'cup'
): number {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return NaN
  return volumeToMl(n, unit)
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
 * is responsible for parsing/formatting the string.
 *
 * Used by ALL calculator tabs (Decarb, Infusion, Methods, QuickBatch,
 * AdvancedTools, BagCalculator) for the per-field unit refactor. The
 * toggle handler never mutates the stored value; this helper is the
 * only conversion point at the display boundary. Read sites in
 * calculations should use the per-field `decarb.weightUnit` /
 * `infusion.volumeUnit` to interpret the stored value, then convert to
 * canonical grams/mL via `ozToG` / `volumeToMl`.
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
 * Convert a volume value from one unit to another. Used by ALL
 * calculator tabs (Decarb, Infusion, Methods, QuickBatch, AdvancedTools,
 * BagCalculator) to display the volume in the user's current unit
 * without mutating the stored value. See `convertWeight` for the
 * per-field refactor contract.
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
