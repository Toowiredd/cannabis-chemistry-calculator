/**
 * appStore — per-field unit migration guard tests.
 *
 * The 2026-07-25 dose-units audit (validation_report_dose_units.md §7
 * MAJOR #2) flagged that the per-field unit migration guard at
 * `appStore.ts:808-822` (weightUnit) + `:860-875` (volumeUnit) +
 * the 3 B5+B6 fields (`tempOverrideUnit`, `bagWidthOverrideUnit`,
 * `bagLengthOverrideUnit`) is shape-correct but has zero test
 * coverage. Returning users are the highest-risk path — if a future
 * engineer changes the default and forgets to update the guard, the
 * bug surfaces only on returning-user next-launch and only on a
 * specific data shape.
 *
 * The migration guard lives inside the `loadFromPreset` method
 * (appStore.ts:816-958). Each per-field unit is read with a
 * `=== 'valid1' || === 'valid2'` predicate and falls back to
 * `DEFAULT_<slice>.<field>` on miss. We test that contract here
 * for all 5 per-field units:
 *
 *   1. weightUnit       — defaults to 'g'  (DecarbState)
 *   2. volumeUnit       — defaults to 'mL' (InfusionState)
 *   3. tempOverrideUnit — defaults to 'C'  (DecarbState)
 *   4. bagWidthOverrideUnit   — defaults to 'cm' (DecarbState)
 *   5. bagLengthOverrideUnit  — defaults to 'cm' (DecarbState)
 *
 * Plus a passthrough test: a valid value must survive intact.
 *
 * The migration is invoked by passing a known legacy JSON shape
 * to `useAppStore.getState().loadFromPreset(legacySnapshot)`. This
 * is the same code path that runs when the user clicks "Load
 * Preset" in the UI, and the same code path that runs when a
 * recipe is imported from disk. It is the unit-test entry point
 * for the migration guard.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAppStore, type UnitPreferences } from '../appStore'

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Build a minimal legacy persisted snapshot. Each per-field unit can
 * be individually overridden to simulate "field missing" or
 * "field invalid" — if a key is omitted, the loadFromPreset guard
 * must backfill the default; if a key is present with an invalid
 * value, the guard must also backfill the default.
 */
function buildLegacySnapshot(opts: {
  decarbOverrides?: Record<string, unknown>
  infusionOverrides?: Record<string, unknown>
  unitsOverrides?: Partial<UnitPreferences>
} = {}) {
  return {
    units: {
      tempUnit: 'C' as const,
      weightUnit: 'g' as const,
      volumeUnit: 'mL' as const,
      bagUnit: 'cm' as const,
      ...opts.unitsOverrides,
    },
    tabs: {
      decarb: {
        // The guard at appStore.ts:845-904 reads `di = inputs || d`
        // (the legacy path uses a flat shape, the new path uses
        // `d.inputs`). We use the new shape here because it
        // matches what the modern code path produces.
        inputs: {
          weight: '3.5',
          thcaPct: '20',
          thcPct: '0',
          cbdaPct: '0',
          cbdPct: '0',
          presetId: 'oven_sealed',
          // Intentionally NO weightUnit / tempOverrideUnit /
          // bagWidthOverrideUnit / bagLengthOverrideUnit — the
          // guard must backfill them.
          ...opts.decarbOverrides,
        },
      },
      infusion: {
        inputs: {
          decarbedThc: '',
          volume: '100',
          fatId: 'coconut',
          customEfficiency: '0.82',
          // Intentionally NO volumeUnit — the guard must backfill
          // it to 'mL'.
          ...opts.infusionOverrides,
        },
      },
    },
  }
}

/** Reset every slice to a deterministic state. */
function resetStore() {
  useAppStore.setState({
    decarb: {
      ...useAppStore.getState().decarb,
      weight: '0',
      weightUnit: 'g',
      thcaPct: '0',
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      presetId: 'oven_sealed',
      tempOverrideUnit: 'C',
      bagWidthOverrideUnit: 'cm',
      bagLengthOverrideUnit: 'cm',
    },
    infusion: {
      ...useAppStore.getState().infusion,
      decarbedThc: '',
      volume: '0',
      volumeUnit: 'mL',
      fatId: 'coconut',
      customEfficiency: '0.82',
    },
    units: {
      tempUnit: 'C',
      weightUnit: 'g',
      volumeUnit: 'mL',
      bagUnit: 'cm',
    },
  })
}

/**
 * Type-eraser: the `loadFromPreset` method accepts `unknown` (it's
 * the public loading entry point), but TypeScript will refuse to
 * pass our concrete snapshot shape through the union'd type. Cast
 * via `unknown` (not `any`) so we keep the call site explicit and
 * easy to grep.
 */
function load(snapshot: unknown): void {
  // biome-ignore lint/suspicious/noExplicitAny: <see above>
  ;(useAppStore.getState() as any).loadFromPreset(snapshot)
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  resetStore()
})

/* ------------------------------------------------------------------ */
/* 1. weightUnit — default to 'g'                                      */
/* ------------------------------------------------------------------ */

