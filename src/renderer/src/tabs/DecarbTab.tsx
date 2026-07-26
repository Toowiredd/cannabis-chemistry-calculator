import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
  calculateAvbTheoreticalMax,
  AVB_RESIDUAL_THC_RANGES,
  type AVBColor,
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
import { getDecarbWarnings, type DecarbInput } from 'renderer/src/engine/schemas'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import type { Strain } from 'renderer/src/engine/models'
import {
  cToF,
  fToC,
  convertWeight,
  gToOz,
  ozToG,
} from 'renderer/src/engine/units'
import {
  minSigFigs,
  formatWithSigFigs,
  round1n,
  fmt1,
} from 'renderer/src/engine/formatting'
import { cn } from 'renderer/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Leaf,
  AlertTriangle,
  Droplets,
  Loader2,
  Cloud,
} from 'lucide-react'
import { TabActions } from 'renderer/src/components/TabActions'
import { BagCalculator } from 'renderer/src/components/BagCalculator'
import { TimerWidget } from 'renderer/src/components/Timer'
import { LabPasteField } from 'renderer/src/components/LabPasteField'
import { StrainManager } from 'renderer/src/components/StrainManager'
import { InputRow } from 'renderer/src/components/InputRow'
import { TooltipIcon } from 'renderer/src/components/TooltipIcon'
import { UnitToggle } from 'renderer/src/components/UnitToggle'
import { OverrideBadge } from 'renderer/src/components/OverrideBadge'
import { DecarbHeatmap } from 'renderer/src/components/DecarbHeatmap'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
/* ------------------------------------------------------------------ */

