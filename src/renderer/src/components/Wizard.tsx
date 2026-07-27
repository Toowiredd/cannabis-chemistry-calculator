/**
 * Wizard — the slide-by-slide stepper for Stage 1.
 *
 * Slide 4 of v2.2 (2026-07-27): the wizard is a SLIDE SHOW.
 * Exactly ONE step is in view at a time. No future steps
 * collapsed below, no "make a batch" multi-step view, no
 * back button — the user advances one slide at a time. A
 * small step counter (1 / 7) at the top-right is the only
 * chrome.
 *
 * 2026-07-28 update: the wizard no longer indexes into a
 * per-branch sequence array. The `currentStepId` from the
 * parent's state identifies the active step; this component
 * looks it up via `STEP_MAP` (a `Record<WizardStepId,
 * WizardStep>`) and renders the matching StepCard. The DAG's
 * `getNextStep` is the canonical source of "what step comes
 * next" — the parent computes it after every onSelect, so
 * the wizard never lands on a hidden step.
 *
 * Behaviour:
 *  - Reads `wizardEnabled`. If `false`, returns `null`.
 *  - Renders ONLY the current step's StepCard.
 *  - Tapping an option on the active step calls
 *    `onSelect(optionId)` which advances `state.currentStepId`.
 *  - The "Begin batch" CTA is rendered by the parent
 *    WizardScreen when the wizard is complete (it lives
 *    below the wizard, NOT inside the StepCard).
 */
import { useCallback } from 'react'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import { STEP_MAP } from 'renderer/src/wizard/steps'
import { getNextStep, getStepCounter, isFinished } from 'renderer/src/wizard/wizardFlow'
import type { WizardState } from 'renderer/src/wizard/wizardTypes'
import { StepCard } from './StepCard'

export interface WizardProps {
  state: WizardState
  onSelect: (stepId: string, optionId: string) => void
}

export function Wizard({ state, onSelect }: WizardProps) {
  const enabled = useWizardEnabled()
  const onConfirm = useCallback(
    (stepId: string, optionId: string) => onSelect(stepId, optionId),
    [onSelect]
  )

  if (!enabled) return null

  // Finished — the user has tapped "Begin batch" and Stage 2
  // is mounted. The wizard renders nothing; the parent's
  // ExecutionStepper takes over. The isFinished helper
  // distinguishes this from the initial state (where
  // currentStepId is also null but endProduct/branch aren't
  // set yet).
  if (isFinished(state)) return null

  // The current step id comes from the parent state
  // (`state.currentStepId`), which is set after every
  // onSelect via the DAG. If it's `null` (initial state),
  // the DAG's `getNextStep` computes the first step from
  // the current selections (the user always lands on
  // 'product-type' for the initial state).
  const stepId = state.currentStepId ?? getNextStep(state)
  if (stepId === null) return null
  const step = STEP_MAP[stepId]
  if (!step) return null

  // Slide counter — "{n} / {total}" in the top-right. The
  // counter is dynamic: the DAG walks forward from the
  // current state (with dummy fill-in for unanswered
  // selections) to compute the total path length, and the
  // current step's index gives the position. As the user
  // advances, the counter increments. See
  // `wizardFlow.getStepCounter` for the algorithm.
  const { stepNumber, totalSteps } = getStepCounter(state)

  return (
    <section
      aria-label={`Wizard step ${stepNumber} of ${totalSteps}`}
      className="flex w-full flex-col gap-2"
      data-testid="wizard-step-stack"
    >
      <div
        aria-label={`Step ${stepNumber} of ${totalSteps}`}
        className="self-end font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/50"
        data-testid="wizard-step-counter"
      >
        {stepNumber} / {totalSteps}
      </div>
      <StepCard
        cardState="active"
        key={step.id}
        onConfirm={optionId => onConfirm(step.id, optionId)}
        onEdit={undefined}
        selectedOptionId={step.getSelectedOptionId?.(state) ?? null}
        state={state}
        step={step}
      />
    </section>
  )
}
