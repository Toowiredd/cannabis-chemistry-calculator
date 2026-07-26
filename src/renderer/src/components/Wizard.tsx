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
 *  - When `state.branch !== null`, renders the effective branch
 *    sequence (smart-skip filtered — see `getEffectiveBranchSequence`):
 *    - The current step is `active`.
 *    - Steps below the current step are `collapsed`.
 *    - Steps above the current step with a selection are
 *      `collapsed-with-selection`.
 *  - Tapping an option on the active step calls `onSelect(optionId)`.
 *  - "Confirm" advances `state.currentStep` by 1.
 *  - Tapping a `collapsed-with-selection` step calls `onEdit(stepId)`.
 */
import { useCallback } from 'react'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import { getEffectiveBranchSequence } from 'renderer/src/wizard/branchSequences'
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

  // Resolve the effective step sequence (smart-skip filtered).
  // `getEffectiveBranchSequence` returns `[productTypeStep]` when
  // `state.branch === null` (no branch picked yet).
  const steps: readonly WizardStep[] =
    getEffectiveBranchSequence(state.branch, state) ?? []

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
          // look up the selection from the state by the step's
          // own `getSelectedOptionId` (Week 2 — the step owns
          // its own selection encoding; the container no longer
          // hardcodes a step-id → selection-key switch).
          const selected = step.getSelectedOptionId?.(state) ?? null
          cardState =
            selected !== null ? 'collapsed-with-selection' : 'collapsed'
        } else {
          cardState = 'collapsed'
        }
        // Resolve the selected option id for this step. For the
        // active step this is `null` until the user picks.
        const selectedOptionId =
          i < currentIndex
            ? (step.getSelectedOptionId?.(state) ?? null)
            : i === currentIndex
              ? (step.getSelectedOptionId?.(state) ?? null)
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
