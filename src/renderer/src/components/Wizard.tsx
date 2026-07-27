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
 * Behaviour:
 *  - Reads `wizardEnabled`. If `false`, returns `null`.
 *  - Renders ONLY the current step's StepCard.
 *  - Tapping an option on the active step calls
 *    `onSelect(optionId)` which advances `state.currentStep`.
 *  - The "Begin batch" CTA is rendered by the parent
 *    WizardScreen when the wizard is complete (it lives
 *    below the wizard, NOT inside the StepCard).
 */
import { useCallback } from 'react'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import { getEffectiveBranchSequence } from 'renderer/src/wizard/branchSequences'
import type { WizardState, WizardStep } from 'renderer/src/wizard/wizardTypes'
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

  const steps: readonly WizardStep[] =
    getEffectiveBranchSequence(state.branch, state) ?? []

  // Complete — the parent renders the "Begin batch" CTA.
  const isComplete = state.currentStep >= steps.length && steps.length > 0
  if (isComplete || steps.length === 0) return null

  const currentIndex = Math.max(0, Math.min(state.currentStep, steps.length - 1))
  const step = steps[currentIndex]
  if (!step) return null

  // Slide counter — "1 / 7" in the top-right. Minimal chrome.
  // Slide 1 (the coverflow) shows "1 / 7" so the user knows
  // how many decisions are left.
  const stepNumber = currentIndex + 1
  const totalSteps = steps.length

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
