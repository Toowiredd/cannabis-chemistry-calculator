import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  GRIND_LEVELS,
  BAG_PRESETS,
  type PresetBag,
} from 'renderer/src/engine/models'
import {
  estimateMaterialVolume,
  calculateFillDepth,
  calculateHeadspace,
  getHeadspaceStatus,
  recommendDoubleBag,
  selectBestBag,
} from 'renderer/src/engine/bagVolume'
import { cmToIn, inToCm } from 'renderer/src/engine/units'
import { fmt1 } from 'renderer/src/engine/formatting'
import { cn } from 'renderer/lib/utils'
import { Info, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// round1 / round3 stay local — they're different precisions (1 vs 3
// decimal places) used for bag dimensions and fill depth. fmt1 comes
// from the engine so missing values render as empty strings consistently
// with every other tab.

function round1(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10
}

function round3(value: number): number {
  return Math.round((value + 1e-9) * 1000) / 1000
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
  'data-testid': dataTestId,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  'data-testid'?: string
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5"
      data-testid={dataTestId}
    >
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
/* Headspace Gauge                                                    */
/* ------------------------------------------------------------------ */

function HeadspaceGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const status = getHeadspaceStatus(pct)

  const barColor =
    status === 'optimal'
      ? 'bg-success'
      : status === 'tight'
        ? 'bg-warning/100'
        : status === 'loose'
          ? 'bg-warning/100'
          : 'bg-danger/100'

  const labelText =
    status === 'optimal'
      ? 'Optimal'
      : status === 'tight'
        ? 'Tight'
        : status === 'loose'
          ? 'Loose'
          : 'Critical'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-foreground/70">
        <span>Headspace</span>
        <span className="font-semibold text-foreground">{fmt1(pct)}%</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            barColor
          )}
          style={{ width: `${clamped}%` }}
        />
        {/* Zone markers */}
        <div className="absolute left-[5%] top-0 h-full w-px bg-foreground/20" />
        <div className="absolute left-[10%] top-0 h-full w-px bg-foreground/30" />
        <div className="absolute left-[25%] top-0 h-full w-px bg-foreground/30" />
        <div className="absolute left-[40%] top-0 h-full w-px bg-foreground/20" />
      </div>
      <div className="flex justify-between text-xs text-foreground/70">
        <span>0%</span>
        <span
          className={cn('font-semibold', status === 'tight' && 'text-warning')}
        >
          5%
        </span>
        <span
          className={cn(
            'font-semibold',
            status === 'optimal' && 'text-success'
          )}
        >
          10%
        </span>
        <span
          className={cn(
            'font-semibold',
            status === 'optimal' && 'text-success'
          )}
        >
          25%
        </span>
        <span
          className={cn('font-semibold', status === 'loose' && 'text-warning')}
        >
          40%
        </span>
        <span>100%</span>
      </div>
      <div className="text-center text-xs font-medium text-foreground/80">
        {labelText} (
        {status === 'optimal'
          ? '10–25%'
          : status === 'tight'
            ? '5–10%'
            : status === 'loose'
              ? '25–40%'
              : '<5% or >40%'}
        )
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function BagCalculator({ tempC }: { tempC: number }) {
  const decarb = useAppStore(s => s.decarb)
  const setDecarb = useAppStore(s => s.setDecarb)
  const units = useAppStore(s => s.units)
  const setUnits = useAppStore(s => s.setUnits)

  const [bagResults, setBagResults] = useState<{
    materialVolume: number
    fillDepth: number
    headspace: number
    doubleBag: boolean
    best: PresetBag | null
    alternative: PresetBag | null
  } | null>(null)

  /* Preset lookups */
  const grind = useMemo(
    () => GRIND_LEVELS.find(g => g.id === decarb.bagGrindId) ?? GRIND_LEVELS[1],
    [decarb.bagGrindId]
  )
  const bagPreset = useMemo(
    () => BAG_PRESETS.find(b => b.id === decarb.bagPresetId) ?? BAG_PRESETS[0],
    [decarb.bagPresetId]
  )

  const isCustomBag = decarb.bagPresetId === 'custom'

  /* Convert bag dimensions for display */
  const displayWidth = useMemo(() => {
    const w = isCustomBag
      ? decarb.bagWidthOverride != null
        ? parseFloat(decarb.bagWidthOverride)
        : 0
      : bagPreset.widthCm
    if (Number.isNaN(w)) return ''
    return units.bagUnit === 'in' ? fmt1(round1(cmToIn(w))) : fmt1(round1(w))
  }, [bagPreset.widthCm, decarb.bagWidthOverride, isCustomBag, units.bagUnit])

  const displayLength = useMemo(() => {
    const l = isCustomBag
      ? decarb.bagLengthOverride != null
        ? parseFloat(decarb.bagLengthOverride)
        : 0
      : bagPreset.lengthCm
    if (Number.isNaN(l)) return ''
    return units.bagUnit === 'in' ? fmt1(round1(cmToIn(l))) : fmt1(round1(l))
  }, [bagPreset.lengthCm, decarb.bagLengthOverride, isCustomBag, units.bagUnit])

  /* Weight in grams from Decarb tab */
  const weightGrams = useMemo(() => {
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w)) return 0
    // Convert from the per-field unit to grams. Previously used
    // `units.weightUnit` which was wrong post-toggle.
    if (decarb.weightUnit === 'oz') return w * 28.3495
    return w
  }, [decarb.weight, decarb.weightUnit])

  /* Debounced recalculation */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const matVol = estimateMaterialVolume(weightGrams, grind.cm3PerGram)

        let widthCm = bagPreset.widthCm
        let lengthCm = bagPreset.lengthCm
        if (isCustomBag) {
          const wRaw =
            decarb.bagWidthOverride != null
              ? parseFloat(decarb.bagWidthOverride)
              : 0
          const lRaw =
            decarb.bagLengthOverride != null
              ? parseFloat(decarb.bagLengthOverride)
              : 0
          // Use per-field unit (not display) to interpret the stored override —
          // otherwise toggling units between type and view would re-scale the
          // bag by 2.54x. The display value is converted on read, not on type.
          const w = decarb.bagWidthOverrideUnit === 'in' ? inToCm(wRaw) : wRaw
          const l = decarb.bagLengthOverrideUnit === 'in' ? inToCm(lRaw) : lRaw
          if (!Number.isNaN(w) && w > 0) widthCm = w
          if (!Number.isNaN(l) && l > 0) lengthCm = l
        }

        const fillDepth = calculateFillDepth(matVol, widthCm, lengthCm)
        const bagVol = widthCm * lengthCm * bagPreset.depthCm
        const headspace = calculateHeadspace(matVol, bagVol)

        const doubleBag = recommendDoubleBag(
          tempC,
          isCustomBag ? 'zip' : bagPreset.bagType,
          decarb.bagHasStems
        )

        const { best, alternative } = selectBestBag(matVol, BAG_PRESETS)

        setBagResults({
          materialVolume: matVol,
          fillDepth,
          headspace,
          doubleBag,
          best,
          alternative,
        })
      } catch {
        setBagResults(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [
    weightGrams,
    grind.cm3PerGram,
    bagPreset,
    isCustomBag,
    decarb.bagWidthOverride,
    decarb.bagLengthOverride,
    decarb.bagHasStems,
    units.bagUnit,
    tempC,
  ])

  /* Handlers */
  const handleGrindChange = (id: string) => {
    setDecarb({ bagGrindId: id })
  }

  const handleBagPresetChange = (id: string) => {
    setDecarb({
      bagPresetId: id,
      bagWidthOverride: null,
      bagLengthOverride: null,
    })
  }

  const handleBagUnitToggle = (newUnit: 'cm' | 'in') => {
    if (newUnit === units.bagUnit) return
    // 2026-07-25 dose-units audit (validation_report_dose_units.md §6
    // B5): the old implementation did convert-and-replace with
    // `fmt1(round1(...))`, which drifts on every toggle (10cm →
    // 3.94in → 10.0078cm → 10.0cm, accumulating 0.01cm per
    // round-trip). Same per-field unit pattern as weightUnit /
    // volumeUnit — don't touch the stored value, just change the
    // display unit. The override fields now track their own
    // `bagWidthOverrideUnit` / `bagLengthOverrideUnit` on the
    // DecarbState.
    setUnits({ bagUnit: newUnit })
  }

  const handleResetBag = () => {
    setDecarb({
      bagExpanded: true,
      bagGrindId: 'medium',
      bagPresetId: 'quart',
      bagWidthOverride: null,
      bagLengthOverride: null,
      bagHasStems: false,
    })
  }

  const inputRow = (
    label: React.ReactNode,
    children: React.ReactNode,
    extraClass?: string
  ) => (
    <div className={cn('flex flex-col gap-1', extraClass)}>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
    </div>
  )

  return (
    <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/70 transition-colors hover:text-foreground"
          onClick={() => setDecarb({ bagExpanded: !decarb.bagExpanded })}
          type="button"
        >
          Bag Volume Calculator
          {decarb.bagExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleResetBag}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
          <UnitToggle
            data-testid="bag-unit-toggle"
            onChange={handleBagUnitToggle}
            options={['cm', 'in'] as const}
            value={units.bagUnit ?? 'cm'}
          />
        </div>
      </div>

      {decarb.bagExpanded && (
        <>
          {/* Material weight (read-only) */}
          {inputRow(
            <>Material Weight (from Decarb)</>,
            <input
              className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground/70 outline-none"
              readOnly
              type="text"
              value={`${decarb.weight} ${units.weightUnit}`}
            />
          )}

          {/* Grind level */}
          {inputRow(
            <>
              Grind Level
              <TooltipIcon text="Coarse grind takes more volume per gram; fine grind is more compact." />
            </>,
            <select
              className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
              onChange={e => handleGrindChange(e.target.value)}
              value={decarb.bagGrindId}
            >
              {GRIND_LEVELS.map(g => (
                <option
                  className="bg-card text-foreground"
                  key={g.id}
                  value={g.id}
                >
                  {g.name} ({g.cm3PerGram} cm³/g)
                </option>
              ))}
            </select>
          )}

          {/* Bag preset */}
          {inputRow(
            <>
              Bag Size
              <TooltipIcon text="Select a bag preset or choose Custom to enter your own dimensions." />
            </>,
            <select
              className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
              onChange={e => handleBagPresetChange(e.target.value)}
              value={decarb.bagPresetId}
            >
              {BAG_PRESETS.map(b => (
                <option
                  className="bg-card text-foreground"
                  key={b.id}
                  value={b.id}
                >
                  {b.name}
                </option>
              ))}
              <option className="bg-card text-foreground" value="custom">
                Custom
              </option>
            </select>
          )}

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-2">
            {inputRow(
              <>Width ({units.bagUnit ?? 'cm'})</>,
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  isCustomBag
                    ? 'border-foreground/20 focus:border-foreground/40'
                    : 'border-foreground/10 text-foreground/70'
                )}
                onChange={e =>
                  setDecarb({
                    bagWidthOverride: e.target.value,
                    bagWidthOverrideUnit: units.bagUnit,
                  })
                }
                placeholder={isCustomBag ? '0.0' : displayWidth}
                readOnly={!isCustomBag}
                step="0.1"
                type="number"
                value={
                  isCustomBag
                    ? (() => {
                        if (decarb.bagWidthOverride == null) return ''
                        if (decarb.bagWidthOverrideUnit === units.bagUnit) {
                          return decarb.bagWidthOverride
                        }
                        const v = parseFloat(decarb.bagWidthOverride)
                        if (Number.isNaN(v)) return decarb.bagWidthOverride
                        const converted =
                          units.bagUnit === 'in' ? cmToIn(v) : inToCm(v)
                        return converted.toFixed(2)
                      })()
                    : displayWidth
                }
              />
            )}
            {inputRow(
              <>Length ({units.bagUnit ?? 'cm'})</>,
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  isCustomBag
                    ? 'border-foreground/20 focus:border-foreground/40'
                    : 'border-foreground/10 text-foreground/70'
                )}
                onChange={e =>
                  setDecarb({
                    bagLengthOverride: e.target.value,
                    bagLengthOverrideUnit: units.bagUnit,
                  })
                }
                placeholder={isCustomBag ? '0.0' : displayLength}
                readOnly={!isCustomBag}
                step="0.1"
                type="number"
                value={
                  isCustomBag
                    ? (() => {
                        if (decarb.bagLengthOverride == null) return ''
                        if (decarb.bagLengthOverrideUnit === units.bagUnit) {
                          return decarb.bagLengthOverride
                        }
                        const v = parseFloat(decarb.bagLengthOverride)
                        if (Number.isNaN(v)) return decarb.bagLengthOverride
                        const converted =
                          units.bagUnit === 'in' ? cmToIn(v) : inToCm(v)
                        return converted.toFixed(2)
                      })()
                    : displayLength
                }
              />
            )}
          </div>

          {/* Has stems checkbox */}
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              checked={decarb.bagHasStems}
              className="size-4 rounded border-foreground/20 bg-foreground/5"
              onChange={e => setDecarb({ bagHasStems: e.target.checked })}
              type="checkbox"
            />
            Material contains stems (may puncture bag)
          </label>

          {/* Results */}
          {bagResults && (
            <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              {/* Material volume */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Material Volume
                </span>
                <span
                  className="text-sm font-semibold text-foreground"
                  data-testid="bag-material-volume"
                >
                  {fmt1(bagResults.materialVolume)} cm³
                </span>
              </div>

              {/* Fill depth */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Fill Depth
                </span>
                <span
                  className="text-sm font-semibold text-foreground"
                  data-testid="bag-fill-depth"
                >
                  {round3(bagResults.fillDepth)} cm
                </span>
              </div>

              {/* Headspace gauge */}
              <HeadspaceGauge pct={bagResults.headspace} />

              {/* Double-bag recommendation */}
              {bagResults.doubleBag && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 dark:bg-warning/10 px-3 py-2">
                  <span className="text-xs font-semibold text-warning dark:text-warning">
                    Double-bag recommended
                  </span>
                  <p className="mt-0.5 text-xs text-warning dark:text-warning">
                    {tempC >= 95
                      ? 'High heat can weaken bags. Double up for safety.'
                      : 'Stems can poke holes. Two bags for peace of mind.'}
                  </p>
                </div>
              )}

              {/* Best bag recommendation */}
              <div className="flex flex-col gap-1" data-testid="bag-recommendation">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Recommended Bag
                </span>
                {bagResults.best ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-success">
                      {bagResults.best.name}
                    </span>
                    <span className="text-xs text-foreground/70">
                      Headspace:{' '}
                      {fmt1(
                        calculateHeadspace(
                          bagResults.materialVolume,
                          bagResults.best.volumeCm3
                        )
                      )}
                      %
                    </span>
                    {bagResults.alternative && (
                      <span className="text-xs text-foreground/70">
                        Alternative: {bagResults.alternative.name} (
                        {fmt1(
                          calculateHeadspace(
                            bagResults.materialVolume,
                            bagResults.alternative.volumeCm3
                          )
                        )}
                        %)
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-danger">
                    No bag can fit this material volume
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
