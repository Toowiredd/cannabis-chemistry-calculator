import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import {
  calculateTheoreticalMaxCbd,
  calculateDecarbedCbd,
} from 'renderer/src/engine/cbda'
import {
  CONCENTRATE_TYPES,
  calculateConcentrateTheoreticalMax,
  calculateConcentrateRange,
} from 'renderer/src/engine/concentrate'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import type { Strain } from 'renderer/src/engine/models'
import { cToF, fToC, gToOz, ozToG } from 'renderer/src/engine/units'
import { minSigFigs, formatWithSigFigs } from 'renderer/src/engine/formatting'
import { cn } from 'renderer/lib/utils'
import {
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Leaf,
  AlertTriangle,
  Droplets,
  Loader2,
} from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'
import { BagCalculator } from 'renderer/src/components/BagCalculator'
import { TimerWidget } from 'renderer/src/components/Timer'
import { LabPasteField } from 'renderer/src/components/LabPasteField'
import { StrainManager } from 'renderer/src/components/StrainManager'

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

function fmtSigFigs(
  value: number | null | undefined,
  ...inputs: string[]
): string {
  if (value == null || Number.isNaN(value)) return ''
  const sf = minSigFigs(...inputs)
  return formatWithSigFigs(value, sf)
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
  weight?: string
  thcaPct?: string
  thcPct?: string
  cbdaPct?: string
  cbdPct?: string
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
  cbdaPct: string,
  cbdPct: string,
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
    errors.weight = 'Tell us how much material you are working with'
  } else {
    const w = parseFloat(wStr)
    if (Number.isNaN(w)) errors.weight = 'That does not look like a number'
    else if (w <= 0) errors.weight = 'Weight needs to be a positive number'
  }

  // THCA
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

  // THC
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

  // CBDA
  const cStr = cbdaPct.trim()
  if (cStr === '') {
    errors.cbdaPct = 'We need a CBDA percentage'
  } else {
    const c = parseFloat(cStr)
    if (Number.isNaN(c)) errors.cbdaPct = 'That does not look like a number'
    else if (c < 0)
      errors.cbdaPct = 'CBDA cannot be negative -- percentages start at zero'
    else if (c > 100)
      errors.cbdaPct =
        'CBDA cannot be above 100% -- that would be quite the plant'
  }

  // CBD
  const bStr = cbdPct.trim()
  if (bStr === '') {
    errors.cbdPct = 'We need an existing CBD percentage'
  } else {
    const b = parseFloat(bStr)
    if (Number.isNaN(b)) errors.cbdPct = 'That does not look like a number'
    else if (b < 0)
      errors.cbdPct = 'CBD cannot be negative -- percentages start at zero'
    else if (b > 100)
      errors.cbdPct =
        'CBD cannot be above 100% -- that would be quite the plant'
  }

  // Combined THC checks
  if (!errors.thcaPct && !errors.thcPct) {
    const t = parseFloat(thcaPct)
    const h = parseFloat(thcPct)
    if (!Number.isNaN(t) && !Number.isNaN(h) && t + h > 100) {
      errors.thcaPct = "THCA plus THC can't go past 100%"
      errors.thcPct = "THCA plus THC can't go past 100%"
    }
    if (!Number.isNaN(t) && !Number.isNaN(h) && t + h > 40) {
      warnings.push(
        'High cannabinoid levels -- worth double-checking your lab report'
      )
    }
  }

  // Combined CBD checks
  if (!errors.cbdaPct && !errors.cbdPct) {
    const c = parseFloat(cbdaPct)
    const b = parseFloat(cbdPct)
    if (!Number.isNaN(c) && !Number.isNaN(b) && c + b > 100) {
      errors.cbdaPct = "CBDA plus CBD can't go past 100%"
      errors.cbdPct = "CBDA plus CBD can't go past 100%"
    }
    if (!Number.isNaN(c) && !Number.isNaN(b) && c + b > 40) {
      warnings.push('High CBD levels -- worth double-checking your lab report')
    }
  }

  // Temperature override
  if (tempOverride != null) {
    const tv = parseFloat(tempOverride.trim())
    if (Number.isNaN(tv))
      errors.temperature = 'That does not look like a number'
    else if (tv < 0) errors.temperature = 'Temperature needs to be above zero'
    else if (tv > 300 && tempUnit === 'C')
      errors.temperature = 'Above 300 C will destroy most cannabinoids'
    else if (tv > 572 && tempUnit === 'F')
      errors.temperature = 'Above 572 F will destroy most cannabinoids'
  }

  // Time override
  if (timeOverride != null) {
    const tim = parseFloat(timeOverride.trim())
    if (Number.isNaN(tim)) errors.time = 'That does not look like a number'
    else if (tim <= 0) errors.time = 'Time needs to be a positive number'
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
          'That does not look like a number'
      else if (v < 0 || v > 1)
        (errors as Record<string, string | undefined>)[f.key] =
          'Efficiency needs to be between 0 and 1 (like 0.85 for 85%)'
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
  const inventory = useAppStore(s => s.inventory)

  /* Inventory warning */
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null)

  useEffect(() => {
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w) || w <= 0) {
      setInventoryWarning(null)
      return
    }
    if (inventory.items.length === 0) {
      setInventoryWarning(null)
      return
    }
    const weightGrams = units.weightUnit === 'oz' ? ozToG(w) : w
    const onHand = inventory.items.reduce((sum, i) => {
      const g = parseFloat(i.amountGrams) || 0
      return i.type === 'purchase' ? sum + g : sum - g
    }, 0)
    if (weightGrams > onHand) {
      setInventoryWarning(
        `Insufficient material: need ${weightGrams.toFixed(1)}g, have ${onHand.toFixed(1)}g`
      )
    } else {
      setInventoryWarning(null)
    }
  }, [decarb.weight, units.weightUnit, inventory.items])

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
  const [isCalculating, setIsCalculating] = useState(false)

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
        errs.cbdaPct ||
        errs.cbdPct ||
        errs.effLow ||
        errs.effExpected ||
        errs.effHigh
      ),
    []
  )

  /* ---------------------------------------------------------------- */
  /* CBD results state                                                */
  /* ---------------------------------------------------------------- */
  const [cbdResults, setCbdResults] = useState<{
    theoreticalMax: number
    decarbed: { low: number; expected: number; high: number }
  } | null>(null)

  const isConcentrate = decarb.materialMode === 'concentrate'
  const selectedConcentrate = useMemo(
    () =>
      CONCENTRATE_TYPES.find(ct => ct.id === decarb.concentrateTypeId) ??
      CONCENTRATE_TYPES[0],
    [decarb.concentrateTypeId]
  )

  /* ---------------------------------------------------------------- */
  /* Debounced recalculation                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      const { errors, warnings } = validateDecarbFields(
        decarb.weight,
        decarb.thcaPct,
        decarb.thcPct,
        decarb.cbdaPct,
        decarb.cbdPct,
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
        setCbdResults(null)
        setIsCalculating(false)
        return
      }

      try {
        if (isConcentrate) {
          // Concentrate mode
          const thca = parseFloat(decarb.thcaPct)
          const thc = parseFloat(decarb.thcPct)
          const theoreticalMax = calculateConcentrateTheoreticalMax(
            weightGrams,
            thca,
            thc
          )

          const effLow =
            decarb.effLowOverride != null
              ? parseFloat(decarb.effLowOverride)
              : selectedConcentrate.decarbEfficiency.low
          const effExpected =
            decarb.effExpectedOverride != null
              ? parseFloat(decarb.effExpectedOverride)
              : selectedConcentrate.decarbEfficiency.expected
          const effHigh =
            decarb.effHighOverride != null
              ? parseFloat(decarb.effHighOverride)
              : selectedConcentrate.decarbEfficiency.high

          const decarbed = calculateConcentrateRange(
            theoreticalMax,
            effLow,
            effExpected,
            effHigh
          )

          setResults({ theoreticalMax, decarbed, warnings })
          useAppStore.getState().setLastDecarbExpected(fmt1(decarbed.expected))
          setCbdResults(null) // concentrate mode doesn't show CBD
        } else {
          // Flower mode
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
        }
      } catch {
        setResults(null)
        setCbdResults(null)
      }

      if (!isConcentrate) {
        try {
          const cbda = parseFloat(decarb.cbdaPct)
          const cbd = parseFloat(decarb.cbdPct)
          if (
            !Number.isNaN(cbda) &&
            !Number.isNaN(cbd) &&
            (cbda > 0 || cbd > 0)
          ) {
            const theoreticalMaxCbd = calculateTheoreticalMaxCbd(
              weightGrams,
              cbda,
              cbd
            )

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

            setCbdResults({
              theoreticalMax: theoreticalMaxCbd,
              decarbed: {
                low: calculateDecarbedCbd(theoreticalMaxCbd, effLow),
                expected: calculateDecarbedCbd(theoreticalMaxCbd, effExpected),
                high: calculateDecarbedCbd(theoreticalMaxCbd, effHigh),
              },
            })
          } else {
            setCbdResults(null)
          }
        } catch {
          setCbdResults(null)
        }
      }

      setIsCalculating(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [
    decarb.weight,
    decarb.thcaPct,
    decarb.thcPct,
    decarb.cbdaPct,
    decarb.cbdPct,
    decarb.presetId,
    decarb.tempOverride,
    decarb.timeOverride,
    decarb.effLowOverride,
    decarb.effExpectedOverride,
    decarb.effHighOverride,
    decarb.materialMode,
    decarb.concentrateTypeId,
    units.weightUnit,
    units.tempUnit,
    preset,
    weightGrams,
    hasBlockingErrors,
    isConcentrate,
    selectedConcentrate,
  ])

  /* ---------------------------------------------------------------- */
  /* Strain + Lab paste handlers                                        */
  /* ---------------------------------------------------------------- */
  const [strainManagerOpen, setStrainManagerOpen] = useState(false)
  const strains = useAppStore(s => s.strains)

  const handleLabParsed = useCallback(
    (data: {
      thcaPct: string
      thcPct: string
      cbdaPct: string
      cbdPct: string
    }) => {
      const updates: Partial<typeof decarb> = {}
      if (data.thcaPct !== '') updates.thcaPct = data.thcaPct
      if (data.thcPct !== '') updates.thcPct = data.thcPct
      if (data.cbdaPct !== '') updates.cbdaPct = data.cbdaPct
      if (data.cbdPct !== '') updates.cbdPct = data.cbdPct
      if (Object.keys(updates).length > 0) setDecarb(updates)
    },
    [setDecarb]
  )

  const handleSelectStrain = useCallback(
    (strain: Strain) => {
      setDecarb({
        thcaPct: String(strain.thcaPct),
        thcPct: String(strain.thcPct),
        cbdaPct: String(strain.cbdaPct),
        cbdPct: String(strain.cbdPct),
        strainId: strain.id,
      })
    },
    [setDecarb]
  )

  const sortedStrains = useMemo(
    () => [...strains].sort((a, b) => a.name.localeCompare(b.name)),
    [strains]
  )

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
    setCbdResults(null)
    setFieldErrors({})
    setInlineWarnings([])
    setInventoryWarning(null)
    setShowFormula(false)
  }

  /* Escape key resets current tab, or bag calculator if focused */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const bagContainer = document.getElementById('bag-calculator-card')
        const active = document.activeElement
        if (bagContainer && active && bagContainer.contains(active)) {
          setDecarb({
            bagExpanded: true,
            bagGrindId: 'medium',
            bagPresetId: 'quart',
            bagWidthOverride: null,
            bagLengthOverride: null,
            bagHasStems: false,
          })
        } else {
          handleReset()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )

  /* ---------------------------------------------------------------- */
  /* Sub-components (render helpers)                                    */
  /* ---------------------------------------------------------------- */

  function StrainSelector() {
    return (
      <div className="flex items-center gap-2">
        {sortedStrains.length > 0 ? (
          <select
            className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
            onChange={e => {
              if (e.target.value === '__manage__') {
                setStrainManagerOpen(true)
                e.target.value = ''
                return
              }
              const strain = strains.find(s => s.id === e.target.value)
              if (strain) handleSelectStrain(strain)
              e.target.value = ''
            }}
            value=""
          >
            <option disabled value="">
              Select a strain...
            </option>
            {sortedStrains.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type}) · THCA {s.thcaPct}% · THC {s.thcPct}%
              </option>
            ))}
            <option value="__manage__">Manage Strains...</option>
          </select>
        ) : (
          <button
            className="flex flex-1 items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => setStrainManagerOpen(true)}
            type="button"
          >
            <Leaf className="size-4 text-success" />
            Manage Strains
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Decarboxylation
        </h2>
        <div className="flex items-center gap-2">
          <TabActions tabId="decarb" />
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

          {/* Material Mode Toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground/80">
              Material Type
            </span>
            <div className="inline-flex rounded-lg border border-foreground/20 bg-foreground/5 p-0.5">
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  !isConcentrate
                    ? 'bg-foreground/15 text-foreground'
                    : 'text-foreground/70 hover:text-foreground/80'
                )}
                onClick={() => setDecarb({ materialMode: 'flower' })}
                type="button"
              >
                <Leaf className="size-4" />
                Flower
              </button>
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  isConcentrate
                    ? 'bg-foreground/15 text-foreground'
                    : 'text-foreground/70 hover:text-foreground/80'
                )}
                onClick={() => setDecarb({ materialMode: 'concentrate' })}
                type="button"
              >
                <Droplets className="size-4" />
                Concentrate
              </button>
            </div>
          </div>

          {isConcentrate && (
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                Concentrate Type
                <TooltipIcon text="Choose concentrate type. Distillate is already decarboxylated -- the calculator automatically skips the decarb step." />
              </span>
              <select
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => {
                  const ct = CONCENTRATE_TYPES.find(
                    c => c.id === e.target.value
                  )
                  if (ct) {
                    setDecarb({
                      concentrateTypeId: ct.id,
                      thcaPct: String(ct.typicalThcaPct),
                      thcPct: String(ct.typicalThcPct),
                    })
                  }
                }}
                value={decarb.concentrateTypeId}
              >
                {CONCENTRATE_TYPES.map(ct => (
                  <option
                    className="bg-card text-foreground"
                    key={ct.id}
                    value={ct.id}
                  >
                    {ct.name}
                    {ct.needsDecarb ? '' : ' (ready-to-use)'}
                  </option>
                ))}
              </select>
              {!selectedConcentrate.needsDecarb && (
                <span className="mt-1 text-xs text-info">
                  {selectedConcentrate.decarbGuidance}
                </span>
              )}
            </div>
          )}

          {/* Strain selector (flower mode only) */}
          {!isConcentrate && <StrainSelector />}

          {/* Lab paste */}
          <LabPasteField onParsed={handleLabParsed} />

          {/* Weight */}
          {inventoryWarning && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              {inventoryWarning}
            </div>
          )}
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

          {/* THCA */}
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

          {/* THC */}
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

          {/* CBDA */}
          {!isConcentrate &&
            inputRow(
              <>
                CBDA %
                <TooltipIcon text="Cannabidiolic acid -- the non-psychoactive precursor to CBD found in raw cannabis. Decarboxylates via the same 0.877 factor as THCA because CBDA and THCA are isomers with identical molecular weight." />
              </>,
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.cbdaPct
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
                )}
                onChange={e => setDecarb({ cbdaPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.cbdaPct}
              />,
              fieldErrors.cbdaPct
            )}

          {/* CBD */}
          {!isConcentrate &&
            inputRow(
              <>
                Existing CBD %
                <TooltipIcon text="Cannabidiol already present in the material. This does not need decarboxylation and contributes directly to total CBD potency." />
              </>,
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.cbdPct
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
                )}
                onChange={e => setDecarb({ cbdPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.cbdPct}
              />,
              fieldErrors.cbdPct
            )}

          {/* Method preset (flower mode only) */}
          {!isConcentrate &&
            inputRow(
              <>
                Method Preset
                <TooltipIcon text="Choose a decarboxylation method. Each preset defines recommended temperature, time, and expected efficiency range." />
              </>,
              <select
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => handlePresetChange(e.target.value)}
                value={decarb.presetId}
              >
                {DECARB_METHODS.map(m => (
                  <option
                    className="bg-card text-foreground"
                    key={m.id}
                    value={m.id}
                  >
                    {m.name}
                  </option>
                ))}
              </select>
            )}

          {/* Temperature */}
          {!isConcentrate &&
            inputRow(
              <>
                Temperature
                {isTempOverride && <OverrideBadge />}
              </>,
              <div className="flex items-center gap-2">
                <input
                  className={cn(
                    'flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    isTempOverride
                      ? 'border-warning/60 focus:border-warning'
                      : fieldErrors.temperature
                        ? 'border-danger/60 focus:border-danger'
                        : 'border-foreground/20 focus:border-foreground/40'
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
          {!isConcentrate &&
            inputRow(
              <>
                Time (min)
                {isTimeOverride && <OverrideBadge />}
                <TooltipIcon text="Duration of decarboxylation. Sous vide methods use longer times at lower temperatures for better terpene retention." />
              </>,
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  isTimeOverride
                    ? 'border-warning/60 focus:border-warning'
                    : fieldErrors.time
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
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
          {!isConcentrate && (
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                Decarb Efficiency
                <TooltipIcon text="The percentage of THCA that successfully converts to THC during decarboxylation. 100% efficiency is theoretical maximum; real-world methods typically achieve 70-95%." />
              </span>
              <div className="grid grid-cols-3 gap-2">
                {inputRow(
                  <>Low {isEffLowOverride && <OverrideBadge />}</>,
                  <input
                    className={cn(
                      'w-full rounded-lg border bg-foreground/5 px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                      isEffLowOverride
                        ? 'border-warning/60 focus:border-warning'
                        : fieldErrors.effLow
                          ? 'border-danger/60 focus:border-danger'
                          : 'border-foreground/20 focus:border-foreground/40'
                    )}
                    max={1}
                    min={0}
                    onChange={e =>
                      setDecarb({ effLowOverride: e.target.value })
                    }
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
                      'w-full rounded-lg border bg-foreground/5 px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                      isEffExpectedOverride
                        ? 'border-warning/60 focus:border-warning'
                        : fieldErrors.effExpected
                          ? 'border-danger/60 focus:border-danger'
                          : 'border-foreground/20 focus:border-foreground/40'
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
                      'w-full rounded-lg border bg-foreground/5 px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                      isEffHighOverride
                        ? 'border-warning/60 focus:border-warning'
                        : fieldErrors.effHigh
                          ? 'border-danger/60 focus:border-danger'
                          : 'border-foreground/20 focus:border-foreground/40'
                    )}
                    max={1}
                    min={0}
                    onChange={e =>
                      setDecarb({ effHighOverride: e.target.value })
                    }
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={effHighValue}
                  />,
                  fieldErrors.effHigh
                )}
              </div>
            </div>
          )}

          {/* Concentrate decarb guidance */}
          {isConcentrate && selectedConcentrate.needsDecarb && (
            <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Decarb Guidance
              </span>
              <p className="mt-1 text-xs text-foreground/70">
                {selectedConcentrate.decarbGuidance}
              </p>
            </div>
          )}

          {/* Concentrate efficiency display (read-only, from preset) */}
          {isConcentrate && selectedConcentrate.needsDecarb && (
            <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                Decarb Efficiency (preset)
              </span>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-xs text-foreground/70">Low</span>
                  <p className="text-sm font-medium text-foreground">
                    {fmt1(selectedConcentrate.decarbEfficiency.low * 100)}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-foreground/70">Expected</span>
                  <p className="text-sm font-medium text-success">
                    {fmt1(selectedConcentrate.decarbEfficiency.expected * 100)}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-foreground/70">High</span>
                  <p className="text-sm font-medium text-foreground">
                    {fmt1(selectedConcentrate.decarbEfficiency.high * 100)}%
                  </p>
                </div>
              </div>
            </div>
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

          {/* Theoretical Max */}
          <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Theoretical Maximum THC
            </span>
            <span className="mt-1 text-2xl font-bold text-foreground">
              {results
                ? `${fmtSigFigs(results.theoreticalMax, decarb.weight, decarb.thcaPct, decarb.thcPct)} mg`
                : 'Enter your material weight and potency above to see results'}
            </span>
          </div>

          {/* Decarb-adjusted */}
          <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Decarb-Adjusted THC
            </span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Low
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {results
                    ? `${fmtSigFigs(results.decarbed.low, decarb.weight, decarb.thcaPct, decarb.thcPct)} mg`
                    : 'Enter your material weight and potency above to see results'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Expected
                </span>
                <span
                  className="result-bloom text-lg font-semibold text-success"
                  key={
                    results
                      ? `decarb-expected-${fmtSigFigs(results.decarbed.expected, decarb.weight, decarb.thcaPct, decarb.thcPct)}`
                      : 'decarb-expected-empty'
                  }
                >
                  {results
                    ? `${fmtSigFigs(results.decarbed.expected, decarb.weight, decarb.thcaPct, decarb.thcPct)} mg`
                    : 'Enter your material weight and potency above to see results'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  High
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {results
                    ? `${fmtSigFigs(results.decarbed.high, decarb.weight, decarb.thcaPct, decarb.thcPct)} mg`
                    : 'Enter your material weight and potency above to see results'}
                </span>
              </div>
            </div>
          </div>

          {/* Quality Badges (flower mode only) */}
          {!isConcentrate && (
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-xl border border-foreground/10 bg-foreground/5 px-2 py-3 text-center">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Terpene Retention
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground">
                  {preset.terpeneLabel}
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-foreground/10 bg-foreground/5 px-2 py-3 text-center">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  CBN Risk
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground">
                  {preset.cbnLabel}
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-foreground/10 bg-foreground/5 px-2 py-3 text-center">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Oxygen Exposure
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground">
                  {preset.oxygenLabel}
                </span>
              </div>
            </div>
          )}

          {/* CBD Results (only when CBDA or CBD > 0) */}
          {(parseFloat(decarb.cbdaPct) > 0 || parseFloat(decarb.cbdPct) > 0) &&
            cbdResults && (
              <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Decarb-Adjusted CBD
                </span>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-foreground/70">
                      Low
                    </span>
                    <span className="text-lg font-semibold text-foreground">
                      {`${fmtSigFigs(cbdResults.decarbed.low, decarb.weight, decarb.cbdaPct, decarb.cbdPct)} mg`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-foreground/70">
                      Expected
                    </span>
                    <span className="text-lg font-semibold text-success">
                      {`${fmtSigFigs(cbdResults.decarbed.expected, decarb.weight, decarb.cbdaPct, decarb.cbdPct)} mg`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-foreground/70">
                      High
                    </span>
                    <span className="text-lg font-semibold text-foreground">
                      {`${fmtSigFigs(cbdResults.decarbed.high, decarb.weight, decarb.cbdaPct, decarb.cbdPct)} mg`}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-foreground/70">
                  Theoretical max CBD:{' '}
                  {fmtSigFigs(
                    cbdResults.theoreticalMax,
                    decarb.weight,
                    decarb.cbdaPct,
                    decarb.cbdPct
                  )}{' '}
                  mg
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
                    Theoretical max THC (mg)
                  </strong>{' '}
                  = material weight (g) x ((THCA% / 100) x 0.877 + (THC% / 100))
                  x 1000
                </p>
                <p className="mb-2">
                  <strong className="text-foreground/90">
                    Decarb-adjusted THC (mg)
                  </strong>{' '}
                  = theoretical max THC (mg) x decarb efficiency
                </p>
                {(parseFloat(decarb.cbdaPct) > 0 ||
                  parseFloat(decarb.cbdPct) > 0) && (
                  <>
                    <p className="mb-2">
                      <strong className="text-foreground/90">
                        Theoretical max CBD (mg)
                      </strong>{' '}
                      = material weight (g) x ((CBDA% / 100) x 0.877 + (CBD% /
                      100)) x 1000
                    </p>
                    <p className="mb-2">
                      <strong className="text-foreground/90">
                        Decarb-adjusted CBD (mg)
                      </strong>{' '}
                      = theoretical max CBD (mg) x decarb efficiency
                    </p>
                  </>
                )}
                <p className="text-foreground/70">
                  THCA and CBDA lose their carboxyl group (COOH) during
                  decarboxylation. The molecular weight ratio is approximately
                  0.877 (THC 314.45 / THCA 358.47). CBDA uses the same factor
                  because THCA and CBDA are isomers with identical molecular
                  formula C₂₂H₃₀O₄.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bag Volume Calculator — visible only for sous vide methods (flower mode) */}
      {!isConcentrate &&
        decarb.presetId.startsWith('sv_') &&
        decarb.bagExpanded && (
          <div id="bag-calculator-card">
            <BagCalculator tempC={preset.tempC} />
          </div>
        )}

      {/* Timer Widget (flower mode only) */}
      {!isConcentrate && <TimerWidget />}

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, decarb technique, and measurement
        accuracy.
      </p>

      {/* Strain Manager Modal */}
      <StrainManager
        onClose={() => setStrainManagerOpen(false)}
        onSelect={handleSelectStrain}
        open={strainManagerOpen}
      />
    </div>
  )
}
