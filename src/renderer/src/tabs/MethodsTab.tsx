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
      <Info className="size-4 shrink-0 cursor-help text-foreground/70 transition-colors hover:text-foreground/80" />
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-foreground/20 bg-card px-3 py-2 text-xs leading-relaxed text-foreground/90 shadow-xl">
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
    <div className="inline-flex shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5">
      {options.map(opt => (
        <button
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-foreground/15 text-foreground'
              : 'text-foreground/70 hover:text-foreground/80'
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
/* Validation */
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
    errors.weight = 'Tell us how much material you are working with'
  } else {
    const w = parseFloat(wStr)
    if (Number.isNaN(w)) errors.weight = 'That does not look like a number'
    else if (w <= 0) errors.weight = 'Weight needs to be a positive number'
  }

  const tStr = thcaPct.trim()
  if (tStr === '') {
    errors.thcaPct = 'We need a THCA percentage'
  } else {
    const t = parseFloat(tStr)
    if (Number.isNaN(t)) errors.thcaPct = 'That does not look like a number'
    else if (t < 0)
      errors.thcaPct = 'THCA cannot be negative -- percentages start at zero'
    else if (t > 100)
      errors.thcaPct =
        'THCA cannot be above 100% -- that would be quite the plant'
  }

  const hStr = thcPct.trim()
  if (hStr === '') {
    errors.thcPct = 'We need an existing THC percentage'
  } else {
    const h = parseFloat(hStr)
    if (Number.isNaN(h)) errors.thcPct = 'That does not look like a number'
    else if (h < 0)
      errors.thcPct = 'THC cannot be negative -- percentages start at zero'
    else if (h > 100)
      errors.thcPct =
        'THC cannot be above 100% -- that would be quite the plant'
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
        'High cannabinoid levels -- worth double-checking your lab report'
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
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Method Comparison
        </h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="methods" />
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
      <div className="flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Shared Inputs
        </h3>

        {inlineWarnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 dark:bg-warning/10 px-3 py-2">
            {inlineWarnings.map(w => (
              <span className="text-xs text-warning dark:text-warning" key={w}>
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
                  'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.weight
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
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
                'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                fieldErrors.thcaPct
                  ? 'border-danger/60 focus:border-danger'
                  : 'border-foreground/20 focus:border-foreground/40'
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
                'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                fieldErrors.thcPct
                  ? 'border-danger/60 focus:border-danger'
                  : 'border-foreground/20 focus:border-foreground/40'
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
        <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
            Theoretical Maximum THC
          </span>
          <span className="text-lg font-bold text-foreground">
            {fmt1(results.theoreticalMax)} mg
          </span>
        </div>
      )}

      {/* Method Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {DECARB_METHODS.map(method => {
          const methodResults = results?.byMethod[method.id]
          const isMaxPotency = results?.maxPotencyId === method.id
          const isMaxTerpene = results?.maxTerpeneId === method.id

          return (
            <div
              className={cn(
                'flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 transition-colors',
                isMaxPotency &&
                  'border-2 border-warning/50 bg-warning/10 dark:bg-warning/10',
                isMaxTerpene &&
                  !isMaxPotency &&
                  'border-2 border-success/50 bg-success/10'
              )}
              key={method.id}
            >
              {/* Header row with badges */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  {method.name}
                </h4>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isMaxPotency && (
                    <span className="inline-flex items-center rounded-full border border-warning/40 dark:border-warning/40 bg-warning/10 dark:bg-warning/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-warning dark:text-warning">
                      Highest Potency
                    </span>
                  )}
                  {isMaxTerpene && (
                    <span className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-success">
                      Max Terpene Retention
                    </span>
                  )}
                </div>
              </div>

              {/* Efficiency */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Decarb Efficiency
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {methodResults
                    ? methodResults.efficiencyDisplay
                    : `${Math.round(method.efficiency.low * 100)}–${Math.round(method.efficiency.high * 100)}%`}
                </span>
              </div>

              {/* Resulting THC */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Resulting THC
                </span>
                {methodResults ? (
                  <div className="flex items-baseline gap-2">
                    <span className="result-bloom text-2xl font-bold text-foreground">
                      {fmt1(methodResults.expectedThc)} mg
                    </span>
                    <span className="text-xs text-foreground/70">
                      ({fmt1(methodResults.lowThc)}–
                      {fmt1(methodResults.highThc)})
                    </span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-foreground/70">
                    {methodResults
                      ? ''
                      : 'Enter your material weight and potency above to see results'}
                  </span>
                )}
              </div>

              {/* Qualitative labels */}
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                <span className="text-xs text-foreground/60">
                  Terpenes:{' '}
                  <span className="font-medium text-foreground/80">
                    {method.terpeneLabel}
                  </span>
                </span>
                <span className="text-xs text-foreground/30">·</span>
                <span className="text-xs text-foreground/60">
                  CBN:{' '}
                  <span className="font-medium text-foreground/80">
                    {method.cbnLabel}
                  </span>
                </span>
                <span className="text-xs text-foreground/30">·</span>
                <span className="text-xs text-foreground/60">
                  Oxygen:{' '}
                  <span className="font-medium text-foreground/80">
                    {method.oxygenLabel}
                  </span>
                </span>
              </div>

              {/* Use This */}
              <button
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
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
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, decarb technique, and measurement
        accuracy.
      </p>
    </div>
  )
}
