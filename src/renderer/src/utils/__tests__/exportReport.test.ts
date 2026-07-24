/**
 * exportReport — audit-fix regression tests for the 2026-07-25
 * ccc workflow-validator B3 fix.
 *
 * Coverage:
 * - Decarb summary: material weight line uses the per-field unit
 *   (`state.weightUnit`) as the source of truth for the value
 *   and the display unit (`units.weightUnit`) as the label, with
 *   the value converted to the display unit. Pre-fix the code
 *   read `units.weightUnit` for BOTH the value interpretation
 *   and the label, so a user who typed 0.12 oz (per-field) with
 *   display=g saw the report as "0.12 g" — three orders of
 *   magnitude off. Post-fix the same scenario shows "3.40 g"
 *   (the converted value with the g label).
 * - Decarb summary: temperature line uses the per-field unit
 *   (`state.tempOverrideUnit`) for the value, with the display
 *   unit (`units.tempUnit`) as the label, after C↔F conversion
 *   at the report boundary.
 * - Infusion summary: volume line uses the per-field unit
 *   (`state.volumeUnit`) and the display unit (`units.volumeUnit`)
 *   with display conversion.
 * - Methods summary: same per-field weight behavior.
 * - Fats summary: same per-field volume behavior.
 */
import { describe, expect, it } from 'vitest'

import { buildExportReport } from '../exportReport'
import {
  DEFAULT_ADVANCED_TOOLS,
  DEFAULT_DECARB,
  DEFAULT_DOSE,
  DEFAULT_INFUSION,
  type AdvancedToolsState,
  type DecarbState,
  type DoseState,
  type InfusionState,
  type UnitPreferences,
} from '../../stores/appStore'

/**
 * The store has no exported `DEFAULT_UNITS` constant (the default
 * lives inside the `set` callback at appStore.ts:558-563). The
 * test mirrors it here so the seed state starts in a known
 * per-field=display configuration.
 */
const DEFAULT_UNITS: UnitPreferences = {
  tempUnit: 'C',
  weightUnit: 'g',
  volumeUnit: 'mL',
  bagUnit: 'cm',
}

/** Minimal state shape the export function expects. */
function makeStore(
  overrides: {
    decarb?: Partial<DecarbState>
    infusion?: Partial<InfusionState>
    dose?: Partial<DoseState>
    units?: Partial<UnitPreferences>
    advancedTools?: Partial<AdvancedToolsState>
  } = {}
) {
  return {
    decarb: { ...DEFAULT_DECARB, ...(overrides.decarb ?? {}) },
    infusion: { ...DEFAULT_INFUSION, ...(overrides.infusion ?? {}) },
    dose: { ...DEFAULT_DOSE, ...(overrides.dose ?? {}) },
    units: { ...DEFAULT_UNITS, ...(overrides.units ?? {}) },
    advancedTools: {
      ...DEFAULT_ADVANCED_TOOLS,
      ...(overrides.advancedTools ?? {}),
    },
    activeTab: 'decarb',
  }
}

