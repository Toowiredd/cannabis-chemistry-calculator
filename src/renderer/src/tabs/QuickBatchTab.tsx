import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, type UnitPreferences } from 'renderer/src/stores/appStore'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
  calculateAvbTheoreticalMax,
  AVB_RESIDUAL_THC_RANGES,
  type AVBColor,
} from 'renderer/src/engine/decarb'
import {
  calculateInfusedThc,
  calculateMgPerMl,
} from 'renderer/src/engine/infusion'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import { scaleRecipe } from 'renderer/src/engine/recipe'
import {
  cToF,
  convertVolume,
  convertWeight,
  ozToG,
  volumeToMl,
} from 'renderer/src/engine/units'
import { fmt1, round1n } from 'renderer/src/engine/formatting'
import { cn } from 'renderer/lib/utils'
import {
  RotateCcw,
  Scale,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  History,
  Leaf,
  Droplets,
  Cloud,
} from 'lucide-react'
import { LabelGenerator } from 'renderer/src/components/LabelGenerator'
import { InputRow } from 'renderer/src/components/InputRow'
import { TooltipIcon } from 'renderer/src/components/TooltipIcon'

const STEPS = [
  { key: 'material', label: 'Material & Lab Data' },
  { key: 'decarb', label: 'Decarb Method' },
  { key: 'infusion', label: 'Fat & Volume' },
  { key: 'dose', label: 'Servings & Dose' },
  { key: 'label', label: 'Label & Save' },
] as const

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
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const resetDecarb = useAppStore(s => s.resetDecarb)
  const resetInfusion = useAppStore(s => s.resetInfusion)
  const resetDose = useAppStore(s => s.resetDose)
  const addJournalEntry = useAppStore(s => s.addJournalEntry)
  const journalEntries = useAppStore(s => s.journalEntries)
  const recordSuccessfulPath = useAppStore(s => s.recordSuccessfulPath)

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
    // 2026-07-25 dose-units audit B1: convert from the per-field
    // `decarb.weightUnit` (the unit the user typed in) to grams for
    // engine calls. The display unit `units.weightUnit` is only for
    // showing the converted value. Previously this passed the raw
    // `decarb.weight` to the engine, which expected grams — toggling
    // display from g to oz then sent oz to the engine and the
    // theoretical max jumped 28.35x.
    const weightGrams = decarb.weightUnit === 'oz' ? ozToG(weight) : weight
    const thca = parseFloat(decarb.thcaPct)
    const thc = parseFloat(decarb.thcPct)
    const _cbda = parseFloat(decarb.cbdaPct)
    const _cbd = parseFloat(decarb.cbdPct)
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

    // 2026-07-25 AVB feature: three material modes (flower /
    // concentrate / avb). AVB skips the 0.877 THCA→THC factor
    // (it's already decarboxylated by the vaporizer) and uses the
    // residual THC % the user typed in `thcPct`. The engine math
    // is in `decarb.ts` (`calculateAvbTheoreticalMax`); this file
    // just routes the right call site.
    const isAvb = decarb.materialMode === 'avb'
    const hasDecarb = isAvb
      ? !Number.isNaN(weight) && !Number.isNaN(thc) && weight > 0 && thc > 0
      : !Number.isNaN(weight) && !Number.isNaN(thca) && !Number.isNaN(thc)
    const theoreticalMax = isAvb
      ? hasDecarb
        ? calculateAvbTheoreticalMax(weightGrams, thc)
        : 0
      : hasDecarb
        ? calculateTheoreticalMax(weightGrams, thca, thc)
        : 0
    // For AVB, the residual IS already-decarbed THC, so the
    // efficiency is 1.0. The flower / concentrate paths use the
    // user-selected decarb method's efficiency.
    const decarbedLow = isAvb
      ? hasDecarb
        ? calculateDecarbedThc(theoreticalMax, 1.0)
        : 0
      : hasDecarb
        ? calculateDecarbedThc(theoreticalMax, effLow)
        : 0
    const decarbedExpected = isAvb
      ? hasDecarb
        ? calculateDecarbedThc(theoreticalMax, 1.0)
        : 0
      : hasDecarb
        ? calculateDecarbedThc(theoreticalMax, effExpected)
        : 0
    const decarbedHigh = isAvb
      ? hasDecarb
        ? calculateDecarbedThc(theoreticalMax, 1.0)
        : 0
      : hasDecarb
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
    // Convert from the per-field unit to mL for engine calls.
    // Previously used `units.volumeUnit` which was wrong post-toggle.
    const volMl = volumeToMl(vol, infusion.volumeUnit)
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
      isAvb,
    }
  }, [decarb, infusion, dose, units])

  /* Keep upstream carry-forward in sync — use refs to avoid infinite loops */
  const prevDecarbExpected = useRef<string>('')
  const prevInfusedThc = useRef<string>('')
  useEffect(() => {
    const decarbStr =
      results.decarbedExpected > 0
        ? String(round1n(results.decarbedExpected))
        : ''
    const infusedStr =
      results.infusedThc > 0 ? String(round1n(results.infusedThc)) : ''
    if (decarbStr && decarbStr !== prevDecarbExpected.current) {
      prevDecarbExpected.current = decarbStr
      useAppStore.getState().setLastDecarbExpected(decarbStr)
    }
    if (infusedStr && infusedStr !== prevInfusedThc.current) {
      prevInfusedThc.current = infusedStr
      useAppStore.getState().setLastInfusedThc(infusedStr)
    }
  }, [results.decarbedExpected, results.infusedThc])

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

  /* Save to journal — matches the FirstTimerGuide.handleSaveToJournal
   * discipline: persist to disk FIRST, only add to the local store on
   * success. The catch-block fallback used to silently add to the
   * local store even when the IPC threw, which meant a failed save
   * would show a "saved" entry that vanished on the next Journal-tab
   * mount-time reload. The 2026-07-24 user-journey verification
   * caught this — see FirstTimerGuide.tsx:555-582 for the matching
   * fix. */
  const handleSaveBatch = async () => {
    const method = results.method
    const fat = results.fat

    // 2026-07-25 AVB feature: stamp `source: 'avb'` when the user
    // saved an AVB-origin batch so the Journal tab can group /
    // colour-code these separately from regular quickbatch entries.
    // The 'avb' literal is in `JournalEntrySource` (state-routing
    // widening) — the cast keeps the structural IPC contract
    // satisfied.
    const isAvbSave = decarb.materialMode === 'avb'
    const entry = {
      // 2026-07-25 ccc uiux-reviewer audit B1: stamp the entry
      // source so the journal can group / filter entries by where
      // they came from. The `state-routing` agent is widening the
      // `JournalEntry` type + migration in parallel; once that
      // lands the field is fully typed. Today TypeScript accepts
      // the extra string literal via the structural shape used at
      // the IPC boundary (see `window.App.saveJournalEntry`'s
      // `unknown` entry param).
      source: isAvbSave ? ('avb' as const) : ('quickbatch' as const),
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString().split('T')[0],
      strainName: '',
      strainId: store.decarb.strainId,
      materialWeight: decarb.weight,
      // 2026-07-25 ccc cross-tab data flow audit (MAJOR M1
      // follow-up): stamp the per-field authoring unit on the
      // journal entry so the Journal card can render the weight
      // with the correct unit. The `JournalEntry.materialWeightUnit`
      // field is the `state-routing`-owned schema widening tracked
      // alongside the B1 fix; the producer (this save site) writes
      // the real value here, and the Journal card reads it
      // directly. Pre-v4 entries (saved before the widening) have
      // no field and the migration backfills `'g'` on disk. Without
      // this stamp, a 0.12 oz save would round-trip as "0.12 g" on
      // the entry card (a 28x under-report).
      materialWeightUnit: decarb.weightUnit,
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
      // 2026-07-25 dose-units audit MAJOR (workflow): use the
      // per-field `infusion.volumeUnit` (the unit the user typed
      // in) for the journal entry, not the display
      // `units.volumeUnit`. If the user typed 100 in mL and then
      // toggled display to 'cup' before saving, this used to stamp
      // the entry as "100 cup" (≈23.6 L) when the user actually
      // meant 100 mL. A later reader of the journal entry would
      // mis-interpret it as 23.6 L of fat and a wildly inflated
      // dose. The per-field unit is the source of truth for what
      // the user typed.
      volumeUnit: infusion.volumeUnit,
      notes: `Quick Batch saved. Theoretical max: ${fmt1(results.theoreticalMax)} mg. Decarb expected: ${fmt1(results.decarbedExpected)} mg.`,
    }

    // No IPC bridge (browser-only / dev-renderer audit). Fall back to
    // local-store-only so the user can still see the entry. This is a
    // distinct code path from the IPC-throw case below — the user
    // knows their environment can't persist, and there's no disk to
    // be out-of-sync with.
    if (typeof window.App?.saveJournalEntry !== 'function') {
      addJournalEntry(entry)
      recordSuccessfulPath('make_batch', 'quickbatch')
      showToast('Batch saved to Journal (local only — no IPC bridge)')
      setActiveTab('journal')
      return
    }

    try {
      const result = await window.App.saveJournalEntry(entry)
      if (result.success) {
        addJournalEntry(entry)
        recordSuccessfulPath('make_batch', 'quickbatch')
        showToast('Batch saved to Journal')
        // Switch to the journal tab so the user can see their new
        // entry — same UX as the First-Timer Guide's save action.
        setActiveTab('journal')
      } else {
        showToast(result.error ?? 'Save failed')
      }
    } catch (err) {
      // Disk write failed (or the IPC bridge threw for a real reason,
      // not just "undefined"). Do NOT add to the local store — that
      // would be a phantom entry, lost on the next Journal-tab mount.
      console.warn('[QuickBatchTab] saveJournalEntry IPC threw', entry.id, err)
      showToast('Could not save — your data is still in the calculator')
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

  /* Load from last journal entry */
  const lastEntry = useMemo(() => {
    if (journalEntries.length === 0) return null
    const sorted = [...journalEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    return sorted[0]
  }, [journalEntries])

  const handleLoadFromLastBatch = () => {
    if (!lastEntry) return
    setDecarb({
      weight: lastEntry.materialWeight,
      thcaPct: lastEntry.thcaPct,
      thcPct: lastEntry.thcPct,
      cbdaPct: lastEntry.cbdaPct,
      cbdPct: lastEntry.cbdPct,
      presetId: lastEntry.methodId,
      // 2026-07-25 ccc workflow-validator audit (workflow N4, folded
      // into the B2 site): the prior `handleLoadFromLastBatch` only
      // restored weight + thcaPct + thcPct + cbdaPct + cbdPct + presetId
      // and dropped `strainId`. Loading a journal entry that was
      // saved with a strain selected silently re-opened the entry
      // with `strainId = null`, so the Strain Library would not
      // count the resumed batch against that strain's usage stats.
      strainId: lastEntry.strainId ?? null,
    })
    setInfusion({
      fatId: lastEntry.fatId,
      volume: lastEntry.volume,
      // 2026-07-25 ccc workflow-validator audit B2: restore the
      // per-field `volumeUnit` (the unit the entry was saved in),
      // not just the display `units.volumeUnit`. If the entry was
      // saved as "100 mL" while the user's display was "cup", the
      // old handler left `infusion.volumeUnit = 'mL'` (the
      // default) and toggled `units.volumeUnit = 'cup'`, so the
      // loaded "100" was re-interpreted as 100 cup — a 23.6x
      // fat-volume error.
      volumeUnit: lastEntry.volumeUnit as UnitPreferences['volumeUnit'],
    })
    setDose({
      servings: lastEntry.servings,
    })
    setUnits({
      // Display unit mirrors the per-field unit on load so the
      // user sees the same numeric value they saved. They can
      // toggle display freely after.
      volumeUnit: lastEntry.volumeUnit as UnitPreferences['volumeUnit'],
    })
    // Loading a prior batch is a deliberate repeat/resume action and is a
    // stronger startup signal than merely clicking into the tab.
    recordSuccessfulPath('resume_repeat', 'quickbatch')
    showToast('Loaded last batch')
  }

  /* Step helpers.
   * 2026-07-25 AVB feature: when `materialMode === 'avb'`, the Decarb
   * Method step (index 1) is meaningless — AVB is already decarbed
   * by the vaporizer. Skip the step in both directions by advancing
   * the raw step index by 2 instead of 1 when stepping out of
   * Material (0), and by 2 when stepping back from Fat (2). The
   * step header pills (the 5-segment progress UI) keep using the
   * raw step index, so the user can still jump back to Material
   * via the pill — they just see the Decarb Method step as
   * unmapped when AVB is the mode.
   */
  const isAvbMode = decarb.materialMode === 'avb'
  const nextStep = () =>
    setStep(s => {
      if (isAvbMode && s === 0) {
        // 0 (Material) -> 2 (Fat & Volume), skipping 1 (Decarb)
        return Math.min(s + 2, STEPS.length - 1)
      }
      return Math.min(s + 1, STEPS.length - 1)
    })
  const prevStep = () =>
    setStep(s => {
      if (isAvbMode && s === 2) {
        // 2 (Fat & Volume) -> 0 (Material), skipping 1 (Decarb)
        return Math.max(s - 2, 0)
      }
      return Math.max(s - 1, 0)
    })
  // 2026-07-25 ccc-workflow-validator audit (MINOR m2): in AVB mode the
  // "Next" button label was hardcoded to `STEPS[step + 1].label` even
  // though `nextStep` jumps 0 → 2 (skipping step 1). Derive from the
  // actual destination so the label matches the real hop.
  const nextStepIndex = isAvbMode && step === 0 ? 2 : step + 1
  const nextStepLabel =
    nextStepIndex < STEPS.length ? `Next: ${STEPS[nextStepIndex].label}` : 'Next'

  /* Temp override display */
  const _tempDisplay = useMemo(() => {
    const method = DECARB_METHODS.find(m => m.id === decarb.presetId)
    const base = method?.tempC ?? 95
    const val = decarb.tempOverride ? parseFloat(decarb.tempOverride) : base
    if (Number.isNaN(val)) return '--'
    return units.tempUnit === 'F' ? round1n(cToF(val)) : round1n(val)
  }, [decarb.presetId, decarb.tempOverride, units.tempUnit])

  /* Validation helpers.
   * 2026-07-25 AVB feature: in AVB mode, the THCA % input is
   * hidden — the residual THC % (typed into the thcPct field) is
   * what the engine uses. The gate reduces to "grams > 0 AND
   * thcPct >= 0", and the residual THC % is allowed to be 0
   * (a spent AVB with effectively zero residual is a valid input
   * that yields 0 mg — the user can still see the calculator run).
   */
  const materialValid =
    decarb.materialMode === 'avb'
      ? !Number.isNaN(parseFloat(decarb.weight)) &&
        parseFloat(decarb.weight) > 0 &&
        !Number.isNaN(parseFloat(decarb.thcPct)) &&
        parseFloat(decarb.thcPct) >= 0
      : !Number.isNaN(parseFloat(decarb.weight)) &&
        parseFloat(decarb.weight) > 0 &&
        !Number.isNaN(parseFloat(decarb.thcaPct)) &&
        parseFloat(decarb.thcaPct) >= 0
  const progressPct = ((step + 1) / STEPS.length) * 100

  // Inventory warning for weight
  //
  // 2026-07-25 ccc workflow-validator audit (R1) found the prior
  // guard short-circuited on `inventory.items.length === 0`, so the
  // warning never fired on the default empty state. The fix is the
  // same shape as DecarbTab:
  //   - No weight entered → show nothing.
  //   - Weight entered + empty inventory → show the friendly
  //     "Add to your inventory" warning with a link to Dashboard.
  //   - Weight entered + items present + insufficient → show the
  //     pre-existing "Insufficient material: need Xg, have Yg".
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null)
  const [inventoryEmpty, setInventoryEmpty] = useState<boolean>(false)
  useEffect(() => {
    const inventory = store.inventory
    const w = parseFloat(decarb.weight)
    if (Number.isNaN(w) || w <= 0) {
      setInventoryWarning(null)
      setInventoryEmpty(false)
      return
    }
    // 2026-07-25 AVB feature: 3-way material-mode branch. The
    // "Insufficient material" gate only fires for the kinds the
    // inventory actually tracks.
    //   - 'flower' (or undefined, the legacy default): sum
    //     `kind === 'flower' || kind === undefined` items
    //   - 'concentrate': not tracked in inventory (concentrates
    //     are typically bought by the gram, not batch-tracked)
    //     → no gate at all
    //   - 'avb': sum `kind === 'avb'` items
    if (decarb.materialMode === 'concentrate') {
      setInventoryWarning(null)
      setInventoryEmpty(false)
      return
    }
    const targetKind = decarb.materialMode // 'flower' | 'avb'
    const matching = inventory.items.filter(
      i =>
        (targetKind === 'flower'
          ? i.kind === 'flower' || i.kind === undefined
          : i.kind === 'avb')
    )
    if (matching.length === 0) {
      setInventoryWarning(null)
      setInventoryEmpty(true)
      return
    }
    setInventoryEmpty(false)
    // Use the per-field unit. See DecarbState.weightUnit.
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
      // right but the unit suffix is wrong. The engine calc
      // still uses grams (weightGrams), so this is display-only.
      // The .toFixed(1) matches the pre-fix format so existing
      // tests asserting "5.0g, have 1.0g" continue to pass; for
      // the default 'g' unit this is the right precision.
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
    store.inventory,
  ])

  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">Quick Batch</h2>
          <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {lastEntry && (
            <button
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground sm:flex-none"
              onClick={handleLoadFromLastBatch}
              type="button"
            >
              <History className="size-3.5" />
              Start from last batch
            </button>
          )}
          <button
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground sm:flex-none"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-1 gap-1 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((s, i) => {
            // 2026-07-25 ccc-workflow-validator audit (MAJOR M1): in
            // AVB mode the Decarb Method step (index 1) is intentionally
            // skipped, but the pill onClick was unguarded so the user
            // could click pill 1, set `step === 1`, and land on a
            // null-rendered body with no Next/Back. Disable the pill
            // in AVB mode so the user cannot enter the dead-end state.
            const pillDisabled = isAvbMode && i === 1
            return (
              <button
                aria-current={i === step ? 'step' : undefined}
                aria-disabled={pillDisabled || undefined}
                className={cn(
                  'min-h-10 min-w-0 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                  pillDisabled
                    ? 'bg-foreground/5 text-foreground/30 border border-foreground/10 cursor-not-allowed'
                    : i === step
                      ? 'bg-foreground/15 text-foreground border border-foreground/20'
                      : i < step
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-foreground/5 text-foreground/70 border border-foreground/10'
                )}
                disabled={pillDisabled}
                key={s.key}
                onClick={() => {
                  if (pillDisabled) return
                  setStep(i)
                }}
                title={
                  pillDisabled
                    ? 'Skipped in AVB mode — AVB is already decarboxylated'
                    : undefined
                }
                type="button"
              >
                <span className="block truncate">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- STEP 1: Material & Lab Data ---- */}
      {step === 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Material &amp; Lab Data
          </h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {inventoryEmpty && !inventoryWarning && (
              // 2026-07-25 inventory audit: when the user has
              // typed a weight but has no inventory items, show a
              // friendly warning with a link to the Dashboard
              // where the InventorySection lives (BLOCKER B4).
              <div
                className="col-span-full flex flex-wrap items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info"
                data-testid="quickbatch-inventory-empty"
              >
                <AlertTriangle className="size-4 shrink-0" />
                <span>Add to your inventory to track consumption.</span>
                <button
                  aria-label="Open Dashboard to add to inventory"
                  className="rounded font-semibold underline underline-offset-2 transition-colors hover:text-info/80"
                  data-testid="quickbatch-inventory-empty-link"
                  onClick={() => setActiveTab('dashboard')}
                  type="button"
                >
                  Open Dashboard
                </button>
              </div>
            )}
            {inventoryWarning && (
              <div
                className="col-span-full flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
                data-testid="quickbatch-inventory-shortage"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {inventoryWarning}
              </div>
            )}
            <InputRow
              label={
                <>
                  Material Weight
                  <TooltipIcon text="How much raw material you are starting with." />
                </>
              }
            >
              {
                <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                    data-testid="quickbatch-weight-input"
                    // 2026-07-25 dose-units audit B1: set per-field
                    // `decarb.weightUnit` to the current display unit.
                    // The toggle handler only flips `units.weightUnit`;
                    // it does not touch the stored value. The engine
                    // reads `decarb.weightUnit` (per-field) to
                    // interpret the value, so without this set the
                    // per-field unit stays at its pre-toggle value
                    // and the next render computes the wrong grams.
                    onChange={e =>
                      setDecarb({
                        weight: e.target.value,
                        weightUnit: units.weightUnit,
                      })
                    }
                    placeholder="0.0"
                    step="0.1"
                    type="number"
                    // Display: convert the stored value from the
                    // per-field unit to the current display unit,
                    // rounded to 2 decimals (so 0.12 oz doesn't
                    // render as 3.4019435...). See DecarbTab.tsx:861
                    // for the same pattern.
                    value={
                      decarb.weight === ''
                        ? ''
                        : decarb.weightUnit === units.weightUnit
                          ? decarb.weight
                          : (() => {
                              const n = parseFloat(decarb.weight)
                              if (Number.isNaN(n)) return decarb.weight
                              return convertWeight(
                                n,
                                decarb.weightUnit,
                                units.weightUnit
                              ).toFixed(2)
                            })()
                    }
                  />
                  <div className="inline-flex w-full shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5 min-[420px]:w-auto">
                    {(['g', 'oz'] as const).map(u => (
                      <button
                        className={cn(
                          'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-[420px]:flex-none',
                          units.weightUnit === u
                            ? 'bg-foreground/15 text-foreground'
                            : 'text-foreground/70 hover:text-foreground/80'
                        )}
                        data-testid={`quickbatch-weight-toggle-${u}`}
                        key={u}
                        onClick={() => setUnits({ weightUnit: u })}
                        type="button"
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              }
            </InputRow>

            {/* 2026-07-25 AVB feature: 3-option Material kind picker.
                When the user picks AVB, the THCA % input is hidden
                and replaced with a "Residual THC %" input (the AVB
                residual is already-active THC, so the 0.877 factor
                doesn't apply). A 3-segment color picker pre-fills
                the residual THC % with the midpoint of the color's
                range. */}
            <div
              className="col-span-full flex min-w-0 flex-col gap-2"
              data-testid="quickbatch-material-mode"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                Material
                {decarb.materialMode === 'avb' && (
                  <TooltipIcon text="Already Vaped Bud — the material left in your vaporizer after a session. It's already decarboxylated, so skip the oven step. Pick the color closest to your AVB to estimate residual potency." />
                )}
              </span>
              <div
                aria-label="Material kind"
                className="inline-flex w-full rounded-lg border border-foreground/20 bg-foreground/5 p-0.5"
                role="radiogroup"
              >
                {(
                  [
                    { value: 'flower', label: 'Flower', icon: Leaf },
                    { value: 'concentrate', label: 'Concentrate', icon: Droplets },
                    { value: 'avb', label: 'AVB (already vaped bud)', icon: Cloud },
                  ] as const
                ).map(opt => {
                  const Icon = opt.icon
                  const isSelected = decarb.materialMode === opt.value
                  return (
                    <button
                      aria-checked={isSelected}
                      aria-label={opt.label}
                      className={cn(
                        'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        isSelected
                          ? 'bg-foreground/15 text-foreground'
                          : 'text-foreground/70 hover:text-foreground/80'
                      )}
                      data-testid={`quickbatch-material-${opt.value}`}
                      key={opt.value}
                      onClick={() => setDecarb({ materialMode: opt.value })}
                      role="radio"
                      type="button"
                    >
                      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {decarb.materialMode === 'avb' ? (
              <>
                <InputRow
                  label={
                    <>
                      Residual THC %
                      <TooltipIcon text="Already-active THC in your AVB. AVB is decarboxylated by the vaporizer, so the 0.877 THCA→THC factor does NOT apply. Pick the AVB color below to pre-fill this with a typical value, then fine-tune." />
                    </>
                  }
                >
                  {
                    <input
                      className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                      data-testid="quickbatch-residual-thc-input"
                      max={100}
                      min={0}
                      onChange={e => setDecarb({ thcPct: e.target.value })}
                      placeholder="0.0"
                      step="0.1"
                      type="number"
                      value={decarb.thcPct}
                    />
                  }
                </InputRow>
                <div
                  className="col-span-full flex min-w-0 flex-col gap-2"
                  data-testid="quickbatch-avb-color-picker"
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
                        data-testid={`quickbatch-avb-color-${opt.value}`}
                        key={opt.value}
                        // Pre-fill the residual THC % with the
                        // midpoint of the color's range. The user
                        // can still fine-tune the % manually after.
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
              </>
            ) : (
              <InputRow
                label={
                  <>
                    THCA %
                    <TooltipIcon text="Raw cannabis actually contains THCA, not THC. Heat converts it." />
                  </>
                }
              >
                {
                  <input
                    className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                    onChange={e => setDecarb({ thcaPct: e.target.value })}
                    placeholder="0.0"
                    step="0.1"
                    type="number"
                    value={decarb.thcaPct}
                  />
                }
              </InputRow>
            )}

            {decarb.materialMode !== 'avb' && (
              <InputRow
                label={
                  <>
                    Existing THC %
                    <TooltipIcon text="THC already in your material. Ready to go, no heat needed." />
                  </>
                }
              >
                {
                  <input
                    className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                    onChange={e => setDecarb({ thcPct: e.target.value })}
                    placeholder="0.0"
                    step="0.1"
                    type="number"
                    value={decarb.thcPct}
                  />
                }
              </InputRow>
            )}

            <InputRow
              label={
                <>
                  CBDA %
                  <TooltipIcon text="Like THCA, raw cannabis contains CBDA instead of CBD. Heat converts it." />
                </>
              }
            >
              {
                <input
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e => setDecarb({ cbdaPct: e.target.value })}
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={decarb.cbdaPct}
                />
              }
            </InputRow>

            <InputRow
              label={
                <>
                  Existing CBD %
                  <TooltipIcon text="CBD already in your material. No heat needed." />
                </>
              }
            >
              {
                <input
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e => setDecarb({ cbdPct: e.target.value })}
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={decarb.cbdPct}
                />
              }
            </InputRow>
          </div>

          {results.theoreticalMax > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
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
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25 disabled:opacity-50 sm:w-auto"
              disabled={!materialValid}
              onClick={nextStep}
              type="button"
            >
              {nextStepLabel}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 2: Decarb Method ----
          2026-07-25 AVB feature: the Decarb Method step is
          meaningless for AVB — the material is already decarbed by
          the vaporizer. The nextStep/prevStep helpers skip this
          step's raw index (1) when materialMode === 'avb', so
          the user should never land here in AVB mode. The render
          block returns null as a defensive guard so a stale store
          (e.g. user toggled from flower→avb while on step 1) does
          not flash the decarb-method UI before nextStep fires. */}
      {step === 1 && decarb.materialMode !== 'avb' && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Decarb Method
          </h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DECARB_METHODS.map(method => {
              const isSelected = decarb.presetId === method.id
              return (
                <button
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-warning/50 bg-warning/10 dark:bg-warning/10'
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
                    <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
                      {method.terpeneLabel}
                    </span>
                    <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
                      {method.cbnLabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {results.decarbedExpected > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              {nextStepLabel}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 3: Fat & Volume ---- */}
      {step === 2 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Fat &amp; Volume
          </h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {INFUSION_FATS.map(fat => {
              const isSelected = infusion.fatId === fat.id
              return (
                <button
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-success/50 bg-success/10'
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
                    <span className="text-xs text-foreground/70">
                      {fat.notes}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <InputRow
            label={
              <>
                Fat Volume
                <TooltipIcon text="How much fat you are infusing." />
              </>
            }
          >
            {
              <div className="flex min-w-0 flex-col gap-2 min-[460px]:flex-row min-[460px]:items-center">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  data-testid="quickbatch-volume-input"
                  // 2026-07-25 dose-units audit B2: set per-field
                  // `infusion.volumeUnit` to the current display unit
                  // when the user types. The toggle handler only flips
                  // `units.volumeUnit`; it does not touch the stored
                  // value. The engine reads `infusion.volumeUnit`
                  // (per-field) to interpret the value, so without
                  // this set the per-field unit stays at its
                  // pre-toggle value and the mg/mL display drifts by
                  // the unit-conversion factor.
                  onChange={e =>
                    setInfusion({
                      volume: e.target.value,
                      volumeUnit: units.volumeUnit,
                    })
                  }
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  // Display: convert the stored value from the
                  // per-field unit to the current display unit,
                  // rounded to 2 decimals. See InfusionTab.tsx:511
                  // for the same pattern.
                  value={
                    infusion.volume === ''
                      ? ''
                      : infusion.volumeUnit === units.volumeUnit
                        ? infusion.volume
                        : (() => {
                            const n = parseFloat(infusion.volume)
                            if (Number.isNaN(n)) return infusion.volume
                            return convertVolume(
                              n,
                              infusion.volumeUnit,
                              units.volumeUnit
                            ).toFixed(2)
                          })()
                  }
                />
                <div className="inline-flex w-full shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5 min-[460px]:w-auto">
                  {(['mL', 'tsp', 'tbsp', 'cup'] as const).map(u => (
                    <button
                      className={cn(
                        'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-[460px]:flex-none min-[460px]:px-3',
                        units.volumeUnit === u
                          ? 'bg-foreground/15 text-foreground'
                          : 'text-foreground/70 hover:text-foreground/80'
                      )}
                      data-testid={`quickbatch-volume-toggle-${u.toLowerCase()}`}
                      key={u}
                      onClick={() => setUnits({ volumeUnit: u })}
                      type="button"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            }
          </InputRow>

          {results.infusedThc > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Total Infused THC
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fmt1(results.infusedThc)} mg
                </span>
              </div>
              {results.mgPerMl > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                    Concentration
                  </span>
                  <span className="text-sm font-semibold text-success">
                    {fmt1(results.mgPerMl)} mg/mL
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              {nextStepLabel}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 4: Servings & Dose ---- */}
      {step === 3 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Servings &amp; Dose
          </h3>

          <InputRow
            label={
              <>
                Number of Servings
                <TooltipIcon text="How many pieces or portions you are dividing the batch into." />
              </>
            }
          >
            {
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setDose({ servings: e.target.value })}
                placeholder="0"
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

          {results.mgPerServing > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  mg per Serving
                </span>
                <span className="result-bloom text-2xl font-bold text-foreground">
                  {fmt1(results.mgPerServing)} mg
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Classification
                </span>
                <span className="text-2xl font-bold text-success">
                  {results.classification}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={prevStep}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
              onClick={nextStep}
              type="button"
            >
              {nextStepLabel}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 5: Label & Save ---- */}
      {step === 4 && (
        <div className="grid grid-cols-1 gap-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              Label &amp; Save
            </h3>

            {/* Summary */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Material
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {/* 2026-07-25 ccc workflow-validator audit B6: convert
                      the stored material weight to the DISPLAY unit for
                      this label, matching the Decarb tab's pattern
                      (DecarbTab.tsx:867-881) — do NOT hardcode "g".
                      A user who typed 0.12 oz would otherwise see
                      "0.12 g" here even though they entered ounces. */}
                  {(() => {
                    const w = parseFloat(decarb.weight)
                    if (Number.isNaN(w))
                      return `${decarb.weight} ${units.weightUnit}`
                    if (decarb.weightUnit === units.weightUnit) {
                      return `${fmt1(w)} ${units.weightUnit}`
                    }
                    return `${convertWeight(w, decarb.weightUnit, units.weightUnit).toFixed(2)} ${units.weightUnit}`
                  })()}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Method
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {results.method?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Fat
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {results.fat?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Servings
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {dose.servings}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Theoretical Max
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.theoreticalMax)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Infused THC
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.infusedThc)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  mg/Serving
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {fmt1(results.mgPerServing)} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Classification
                </span>
                <span className="text-sm font-semibold text-success">
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
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={prevStep}
                type="button"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-success/20 bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20 sm:w-auto"
                  data-testid="quickbatch-save-button"
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
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success shadow-xl backdrop-blur-md">
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
