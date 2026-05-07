import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import { cn } from 'renderer/lib/utils'
import { Info, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
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
      <Info className="size-4 shrink-0 cursor-help text-white/70 transition-colors hover:text-white/80" />
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-xl">
          {text}
        </div>
      )}
    </button>
  )
}

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
    color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    description:
      'Below the standard microdose threshold. Effects are typically imperceptible. Suitable for building tolerance or very sensitive individuals.',
  },
  {
    key: 'microdose',
    label: 'Microdose',
    min: 2.5,
    max: 5,
    color: 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300',
    description:
      '2.5 to 5 mg per serving. Very mild effects. Good for beginners or those seeking functional, sub-perceptual benefits without impairment.',
  },
  {
    key: 'low',
    label: 'Low Tolerance',
    min: 5,
    max: 10,
    color: 'bg-teal-400/20 border-teal-400/40 text-teal-300',
    description:
      '5 to 10 mg per serving. Mild psychoactive effects. Suitable for users with low tolerance or those seeking light relaxation.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    min: 10,
    max: 25,
    color: 'bg-sky-400/20 border-sky-400/40 text-sky-300',
    description:
      '10 to 25 mg per serving. Noticeable effects for most users. A standard recreational dose for experienced consumers.',
  },
  {
    key: 'strong',
    label: 'Strong',
    min: 25,
    max: 50,
    color: 'bg-amber-400/20 border-amber-400/40 text-amber-300',
    description:
      '25 to 50 mg per serving. Strong effects. Recommended only for users with established tolerance and familiarity with cannabis.',
  },
  {
    key: 'very strong',
    label: 'Very Strong',
    min: 50,
    max: 100,
    color: 'bg-orange-400/20 border-orange-400/40 text-orange-300',
    description:
      '50 to 100 mg per serving. Very strong effects. High-tolerance users only. Risk of overconsumption and discomfort for most people.',
  },
  {
    key: 'extreme',
    label: 'Extreme',
    min: 100,
    max: null,
    color: 'bg-red-400/20 border-red-400/40 text-red-300',
    description:
      '100 mg or more per serving. Extremely potent. Only for users with very high tolerance. High risk of anxiety, paranoia, and physical discomfort.',
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
    errors.totalThc = 'Total THC is required'
  } else {
    const t = parseFloat(tStr)
    if (Number.isNaN(t)) errors.totalThc = 'Please enter a number'
    else if (t < 0) errors.totalThc = 'Total THC cannot be negative'
  }

  // Servings
  const sStr = servings.trim()
  if (sStr === '') {
    errors.servings = 'Servings is required'
  } else {
    const s = parseFloat(sStr)
    if (Number.isNaN(s)) errors.servings = 'Please enter a number'
    else if (s <= 0) errors.servings = 'Servings must be greater than 0'
  }

  return { errors }
}

/* ------------------------------------------------------------------ */
/* Visual Scale Indicator                                               */
/* ------------------------------------------------------------------ */

function DoseScale({ classification }: { classification: string }) {
  const activeIndex = DOSE_ZONES.findIndex(z => z.key === classification)

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-white/70">
        Dose Classification Scale
      </span>

      {/* Scale bar */}
      <div className="relative flex w-full">
        {DOSE_ZONES.map((zone, i) => {
          const isActive = i === activeIndex
          return (
            <div
              className={cn(
                'group relative flex flex-1 flex-col items-center gap-1 border-y border-l py-2 text-center transition-colors first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r',
                isActive
                  ? zone.color
                  : 'border-white/10 bg-white/5 text-white/70',
                isActive && 'z-10'
              )}
              key={zone.key}
            >
              {/* Active indicator (triangle) */}
              {isActive && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
                </div>
              )}

              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider',
                  isActive ? 'text-white' : 'text-white/70'
                )}
              >
                {zone.label}
              </span>
              <span className="text-[10px] text-white/70">
                {zone.max != null
                  ? `${zone.min}-${zone.max} mg`
                  : `${zone.min}+ mg`}
              </span>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 z-50 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-xl group-hover:block">
                {zone.description}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Render helpers                                                       */
/* ------------------------------------------------------------------ */

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

  /* Validation state (debounced) */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
    const timer = setTimeout(() => {
      const { errors } = validateDoseFields(dose.totalThc, dose.servings)

      setFieldErrors(errors)

      if (hasBlockingErrors(errors)) {
        setResults(null)
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
    }, 300)

    return () => clearTimeout(timer)
  }, [dose.totalThc, dose.servings, hasBlockingErrors])

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleReset = () => {
    resetDose()
    setResults(null)
    setFieldErrors({})
    setShowFormula(false)
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Dose Estimation</h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="dose" />
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

          {/* Total infused THC */}
          {inputRow(
            <>
              Total Infused THC
              <TooltipIcon text="Total amount of THC in milligrams present in the infused product. Use the output from the Infusion calculator." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className={cn(
                  'flex-1 rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                  fieldErrors.totalThc
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-white/20 focus:border-white/40'
                )}
                onChange={e => setDose({ totalThc: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={dose.totalThc}
              />
              <span className="text-sm text-white/70">mg</span>
            </div>,
            fieldErrors.totalThc
          )}

          {/* Number of servings */}
          {inputRow(
            <>
              Number of Servings
              <TooltipIcon text="How many individual servings the total infused product will be divided into." />
            </>,
            <input
              className={cn(
                'rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30',
                fieldErrors.servings
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-white/20 focus:border-white/40'
              )}
              onChange={e => setDose({ servings: e.target.value })}
              placeholder="0"
              step="1"
              type="number"
              value={dose.servings}
            />,
            fieldErrors.servings
          )}
        </div>

        {/* ------------------- RESULTS PANEL ------------------- */}
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Results
          </h3>

          {/* mg per serving */}
          <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">
              mg per Serving
            </span>
            <span className="mt-1 text-2xl font-bold text-white">
              {results
                ? `${fmt1(results.mgPerServing)} mg per serving`
                : '\u2014'}
            </span>
          </div>

          {/* Classification label */}
          <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">
              Classification
            </span>
            <span className="mt-1 text-2xl font-bold text-emerald-300">
              {results
                ? displayClassification(results.classification)
                : '\u2014'}
            </span>
          </div>

          {/* Visual scale */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            {results ? (
              <DoseScale classification={results.classification} />
            ) : (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-white/70">
                  Dose Classification Scale
                </span>
                <div className="flex w-full">
                  {DOSE_ZONES.map((zone, _i) => (
                    <div
                      className={cn(
                        'flex flex-1 flex-col items-center gap-1 border-y border-l py-2 text-center first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r',
                        'border-white/10 bg-white/5 text-white/70'
                      )}
                      key={zone.key}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        {zone.label}
                      </span>
                      <span className="text-[10px] text-white/70">
                        {zone.max != null
                          ? `${zone.min}-${zone.max} mg`
                          : `${zone.min}+ mg`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  <strong className="text-white/90">mg per serving</strong> =
                  total infused THC (mg) / number of servings
                </p>
                <p className="text-white/70">
                  The dose classification is based on the milligrams of THC per
                  individual serving. Individual tolerance varies significantly;
                  start low and adjust gradually.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-white/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, preparation technique, and
        measurement accuracy.
      </p>
    </div>
  )
}
