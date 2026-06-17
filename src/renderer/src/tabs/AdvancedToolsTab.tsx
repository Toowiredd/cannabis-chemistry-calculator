import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAppStore,
  type AdvancedToolSubTab,
} from 'renderer/src/stores/appStore'
import {
  calculateInfusedThc,
  calculateMgPerMl,
} from 'renderer/src/engine/infusion'
import {
  CONCENTRATE_TYPES,
  calculateConcentrateTheoreticalMax,
  calculateConcentrateDecarbedThc,
} from 'renderer/src/engine/concentrate'
import { calculateBlend, type BlendStrain } from 'renderer/src/engine/blend'
import {
  compareMethodCosts,
  calculateCostPerDose,
  type ComparisonMethod,
} from 'renderer/src/engine/costAnalysis'
import {
  INFUSION_FATS,
  DECARB_METHODS,
  type EfficiencyRange,
} from 'renderer/src/engine/models'
import { cupToMl, tbspToMl, tspToMl } from 'renderer/src/engine/units'
import {
  fatCompareInputSchema,
  zodIssuesToFieldErrors,
} from 'renderer/src/engine/schemas'
import { cn } from 'renderer/lib/utils'
import {
  RotateCcw,
  Loader2,
  Beaker,
  Layers,
  TrendingUp,
  Droplets,
  Plus,
  Trash2,
} from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'
import { InputRow } from 'renderer/src/components/InputRow'
import { TooltipIcon } from 'renderer/src/components/TooltipIcon'

/* ------------------------------------------------------------------ */
/* Sub-nav types                                                       */
/* ------------------------------------------------------------------ */

const SUB_TABS: {
  key: AdvancedToolSubTab
  label: string
  icon: typeof Droplets
}[] = [
  { key: 'fats', label: 'Fat Comparison', icon: Droplets },
  { key: 'concentrate', label: 'Concentrates', icon: Beaker },
  { key: 'blending', label: 'Strain Blending', icon: Layers },
  { key: 'cost', label: 'Cost Analysis', icon: TrendingUp },
]

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

function fmt2(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(2)
}

