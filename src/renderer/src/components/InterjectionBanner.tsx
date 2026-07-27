/**
 * InterjectionBanner — a small inline banner that asks the
 * user a sub-decision below the main carousel.
 *
 * 2026-07-28 (Fix 6): the wizard's sous vide flow has a
 * real-world edge case the main carousel can't capture:
 * the user picked the 19cm bag + a sous vide method
 * (sv_combined / sv_fast / sv_lowtemp / sv_dry), and the
 * engine's `recommendDoubleBag` heuristic flags this as
 * "double-bag for sous vide" (smaller bags + stems +
 * sous vide temperature = puncture risk). The interjection
 * is the right surface for this — the user is already
 * committed to the sous vide method + the 19cm bag; we
 * just need them to confirm they're using an outer bag.
 *
 * The banner renders below the carousel with a one-line
 * prompt + 2 tiles (Yes / No). The tiles fire the wizard's
 * onSelect with the parent's stepId + the encoded optionId
 * (`db-yes` / `db-no`); the wizard's `decodeSelection`
 * stores the answer in `selections.doubleBagged` (boolean).
 *
 * The banner is a presentation-only component — the
 * should-it-render predicate lives in `wizardFlow.ts`
 * (`shouldRecommendDoubleBag`), so this file has no
 * domain knowledge.
 */
import { Check, ShieldAlert, X } from 'lucide-react'
import { cn } from 'renderer/lib/utils'

export interface InterjectionBannerProps {
  /** The parent step's id — passed through to onConfirm
   *  so the wizard's decodeSelection can route the
   *  answer to the right place. */
  stepId: string
  /** Short prompt shown above the tiles. */
  title: string
  /** 1-line description of why the interjection fired. */
  description: string
  /** Currently selected optionId, if any. */
  selectedOptionId: string | null
  onConfirm: (stepId: string, optionId: string) => void
}

export function InterjectionBanner({
  stepId,
  title,
  description,
  selectedOptionId,
  onConfirm,
}: InterjectionBannerProps) {
  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3"
      data-testid={`interjection-banner-${stepId}`}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="text-xs leading-snug text-foreground/70">
            {description}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InterjectionTile
          data-testid={`interjection-tile-${stepId}-yes`}
          isSelected={selectedOptionId === 'db-yes'}
          label="Yes, using outer bag"
          onClick={() => onConfirm(stepId, 'db-yes')}
          tone="positive"
        />
        <InterjectionTile
          data-testid={`interjection-tile-${stepId}-no`}
          isSelected={selectedOptionId === 'db-no'}
          label="Single bag (not recommended)"
          onClick={() => onConfirm(stepId, 'db-no')}
          tone="negative"
        />
      </div>
    </div>
  )
}

function InterjectionTile({
  label,
  isSelected,
  onClick,
  tone,
  'data-testid': testId,
}: {
  label: string
  isSelected: boolean
  onClick: () => void
  tone: 'positive' | 'negative'
  'data-testid'?: string
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
        isSelected
          ? tone === 'positive'
            ? 'border-success/50 bg-success/20 text-foreground'
            : 'border-warning/50 bg-warning/20 text-foreground'
          : tone === 'positive'
            ? 'border-success/30 bg-success/5 text-foreground/80 hover:bg-success/15'
            : 'border-warning/30 bg-warning/5 text-foreground/80 hover:bg-warning/15'
      )}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {tone === 'positive' ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <X aria-hidden="true" className="size-3.5" />
      )}
      {label}
    </button>
  )
}
