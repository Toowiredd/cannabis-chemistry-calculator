/**
 * FirstTimerGuide — multi-select kit-configurator wizard.
 *
 * Six steps. Each step lets the user check one, many, or zero options
 * (true multi-select throughout) and surfaces running math previews as
 * they toggle, so the user can compare decarb methods, fats, and
 * recipe formats without leaving the wizard.
 *
 * Wiring:
 * - Reads `wizard.active / stepIndex / selections` from `useAppStore`.
 * - Writes via the wizard slice setters
 *   (`toggleWizardSelection`, `setWizardNumberField`, `setWizardStep`,
 *   `dismissWizard`).
 * - Pulls curated option sets from `engine/wizardPresets.ts`
 *   (METHOD_OPTIONS, FAT_OPTIONS, FORMAT_OPTIONS — alias shim of the
 *   underlying `engine/wizardPresets.ts` re-exports).
 * - Live math runs through `engine/decarb` + `engine/infusion`
 *   + `engine/dosing` — no hardcoded constants in this file.
 *
 * UX choice (documented per task brief):
 *   Steps 3, 4, 5 (decarb methods, fats, formats) require at least one
 *   selection to enable the Next button — the matrix in step 6 is the
 *   whole point of the wizard, and "0 of 0" picks produce no useful
 *   output. Step 1 (equipment) is intentionally permissive: an empty
 *   selection means "I don't have any of this yet" which is a legitimate
 *   state for a first-timer, so Next is always enabled there. Step 2
 *   (material) gates on valid positive numerics.
 */
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Beaker,
  Carrot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cookie,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  FlaskConical,
  Layers,
  ListChecks,
  Pill,
  Salad,
  Scale,
  Thermometer,
  UtensilsCrossed,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'

import { MultiSelectGroup } from 'renderer/components/MultiSelectGroup'
import grindCoarse from 'renderer/src/assets/wizard/grind-coarse.png'
import grindMedium from 'renderer/src/assets/wizard/grind-medium.png'
import grindFine from 'renderer/src/assets/wizard/grind-fine.png'
import bagQuart from 'renderer/src/assets/wizard/bag-quart.png'
import bagGallon from 'renderer/src/assets/wizard/bag-gallon.png'
import bag2Gallon from 'renderer/src/assets/wizard/bag-2gallon.png'
import bagSmallVac from 'renderer/src/assets/wizard/bag-small-vac.png'
import packLoose from 'renderer/src/assets/wizard/pack-loose.png'
import packMedium from 'renderer/src/assets/wizard/pack-medium.png'
import packTight from 'renderer/src/assets/wizard/pack-tight.png'
// All three are the same canonical reference image (byte-identical copies
// of pack-tight.png). The variance between loose/medium/tight is
// described in the captions and "why pick this" prose rather than
// rendered as three different visuals — AI image-to-image couldn't
// produce visually consistent fill-state variants, so we ship one
// reference image and let the text do the work.
// Decarb visuals — one image per method, all share the same kitchen style
// (1024x1024 light-gray background, US quarter or ruler for scale, no text).
import decarbSvDry from 'renderer/src/assets/wizard/decarb-sv-dry.png'
import decarbSvFast from 'renderer/src/assets/wizard/decarb-sv-fast.png'
import decarbSvCombined from 'renderer/src/assets/wizard/decarb-sv-combined.png'
import decarbSvLowtemp from 'renderer/src/assets/wizard/decarb-sv-lowtemp.png'
import decarbOvenSealed from 'renderer/src/assets/wizard/decarb-oven-sealed.png'
import decarbOvenOpen from 'renderer/src/assets/wizard/decarb-oven-open.png'
// Fat visuals — one image per carrier fat, jar + spoon + US quarter.
import fatGhee from 'renderer/src/assets/wizard/fat-ghee.png'
import fatCoconut from 'renderer/src/assets/wizard/fat-coconut.png'
import fatMct from 'renderer/src/assets/wizard/fat-mct.png'
import fatCustom from 'renderer/src/assets/wizard/fat-custom.png'
// Format visuals — finished product at scale (ruler for brownies/gummies,
// US quarter for capsules/8x8/custom).
import formatBrownie9x13 from 'renderer/src/assets/wizard/format-brownie-9x13.png'
import formatBrownie8x8 from 'renderer/src/assets/wizard/format-brownie-8x8.png'
import formatGummy80 from 'renderer/src/assets/wizard/format-gummy-80.png'
import formatGummy160 from 'renderer/src/assets/wizard/format-gummy-160.png'
import formatCapsule00 from 'renderer/src/assets/wizard/format-capsule-00.png'
import formatCustom from 'renderer/src/assets/wizard/format-custom.png'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import { calculateInfusedThc } from 'renderer/src/engine/infusion'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import {
  METHOD_OPTIONS,
  FAT_OPTIONS,
  FORMAT_OPTIONS,
} from 'renderer/src/engine/wizardOptions'
import { FIRST_TIMER_DECARB_EFF } from 'renderer/src/engine/wizardPresets'
import { cn } from 'renderer/lib/utils'

import { useReducedMotion } from '../hooks/useReducedMotion'
import { useModalA11y } from '../hooks/useModalA11y'

/* ------------------------------------------------------------------ */
/* Step model                                                         */
/* ------------------------------------------------------------------ */

interface StepDef {
  id: 'equipment' | 'material' | 'prep' | 'decarb' | 'fats' | 'formats' | 'review'
  label: string
  Icon: LucideIcon
  /** Short helper shown under the header on each step. */
  description: string
}

/**
 * `description` is the header copy the brief asked for on every picker
 * step. Steps 2 and 6 carry prose instead of helper text because they
 * are not picker steps.
 */
const STEPS: readonly StepDef[] = [
  {
    id: 'equipment',
    label: 'Equipment',
    Icon: UtensilsCrossed,
    description:
      "Tick what you have on hand. Anything you don't own yet has a substitution in the row's subtitle.",
  },
  {
    id: 'material',
    label: 'Your material',
    Icon: Scale,
    description: 'Two numbers and a one-click shortcut from your Decarb tab.',
  },
  {
    id: 'prep',
    label: 'Prep',
    Icon: Salad,
    description:
      'Pick how you grind, which bag, and how tightly you pack — visual guides below.',
  },
  {
    id: 'decarb',
    label: 'Decarb methods',
    Icon: Thermometer,
    description:
      "Check every method you're willing to try. We'll show numbers for each below.",
  },
  {
    id: 'fats',
    label: 'Fats on hand',
    Icon: FlaskConical,
    description:
      'Tick the carrier fats you actually own — one preview line per fat.',
  },
  {
    id: 'formats',
    label: 'Recipe formats',
    Icon: Cookie,
    description:
      'Pick the formats you want to make. We sum their serving counts at the bottom.',
  },
  {
    id: 'review',
    label: 'Your numbers',
    Icon: ListChecks,
    description:
      'Every (method × fat × format) combination with a live calculation.',
  },
] as const

/* ------------------------------------------------------------------ */
/* Equipment options (curated, ~8-10 real kitchen items)              */
/* ------------------------------------------------------------------ */

interface EquipmentOption {
  id: string
  label: string
  /** Friendly substitution when the user does not own the item. */
  subtitle: string
  Icon: LucideIcon
}

