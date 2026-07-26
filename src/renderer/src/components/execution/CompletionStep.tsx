/**
 * CompletionStep — Stage 2 completion shell (§4.1, "Completion").
 *
 * Renders the result summary + journal save CTA for the final
 * step of a batch. Wraps a `<GlassCard>` per the §5.4 contract.
 *
 * Week 2 (this commit): the shell accepts the prop contract
 * and renders the summary + Save button. The actual engine
 * integration (computing thcMg / cbdMg / servings from the
 * Stage 1 selections) lands in week 4-5 alongside the
 * `NameRecipeStep` + `appStore.recipes[]` slice.
 */
import { BookmarkPlus } from 'lucide-react'
import { GlassCard } from '../GlassCard'

export interface ComputedTotals {
  thcMg: number
  cbdMg: number
  servings: number
}

export interface CompletionStepProps {
  recipeName: string
  computedTotals: ComputedTotals
  /** Fired when the user taps "Save to Journal". For week 2
   *  this is informational — the actual save flow lands in
   *  week 5 alongside `appStore.recipes[]`. */
  onSave: () => void
}

export function CompletionStep({
  recipeName,
  computedTotals,
  onSave,
}: CompletionStepProps) {
  const { thcMg, cbdMg, servings } = computedTotals
  return (
    <GlassCard className="flex flex-col gap-3" data-testid="completion-step">
      <header className="flex flex-col gap-1 text-center">
        <p
          className="text-xs font-semibold uppercase tracking-wider text-success/80"
          data-testid="completion-step-eyebrow"
        >
          Batch complete
        </p>
        <h3
          className="text-xl font-bold text-foreground"
          data-testid="completion-step-recipe-name"
        >
          {recipeName || 'Untitled recipe'}
        </h3>
      </header>
      <dl
        aria-label="Computed totals"
        className="grid grid-cols-3 gap-2 rounded-xl border border-foreground/10 bg-foreground/5 p-3"
        data-testid="completion-step-totals"
      >
        <div className="flex flex-col items-center text-center">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
            THC
          </dt>
          <dd
            className="text-base font-bold tabular-nums text-foreground"
            data-testid="completion-step-thc"
          >
            {formatMg(thcMg)}
          </dd>
        </div>
        <div className="flex flex-col items-center text-center">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
            CBD
          </dt>
          <dd
            className="text-base font-bold tabular-nums text-foreground"
            data-testid="completion-step-cbd"
          >
            {formatMg(cbdMg)}
          </dd>
        </div>
        <div className="flex flex-col items-center text-center">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
            Servings
          </dt>
          <dd
            className="text-base font-bold tabular-nums text-foreground"
            data-testid="completion-step-servings"
          >
            {servings}
          </dd>
        </div>
      </dl>
      <button
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35"
        data-testid="completion-step-save"
        onClick={onSave}
        type="button"
      >
        <BookmarkPlus aria-hidden="true" className="size-4" />
        Save to Journal
      </button>
    </GlassCard>
  )
}

/** Format milligrams with up to 1 decimal place, no trailing .0. */
function formatMg(mg: number): string {
  if (!Number.isFinite(mg)) return '0'
  const rounded = Math.round(mg * 10) / 10
  return `${rounded} mg`
}
