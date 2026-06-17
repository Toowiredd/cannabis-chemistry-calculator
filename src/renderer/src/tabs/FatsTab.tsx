import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateInfusedThc,
  calculateMgPerMl,
} from 'renderer/src/engine/infusion'
import { INFUSION_FATS } from 'renderer/src/engine/models'
import { cupToMl, tbspToMl, tspToMl } from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import { RotateCcw, Loader2 } from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'
import { InputRow } from 'renderer/src/components/InputRow'
import { TooltipIcon } from 'renderer/src/components/TooltipIcon'

/* ------------------------------------------------------------------ */
/* Small helpers (mirroring DecarbTab / InfusionTab patterns)         */
/* ------------------------------------------------------------------ */

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  decarbedThc?: string
  customEfficiency?: string
}

function validateFatsTab(
  decarbedThc: string,
  customEfficiency: string
): { errors: FieldErrors } {
  const errors: FieldErrors = {}

  const dStr = decarbedThc.trim()
  if (dStr === '') {
    errors.decarbedThc = 'We need your decarbed THC amount'
  } else {
    const d = parseFloat(dStr)
    if (Number.isNaN(d)) errors.decarbedThc = 'That does not look like a number'
    else if (d < 0) errors.decarbedThc = 'THC cannot be negative'
  }

  const eStr = customEfficiency.trim()
  if (eStr === '') {
    errors.customEfficiency = 'We need an efficiency value'
  } else {
    const e = parseFloat(eStr)
    if (Number.isNaN(e))
      errors.customEfficiency = 'That does not look like a number'
    else if (e < 0 || e > 1)
      errors.customEfficiency =
        'Efficiency needs to be between 0 and 1 (like 0.85 for 85%)'
  }

  return { errors }
}

/* ------------------------------------------------------------------ */
/* Unit helpers                                                       */
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

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function FatsTab() {
  /* Store bindings */
  const infusion = useAppStore(s => s.infusion)
  const setInfusion = useAppStore(s => s.setInfusion)
  const resetInfusion = useAppStore(s => s.resetInfusion)
  const units = useAppStore(s => s.units)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  /* Local UI state */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [results, setResults] = useState<{
    byFat: Record<
      string,
      {
        infusedThc: number
        mgPerMl: number | null
        extractionEff: number
      }
    >
    bestEffId: string
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  /* ---------------------------------------------------------------- */
  /* Derived helpers                                                  */
  /* ---------------------------------------------------------------- */

  const volumeMl = useMemo(() => {
    return displayVolumeToMl(infusion.volume, units.volumeUnit)
  }, [infusion.volume, units.volumeUnit])

  const hasBlockingErrors = useCallback(
    (errs: FieldErrors) => !!(errs.decarbedThc || errs.customEfficiency),
    []
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const { errors } = validateFatsTab(
        infusion.decarbedThc,
        infusion.customEfficiency
      )

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
          {
            infusedThc: number
            mgPerMl: number | null
            extractionEff: number
          }
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

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleReset = () => {
    resetInfusion()
    setResults(null)
    setFieldErrors({})
  }

  const handleUseThis = (fatId: string) => {
    setInfusion({ fatId })
    setActiveTab('infusion')
  }

  /* ---------------------------------------------------------------- */
  /* Render helpers                                                   */
  /* ---------------------------------------------------------------- */

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Fat Comparison
        </h2>
        <div className="flex items-center gap-2">
          {isCalculating && (
            <span className="inline-flex items-center gap-1 text-xs text-foreground/60">
              <Loader2 className="size-3.5 animate-spin" />
              Calculating&hellip;
            </span>
          )}
          <TabActions tabId="advanced" />
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Shared Input Panel */}
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Shared Input
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <InputRow
            error={fieldErrors.decarbedThc}
            label={
              <>
                Decarbed THC
                <TooltipIcon text="Total decarboxylated THC in milligrams available for infusion. Use the output from the Decarb calculator." />
              </>
            }
          >
            {
              <div className="flex items-center gap-2">
                <input
                  className={cn(
                    'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
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

          {/* Custom efficiency in shared panel for easy override */}
          <InputRow
            error={fieldErrors.customEfficiency}
            label={
              <>
                Custom Fat Efficiency
                <TooltipIcon text="Extraction efficiency for the custom fat. Adjust this to compare custom fats against presets." />
              </>
            }
          >
            {
              <div className="flex items-center gap-2">
                <input
                  className={cn(
                    'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
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

      {/* Fat Grid - 2x2 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {INFUSION_FATS.map(fat => {
          const fatResults = results?.byFat[fat.id]
          const isBest = results?.bestEffId === fat.id
          const isCustom = fat.id === 'custom'

          return (
            <div
              className={cn(
                'flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/5 p-5 transition-colors',
                isBest && 'border-2 border-success/50 bg-success/10'
              )}
              key={fat.id}
            >
              {/* Header row with badge */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  {fat.name}
                </h4>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isBest && (
                    <span className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-success">
                      Best Extraction
                    </span>
                  )}
                </div>
              </div>

              {/* Extraction Efficiency */}
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

              {/* Resulting Final THC */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Final THC
                </span>
                {fatResults ? (
                  <span className="result-bloom text-2xl font-bold text-foreground">
                    {fmt1(fatResults.infusedThc)} mg
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-foreground/70">
                    Enter your decarbed THC and fat volume above to see results
                  </span>
                )}
              </div>

              {/* mg/mL Concentration */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Concentration
                </span>
                {fatResults && fatResults.mgPerMl != null ? (
                  <span className="result-bloom text-2xl font-bold text-success">
                    {fmt1(fatResults.mgPerMl)} mg/mL
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-foreground/70">
                    Enter your decarbed THC and fat volume above to see results
                  </span>
                )}
              </div>

              {/* Simplified Multiplier */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Simplified Multiplier
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {isCustom
                    ? (() => {
                        if (!fatResults) return 'N/A'
                        const eff = fatResults.extractionEff
                        if (eff === 0) return 'N/A'
                        return `x${eff.toFixed(2)}`
                      })()
                    : `x${fat.extractionEff.toFixed(2)}`}
                </span>
              </div>

              {/* Notes (for presets) */}
              {fat.notes && !isCustom && (
                <p className="text-xs leading-relaxed text-foreground/70">
                  {fat.notes}
                </p>
              )}

              {/* Use This */}
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

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, infusion technique, and
        measurement accuracy.
      </p>
    </div>
  )
}