const EQUIPMENT_OPTIONS: readonly EquipmentOption[] = [
  {
    id: 'flower',
    label: 'Cannabis flower',
    subtitle: 'Any amount works. Quality matters more than quantity.',
    Icon: Salad,
  },
  {
    id: 'glass_dish',
    label: 'Glass baking dish',
    subtitle: 'A ceramic casserole dish or a pie plate works fine.',
    Icon: Layers,
  },
  {
    id: 'foil',
    label: 'Aluminum foil',
    subtitle:
      'An oven-safe lid or a tight layer of parchment plus foil will do.',
    Icon: Layers,
  },
  {
    id: 'fat',
    label: 'Butter or coconut oil',
    subtitle: 'Ghee or any oil with some fat content works. Avoid watery oils.',
    Icon: Carrot,
  },
  {
    id: 'oven',
    label: 'An oven',
    subtitle: 'A toaster oven with a temperature dial works too.',
    Icon: Flame,
  },
  {
    id: 'heat_source',
    label: 'A stove or slow cooker',
    subtitle:
      'A double boiler or even a very low oven holds the right temperature.',
    Icon: Flame,
  },
  {
    id: 'strainer',
    label: 'A strainer or cheesecloth',
    subtitle:
      'A clean kitchen towel, fine-mesh sieve, or nut-milk bag will do.',
    Icon: Beaker,
  },
  {
    id: 'bake_vehicle',
    label: 'Something to bake with',
    subtitle:
      'Brownie mix, cookie dough, cake mix, gummies, whatever you like.',
    Icon: Cookie,
  },
  {
    id: 'kitchen_scale',
    label: 'A digital kitchen scale',
    subtitle:
      'A postal scale or even ½-gram resolution jewellery scales work in a pinch.',
    Icon: Scale,
  },
]

/* ------------------------------------------------------------------ */
/* Equipment icon lookup                                              */
/* ------------------------------------------------------------------ */

function _equipmentIconFor(id: string): LucideIcon {
  return EQUIPMENT_OPTIONS.find(o => o.id === id)?.Icon ?? UtensilsCrossed
}

/* ------------------------------------------------------------------ */
/* Small formatters                                                   */
/* ------------------------------------------------------------------ */

function _round1(value: number): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.round((value + 1e-9) * 10) / 10
}

function _fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0.0'
  return _round1(value).toFixed(1)
}