function fmtSigFigs(
  value: number | null | undefined,
  ...inputs: string[]
): string {
  if (value == null || Number.isNaN(value)) return ''
  const sf = minSigFigs(...inputs)
  return formatWithSigFigs(value, sf)
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
  // 2026-07-25 ccc uiux-reviewer audit M4 / M5: the prior version
  // gated the entire calculator on `thcPct !== ''`, demanding the
  // user enter an "existing THC percentage" even when the user
  // only had a THCA reading (the dominant case for raw cannabis
  // flower). The engine — both flower mode at DecarbTab.tsx:425
  // and concentrate mode at DecarbTab.tsx:385 — already handles
  // `thcPct = ''` by defaulting to 0 (`|| 0`). The UI gate was
  // out of sync with the engine. Now: empty thcPct is allowed
  // (THCA alone is enough); a non-empty value must still be a
  // valid percentage in [0, 100]. This matches the QuickBatch
  // engine path that already treats thc=0 as the standard flower
  // case.
  const hStr = thcPct.trim()
  if (hStr !== '') {
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
  }

  // Combined CBD checks
  if (!errors.cbdaPct && !errors.cbdPct) {
    const c = parseFloat(cbdaPct)
    const b = parseFloat(cbdPct)
    if (!Number.isNaN(c) && !Number.isNaN(b) && c + b > 100) {
      errors.cbdaPct = "CBDA plus CBD can't go past 100%"
      errors.cbdPct = "CBDA plus CBD can't go past 100%"
    }
  }

  // 2026-07-26 P2.1 — surface the engine's high-cannabinoid warning.
  // The inline 40%-threshold check used to live in this function; we
  // now delegate to `getDecarbWarnings` from `engine/schemas.ts:139-156`
  // so the UI warning and the engine validation are sourced from one
  // place. The DecarbInput type expects already-parsed numbers, so we
  // build a partial here and fall back to 0 for unparseable strings
  // (matches the engine's `(data.thcaPct || 0)` semantics).
  const parsedThca = parseFloat(thcaPct)
  const parsedThc = parseFloat(thcPct)
  const parsedCbda = parseFloat(cbdaPct)
  const parsedCbd = parseFloat(cbdPct)
  const decarbData: DecarbInput = {
    weight: 1,
    thcaPct: !Number.isNaN(parsedThca) ? parsedThca : 0,
    thcPct: !Number.isNaN(parsedThc) ? parsedThc : 0,
    cbdaPct: !Number.isNaN(parsedCbda) ? parsedCbda : 0,
    cbdPct: !Number.isNaN(parsedCbd) ? parsedCbd : 0,
  }
  warnings.push(...getDecarbWarnings(decarbData))

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
  const setActiveTab = useAppStore(s => s.setActiveTab)

  /* Inventory warning.
   *
   * 2026-07-25 ccc workflow-validator audit (R1) found the prior
   * guard short-circuited on `inventory.items.length === 0`, so the
   * warning never fired on the default empty state. The fix has two
   * surfaces:
   *   - When the user has NOT entered a weight yet, show nothing
   *     (the previous behavior, still correct — the warning is
   *     about a specific batch).
   *   - When the user HAS entered a weight but the inventory is
   *     empty, show a friendly empty-state warning with a link to
   *     the Dashboard tab where the inventory UI now lives
   *     (the audit's BLOCKER B4 closes that loop).
   *   - When the user has entered a weight and has items, show the
   *     pre-existing "Insufficient material: need Xg, have Yg"
   *     message.
   *
   * The state shape is `string | null` (plain text) for the
   * shortage case + a boolean for the empty-state case. We compute
   * both in the same effect so the warning can't desync.
   */
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null)
  const [inventoryEmpty, setInventoryEmpty] = useState<boolean>(false)

  useEffect(() => {
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w) || w <= 0) {
      setInventoryWarning(null)
      setInventoryEmpty(false)
      return
    }
    // 2026-07-25 AVB feature: 3-way material-mode branch on
    // inventory. Concentrate isn't tracked (bought by the gram,
    // not batch-tracked) → no gate. Flower / AVB each filter
    // inventory items by `kind`. Legacy items (kind === undefined)
    // are treated as flower (the v2→v3 migration stamps
    // `kind: 'flower'` on every pre-v3 item).
    if (decarb.materialMode === 'concentrate') {
      setInventoryWarning(null)
      setInventoryEmpty(false)
      return
    }
    const matching = inventory.items.filter(i =>
      decarb.materialMode === 'flower'
        ? i.kind === 'flower' || i.kind === undefined
        : i.kind === 'avb'
    )
    if (matching.length === 0) {
      // Weight entered but no matching items: this is the new
      // empty-state warning. The actual warning text lives in the
      // JSX (a link to the Dashboard) — we just flip a boolean
      // here so the effect stays a pure computation.
      setInventoryWarning(null)
      setInventoryEmpty(true)
      return
    }
    setInventoryEmpty(false)
    // Convert the stored value (which is in `decarb.weightUnit`, the
    // unit the user typed it in) to grams for the inventory check.
    // Previously this used `units.weightUnit` (the display unit) —
    // which is wrong post-toggle because the stored value is in the
    // per-field unit, not the display unit.
    const weightGrams = decarb.weightUnit === 'oz' ? ozToG(w) : w
    const onHand = matching.reduce((sum, i) => {
      const g = parseFloat(i.amountGrams) || 0
      return i.type === 'purchase' ? sum + g : sum - g
    }, 0)
    if (weightGrams > onHand) {
      // 2026-07-25 ccc cross-tab data flow audit (MINOR m1):
      // convert the grams values back to the per-field
      // `decarb.weightUnit` so the warning surfaces in the unit
      // the user is reading on the form. A user who typed 0.12 in
      // oz would otherwise see "0.1g, have 5.0g" — the math is
      // right (0.12 oz ≈ 3.4 g > 5 g means insufficient) but
      // the unit suffix is wrong. The engine calc still uses
      // grams (weightGrams), so this is display-only. The .toFixed(1)
      // matches the pre-fix format so existing tests that assert
      // "5.0g, have 1.0g" continue to pass; for the default 'g'
      // unit this is the right precision, and for 'oz' it stays
      // consistent with the rest of the weight display elsewhere.
      const unit = decarb.weightUnit
      const needDisplay = convertWeight(weightGrams, 'g', unit).toFixed(1)
      const onHandDisplay = convertWeight(onHand, 'g', unit).toFixed(1)
      setInventoryWarning(
        `Insufficient material: need ${needDisplay}${unit}, have ${onHandDisplay}${unit}`
      )
    } else {
      setInventoryWarning(null)
    }
  }, [
    decarb.weight,
    decarb.weightUnit,
    decarb.materialMode,
    units.weightUnit,
    inventory.items,
  ])

  /* Preset lookup */
  const preset = useMemo(
    () =>
      DECARB_METHODS.find(m => m.id === decarb.presetId) ?? DECARB_METHODS[0],
    [decarb.presetId]
  )

  // 2026-07-26 P2.4 — honor the OS-level prefers-reduced-motion
  // setting. With reduced motion on, the result-bloom animation is
  // omitted entirely (the `result-bloom` class is conditionally
  // excluded). The globals.css fallback also shortens the animation
  // duration to 0.01ms, but the per-component class swap is the
  // testable contract. Also drives the UnitToggle class swap
  // (omit `unit-toggle-transition` when reduced motion is on).
  const reducedMotion = useReducedMotion()

  /* Local UI state */
  const [showFormula, setShowFormula] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [results, setResults] = useState<{
    theoreticalMax: number
    decarbed: { low: number; expected: number; high: number }
    warnings: string[]
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  /* Validation state (debounced) */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [inlineWarnings, setInlineWarnings] = useState<string[]>([])

  // 2026-07-26 P2.1 — high-cannabinoid advisory is now a single
  // dismissable alert above the input grid. The user can dismiss the
  // advisory once and not see it again until they edit a percentage
  // (the `dismissedKey` resets on edit) or the input drops back below
  // 40% (the `warningKey` changes, which also resets dismissal).
  const [decarbAdvisoryDismissed, setDecarbAdvisoryDismissed] = useState(false)
  const [decarbAdvisoryKey, setDecarbAdvisoryKey] = useState<string>('')

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
    // Convert from the per-field unit (decarb.weightUnit — the unit
    // the user typed the value in) to grams for engine calls.
    if (decarb.weightUnit === 'oz') return ozToG(w)
    return w
  }, [decarb.weight, decarb.weightUnit])

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
  // 2026-07-25 AVB feature: third material mode branch. AVB is
  // already decarbed by the vaporizer, so the decarb math
  // collapses to `calculateAvbTheoreticalMax(grams, residualThcPct)`
  // with efficiency 1.0. The Decarb Method picker is hidden in
  // this mode (no temperature / time to set).
  const isAvb = decarb.materialMode === 'avb'
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
        if (isAvb) {
          // 2026-07-25 AVB feature: third material mode branch.
          // The residual THC % lives in `decarb.thcPct` (the
          // existing field; for AVB it's already-active THC, not
          // the delta from THCA). The engine call is the
          // dedicated AVB path that skips the 0.877 THCA→THC
          // factor and applies efficiency 1.0 (AVB is already
          // decarbed). The expected output range is the same
          // low / expected / high shape as the flower branch.
          const residualThcPct = parseFloat(decarb.thcPct) || 0
          const theoreticalMax = calculateAvbTheoreticalMax(
            weightGrams,
            residualThcPct
          )

          // AVB has a single mid-point (already decarbed), so the
          // low / expected / high range is identical. We still
          // build the range object so the result panel renders
          // the same 3-position layout as the flower path.
          const decarbed = {
            low: calculateDecarbedThc(theoreticalMax, 1.0),
            expected: calculateDecarbedThc(theoreticalMax, 1.0),
            high: calculateDecarbedThc(theoreticalMax, 1.0),
          }

          setResults({ theoreticalMax, decarbed, warnings })
          useAppStore.getState().setLastDecarbExpected(fmt1(decarbed.expected))
          setCbdResults(null) // AVB mode doesn't show CBD
        } else if (isConcentrate) {
          // Concentrate mode
          const thca = parseFloat(decarb.thcaPct)
          // 2026-07-25 ccc uiux-reviewer audit M4 / M5: the
          // `|| 0` lets the engine run with THCA alone (a missing
          // thcPct is the common case — concentrates are
          // typically labeled as THCA%). Without it, parseFloat('')
          // is NaN, calculateConcentrateTheoreticalMax produces
          // NaN, and the result panel hides. The M4 / M5 fix
          // removes the UI gate; this `|| 0` keeps the engine in
          // sync with the new gate.
          const thc = parseFloat(decarb.thcPct) || 0
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
          // 2026-07-25 ccc uiux-reviewer audit M4 / M5: same as
          // the concentrate branch — `|| 0` so the engine works
          // with THCA alone (the dominant case for raw cannabis
          // flower). Without it, parseFloat('') is NaN,
          // calculateTheoreticalMax produces NaN, and the result
          // panel hides. The UI gate is removed in
          // `validateDecarbFields`; this keeps the engine in sync.
          const thc = parseFloat(decarb.thcPct) || 0
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

      // 2026-07-25 AVB feature: AVB is not raw flower, so the
      // CBD panel (which expects raw-cannabis THCA→THC + the
      // equivalent for CBD) is also suppressed in AVB mode.
      // The `!isAvb && !isConcentrate` predicate reads as
      // "flower only".
      if (!isConcentrate && !isAvb) {
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
    isAvb,
    selectedConcentrate,
  ])

  /* ---------------------------------------------------------------- */
  /* P2.1 — High-cannabinoid advisory (dismissable)                    */
  /* ---------------------------------------------------------------- */
  // 2026-07-26: the high-cannabinoid warning (>40% THCA+THC or
  // CBDA+CBD) is now surfaced as a single dismissable alert above
  // the input grid (was: always-on inline list). The advisory persists
  // until the user clicks Dismiss; dismissal resets on:
  //   (a) the user editing a percentage field (key change in
  //       `decarb.thcaPct|thcPct|cbdaPct|cbdPct`), or
  //   (b) the percentage sum dropping back to ≤40% (key change in the
  //       "fired" status).
  // The useEffect below computes the key from the live values and
  // resets the dismissed state on any change.
  useEffect(() => {
    const t = parseFloat(decarb.thcaPct)
    const h = parseFloat(decarb.thcPct)
    const c = parseFloat(decarb.cbdaPct)
    const b = parseFloat(decarb.cbdPct)
    const thcFire =
      !Number.isNaN(t) && !Number.isNaN(h) && t + h > 40
    const cbdFire =
      !Number.isNaN(c) && !Number.isNaN(b) && c + b > 40
    const newKey = thcFire || cbdFire
      ? `${decarb.thcaPct}|${decarb.thcPct}|${decarb.cbdaPct}|${decarb.cbdPct}`
      : ''
    setDecarbAdvisoryKey(prev => {
      if (prev !== newKey) setDecarbAdvisoryDismissed(false)
      return newKey
    })
  }, [
    decarb.thcaPct,
    decarb.thcPct,
    decarb.cbdaPct,
    decarb.cbdPct,
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
    // 2026-07-24 user-journey verification round 3: the old
    // implementation converted-and-rounded `decarb.weight` on every
    // toggle, which lost precision (3.5g → 0.1oz → 2.8g). The fix
    // is to NOT touch the stored value — only change the display
    // unit preference. The value stays in the unit the user typed
    // it in (tracked by `decarb.weightUnit`); display converts for
    // read. See DecarbState.weightUnit docs.
    setUnits({ weightUnit: newUnit })
  }

  const handleTempUnitToggle = (newUnit: 'C' | 'F') => {
    if (newUnit === units.tempUnit) return
    // 2026-07-25 dose-units audit (validation_report_dose_units.md §6
    // B6): the old implementation did convert-and-replace with
    // `fmt1(round1n(...))`, which drifts on values not at the
    // rounded boundary (240.1°C → 464.18°F → 240.1°C accumulated
    // 0.01°C per round-trip). Same per-field unit pattern as
    // weightUnit / volumeUnit — don't touch the stored value, just
    // change the display unit.
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
    setShowAdvanced(false)
  }

  /*
   * Do not bind Escape to handleReset here. Escape is reserved for dismissing
   * transient UI such as tooltips/dialogs; wiping calculator state must stay an
   * explicit click on "Reset to Defaults" so keyboard users do not lose work.
   */

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

  // Convert the stored override (which is in `decarb.tempOverrideUnit`,
  // the unit the user typed in) to the current display unit. If
  // the units match, no conversion needed. 2-decimal rounded for
  // readability. The user's exact typed value is preserved in the
  // store.
  const tempValue =
    isTempOverride && decarb.tempOverride != null
      ? (() => {
          const v = parseFloat(decarb.tempOverride)
          if (Number.isNaN(v)) return decarb.tempOverride ?? ''
          if (decarb.tempOverrideUnit === units.tempUnit) {
            return decarb.tempOverride ?? ''
          }
          const converted = units.tempUnit === 'F' ? cToF(v) : fToC(v)
          return converted.toFixed(2)
        })()
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

  /* ---------------------------------------------------------------- */
  /* Sub-components (render helpers)                                    */
  /* ---------------------------------------------------------------- */

  function StrainSelector() {
    return (
      <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
        {sortedStrains.length > 0 ? (
          <select
            className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
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
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground min-[420px]:justify-start"
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
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          Decarboxylation
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <TabActions tabId="decarb" />
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* ------------------- INPUT PANEL ------------------- */}
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Input
          </h3>

          {/* 2026-07-26 P2.1 — high-cannabinoid advisory (dismissable).
              Surfaces the engine's `getDecarbWarnings` >40% warning as a
              single amber alert above the input grid. Non-blocking:
              doesn't gate the calculator. Persists until the user
              clicks Dismiss; dismissal auto-resets when the user edits
              a percentage (key change) or the value drops ≤40%. */}
          {decarbAdvisoryKey !== '' && !decarbAdvisoryDismissed && (
            <div
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2"
              data-testid="decarb-advisory"
              role="status"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <span className="flex-1 text-xs text-warning">
                {inlineWarnings.length > 0
                  ? inlineWarnings[0]
                  : 'High cannabinoid levels — worth double-checking your lab report (>40%)'}
              </span>
              <button
                aria-label="Dismiss advisory"
                className="shrink-0 rounded p-1 text-warning/80 transition-colors hover:bg-warning/20 hover:text-warning"
                data-testid="decarb-advisory-dismiss"
                onClick={() => setDecarbAdvisoryDismissed(true)}
                type="button"
              >
                ×
              </button>
            </div>
          )}

          {/* Material Mode Toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground/80">
              Material Type
            </span>
            <div
              className="inline-flex w-full rounded-lg border border-foreground/20 bg-foreground/5 p-0.5 min-[420px]:w-auto"
              data-testid="decarb-material-mode"
              role="radiogroup"
            >
              <button
                aria-checked={decarb.materialMode === 'flower'}
                className={cn(
                  'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors min-[420px]:flex-none',
                  decarb.materialMode === 'flower'
                    ? 'bg-foreground/15 text-foreground'
                    : 'text-foreground/70 hover:text-foreground/80'
                )}
                data-testid="decarb-material-flower"
                onClick={() => setDecarb({ materialMode: 'flower' })}
                role="radio"
                type="button"
              >
                <Leaf className="size-4" />
                Flower
              </button>
              <button
                aria-checked={decarb.materialMode === 'concentrate'}
                className={cn(
                  'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors min-[420px]:flex-none',
                  decarb.materialMode === 'concentrate'
                    ? 'bg-foreground/15 text-foreground'
                    : 'text-foreground/70 hover:text-foreground/80'
                )}
                data-testid="decarb-material-concentrate"
                onClick={() => setDecarb({ materialMode: 'concentrate' })}
                role="radio"
                type="button"
              >
                <Droplets className="size-4" />
                Concentrate
              </button>
              <button
                aria-checked={decarb.materialMode === 'avb'}
                className={cn(
                  'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors min-[420px]:flex-none',
                  decarb.materialMode === 'avb'
                    ? 'bg-foreground/15 text-foreground'
                    : 'text-foreground/70 hover:text-foreground/80'
                )}
                data-testid="decarb-material-avb"
                onClick={() => setDecarb({ materialMode: 'avb' })}
                role="radio"
                type="button"
              >
                <Cloud className="size-4" />
                AVB
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
          {inventoryEmpty && !inventoryWarning && (
            // 2026-07-25 inventory audit: when the user has typed
            // a weight but has no inventory items, the friendly
            // "Add to your inventory" warning replaces the
            // short-circuit. The link navigates to the Dashboard
            // where the InventorySection lives (BLOCKER B4).
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info"
              data-testid="decarb-inventory-empty"
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span>Add to your inventory to track consumption.</span>
              <button
                aria-label="Open Dashboard to add to inventory"
                className="rounded font-semibold underline underline-offset-2 transition-colors hover:text-info/80"
                data-testid="decarb-inventory-empty-link"
                onClick={() => setActiveTab('dashboard')}
                type="button"
              >
                Open Dashboard
              </button>
            </div>
          )}
          {inventoryWarning && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
              data-testid="decarb-inventory-shortage"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {inventoryWarning}
            </div>
          )}
          <InputRow
            error={fieldErrors.weight}
            label={
              <>
                Material Weight
                <TooltipIcon text="The total weight of raw cannabis material before decarboxylation." />
              </>
            }
          >
            {
              <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                <input
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    fieldErrors.weight
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
                  )}
                  data-testid="decarb-weight-input"
                  // The user types in the current display unit. We
                  // track the unit on the field itself so the
                  // value is preserved across toggles. If the
                  // user toggles, the input re-renders with the
                  // value converted to the new display unit (1
                  // decimal rounded) while the stored value
                  // stays untouched.
                  onChange={e => {
                    const raw = e.target.value
                    setDecarb({ weight: raw, weightUnit: units.weightUnit })
                  }}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  // Display: convert from the stored unit to the
                  // current display unit, round to 2 decimals for
                  // readability (so 0.1 oz doesn't display as
                  // 0.123456789).
                  value={
                    decarb.weight === ''
                      ? ''
                      : decarb.weightUnit === units.weightUnit
                        ? decarb.weight
                        : (() => {
                            const n = parseFloat(decarb.weight)
                            if (Number.isNaN(n)) return decarb.weight
                            const converted = convertWeight(
                              n,
                              decarb.weightUnit,
                              units.weightUnit
                            )
                            return converted.toFixed(2)
                          })()
                  }
                />
                <span
                  className={
                    reducedMotion ? '' : 'unit-toggle-transition inline-flex'
                  }
                >
                  <UnitToggle
                    onChange={handleWeightUnitToggle}
                    options={['g', 'oz'] as const}
                    value={units.weightUnit}
                  />
                </span>
              </div>
            }
          </InputRow>

          {/* THCA. 2026-07-25 AVB feature: hidden in AVB mode —
              the 0.877 THCA→THC factor does NOT apply (AVB is
              already decarboxylated), and the residual is
              already-active THC that the user types in as the
              `thcPct` field. The "Existing THC %" input
              (decarb.thcPct) is repurposed below as the
              "Residual THC %" input in AVB mode. */}
          {!isAvb && (
            <InputRow
              error={fieldErrors.thcaPct}
              label={
                <>
                  THCA %
                  <TooltipIcon text="Tetrahydrocannabinolic acid -- the non-psychoactive precursor to THC found in raw cannabis." />
                </>
              }
            >
              {
                <input
                  className={cn(
                    'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                    fieldErrors.thcaPct
                      ? 'border-danger/60 focus:border-danger'
                      : 'border-foreground/20 focus:border-foreground/40'
                  )}
                  data-testid="decarb-thca-input"
                  onChange={e => setDecarb({ thcaPct: e.target.value })}
                  placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.thcaPct}
              />
            }
          </InputRow>
          )}

          {/* THC. 2026-07-25 AVB feature: the same input doubles as
              the "Residual THC %" input in AVB mode. The label
              switches + the help text reflects the AVB
              semantics (already-active THC, no decarb step). */}
          <InputRow
            error={fieldErrors.thcPct}
            label={
              <>
                {isAvb ? 'Residual THC %' : 'Existing THC %'}
                <TooltipIcon
                  text={
                    isAvb
                      ? 'Already-active THC remaining in your AVB. AVB is decarboxylated by the vaporizer, so the 0.877 THCA→THC factor does NOT apply. Pick the AVB color below to pre-fill this with a typical value, then fine-tune.'
                      : 'Delta-9-THC already present in the material. This does not need decarboxylation and contributes directly to total potency.'
                  }
                />
              </>
            }
          >
            {
              <input
                className={cn(
                  'rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                  fieldErrors.thcPct
                    ? 'border-danger/60 focus:border-danger'
                    : 'border-foreground/20 focus:border-foreground/40'
                )}
                data-testid="decarb-thc-input"
                onChange={e => setDecarb({ thcPct: e.target.value })}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={decarb.thcPct}
              />
            }
          </InputRow>

          {/* AVB color picker (only when materialMode === 'avb').
              Same 3-segment control as InventorySection /
              QuickBatchTab. The selected color pre-fills the
              residual THC % with the midpoint of the color's
              range, but the user can still fine-tune the % in
              the field above. */}
          {isAvb && (
            <div
              className="flex flex-col gap-2"
              data-testid="decarb-avb-color-picker"
            >
              <span className="text-xs font-medium text-foreground/80">
                AVB color
              </span>
              <div
                aria-label="AVB color"
                className="inline-flex w-full rounded-lg border border-foreground/20 bg-foreground/5 p-0.5"
                role="radiogroup"
              >
                {(
                  [
                    {
                      value: 'light' as AVBColor,
                      label: 'Light',
                      range: AVB_RESIDUAL_THC_RANGES.light,
                    },
                    {
                      value: 'medium' as AVBColor,
                      label: 'Medium',
                      range: AVB_RESIDUAL_THC_RANGES.medium,
                    },
                    {
                      value: 'dark' as AVBColor,
                      label: 'Dark',
                      range: AVB_RESIDUAL_THC_RANGES.dark,
                    },
                  ] as const
                ).map(opt => (
                  <button
                    aria-checked={parseFloat(decarb.thcPct) === opt.range.midPct}
                    aria-label={`${opt.label} (≈ ${opt.range.midPct}% residual THC)`}
                    className={cn(
                      'flex min-h-10 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      parseFloat(decarb.thcPct) === opt.range.midPct
                        ? 'bg-foreground/15 text-foreground'
                        : 'text-foreground/70 hover:text-foreground/80'
                    )}
                    data-testid={`decarb-avb-color-${opt.value}`}
                    key={opt.value}
                    onClick={() => setDecarb({ thcPct: String(opt.range.midPct) })}
                    role="radio"
                    type="button"
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-normal text-foreground/60">
                      ≈ {opt.range.midPct}% residual
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-foreground/60">
                Lighter AVB retains more THC; darker AVB has been
                vaped longer and is less potent.
              </span>
            </div>
          )}

          {/* CBDA + CBD — advanced fields.
              2026-07-25 AVB feature: also hidden in AVB mode (no
              raw-flower CBDA / CBD on AVB). */}
          {showAdvanced && !isConcentrate && !isAvb && (
            <>
              <InputRow
                error={fieldErrors.cbdaPct}
                label={
                  <>
                    CBDA %
                    <TooltipIcon text="Cannabidiolic acid -- the non-psychoactive precursor to CBD found in raw cannabis. Decarboxylates via the same 0.877 factor as THCA because CBDA and THCA are isomers with identical molecular weight." />
                  </>
                }
              >
                {
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
                  />
                }
              </InputRow>

              <InputRow
                error={fieldErrors.cbdPct}
                label={
                  <>
                    Existing CBD %
                    <TooltipIcon text="Cannabidiol already present in the material. This does not need decarboxylation and contributes directly to total CBD potency." />
                  </>
                }
              >
                {
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
                  />
                }
              </InputRow>
            </>
          )}

          {/* Method preset (flower mode only).
              2026-07-25 AVB feature: hidden in AVB mode — AVB is
              already decarboxylated by the vaporizer, so there's
              no decarb method for the user to choose. The engine
              call in the useEffect uses `calculateAvbTheoreticalMax`
              with efficiency 1.0 in this mode. */}
          {!isConcentrate && !isAvb && (
            <InputRow
              label={
                <>
                  Method Preset
                  <TooltipIcon text="Choose a decarboxylation method. Each preset defines recommended temperature, time, and expected efficiency range." />
                </>
              }
            >
              {
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
              }
            </InputRow>
          )}

          {/* Advanced Settings toggle (flower mode only) */}
          {!isConcentrate && !isAvb && (
            <button
              className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              data-testid="decarb-advanced-toggle"
              onClick={() => setShowAdvanced(v => !v)}
              type="button"
            >
              <span>
                {showAdvanced ? 'Show fewer options' : 'Advanced Settings'}
              </span>
              {showAdvanced ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          )}

          {/* Temperature, Time, Efficiency — advanced fields.
              2026-07-25 AVB feature: hidden in AVB mode — the
              residual THC is already active, so temperature / time
              / efficiency overrides are meaningless. */}
          {showAdvanced && !isConcentrate && !isAvb && (
            <>
              <InputRow
                error={fieldErrors.temperature}
                label={
                  <>
                    Temperature
                    {isTempOverride && <OverrideBadge />}
                  </>
                }
              >
                {
                  <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                    <input
                      className={cn(
                        'min-w-0 flex-1 rounded-lg border bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30',
                        isTempOverride
                          ? 'border-warning/60 focus:border-warning'
                          : fieldErrors.temperature
                            ? 'border-danger/60 focus:border-danger'
                            : 'border-foreground/20 focus:border-foreground/40'
                      )}
                      onChange={e =>
                        setDecarb({
                          tempOverride: e.target.value,
                          tempOverrideUnit: units.tempUnit,
                        })
                      }
                      placeholder={`${presetTempDisplay} ${units.tempUnit}`}
                      step="0.1"
                      type="number"
                      value={tempValue}
                    />
                    <span
                      className={
                        reducedMotion
                          ? ''
                          : 'unit-toggle-transition inline-flex'
                      }
                    >
                      <UnitToggle
                        onChange={handleTempUnitToggle}
                        options={['C', 'F'] as const}
                        value={units.tempUnit}
                      />
                    </span>
                  </div>
                }
              </InputRow>

              <InputRow
                error={fieldErrors.time}
                label={
                  <>
                    Time (min)
                    {isTimeOverride && <OverrideBadge />}
                    <TooltipIcon text="Duration of decarboxylation. Sous vide methods use longer times at lower temperatures for better terpene retention." />
                  </>
                }
              >
                {
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
                  />
                }
              </InputRow>

              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                  Decarb Efficiency
                  <TooltipIcon text="The percentage of THCA that successfully converts to THC during decarboxylation. 100% efficiency is theoretical maximum; real-world methods typically achieve 70-95%." />
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <InputRow
                    error={fieldErrors.effLow}
                    label={<>Low {isEffLowOverride && <OverrideBadge />}</>}
                  >
                    {
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
                      />
                    }
                  </InputRow>
                  <InputRow
                    error={fieldErrors.effExpected}
                    label={
                      <>Expected {isEffExpectedOverride && <OverrideBadge />}</>
                    }
                  >
                    {
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
                      />
                    }
                  </InputRow>
                  <InputRow
                    error={fieldErrors.effHigh}
                    label={<>High {isEffHighOverride && <OverrideBadge />}</>}
                  >
                    {
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
                      />
                    }
                  </InputRow>
                </div>
              </div>
            </>
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
              <div className="mt-1 grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
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
          <div
            aria-live="polite"
            className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-4"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Theoretical Maximum THC
            </span>
            <span
              className="mt-1 text-2xl font-bold text-foreground"
              data-testid="decarb-theoretical-max"
            >
              {results
                ? `${fmtSigFigs(results.theoreticalMax, decarb.weight, decarb.thcaPct, decarb.thcPct)} mg`
                : 'Enter your material weight and potency above to see results'}
            </span>
          </div>

          {/* Decarb-adjusted */}
          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-4"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
              Decarb-Adjusted THC
            </span>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  className={cn(
                    'text-lg font-semibold text-success',
                    reducedMotion ? '' : 'result-bloom'
                  )}
                  data-testid="decarb-expected"
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

          {/* Temperature Danger Zone Heatmap (flower mode only) */}
          {!isConcentrate && <DecarbHeatmap />}

          {/* CBD Results (only when CBDA or CBD > 0) */}
          {(parseFloat(decarb.cbdaPct) > 0 || parseFloat(decarb.cbdPct) > 0) &&
            cbdResults && (
              <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Decarb-Adjusted CBD
                </span>
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
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

      {/* Reaction Coordinate visualization (chemistry-forward wow moment) */}

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
