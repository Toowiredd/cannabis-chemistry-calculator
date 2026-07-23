import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import { reverseFullWorkflow } from 'renderer/src/engine/reverse'
import { scaleRecipe } from 'renderer/src/engine/recipe'
import { fmt1 } from 'renderer/src/engine/formatting'
import {
  EDIBLE_FORMATS,
  DECARB_METHODS,
  INFUSION_FATS,
} from 'renderer/src/engine/models'
import { cn } from 'renderer/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Scale,
  ArrowDownUp,
  Loader2,
} from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'
import { LabelGenerator } from 'renderer/src/components/LabelGenerator'
import { InputRow } from 'renderer/src/components/InputRow'
import { TooltipIcon } from 'renderer/src/components/TooltipIcon'
import { DoseRadarChart } from 'renderer/src/components/DoseRadarChart'
import { SmartSuggestPanel } from 'renderer/src/components/SmartSuggestPanel'

/* ------------------------------------------------------------------ */
/* Small helpers (canonical versions imported from engine/formatting)   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Classification definitions                                           */
/* ------------------------------------------------------------------ */

interface DoseZone {
  key: string
  label: string
  min: number
  max: number | null
  color: string
  description: string
}

const DOSE_ZONES: DoseZone[] = [
  {
    key: 'sub-microdose',
    label: 'Sub-Microdose',
    min: 0,
    max: 2.5,
    color: 'bg-success/20 border-success/40 text-success',
    description:
      'Barely there. Good for building tolerance gently, or if you are very sensitive.',
  },
  {
    key: 'microdose',
    label: 'Microdose',
    min: 2.5,
    max: 5,
    color: 'bg-success/20 border-success/40 text-success',
    description:
      'Very mild. Great starting point if you are new to this or want to stay functional.',
  },
  {
    key: 'low',
    label: 'Low Tolerance',
    min: 5,
    max: 10,
    color: 'bg-success/20 border-success/40 text-success',
    description:
      'Light effects. Good if you have a low tolerance or just want to unwind a little.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    min: 10,
    max: 25,
    color:
      'bg-info/10 dark:bg-info/20 border-info/40 dark:border-info/40 text-info dark:text-info',
    description:
      'For most people this is the sweet spot. Noticeable but not overwhelming.',
  },
  {
    key: 'strong',
    label: 'Strong',
    min: 25,
    max: 50,
    color:
      'bg-warning/10 dark:bg-warning/20 border-warning/40 dark:border-warning/40 text-warning dark:text-warning',
    description: 'Strong. Only go here if you know your tolerance well.',
  },
  {
    key: 'very strong',
    label: 'Very Strong',
    min: 50,
    max: 100,
    color: 'bg-warning/20 border-warning/40 text-warning',
    description:
      'Very strong. High-tolerance users only -- this will be too much for most people.',
  },
  {
    key: 'extreme',
    label: 'Extreme',
    min: 100,
    max: null,
    color: 'bg-danger/20 border-danger/40 text-danger',
    description:
      'Extremely potent. Only for very high tolerance. High risk of a really uncomfortable time.',
  },
]

function getZone(classification: string): DoseZone | undefined {
  return DOSE_ZONES.find(z => z.key === classification)
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  totalThc?: string
  servings?: string
}

function validateDoseFields(
  totalThc: string,
  servings: string
): { errors: FieldErrors } {
  const errors: FieldErrors = {}

  // Total THC
  const tStr = totalThc.trim()
  if (tStr === '') {
    errors.totalThc = 'How much total THC is in your infusion?'
  } else {
    const t = parseFloat(tStr)
    if (Number.isNaN(t)) errors.totalThc = 'That does not look like a number'
    else if (t < 0) errors.totalThc = 'THC amount cannot be negative'
  }

  // Servings
  const sStr = servings.trim()
  if (sStr === '') {
    errors.servings = 'How many servings are you planning?'
  } else {
    const s = parseFloat(sStr)
    if (Number.isNaN(s)) errors.servings = 'That does not look like a number'
    else if (s <= 0) errors.servings = 'Servings needs to be a positive number'
  }

  return { errors }
}

/* ------------------------------------------------------------------ */
/* Reverse mode validation                                             */
/* ------------------------------------------------------------------ */

interface ReverseFieldErrors {
  desiredMgPerServing?: string
  servings?: string
}