function _fmtInt(value: number): string {
  if (value == null || Number.isNaN(value)) return '0'
  return Math.round(value).toString()
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Try the engine math and return null if inputs are unusable.
 * Centralizes the "is this preview safe to show?" check across steps.
 */
function _safeRun<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function FirstTimerGuide(): ReactNode {
  /* ---- store wiring ---- */
  const active = useAppStore(s => s.wizard.active)
  const stepIndex = useAppStore(s => s.wizard.stepIndex)
  const selections = useAppStore(s => s.wizard.selections)
  const setWizardStep = useAppStore(s => s.setWizardStep)
  const toggleWizardSelection = useAppStore(s => s.toggleWizardSelection)
  const setWizardNumberField = useAppStore(s => s.setWizardNumberField)
  const dismissWizard = useAppStore(s => s.dismissWizard)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const addJournalEntry = useAppStore(s => s.addJournalEntry)
  const decarbDefaults = useAppStore(s => s.decarb)
  const infusionDefaults = useAppStore(s => s.infusion)

  const reducedMotion = useReducedMotion()

  /* Prep step selections (visual guides for grind/bag/pack). These are
   * intentional ephemeral state — they are not persisted to the journal
   * entry. The user's prep choices don't materially affect the resulting
   * matrix math (which is method × fat × format driven); they exist to
   * teach first-timers the visual concepts before they pick a method. */
  const [prepGrindId, setPrepGrindId] = useState<GrindId | null>(null)
  const [prepBagId, setPrepBagId] = useState<BagId | null>(null)
  const [prepPackId, setPrepPackId] = useState<PackId | null>(null)

  /* ---- local derived state ---- */
  const step = STEPS[stepIndex] ?? STEPS[0]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === STEPS.length - 1
  const wizardTitleId = useId()

  const grams = selections.grams ?? 0
  const thcaPct = selections.thcaPct ?? 0
  const servingsPerFormat = selections.servings

  /* ---- selection sets ---- */
  const equipmentSet = useMemo(
    () => new Set(selections.equipment),
    [selections.equipment]
  )
  const methodSet = useMemo(
    () => new Set(selections.decarbMethodIds),
    [selections.decarbMethodIds]
  )
  const fatSet = useMemo(() => new Set(selections.fatIds), [selections.fatIds])
  const formatSet = useMemo(
    () => new Set(selections.formatIds),
    [selections.formatIds]
  )

  /* ---- live math (used by steps 3, 4, 5, 6) ---- */
  const theoretical = useMemo(
    () =>
      grams > 0 && thcaPct > 0 && thcaPct <= 100
        ? (_safeRun(() => calculateTheoreticalMax(grams, thcaPct, 0)) ?? 0)
        : 0,
    [grams, thcaPct]
  )

  /* ---- per-method preview ---- */
  const perMethodPreview = useMemo(() => {
    if (theoretical <= 0) return []
    return METHOD_OPTIONS.filter(m => methodSet.has(m.id)).map(m => {
      const decarbed = _safeRun(() =>
        calculateDecarbedThc(theoretical, m.efficiency.expected)
      )
      return {
        id: m.id,
        label: m.label,
        tempC: m.tempC,
        timeMin: m.timeMin,
        timeMax: m.timeMax,
        efficiency: m.efficiency.expected,
        decarbed: decarbed ?? 0,
      }
    })
  }, [theoretical, methodSet])

  /* ---- per-fat preview ---- */
  const perFatPreview = useMemo(() => {
    if (theoretical <= 0) return []
    // Anchor: average decarbed THC across selected methods, or fall back to
    // a sensible default (oven_sealed's expected efficiency, lifted to
    // wizardPresets.ts as FIRST_TIMER_DECARB_EFF) so the fat previews still
    // render when the user lands on the fats step before picking methods.
    const avgDecarbed =
      perMethodPreview.length > 0
        ? perMethodPreview.reduce((s, m) => s + m.decarbed, 0) /
          perMethodPreview.length
        : (_safeRun(() =>
            calculateDecarbedThc(theoretical, FIRST_TIMER_DECARB_EFF)
          ) ?? 0)
    return FAT_OPTIONS.filter(f => fatSet.has(f.id)).map(f => {
      const infused =
        _safeRun(() => calculateInfusedThc(avgDecarbed, f.extractionEff)) ?? 0
      return {
        id: f.id,
        label: f.label,
        extractionEff: f.extractionEff,
        infused,
      }
    })
  }, [theoretical, perMethodPreview, fatSet])

  /* ---- format summary ---- */
  const totalServings = useMemo(
    () =>
      FORMAT_OPTIONS.filter(r => formatSet.has(r.id)).reduce(
        (s, r) =>
          s +
          (servingsPerFormat && servingsPerFormat > 0
            ? servingsPerFormat
            : r.suggestedServings),
        0
      ),
    [formatSet, servingsPerFormat]
  )

  /* ---- matrix (used by step 6) ---- */
  const matrix = useMemo(() => {
    if (
      selections.decarbMethodIds.length === 0 ||
      selections.fatIds.length === 0 ||
      selections.formatIds.length === 0
    ) {
      return []
    }
    const methods = METHOD_OPTIONS.filter(m => methodSet.has(m.id))
    const fats = FAT_OPTIONS.filter(f => fatSet.has(f.id))
    const formats = FORMAT_OPTIONS.filter(r => formatSet.has(r.id))
    const combos: Array<{
      key: string
      method: string
      fat: string
      format: string
      theoretical: number
      decarbed: number
      infused: number
      servings: number
      perServing: number
      classification: string
    }> = []
    for (const m of methods) {
      const decarbed =
        _safeRun(() =>
          calculateDecarbedThc(theoretical, m.efficiency.expected)
        ) ?? 0
      for (const f of fats) {
        const infused =
          _safeRun(() => calculateInfusedThc(decarbed, f.extractionEff)) ?? 0
        for (const r of formats) {
          const servings =
              servingsPerFormat != null && servingsPerFormat > 0
                ? servingsPerFormat
                : r.suggestedServings
          const perServing =
            _safeRun(() => calculateMgPerServing(infused, servings)) ?? 0
          const classification = _safeRun(() => classifyDose(perServing)) ?? ''
          combos.push({
            key: `${m.id}+${f.id}+${r.id}`,
            method: m.label,
            fat: f.label,
            format: r.label,
            theoretical,
            decarbed,
            infused,
            servings,
            perServing,
            classification,
          })
        }
      }
    }
    return combos
  }, [methodSet, fatSet, formatSet, theoretical, servingsPerFormat])

  /* ---- CTA: save to journal ---- */
  // The on-screen CTA + prose (lines around 1983-1987) promise a SINGLE entry
  // — the "top recommendation" — that is quick and reversible. The prior
  // implementation saved every matrix row, which contradicted the prose and
  // could write up to 18 entries in one click. The 2026-07-24 ccc-validation
  // team flagged this as a MAJOR. Now the code matches the prose: save the
  // first matrix row only. Users who want all combinations in the journal
  // can use the per-row "Add" affordance in Dose tab, or repeat the wizard
  // for a different top pick.
  const handleSaveToJournal = useCallback(async () => {
    if (matrix.length === 0) return
    const topRow = matrix[0]
    const baseDate = new Date().toISOString().split('T')[0]
    const infusionVol =
      infusionDefaults.volume &&
      Number.isFinite(parseFloat(infusionDefaults.volume)) &&
      parseFloat(infusionDefaults.volume) > 0
        ? infusionDefaults.volume
        : '0'
    const infusionVolNum = parseFloat(infusionVol)
    // Concentration = infused THC (mg) / volume (mL). Was hardcoded '0'
    // before, which made the journal display show "0 mg/mL" even when the
    // math clearly should produce a real number.
    const concentration =
      Number.isFinite(infusionVolNum) && infusionVolNum > 0
        ? _fmt1(topRow.infused / infusionVolNum)
        : '0'
    const entry = {
      id: `entry_${Date.now()}_0_${Math.random().toString(36).slice(2, 8)}`,
      date: baseDate,
      strainName: '',
      strainId: null,
      materialWeight: grams.toString(),
      thcaPct: thcaPct.toString(),
      thcPct: '0',
      cbdaPct: '0',
      cbdPct: '0',
      methodId: METHOD_OPTIONS.find(m => m.label === topRow.method)?.id ?? '',
      methodName: topRow.method,
      fatId: FAT_OPTIONS.find(f => f.label === topRow.fat)?.id ?? '',
      fatName: topRow.fat,
      servings: topRow.servings.toString(),
      mgPerServing: _fmt1(topRow.perServing),
      classification: topRow.classification,
      totalInfusedThc: _fmt1(topRow.infused),
      concentration,
      volume: infusionVol,
      volumeUnit: 'mL',
      notes: `Saved from First-Timer Guide. Top recommendation: ${topRow.method} + ${topRow.fat} + ${topRow.format}.`,
    }
    // Persist to disk FIRST; only add to the local store if the disk write
    // succeeded. Previously the order was reversed — that meant a failed IPC
    // silently left the entry in the local store and the Journal tab's
    // mount-time reload from disk would then overwrite and lose it.
    try {
      if (typeof window.App?.saveJournalEntry !== 'function') {
        // No IPC bridge (browser-only / dev-renderer audit). Fall back
        // to local-store-only so the user can still see the entry.
        addJournalEntry(entry)
        setActiveTab('journal')
        dismissWizard()
        return
      }
      const result = await window.App.saveJournalEntry(entry)
      if (result?.success) {
        addJournalEntry(entry)
        setActiveTab('journal')
        dismissWizard()
      } else {
        console.warn(
          '[FirstTimerGuide] saveJournalEntry IPC returned failure',
          entry.id,
          result?.error
        )
        // Disk failed — do NOT add to local store (it would be lost on
        // next mount-time reload) and do NOT jump to the journal tab
        // (the user would see a phantom entry that vanishes on refresh).
        // Just leave them on the review step with a console warning.
      }
    } catch (err) {
      console.warn('[FirstTimerGuide] saveJournalEntry IPC threw', entry.id, err)
    }
  }, [matrix, grams, thcaPct, infusionDefaults.volume, addJournalEntry, setActiveTab, dismissWizard])

  /* ---- CTA: open in Quick Batch ---- */
  const handleOpenQuickBatch = useCallback(() => {
    setActiveTab('quickbatch')
    dismissWizard()
  }, [setActiveTab, dismissWizard])

  /* ---- dismiss ---- */
  const handleDismiss = useCallback(() => {
    dismissWizard()
  }, [dismissWizard])

  /* ---- nav ---- */
  const canGoNext = useMemo(() => {
    switch (step.id) {
      case 'equipment':
        // Permissive — empty is legitimate (first-timer might own nothing).
        return true
      case 'material':
        return (
          grams > 0 &&
          Number.isFinite(grams) &&
          thcaPct > 0 &&
          thcaPct <= 100 &&
          Number.isFinite(thcaPct)
        )
      case 'decarb':
        return selections.decarbMethodIds.length > 0
      case 'fats':
        return selections.fatIds.length > 0
      case 'formats':
        // No override required — formats have their own suggestedServings
        // defaults. Only block advancement if there are no formats picked.
        return selections.formatIds.length > 0
      case 'review':
        return false
      default:
        return true
    }
  }, [step.id, grams, thcaPct, servingsPerFormat, selections])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    if (isLastStep) return
    setWizardStep(stepIndex + 1)
  }, [canGoNext, isLastStep, stepIndex, setWizardStep])

  const goBack = useCallback(() => {
    if (isFirstStep) return
    setWizardStep(stepIndex - 1)
  }, [isFirstStep, stepIndex, setWizardStep])

  /* ---- jump-to-step via header pills (within completed set) ---- */
  const gotoStep = useCallback(
    (i: number) => {
      // Don't allow jumping forward past the current step — that would
      // skip required validation. Jumping back is always allowed.
      if (i <= stepIndex) setWizardStep(i)
      else if (canGoNext) setWizardStep(i)
    },
    [stepIndex, canGoNext, setWizardStep]
  )

  /* ---- "Use values from Decarb" shortcut ---- */
  const handleUseDecarbShortcut = useCallback(() => {
    const w = parseFloat(decarbDefaults.weight)
    const p = parseFloat(decarbDefaults.thcaPct)
    setWizardNumberField('grams', Number.isFinite(w) && w > 0 ? w : undefined)
    setWizardNumberField(
      'thcaPct',
      Number.isFinite(p) && p > 0 && p <= 100 ? p : undefined
    )
  }, [decarbDefaults.weight, decarbDefaults.thcaPct, setWizardNumberField])

  /* ---- material numeric inputs ---- */
  const handleGramsChange = useCallback(
    (raw: string) => {
      const v = parseFloat(raw)
      setWizardNumberField('grams', Number.isFinite(v) && v > 0 ? v : undefined)
    },
    [setWizardNumberField]
  )
  const handleThcaChange = useCallback(
    (raw: string) => {
      const v = parseFloat(raw)
      setWizardNumberField(
        'thcaPct',
        Number.isFinite(v) && v > 0 && v <= 100 ? v : undefined
      )
    },
    [setWizardNumberField]
  )
  const handleServingsChange = useCallback(
    (raw: string) => {
      const v = parseFloat(raw)
      setWizardNumberField(
        'servings',
        Number.isFinite(v) && v > 0 ? v : undefined
      )
    },
    [setWizardNumberField]
  )

  /* ---- modal accessibility: focus, scroll lock, escape ---- */
  const modalRef = useModalA11y(active, handleDismiss)

  /* ---- render gating ---- */
  if (!active) return null

  /* ---------------------------------------------------------------- */
  /* JSX                                                              */
  /* ---------------------------------------------------------------- */
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="presentation"
    >
      <div
        aria-labelledby={wizardTitleId}
        aria-modal="true"
        className="glass-strong relative flex h-full max-h-[min(880px,calc(100dvh-2rem))] w-full max-w-[min(960px,calc(100dvw-2rem))] flex-col overflow-hidden rounded-2xl border border-foreground/10 shadow-2xl"
        ref={modalRef}
        role="dialog"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2
              className="text-lg font-semibold text-foreground/90"
              id={wizardTitleId}
            >
              First-Timer Guide
            </h2>
            <p className="text-xs text-foreground/60">
              Your foolproof walkthrough from flower to edible
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              data-testid="wizard-skip"
              onClick={handleDismiss}
              type="button"
            >
              Skip — take me to the full app
            </button>
            <button
              aria-label="Close guide"
              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              data-testid="wizard-close"
              onClick={handleDismiss}
              title="Close guide"
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Step indicator + description */}
        <nav
          aria-label="Wizard steps"
          className="flex shrink-0 flex-col gap-2 border-b border-foreground/10 px-4 py-3 sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-1">
            {STEPS.map((s, i) => {
              const StepIcon = s.Icon
              const isActive = i === stepIndex
              const isPast = i < stepIndex
              return (
                <button
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    isActive
                      ? 'bg-foreground/15 text-foreground border border-foreground/20'
                      : 'text-foreground/60 hover:bg-foreground/5',
                    !isActive && !isPast && 'opacity-60'
                  )}
                  data-testid={`wizard-pill-${s.id}`}
                  disabled={!isPast && !isActive}
                  key={s.id}
                  onClick={() => gotoStep(i)}
                  type="button"
                >
                  <StepIcon className="size-3.5" />
                  {s.label}
                </button>
              )
            })}
          </div>
          <p
            className={cn(
              'text-xs text-foreground/65',
              reducedMotion ? '' : 'transition-opacity duration-200'
            )}
            data-testid="wizard-step-description"
          >
            {step.description}
          </p>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {step.id === 'equipment' && (
            <StepEquipment
              onToggle={id => toggleWizardSelection('equipment', id)}
              selectedIds={Array.from(equipmentSet)}
            />
          )}

          {step.id === 'material' && (
            <StepMaterial
              grams={grams}
              onGramsChange={handleGramsChange}
              onShortcut={handleUseDecarbShortcut}
              onThcaChange={handleThcaChange}
              thcaPct={thcaPct}
            />
          )}

          {step.id === 'prep' && (
            <StepPrep
              bagId={prepBagId}
              grindId={prepGrindId}
              onBagChange={setPrepBagId}
              onGrindChange={setPrepGrindId}
              onPackChange={setPrepPackId}
              packId={prepPackId}
            />
          )}

          {step.id === 'decarb' && (
            <StepDecarb
              onToggle={id => toggleWizardSelection('decarbMethodIds', id)}
              perMethodPreview={perMethodPreview}
              selectedIds={Array.from(methodSet)}
            />
          )}

          {step.id === 'fats' && (
            <StepFats
              onToggle={id => toggleWizardSelection('fatIds', id)}
              perFatPreview={perFatPreview}
              selectedIds={Array.from(fatSet)}
            />
          )}

          {step.id === 'formats' && (
            <StepFormats
              onServingsChange={handleServingsChange}
              selectedIds={Array.from(formatSet)}
              servingsPerFormat={servingsPerFormat ?? 0}
              setSelectedIds={id => toggleWizardSelection('formatIds', id)}
              totalServings={totalServings}
            />
          )}

          {step.id === 'review' && (
            <StepReview
              grams={grams}
              matrix={matrix}
              onOpenQuickBatch={handleOpenQuickBatch}
              onSave={handleSaveToJournal}
              thcaPct={thcaPct}
            />
          )}
        </div>

        {/* Footer nav */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3 sm:px-6 sm:py-4">
          <button
            aria-label="Previous step"
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              !isFirstStep
                ? 'text-foreground/80 hover:bg-foreground/10'
                : 'cursor-not-allowed text-foreground/30'
            )}
            data-testid="wizard-back"
            disabled={isFirstStep}
            onClick={goBack}
            type="button"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>

          <div aria-hidden="true" className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i === stepIndex
                    ? 'bg-foreground/80'
                    : i < stepIndex
                      ? 'bg-foreground/40'
                      : 'bg-foreground/15'
                )}
                data-testid={`wizard-dot-${s.id}`}
                key={s.id}
              />
            ))}
          </div>

          <button
            aria-label="Next step"
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              canGoNext && !isLastStep
                ? 'bg-foreground/15 text-foreground hover:bg-foreground/20'
                : 'cursor-not-allowed text-foreground/30'
            )}
            data-testid="wizard-next"
            disabled={!canGoNext || isLastStep}
            onClick={goNext}
            type="button"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Per-step components                                                 */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Step 1 — Equipment                                                 */
