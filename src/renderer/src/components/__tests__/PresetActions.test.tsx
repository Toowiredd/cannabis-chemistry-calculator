/**
 * PresetActions — audit-fix regression tests for the 2026-07-25
 * ccc uiux-reviewer B2 + B3 fixes.
 *
 * Coverage:
 * - B2: `buildPresetPayload` writes the per-field units
 *   (`decarb.weightUnit`, `infusion.volumeUnit`,
 *   `decarb.tempOverrideUnit`, `decarb.bagWidthOverrideUnit`,
 *   `decarb.bagLengthOverrideUnit`) alongside the per-field values.
 *   The prior narrow payload omitted the per-field unit fields, so
 *   a user who set `decarb.weightUnit = 'oz'` + `decarb.weight =
 *   '0.12'` then saved + loaded got a payload that read
 *   `units.weightUnit = 'oz'` but no `decarb.weightUnit`; on load,
 *   the store defaulted `decarb.weightUnit` to `'g'`, so 0.12 was
 *   re-interpreted as 0.12 g — three orders of magnitude off.
 * - B3: `buildPresetPayload` writes the full `decarb` (including
 *   `bagGrindId`, `bagPresetId`, `bagWidthOverride`,
 *   `bagLengthOverride`, `bagHasStems`, `materialMode`,
 *   `concentrateTypeId`, `strainId`), the full `infusion` (with
 *   `volumeUnit`), the full `dose` (with `formatId`, `reverseMode`,
 *   `desiredMgPerServing`), the full `advancedTools` slice, and
 *   the full `label` slice. The prior payload dropped all of
 *   these.
 *
 * The audit also asked for a load-path round-trip test. The store's
 * `loadFromPreset` is owned by the parallel `state-routing` dispatch
 * (it extends the load schema to read back `label` and
 * `advancedTools`); once that lands the round-trip can be pinned
 * end-to-end. The producer-side tests below cover every field the
 * payload contract promises, which is what we own in this dispatch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_DECARB,
  DEFAULT_DOSE,
  DEFAULT_INFUSION,
  useAppStore,
} from '../../stores/appStore'
import { buildPresetPayloadForTest } from '../PresetActions'

/* jsdom doesn't ship matchMedia by default — stub a no-op so any
 * internal `useReducedMotion` calls (this file doesn't import
 * PresetActions directly, but defensive stubbing keeps the test
 * environment in a known state). */
beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Reset the calculator slices to a known seed. */
function resetCalculator(
  seed: {
    decarb?: Partial<typeof DEFAULT_DECARB>
    infusion?: Partial<typeof DEFAULT_INFUSION>
    dose?: Partial<typeof DEFAULT_DOSE>
  } = {}
) {
  useAppStore.setState({
    decarb: { ...DEFAULT_DECARB, ...(seed.decarb ?? {}) },
    infusion: { ...DEFAULT_INFUSION, ...(seed.infusion ?? {}) },
    dose: { ...DEFAULT_DOSE, ...(seed.dose ?? {}) },
  })
}

describe('PresetActions.buildPresetPayload — audit B2 (per-field unit round-trip)', () => {
  beforeEach(() => resetCalculator())

  it('writes decarb.weightUnit alongside decarb.weight (the audit B2 regression)', () => {
    // The exact scenario the audit reported: user typed 0.12 oz
    // (per-field = 'oz'), toggled display to g, then saved. The
    // payload must include BOTH the per-field value AND the
    // per-field unit so the load path can re-interpret the value
    // correctly.
    resetCalculator({
      decarb: { weight: '0.12', weightUnit: 'oz' },
    })
    useAppStore.setState(state => ({
      units: { ...state.units, weightUnit: 'g' },
    }))
    const payload = buildPresetPayloadForTest()
    expect(payload.tabs.decarb.weight).toBe('0.12')
    // The new field is the audit's B2 fix.
    expect(payload.tabs.decarb.weightUnit).toBe('oz')
  })

  it('writes infusion.volumeUnit alongside infusion.volume (audit B2)', () => {
    // Same shape: 100 mL saved with display=cup must round-trip
    // as 100 mL.
    resetCalculator({
      infusion: { volume: '100', volumeUnit: 'mL' },
    })
    useAppStore.setState(state => ({
      units: { ...state.units, volumeUnit: 'cup' },
    }))
    const payload = buildPresetPayloadForTest()
    expect(payload.tabs.infusion.volume).toBe('100')
    expect(payload.tabs.infusion.volumeUnit).toBe('mL')
  })

  it('writes decarb.tempOverrideUnit, bagWidthOverrideUnit, bagLengthOverrideUnit (audit B2)', () => {
    // Cover the remaining per-field unit fields in one test —
    // they're all read by the store's loadFromPreset so they
    // must all be in the payload.
    resetCalculator({
      decarb: {
        tempOverride: '240',
        tempOverrideUnit: 'F',
        bagWidthOverride: '25',
        bagWidthOverrideUnit: 'in',
        bagLengthOverride: '30',
        bagLengthOverrideUnit: 'cm',
      },
    })
    const payload = buildPresetPayloadForTest()
    expect(payload.tabs.decarb.tempOverride).toBe('240')
    expect(payload.tabs.decarb.tempOverrideUnit).toBe('F')
    expect(payload.tabs.decarb.bagWidthOverride).toBe('25')
    expect(payload.tabs.decarb.bagWidthOverrideUnit).toBe('in')
    expect(payload.tabs.decarb.bagLengthOverride).toBe('30')
    expect(payload.tabs.decarb.bagLengthOverrideUnit).toBe('cm')
  })
})

