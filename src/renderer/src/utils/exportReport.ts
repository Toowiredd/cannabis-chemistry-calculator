import type {
  AdvancedToolsState,
  DecarbState,
  InfusionState,
  DoseState,
  UnitPreferences,
} from 'renderer/src/stores/appStore'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
import {
  CONCENTRATE_TYPES,
  calculateConcentrateDecarbedThc,
  calculateConcentrateTheoreticalMax,
} from 'renderer/src/engine/concentrate'
import { calculateBlend } from 'renderer/src/engine/blend'
import {
  calculateCostPerDose,
  compareMethodCosts,
} from 'renderer/src/engine/costAnalysis'
import {
  cToF,
  convertVolume,
  convertWeight,
  fToC,
  ozToG,
  volumeToMl,
} from 'renderer/src/engine/units'
import { fmt1 } from 'renderer/src/engine/formatting'
import { version as appVersion } from '~/package.json'

// fmt1 is the canonical 1-decimal display helper from
// renderer/src/engine/formatting. fmt2 stays local — it's for cost
// display, which is a 2-decimal concern (different precision).
function fmt2(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(2)
}

function displayDate(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function displayTime(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ */
/* Decarb helpers                                                     */
/* ------------------------------------------------------------------ */

function decarbSummary(
  state: DecarbState,
  units: UnitPreferences
): { text: string; data: Record<string, unknown> } {
  const preset = DECARB_METHODS.find(m => m.id === state.presetId)
  // 2026-07-25 ccc workflow-validator audit B3: the per-field
  // units (`state.weightUnit`, `state.tempOverrideUnit`) are the
  // SOURCE OF TRUTH for what unit the stored value is in. The
  // `units.*` slices are display-only and can differ from the
  // per-field unit (e.g. user typed 0.12 oz then toggled display
  // to g). Convention from the 2026-07-25 dose-units refactor
  // ("display converts for read"): the report prints the value
  // CONVERTED to the display unit, with the display unit as the
  // label. The `data` payload records both so downstream
  // consumers can disambiguate.
  const weightUnitField = state.weightUnit
  const tempUnitField = state.tempOverrideUnit
  const displayWeightUnit = units.weightUnit
  const displayTempUnit = units.tempUnit

  const weightFieldRaw = parseFloat(state.weight)
  const weightFieldDisplay = Number.isNaN(weightFieldRaw)
    ? ''
    : weightUnitField === displayWeightUnit
      ? fmt1(weightFieldRaw)
      : fmt1(convertWeight(weightFieldRaw, weightUnitField, displayWeightUnit))

  const tempC = preset?.tempC ?? 0
  // The preset's default temperature is stored in C; display in
  // the user's chosen display unit.
  const presetTempDisplay =
    displayTempUnit === 'F' ? fmt1(cToF(tempC)) : fmt1(tempC)

  const effLow =
    state.effLowOverride != null
      ? parseFloat(state.effLowOverride)
      : (preset?.efficiency.low ?? 0)
  const effExpected =
    state.effExpectedOverride != null
      ? parseFloat(state.effExpectedOverride)
      : (preset?.efficiency.expected ?? 0)
  const effHigh =
    state.effHighOverride != null
      ? parseFloat(state.effHighOverride)
      : (preset?.efficiency.high ?? 0)

  const timeVal =
    state.timeOverride != null
      ? state.timeOverride
      : String(preset?.timeMax ?? '')

  // Compute theoretical max and decarbed values for export. The
  // engine wants grams; convert from the per-field `weightUnit`.
  let theoreticalMax: number | null = null
  let decarbedLow: number | null = null
  let decarbedExpected: number | null = null
  let decarbedHigh: number | null = null
  try {
    const grams =
      weightUnitField === 'oz' ? ozToG(weightFieldRaw) : weightFieldRaw
    const thca = parseFloat(state.thcaPct)
    const thc = parseFloat(state.thcPct)
    if (!Number.isNaN(grams) && !Number.isNaN(thca) && !Number.isNaN(thc)) {
      theoreticalMax = grams * ((thca / 100) * 0.877 + thc / 100) * 1000
      theoreticalMax = Math.round((theoreticalMax + 1e-9) * 10) / 10
      decarbedLow = Math.round((theoreticalMax * effLow + 1e-9) * 10) / 10
      decarbedExpected =
        Math.round((theoreticalMax * effExpected + 1e-9) * 10) / 10
      decarbedHigh = Math.round((theoreticalMax * effHigh + 1e-9) * 10) / 10
    }
  } catch {
    // leave null
  }

  // Temperature override: the stored value is in
  // `state.tempOverrideUnit` (per-field). Display in
  // `displayTempUnit`. If the user overrode 240.1°C then toggled
  // display to °F, the display-side "460" comes from the
  // C↔F math at the report boundary, not from re-storing the value.
  let tempOverrideDisplay: string | null = null
  if (state.tempOverride != null) {
    const raw = parseFloat(state.tempOverride)
    if (!Number.isNaN(raw)) {
      const inC = tempUnitField === 'F' ? fToC(raw) : raw
      tempOverrideDisplay =
        displayTempUnit === 'F' ? fmt1(cToF(inC)) : fmt1(inC)
    } else {
      tempOverrideDisplay = state.tempOverride
    }
  }
  const tempLineValue = tempOverrideDisplay ?? presetTempDisplay

  const lines: string[] = []
  lines.push('--- Decarboxylation ---')
  lines.push(`Material Weight: ${weightFieldDisplay} ${displayWeightUnit}`)
  lines.push(`THCA: ${state.thcaPct}%`)
  lines.push(`Existing THC: ${state.thcPct}%`)
  lines.push(`Method: ${preset?.name ?? state.presetId}`)
  lines.push(`Temperature: ${tempLineValue} ${displayTempUnit}`)
  lines.push(`Time: ${timeVal} min`)
  lines.push(
    `Efficiency: Low ${fmt1(effLow)}, Expected ${fmt1(effExpected)}, High ${fmt1(effHigh)}`
  )
  if (theoreticalMax != null) {
    lines.push(`Theoretical Maximum: ${fmt1(theoreticalMax)} mg`)
    lines.push(
      `Decarb-Adjusted THC: Low ${fmt1(decarbedLow)} mg, Expected ${fmt1(decarbedExpected)} mg, High ${fmt1(decarbedHigh)} mg`
    )
  } else {
    lines.push('Theoretical Maximum: --')
    lines.push('Decarb-Adjusted THC: --')
  }
  if (preset) {
    lines.push(`Terpene Retention: ${preset.terpeneLabel}`)
    lines.push(`CBN Risk: ${preset.cbnLabel}`)
    lines.push(`Oxygen Exposure: ${preset.oxygenLabel}`)
  }
  lines.push('')

  const data = {
    tab: 'decarb',
    inputs: {
      weight: state.weight,
      // Per-field unit is the source of truth for the stored value.
      weightUnit: weightUnitField,
      // Display unit is what the report line was rendered in.
      displayWeightUnit,
      thcaPct: state.thcaPct,
      thcPct: state.thcPct,
      presetId: state.presetId,
      tempOverride: state.tempOverride,
      tempOverrideUnit: tempUnitField,
      displayTempUnit,
      timeOverride: state.timeOverride,
      effLowOverride: state.effLowOverride,
      effExpectedOverride: state.effExpectedOverride,
      effHighOverride: state.effHighOverride,
    },
    preset: preset
      ? {
          name: preset.name,
          tempC: preset.tempC,
          timeMin: preset.timeMin,
          timeMax: preset.timeMax,
          efficiency: preset.efficiency,
          terpeneLabel: preset.terpeneLabel,
          cbnLabel: preset.cbnLabel,
          oxygenLabel: preset.oxygenLabel,
        }
      : null,
    outputs: {
      theoreticalMax,
      decarbedLow,
      decarbedExpected,
      decarbedHigh,
      tempUnit: displayTempUnit,
      timeDisplay: timeVal,
      tempDisplay: tempLineValue,
    },
  }

  return { text: lines.join('\n'), data }
}

/* ------------------------------------------------------------------ */
/* Infusion helpers                                                   */
/* ------------------------------------------------------------------ */

function infusionSummary(
  state: InfusionState,
  units: UnitPreferences
): { text: string; data: Record<string, unknown> } {
  const preset = INFUSION_FATS.find(f => f.id === state.fatId)
  const isCustom = preset?.id === 'custom'
  const eff = isCustom
    ? parseFloat(state.customEfficiency)
    : (preset?.extractionEff ?? 0)

  const decarbedThc = parseFloat(state.decarbedThc)
  const volume = parseFloat(state.volume)
  // 2026-07-25 ccc workflow-validator audit B3: read the per-field
  // `state.volumeUnit` (the unit the user typed the volume in).
  // `units.volumeUnit` is display-only and can differ from the
  // per-field unit.
  const volumeUnitField = state.volumeUnit
  const displayVolumeUnit = units.volumeUnit

  let infusedThc: number | null = null
  let mgPerUnit: number | null = null
  // Convert from the per-field unit to mL for the math. The
  // `volumeToMl` helper is the single canonical entry point — it
  // also throws on an unknown unit (exhaustiveness check), so the
  // old per-unit switch is gone.
  const volumeMl = volumeToMl(volume, volumeUnitField)

  if (!Number.isNaN(decarbedThc) && !Number.isNaN(eff)) {
    infusedThc = Math.round((decarbedThc * eff + 1e-9) * 10) / 10
    if (!Number.isNaN(volumeMl) && volumeMl > 0) {
      const mgPerMl = infusedThc / volumeMl
      // Per the "display converts for read" convention: render
      // the concentration in the DISPLAY volume unit, with the
      // display unit as the label.
      const displayValue = convertVolume(volumeMl, 'mL', displayVolumeUnit)
      const mgPerDisplayUnit = mgPerMl * displayValue
      mgPerUnit = Math.round((mgPerDisplayUnit + 1e-9) * 10) / 10
    }
  }

  // Display the volume in the display unit, with the display unit
  // as the label. The stored value (volume) is in the per-field
  // unit; convert at the report boundary.
  const volumeDisplayValue =
    Number.isNaN(volume) || volumeUnitField === displayVolumeUnit
      ? state.volume
      : convertVolume(volume, volumeUnitField, displayVolumeUnit).toFixed(2)

  const lines: string[] = []
  lines.push('--- Fat Infusion ---')
  lines.push(`Decarbed THC: ${state.decarbedThc} mg`)
  lines.push(`Fat: ${preset?.name ?? state.fatId}`)
  lines.push(
    `Extraction Efficiency: ${isCustom ? state.customEfficiency : String(preset?.extractionEff ?? '')}`
  )
  lines.push(`Volume: ${volumeDisplayValue} ${displayVolumeUnit}`)
  if (infusedThc != null) {
    lines.push(`Total Infused THC: ${fmt1(infusedThc)} mg`)
    lines.push(
      `Concentration: ${mgPerUnit != null ? fmt1(mgPerUnit) : '--'} mg/${displayVolumeUnit}`
    )
  } else {
    lines.push('Total Infused THC: --')
    lines.push('Concentration: --')
  }
  lines.push('')

  const data = {
    tab: 'infusion',
    inputs: {
      decarbedThc: state.decarbedThc,
      fatId: state.fatId,
      volume: state.volume,
      // Per-field unit is the source of truth for the stored value.
      volumeUnit: volumeUnitField,
      // Display unit is what the report line was rendered in.
      displayVolumeUnit,
      customEfficiency: state.customEfficiency,
    },
    preset: preset
      ? {
          name: preset.name,
          extractionEff: preset.extractionEff,
          simplifiedMultiplier: preset.simplifiedMultiplier,
          notes: preset.notes,
        }
      : null,
    outputs: {
      infusedThc,
      mgPerUnit,
      unit: displayVolumeUnit,
    },
  }

  return { text: lines.join('\n'), data }
}

/* ------------------------------------------------------------------ */
/* Dose helpers                                                       */
/* ------------------------------------------------------------------ */

function doseSummary(state: DoseState): {
  text: string
  data: Record<string, unknown>
} {
  const totalThc = parseFloat(state.totalThc)
  const servings = parseFloat(state.servings)

  let mgPerServing: number | null = null
  let classification = ''
  if (!Number.isNaN(totalThc) && !Number.isNaN(servings) && servings > 0) {
    mgPerServing = Math.round((totalThc / servings + 1e-9) * 10) / 10
    if (mgPerServing < 2.5) classification = 'Sub-Microdose'
    else if (mgPerServing < 5) classification = 'Microdose'
    else if (mgPerServing < 10) classification = 'Low Tolerance'
    else if (mgPerServing < 25) classification = 'Moderate'
    else if (mgPerServing < 50) classification = 'Strong'
    else if (mgPerServing < 100) classification = 'Very Strong'
    else classification = 'Extreme'
  }

  const lines: string[] = []
  lines.push('--- Dose Estimation ---')
  lines.push(`Total Infused THC: ${state.totalThc} mg`)
  lines.push(`Servings: ${state.servings}`)
  if (mgPerServing != null) {
    lines.push(`mg per Serving: ${fmt1(mgPerServing)} mg`)
    lines.push(`Classification: ${classification}`)
  } else {
    lines.push('mg per Serving: --')
    lines.push('Classification: --')
  }
  lines.push('')

  const data = {
    tab: 'dose',
    inputs: {
      totalThc: state.totalThc,
      servings: state.servings,
    },
    outputs: {
      mgPerServing,
      classification,
    },
  }

  return { text: lines.join('\n'), data }
}

/* ------------------------------------------------------------------ */
/* Methods comparison helpers                                         */
/* ------------------------------------------------------------------ */

function methodsSummary(
  state: DecarbState,
  units: UnitPreferences
): { text: string; data: Record<string, unknown> } {
  const preset = DECARB_METHODS.find(m => m.id === state.presetId)
  // 2026-07-25 ccc workflow-validator audit B3: per-field unit is
  // the source of truth for the stored value. Render in the
  // display unit (convention: "display converts for read").
  const weightUnitField = state.weightUnit
  const displayWeightUnit = units.weightUnit

  const weightFieldRaw = parseFloat(state.weight)
  const weightFieldDisplay = Number.isNaN(weightFieldRaw)
    ? state.weight
    : weightUnitField === displayWeightUnit
      ? fmt1(weightFieldRaw)
      : fmt1(convertWeight(weightFieldRaw, weightUnitField, displayWeightUnit))

  const lines: string[] = []
  lines.push('--- Method Comparison ---')
  lines.push(`Material Weight: ${weightFieldDisplay} ${displayWeightUnit}`)
  lines.push(`THCA: ${state.thcaPct}%`)
  lines.push(`Existing THC: ${state.thcPct}%`)
  lines.push(`Selected Method: ${preset?.name ?? state.presetId}`)
  lines.push('')

  const data = {
    tab: 'methods',
    inputs: {
      weight: state.weight,
      weightUnit: weightUnitField,
      displayWeightUnit,
      thcaPct: state.thcaPct,
      thcPct: state.thcPct,
      presetId: state.presetId,
    },
    outputs: {
      selectedMethod: preset?.name ?? state.presetId,
    },
  }

  return { text: lines.join('\n'), data }
}

/* ------------------------------------------------------------------ */
/* Fat comparison helpers                                             */
/* ------------------------------------------------------------------ */

function fatsSummary(
  state: InfusionState,
  units: UnitPreferences
): { text: string; data: Record<string, unknown> } {
  const preset = INFUSION_FATS.find(f => f.id === state.fatId)
  // 2026-07-25 ccc workflow-validator audit B3: per-field unit is
  // the source of truth for the stored value. Render in the
  // display unit.
  const volumeUnitField = state.volumeUnit
  const displayVolumeUnit = units.volumeUnit

  const volume = parseFloat(state.volume)
  const volumeDisplayValue =
    Number.isNaN(volume) || volumeUnitField === displayVolumeUnit
      ? state.volume
      : convertVolume(volume, volumeUnitField, displayVolumeUnit).toFixed(2)

  const lines: string[] = []
  lines.push('--- Fat Comparison ---')
  lines.push(`Decarbed THC: ${state.decarbedThc} mg`)
  lines.push(`Selected Fat: ${preset?.name ?? state.fatId}`)
  lines.push(`Volume: ${volumeDisplayValue} ${displayVolumeUnit}`)
  lines.push('')

  const data = {
    tab: 'advanced',
    inputs: {
      decarbedThc: state.decarbedThc,
      fatId: state.fatId,
      volume: state.volume,
      volumeUnit: volumeUnitField,
      displayVolumeUnit,
    },
    outputs: {
      selectedFat: preset?.name ?? state.fatId,
    },
  }

  return { text: lines.join('\n'), data }
}

function concentrateSummary(state: AdvancedToolsState['concentrate']): {
  text: string
  data: Record<string, unknown>
} {
  const preset =
    CONCENTRATE_TYPES.find(c => c.id === state.concentrateTypeId) ??
    CONCENTRATE_TYPES[0]
  const thcaPct = state.thcaOverride.trim()
    ? parseFloat(state.thcaOverride)
    : preset.typicalThcaPct
  const thcPct = state.thcOverride.trim()
    ? parseFloat(state.thcOverride)
    : preset.typicalThcPct
  const customEff = state.customEff.trim() ? parseFloat(state.customEff) : null

  let theoreticalMax: number | null = null
  let decarbed: number | null = null
  let range: { low: number; expected: number; high: number } | null = null
  let needsDecarb = preset.needsDecarb

  try {
    const weight = parseFloat(state.weight)
    if (!Number.isNaN(weight) && weight > 0) {
      theoreticalMax = calculateConcentrateTheoreticalMax(
        weight,
        thcaPct,
        thcPct
      )
      if (preset.needsDecarb) {
        const expectedEff = customEff ?? preset.decarbEfficiency.expected
        decarbed = calculateConcentrateDecarbedThc(theoreticalMax, expectedEff)
        range = {
          low: calculateConcentrateDecarbedThc(
            theoreticalMax,
            preset.decarbEfficiency.low
          ),
          expected: calculateConcentrateDecarbedThc(
            theoreticalMax,
            preset.decarbEfficiency.expected
          ),
          high: calculateConcentrateDecarbedThc(
            theoreticalMax,
            preset.decarbEfficiency.high
          ),
        }
      } else {
        decarbed = theoreticalMax
        range = {
          low: theoreticalMax,
          expected: theoreticalMax,
          high: theoreticalMax,
        }
      }
    }
  } catch {
    theoreticalMax = null
    decarbed = null
    range = null
    needsDecarb = preset.needsDecarb
  }

  const lines: string[] = []
  lines.push('--- Advanced Tools: Concentrates ---')
  lines.push(`Type: ${preset.name}`)
  lines.push(`Weight: ${state.weight} g`)
  lines.push(`THCA: ${fmt1(thcaPct)}%`)
  lines.push(`Existing THC: ${fmt1(thcPct)}%`)
  lines.push(
    `Decarb: ${needsDecarb ? `Required (${preset.decarbGuidance})` : `Not required (${preset.decarbGuidance})`}`
  )
  if (customEff != null) {
    lines.push(`Efficiency Override: ${fmt1(customEff)}`)
  }
  if (theoreticalMax != null && decarbed != null && range != null) {
    lines.push(`Theoretical Maximum: ${fmt1(theoreticalMax)} mg`)
    lines.push(
      needsDecarb
        ? `Post-Decarb THC: ${fmt1(decarbed)} mg (range ${fmt1(range.low)}-${fmt1(range.high)} mg)`
        : `Active THC: ${fmt1(decarbed)} mg`
    )
  } else {
    lines.push('Theoretical Maximum: --')
    lines.push('Post-Decarb THC: --')
  }
  lines.push('')

  return {
    text: lines.join('\n'),
    data: {
      tab: 'advanced.concentrate',
      inputs: state,
      preset: {
        id: preset.id,
        name: preset.name,
        typicalThcaPct: preset.typicalThcaPct,
        typicalThcPct: preset.typicalThcPct,
        needsDecarb: preset.needsDecarb,
        decarbGuidance: preset.decarbGuidance,
        decarbEfficiency: preset.decarbEfficiency,
      },
      outputs: {
        theoreticalMax,
        decarbed,
        range,
      },
    },
  }
}

function blendingSummary(state: AdvancedToolsState['blending']): {
  text: string
  data: Record<string, unknown>
} {
  let result: ReturnType<typeof calculateBlend> | null = null
  let error: string | null = null

  try {
    const totalWeight = parseFloat(state.targetWeight)
    const targetPotency = parseFloat(state.targetPotency)
    if (!Number.isNaN(totalWeight) && totalWeight > 0) {
      result = calculateBlend(state.strains, totalWeight, targetPotency)
      if (!result.isAchievable) {
        const mins = Math.min(...state.strains.map(s => s.potency))
        const maxs = Math.max(...state.strains.map(s => s.potency))
        error =
          `Target ${targetPotency}% is outside range (${mins}%-${maxs}%). ` +
          `Closest achievable: ${result.actualPotency}%.`
      }
    }
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : 'Blend failed'
  }

  const lines: string[] = []
  lines.push('--- Advanced Tools: Strain Blending ---')
  lines.push(
    `Target: ${state.targetWeight} g at ${state.targetPotency}% potency`
  )
  lines.push(
    `Strains: ${state.strains.map(s => `${s.name} (${fmt1(s.potency)}%)`).join(', ')}`
  )
  if (result) {
    lines.push(
      `Actual Potency: ${fmt1(result.actualPotency)}% for ${fmt1(result.totalWeight)} g`
    )
    lines.push(
      `Blend: ${result.results
        .filter(entry => entry.weightGrams > 0)
        .map(entry => `${entry.name} ${fmt1(entry.weightGrams)} g`)
        .join(', ')}`
    )
  } else {
    lines.push('Actual Potency: --')
  }
  if (error) {
    lines.push(`Note: ${error}`)
  }
  lines.push('')

  return {
    text: lines.join('\n'),
    data: {
      tab: 'advanced.blending',
      inputs: state,
      outputs: {
        result,
        error,
      },
    },
  }
}

function costSummary(state: AdvancedToolsState['cost']): {
  text: string
  data: Record<string, unknown>
} {
  const methods = DECARB_METHODS.map(method => ({
    id: method.id,
    name: method.name,
    efficiency: method.efficiency.expected,
  }))

  let comparison: ReturnType<typeof compareMethodCosts> | null = null
  let quickCostPerDose: number | null = null

  try {
    const materialCost = parseFloat(state.materialCost)
    const weightG = parseFloat(state.weightG)
    const thcaPct = parseFloat(state.thcaPct)
    const thcPct = parseFloat(state.thcPct)
    const extractionEff = parseFloat(state.extractionEff)
    const targetDose = parseFloat(state.targetDose)
    if (
      !Number.isNaN(materialCost) &&
      !Number.isNaN(weightG) &&
      !Number.isNaN(thcaPct) &&
      !Number.isNaN(extractionEff) &&
      !Number.isNaN(targetDose) &&
      weightG > 0 &&
      targetDose > 0
    ) {
      comparison = compareMethodCosts(
        materialCost,
        weightG,
        thcaPct,
        thcPct,
        methods,
        extractionEff,
        targetDose
      )
      const servings = parseFloat(state.servings)
      if (!Number.isNaN(servings) && servings > 0) {
        quickCostPerDose = calculateCostPerDose(materialCost, servings)
      }
    }
  } catch {
    comparison = null
    quickCostPerDose = null
  }

  const cheapest = comparison?.find(entry => !entry.zeroYield) ?? null

  const lines: string[] = []
  lines.push('--- Advanced Tools: Cost Analysis ---')
  lines.push(`Material Cost: $${state.materialCost}`)
  lines.push(`Weight: ${state.weightG} g`)
  lines.push(`THCA: ${state.thcaPct}%`)
  lines.push(`Existing THC: ${state.thcPct}%`)
  lines.push(`Extraction Efficiency: ${state.extractionEff}`)
  lines.push(`Target Dose: ${state.targetDose} mg`)
  if (quickCostPerDose != null) {
    lines.push(`Quick Cost per Dose: $${fmt2(quickCostPerDose)}`)
  }
  if (cheapest) {
    lines.push(
      `Cheapest Viable Method: ${cheapest.methodName} at $${fmt2(cheapest.costPerDose)}/dose`
    )
  } else {
    lines.push('Cheapest Viable Method: --')
  }
  lines.push('')

  return {
    text: lines.join('\n'),
    data: {
      tab: 'advanced.cost',
      inputs: state,
      outputs: {
        quickCostPerDose,
        comparison,
      },
    },
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export interface ExportData {
  defaultFileName: string
  textContent: string
  jsonContent: string
}

export function buildExportReport(store: {
  decarb: DecarbState
  infusion: InfusionState
  dose: DoseState
  advancedTools: AdvancedToolsState
  units: UnitPreferences
  activeTab: string
}): ExportData {
  const date = displayDate()
  const timestamp = displayTime()

  const dec = decarbSummary(store.decarb, store.units)
  const inf = infusionSummary(store.infusion, store.units)
  const d = doseSummary(store.dose)
  const m = methodsSummary(store.decarb, store.units)
  const f = fatsSummary(store.infusion, store.units)
  const concentrate = concentrateSummary(store.advancedTools.concentrate)
  const blending = blendingSummary(store.advancedTools.blending)
  const cost = costSummary(store.advancedTools.cost)

  const textParts: string[] = []
  textParts.push('============================================================')
  textParts.push(
    ' Cannabis Chemistry Calculator -- Export Report               '
  )
  textParts.push('============================================================')
  textParts.push(`Exported: ${timestamp}`)
  textParts.push('')
  textParts.push(
    'Disclaimer: Estimates are heuristic approximations, not laboratory results.'
  )
  textParts.push('')
  textParts.push(dec.text)
  textParts.push(inf.text)
  textParts.push(d.text)
  textParts.push(m.text)
  textParts.push(f.text)
  textParts.push(concentrate.text)
  textParts.push(blending.text)
  textParts.push(cost.text)
  textParts.push('============================================================')
  textParts.push(' End of Report                                              ')
  textParts.push('============================================================')

  const jsonObj = {
    app: 'Cannabis Chemistry Calculator',
    version: appVersion,
    exportedAt: timestamp,
    units: store.units,
    tabs: {
      decarb: dec.data,
      infusion: inf.data,
      dose: d.data,
      methods: m.data,
      fats: f.data,
      advanced: {
        tab: 'advanced',
        activeTool: store.advancedTools.subTab,
        sections: {
          fats: f.data,
          concentrate: concentrate.data,
          blending: blending.data,
          cost: cost.data,
        },
      },
    },
  }

  return {
    defaultFileName: `cannabis-calc-report-${date}.txt`,
    textContent: textParts.join('\n'),
    jsonContent: JSON.stringify(jsonObj, null, 2),
  }
}

export function buildTabCopyText(
  tabId: string,
  store: {
    decarb: DecarbState
    infusion: InfusionState
    dose: DoseState
    advancedTools: AdvancedToolsState
    units: UnitPreferences
  }
): string {
  switch (tabId) {
    case 'decarb':
      return decarbSummary(store.decarb, store.units).text
    case 'infusion':
      return infusionSummary(store.infusion, store.units).text
    case 'dose':
      return doseSummary(store.dose).text
    case 'methods':
      return methodsSummary(store.decarb, store.units).text
    case 'advanced': {
      switch (store.advancedTools.subTab) {
        case 'fats':
          return fatsSummary(store.infusion, store.units).text
        case 'concentrate':
          return concentrateSummary(store.advancedTools.concentrate).text
        case 'blending':
          return blendingSummary(store.advancedTools.blending).text
        case 'cost':
          return costSummary(store.advancedTools.cost).text
      }
      return 'No data available for this tab.'
    }
    default:
      return 'No data available for this tab.'
  }
}