/* ------------------------------------------------------------------ */

interface StepEquipmentProps {
  selectedIds: string[]
  onToggle: (id: string) => void
}

function StepEquipment({
  selectedIds,
  onToggle,
}: StepEquipmentProps): ReactNode {
  const options = EQUIPMENT_OPTIONS.map(o => ({
    id: o.id,
    label: o.label,
    subtitle: o.subtitle,
    selected: selectedIds.includes(o.id),
    icon: o.Icon,
    onToggle: () => onToggle(o.id),
  }))

  return (
    <div className="space-y-4">
      <MultiSelectGroup
        counterLabel={`${selectedIds.length} checked`}
        hint="No judgement — every kitchen is different. Check what you have, leave what you don't."
        label="What you have on hand"
        options={options}
      />

      <div className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-3">
        <Wand2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-foreground/70"
        />
        <p className="text-xs leading-relaxed text-foreground/70">
          The one thing you cannot mess up: keep the oven at 235°F (113°C) and
          do not open the door during the first hour. Opening drops the
          temperature and lets out the good stuff.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 2 — Material                                                  */
/* ------------------------------------------------------------------ */

interface StepMaterialProps {
  grams: number
  thcaPct: number
  onGramsChange: (raw: string) => void
  onThcaChange: (raw: string) => void
  onShortcut: () => void
}

function StepMaterial({
  grams,
  thcaPct,
  onGramsChange,
  onThcaChange,
  onShortcut,
}: StepMaterialProps): ReactNode {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-foreground/80">
        Two numbers and you are set. If you have run the Decarb tab already, the
        button below pulls those values in for you.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/5 px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          data-testid="wizard-use-decarb"
          onClick={onShortcut}
          type="button"
        >
          <Copy className="size-3.5" />
          Use values from Decarb
        </button>
        <span className="text-xs text-foreground/55">
          Grabs whatever you already entered on the Decarb tab.
        </span>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-4">
        <div>
          <label
            className="mb-1.5 block text-xs font-medium text-foreground/80"
            htmlFor="ftg-grams"
          >
            How much cannabis do you have? (grams)
          </label>
          <input
            className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
            data-testid="wizard-grams"
            id="ftg-grams"
            min="0"
            onChange={e => onGramsChange(e.target.value)}
            step="0.1"
            type="number"
            value={grams > 0 ? grams : ''}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-xs font-medium text-foreground/80"
            htmlFor="ftg-thca"
          >
            Roughly what percent THCA? (15–20% is a safe guess for decent
            flower.)
          </label>
          <input
            className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
            data-testid="wizard-thca"
            id="ftg-thca"
            max="100"
            min="0"
            onChange={e => onThcaChange(e.target.value)}
            step="0.1"
            type="number"
            value={thcaPct > 0 ? thcaPct : ''}
          />
        </div>
      </div>

      <div
        className="rounded-xl border border-foreground/10 bg-foreground/5 p-3"
        data-testid="wizard-material-preview"
      >
        <p className="text-xs text-foreground/70">
          {grams > 0 && thcaPct > 0 && thcaPct <= 100 ? (
            <>
              Theoretical max with{' '}
              <strong className="font-semibold">{_fmt1(grams)} g</strong> at{' '}
              <strong className="font-semibold">{_fmt1(thcaPct)}%</strong> is{' '}
              <strong className="font-semibold">
                {_fmt1(
                  _safeRun(() => calculateTheoreticalMax(grams, thcaPct, 0)) ??
                    0
                )}{' '}
                mg
              </strong>{' '}
              of decarboxylated THC if everything converted perfectly.
            </>
          ) : (
            <>Enter both numbers to see the live theoretical-max estimate.</>
          )}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 3 — Prep (grind level + bag + packing arrangement)            */
/* ------------------------------------------------------------------ */

/**
 * AI-generated visual aids (flat illustrations of cannabis kitchen
 * concepts). These ship as static PNGs so the wizard is fully offline-
 * capable after install — no remote fetch on first run.
 */
type GrindId = 'coarse' | 'medium' | 'fine'
type BagId = 'quart' | 'gallon' | '2gallon' | 'small_vac'
type PackId = 'loose' | 'medium' | 'tight'

interface PrepOption {
  id: string
  label: string
  image: string
  caption: string
  /** Reason to pick this. First-timer-facing, anti-worry tone. */
  why: string
}

/**
 * Generalized visual-card shape used by Prep, Decarb, Fats, and Formats
 * steps. `subtitle` and `meta` are optional because Prep cards don't need
 * them (caption is enough), while Decarb/Fats/Formats have substantive
 * temperature / efficiency / serving metadata that benefits from a
 * separate line.
 */
interface WizardCardOption extends PrepOption {
  subtitle?: string
  meta?: string
}

const GRIND_OPTIONS: readonly PrepOption[] = [
  {
    id: 'coarse',
    label: 'Coarse',
    image: grindCoarse,
    caption:
      'Peppercorn-sized chunks. For 3.5 g: ~21 cm³ — easily fits in the Quart bag.',
    why: 'Forgiving. Hard to over-decarb. Good if this is your first time.',
  },
  {
    id: 'medium',
    label: 'Medium',
    image: grindMedium,
    caption:
      'Grinder-dial texture. For 3.5 g: ~12 cm³ — fits comfortably in the Quart bag.',
    why: 'The middle of the road. Most home cooks land here.',
  },
  {
    id: 'fine',
    label: 'Fine',
    image: grindFine,
    caption:
      'Powdery, like ground coffee. For 3.5 g: ~8 cm³ — leaves plenty of room in any bag.',
    why: 'Maximum surface area. Burns through faster — watch your timer.',
  },
]

const BAG_OPTIONS: readonly PrepOption[] = [
  {
    id: 'quart',
    label: 'Quart Bag',
    image: bagQuart,
    caption: '17.8 × 20.3 cm — fits up to ~10 g ground material.',
    why: 'Smallest bag. Pick this for a single 3.5 g batch.',
  },
  {
    id: 'gallon',
    label: 'Gallon Bag',
    image: bagGallon,
    caption: '28.0 × 27.9 cm — fits up to ~28 g ground material.',
    why: 'Plenty of room for one or two batches side by side.',
  },
  {
    id: '2gallon',
    label: '2-Gallon Bag',
    image: bag2Gallon,
    caption: '40.6 × 42.9 cm — fits up to ~60 g ground material.',
    why: 'Big batch territory. Double-bag it before decarbing.',
  },
  {
    id: 'small_vac',
    label: 'Small Vacuum',
    image: bagSmallVac,
    caption: '16.5 × 21.0 cm — vacuum-seal style with depthCm 0.167.',
    why: 'Best air-removal. If you have a vacuum sealer, use this.',
  },
]

const PACK_OPTIONS: readonly PrepOption[] = [
  {
    id: 'loose',
    label: 'Loose',
    image: packLoose,
    caption:
      'The image shows a fully-packed reference. Loose means: the bag is about 30 percent full — material sits in a few loose clumps with most of the bag interior empty.',
    why: 'Avoid this if you can. The empty space is air, and air is what makes decarbing uneven.',
  },
  {
    id: 'medium',
    label: 'Medium',
    image: packMedium,
    caption:
      'The image shows a fully-packed reference. Medium means: about 85 percent fill — nearly a single continuous layer with only tiny gaps here and there.',
    why: 'Reasonable default. Press flat with a spatula before sealing.',
  },
  {
    id: 'tight',
    label: 'Tight',
    image: packTight,
    caption:
      'About 100 percent fill, single flat layer, no visible air gaps. The image is the actual reference.',
    why: 'Best for even conversion. Press flat with a spatula before sealing.',
  },
]

// ---------------------------------------------------------------------------
// Decarb / Fat / Format visual-card arrays
// ---------------------------------------------------------------------------
// Each entry mirrors METHOD_OPTIONS / FAT_OPTIONS / FORMAT_OPTIONS from
// engine/wizardOptions.ts (the engine layer is image-free by design —
// pure domain models), but adds the static image import + the curated
// humanNote / humanRecipe prose already exposed by the engine presets.
// Reordering matches the engine source so test ids stay aligned.

const DECARB_VISUAL_OPTIONS: readonly WizardCardOption[] = [
  {
    id: 'sv_dry',
    label: 'Sous Vide — Dry',
    image: decarbSvDry,
    caption:
      'Vacuum-sealed bag submerged in a water bath held at 95°C by an immersion circulator.',
    why: 'Highest terpene retention of any method. The water bath also buffers against hot spots in the oven.',
    subtitle:
      'Pick this when you want near-maximum conversion with the highest terpene retention and only have a sous vide circulator available.',
    meta: '95°C · 90–120 min · 97% conversion',
  },
  {
    id: 'sv_fast',
    label: 'Sous Vide — Fast',
    image: decarbSvFast,
    caption:
      'Same setup as Sous Vide — Dry, with a slightly longer hold to nudge the last few percent of THCA across.',
    why: 'A small time premium in exchange for ~97% conversion on the first pass.',
    subtitle:
      'Pick this when you want a quick, near-maximum conversion and do not mind giving up a bit of terpene character.',
    meta: '95°C · 120–180 min · 97% conversion',
  },
  {
    id: 'sv_combined',
    label: 'Sous Vide — Combined',
    image: decarbSvCombined,
    caption:
      'Plant material and carrier fat in the same bag. Lower temperature, much longer hold.',
    why: 'One bag, one cleanup. The fat protects cannabinoids from oxidation during the long hold.',
    subtitle:
      'Pick this when you are decarbing and infusing in the same bag — the longer lower-temp run preserves cannabinoids already dissolved in the fat.',
    meta: '85°C · 240–360 min · 88% conversion',
  },
  {
    id: 'sv_lowtemp',
    label: 'Sous Vide — Low Temp',
    image: decarbSvLowtemp,
    caption:
      'Larger stockpot, gentler 73°C bath, an 8 to 12 hour window. Maximum flavor, minimum conversion.',
    why: 'For when the flavor profile of the flower is the whole point.',
    subtitle:
      'Pick this when flavor matters most — you will sacrifice some conversion for the best terpene preservation of any method.',
    meta: '73°C · 480–720 min · 68% conversion',
  },
  {
    id: 'oven_sealed',
    label: 'Oven — Sealed',
    image: decarbOvenSealed,
    caption:
      'Glass baking dish covered tightly with aluminum foil, on the middle rack.',
    why: 'The familiar kitchen workflow. The foil seal keeps enough vapor in to retain most of the terpenes.',
    subtitle:
      'Pick this for a familiar kitchen workflow with no special gear; the foil seal keeps enough vapor in to retain most of the terpenes.',
    meta: '113°C · 60–90 min · 93% conversion',
  },
  {
    id: 'oven_open',
    label: 'Oven — Open',
    image: decarbOvenOpen,
    caption:
      'Same dish, uncovered. Faster conversion, more terpene loss, more CBN formation.',
    why: 'When speed is the priority and you are OK with a flatter flavor profile.',
    subtitle:
      'Pick this only when speed matters more than flavor — fastest conversion, but you lose the most terpenes and risk CBN formation.',
    meta: '116°C · 40 min · 92% conversion',
  },
]

const FAT_VISUAL_OPTIONS: readonly WizardCardOption[] = [
  {
    id: 'ghee',
    label: 'Ghee',
    image: fatGhee,
    caption:
      'Clarified butter. Golden, high smoke point, rich flavor. Solid at room temperature, melts clean.',
    why: 'Excellent cannabinoid solubility and a flavor that pairs well with baked goods.',
    subtitle:
      'Pick ghee for brownies or any baked good — high smoke point, rich flavor, and excellent cannabinoid solubility.',
    meta: '85% extraction',
  },
  {
    id: 'coconut',
    label: 'Coconut Oil',
    image: fatCoconut,
    caption:
      'Virgin coconut oil. White and solid at room temperature. Mild coconut aroma.',
    why: 'The classic for solid-at-room-temp end products — capsules, candy, fudge.',
    subtitle:
      'Pick coconut oil for solid-at-room-temperature end products like capsules or candy; mild coconut aroma.',
    meta: '82% extraction',
  },
  {
    id: 'mct',
    label: 'MCT Oil',
    image: fatMct,
    caption:
      'Fractionated coconut oil. Clear, colorless, stays liquid. Neutral flavor.',
    why: 'Highest extraction efficiency. The default for tinctures, capsules, and gummies.',
    subtitle:
      'Pick MCT for tinctures, capsules, or gummies — neutral flavor, stays liquid at room temperature, highest extraction efficiency.',
    meta: '92% extraction',
  },
  {
    id: 'custom',
    label: 'Custom',
    image: fatCustom,
    caption:
      'A generic carrier-fat option. Bring your own oil and set the extraction efficiency yourself.',
    why: 'When you already have a fat you trust, and a number you can defend.',
    subtitle:
      'Pick custom when you have your own carrier fat; you will set the extraction efficiency yourself.',
    meta: 'set your own',
  },
]

const FORMAT_VISUAL_OPTIONS: readonly WizardCardOption[] = [
  {
    id: 'brownie_9x13',
    label: 'Brownie (9×13 pan)',
    image: formatBrownie9x13,
    caption:
      'Classic rectangular 9×13 pan of baked brownies, cut into 12 visible squares.',
    why: 'The most familiar end product for a first timer. Stir your infused fat in last so the batter stays cool.',
    subtitle:
      'Classic 9×13 pan of baked brownies. Stir your infused butter or coconut oil into the batter 1-for-1 in place of the recipe fat, bake at about 350°F (175°C) for 25–30 minutes, and let cool fully before cutting so the dose distributes evenly.',
    meta: '18 typical servings',
  },
  {
    id: 'brownie_8x8',
    label: 'Brownie (8×8 pan)',
    image: formatBrownie8x8,
    caption:
      'Thicker 8×8 pan of brownies, cut into 9 squares. Fewer, more potent pieces.',
    why: 'Same workflow as 9×13, but each piece carries a noticeably bigger dose.',
    subtitle:
      'Thicker 8×8 brownie pan — fewer, more potent pieces. Same workflow as the 9×13 pan; cut into 9–12 squares instead of 18.',
    meta: '12 typical servings',
  },
  {
    id: 'gummy_80',
    label: 'Gummy mold (80 cavities)',
    image: formatGummy80,
    caption:
      'Silicone 8×10 mold with bear-shape cavities, filled with translucent amber gummies.',
    why: 'Keep the gelatin-oil mixture under 82°C (180°F) at all times so the THC does not degrade.',
    subtitle:
      'Silicone 80-cavity gummy mold. Bloom gelatin in cold liquid, melt with infused MCT oil while keeping the mixture below 82°C (180°F) so the THC does not degrade, then pipette into the cavities.',
    meta: '80 typical servings',
  },
  {
    id: 'gummy_160',
    label: 'Gummy mold (160 cavities)',
    image: formatGummy160,
    caption:
      'Larger silicone mold with 160 smaller cavities. Same workflow as 80-cavity, roughly half the dose per piece.',
    why: 'For high-volume runs where each piece should be a smaller dose.',
    subtitle:
      'Double-row 160-cavity mold for higher-volume runs. Same low-heat gelatin workflow as the 80-cavity mold; each cavity is roughly half the dose.',
    meta: '160 typical servings',
  },
  {
    id: 'capsule_00',
    label: 'Size 00 capsules',
    image: formatCapsule00,
    caption:
      'Size 00 gelatin capsules filled with infused MCT oil. About 24 per batch.',
    why: 'Most precise per-piece dose, most discreet to store, longest shelf life.',
    subtitle:
      'Size 00 gelatin capsules filled with infused MCT oil using a capsule-filling tray. Most precise per-piece dose, most discreet to store, longest shelf life.',
    meta: '24 typical servings',
  },
  {
    id: 'custom',
    label: 'Custom',
    image: formatCustom,
    caption:
      'An empty plate. Pick this when you already know your batch size and serving count.',
    why: 'Skip the curated defaults and enter grams, THCA%, and servings directly.',
    subtitle:
      'Pick this when you already know your batch size. Enter grams, THCA percentage, and serving count manually to match whatever you are actually making.',
    meta: 'set your own',
  },
]

interface VisualCardProps {
  option: WizardCardOption
  selected: boolean
  onSelect: () => void
  /** data-testid override — defaults to `prep-card-${id}` for Prep cards. */
  testId?: string
}

function VisualCard({
  option,
  selected,
  onSelect,
  testId,
}: VisualCardProps): ReactNode {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'group flex w-full min-w-0 flex-col items-stretch overflow-hidden rounded-2xl border text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        selected
          ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] shadow-[inset_0_0_0_1px_var(--accent)]'
          : 'border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] hover:border-[var(--foreground)/30]'
      )}
      data-testid={testId ?? `prep-card-${option.id}`}
      onClick={onSelect}
      type="button"
    >
      <span className="relative aspect-square w-full overflow-hidden bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)]">
        <img
          alt={option.caption}
          className="absolute inset-0 size-full object-cover"
          src={option.image}
        />
        {selected ? (
          <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm">
            <Check className="size-3.5" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {option.label}
          </span>
          {option.meta ? (
            <span className="shrink-0 rounded-full border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
              {option.meta}
            </span>
          ) : null}
        </span>
        <span className="text-xs leading-snug text-[var(--muted-foreground)]">
          {option.caption}
        </span>
        {option.subtitle ? (
          <span className="text-[11px] leading-snug text-foreground/60">
            {option.subtitle}
          </span>
        ) : null}
      </span>
    </button>
  )
}

interface StepPrepProps {
  grindId: GrindId | null
  bagId: BagId | null
  packId: PackId | null
  onGrindChange: (id: GrindId) => void
  onBagChange: (id: BagId) => void
  onPackChange: (id: PackId) => void
}

type PrepSubTab = 'grind' | 'bag' | 'pack'

function StepPrep({
  grindId,
  bagId,
  packId,
  onGrindChange,
  onBagChange,
  onPackChange,
}: StepPrepProps): ReactNode {
  const [activeTab, setActiveTab] = useState<PrepSubTab>('grind')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div
        aria-label="Prep sub-sections"
        className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-1"
        role="tablist"
      >
        {(
          [
            { id: 'grind', label: 'Grind level' },
            { id: 'bag', label: 'Bag size' },
            { id: 'pack', label: 'Packing' },
          ] as const
        ).map(t => {
          const isActive = activeTab === t.id
          return (
            <button
              aria-selected={isActive}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                isActive
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] hover:text-[var(--foreground)]'
              )}
              data-testid={`prep-tab-${t.id}`}
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              role="tab"
              type="button"
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'grind' && (
        <section
          aria-label="Grind level choices"
          className="space-y-3"
          data-testid="prep-grind"
          role="tabpanel"
        >
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Grind is the texture of your flower before it goes in the bag.
            The right grind helps heat reach every particle evenly.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {GRIND_OPTIONS.map(o => (
              <VisualCard
                key={o.id}
                onSelect={() => onGrindChange(o.id as GrindId)}
                option={o}
                selected={grindId === o.id}
              />
            ))}
          </div>
          {grindId ? (
            <p
              className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-info"
              data-testid="prep-why-grind"
            >
              {GRIND_OPTIONS.find(o => o.id === grindId)?.why}
            </p>
          ) : null}
        </section>
      )}

      {activeTab === 'bag' && (
        <section
          aria-label="Bag size choices"
          className="space-y-3"
          data-testid="prep-bag"
          role="tabpanel"
        >
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Pick the bag that fits your batch with a little room to spread
            the material flat. A bag that's too small forces tight packing
            (which leads to uneven decarbing); too big and the material
            shifts around.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BAG_OPTIONS.map(o => (
              <VisualCard
                key={o.id}
                onSelect={() => onBagChange(o.id as BagId)}
                option={o}
                selected={bagId === o.id}
              />
            ))}
          </div>
          {bagId ? (
            <p
              className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-info"
              data-testid="prep-why-bag"
            >
              {BAG_OPTIONS.find(o => o.id === bagId)?.why}
            </p>
          ) : null}
        </section>
      )}

      {activeTab === 'pack' && (
        <section
          aria-label="Packing arrangement choices"
          className="space-y-3"
          data-testid="prep-pack"
          role="tabpanel"
        >
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Spread the ground cannabis into a single flat layer inside the
            bag. Aim for the tightest pack you can get without compressing
            the material — air pockets are where decarbing goes uneven.
            The three cards below all show the same fully-packed reference
            image; the difference between loose / medium / tight is
            described in each card's caption.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PACK_OPTIONS.map(o => (
              <VisualCard
                key={o.id}
                onSelect={() => onPackChange(o.id as PackId)}
                option={o}
                selected={packId === o.id}
              />
            ))}
          </div>
          {packId ? (
            <p
              className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-info"
              data-testid="prep-why-pack"
            >
              {PACK_OPTIONS.find(o => o.id === packId)?.why}
            </p>
          ) : null}
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 4 — Decarb methods                                            */
/* ------------------------------------------------------------------ */

