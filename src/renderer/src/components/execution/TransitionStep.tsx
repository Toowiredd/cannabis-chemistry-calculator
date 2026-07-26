/**
 * TransitionStep — Stage 2 transition shell (§4.1, "Transition").
 *
 * Renders the brief animation + next-step CTA for steps like
 * "Move to infusion →". The animation uses the existing
 * `toast-in` keyframe (already in globals.css) — no CSS
 * changes required for this shell.
 *
 * Week 2 (this commit): the shell accepts the prop contract
 * and renders the message + Continue button + animation.
 */
import { ArrowRight } from 'lucide-react'
import { GlassCard } from '../GlassCard'

export interface TransitionStepProps {
  /** The transition message, e.g. "Move to infusion →". */
  message: string
  /** Fired when the user taps "Continue". */
  onContinue: () => void
}

export function TransitionStep({ message, onContinue }: TransitionStepProps) {
  return (
    <GlassCard
      className="toast-in flex flex-col items-center gap-3 text-center"
      data-testid="transition-step"
    >
      <p
        className="text-base font-semibold text-foreground"
        data-testid="transition-step-message"
      >
        {message}
      </p>
      <button
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35"
        data-testid="transition-step-continue"
        onClick={onContinue}
        type="button"
      >
        Continue
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </GlassCard>
  )
}
