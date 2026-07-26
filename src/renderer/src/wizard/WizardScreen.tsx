/**
 * WizardScreen — top-level screen that renders the Stage 1 wizard.
 *
 * Per the architecture doc §7:
 *  - Week 1: Behind a `wizardEnabled` feature flag; the product-
 *    type step + the Flower Method step render; the rest is
 *    placeholders.
 *  - Week 2: All 5 branches are wired up. Each branch's full step
 *    sequence is in `branchSequences.ts`. Smart-skip (§3.1) is
 *    applied via `getEffectiveBranchSequence` — when a step's
 *    `skipIf(state)` returns true, the wizard auto-advances past
 *    it. The terminal "Start" step shows a "Begin batch" CTA
 *    that calls a local `onWizardComplete` callback (no-op for
 *    Week 2 — the Stage 2 transition lands in week 3).
 *
 * State: held locally in this component for Week 2. The state
 * shape (`wizard/wizardTypes.ts`) is the same as the eventual
 * `appStore.wizard` slice owned by state-routing; the migration
 * is a 1-line change (replace `useState` with
 * `useAppStore(s => s.wizard)`) when state-routing lands.
 */
import { useCallback, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { Wizard } from 'renderer/src/components/Wizard'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import {
  BRANCH_SEQUENCES,
  getEffectiveBranchSequence,
} from 'renderer/src/wizard/branchSequences'
import {
  DEFAULT_WIZARD_STATE,
  type WizardBranchId,
  type WizardSelections,
  type WizardState,
} from 'renderer/src/wizard/wizardTypes'

export interface WizardScreenProps {
  className?: string
}

export function WizardScreen({ className }: WizardScreenProps) {
  // All hooks must be called unconditionally at the top of the
  // component (React rules of hooks). The `enabled` early return
  // happens AFTER every hook in this function.
  const enabled = useWizardEnabled()
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD_STATE)
  // No-op for Week 2 — the Stage 2 transition lands in week 3.
  // Captured as a callback so the test can spy on the
  // "wizard-complete" event and the future wire-up to the
  // store is a 1-line change.
  const onWizardComplete = useCallback(() => {
    // Intentionally empty for Week 2. The Stage 2 stepper
    // (week 3) will mount here; for now the Begin batch CTA
    // is a no-op that still marks the wizard as complete
    // (`state.currentStep` is past the last step).
  }, [])

  /**
   * Advance the wizard past any steps whose `skipIf(state)`
   * returns true. Used after every state mutation so the user
   * never lands on a step that should be hidden for their
   * current selections (e.g. the Flower "no infusion" path
   * auto-skips the Volume step).
   */
  const advancePastSkippedSteps = useCallback(
    (next: WizardState): WizardState => {
      if (next.branch === null) return next
      let current = next
      // Loop is bounded — at most one pass per skipped step
      // per mutation. The smart-skip predicates are pure
      // functions of state, so the loop terminates once the
      // current step's `skipIf` returns false.
      for (let safety = 0; safety < 16; safety++) {
        const effective = getEffectiveBranchSequence(current.branch, current)
        if (!effective) return current
        if (current.currentStep >= effective.length) return current
        const step = effective[current.currentStep]
        if (!step?.skipIf) return current
        if (!step.skipIf(current)) return current
        current = { ...current, currentStep: current.currentStep + 1 }
      }
      return current
    },
    []
  )

  /**
   * Decode a step's `optionId` into the `selections` key/value
   * it represents. Most steps use the optionId as-is
   * (e.g. `'oven_sealed'` → `selections.method`); the steps
   * with structured selections (weight, efficiency, volume,
   * servings, potency) encode the value into the optionId and
   * need to decode it here.
   *
   * The encoding is shared with `steps.ts`:
   *  - weight:     `${unit}-${value}`   e.g. `g-3.5`
   *  - efficiency: `eff-${pct}`          e.g. `eff-90`
   *  - volume:     `${unit}-${value}`   e.g. `mL-240`
   *  - servings:   `s-${count}`          e.g. `s-12`
   *  - potency:    `p-${pct}`            e.g. `p-75`
   */
  const decodeSelection = useCallback(
    (stepId: string, optionId: string): Partial<WizardSelections> => {
      switch (stepId) {
        case 'weight': {
          // `g-3.5`, `g-7`, etc.
          const match = /^([a-z]+)-(\d+(?:\.\d+)?)$/.exec(optionId)
          if (!match) return {}
          return {
            weight: {
              unit: match[1] as 'g' | 'oz',
              value: Number.parseFloat(match[2]),
            },
          }
        }
        case 'efficiency': {
          // `eff-80`, `eff-90`, etc.
          const match = /^eff-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { efficiency: Number.parseInt(match[1], 10) / 100 }
        }
        case 'volume': {
          // `mL-100`, `mL-240`, etc.
          const match = /^([a-zA-Z]+)-(\d+(?:\.\d+)?)$/.exec(optionId)
          if (!match) return {}
          return {
            volume: {
              unit: match[1] as 'mL' | 'cup' | 'tsp' | 'tbsp',
              value: Number.parseFloat(match[2]),
            },
          }
        }
        case 'servings': {
          // `s-12`, `s-48`, etc.
          const match = /^s-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { servings: Number.parseInt(match[1], 10) }
        }
        case 'potency': {
          // `p-75`, `p-85`, etc.
          const match = /^p-(\d+)$/.exec(optionId)
          if (!match) return {}
          return { potency: Number.parseInt(match[1], 10) }
        }
        case 'fat': {
          // The 'none' tile sets `selections.fat = null` —
          // the brief-mandated sentinel for the Flower
          // branch's "no infusion" path.
          if (optionId === 'none') return { fat: null }
          return { fat: optionId }
        }
        default: {
          // All other steps use the optionId directly as the
          // selection value: method, container, carrier,
          // color, applicationArea.
          return { [stepId]: optionId } as Partial<WizardSelections>
        }
      }
    },
    []
  )

  const onSelect = useCallback(
    (stepId: string, optionId: string) => {
      // The Start step is the terminal "Begin batch" CTA.
      // Picking it advances `state.currentStep` past the end
      // of the canonical sequence (so the `isFinished` check
      // in render returns true and the "Batch ready" badge
      // shows) and calls the local `onWizardComplete` callback
      // (no-op for Week 2; Stage 2 wires it up in week 3).
      if (stepId === 'start') {
        setState(prev => {
          const canonical = prev.branch
            ? (BRANCH_SEQUENCES[prev.branch] ?? [])
            : []
          return {
            ...prev,
            currentStep: canonical.length, // past the end → isFinished
          }
        })
        onWizardComplete()
        return
      }
      setState(prev => {
        // Step 0 (product type) — the optionId is the branch
        // id. Reset selections (picking a new branch discards
        // the previous one's selections) and advance to the
        // first branch step.
        if (stepId === 'product-type') {
          const next: WizardState = {
            ...prev,
            branch: optionId as WizardBranchId,
            currentStep: 1,
            selections: {},
          }
          return advancePastSkippedSteps(next)
        }
        // All other steps: write the decoded selection and
        // advance to the next step. Smart-skip is then
        // applied so the user never lands on a hidden step.
        const decoded = decodeSelection(stepId, optionId)
        const next: WizardState = {
          ...prev,
          currentStep: prev.currentStep + 1,
          selections: { ...prev.selections, ...decoded },
        }
        return advancePastSkippedSteps(next)
      })
    },
    [advancePastSkippedSteps, decodeSelection, onWizardComplete]
  )

  const onEdit = useCallback((stepId: string) => {
    setState(prev => {
      // Re-editing a step sets `currentStep` to that step's
      // index in the EFFECTIVE sequence (smart-skip filtered).
      // We resolve the index dynamically so the user's
      // re-edit lands on the right step even after the
      // Flower "no infusion" path trimmed the Volume step.
      if (prev.branch === null) {
        if (stepId === 'product-type') {
          return { ...prev, currentStep: 0 }
        }
        return prev
      }
      const effective = getEffectiveBranchSequence(prev.branch, prev)
      if (!effective) return prev
      const idx = effective.findIndex(s => s.id === stepId)
      if (idx < 0) return prev
      return { ...prev, currentStep: idx }
    })
  }, [])

  const onReset = useCallback(() => {
    setState(DEFAULT_WIZARD_STATE)
  }, [])

  // When the flag is off, render nothing. The existing
  // GroupedTabNav takes over. This early return is AFTER every
  // hook call above.
  if (!enabled) {
    return null
  }

  // Resolve the effective sequence for the current state.
  // Used to compute `isOnStartStep` and the test-friendly
  // "start step active" check below.
  const effectiveSteps = state.branch
    ? (getEffectiveBranchSequence(state.branch, state) ?? [])
    : []
  const isOnStartStep =
    effectiveSteps.length > 0 &&
    state.currentStep === effectiveSteps.length - 1 &&
    effectiveSteps[effectiveSteps.length - 1]?.id === 'start'
  // Pre-compute the canonical sequence length for the
  // "completed" badge on the Finish section. The user has
  // finished the wizard when they are on the start step
  // (terminal CTA) OR when `currentStep` is past the end of
  // the canonical sequence (post-confirm state).
  const canonicalSteps = state.branch
    ? (BRANCH_SEQUENCES[state.branch] ?? [])
    : []
  const isFinished =
    state.currentStep >= canonicalSteps.length && canonicalSteps.length > 0

  return (
    <div
      className={cn('flex w-full flex-col gap-4 p-2 sm:p-4', className)}
      data-testid="wizard-screen"
    >
      {/* Header — title + reset link. */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-foreground">
            Make a batch
          </h2>
          <p className="text-xs text-foreground/60">
            Answer a few questions and the calculator will set itself up.
          </p>
        </div>
        <button
          aria-label="Reset wizard"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          data-testid="wizard-reset"
          onClick={onReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset wizard
        </button>
      </header>

      {/* The step stack — collapses to nothing when the flag is off. */}
      <Wizard onEdit={onEdit} onSelect={onSelect} state={state} />

      {/* Terminal CTA — the "Begin batch" button. Rendered as a
          separate section below the wizard stack so the user has
          a single, prominent call-to-action when they reach the
          Start step. For Week 2 the click is a no-op (the Stage
          2 stepper lands in week 3). */}
      {isOnStartStep ? (
        <section
          aria-label="Begin batch"
          className="flex flex-col items-stretch gap-2 rounded-xl border border-accent/30 bg-accent/10 p-4"
          data-testid="wizard-begin-section"
        >
          <h3 className="text-sm font-semibold text-foreground">
            Ready to start your batch
          </h3>
          <p className="text-xs text-foreground/70">
            Your selections are saved. Begin the batch to move to the execution
            view.
          </p>
          <button
            aria-label="Begin batch"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 self-end rounded-lg bg-accent/40 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/55"
            data-testid="wizard-begin-cta"
            onClick={() => onSelect('start', 'begin')}
            type="button"
          >
            Begin batch
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </section>
      ) : null}

      {/* Post-finish badge — rendered when the user has
          confirmed the Begin batch CTA. For Week 2 this is
          informational; the Stage 2 stepper (week 3) will
          mount here. */}
      {isFinished ? (
        <section
          aria-label="Batch ready"
          className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/10 p-4"
          data-testid="wizard-finished-section"
        >
          <h3 className="text-sm font-semibold text-success">
            Batch configuration complete
          </h3>
          <p className="text-xs text-foreground/70">
            The Stage 2 execution view lands in week 3. Your selections are
            persisted to local state for this session.
          </p>
        </section>
      ) : null}
    </div>
  )
}
