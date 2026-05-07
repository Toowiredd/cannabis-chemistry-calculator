import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import {
  calculateInfusedThc,
  calculateMgPerMl,
  calculateSimplifiedEstimate,
} from 'renderer/src/engine/infusion'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import { scaleRecipe } from 'renderer/src/engine/recipe'
import {
  gToOz,
  ozToG,
  cToF,
  fToC,
  mlToTsp,
  mlToTbsp,
  mlToCup,
} from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import {
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Scale,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Tag,
} from 'lucide-react'
import { LabelGenerator } from 'renderer/src/components/LabelGenerator'

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

function round1n(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
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

const STEPS = [
  { key: 'material', label: 'Material & Lab Data' },
  { key: 'decarb', label: 'Decarb Method' },
  { key: 'infusion', label: 'Fat & Volume' },
  { key: 'dose', label: 'Servings & Dose' },
  { key: 'label', label: 'Label & Save' },
] as const

type StepKey = (typeof STEPS)[number]['key']

export function QuickBatchTab() {
  const store = useAppStore()
  const decarb = useAppStore(s => s.decarb)
  const setDecarb = useAppStore(s => s.setDecarb)
  const infusion = useAppStore(s => s.infusion)
  const setInfusion = useAppStore(s => s.setInfusion)
  const dose = useAppStore(s => s.dose)
  const setDose = useAppStore(s => s.setDose)
  const units = useAppStore(s => s.units)
  const setUnits = useAppStore(s => s.setUnits)
  const resetDecarb = useAppStore(s => s.resetDecarb)
  const resetInfusion = useAppStore(s => s.resetInfusion)
  const resetDose = useAppStore(s => s.resetDose)
  const addJournalEntry = useAppStore(s => s.addJournalEntry)

  const [step, setStep] = useState<number>(0)
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({
    msg: '',
    visible: false,
  })

  const showToast = (msg: string) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }

  /* ---- Engine results (computed live) ---- */
  const results = useMemo(() => {
    const weight = parseFloat(decarb.weight)
    const thca = parseFloat(decarb.thcaPct)
    const thc = parseFloat(decarb.thcPct)
    const cbda = parseFloat(decarb.cbdaPct)
    const cbd = parseFloat(decarb.cbdPct)
    const method = DECARB_METHODS.find(m => m.id === decarb.presetId)

    const effLow = parseFloat(
      decarb.effLowOverride ?? String(method?.efficiency.low ?? 0.9)
    )
    const effExpected = parseFloat(
      decarb.effExpectedOverride ?? String(method?.efficiency.expected ?? 0.95)
    )
    const effHigh = parseFloat(
      decarb.effHighOverride ?? String(method?.efficiency.high ?? 0.98)
    )

    const hasDecarb =
      !Number.isNaN(weight) && !Number.isNaN(thca) && !Number.isNaN(thc)
    const theoreticalMax = hasDecarb
      ? calculateTheoreticalMax(weight, thca, thc)
      : 0
    const decarbedLow = hasDecarb
      ? calculateDecarbedThc(theoreticalMax, effLow)
      : 0
    const decarbedExpected = hasDecarb
      ? calculateDecarbedThc(theoreticalMax, effExpected)
      : 0
    const decarbedHigh = hasDecarb
      ? calculateDecarbedThc(theoreticalMax, effHigh)
      : 0

    const fat = INFUSION_FATS.find(f => f.id === infusion.fatId)
    const extractionEff =
      infusion.fatId === 'custom'
        ? parseFloat(infusion.customEfficiency)
        : (fat?.extractionEff ?? 0.82)

    const decarbedThc = parseFloat(
      infusion.decarbedThc || String(decarbedExpected)
    )
    const hasInfusion = !Number.isNaN(decarbedThc)
    const infusedThc =
      hasInfusion && !Number.isNaN(extractionEff)
        ? calculateInfusedThc(decarbedThc, extractionEff)
        : 0

    const vol = parseFloat(infusion.volume)
    const volMl =
      units.volumeUnit === 'mL'
        ? vol
        : units.volumeUnit === 'tsp'
          ? vol * 4.929
          : units.volumeUnit === 'tbsp'
            ? vol * 14.787
            : vol * 236.588
    const mgPerMl =
      volMl > 0 && !Number.isNaN(volMl)
        ? calculateMgPerMl(infusedThc, volMl)
        : 0

    const totalThc = parseFloat(dose.totalThc || String(infusedThc))
    const servings = parseFloat(dose.servings)
    const hasDose =
      !Number.isNaN(totalThc) && !Number.isNaN(servings) && servings > 0
    const mgPerServing = hasDose ? calculateMgPerServing(totalThc, servings) : 0
    const classification = hasDose ? classifyDose(mgPerServing) : ''

    return {
      theoreticalMax,
      decarbedLow,
      decarbedExpected,
      decarbedHigh,
      infusedThc,
      mgPerMl,
      mgPerServing,
      classification,
      method,
      fat,
      extractionEff,
    }
  }, [decarb, infusion, dose, units])

  /* Keep upstream carry-forward in sync */
  useEffect(() => {
    if (results.decarbedExpected > 0) {
      store.setLastDecarbExpected(String(round1n(results.decarbedExpected)))
    }
    if (results.infusedThc > 0) {
      store.setLastInfusedThc(String(round1n(results.infusedThc)))
    }
  }, [results.decarbedExpected, results.infusedThc, store])

  /* Scale batch handler */
  const [scaleOpen, setScaleOpen] = useState(false)
  const [customScale, setCustomScale] = useState('')
  const [scaleError, setScaleError] = useState('')

  const handleScale = useCallback(
    (factor: number) => {
      setScaleError('')
      const recipe = {
        version: '1.0.0',
        name: 'current',
        createdAt: new Date().toISOString(),
        units,
        decarb,
        infusion,
        dose,
      }
      try {
        const scaled = scaleRecipe(recipe, factor)
        setDecarb(scaled.decarb)
        setInfusion(scaled.infusion)
        setDose(scaled.dose)
        setScaleOpen(false)
        setCustomScale('')
        showToast(`Batch scaled by ${factor}x`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Scale failed'
        setScaleError(msg)
      }
    },
    [units, decarb, infusion, dose, setDecarb, setInfusion, setDose]
  )

  /* Save to journal */
  const handleSaveBatch = async () => {
    const method = results.method
    const fat = results.fat

    const entry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString().split('T')[0],
      strainName: '',
      materialWeight: decarb.weight,
      thcaPct: decarb.thcaPct,
      thcPct: decarb.thcPct,
      cbdaPct: decarb.cbdaPct,
      cbdPct: decarb.cbdPct,
      methodId: decarb.presetId,
      methodName: method?.name ?? '',
      fatId: infusion.fatId,
      fatName: fat?.name ?? '',
      servings: dose.servings,
      mgPerServing: fmt1(results.mgPerServing),
      classification: results.classification,
      totalInfusedThc: fmt1(results.infusedThc),
      concentration: fmt1(results.mgPerMl),
      volume: infusion.volume,
      volumeUnit: units.volumeUnit,
      notes: `Quick Batch saved. Theoretical max: ${fmt1(results.theoreticalMax)} mg. Decarb expected: ${fmt1(results.decarbedExpected)} mg.`,
    }

    try {
      const result = await window.App.saveJournalEntry(entry)
      if (result.success) {
        addJournalEntry(entry)
        showToast('Batch saved to Journal')
      } else {
        showToast(result.error ?? 'Save failed')
      }
    } catch {
      // Fallback: just add to local store if IPC fails
      addJournalEntry(entry)
      showToast('Batch saved to Journal (local)')
    }
  }

  /* Reset */
  const handleReset = () => {
    resetDecarb()
    resetInfusion()
    resetDose()
    setStep(0)
    setScaleOpen(false)
    setCustomScale('')
    setScaleError('')
  }

  /* Step helpers */
  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  /* Temp override display */
  const tempDisplay = useMemo(() => {
    const method = DECARB_METHODS.find(m => m.id === decarb.presetId)
    const base = method?.tempC ?? 95
    const val = decarb.tempOverride ? parseFloat(decarb.tempOverride) : base
    if (Number.isNaN(val)) return '--'
    return units.tempUnit === 'F' ? round1n(cToF(val)) : round1n(val)
  }, [decarb.presetId, decarb.tempOverride, units.tempUnit])

  /* Validation helpers */
  const materialValid =
    !Number.isNaN(parseFloat(decarb.weight)) &&
    parseFloat(decarb.weight) > 0 &&
    !Number.isNaN(parseFloat(decarb.thcaPct)) &&
    parseFloat(decarb.thcaPct) >= 0

  const inputRow = (
    label: React.ReactNode,
    children: React.ReactNode,
    error?: string
  ) => (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">Quick Batch</h2>
          <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleReset}
          type="button"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            className={cn(
              'flex-1 rounded-lg py-2 text-xs font-medium transition-colors',
              i === step
                ? 'bg-foreground/15 text-foreground border border-foreground/20'
                : i < step
                  ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20'
                  : 'bg-foreground/5 text-foreground/50 border border-foreground/10'
            )}
            key={s.key}
            onClick={() => setStep(i)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ---- STEP 1: Material & Lab Data ---- */}
      {step === 0 && (
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Material &amp; Lab Data
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inputRow(
              <>
                Material Weight
                <TooltipIcon text="Total weight of raw cannabis material before decarboxylation." />
              </>,
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e => setDecarb({ weight: e.target.value })}
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={decarb.weight}
                />
                <div className="inline-flex shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5">
                  {(['g', 'oz'] as const).map(u => (
                    <button
                      className={cn(
                        'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                        units.weightUnit === u
                          ? 'bg-foreground/15 text-foreground'
                          : 'text-foreground/70 hover:text-foreground/80'
                      )}
                      key={u}
                      onClick={() => setUnits({ weightUnit: u })}
                      type="button"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inputRow(
              <>
                THCA %
                <TooltipIcon text="Tetrahydrocannabinolic acid -- the non-psychoactive precursor to THC." />
              </>,
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setDecarb({ thcaPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.thcaPct}
              />
            )}

            {inputRow(
              <>
                Existing THC %
                <TooltipIcon text="Delta-9-THC already present in the material." />
              </>,
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setDecarb({ thcPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.thcPct}
              />
            )}

            {inputRow(
              <>
                CBDA %
                <TooltipIcon text="Cannabidiolic acid -- the non-psychoactive precursor to CBD." />
              </>,
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setDecarb({ cbdaPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.cbdaPct}
              />
            )}

            {inputRow(
              <>
                Existing CBD %
                <TooltipIcon text="Cannabidiol already present in the material." />
              </>,
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setDecarb({ cbdPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.cbdPct}
              />
            )}
          </div>

          {results.theoreticalMax > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Theoretical Maximum THC
              </span>
              <span className="text-lg font-bold text-foreground">
                {fmt1(results.theoreticalMax)} mg
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25 disabled:opacity-50"
              disabled={!materialValid}
              onClick={nextStep}
              type="button"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 2: Decarb Method ---- */}
      {step === 1 && (
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Decarb Method
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DECARB_METHODS.map(method => {
              const isSelected = decarb.presetId === method.id
              return (
                <button
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-amber-400/50 bg-amber-100 dark:bg-amber-400/10'
                      : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
                  )}
                  key={method.id}
                  onClick={() => setDecarb({ presetId: method.id })}
                  type="button"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {method.name}
                  </span>
                  <span className="text-xs text-foreground/70">
                    {units.tempUnit === 'F'
                      ? `${round1n(cToF(method.tempC))} F`
                      : `${method.tempC} C`}{' '}
                    / {method.timeMin}-{method.timeMax} min
                  </span>
                  <span className="text-xs text-foreground/70">
                    Efficiency: {Math.round(method.efficiency.low * 100)}-
                    {Math.round(method.efficiency.high * 100)}%
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/70">
                      {method.terpeneLabel}
                    </span>
                    <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/70">
                      {method.cbnLabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {results.decarbedExpected > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Decarb Expected THC
              </span>
              <span className="text-lg font-bold text-foreground">
                {fmt1(results.decarbedExpected)} mg
              </span>
              <span className="text-xs text-foreground/70">
                ({fmt1(results.decarbedLow)} - {fmt1(results.decarbedHigh)})
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 3: Fat & Volume ---- */}
      {step === 2 && (
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Fat &amp; Volume
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INFUSION_FATS.map(fat => {
              const isSelected = infusion.fatId === fat.id
              return (
                <button
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-emerald-400/50 bg-emerald-400/10'
                      : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
                  )}
                  key={fat.id}
                  onClick={() => setInfusion({ fatId: fat.id })}
                  type="button"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {fat.name}
                  </span>
                  <span className="text-xs text-foreground/70">
                    Extraction: {Math.round(fat.extractionEff * 100)}%
                  </span>
                  {fat.notes && (
                    <span className="text-xs text-foreground/60">
                      {fat.notes}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {inputRow(
            <>
              Fat Volume
              <TooltipIcon text="Total volume of carrier fat used for infusion." />
            </>,
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setInfusion({ volume: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={infusion.volume}
              />
              <div className="inline-flex shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5">
                {(['mL', 'tsp', 'tbsp', 'cup'] as const).map(u => (
                  <button
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      units.volumeUnit === u
                        ? 'bg-foreground/15 text-foreground'
                        : 'text-foreground/70 hover:text-foreground/80'
                    )}
                    key={u}
                    onClick={() => setUnits({ volumeUnit: u })}
                    type="button"
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.infusedThc > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Total Infused THC
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fmt1(results.infusedThc)} mg
                </span>
              </div>
              {results.mgPerMl > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                    Concentration
                  </span>
                  <span className="text-sm font-semibold text-emerald-300">
                    {fmt1(results.mgPerMl)} mg/mL
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 4: Servings & Dose ---- */}
      {step === 3 && (
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Servings &amp; Dose
          </h3>

          {inputRow(
            <>
              Number of Servings
              <TooltipIcon text="How many individual servings the total infused product will be divided into." />
            </>,
            <input
              className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setDose({ servings: e.target.value })}
              placeholder="0"
              step="1"
              type="number"
              value={dose.servings}
            />
          )}

          {/* Scale Batch */}
          <div className="mt-1 flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/70">
                <Scale className="size-3.5" />
                Scale Batch
              </span>
              <button
                className="text-[10px] font-medium text-foreground/70 transition-colors hover:text-foreground"
                onClick={() => setScaleOpen(v => !v)}
                type="button"
              >
                {scaleOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            {scaleOpen && (
              <>
                <div className="flex items-center gap-2">
                  {([0.5, 2, 4] as const).map(factor => (
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      key={factor}
                      onClick={() => handleScale(factor)}
                      type="button"
                    >
                      {factor}x
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                    className="inline-flex items-center rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
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
                  <span className="text-xs text-red-500">{scaleError}</span>
                )}
              </>
            )}
          </div>

          {results.mgPerServing > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  mg per Serving
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {fmt1(results.mgPerServing)} mg
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Classification
                </span>
                <span className="text-xl font-bold text-emerald-300">
                  {results.classification}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 5: Label & Save ---- */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              Label &amp; Save
            </h3>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Material
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {decarb.weight} g
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Method
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {results.method?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Fat
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {results.fat?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Servings
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {dose.servings}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Theoretical Max
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.theoreticalMax)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Infused THC
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.infusedThc)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  mg/Serving
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.mgPerServing)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-foreground/60">
                  Classification
                </span>
                <span className="text-sm font-semibold text-emerald-300">
                  {results.classification}
                </span>
              </div>
            </div>

            {/* Label generator */}
            {results.mgPerServing > 0 && (
              <LabelGenerator
                classification={results.classification}
                mgPerServing={results.mgPerServing}
                servings={parseFloat(dose.servings) || 0}
              />
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={prevStep}
                type="button"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
                  onClick={handleSaveBatch}
                  type="button"
                >
                  <BookOpen className="size-4" />
                  Save Batch to Journal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 shadow-xl backdrop-blur-md">
          {toast.msg}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, technique, and measurement
        accuracy.
      </p>
    </div>
  )
}