interface MethodPreviewRow {
  id: string
  label: string
  tempC: number
  timeMin: number
  timeMax: number
  efficiency: number
  decarbed: number
}

interface StepDecarbProps {
  selectedIds: string[]
  onToggle: (id: string) => void
  perMethodPreview: MethodPreviewRow[]
}

function StepDecarb({
  selectedIds,
  onToggle,
  perMethodPreview,
}: StepDecarbProps): ReactNode {
  const counter =
    selectedIds.length === 1 ? '1 selected' : `${selectedIds.length} selected`

  return (
    <div className="space-y-4">
      {perMethodPreview.length > 0 && (
        <section
          aria-label="Decarb method previews"
          className="space-y-2"
          data-testid="wizard-decarb-previews"
        >
          <p className="text-xs font-medium text-foreground/70">
            Live previews
          </p>
          {perMethodPreview.map(p => (
            <div
              className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-foreground/5 p-3"
              data-testid={`wizard-decarb-preview-${p.id}`}
              key={p.id}
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-foreground/70"
              />
              <div className="min-w-0 text-xs leading-relaxed text-foreground/80">
                <p className="font-medium text-foreground/90">{p.label}</p>
                <p>
                  After decarb:{' '}
                  <strong className="font-semibold">
                    {_fmt1(p.decarbed)} mg
                  </strong>{' '}
                  of active THC
                  <span className="text-foreground/55">
                    {' '}
                    ({p.tempC}°C · {p.timeMin}–{p.timeMax} min · efficiency{' '}
                    {(p.efficiency * 100).toFixed(0)}%)
                  </span>
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section
        aria-label="Decarb methods to consider"
        className="space-y-2"
        data-testid="wizard-decarb-grid"
      >
        <p className="text-xs font-medium text-foreground/70">
          Pick your methods{' '}
          <span className="text-foreground/55">· {counter}</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DECARB_VISUAL_OPTIONS.map(o => (
            <VisualCard
              key={o.id}
              option={o}
              selected={selectedIds.includes(o.id)}
              testId={`wizard-decarb-card-${o.id}`}
              onSelect={() => onToggle(o.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 4 — Fats                                                      */
/* ------------------------------------------------------------------ */

interface FatPreviewRow {
  id: string
  label: string
  extractionEff: number
  infused: number
}

interface StepFatsProps {
  selectedIds: string[]
  onToggle: (id: string) => void
  perFatPreview: FatPreviewRow[]
}

function StepFats({
  selectedIds,
  onToggle,
  perFatPreview,
}: StepFatsProps): ReactNode {
  const counter =
    selectedIds.length === 1 ? '1 selected' : `${selectedIds.length} selected`

  return (
    <div className="space-y-4">
      {perFatPreview.length > 0 && (
        <section
          aria-label="Fat infusion previews"
          className="space-y-2"
          data-testid="wizard-fat-previews"
        >
          <p className="text-xs font-medium text-foreground/70">
            Live previews
          </p>
          {perFatPreview.map(p => (
            <div
              className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-foreground/5 p-3"
              data-testid={`wizard-fat-preview-${p.id}`}
              key={p.id}
            >
              <Pill
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-foreground/70"
              />
              <div className="min-w-0 text-xs leading-relaxed text-foreground/80">
                <p className="font-medium text-foreground/90">{p.label}</p>
                <p>
                  After infusing with this fat:{' '}
                  <strong className="font-semibold">
                    {_fmt1(p.infused)} mg
                  </strong>{' '}
                  total THC
                  <span className="text-foreground/55">
                    {' '}
                    (extraction {(p.extractionEff * 100).toFixed(0)}%)
                  </span>
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section
        aria-label="Fats on hand"
        className="space-y-2"
        data-testid="wizard-fat-grid"
      >
        <p className="text-xs font-medium text-foreground/70">
          Pick your carrier fats{' '}
          <span className="text-foreground/55">· {counter}</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FAT_VISUAL_OPTIONS.map(o => (
            <VisualCard
              key={o.id}
              option={o}
              selected={selectedIds.includes(o.id)}
              testId={`wizard-fat-card-${o.id}`}
              onSelect={() => onToggle(o.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 5 — Recipe formats                                            */
/* ------------------------------------------------------------------ */

interface StepFormatsProps {
  selectedIds: string[]
  setSelectedIds: (id: string) => void
  totalServings: number
  servingsPerFormat: number
  onServingsChange: (raw: string) => void
}

function StepFormats({
  selectedIds,
  setSelectedIds,
  totalServings,
  servingsPerFormat,
  onServingsChange,
}: StepFormatsProps): ReactNode {
  // Default the per-format servings input to the first selected format's
  // suggestedServings so the user has a sensible starting number (the input
  // used to be empty when no override was set, leaving the user guessing).
  const firstSelected = FORMAT_OPTIONS.find(r => selectedIds.includes(r.id))
  const defaultServings = firstSelected?.suggestedServings ?? 0

  const counter =
    selectedIds.length === 1 ? '1 selected' : `${selectedIds.length} selected`

  return (
    <div className="space-y-4">
      <section
        aria-label="Recipe formats"
        className="space-y-2"
        data-testid="wizard-format-grid"
      >
        <p className="text-xs font-medium text-foreground/70">
          Pick the formats you want to make{' '}
          <span className="text-foreground/55">· {counter}</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMAT_VISUAL_OPTIONS.map(o => (
            <VisualCard
              key={o.id}
              option={o}
              selected={selectedIds.includes(o.id)}
              testId={`wizard-format-card-${o.id}`}
              onSelect={() => setSelectedIds(o.id)}
            />
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3">
        <p
          className="text-xs text-foreground/70"
          data-testid="wizard-total-servings"
        >
          If you make all of these, you'd produce{' '}
          <strong className="font-semibold">{_fmtInt(totalServings)}</strong>{' '}
          servings total.
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
        <label
          className="mb-1.5 block text-xs font-medium text-foreground/80"
          htmlFor="ftg-servings"
        >
          Per-format servings (override per piece)
        </label>
        <input
          className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
          data-testid="wizard-servings"
          id="ftg-servings"
          min="1"
          onChange={e => onServingsChange(e.target.value)}
          step="1"
          type="number"
          value={
            servingsPerFormat > 0
              ? servingsPerFormat
              : defaultServings > 0
                ? defaultServings
                : ''
          }
        />
        <p className="mt-1 text-xs text-foreground/55">
          Default for the first selected format is shown. Adjust to match what
          you are actually making.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 6 — Review / matrix                                           */
/* ------------------------------------------------------------------ */

interface MatrixRow {
  key: string
  method: string
  fat: string
  format: string
  theoretical: number
  decarbed: number
  infused: number
  servings: number
  perServing: number
  classification: string
}

interface StepReviewProps {
  matrix: MatrixRow[]
  grams: number
  thcaPct: number
  onSave: () => void
  onOpenQuickBatch: () => void
}

function StepReview({
  matrix,
  grams,
  thcaPct,
  onSave,
  onOpenQuickBatch,
}: StepReviewProps): ReactNode {
  if (matrix.length === 0) {
    return (
      <div className="space-y-4">
        <EyeOff
          aria-hidden="true"
          className="mx-auto size-8 text-foreground/40"
        />
        <p
          className="text-center text-sm text-foreground/70"
          data-testid="wizard-no-matrix"
        >
          Pick at least one decarb method, one fat, and one recipe format to see
          combinations. Go back and fill in any empty step.
        </p>
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3">
          <p className="text-xs text-foreground/60">
            If you have skip-step habits, the matrix is also your safety net —
            it lets you compare real numbers side by side instead of guessing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="Combination matrix"
        className="space-y-2"
        data-testid="wizard-matrix"
      >
        <p className="text-xs font-medium text-foreground/70">
          {matrix.length} combination{matrix.length === 1 ? '' : 's'} ·{' '}
          {_fmt1(grams)} g @ {_fmt1(thcaPct)}% THCA
        </p>
        {matrix.map(row => (
          <div
            className="rounded-lg border border-foreground/10 bg-foreground/5 p-3"
            data-testid={`wizard-matrix-row-${row.key}`}
            key={row.key}
          >
            <p className="text-xs font-medium text-foreground/90">
              {row.method} + {row.fat} + {row.format}
            </p>
            <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
              {_fmt1(grams)} g @ {_fmt1(thcaPct)}% THCA →{' '}
              <strong className="font-semibold">
                {_fmt1(row.decarbed)} mg
              </strong>{' '}
              decarbed →{' '}
              <strong className="font-semibold">{_fmt1(row.infused)} mg</strong>{' '}
              infused → {row.servings} servings →{' '}
              <strong className="font-semibold">
                {_fmt1(row.perServing)} mg/serving
              </strong>{' '}
              <span className="text-foreground/55">
                ({row.classification || 'n/a'})
              </span>
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-foreground/10 px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="wizard-save-journal"
          disabled={matrix.length === 0}
          onClick={onSave}
          type="button"
        >
          <ClipboardList className="size-4" />
          Save to Journal
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          data-testid="wizard-open-quickbatch"
          onClick={onOpenQuickBatch}
          type="button"
        >
          <ExternalLink className="size-4" />
          Open in Quick Batch
        </button>
      </div>

      <p className="text-xs text-foreground/60">
        Save to Journal writes the top recommendation as a single entry — quick
        and reversible. Open in Quick Batch hands you the full calculator with
        your numbers pre-filled.
      </p>

      <div
        aria-hidden="true"
        className="flex items-center gap-2 text-xs text-foreground/55"
      >
        <Eye className="size-3.5" />
        Numbers are estimates, not lab reports. Adjust the batch any time.
      </div>
    </div>
  )
}
