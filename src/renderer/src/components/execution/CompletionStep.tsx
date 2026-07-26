/**
 * CompletionStep — Stage 2 completion shell (§4.1, "Completion").
 *
 * Renders the result summary + journal save CTA + (Week 6, §8.2)
 * "Run again" CTA for the final step of a batch. Wraps a
 * `<GlassCard>` per the §5.4 contract.
 *
 * Week 2 (this commit): the shell accepts the prop contract
 * and renders the summary + Save button. The actual engine
 * integration (computing thcMg / cbdMg / servings from the
 * Stage 1 selections) lands in week 4-5 alongside the
 * `NameRecipeStep` + `appStore.recipes[]` slice.
 *
 * Week 6 (§8.2): added the "Run again" CTA. The CTA copies
 * the current Recipe's selections into a new draft Recipe
 * and restarts Stage 2 — no need to re-run the wizard if
 * nothing changed. The caller (WizardScreen) owns the actual
 * `rerunRecipe(recipeId)` + "re-engage Stage 1" wiring; the
 * shell just fires `onRerun` when the user taps the button.
 */
import { BookmarkPlus, RotateCcw } from 'lucide-react'
import { GlassCard } from '../GlassCard'

export interface ComputedTotals {
  thcMg: number
  cbdMg: number
  servings: number
}

export interface CompletionStepProps {
  recipeName: string
  computedTotals: ComputedTotals
  /** Fired when the user taps "Save to Journal" — canonical save flow. */
  onSave: () => void
  /** Week 6 (§8.2): fired when the user taps "Run again".
   *  The caller (WizardScreen) is responsible for calling
   *  the store's `rerunRecipe(recipeId)` action and
   *  re-engaging Stage 1 at the product-type picker with
   *  the recipe's selections pre-filled. */
  onRerun: () => void
}

export function CompletionStep({
  recipeName,
  computedTotals,
  onSave,
  onRerun,
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
      {/* -- CTAs (§8.2). Save to Journal stays the primary CTA;
           Run again is a secondary outlined CTA below it. The
           "Mark complete" outlined style in ExecutionStepper is
           the visual reference for the secondary token set. -- */}
      <div className="flex flex-col gap-2" data-testid="completion-step-ctas">
        <button
          aria-label="Save recipe to journal"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35"
          data-testid="completion-step-save"
          onClick={onSave}
          type="button"
        >
          <BookmarkPlus aria-hidden="true" className="size-4" />
          Save to Journal
        </button>
        <button
          aria-label="Run recipe again"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          data-testid="completion-step-rerun"
          onClick={onRerun}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Run again
        </button>
      </div>
    </GlassCard>
  )
}

/** Format milligrams with up to 1 decimal place, no trailing .0. */
function formatMg(mg: number): string {
  if (!Number.isFinite(mg)) return '0'
  const rounded = Math.round(mg * 10) / 10
  return `${rounded} mg`
}