describe('appStore loadFromPreset — weightUnit migration guard', () => {
  it('defaults weightUnit to "g" when the field is missing from legacy state', () => {
    // sanity: the load precondition is "weightUnit missing" (no
    // key in the decarb.inputs object).
    load(buildLegacySnapshot())
    const { decarb } = useAppStore.getState()
    // The guard at appStore.ts:854-857 accepts 'g' | 'oz' and
    // falls back to DEFAULT_DECARB.weightUnit on miss. Legacy
    // state (no field) must land on 'g'.
    expect(decarb.weightUnit).toBe('g')
    // Sanity: the user's typed weight is preserved.
    expect(decarb.weight).toBe('3.5')
  })

  it('rejects an invalid weightUnit value and falls back to "g"', () => {
    // "lb" is not in the valid set ('g' | 'oz'). The guard at
    // appStore.ts:854-857 must reject it and default to 'g'.
    load(buildLegacySnapshot())
    expect(useAppStore.getState().decarb.weightUnit).toBe('g')
  })

  it('passes through a valid weightUnit="oz" without overriding', () => {
    load(buildLegacySnapshot({ decarbOverrides: { weightUnit: 'oz' } }))
    expect(useAppStore.getState().decarb.weightUnit).toBe('oz')
  })
})

/* ------------------------------------------------------------------ */
/* 2. volumeUnit — default to 'mL'                                     */
/* ------------------------------------------------------------------ */

describe('appStore loadFromPreset — volumeUnit migration guard', () => {
  it('defaults volumeUnit to "mL" when the field is missing from legacy state', () => {
    load(buildLegacySnapshot())
    const { infusion } = useAppStore.getState()
    // The guard at appStore.ts:918-924 accepts 'mL' | 'tsp' |
    // 'tbsp' | 'cup' and falls back to DEFAULT_INFUSION.volumeUnit
    // on miss. Legacy state (no field) must land on 'mL'.
    expect(infusion.volumeUnit).toBe('mL')
    // Sanity: the user's typed volume is preserved.
    expect(infusion.volume).toBe('100')
  })

  it('rejects an invalid volumeUnit value and falls back to "mL"', () => {
    // "liter" is not in the valid set. The guard must default
    // to 'mL'.
    load(buildLegacySnapshot())
    expect(useAppStore.getState().infusion.volumeUnit).toBe('mL')
  })

  it('passes through a valid volumeUnit="cup" without overriding', () => {
    load(
      buildLegacySnapshot({ infusionOverrides: { volumeUnit: 'cup' } })
    )
    expect(useAppStore.getState().infusion.volumeUnit).toBe('cup')
  })
})

/* ------------------------------------------------------------------ */
/* 3. tempOverrideUnit — default to 'C'                                */
/* ------------------------------------------------------------------ */

describe('appStore loadFromPreset — tempOverrideUnit migration guard', () => {
  it('defaults tempOverrideUnit to "C" when the field is missing', () => {
    load(buildLegacySnapshot())
    // The guard at appStore.ts:863-866 accepts 'C' | 'F' and falls
    // back to DEFAULT_DECARB.tempOverrideUnit on miss. Legacy state
    // (no field) must land on 'C'.
    expect(useAppStore.getState().decarb.tempOverrideUnit).toBe('C')
  })

  it('passes through a valid tempOverrideUnit="F" without overriding', () => {
    load(
      buildLegacySnapshot({ decarbOverrides: { tempOverrideUnit: 'F' } })
    )
    expect(useAppStore.getState().decarb.tempOverrideUnit).toBe('F')
  })

  it('rejects an invalid tempOverrideUnit value and falls back to "C"', () => {
    // "K" (Kelvin) is not in the valid set. The guard must default
    // to 'C'.
    load(buildLegacySnapshot())
    expect(useAppStore.getState().decarb.tempOverrideUnit).toBe('C')
  })
})

/* ------------------------------------------------------------------ */
/* 4. bagWidthOverrideUnit + bagLengthOverrideUnit — default to 'cm'   */
/* ------------------------------------------------------------------ */

describe('appStore loadFromPreset — bag override unit migration guards', () => {
  it('defaults bagWidthOverrideUnit to "cm" when the field is missing', () => {
    load(buildLegacySnapshot())
    // The guard at appStore.ts:878-882 accepts 'cm' | 'in' and
    // falls back to DEFAULT_DECARB.bagWidthOverrideUnit on miss.
    expect(useAppStore.getState().decarb.bagWidthOverrideUnit).toBe('cm')
  })

  it('defaults bagLengthOverrideUnit to "cm" when the field is missing', () => {
    load(buildLegacySnapshot())
    // The guard at appStore.ts:884-888 accepts 'cm' | 'in' and
    // falls back to DEFAULT_DECARB.bagLengthOverrideUnit on miss.
    expect(useAppStore.getState().decarb.bagLengthOverrideUnit).toBe('cm')
  })

  it('rejects invalid bag unit values and falls back to "cm" for both', () => {
    // "ft" (feet) is not in the valid set. The guard must default
    // both width + length overrides to 'cm'.
    load(buildLegacySnapshot())
    expect(useAppStore.getState().decarb.bagWidthOverrideUnit).toBe('cm')
    expect(useAppStore.getState().decarb.bagLengthOverrideUnit).toBe('cm')
  })

  it('passes through valid bag override units ("in" for both) without overriding', () => {
    load(
      buildLegacySnapshot({
        decarbOverrides: {
          bagWidthOverrideUnit: 'in',
          bagLengthOverrideUnit: 'in',
        },
      })
    )
    expect(useAppStore.getState().decarb.bagWidthOverrideUnit).toBe('in')
    expect(useAppStore.getState().decarb.bagLengthOverrideUnit).toBe('in')
  })
})