function _round1n(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

/* ------------------------------------------------------------------ */
/* Unit helpers                                                        */
/* ------------------------------------------------------------------ */

function displayVolumeToMl(
  value: string,
  unit: 'mL' | 'tsp' | 'tbsp' | 'cup'
): number {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return NaN
  switch (unit) {
    case 'mL':
      return n
    case 'tsp':
      return tspToMl(n)
    case 'tbsp':
      return tbspToMl(n)
    case 'cup':
      return cupToMl(n)
  }
}

/* ================================================================== */
/* FAT COMPARISON                                                      */
/* ================================================================== */

function FatsSection() {
  const infusion = useAppStore(s => s.infusion)
  const setInfusion = useAppStore(s => s.setInfusion)
  const units = useAppStore(s => s.units)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const [fieldErrors, setFieldErrors] = useState<{
    decarbedThc?: string
    customEfficiency?: string
  }>({})
  const [results, setResults] = useState<{
    byFat: Record<
      string,
      { infusedThc: number; mgPerMl: number | null; extractionEff: number }
    >
    bestEffId: string
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const volumeMl = useMemo(
    () => displayVolumeToMl(infusion.volume, units.volumeUnit),
    [infusion.volume, units.volumeUnit]
  )

  const hasBlockingErrors = useCallback(
    (errs: typeof fieldErrors) => !!(errs.decarbedThc || errs.customEfficiency),
    []
  )

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const schemaResult = fatCompareInputSchema.safeParse({
        decarbedThc: infusion.decarbedThc,
        customEfficiency: infusion.customEfficiency,
      })
      const errors: typeof fieldErrors = !schemaResult.success
        ? zodIssuesToFieldErrors(schemaResult.error.issues)
        : {}
      setFieldErrors(errors)
      if (hasBlockingErrors(errors)) {
        setResults(null)
        setIsCalculating(false)
        return
      }
      try {
        const decarbedThc = parseFloat(infusion.decarbedThc)
        const customEff = parseFloat(infusion.customEfficiency)
        const byFat: Record<
          string,
          { infusedThc: number; mgPerMl: number | null; extractionEff: number }
        > = {}
        let bestEffId = INFUSION_FATS[0].id
        let bestEffValue = -1
        for (const fat of INFUSION_FATS) {
          const eff = fat.id === 'custom' ? customEff : fat.extractionEff
          const infusedThc = calculateInfusedThc(decarbedThc, eff)
          let mgPerMl: number | null = null
          if (!Number.isNaN(volumeMl) && volumeMl > 0) {
            mgPerMl = calculateMgPerMl(infusedThc, volumeMl)
          }
          byFat[fat.id] = { infusedThc, mgPerMl, extractionEff: eff }
          if (eff > bestEffValue) {
            bestEffValue = eff
            bestEffId = fat.id
          }
        }
        setResults({ byFat, bestEffId })
      } catch {
        setResults(null)
      }
      setIsCalculating(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [
    infusion.decarbedThc,
    infusion.customEfficiency,
    infusion.volume,
    units.volumeUnit,
    volumeMl,
    hasBlockingErrors,
  ])

  const handleUseThis = (fatId: string) => {
    setInfusion({ fatId })
    setActiveTab('infusion')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Shared Input
          </h3>
          {isCalculating && (
            <span className="inline-flex items-center gap-1 text-xs text-foreground/60">
              <Loader2 className="size-3.5 animate-spin" />
              Calculating&hellip;
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputRow
            error={fieldErrors.decarbedThc}
            label={
              <>
                Decarbed THC
                <TooltipIcon text="Total decarboxylated THC in milligrams available for infusion." />
              </>
            }
          >
            {
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    fieldErrors.decarbedThc
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
                  )}
                  onChange={e => setInfusion({ decarbedThc: e.target.value })}
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={infusion.decarbedThc}
                />
                <span className="text-sm text-foreground/70">mg</span>
              </div>
            }
          </InputRow>
          <InputRow
            error={fieldErrors.customEfficiency}
            label={
              <>
                Custom Fat Efficiency
                <TooltipIcon text="Extraction efficiency for the custom fat." />
              </>
            }
          >
            {
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    fieldErrors.customEfficiency
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-warning/60 focus:border-warning'
                  )}
                  max={1}
                  min={0}
                  onChange={e =>
                    setInfusion({ customEfficiency: e.target.value })
                  }
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={infusion.customEfficiency}
                />
                <span className="text-sm text-foreground/70">ratio</span>
              </div>
            }
          </InputRow>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {INFUSION_FATS.map(fat => {
          const fatResults = results?.byFat[fat.id]
          const isBest = results?.bestEffId === fat.id
          const isCustom = fat.id === 'custom'
          return (
            <div
              className={cn(
                'flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-5 transition-colors',
                isBest && 'border-2 border-success/50 bg-success/10'
              )}
              key={fat.id}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  {fat.name}
                </h4>
                {isBest && (
                  <span className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-success">
                    Best Extraction
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Extraction Efficiency
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {Math.round(
                    (fatResults?.extractionEff ?? fat.extractionEff) * 100
                  )}
                  %
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Final THC
                </span>
                {fatResults ? (
                  <span className="text-2xl font-bold text-foreground">
                    {fmt1(fatResults.infusedThc)} mg
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-foreground/70">
                    Enter values above to see results
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Concentration
                </span>
                {fatResults && fatResults.mgPerMl != null ? (
                  <span className="text-2xl font-bold text-success">
                    {fmt1(fatResults.mgPerMl)} mg/mL
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-foreground/70">
                    Enter values above to see results
                  </span>
                )}
              </div>
              {fat.notes && !isCustom && (
                <p className="text-xs leading-relaxed text-foreground/70">
                  {fat.notes}
                </p>
              )}
              <button
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={() => handleUseThis(fat.id)}
                type="button"
              >
                Use This
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/* CONCENTRATES                                                        */
/* ================================================================== */

function ConcentrateSection() {
  const setDecarb = useAppStore(s => s.setDecarb)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const concentrate = useAppStore(s => s.advancedTools.concentrate)
  const setAdvancedConcentrate = useAppStore(s => s.setAdvancedConcentrate)
  const [results, setResults] = useState<{
    theoreticalMax: number
    decarbed: number
    range: EfficiencyRange
    needsDecarb: boolean
    guidance: string
  } | null>(null)
  const [errors, setErrors] = useState<{ weight?: string }>({})

  const cType = useMemo(
    () =>
      CONCENTRATE_TYPES.find(c => c.id === concentrate.concentrateTypeId) ??
      CONCENTRATE_TYPES[0],
    [concentrate.concentrateTypeId]
  )
  const thcaPct = concentrate.thcaOverride.trim()
    ? parseFloat(concentrate.thcaOverride)
    : cType.typicalThcaPct
  const thcPct = concentrate.thcOverride.trim()
    ? parseFloat(concentrate.thcOverride)
    : cType.typicalThcPct
  const isCustomEff = concentrate.customEff.trim() !== ''

  useEffect(() => {
    const timer = setTimeout(() => {
      const errs: typeof errors = {}
      const wStr = concentrate.weight.trim()
      if (!wStr) errs.weight = 'Enter a weight'
      else {
        const w = parseFloat(wStr)
        if (Number.isNaN(w)) errs.weight = 'Not a number'
        else if (w <= 0) errs.weight = 'Must be positive'
      }
      setErrors(errs)
      if (errs.weight) {
        setResults(null)
        return
      }
      try {
        const g = parseFloat(concentrate.weight)
        const tMax = calculateConcentrateTheoreticalMax(g, thcaPct, thcPct)
        const eff = isCustomEff
          ? parseFloat(concentrate.customEff) || cType.decarbEfficiency.expected
          : cType.decarbEfficiency.expected
        if (cType.needsDecarb) {
          const decarbed = calculateConcentrateDecarbedThc(tMax, eff)
          const range = {
            low: calculateConcentrateDecarbedThc(
              tMax,
              cType.decarbEfficiency.low
            ),
            expected: calculateConcentrateDecarbedThc(
              tMax,
              cType.decarbEfficiency.expected
            ),
            high: calculateConcentrateDecarbedThc(
              tMax,
              cType.decarbEfficiency.high
            ),
          }
          setResults({
            theoreticalMax: tMax,
            decarbed,
            range,
            needsDecarb: true,
            guidance: cType.decarbGuidance,
          })
        } else {
          setResults({
            theoreticalMax: tMax,
            decarbed: tMax,
            range: { low: tMax, expected: tMax, high: tMax },
            needsDecarb: false,
            guidance: cType.decarbGuidance,
          })
        }
      } catch {
        setResults(null)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [
    concentrate.weight,
    thcaPct,
    thcPct,
    cType,
    isCustomEff,
    concentrate.customEff,
  ])

  const handleUseThis = () => {
    setDecarb({
      materialMode: 'concentrate',
      concentrateTypeId: cType.id,
      weight: concentrate.weight,
      thcaPct: String(thcaPct),
      thcPct: String(thcPct),
      presetId: cType.needsDecarb ? 'oven_sealed' : 'distillate',
      effExpectedOverride: isCustomEff
        ? concentrate.customEff
        : String(cType.decarbEfficiency.expected),
    })
    setActiveTab('decarb')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Concentrate Calculator
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InputRow
            label={
              <>
                Concentrate Type
                <TooltipIcon text="Select your concentrate. Each has different typical potencies and decarb requirements." />
              </>
            }
          >
            {
              <select
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => {
                  setAdvancedConcentrate({
                    concentrateTypeId: e.target.value,
                    thcaOverride: '',
                    thcOverride: '',
                  })
                }}
                value={concentrate.concentrateTypeId}
              >
                {CONCENTRATE_TYPES.map(c => (
                  <option
                    className="bg-card text-foreground"
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            }
          </InputRow>
          <InputRow
            error={errors.weight}
            label={
              <>
                Weight
                <TooltipIcon text="How much concentrate you are working with." />
              </>
            }
          >
            {
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    errors.weight
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
                  )}
                  onChange={e =>
                    setAdvancedConcentrate({ weight: e.target.value })
                  }
                  placeholder="1.0"
                  step="0.1"
                  type="number"
                  value={concentrate.weight}
                />
                <span className="text-sm text-foreground/70">g</span>
              </div>
            }
          </InputRow>
          {cType.needsDecarb ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-warning">
                Needs Decarb
              </span>
              <span className="text-xs text-foreground/70">
                {cType.decarbGuidance}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-success/40 bg-success/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-success">
                Already Active
              </span>
              <span className="text-xs text-foreground/70">
                {cType.decarbGuidance}
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InputRow
            label={
              <>
                THCA % Override
                <TooltipIcon text="Override the typical THCA. Leave blank for preset." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-warning/60 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-warning"
                onChange={e =>
                  setAdvancedConcentrate({ thcaOverride: e.target.value })
                }
                placeholder={`${cType.typicalThcaPct}% (preset)`}
                step="0.1"
                type="number"
                value={concentrate.thcaOverride}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                THC % Override
                <TooltipIcon text="Override the typical THC. Leave blank for preset." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-warning/60 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-warning"
                onChange={e =>
                  setAdvancedConcentrate({ thcOverride: e.target.value })
                }
                placeholder={`${cType.typicalThcPct}% (preset)`}
                step="0.1"
                type="number"
                value={concentrate.thcOverride}
              />
            }
          </InputRow>
          {cType.needsDecarb && (
            <InputRow
              label={
                <>
                  Decarb Efficiency Override
                  <TooltipIcon text="Override the decarb efficiency. Leave blank for preset value." />
                </>
              }
            >
              {
                <input
                  className="rounded-lg border border-warning/60 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-warning"
                  max={1}
                  min={0}
                  onChange={e =>
                    setAdvancedConcentrate({ customEff: e.target.value })
                  }
                  placeholder={`${cType.decarbEfficiency.expected} (preset)`}
                  step="0.01"
                  type="number"
                  value={concentrate.customEff}
                />
              }
            </InputRow>
          )}
        </div>
      </div>
      {results && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Results
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Theoretical Maximum
              </span>
              <span className="result-bloom mt-1 text-2xl font-bold text-foreground">
                {fmt1(results.theoreticalMax)} mg
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                {results.needsDecarb
                  ? 'After Decarb (Expected)'
                  : 'Active THC (Ready)'}
              </span>
              <span className="result-bloom mt-1 text-2xl font-bold text-success">
                {fmt1(results.decarbed)} mg
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Decarb Range
              </span>
              <span className="result-bloom mt-1 text-2xl font-bold text-foreground">
                {results.needsDecarb
                  ? `${fmt1(results.range.low)} \u2013 ${fmt1(results.range.high)} mg`
                  : 'Not needed'}
              </span>
            </div>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground self-start"
            onClick={handleUseThis}
            type="button"
          >
            Apply to Decarb Tab
          </button>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* STRAIN BLENDING                                                     */
/* ================================================================== */

function BlendingSection() {
  const blending = useAppStore(s => s.advancedTools.blending)
  const setAdvancedBlending = useAppStore(s => s.setAdvancedBlending)
  const [results, setResults] = useState<ReturnType<
    typeof calculateBlend
  > | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addStrain = () => {
    const idx = blending.strains.length + 1
    setAdvancedBlending({
      strains: [
        ...blending.strains,
        {
          name: `Strain ${String.fromCharCode(64 + idx)}`,
          potency: 20,
        },
      ],
    })
  }

  const removeStrain = (i: number) => {
    if (blending.strains.length <= 2) return
    setAdvancedBlending({
      strains: blending.strains.filter((_, j) => j !== i),
    })
  }

  const updateStrain = (
    i: number,
    field: 'name' | 'potency',
    value: string
  ) => {
    const next = [...blending.strains]
    if (field === 'potency') {
      const n = parseFloat(value)
      next[i] = { ...next[i], potency: Number.isNaN(n) ? 0 : n }
    } else {
      next[i] = { ...next[i], name: value }
    }
    setAdvancedBlending({ strains: next })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null)
      const tw = parseFloat(blending.targetWeight)
      const tp = parseFloat(blending.targetPotency)
      if (Number.isNaN(tw) || tw <= 0) {
        setResults(null)
        return
      }
      if (Number.isNaN(tp) || tp < 0 || tp > 100) {
        setResults(null)
        return
      }
      try {
        const r = calculateBlend(blending.strains as BlendStrain[], tw, tp)
        setResults(r)
        if (!r.isAchievable) {
          const mins = Math.min(...blending.strains.map(s => s.potency))
          const maxs = Math.max(...blending.strains.map(s => s.potency))
          setError(
            `Target ${tp}% is outside range (${mins}%\u2013${maxs}%). Closest achievable: ${r.actualPotency}%.`
          )
        }
      } catch (err: unknown) {
        setResults(null)
        setError(err instanceof Error ? err.message : 'Blend failed')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [blending.strains, blending.targetWeight, blending.targetPotency])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Strains
          </h3>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={addStrain}
            type="button"
          >
            <Plus className="size-3" />
            Add Strain
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {blending.strains.map((strain, i) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-3"
              key={`${strain.name}-${strain.potency}`}
            >
              <input
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => updateStrain(i, 'name', e.target.value)}
                placeholder="Strain name"
                type="text"
                value={strain.name}
              />
              <div className="flex items-center gap-1">
                <input
                  className="w-20 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                  max={100}
                  min={0}
                  onChange={e => updateStrain(i, 'potency', e.target.value)}
                  step="0.1"
                  type="number"
                  value={strain.potency || ''}
                />
                <span className="text-sm text-foreground/70">%</span>
              </div>
              <button
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 text-foreground/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                disabled={blending.strains.length <= 2}
                onClick={() => removeStrain(i)}
                type="button"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Target
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputRow
            label={
              <>
                Total Weight
                <TooltipIcon text="The total combined weight of all strains in grams." />
              </>
            }
          >
            {
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e =>
                    setAdvancedBlending({ targetWeight: e.target.value })
                  }
                  placeholder="10"
                  step="0.1"
                  type="number"
                  value={blending.targetWeight}
                />
                <span className="text-sm text-foreground/70">g</span>
              </div>
            }
          </InputRow>
          <InputRow
            label={
              <>
                Target Potency
                <TooltipIcon text="The desired weighted-average potency." />
              </>
            }
          >
            {
              <div className="flex min-w-0 items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  max={100}
                  min={0}
                  onChange={e =>
                    setAdvancedBlending({ targetPotency: e.target.value })
                  }
                  placeholder="20"
                  step="0.1"
                  type="number"
                  value={blending.targetPotency}
                />
                <span className="text-sm text-foreground/70">%</span>
              </div>
            }
          </InputRow>
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {error}
        </div>
      )}
      {results?.isAchievable && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Blend Results
          </h3>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Actual Potency
            </span>
            <span className="result-bloom text-lg font-bold text-success">
              {fmt1(results.actualPotency)}%
            </span>
            <span className="text-xs text-foreground/70">
              for {fmt1(results.totalWeight)}g total
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {results.results
              .filter(r => r.weightGrams > 0)
              .map(r => (
                <div
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-4 py-3"
                  key={r.name}
                >
                  <span className="text-sm font-medium text-foreground">
                    {r.name} ({r.potency}%)
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {fmt1(r.weightGrams)} g
                  </span>
                </div>
              ))}
          </div>
          <p className="text-xs text-foreground/70">
            Bracketing algorithm finds two closest strains and solves a
            two-strain linear system. Strains outside the bracket get 0g.
          </p>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* COST ANALYSIS                                                       */
/* ================================================================== */

function CostSection() {
  const cost = useAppStore(s => s.advancedTools.cost)
  const setAdvancedCost = useAppStore(s => s.setAdvancedCost)
  const [results, setResults] = useState<ReturnType<
    typeof compareMethodCosts
  > | null>(null)
  const [costDose, setCostDose] = useState<number | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const methods: ComparisonMethod[] = useMemo(
    () =>
      DECARB_METHODS.map(m => ({
        id: m.id,
        name: m.name,
        efficiency: m.efficiency.expected,
      })),
    []
  )

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const materialCost = parseFloat(cost.materialCost)
      const g = parseFloat(cost.weightG)
      const tPct = parseFloat(cost.thcaPct)
      const hPct = parseFloat(cost.thcPct)
      const eff = parseFloat(cost.extractionEff)
      const dose = parseFloat(cost.targetDose)
      if (
        Number.isNaN(materialCost) ||
        Number.isNaN(g) ||
        Number.isNaN(tPct) ||
        Number.isNaN(eff) ||
        Number.isNaN(dose) ||
        g <= 0 ||
        dose <= 0
      ) {
        setResults(null)
        setCostDose(null)
        setIsCalculating(false)
        return
      }
      try {
        const r = compareMethodCosts(
          materialCost,
          g,
          tPct,
          hPct,
          methods,
          eff,
          dose
        )
        setResults(r)
        const sv = parseFloat(cost.servings)
        if (!Number.isNaN(sv) && sv > 0) {
          setCostDose(calculateCostPerDose(materialCost, sv))
        } else {
          setCostDose(null)
        }
      } catch {
        setResults(null)
        setCostDose(null)
      }
      setIsCalculating(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [
    cost.materialCost,
    cost.weightG,
    cost.thcaPct,
    cost.thcPct,
    cost.extractionEff,
    cost.targetDose,
    cost.servings,
    methods,
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Cost Inputs
          </h3>
          {isCalculating && (
            <span className="inline-flex items-center gap-1 text-xs text-foreground/60">
              <Loader2 className="size-3.5 animate-spin" />
              Calculating&hellip;
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <InputRow
            label={
              <>
                Material Cost ($)
                <TooltipIcon text="What you paid for the starting material." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setAdvancedCost({ materialCost: e.target.value })
                }
                placeholder="50"
                step="0.01"
                type="number"
                value={cost.materialCost}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                Weight (g)
                <TooltipIcon text="How much material in grams." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setAdvancedCost({ weightG: e.target.value })}
                placeholder="3.5"
                step="0.1"
                type="number"
                value={cost.weightG}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                THCA %
                <TooltipIcon text="THCA potency percentage." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e => setAdvancedCost({ thcaPct: e.target.value })}
                placeholder="20"
                step="0.1"
                type="number"
                value={cost.thcaPct}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                Existing THC %
                <TooltipIcon text="Already-active THC percentage." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e => setAdvancedCost({ thcPct: e.target.value })}
                placeholder="0"
                step="0.1"
                type="number"
                value={cost.thcPct}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                Extraction Efficiency
                <TooltipIcon text="Fat extraction efficiency (0.0-1.0)." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                max={1}
                min={0}
                onChange={e =>
                  setAdvancedCost({ extractionEff: e.target.value })
                }
                placeholder="0.82"
                step="0.01"
                type="number"
                value={cost.extractionEff}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                Target mg/Dose
                <TooltipIcon text="How many mg of THC per serving you want." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                min={1}
                onChange={e => setAdvancedCost({ targetDose: e.target.value })}
                placeholder="10"
                step="1"
                type="number"
                value={cost.targetDose}
              />
            }
          </InputRow>
          <InputRow
            label={
              <>
                Servings (quick $/dose)
                <TooltipIcon text="Enter batch size for instant cost-per-dose." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setAdvancedCost({ servings: e.target.value })}
                placeholder="Optional"
                step="1"
                type="number"
                value={cost.servings}
              />
            }
          </InputRow>
        </div>
        {costDose != null && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Quick Cost Per Dose
            </span>
            <span className="result-bloom text-lg font-bold text-success">
              ${fmt2(costDose)}/serving
            </span>
          </div>
        )}
      </div>
      {results && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Method Comparison ({results.filter(r => !r.zeroYield).length}{' '}
            viable)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-foreground/5">
            <table className="min-w-[640px] w-full text-sm text-foreground/80">
              <thead className="border-b border-foreground/10 bg-foreground/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Method
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    THC Yield
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Servings
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    $/Dose
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    $/mg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {results.map(r => (
                  <tr
                    className={cn(
                      'hover:bg-foreground/5',
                      r.zeroYield && 'opacity-40'
                    )}
                    key={r.methodId}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.methodName}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.zeroYield ? '\u2014' : `${fmt1(r.totalThcMg)} mg`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.zeroYield ? '\u2014' : fmt1(r.servings)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-success">
                      {r.zeroYield ? '\u2014' : `$${fmt2(r.costPerDose)}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground/70">
                      {r.zeroYield ? '\u2014' : `$${r.costPerMg.toFixed(3)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* MAIN TAB                                                            */
/* ================================================================== */

export function AdvancedToolsTab() {
  const subTab = useAppStore(s => s.advancedTools.subTab)
  const setAdvancedSubTab = useAppStore(s => s.setAdvancedSubTab)
  const resetAdvancedTools = useAppStore(s => s.resetAdvancedTools)

  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          Advanced Tools
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <TabActions tabId="advanced" />
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={resetAdvancedTools}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            className={cn(
              'flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors',
              key === subTab
                ? 'bg-foreground/15 text-foreground border border-foreground/20'
                : 'bg-foreground/5 text-foreground/70 border border-foreground/10 hover:bg-foreground/10 hover:text-foreground/80'
            )}
            key={key}
            onClick={() => setAdvancedSubTab(key)}
            type="button"
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {subTab === 'fats' && <FatsSection />}
      {subTab === 'concentrate' && <ConcentrateSection />}
      {subTab === 'blending' && <BlendingSection />}
      {subTab === 'cost' && <CostSection />}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results.
      </p>
    </div>
  )
}
