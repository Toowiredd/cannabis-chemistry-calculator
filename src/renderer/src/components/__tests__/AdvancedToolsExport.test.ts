import { describe, expect, it } from 'vitest'
import {
  buildExportReport,
  buildTabCopyText,
} from 'renderer/src/utils/exportReport'
import type { AdvancedToolsState } from 'renderer/src/stores/appStore'

const advancedToolsBase: AdvancedToolsState = {
  subTab: 'fats',
  concentrate: {
    concentrateTypeId: 'wax',
    weight: '1.0',
    thcaOverride: '',
    thcOverride: '',
    customEff: '',
  },
  blending: {
    strains: [
      { name: 'Strain A', potency: 18 },
      { name: 'Strain B', potency: 25 },
    ],
    targetWeight: '10',
    targetPotency: '20',
  },
  cost: {
    materialCost: '50',
    weightG: '3.5',
    thcaPct: '20',
    thcPct: '0',
    extractionEff: '0.82',
    targetDose: '10',
    servings: '12',
  },
}

const storeFixture = {
  decarb: {
    weight: '3.5',
    thcaPct: '20',
    thcPct: '0',
    cbdaPct: '0',
    cbdPct: '0',
    presetId: 'oven_sealed',
    tempOverride: null,
    timeOverride: null,
    effLowOverride: null,
    effExpectedOverride: null,
    effHighOverride: null,
    bagExpanded: true,
    bagGrindId: 'medium',
    bagPresetId: 'quart',
    bagWidthOverride: null,
    bagLengthOverride: null,
    bagHasStems: false,
    strainId: null,
    materialMode: 'flower' as const,
    concentrateTypeId: 'wax',
  },
  infusion: {
    decarbedThc: '500',
    volume: '100',
    fatId: 'coconut',
    customEfficiency: '0.82',
  },
  dose: {
    totalThc: '500',
    servings: '10',
    formatId: 'custom',
    reverseMode: false,
    desiredMgPerServing: '10',
  },
  units: {
    tempUnit: 'C' as const,
    weightUnit: 'g' as const,
    volumeUnit: 'mL' as const,
    bagUnit: 'cm' as const,
  },
}

describe('Advanced Tools export behavior', () => {
  it('copies the currently selected advanced sub-tool summary', () => {
    const concentrateCopy = buildTabCopyText('advanced', {
      ...storeFixture,
      advancedTools: {
        ...advancedToolsBase,
        subTab: 'concentrate',
      },
    })
    const blendingCopy = buildTabCopyText('advanced', {
      ...storeFixture,
      advancedTools: {
        ...advancedToolsBase,
        subTab: 'blending',
      },
    })
    const costCopy = buildTabCopyText('advanced', {
      ...storeFixture,
      advancedTools: {
        ...advancedToolsBase,
        subTab: 'cost',
      },
    })

    expect(concentrateCopy).toContain('Advanced Tools: Concentrates')
    expect(blendingCopy).toContain('Advanced Tools: Strain Blending')
    expect(costCopy).toContain('Advanced Tools: Cost Analysis')
  })

  it('includes all advanced sections in the exported report payload', () => {
    const report = buildExportReport({
      ...storeFixture,
      advancedTools: {
        ...advancedToolsBase,
        subTab: 'cost',
      },
      activeTab: 'advanced',
    })

    expect(report.textContent).toContain('Advanced Tools: Concentrates')
    expect(report.textContent).toContain('Advanced Tools: Strain Blending')
    expect(report.textContent).toContain('Advanced Tools: Cost Analysis')

    const json = JSON.parse(report.jsonContent)
    expect(json.tabs.advanced.activeTool).toBe('cost')
    expect(json.tabs.advanced.sections.concentrate.tab).toBe(
      'advanced.concentrate'
    )
    expect(json.tabs.advanced.sections.blending.tab).toBe('advanced.blending')
    expect(json.tabs.advanced.sections.cost.tab).toBe('advanced.cost')
  })
})
