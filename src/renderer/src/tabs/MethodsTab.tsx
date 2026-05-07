import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import { gToOz, ozToG } from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import { Info, RotateCcw } from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'

/* ------------------------------------------------------------------ */
/* Small helpers (mirroring DecarbTab patterns)                       */
/* ------------------------------------------------------------------ */

function round1n(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

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
      <Info className="size-4 shrink-0 cursor-help text-white/70 transition-colors hover:text-white/80" />
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-xl">
          {text}
        </div>
      )}
    </button>
  )
}

function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-white/20 bg-white/5 p-0.5">
      {options.map(opt => (
        <button
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-white/15 text-white'
              : 'text-white/70 hover:text-white/80'
          )}
          key={opt}
          onClick={() => onChange(opt)}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  weight?: string
  thcaPct?: string
  thcPct?: string
}

function validateSharedInputs(
  weight: string,
  thcaPct: string,
  thcPct: string
): { errors: FieldErrors; warnings: string[] } {
  const errors: FieldErrors = {}
  const warnings: string[] = []

  const wStr = weight.trim()
  if (wStr === '') {
    errors.weight = 'Weight is required'
  } else {
    const w = parseFloat(wStr)
    if (Number.isNaN(w)) errors.weight = 'Please enter a number'
    else if (w <= 0) errors.weight = 'Weight must be greater than 0'
  }

  const tStr = thcaPct.trim()
  if (tStr === '') {
    errors.thcaPct = 'THCA percentage is required'
  } else {
    const t = parseFloat(tStr)
    if (Number.isNaN(t)) errors.thcaPct = 'Please enter a number'
    else if (t < 0) errors.thcaPct = 'THCA cannot be negative'
    else if (t > 100) errors.thcaPct = 'THCA cannot exceed 100%'
  }

  const hStr = thcPct.trim()
  if (hStr === '') {
    errors.thcPct = 'THC percentage is required'
  } else {
    const h = parseFloat(hStr)
    if (Number.isNaN(h)) errors.thcPct = 'Please enter a number'
    else if (h < 0) errors.thcPct = 'THC cannot be negative'
    else if (h > 100) errors.thcPct = 'THC cannot exceed 100%'
  }

  if (!errors.thcaPct && !errors.thcPct) {
    const t = parseFloat(thcaPct)
    const h = parseFloat(thcPct)
    if (!Number.isNaN(t) && !Number.isNaN(h) && t + h > 100) {
      errors.thcaPct = 'THCA + THC cannot exceed 100%'
      errors.thcPct = 'THCA + THC cannot exceed 100%'
    }
    if (!Number.isNaN(t) && !Number.isNaN(h) && t + h > 40) {
      warnings.push(
        'Note: High total cannabinoid percentage. Verify lab results.'
      )
    }
  }

  return { errors, warnings }
}

/* ------------------------------------------------------------------ */
/* Terpene ranking for comparison                                     */
/* ------------------------------------------------------------------ */

