import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import { cToF, fToC, gToOz, ozToG } from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import { Info, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
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

function OverrideBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
      Override
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  weight?: string
  thcaPct?: string
  thcPct?: string
  temperature?: string
  time?: string
  effLow?: string
  effExpected?: string
  effHigh?: string
}

function validateDecarbFields(
  weight: string,
  thcaPct: string,
  thcPct: string,
  tempOverride: string | null,
  timeOverride: string | null,
  effLowOverride: string | null,
  effExpectedOverride: string | null,
  effHighOverride: string | null,
  tempUnit: 'C' | 'F'
): { errors: FieldErrors; warnings: string[] } {
  const errors: FieldErrors = {}
  const warnings: string[] = []

  // Weight
  const wStr = weight.trim()
  if (wStr === '') {
    errors.weight = 'Weight is required'
  } else {
    const w = parseFloat(wStr)
    if (Number.isNaN(w)) errors.weight = 'Please enter a number'
    else if (w <= 0) errors.weight = 'Weight must be greater than 0'
  }

  // THCA
  const tStr = thcaPct.trim()
  if (tStr === '') {
    errors.thcaPct = 'THCA percentage is required'
  } else {
    const t = parseFloat(tStr)
    if (Number.isNaN(t)) errors.thcaPct = 'Please enter a number'
    else if (t < 0) errors.thcaPct = 'THCA cannot be negative'
    else if (t > 100) errors.thcaPct = 'THCA cannot exceed 100%'
  }

  // THC
  const hStr = thcPct.trim()
  if (hStr === '') {
    errors.thcPct = 'THC percentage is required'
  } else {
    const h = parseFloat(hStr)
    if (Number.isNaN(h)) errors.thcPct = 'Please enter a number'
    else if (h < 0) errors.thcPct = 'THC cannot be negative'
    else if (h > 100) errors.thcPct = 'THC cannot exceed 100%'
  }

  // Combined checks
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

  // Temperature override
  if (tempOverride != null) {
    const tv = parseFloat(tempOverride.trim())
    if (Number.isNaN(tv)) errors.temperature = 'Please enter a number'
    else if (tv < 0) errors.temperature = 'Temperature must be above 0'
    else if (tv > 300 && tempUnit === 'C')
      errors.temperature = 'Temperature above 300 C will destroy cannabinoids'
    else if (tv > 572 && tempUnit === 'F')
      errors.temperature = 'Temperature above 572 F will destroy cannabinoids'
  }

  // Time override
  if (timeOverride != null) {
    const tim = parseFloat(timeOverride.trim())
    if (Number.isNaN(tim)) errors.time = 'Please enter a number'
    else if (tim <= 0) errors.time = 'Time must be greater than 0'
  }

  // Efficiency overrides
  const effFields = [
    { key: 'effLow', label: 'Low efficiency', val: effLowOverride },
    {
      key: 'effExpected',
      label: 'Expected efficiency',
      val: effExpectedOverride,
    },
    { key: 'effHigh', label: 'High efficiency', val: effHighOverride },
  ] as const

  for (const f of effFields) {
    if (f.val != null) {
      const v = parseFloat(f.val.trim())
      if (Number.isNaN(v))
        (errors as Record<string, string | undefined>)[f.key] =
          'Please enter a number'
      else if (v < 0 || v > 1)
        (errors as Record<string, string | undefined>)[f.key] =
          'Efficiency must be between 0% and 100%'
    }
  }

  return { errors, warnings }
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function DecarbTab() {
  /* Store bindings */
  const decarb = useAppStore(s => s.decarb)
  const setDecarb = useAppStore(s => s.setDecarb)
  const resetDecarb = useAppStore(s => s.resetDecarb)
  const units = useAppStore(s => s.units)
  const setUnits = useAppStore(s => s.setUnits)

  /* Preset lookup */
  const preset = useMemo(
    () =>
      DECARB_METHODS.find(m => m.id === decarb.presetId) ?? DECARB_METHODS[0],
    [decarb.presetId]
  )

  /* Local UI state */
  const [showFormula, setShowFormula] = useState(false)
  const [results, setResults] = useState<{
    theoreticalMax: number
    decarbed: { low: number; expected: number; high: number }
    warnings: string[]
  } | null>(null)

  /* Validation state (debounced) */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [inlineWarnings, setInlineWarnings] = useState<string[]>([])

  /* ---------------------------------------------------------------- */
  /* Derived helpers                                                  */
  /* ---------------------------------------------------------------- */

  const displayTemp = useCallback(
    (tempC: number): string => {
      if (units.tempUnit === 'F') return fmt1(round1n(cToF(tempC)))
      return fmt1(tempC)
    },
    [units.tempUnit]
  )

  const weightGrams = useMemo(() => {
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w)) return 0
    if (units.weightUnit === 'oz') return ozToG(w)
    return w
  }, [decarb.weight, units.weightUnit])

  const hasBlockingErrors = useCallback(
    (errs: FieldErrors) =>
      !!(
        errs.weight ||
        errs.thcaPct ||
        errs.thcPct ||
        errs.effLow ||
        errs.effExpected ||
        errs.effHigh
      ),
    []
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      const { errors, warnings } = validateDecarbFields(
        decarb.weight,
        decarb.thcaPct,
        decarb.thcPct,
        decarb.tempOverride,
        decarb.timeOverride,
        decarb.effLowOverride,
        decarb.effExpectedOverride,
        decarb.effHighOverride,
        units.tempUnit
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

        const effLow =
          decarb.effLowOverride != null
            ? parseFloat(decarb.effLowOverride)
            : preset.efficiency.low
        const effExpected =
          decarb.effExpectedOverride != null
            ? parseFloat(decarb.effExpectedOverride)
            : preset.efficiency.expected
        const effHigh =
          decarb.effHighOverride != null
            ? parseFloat(decarb.effHighOverride)
            : preset.efficiency.high

        const decarbed = {
          low: calculateDecarbedThc(theoreticalMax, effLow),
          expected: calculateDecarbedThc(theoreticalMax, effExpected),
          high: calculateDecarbedThc(theoreticalMax, effHigh),
        }

        setResults({ theoreticalMax, decarbed, warnings })
        useAppStore.getState().setLastDecarbExpected(fmt1(decarbed.expected))
      } catch {
        setResults(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [
    decarb.weight,
    decarb.thcaPct,
    decarb.thcPct,
    decarb.presetId,
    decarb.tempOverride,
    decarb.timeOverride,
    decarb.effLowOverride,
    decarb.effExpectedOverride,
    decarb.effHighOverride,
    units.weightUnit,
    units.tempUnit,
    preset,
    weightGrams,
    hasBlockingErrors,
  ])

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handlePresetChange = (id: string) => {
    setDecarb({
      presetId: id,
      tempOverride: null,
      timeOverride: null,
      effLowOverride: null,
      effExpectedOverride: null,
      effHighOverride: null,
    })
  }

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

  const handleTempUnitToggle = (newUnit: 'C' | 'F') => {
    if (newUnit === units.tempUnit) return
    // Convert temperature override if present
    if (decarb.tempOverride != null) {
      const current = parseFloat(decarb.tempOverride)
      if (!Number.isNaN(current)) {
        const converted = newUnit === 'F' ? cToF(current) : fToC(current)
        setDecarb({ tempOverride: fmt1(round1n(converted)) })
      }
    }
    setUnits({ tempUnit: newUnit })
  }

  const handleReset = () => {
    resetDecarb()
    setResults(null)
    setFieldErrors({})
    setInlineWarnings([])
    setShowFormula(false)
  }

  /* ---------------------------------------------------------------- */
  /* Preset display values                                            */
  /* ---------------------------------------------------------------- */

  const presetTempDisplay = displayTemp(preset.tempC)
  const presetTimeDisplay = fmt1(preset.timeMax) // representative single value

  const isTempOverride = decarb.tempOverride !== null
  const isTimeOverride = decarb.timeOverride !== null
  const isEffLowOverride = decarb.effLowOverride !== null
  const isEffExpectedOverride = decarb.effExpectedOverride !== null
  const isEffHighOverride = decarb.effHighOverride !== null

  const tempValue =
    isTempOverride && decarb.tempOverride != null
      ? decarb.tempOverride
      : presetTempDisplay
  const timeValue =
    isTimeOverride && decarb.timeOverride != null
      ? decarb.timeOverride
      : presetTimeDisplay
  const effLowValue =
    isEffLowOverride && decarb.effLowOverride != null
      ? decarb.effLowOverride
      : String(preset.efficiency.low)
  const effExpectedValue =
    isEffExpectedOverride && decarb.effExpectedOverride != null
      ? decarb.effExpectedOverride
      : String(preset.efficiency.expected)
  const effHighValue =
    isEffHighOverride && decarb.effHighOverride != null
      ? decarb.effHighOverride
      : String(preset.efficiency.high)

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
        <h2 className="text-xl font-semibold text-white">Decarboxylation</h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="decarb" />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ------------------- INPUT PANEL ------------------- */}
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Input
          </h3>

          {/* Weight */}
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

          {/* THCA */}
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

          {/* THC */}
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

          {/* Method preset */}
          {inputRow(
            <>
              Method Preset
              <TooltipIcon text="Choose a decarboxylation method. Each preset defines recommended temperature, time, and expected efficiency range." />
            </>,
            <select
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
              onChange={e => handlePresetChange(e.target.value)}
              value={decarb.presetId}
            >
              {DECARB_METHODS.map(m => (
                <option
                  className="bg-neutral-900 text-white"
                  key={m.id}
                  value={m.id}
                >
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* Temperature */}
          {inputRow(
            <>
              Temperature
              {isTempOverride && <OverrideBadge />}
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                  isTempOverride
                    ? 'border-amber-400/60 focus:border-amber-400'
                    : fieldErrors.temperature
                      ? 'border-red-400/60 focus:border-red-400'
                      : 'border-white/20 focus:border-white/40'
                )}
                onChange={e => setDecarb({ tempOverride: e.target.value })}
                placeholder={`${presetTempDisplay} ${units.tempUnit}`}
                step="0.1"
                type="number"
                value={tempValue}
              />
              <UnitToggle
                onChange={handleTempUnitToggle}
                options={['C', 'F'] as const}
                value={units.tempUnit}
              />
            </div>,
            fieldErrors.temperature
          )}

          {/* Time */}
          {inputRow(
            <>
              Time (min)
              {isTimeOverride && <OverrideBadge />}
              <TooltipIcon text="Duration of decarboxylation. Sous vide methods use longer times at lower temperatures for better terpene retention." />
            </>,
            <input
              className={cn(
                'rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                isTimeOverride
                  ? 'border-amber-400/60 focus:border-amber-400'
                  : fieldErrors.time
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-white/20 focus:border-white/40'
              )}
              onChange={e => setDecarb({ timeOverride: e.target.value })}
              placeholder={`${preset.timeMin}-${preset.timeMax} min`}
              step="1"
              type="number"
              value={timeValue}
            />,
            fieldErrors.time
          )}

          {/* Efficiency */}
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              Decarb Efficiency
              <TooltipIcon text="The percentage of THCA that successfully converts to THC during decarboxylation. 100% efficiency is theoretical maximum; real-world methods typically achieve 70-95%." />
            </span>
            <div className="grid grid-cols-3 gap-2">
              {inputRow(
                <>Low {isEffLowOverride && <OverrideBadge />}</>,
                <input
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-2 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                    isEffLowOverride
                      ? 'border-amber-400/60 focus:border-amber-400'
                      : fieldErrors.effLow
                        ? 'border-red-400/60 focus:border-red-400'
                        : 'border-white/20 focus:border-white/40'
                  )}
                  max={1}
                  min={0}
                  onChange={e => setDecarb({ effLowOverride: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={effLowValue}
                />,
                fieldErrors.effLow
              )}
              {inputRow(
                <>Expected {isEffExpectedOverride && <OverrideBadge />}</>,
                <input
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-2 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                    isEffExpectedOverride
                      ? 'border-amber-400/60 focus:border-amber-400'
                      : fieldErrors.effExpected
                        ? 'border-red-400/60 focus:border-red-400'
                        : 'border-white/20 focus:border-white/40'
                  )}
                  max={1}
                  min={0}
                  onChange={e =>
                    setDecarb({ effExpectedOverride: e.target.value })
                  }
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={effExpectedValue}
                />,
                fieldErrors.effExpected
              )}
              {inputRow(
                <>High {isEffHighOverride && <OverrideBadge />}</>,
                <input
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-2 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                    isEffHighOverride
                      ? 'border-amber-400/60 focus:border-amber-400'
                      : fieldErrors.effHigh
                        ? 'border-red-400/60 focus:border-red-400'
                        : 'border-white/20 focus:border-white/40'
                  )}
                  max={1}
                  min={0}
                  onChange={e => setDecarb({ effHighOverride: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={effHighValue}
                />,
                fieldErrors.effHigh
              )}
            </div>
          </div>
        </div>

        {/* ------------------- RESULTS PANEL ------------------- */}
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Results
          </h3>

          {/* Warnings */}
          {inlineWarnings.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
              {inlineWarnings.map(w => (
                <span className="text-xs text-amber-300" key={w}>
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* Theoretical Max */}
          <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">
              Theoretical Maximum THC
            </span>
            <span className="mt-1 text-2xl font-bold text-white">
              {results ? `${fmt1(results.theoreticalMax)} mg` : 'N/A'}
            </span>
          </div>

          {/* Decarb-adjusted */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">
              Decarb-Adjusted THC
            </span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  Low
                </span>
                <span className="text-lg font-semibold text-white">
                  {results ? `${fmt1(results.decarbed.low)} mg` : 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  Expected
                </span>
                <span className="text-lg font-semibold text-emerald-300">
                  {results ? `${fmt1(results.decarbed.expected)} mg` : 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  High
                </span>
                <span className="text-lg font-semibold text-white">
                  {results ? `${fmt1(results.decarbed.high)} mg` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Quality Badges */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                Terpene Retention
              </span>
              <span className="mt-1 text-sm font-semibold text-white">
                {preset.terpeneLabel}
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                CBN Risk
              </span>
              <span className="mt-1 text-sm font-semibold text-white">
                {preset.cbnLabel}
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                Oxygen Exposure
              </span>
              <span className="mt-1 text-sm font-semibold text-white">
                {preset.oxygenLabel}
              </span>
            </div>
          </div>

          {/* Show Formula */}
          <div>
            <button
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setShowFormula(v => !v)}
              type="button"
            >
              <span>{showFormula ? 'Hide Formula' : 'Show Formula'}</span>
              {showFormula ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
            {showFormula && (
              <div className="mt-2 rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs leading-relaxed text-white/70">
                <p className="mb-2">
                  <strong className="text-white/90">
                    Theoretical max THC (mg)
                  </strong>{' '}
                  = material weight (g) x ((THCA% / 100) x 0.877 + (THC% / 100))
                  x 1000
                </p>
                <p className="mb-2">
                  <strong className="text-white/90">
                    Decarb-adjusted THC (mg)
                  </strong>{' '}
                  = theoretical max THC (mg) x decarb efficiency
                </p>
                <p className="text-white/70">
                  THCA loses its carboxyl group (COOH) during decarboxylation.
                  The molecular weight ratio of THC to THCA is approximately
                  0.877.
                </p>
              </div>
            )}
          </div>
        </div>
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
