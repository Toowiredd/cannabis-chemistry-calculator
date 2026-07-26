/**
 * PreheatStep — Stage 2 pre-action shell (§4.1, "Pre-action").
 *
 * Renders the large-text + button affordance for steps like
 * "Preheat oven to 105°C" (the first decarb step in the typical
 * Flower branch). Wraps a `<GlassCard>` per the §5.4 contract.
 *
 * Week 2 (this commit): the shell renders prop-driven content.
 * The actual wiring — sourcing `targetTemp` + `duration` from
 * the Stage 1 wizard's `selections.method` and the engine's
 * decarb-method time — lands in weeks 3-4. For now the consumer
 * passes the values via props and the shell renders them.
 */
import { Check } from 'lucide-react'
import { GlassCard } from '../GlassCard'

export interface PreheatStepProps {
  /** Target oven temperature in Celsius. */
  targetTemp: number
  /** Human-readable duration (e.g. "45 min"). The wizard
   *  computes this from the selected decarb method. */
  duration: string
  /** Fired when the user taps "I'm ready" — the canonical
   *  advance signal for the preheat step. */
  onReady: () => void
}

export function PreheatStep({
  targetTemp,
  duration,
  onReady,
}: PreheatStepProps) {
  return (
    <GlassCard
      className="flex flex-col items-center gap-2 text-center"
      data-testid="preheat-step"
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider text-foreground/60"
        data-testid="preheat-step-eyebrow"
      >
        Preheat
      </p>
      <p
        className="text-2xl font-bold text-foreground"
        data-testid="preheat-step-target"
      >
        Preheat oven to {targetTemp}°C
      </p>
      <p
        className="text-sm text-foreground/70"
        data-testid="preheat-step-duration"
      >
        I'll need ~{duration}
      </p>
      <button
        className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35"
        data-testid="preheat-step-ready"
        onClick={onReady}
        type="button"
      >
        <Check aria-hidden="true" className="size-4" />
        I'm ready
      </button>
    </GlassCard>
  )
}
