import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateInfusedThc,
  calculateMgPerMl,
  calculateSimplifiedEstimate,
} from 'renderer/src/engine/infusion'
import { INFUSION_FATS } from 'renderer/src/engine/models'
import {
  cupToMl,
  mlToCup,
  mlToTbsp,
  mlToTsp,
  tbspToMl,
  tspToMl,
} from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import { Info, ChevronDown, ChevronUp, RotateCcw, Loader2 } from 'lucide-react'
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

function OverrideBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-warning/40 dark:border-warning/40 bg-warning/10 dark:bg-warning/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-warning dark:text-warning">
      Override
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  decarbedThc?: string
  volume?: string
  customEfficiency?: string
}

function validateInfusionFields(
  decarbedThc: string,
  volume: string,
  customEfficiency: string,
  isCustom: boolean
): { errors: FieldErrors; warnings: string[] } {
  const errors: FieldErrors = {}
  const warnings: string[] = []

  // Decarbed THC
  const dStr = decarbedThc.trim()
  if (dStr === '') {
    errors.decarbedThc = 'We need your decarbed THC amount'
  } else {
    const d = parseFloat(dStr)
    if (Number.isNaN(d)) errors.decarbedThc = 'That does not look like a number'
    else if (d < 0) errors.decarbedThc = 'THC cannot be negative'
  }

  // Volume
  const vStr = volume.trim()
  if (vStr === '') {
    errors.volume = 'Tell us how much fat you are using'
  } else {
    const v = parseFloat(vStr)
    if (Number.isNaN(v)) errors.volume = 'That does not look like a number'
    else if (v <= 0) errors.volume = 'Volume needs to be a positive number'
  }

  // Custom efficiency
  if (isCustom) {
    const eStr = customEfficiency.trim()
    if (eStr === '') {
      errors.customEfficiency = 'Custom fat needs an efficiency value'
    } else {
      const e = parseFloat(eStr)
      if (Number.isNaN(e))
        errors.customEfficiency = 'That does not look like a number'
      else if (e < 0)
        errors.customEfficiency =
          'Efficiency needs to be between 0 and 1 (like 0.85 for 85%)'
      else if (e > 1)
        errors.customEfficiency =
          'Efficiency needs to be between 0 and 1 (like 0.85 for 85%)'
    }
  }

  // Low volume warning (decarbed > 0 and volume < decarbed/20)
  const d = parseFloat(dStr)
  const v = parseFloat(vStr)
  if (!Number.isNaN(d) && !Number.isNaN(v) && d > 0 && v > 0 && v < d / 20) {
    warnings.push(
      'Not much fat volume here -- may not absorb all the cannabinoids.'
    )
  }

  return { errors, warnings }
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

function mlToDisplayVolume(
  ml: number,
  unit: 'mL' | 'tsp' | 'tbsp' | 'cup'
): number {
  switch (unit) {
    case 'mL':
      return ml
    case 'tsp':
      return mlToTsp(ml)
    case 'tbsp':
      return mlToTbsp(ml)
    case 'cup':
      return mlToCup(ml)
  }
}

function unitFactor(unit: 'mL' | 'tsp' | 'tbsp' | 'cup'): number {
  switch (unit) {
    case 'mL':
      return 1
    case 'tsp':
      return 4.929
    case 'tbsp':
      return 14.787
    case 'cup':
      return 236.588
  }
}

function unitLabel(unit: 'mL' | 'tsp' | 'tbsp' | 'cup'): string {
  switch (unit) {
    case 'mL':
      return 'mg/mL'
    case 'tsp':
      return 'mg/tsp'
    case 'tbsp':
      return 'mg/tbsp'
    case 'cup':
      return 'mg/cup'
  }
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function InfusionTab() {
  /* Store bindings */
  const infusion = useAppStore(s => s.infusion)
  const setInfusion = useAppStore(s => s.setInfusion)
  const resetInfusion = useAppStore(s => s.resetInfusion)
  const units = useAppStore(s => s.units)
  const setUnits = useAppStore(s => s.setUnits)
  const decarb = useAppStore(s => s.decarb)
  const lastDecarbExpected = useAppStore(s => s.lastDecarbExpected)

  /* Track the last upstream value we synced, so we can overwrite our own
     auto-fill but NOT a manual user edit. */
  const syncedDecarbRef = useRef<string>('')

  /* Reactive auto-fill from upstream decarb result */
  useEffect(() => {
    if (lastDecarbExpected) {
      const current = infusion.decarbedThc.trim()
      // Fill if empty, or if the field still contains exactly what we last synced
      if (!current || current === syncedDecarbRef.current) {
        setInfusion({ decarbedThc: lastDecarbExpected })
        syncedDecarbRef.current = lastDecarbExpected
      }
    }
  }, [infusion.decarbedThc, lastDecarbExpected, setInfusion])

  /* Preset lookup */
  const preset = useMemo(
    () => INFUSION_FATS.find(f => f.id === infusion.fatId) ?? INFUSION_FATS[0],
    [infusion.fatId]
  )

  const isCustom = preset.id === 'custom'

  /* Local UI state */
  const [showFormula, setShowFormula] = useState(false)
  const [results, setResults] = useState<{
    infusedThc: number
    mgPerUnit: number
    unitLabel: string
    simplifiedEstimate: number | null
    fatName: string
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  /* Validation state */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [inlineWarnings, setInlineWarnings] = useState<string[]>([])

  /* ---------------------------------------------------------------- */
  /* Derived helpers                                                  */
  /* ---------------------------------------------------------------- */

  const volumeMl = useMemo(() => {
    return displayVolumeToMl(infusion.volume, units.volumeUnit)
  }, [infusion.volume, units.volumeUnit])

  const extractionEff = useMemo(() => {
    if (isCustom) {
      const e = parseFloat(infusion.customEfficiency)
      return Number.isNaN(e) ? NaN : e
    }
    return preset.extractionEff
  }, [isCustom, infusion.customEfficiency, preset.extractionEff])

  const hasBlockingErrors = useCallback(
    (errs: FieldErrors) =>
      !!(errs.decarbedThc || errs.volume || errs.customEfficiency),
    []
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const { errors, warnings } = validateInfusionFields(
        infusion.decarbedThc,
        infusion.volume,
        infusion.customEfficiency,
        isCustom
      )

      setFieldErrors(errors)
      setInlineWarnings(warnings)

      if (hasBlockingErrors(errors)) {
        setResults(null)
        setIsCalculating(false)
        return
      }

      try {
        const decarbedThc = parseFloat(infusion.decarbedThc)
        const eff = extractionEff

        const infusedThc = calculateInfusedThc(decarbedThc, eff)
        const mgPerMl = calculateMgPerMl(infusedThc, volumeMl)
        const factor = unitFactor(units.volumeUnit)
        const mgPerUnit = round1n(mgPerMl * factor)

        let simplifiedEstimate: number | null = null
        if (!isCustom) {
          const weight = parseFloat(decarb.weight)
          const thca = parseFloat(decarb.thcaPct)
          if (
            !Number.isNaN(weight) &&
            !Number.isNaN(thca) &&
            weight >= 0 &&
            thca >= 0 &&
            thca <= 100
          ) {
            simplifiedEstimate = calculateSimplifiedEstimate(
              weight,
              thca,
              preset.simplifiedMultiplier
            )
          }
        }

        setResults({
          infusedThc,
          mgPerUnit,
          unitLabel: unitLabel(units.volumeUnit),
          simplifiedEstimate,
          fatName: preset.name,
        })
        useAppStore.getState().setLastInfusedThc(fmt1(infusedThc))
      } catch {
        setResults(null)
      }
      setIsCalculating(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [
    infusion.decarbedThc,
    infusion.volume,
    infusion.customEfficiency,
    infusion.fatId,
    units.volumeUnit,
    extractionEff,
    volumeMl,
    isCustom,
    preset,
    decarb.weight,
    decarb.thcaPct,
    hasBlockingErrors,
  ])

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleFatChange = (id: string) => {
    setInfusion({ fatId: id })
  }

  const handleVolumeUnitToggle = (newUnit: 'mL' | 'tsp' | 'tbsp' | 'cup') => {
    if (newUnit === units.volumeUnit) return
    const current = parseFloat(infusion.volume)
    if (!Number.isNaN(current)) {
      const currentMl = displayVolumeToMl(infusion.volume, units.volumeUnit)
      const newDisplay = fmt1(round1n(mlToDisplayVolume(currentMl, newUnit)))
      setInfusion({ volume: newDisplay })
    } else if (infusion.volume.trim() === '') {
      setInfusion({ volume: '' })
    }
    setUnits({ volumeUnit: newUnit })
  }

  const handleReset = () => {
    resetInfusion()
    setResults(null)
    setFieldErrors({})
    setInlineWarnings([])
    setShowFormula(false)
  }

  /* Escape key resets current tab */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleReset()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Fat Infusion</h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="infusion" />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ------------------- INPUT PANEL ------------------- */}
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Input
          </h3>

          {/* Decarbed THC */}
          {inputRow(
            <>
              Decarbed THC
              {infusion.decarbedThc === lastDecarbExpected &&
                lastDecarbExpected && (
                  <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                    Auto-filled from Decarb
                  </span>
                )}
              <TooltipIcon text="Total decarboxylated THC in milligrams. This is the output from the Decarb calculator." />
            </>,
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
            </div>,
            fieldErrors.decarbedThc
          )}

          {/* Fat preset */}
          {inputRow(
            <>
              Fat Preset
              <TooltipIcon text="Select a carrier fat. Each fat has a typical extraction efficiency based on its lipid profile and affinity for cannabinoids." />
            </>,
            <select
              className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
              onChange={e => handleFatChange(e.target.value)}
              value={infusion.fatId}
            >
              {INFUSION_FATS.map(f => (
                <option
                  className="bg-card text-foreground"
                  key={f.id}
                  value={f.id}
                >
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {/* Preset notes */}
          {preset.notes && (
            <p className="text-xs leading-relaxed text-foreground/70">
              {preset.notes}
            </p>
          )}

          {/* Extraction efficiency */}
          {inputRow(
            <>
              Extraction Efficiency
              {isCustom && <OverrideBadge />}
              <TooltipIcon text="The fraction of available THC that transfers into the fat during infusion. 0.82 = 82% transfer." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  isCustom
                    ? 'border-warning/60 focus:border-warning'
                    : fieldErrors.customEfficiency
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
                )}
                disabled={!isCustom}
                max={1}
                min={0}
                onChange={e =>
                  setInfusion({ customEfficiency: e.target.value })
                }
                placeholder={isCustom ? '0.00' : String(preset.extractionEff)}
                step="0.01"
                type="number"
                value={
                  isCustom
                    ? infusion.customEfficiency
                    : String(preset.extractionEff)
                }
              />
              <span className="text-sm text-foreground/70">
                {isCustom ? 'custom' : 'preset'}
              </span>
            </div>,
            fieldErrors.customEfficiency
          )}

          {/* Fat volume */}
          {inputRow(
            <>
              Fat Volume
              <TooltipIcon text="Total volume of carrier fat used for infusion." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.volume
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
                )}
                onChange={e => setInfusion({ volume: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={infusion.volume}
              />
              <UnitToggle
                onChange={handleVolumeUnitToggle}
                options={['mL', 'tsp', 'tbsp', 'cup'] as const}
                value={units.volumeUnit}
              />
            </div>,
            fieldErrors.volume
          )}
        </div>

        {/* ------------------- RESULTS PANEL ------------------- */}
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              Results
            </h3>
            {isCalculating && (
              <span className="inline-flex items-center gap-1 text-xs text-foreground/60">
                <Loader2 className="size-3.5 animate-spin" />
                Calculating&hellip;
              </span>
            )}
          </div>

          {/* Warnings */}
          {inlineWarnings.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 dark:bg-warning/10 px-3 py-2">
              {inlineWarnings.map(w => (
                <span
                  className="text-xs text-warning dark:text-warning"
                  key={w}
                >
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* Fat name badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70">
              {results?.fatName ?? preset.name}
            </span>
          </div>

          {/* Total infused THC */}
          <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Total Infused THC
            </span>
            <span
              className="result-bloom mt-1 text-2xl font-bold text-foreground"
              key={
                results
                  ? `infusion-thc-${fmt1(results.infusedThc)}`
                  : 'infusion-thc-empty'
              }
            >
              {results
                ? `${fmt1(results.infusedThc)} mg`
                : 'Enter your decarbed THC and fat volume above to see results'}
            </span>
          </div>

          {/* Per-unit */}
          <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Concentration
            </span>
            <span
              className="result-bloom mt-1 text-2xl font-bold text-success"
              key={
                results
                  ? `infusion-conc-${fmt1(results.mgPerUnit)}`
                  : 'infusion-conc-empty'
              }
            >
              {results
                ? `${fmt1(results.mgPerUnit)} ${results.unitLabel}`
                : 'Enter your decarbed THC and fat volume above to see results'}
            </span>
          </div>

          {/* Simplified multiplier estimate */}
          {!isCustom && (
            <div className="flex flex-col gap-1 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Simplified Estimate
              </span>
              <span className="text-lg font-semibold text-foreground">
                {results?.simplifiedEstimate != null
                  ? `${fmt1(results.simplifiedEstimate)} mg`
                  : 'Enter your decarbed THC and fat volume above to see results'}
              </span>
              <span className="text-xs text-foreground/70">
                Approximate total using {preset.simplifiedMultiplier}x
                multiplier (requires weight and THCA% from Decarb tab)
              </span>
            </div>
          )}

          {/* Show Formula */}
          <div>
            <button
              className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
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
              <div className="mt-2 rounded-lg border border-foreground/10 bg-foreground/30 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/70">
                <p className="mb-2">
                  <strong className="text-foreground/90">
                    Infused THC (mg)
                  </strong>{' '}
                  = decarbed THC (mg) x extraction efficiency
                </p>
                <p className="mb-2">
                  <strong className="text-foreground/90">mg per unit</strong> =
                  infused THC ÷ fat volume (in selected unit)
                </p>
                <p className="mb-2">
                  <strong className="text-foreground/90">
                    Simplified estimate
                  </strong>{' '}
                  = material weight (g) x THCA% x multiplier
                </p>
                <p className="mb-2 rounded-md border border-foreground/10 bg-foreground/50 px-3 py-2 text-foreground/80">
                  <strong className="text-foreground/90">
                    Multiplier derivation:
                  </strong>{' '}
                  multiplier = 0.877 x 10 x extraction_efficiency
                  <br />
                  <span className="text-foreground/60">
                    Example for Coconut Oil: 0.877 x 10 x 0.82 = 7.19 (rounded
                    to 7.2)
                  </span>
                </p>
                <p className="text-foreground/70">
                  Extraction efficiency represents the fraction of available THC
                  that successfully transfers into the carrier fat during
                  infusion. Real-world efficiency depends on fat type,
                  temperature, duration, and agitation.
                </p>
              </div>
            )}
          </div>
        </div>
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