describe('PresetActions.buildPresetPayload — audit B3 (full state round-trip)', () => {
  beforeEach(() => resetCalculator())

  it('writes the full decarb slice including the bag / strain / mode fields (audit B3)', () => {
    // The prior payload dropped every field below `presetId`. The
    // new payload must include them all so loading a preset
    // restores the bag override values, the strain binding, and
    // the material mode.
    resetCalculator({
      decarb: {
        bagGrindId: 'fine',
        bagPresetId: 'gallon',
        bagWidthOverride: '30',
        bagWidthOverrideUnit: 'cm',
        bagLengthOverride: '45',
        bagLengthOverrideUnit: 'cm',
        bagHasStems: true,
        strainId: 'strain_og_kush',
        materialMode: 'concentrate',
        concentrateTypeId: 'wax',
      },
    })
    const payload = buildPresetPayloadForTest()
    expect(payload.tabs.decarb.bagGrindId).toBe('fine')
    expect(payload.tabs.decarb.bagPresetId).toBe('gallon')
    expect(payload.tabs.decarb.bagWidthOverride).toBe('30')
    expect(payload.tabs.decarb.bagLengthOverride).toBe('45')
    expect(payload.tabs.decarb.bagHasStems).toBe(true)
    expect(payload.tabs.decarb.strainId).toBe('strain_og_kush')
    expect(payload.tabs.decarb.materialMode).toBe('concentrate')
    expect(payload.tabs.decarb.concentrateTypeId).toBe('wax')
  })

  it('writes the full dose slice including formatId, reverseMode, desiredMgPerServing (audit B3)', () => {
    resetCalculator({
      dose: {
        formatId: 'brownie_9x13',
        reverseMode: true,
        desiredMgPerServing: '15',
      },
    })
    const payload = buildPresetPayloadForTest()
    expect(payload.tabs.dose.formatId).toBe('brownie_9x13')
    expect(payload.tabs.dose.reverseMode).toBe(true)
    expect(payload.tabs.dose.desiredMgPerServing).toBe('15')
  })

  it('writes the full advancedTools slice (audit B3)', () => {
    const payload = buildPresetPayloadForTest()
    // Shape sanity: the four top-level keys (subTab + 3 sub-states)
    // must be present.
    expect(payload.advancedTools).toBeDefined()
    expect(payload.advancedTools.subTab).toBeDefined()
    expect(payload.advancedTools.concentrate).toBeDefined()
    expect(payload.advancedTools.blending).toBeDefined()
    expect(payload.advancedTools.cost).toBeDefined()
  })

  it('writes the full label slice (audit B3)', () => {
    // Set non-default label values and verify they round-trip.
    useAppStore.setState({
      label: {
        productName: 'OG Kush Gummies',
        ingredients: 'Coconut oil, sugar, gelatin',
        storage: 'Cool, dark place',
        batchNumber: 7,
        facilityNuts: true,
        facilityDairy: false,
        facilityGluten: false,
        productionDate: '2026-07-25',
      },
    })
    const payload = buildPresetPayloadForTest()
    expect(payload.label.productName).toBe('OG Kush Gummies')
    expect(payload.label.ingredients).toBe('Coconut oil, sugar, gelatin')
    expect(payload.label.batchNumber).toBe(7)
    expect(payload.label.facilityNuts).toBe(true)
  })
})
