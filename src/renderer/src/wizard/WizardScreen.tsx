/**
 * WizardScreen — top-level screen that renders the Stage 1 wizard
 * AND the Stage 2 execution stepper once the user has tapped
 * "Begin batch".
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
 *    that wires up to Stage 2 (see Week 3 below).
 *  - Week 3 (this commit): Tapping "Begin batch" calls
 *    `beginExecution('preheat-decarb')` on the store. The Stage 2
 *    stepper mounts when `wizard.execution.currentStepId` is
 *    non-null. Stage 1 stays mounted alongside the stepper so the
 *    user can return to it via the stepper's "Back to config" CTA
 *    (which calls `returnToConfig`).
 *
 * State: held locally in this component for Week 2+. The state
 * shape (`wizard/wizardTypes.ts`) is the same as the eventual
 * `appStore.wizard` slice owned by state-routing; the migration
 * is a 1-line change (replace `useState` with
 * `useAppStore(s => s.wizard)`) when state-routing lands. The
 * Stage 2 `execution` slice IS in the store (state-routing's
 * commit 51f8d89) — that one is read directly here, not
 * mirrored in local state.
 */
import { useCallback, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { Wizard } from 'renderer/src/components/Wizard'
import { ExecutionStepper } from 'renderer/src/components/ExecutionStepper'
import { useAppStore } from 'renderer/src/stores/appStore'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import {
  BRANCH_SEQUENCES,
  getEffectiveBranchSequence,
} from 'renderer/src/wizard/branchSequences'
import { buildExecutionSteps } from 'renderer/src/wizard/stage2Steps'
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
  // Stage 2 wiring (Week 3). The store's `execution` slice was
  // landed by the state-routing rein in commit 51f8d89; the
  // actions below are the canonical entry / advance / back
  // verbs for the Stage 2 stepper. The selectors are stable
  // (zustand returns the same function reference across renders
  // when the action hasn't been replaced) so passing them into
  // `useCallback` deps doesn't cause a re-mount of every
  // downstream memo.
  const beginExecution = useAppStore(s => s.beginExecution)
  const completeExecutionStep = useAppStore(s => s.completeExecutionStep)
  const skipExecutionStep = useAppStore(s => s.skipExecutionStep)
  const returnToConfig = useAppStore(s => s.returnToConfig)
  const execution = useAppStore(s => s.wizard.execution)

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
      // Picking it (a) advances `state.currentStep` past the
      // end of the canonical sequence so the `isFinished`
      // check in render still returns true and the Stage 1
      // "Batch ready" badge stays visible alongside the Stage
      // 2 stepper, and (b) calls `beginExecution('preheat-decarb')`
      // on the store to transition into Stage 2. The
      // `execution.currentStepId !== null` check below the
      // Stage 1 render block is what triggers the stepper
      // mount; Stage 1 itself stays mounted for the entire
      // batch so the user can hit "Back to config" and pick
      // up where they left off without re-filling the wizard.
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
        // The first Stage 2 step is `preheat-decarb` for the
        // Flower branch (the only branch with Week 3 Stage 2
        // work). For other branches the stepper's empty list
        // path renders "No steps to run" — the user can
        // re-edit their config and re-run Stage 2 once the
        // branch's Stage 2 steps land in weeks 4-6.
        beginExecution('preheat-decarb')
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
    [advancePastSkippedSteps, decodeSelection, beginExecution]
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

  /**
   * Stage 2 → Stage 1 transition (Week 3). The store's
   * `returnToConfig` action clears the `execution` slice but
   * preserves the Stage 1 selections (which live on a different
   * code path in this Week 2+ build — local React state). To
   * give the user a usable Stage 1 view on return, we also
   * reset the local `currentStep` index to the Start step of
   * the canonical sequence so the "Begin batch" CTA is visible
   * again. The selections (branch, method, container, etc.)
   * are intentionally preserved so the user can re-edit a
   * single step via the existing `onEdit` path or re-tap
   * "Begin batch" to resume the same Stage 2 run.
   */
  const onBackToConfig = useCallback(() => {
    returnToConfig()
    setState(prev => {
      if (prev.branch === null) return prev
      const canonical = BRANCH_SEQUENCES[prev.branch] ?? []
      // The Start step sits at `canonical.length - 1`. Drop
      // `currentStep` to that index so the user lands on the
      // Start step (with its "Begin batch" CTA) instead of the
      // post-confirm "Batch ready" badge.
      return { ...prev, currentStep: Math.max(0, canonical.length - 1) }
    })
  }, [returnToConfig])

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
          confirmed the Begin batch CTA. For Week 2 this was
          informational ("Stage 2 lands in week 3"); Week 3 (this
          commit) updates the copy to point at the now-mounted
          Stage 2 stepper below. The Stage 1 view stays mounted
          for the duration of the batch so the user can re-edit
          a single step and re-run Stage 2 without re-filling
          the wizard. */}
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
            Your selections are saved. The Stage 2 execution stepper is below —
            tap &ldquo;Back to config&rdquo; in the stepper to return here.
          </p>
        </section>
      ) : null}

      {/* Stage 2 — Execution stepper. Mounted when the user has
          tapped "Begin batch" (which calls `beginExecution` on the
          store). The gate is `state.branch && execution.currentStepId`:
          the builder needs a branch to know which steps to render,
          and `currentStepId` is the canonical "Stage 2 is live"
          sentinel. The stepper's `steps` prop is the builder's
          output with `isCurrent` + `isComplete` stamped from the
          store's `execution` slice — the builder itself stays
          pure (see `stage2Steps.ts` JSDoc). The branch is
          captured into a local constant so the callbacks below
          can pass it to `buildExecutionSteps` without a
          non-null assertion (TypeScript can't narrow `state.branch`
          inside an inline closure, only at the render site). */}
      {(() => {
        const branch = state.branch
        if (!branch || !execution.currentStepId) return null
        const steps = buildExecutionSteps(branch, state.selections)
        return (
          <ExecutionStepper
            onBack={onBackToConfig}
            onComplete={stepId => {
              // Resolve the next step from the same builder
              // the stepper is using. `buildExecutionSteps` is
              // pure so the call is cheap and the result is
              // stable for a given (branch, selections) pair.
              // When there is no next step (e.g. the heatmap
              // completes the batch), `nextStep?.id` is
              // `undefined` and the store's defensive guard
              // (`currentStepId !== stepId`) keeps the action
              // a no-op on the next render.
              const idx = steps.findIndex(s => s.id === stepId)
              const nextStep = steps[idx + 1]
              completeExecutionStep(stepId, nextStep?.id as string)
            }}
            onSkip={stepId => {
              const idx = steps.findIndex(s => s.id === stepId)
              const nextStep = steps[idx + 1]
              skipExecutionStep(stepId, nextStep?.id as string)
            }}
            selections={state.selections}
            steps={steps.map(step => ({
              ...step,
              isCurrent: step.id === execution.currentStepId,
              isComplete: execution.completedStepIds.includes(step.id),
            }))}
          />
        )
      })()}
    </div>
  )
}