function validateReverseFields(
  desiredMgPerServing: string,
  servings: string
): { errors: ReverseFieldErrors } {
  const errors: ReverseFieldErrors = {}

  const dStr = desiredMgPerServing.trim()
  if (dStr === '') {
    errors.desiredMgPerServing = 'What dose do you want per serving?'
  } else {
    const d = parseFloat(dStr)
    if (Number.isNaN(d))
      errors.desiredMgPerServing = 'That does not look like a number'
    else if (d < 0) errors.desiredMgPerServing = 'Dose cannot be negative'
    else if (d > 500)
      errors.desiredMgPerServing =
        'That is an extraordinarily high dose. Double-check your units.'
  }

  const sStr = servings.trim()
  if (sStr === '') {
    errors.servings = 'How many servings are you planning?'
  } else {
    const s = parseFloat(sStr)
    if (Number.isNaN(s)) errors.servings = 'That does not look like a number'
    else if (s <= 0) errors.servings = 'Servings needs to be a positive number'
  }

  return { errors }
}

/* ------------------------------------------------------------------ */
/* Visual Scale Indicator                                               */
/* ------------------------------------------------------------------ */

function DoseScale({ classification }: { classification: string }) {
  const activeIndex = DOSE_ZONES.findIndex(z => z.key === classification)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
        Dose Classification Scale
      </span>

      {/* Scale bar */}
      <div className="relative w-full overflow-visible sm:overflow-x-auto sm:pb-1">
        <div className="grid grid-cols-1 gap-1 sm:flex sm:min-w-[680px] sm:gap-0">
          {DOSE_ZONES.map((zone, i) => {
            const isActive = i === activeIndex
            return (
              <div
                className={cn(
                  'group relative flex min-h-11 flex-1 items-center justify-between gap-2 border px-3 py-2 text-left transition-colors sm:flex-col sm:items-center sm:justify-start sm:gap-1 sm:border-y sm:border-l sm:border-r-0 sm:px-2 sm:text-center sm:first:rounded-l-lg sm:last:rounded-r-lg sm:last:border-r',
                  isActive
                    ? zone.color
                    : 'border-foreground/10 bg-foreground/5 text-foreground/70',
                  isActive && 'z-10'
                )}
                key={zone.key}
              >
                {/* Active indicator (triangle) */}
                {isActive && (
                  <div className="absolute -top-2 left-1/2 hidden -translate-x-1/2 sm:block">
                    <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
                  </div>
                )}

                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    isActive ? 'text-foreground' : 'text-foreground/70'
                  )}
                >
                  {zone.label}
                </span>
                <span className="shrink-0 text-xs text-foreground/70">
                  {zone.max != null
                    ? `${zone.min}-${zone.max} mg`
                    : `${zone.min}+ mg`}
                </span>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 z-50 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-foreground/20 bg-card px-3 py-2 text-xs leading-relaxed text-foreground/90 shadow-xl sm:group-hover:block">
                  {zone.description}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Classification label map                                             */
/* ------------------------------------------------------------------ */

function displayClassification(raw: string): string {
  const zone = getZone(raw)
  return zone?.label ?? raw
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export function DoseTab() {
  /* Store bindings */
  const dose = useAppStore(s => s.dose)
  const setDose = useAppStore(s => s.setDose)
  const resetDose = useAppStore(s => s.resetDose)
  const lastInfusedThc = useAppStore(s => s.lastInfusedThc)
  const recordSuccessfulPath = useAppStore(s => s.recordSuccessfulPath)
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const isReverse = dose.reverseMode

  /* Track the last upstream value we synced, so we can overwrite our own
     auto-fill but NOT a manual user edit. */
  const syncedInfusionRef = useRef<string>('')

  /* Reactive auto-fill from upstream infusion result */
  useEffect(() => {
    if (lastInfusedThc) {
      const current = dose.totalThc.trim()
      // Fill if empty, or if the field still contains exactly what we last synced
      if (!current || current === syncedInfusionRef.current) {
        setDose({ totalThc: lastInfusedThc })
        syncedInfusionRef.current = lastInfusedThc
      }
    }
  }, [dose.totalThc, lastInfusedThc, setDose])

  /* Local UI state */
  const [showFormula, setShowFormula] = useState(false)
  const [results, setResults] = useState<{
    mgPerServing: number
    classification: string
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  /* Validation state (debounced) */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  /* Reverse mode state */
  const [reverseFieldErrors, setReverseFieldErrors] =
    useState<ReverseFieldErrors>({})
  const [reverseGrams, setReverseGrams] = useState<number | null>(null)
  const [reverseError, setReverseError] = useState<string | null>(null)

  /* Refs for SmartSuggest FLIP target */
  const servingsInputRef = useRef<HTMLInputElement>(null)
  const formatSelectRef = useRef<HTMLSelectElement>(null)

  /* Scale batch local state */
  const [scaleOpen, setScaleOpen] = useState(false)
  const [customScale, setCustomScale] = useState<string>('')
  const [scaleError, setScaleError] = useState<string>('')
  const recordedResultRef = useRef<string | null>(null)

  const handleScale = useCallback((factor: number) => {
    setScaleError('')
    const store = useAppStore.getState()
    const recipe = {
      version: '1.0.0',
      name: 'current',
      createdAt: new Date().toISOString(),
      units: store.units,
      decarb: store.decarb,
      infusion: store.infusion,
      dose: store.dose,
    }
    try {
      const scaled = scaleRecipe(recipe, factor)
      store.setDecarb(scaled.decarb)
      store.setInfusion(scaled.infusion)
      store.setDose(scaled.dose)
      if (scaled.computed) {
        store.setLastDecarbExpected(
          String(scaled.computed.decarbedRange.expected)
        )
        store.setLastInfusedThc(String(scaled.computed.infusedThc))
      }
      setScaleOpen(false)
      setCustomScale('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scale failed'
      setScaleError(msg)
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /* Derived helpers                                                  */
  /* ---------------------------------------------------------------- */

  const hasBlockingErrors = useCallback(
    (errs: FieldErrors) => !!(errs.totalThc || errs.servings),
    []
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const { errors } = validateDoseFields(dose.totalThc, dose.servings)

      setFieldErrors(errors)

      if (hasBlockingErrors(errors)) {
        setResults(null)
        setIsCalculating(false)
        return
      }

      try {
        const totalThc = parseFloat(dose.totalThc)
        const servings = parseFloat(dose.servings)
        const mgPerServing = calculateMgPerServing(totalThc, servings)
        const classification = classifyDose(mgPerServing)

        setResults({ mgPerServing, classification })
      } catch {
        setResults(null)
      }
      setIsCalculating(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [dose.totalThc, dose.servings, hasBlockingErrors])

  useEffect(() => {
    if (isReverse || !results) return

    const totalThc = parseFloat(dose.totalThc)
    const servings = parseFloat(dose.servings)
    if (Number.isNaN(totalThc) || Number.isNaN(servings) || servings <= 0) {
      return
    }

    // Record one meaningful completed dose calculation per distinct result
    // signature so the startup heuristic learns from finished outcomes rather
    // than every keystroke.
    const signature = [
      dose.totalThc.trim(),
      dose.servings.trim(),
      fmt1(results.mgPerServing),
      results.classification,
    ].join('|')

    if (recordedResultRef.current === signature) return
    recordedResultRef.current = signature
    recordSuccessfulPath('manual_calculator', 'dose')
  }, [dose.servings, dose.totalThc, isReverse, recordSuccessfulPath, results])

  /* ---------------------------------------------------------------- */
  /* Debounced reverse calculation                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!isReverse) {
      setReverseGrams(null)
      setReverseError(null)
      setReverseFieldErrors({})
      return
    }

    const timer = setTimeout(() => {
      const { errors } = validateReverseFields(
        dose.desiredMgPerServing,
        dose.servings
      )
      setReverseFieldErrors(errors)

      if (errors.desiredMgPerServing || errors.servings) {
        setReverseGrams(null)
        setReverseError(null)
        return
      }

      try {
        const method =
          DECARB_METHODS.find(m => m.id === decarb.presetId) ??
          DECARB_METHODS[0]
        const fat =
          INFUSION_FATS.find(f => f.id === infusion.fatId) ?? INFUSION_FATS[0]

        const result = reverseFullWorkflow({
          desiredMgPerServing: parseFloat(dose.desiredMgPerServing),
          servings: parseFloat(dose.servings),
          thcaPct: parseFloat(decarb.thcaPct) || 0,
          thcPct: parseFloat(decarb.thcPct) || 0,
          decarbEfficiency: decarb.effExpectedOverride
            ? parseFloat(decarb.effExpectedOverride)
            : method.efficiency.expected,
          extractionEfficiency: infusion.customEfficiency
            ? parseFloat(infusion.customEfficiency)
            : fat.extractionEff,
        })

        setReverseGrams(result)
        setReverseError(null)
      } catch (err: unknown) {
        setReverseGrams(null)
        const msg = err instanceof Error ? err.message : 'Calculation failed'
        setReverseError(msg)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [
    isReverse,
    dose.desiredMgPerServing,
    dose.servings,
    decarb.presetId,
    decarb.thcaPct,
    decarb.thcPct,
    decarb.effExpectedOverride,
    infusion.fatId,
    infusion.customEfficiency,
  ])

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleReset = () => {
    resetDose()
    recordedResultRef.current = null
    setResults(null)
    setFieldErrors({})
    setShowFormula(false)
  }

  /*
   * Escape is intentionally non-destructive on this screen. The dose calculator
   * can represent a completed recipe, so reset must remain an explicit button
   * action rather than a global keyboard shortcut.
   */

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          Dose Estimation
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <TabActions tabId="dose" />
          <button
            className={cn(
              'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none',
              isReverse
                ? 'border-accent/40 bg-accent/10 text-accent-foreground hover:bg-accent/20'
                : 'border-foreground/20 bg-foreground/5 text-foreground/80 hover:bg-foreground/10 hover:text-foreground'
            )}
            onClick={() => setDose({ reverseMode: !isReverse })}
            type="button"
          >
            <ArrowDownUp className="size-3.5" />
            {isReverse ? 'Reverse Mode (on)' : 'Reverse Mode'}
          </button>
          <button
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground sm:flex-none"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* ------------------- INPUT PANEL ------------------- */}
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Input
          </h3>

          {/* Total infused THC — hidden in reverse mode */}
          {!isReverse && (
            <InputRow
              error={fieldErrors.totalThc}
              label={
                <>
                  Total Infused THC
                  {dose.totalThc === lastInfusedThc && lastInfusedThc && (
                    <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                      Auto-filled from Infusion
                    </span>
                  )}
                  <TooltipIcon text="Total amount of THC in milligrams present in the infused product. Use the output from the Infusion calculator." />
                </>
              }
            >
              {
                <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                  <input
                    className={cn(
                      'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                      fieldErrors.totalThc
                        ? 'border-danger/60 focus:border-danger'
                        : 'border-foreground/20 focus:border-foreground/40'
                    )}
                    onChange={e => setDose({ totalThc: e.target.value })}
                    placeholder="0.0"
                    step="0.1"
                    type="number"
                    value={dose.totalThc}
                  />
                  <span className="text-sm text-foreground/70">mg</span>
                </div>
              }
            </InputRow>
          )}

          {/* Reverse mode inputs */}
          {isReverse && (
            <>
              <InputRow
                error={reverseFieldErrors.desiredMgPerServing}
                label={
                  <>
                    Desired mg per Serving
                    <TooltipIcon text="How many milligrams of THC you want in each individual serving. The calculator works backward from this number." />
                  </>
                }
              >
                {
                  <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                    <input
                      className={cn(
                        'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                        reverseFieldErrors.desiredMgPerServing
                          ? 'border-danger/60 focus:border-danger'
                          : 'border-foreground/20 focus:border-foreground/40'
                      )}
                      onChange={e =>
                        setDose({ desiredMgPerServing: e.target.value })
                      }
                      placeholder="10.0"
                      step="0.1"
                      type="number"
                      value={dose.desiredMgPerServing}
                    />
                    <span className="text-sm text-foreground/70">mg</span>
                  </div>
                }
              </InputRow>

              {/* Reverse result card — inline in input panel */}
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Required Material
                </span>
                {reverseError ? (
                  <span className="mt-1 block text-sm text-danger">
                    {reverseError}
                  </span>
                ) : (
                  <span className="mt-1 block text-2xl font-bold text-accent-foreground">
                    {reverseGrams != null
                      ? `${reverseGrams.toFixed(2)} g`
                      : '\u2014'}
                  </span>
                )}
                <p className="mt-2 text-xs leading-relaxed text-foreground/60">
                  Uses currently selected decarb method and fat efficiency.
                </p>
              </div>
            </>
          )}

          {/* Edible Format — hidden in reverse mode */}
          {!isReverse && (
            <InputRow
              label={
                <>
                  Edible Format
                  <TooltipIcon text="Select a common edible format to auto-fill the recommended number of servings." />
                </>
              }
            >
              {
                <select
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                  onChange={e => {
                    const formatId = e.target.value
                    const fmt = EDIBLE_FORMATS.find(f => f.id === formatId)
                    setDose({
                      formatId,
                      servings: String(fmt?.suggestedServings ?? 10),
                    })
                  }}
                  ref={formatSelectRef}
                  value={dose.formatId ?? 'custom'}
                >
                  {EDIBLE_FORMATS.map(f => (
                    <option
                      className="bg-card text-foreground"
                      key={f.id}
                      value={f.id}
                    >
                      {f.name}
                    </option>
                  ))}
                </select>
              }
            </InputRow>
          )}

          {/* Number of servings */}
          <InputRow
            error={fieldErrors.servings}
            label={
              <>
                Number of Servings
                <TooltipIcon text="How many individual servings the total infused product will be divided into." />
              </>
            }
          >
            {
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.servings
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
                )}
                onChange={e => setDose({ servings: e.target.value })}
                placeholder="0"
                ref={servingsInputRef}
                step="1"
                type="number"
                value={dose.servings}
              />
            }
          </InputRow>

          {/* Scale Batch */}
          <div className="mt-1 flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/70">
                <Scale className="size-3.5" />
                Scale Batch
              </span>
              <button
                className="text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
                onClick={() => setScaleOpen(v => !v)}
                type="button"
              >
                {scaleOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            {scaleOpen && (
              <>
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                  {([0.5, 2, 4] as const).map(factor => (
                    <button
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      key={factor}
                      onClick={() => handleScale(factor)}
                      type="button"
                    >
                      {factor}x
                    </button>
                  ))}
                </div>
                <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                    onChange={e => {
                      setCustomScale(e.target.value)
                      setScaleError('')
                    }}
                    placeholder="Custom factor"
                    step="0.1"
                    type="number"
                    value={customScale}
                  />
                  <button
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onClick={() => {
                      const n = parseFloat(customScale)
                      if (!Number.isNaN(n) && n > 0) {
                        handleScale(n)
                      } else {
                        setScaleError('Enter a positive number')
                      }
                    }}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
                {scaleError && (
                  <span className="text-xs text-danger">{scaleError}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ------------------- RESULTS PANEL ------------------- */}
        {!isReverse && (
          <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            {/* mg per serving */}
            <div
              aria-live="polite"
              className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                mg per Serving
              </span>
              <span
                className="result-bloom mt-1 text-2xl font-bold text-foreground"
                key={
                  results
                    ? `dose-mg-${fmt1(results.mgPerServing)}`
                    : 'dose-mg-empty'
                }
              >
                {results
                  ? `${fmt1(results.mgPerServing)} mg per serving`
                  : 'Enter total THC and number of servings above to see results'}
              </span>
            </div>

            {/* Classification label */}
            <div
              aria-live="polite"
              className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Classification
              </span>
              <span
                className="result-bloom mt-1 text-2xl font-bold text-success"
                key={
                  results
                    ? `dose-class-${displayClassification(results.classification)}`
                    : 'dose-class-empty'
                }
              >
                {results
                  ? displayClassification(results.classification)
                  : '\u2014'}
              </span>
            </div>

            {/* Radar Chart */}
            <DoseRadarChart />

            {/* Visual scale */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              {results ? (
                <DoseScale classification={results.classification} />
              ) : (
                <div className="flex min-w-0 flex-col gap-5">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                    Dose Classification Scale
                  </span>
                  <div className="w-full overflow-visible sm:overflow-x-auto sm:pb-1">
                    <div className="grid grid-cols-1 gap-1 sm:flex sm:min-w-[680px] sm:gap-0">
                      {DOSE_ZONES.map((zone, _i) => (
                        <div
                          className={cn(
                            'flex min-h-11 flex-1 items-center justify-between gap-2 border px-3 py-2 text-left sm:flex-col sm:items-center sm:justify-start sm:gap-1 sm:border-y sm:border-l sm:border-r-0 sm:px-2 sm:text-center sm:first:rounded-l-lg sm:last:rounded-r-lg sm:last:border-r',
                            'border-foreground/10 bg-foreground/5 text-foreground/70'
                          )}
                          key={zone.key}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                            {zone.label}
                          </span>
                          <span className="shrink-0 text-xs text-foreground/70">
                            {zone.max != null
                              ? `${zone.min}-${zone.max} mg`
                              : `${zone.min}+ mg`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                      mg per serving
                    </strong>{' '}
                    = total infused THC (mg) / number of servings
                  </p>
                  <p className="text-foreground/70">
                    The dose classification is based on the milligrams of THC
                    per individual serving. Individual tolerance varies
                    significantly; start low and adjust gradually.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------- LABEL GENERATOR ------------------- */}
        {!isReverse && results && (
          <div className="flex flex-col gap-5">
            <LabelGenerator
              classification={displayClassification(results.classification)}
              mgPerServing={results.mgPerServing}
              servings={parseFloat(dose.servings) || 0}
            />
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      {!isReverse && results && (
        <SmartSuggestPanel
          fatId={infusion.fatId}
          formatInputRef={formatSelectRef}
          mgPerServing={results.mgPerServing}
          servingsInputRef={servingsInputRef}
        />
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, preparation technique, and
        measurement accuracy.
      </p>
    </div>
  )
}
