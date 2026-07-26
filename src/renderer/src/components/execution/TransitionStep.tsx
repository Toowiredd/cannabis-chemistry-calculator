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
 *
 * Week 7 (a11y polish):
 *  - The `toast-in` animation is gated on `useReducedMotion()`
 *    so users with prefers-reduced-motion see a static card
 *    (the global CSS already shortens the animation to
 *    0.01ms as a backstop — the explicit gate makes the
 *    contract visible to a future engineer reading the JSX).
 *  - The Continue CTA now has a `focus-visible:ring-*` set
 *    so keyboard users can see where focus is.
 *  - The `data-testid="transition-step"` is on a wrapping
 *    `<section>` rather than the GlassCard root, because
 *    GlassCard does not forward arbitrary props (a
 *    pre-existing design-system convention).
 */
import { ArrowRight } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import { useReducedMotion } from 'renderer/src/hooks/useReducedMotion'
import { GlassCard } from '../GlassCard'

export interface TransitionStepProps {
  /** The transition message, e.g. "Move to infusion →". */
  message: string
  /** Fired when the user taps "Continue". */
  onContinue: () => void
}

export function TransitionStep({ message, onContinue }: TransitionStepProps) {
  const reducedMotion = useReducedMotion()
  return (
    <section data-testid="transition-step">
      <GlassCard
        className={cn(
          'flex flex-col items-center gap-3 text-center',
          !reducedMotion && 'toast-in'
        )}
      >
        <p
          className="text-base font-semibold text-foreground"
          data-testid="transition-step-message"
        >
          {message}
        </p>
        <button
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          data-testid="transition-step-continue"
          onClick={onContinue}
          type="button"
        >
          Continue
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </GlassCard>
    </section>
  )
}
