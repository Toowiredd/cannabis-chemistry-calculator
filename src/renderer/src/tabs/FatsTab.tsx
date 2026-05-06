import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateInfusedThc,
  calculateMgPerMl,
} from 'renderer/src/engine/infusion'
import { INFUSION_FATS } from 'renderer/src/engine/models'
import { cupToMl, tbspToMl, tspToMl } from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import { Info, RotateCcw } from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'

/* ------------------------------------------------------------------ */
/* Small helpers (mirroring DecarbTab / InfusionTab patterns)         */
/* ------------------------------------------------------------------ */

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <button
      className="relative inline-flex"
      onBlur={() => setShow(false)}
      onClick={() => setShow(v => !v)}
      onFocus={() => setShow(true)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      type="button"
    >
      <Info className="size-4 shrink-0 cursor-help text-white/50 transition-colors hover:text-white/80" />
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-xl">
          {text}
        </div>
      )}
    </button>
  )
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
    errors.decarbedThc = 'Decarbed THC is required'
  } else {
    const d = parseFloat(dStr)
    if (Number.isNaN(d)) errors.decarbedThc = 'Please enter a number'
    else if (d < 0) errors.decarbedThc = 'THC amount cannot be negative'
  }

  const eStr = customEfficiency.trim()
  if (eStr === '') {
    errors.customEfficiency = 'Efficiency is required'
  } else {
    const e = parseFloat(eStr)
    if (Number.isNaN(e)) errors.customEfficiency = 'Please enter a number'
    else if (e < 0 || e > 1)
      errors.customEfficiency = 'Efficiency must be between 0% and 100%'
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
    const timer = setTimeout(() => {
      const { errors } = validateFatsTab(
        infusion.decarbedThc,
        infusion.customEfficiency
      )

      setFieldErrors(errors)

      if (hasBlockingErrors(errors)) {
        setResults(null)
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

  const inputRow = (
    label: React.ReactNode,
    children: React.ReactNode,
    error?: string,
    extraClass?: string
  ) => (
    <div className={cn('flex flex-col gap-1', extraClass)}>
      <span className="flex items-center gap-1.5 text-sm font-medium text-white/80">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Fat Comparison</h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="fats" />
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Shared Input Panel */}
      <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
          Shared Input
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {inputRow(
            <>
              Decarbed THC
              <TooltipIcon text="Total decarboxylated THC in milligrams available for infusion. Use the output from the Decarb calculator." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                  fieldErrors.decarbedThc
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-white/20 focus:border-white/40'
                )}
                onChange={e => setInfusion({ decarbedThc: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={infusion.decarbedThc}
              />
              <span className="text-sm text-white/60">mg</span>
            </div>,
            fieldErrors.decarbedThc
          )}

          {/* Custom efficiency in shared panel for easy override */}
          {inputRow(
            <>
              Custom Fat Efficiency
              <TooltipIcon text="Extraction efficiency for the custom fat. Adjust this to compare custom fats against presets." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                  fieldErrors.customEfficiency
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-amber-400/60 focus:border-amber-400'
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
              <span className="text-sm text-white/60">ratio</span>
            </div>,
            fieldErrors.customEfficiency
          )}
        </div>
      </div>

      {/* Fat Grid - 2x2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {INFUSION_FATS.map(fat => {
          const fatResults = results?.byFat[fat.id]
          const isBest = results?.bestEffId === fat.id
          const isCustom = fat.id === 'custom'

          return (
            <div
              className={cn(
                'glass-strong flex flex-col gap-3 rounded-2xl p-5 transition-colors',
                isBest && 'border-2 border-emerald-400/50 bg-emerald-400/10'
              )}
              key={fat.id}
            >
              {/* Header row with badge */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-semibold text-white">
                  {fat.name}
                </h4>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isBest && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      Best Extraction
                    </span>
                  )}
                </div>
              </div>

              {/* Extraction Efficiency */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Extraction Efficiency
                </span>
                <span className="text-sm font-semibold text-white">
                  {Math.round(
                    (fatResults?.extractionEff ?? fat.extractionEff) * 100
                  )}
                  %
                </span>
              </div>

              {/* Resulting Final THC */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Final THC
                </span>
                {fatResults ? (
                  <span className="text-xl font-bold text-white">
                    {fmt1(fatResults.infusedThc)} mg
                  </span>
                ) : (
                  <span className="text-xl font-bold text-white/30">—</span>
                )}
              </div>

              {/* mg/mL Concentration */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Concentration
                </span>
                {fatResults && fatResults.mgPerMl != null ? (
                  <span className="text-xl font-bold text-emerald-300">
                    {fmt1(fatResults.mgPerMl)} mg/mL
                  </span>
                ) : (
                  <span className="text-xl font-bold text-white/30">—</span>
                )}
              </div>

              {/* Simplified Multiplier */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Simplified Multiplier
                </span>
                <span className="text-sm font-semibold text-white">
                  {isCustom
                    ? `×${(fatResults?.extractionEff ?? parseFloat(infusion.customEfficiency) ?? 0).toFixed(2)}`
                    : `×${fat.extractionEff.toFixed(2)}`}
                </span>
              </div>

              {/* Notes (for presets) */}
              {fat.notes && !isCustom && (
                <p className="text-xs leading-relaxed text-white/50">
                  {fat.notes}
                </p>
              )}

              {/* Use This */}
              <button
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
      <p className="text-center text-xs leading-relaxed text-white/40">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, infusion technique, and
        measurement accuracy.
      </p>
    </div>
  )
}
