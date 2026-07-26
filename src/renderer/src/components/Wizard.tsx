/**
 * Wizard — the vertical step-stack container for Stage 1.
 *
 * Per the architecture doc §3: a vertical stack of step cards, each
 * with a horizontal option carousel scoped to that step. Selections
 * snap-shut the card and reveal the next.
 *
 * Behaviour:
 *  - Reads `wizardEnabled` from the store. If `false`, returns
 *    `null` (the existing GroupedTabNav takes over).
 *  - When `state.branch === null`, renders the product-type step
 *    (step 0) as an active card.
 *  - When `state.branch !== null`, renders the branch sequence:
 *    - The current step is `active`.
 *    - Steps below the current step are `collapsed`.
 *    - Steps above the current step with a selection are
 *      `collapsed-with-selection`.
 *    - Steps with `skipIf(state) === true` (week 2+) are hidden.
 *  - Tapping an option on the active step calls `onSelect(optionId)`.
 *  - "Confirm" advances `state.currentStep` by 1.
 *  - Tapping a `collapsed-with-selection` step calls `onEdit(stepId)`.
 */
import { useCallback } from 'react'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import { getBranchSequence } from 'renderer/src/wizard/branchSequences'
import { productTypeStep } from 'renderer/src/wizard/steps'
import type {
  WizardState,
  WizardStep,
  WizardStepCardState,
} from 'renderer/src/wizard/wizardTypes'
import { StepCard } from './StepCard'

export interface WizardProps {
  state: WizardState
  /** Called when the user picks an option on the active step. The
   *  consumer (WizardScreen) is responsible for updating
   *  `state.currentStep` and `state.selections`. */
  onSelect: (stepId: string, optionId: string) => void
  /** Called when the user taps a `collapsed-with-selection` step
   *  to re-edit it. The consumer should set
   *  `state.currentStep = index` so the step becomes active again. */
  onEdit: (stepId: string) => void
}

export function Wizard({ state, onSelect, onEdit }: WizardProps) {
  const enabled = useWizardEnabled()
  const onConfirm = useCallback(
    (stepId: string, optionId: string) => onSelect(stepId, optionId),
    [onSelect]
  )
  const onStepEdit = useCallback((stepId: string) => onEdit(stepId), [onEdit])

  // Gate: when the wizard is feature-flagged off, render nothing.
  if (!enabled) {
    return null
  }

  // Resolve the step sequence. If `state.branch === null`, the
  // product-type step is shown alone (no branch picked yet).
  const steps: readonly WizardStep[] = state.branch
    ? (getBranchSequence(state.branch) ?? [productTypeStep])
    : [productTypeStep]

  // `currentStep` can be in two ranges:
  //   1. Within bounds: `currentIndex === state.currentStep`.
  //      The current step is `active`; steps above with a
  //      selection are `collapsed-with-selection`; steps below
  //      are `collapsed`.
  //   2. Past the last step: the wizard is "complete" — every
  //      step with a selection is `collapsed-with-selection`.
  //      This happens after the user picks the last step's
  //      option (e.g. the Method step on the Flower branch) and
  //      `state.currentStep` advances past the end. The
  //      `Math.min(state.currentStep, steps.length - 1)` clamp
  //      would otherwise leave the last step as `active`.
  const isComplete = state.currentStep >= steps.length && steps.length > 0
  const currentIndex = isComplete
    ? steps.length // sentinel: every step is "above" the current
    : Math.max(0, Math.min(state.currentStep, steps.length - 1))

  return (
    <section
      aria-label="Wizard step stack"
      className="flex w-full flex-col gap-3"
      data-testid="wizard-step-stack"
    >
      {steps.map((step, i) => {
        // Resolve the card state. The active step is `i ===
        // currentIndex`. Steps above with a selection are
        // `collapsed-with-selection`. Steps below are
        // `collapsed`.
        let cardState: WizardStepCardState
        if (i === currentIndex) {
          cardState = 'active'
        } else if (i < currentIndex) {
          // The step above the current one with a selection. We
          // look up the selection from the state by step id.
          const selected = selectionForStep(state, step.id)
          cardState =
            selected !== null ? 'collapsed-with-selection' : 'collapsed'
        } else {
          cardState = 'collapsed'
        }
        // Resolve the selected option id for this step. For the
        // active step this is `null` until the user picks.
        const selectedOptionId =
          i < currentIndex
            ? selectionForStep(state, step.id)
            : i === currentIndex
              ? selectionForStep(state, step.id)
              : null
        return (
          <StepCard
            cardState={cardState}
            key={step.id}
            onConfirm={optionId => onConfirm(step.id, optionId)}
            onEdit={
              cardState === 'collapsed-with-selection'
                ? () => onStepEdit(step.id)
                : undefined
            }
            selectedOptionId={selectedOptionId}
            state={state}
            step={step}
          />
        )
      })}
    </section>
  )
}

/**
 * Look up the selected option id for a step. The mapping is
 * step-id → key in `WizardSelections`. For Week 1 the only
 * non-product-type step is the Flower Method step (`id: 'method'`),
 * which maps to `state.selections.method`.
 */
function selectionForStep(state: WizardState, stepId: string): string | null {
  const selections = state.selections
  switch (stepId) {
    case 'product-type':
      // The product-type step selects the branch, not a key in
      // `selections`. The branch id IS the selection.
      return state.branch
    case 'method':
      return selections.method ?? null
    default:
      // Coming-soon placeholder + future steps. No selection yet.
      return null
  }
}