describe('exportReport — audit B3 (per-field units, not display units)', () => {
  it('Decarb summary: weight=0.12, per-field=oz, display=g → report shows the converted value with the display unit', () => {
    // 0.12 oz = 3.40 g (2 dp). Pre-fix the report said "0.12 g"
    // because it read `units.weightUnit` for both interpretation
    // and label. Post-fix the value is converted to g and the
    // label is g.
    const exportData = buildExportReport(
      makeStore({
        decarb: { weight: '0.12', weightUnit: 'oz' },
        units: { weightUnit: 'g' },
      })
    )
    expect(exportData.textContent).toMatch(/Material Weight: 3\.4 g/)
    // Pre-fix would have written "0.12 g" — assert the post-fix
    // value is present and the buggy value is gone.
    expect(exportData.textContent).not.toMatch(/Material Weight: 0\.12 g/)
  })

  it('Decarb summary: weight=3.5, per-field=g, display=oz → report shows the converted value with the display unit', () => {
    // Mirror of the previous test in the opposite direction. The
    // user typed 3.5 g and toggled display to oz; the report must
    // say "0.12 oz" (3.5 / 28.3495 = 0.1234 → 0.12) — NOT "3.5 oz".
    const exportData = buildExportReport(
      makeStore({
        decarb: { weight: '3.5', weightUnit: 'g' },
        units: { weightUnit: 'oz' },
      })
    )
    expect(exportData.textContent).toMatch(/Material Weight: 0\.12 oz/)
    expect(exportData.textContent).not.toMatch(/Material Weight: 3\.5 oz/)
  })

  it('Decarb summary: tempOverride=240, per-field=F, display=C → report shows the converted value with the display unit', () => {
    // 240 °F = 115.6 °C (rounded to 1 dp). The pre-fix code wrote
    // "240 C" — both wrong value and wrong unit. Post-fix writes
    // "115.6 C" (the C-equivalent of the 240 °F value with the
    // °C label).
    const exportData = buildExportReport(
      makeStore({
        decarb: { tempOverride: '240', tempOverrideUnit: 'F' },
        units: { tempUnit: 'C' },
      })
    )
    expect(exportData.textContent).toMatch(/Temperature: 115\.6 C/)
    expect(exportData.textContent).not.toMatch(/Temperature: 240 C/)
  })

  it('Infusion summary: volume=100, per-field=mL, display=cup → report shows the converted value with the display unit', () => {
    // 100 mL = 0.42 cup (2 dp). Pre-fix the report said "100 cup"
    // because it read `units.volumeUnit` for both. Post-fix writes
    // "0.42 cup".
    const exportData = buildExportReport(
      makeStore({
        infusion: { volume: '100', volumeUnit: 'mL' },
        units: { volumeUnit: 'cup' },
      })
    )
    // The Infusion section is its own block — find the
    // "Volume:" line inside the Fat Infusion section.
    const infusionBlock =
      exportData.textContent.split('--- Fat Infusion ---')[1] ?? ''
    expect(infusionBlock).toMatch(/Volume: 0\.42 cup/)
    expect(infusionBlock).not.toMatch(/Volume: 100 cup/)
  })

  it('Methods summary: weight=0.12, per-field=oz, display=g → report shows the converted value with the display unit', () => {
    const exportData = buildExportReport(
      makeStore({
        decarb: { weight: '0.12', weightUnit: 'oz' },
        units: { weightUnit: 'g' },
      })
    )
    const methodsBlock =
      exportData.textContent.split('--- Method Comparison ---')[1] ?? ''
    expect(methodsBlock).toMatch(/Material Weight: 3\.4 g/)
    expect(methodsBlock).not.toMatch(/Material Weight: 0\.12 g/)
  })

  it('Fats summary: volume=100, per-field=mL, display=cup → report shows the converted value with the display unit', () => {
    const exportData = buildExportReport(
      makeStore({
        infusion: { volume: '100', volumeUnit: 'mL' },
        units: { volumeUnit: 'cup' },
      })
    )
    const fatsBlock =
      exportData.textContent.split('--- Fat Comparison ---')[1] ?? ''
    expect(fatsBlock).toMatch(/Volume: 0\.42 cup/)
    expect(fatsBlock).not.toMatch(/Volume: 100 cup/)
  })

  it('JSON `data` payload records BOTH per-field and display units (audit contract)', () => {
    // The audit's B3 fix is a contract: the JSON output records
    // both `weightUnit` (per-field) and `displayWeightUnit` (the
    // report's display unit) so a downstream consumer can
    // disambiguate. Assert both fields exist on the decarb block.
    const exportData = buildExportReport(
      makeStore({
        decarb: { weight: '3.5', weightUnit: 'g' },
        units: { weightUnit: 'oz' },
      })
    )
    const json = JSON.parse(exportData.jsonContent)
    const decarb = json.tabs.decarb
    expect(decarb.inputs.weightUnit).toBe('g')
    expect(decarb.inputs.displayWeightUnit).toBe('oz')
  })
})
