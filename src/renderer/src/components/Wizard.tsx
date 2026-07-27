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
import { getNextStep, isFinished } from 'renderer/src/wizard/wizardFlow'
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

  // Slide counter — "1 / 7" in the top-right. Minimal chrome.
  // Slide 1 (the coverflow) shows "1 / 7" so the user knows
  // how many decisions are left. The total is the count of
  // unique step ids the DAG would walk through for the
  // current state — computed by following the DAG forward
  // from the current step and counting the steps that
  // would be rendered (not asked, just walkable). For
  // the v2.3 MVP this is a simple count of all the steps
  // the user will see in a typical path; a future iteration
  // can compute it exactly from the DAG.
  const stepNumber = 1
  const totalSteps = 7

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