const TERPENE_RANK: Record<string, number> = {
  'Very high retention': 5,
  'High retention': 4,
  'Moderate retention': 3,
  'Low retention': 2,
  'Very low retention': 1,
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function MethodsTab() {
  const decarb = useAppStore(s => s.decarb)
  const setDecarb = useAppStore(s => s.setDecarb)
  const resetDecarb = useAppStore(s => s.resetDecarb)
  const units = useAppStore(s => s.units)
  const setUnits = useAppStore(s => s.setUnits)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [inlineWarnings, setInlineWarnings] = useState<string[]>([])
  const [results, setResults] = useState<{
    theoreticalMax: number
    byMethod: Record<
      string,
      {
        expectedThc: number
        lowThc: number
        highThc: number
        efficiencyDisplay: string
      }
    >
    maxPotencyId: string
    maxTerpeneId: string
  } | null>(null)

  const weightGrams = useMemo(() => {
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w)) return 0
    if (units.weightUnit === 'oz') return ozToG(w)
    return w
  }, [decarb.weight, units.weightUnit])

  const hasBlockingErrors = useCallback(
    (errs: FieldErrors) => !!(errs.weight || errs.thcaPct || errs.thcPct),
    []
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      const { errors, warnings } = validateSharedInputs(
        decarb.weight,
        decarb.thcaPct,
        decarb.thcPct
      )

      setFieldErrors(errors)
      setInlineWarnings(warnings)

      if (hasBlockingErrors(errors)) {
        setResults(null)
        return
      }

      try {
        const thca = parseFloat(decarb.thcaPct)
        const thc = parseFloat(decarb.thcPct)
        const theoreticalMax = calculateTheoreticalMax(weightGrams, thca, thc)

        const byMethod: Record<
          string,
          {
            expectedThc: number
            lowThc: number
            highThc: number
            efficiencyDisplay: string
          }
        > = {}

        let maxPotencyId = DECARB_METHODS[0].id
        let maxPotencyValue = -1
        let maxTerpeneId = DECARB_METHODS[0].id
        let maxTerpeneRank = -1

        for (const method of DECARB_METHODS) {
          const lowThc = calculateDecarbedThc(
            theoreticalMax,
            method.efficiency.low
          )
          const expectedThc = calculateDecarbedThc(
            theoreticalMax,
            method.efficiency.expected
          )
          const highThc = calculateDecarbedThc(
            theoreticalMax,
            method.efficiency.high
          )

          const lowPct = Math.round(method.efficiency.low * 100)
          const highPct = Math.round(method.efficiency.high * 100)
          const efficiencyDisplay =
            lowPct === highPct ? `${lowPct}%` : `${lowPct}–${highPct}%`

          byMethod[method.id] = {
            expectedThc,
            lowThc,
            highThc,
            efficiencyDisplay,
          }

          if (expectedThc > maxPotencyValue) {
            maxPotencyValue = expectedThc
            maxPotencyId = method.id
          }

          const terpRank = TERPENE_RANK[method.terpeneLabel] ?? 0
          if (terpRank > maxTerpeneRank) {
            maxTerpeneRank = terpRank
            maxTerpeneId = method.id
          }
        }

        setResults({
          theoreticalMax,
          byMethod,
          maxPotencyId,
          maxTerpeneId,
        })
      } catch {
        setResults(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [
    decarb.weight,
    decarb.thcaPct,
    decarb.thcPct,
    weightGrams,
    hasBlockingErrors,
  ])

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleWeightUnitToggle = (newUnit: 'g' | 'oz') => {
    if (newUnit === units.weightUnit) return
    const current = parseFloat(decarb.weight)
    if (!Number.isNaN(current)) {
      const converted = newUnit === 'oz' ? gToOz(current) : ozToG(current)
      setDecarb({ weight: fmt1(round1n(converted)) })
    } else if (decarb.weight.trim() === '') {
      setDecarb({ weight: '' })
    }
    setUnits({ weightUnit: newUnit })
  }

  const handleReset = () => {
    resetDecarb()
    setResults(null)
    setFieldErrors({})
    setInlineWarnings([])
  }

  const handleUseThis = (methodId: string) => {
    setDecarb({ presetId: methodId })
    setActiveTab('decarb')
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

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Method Comparison</h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="methods" />
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
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Shared Inputs
        </h3>

        {inlineWarnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
            {inlineWarnings.map(w => (
              <span className="text-xs text-amber-300" key={w}>
                {w}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {inputRow(
            <>
              Material Weight
              <TooltipIcon text="The total weight of raw cannabis material before decarboxylation." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                  fieldErrors.weight
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-white/20 focus:border-white/40'
                )}
                onChange={e => setDecarb({ weight: e.target.value })}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={decarb.weight}
              />
              <UnitToggle
                onChange={handleWeightUnitToggle}
                options={['g', 'oz'] as const}
                value={units.weightUnit}
              />
            </div>,
            fieldErrors.weight
          )}

          {inputRow(
            <>
              THCA %
              <TooltipIcon text="Tetrahydrocannabinolic acid -- the non-psychoactive precursor to THC found in raw cannabis." />
            </>,
            <input
              className={cn(
                'rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                fieldErrors.thcaPct
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-white/20 focus:border-white/40'
              )}
              onChange={e => setDecarb({ thcaPct: e.target.value })}
              placeholder="0.0"
              step="0.1"
              type="number"
              value={decarb.thcaPct}
            />,
            fieldErrors.thcaPct
          )}

          {inputRow(
            <>
              Existing THC %
              <TooltipIcon text="Delta-9-THC already present in the material. This does not need decarboxylation and contributes directly to total potency." />
            </>,
            <input
              className={cn(
                'rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                fieldErrors.thcPct
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-white/20 focus:border-white/40'
              )}
              onChange={e => setDecarb({ thcPct: e.target.value })}
              placeholder="0.0"
              step="0.1"
              type="number"
              value={decarb.thcPct}
            />,
            fieldErrors.thcPct
          )}
        </div>
      </div>

      {/* Theoretical Max (shared) */}
      {results && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-white/70">
            Theoretical Maximum THC
          </span>
          <span className="text-lg font-bold text-white">
            {fmt1(results.theoreticalMax)} mg
          </span>
        </div>
      )}

      {/* Method Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DECARB_METHODS.map(method => {
          const methodResults = results?.byMethod[method.id]
          const isMaxPotency = results?.maxPotencyId === method.id
          const isMaxTerpene = results?.maxTerpeneId === method.id

          return (
            <div
              className={cn(
                'glass-strong flex flex-col gap-3 rounded-2xl p-5 transition-colors',
                isMaxPotency && 'border-2 border-amber-400/50 bg-amber-400/10',
                isMaxTerpene &&
                  !isMaxPotency &&
                  'border-2 border-teal-400/50 bg-teal-400/10'
              )}
              key={method.id}
            >
              {/* Header row with badges */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-semibold text-white">
                  {method.name}
                </h4>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isMaxPotency && (
                    <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                      Highest Potency
                    </span>
                  )}
                  {isMaxTerpene && (
                    <span className="inline-flex items-center rounded-full border border-teal-400/40 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                      Max Terpene Retention
                    </span>
                  )}
                </div>
              </div>

              {/* Efficiency */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                  Decarb Efficiency
                </span>
                <span className="text-sm font-semibold text-white">
                  {methodResults
                    ? methodResults.efficiencyDisplay
                    : `${Math.round(method.efficiency.low * 100)}–${Math.round(method.efficiency.high * 100)}%`}
                </span>
              </div>

              {/* Resulting THC */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                  Resulting THC
                </span>
                {methodResults ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">
                      {fmt1(methodResults.expectedThc)} mg
                    </span>
                    <span className="text-xs text-white/70">
                      ({fmt1(methodResults.lowThc)}–
                      {fmt1(methodResults.highThc)})
                    </span>
                  </div>
                ) : (
                  <span className="text-xl font-bold text-white/70">N/A</span>
                )}
              </div>

              {/* Qualitative labels */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-1 py-2 text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Terpenes
                  </span>
                  <span className="mt-0.5 text-xs font-semibold text-white">
                    {method.terpeneLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-1 py-2 text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    CBN Risk
                  </span>
                  <span className="mt-0.5 text-xs font-semibold text-white">
                    {method.cbnLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 px-1 py-2 text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Oxygen
                  </span>
                  <span className="mt-0.5 text-xs font-semibold text-white">
                    {method.oxygenLabel}
                  </span>
                </div>
              </div>

              {/* Use This */}
              <button
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => handleUseThis(method.id)}
                type="button"
              >
                Use This
              </button>
            </div>
          )
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-white/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, decarb technique, and measurement
        accuracy.
      </p>
    </div>
  )
}
