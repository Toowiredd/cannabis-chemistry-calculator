/**
 * StepCard — single decision card with the 3 states from §3.2.
 *
 * Per the architecture doc §3.2:
 *  - **Collapsed (not yet active):** grayed-out preview of the
 *    step name + a chevron.
 *  - **Active (currently being decided):** full card with title,
 *    the option carousel inside, and a "Confirm" CTA.
 *  - **Collapsed-with-selection (done):** green check + the chosen
 *    option, tap to re-edit.
 *
 * The product-type step (step 0, id='product-type') renders a
 * 3D coverflow of 5 end-product faces (`EndProductCoverflow`)
 * instead of the horizontal scroll-snap `<OptionTile>` row. The
 * rest of the wizard's steps use the scroll-snap row.
 */
import { useId } from 'react'
import { cn } from 'renderer/lib/utils'
import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { OptionTile } from './OptionTile'
import { ProductTypeTooltip } from './ProductTypeTooltip'
import { EndProductCoverflow } from './EndProductCoverflow'
import type {
  WizardOption,
  WizardState,
  WizardStep,
  WizardStepCardState,
} from 'renderer/src/wizard/wizardTypes'

export interface StepCardProps {
  step: WizardStep
  state: WizardState
  cardState: WizardStepCardState
  /** Currently selected option id, if any. */
  selectedOptionId: string | null
  onConfirm: (optionId: string) => void
  /** Optional: re-edit callback (collapsed-with-selection only). */
  onEdit?: () => void
}

export function StepCard({
  step,
  state,
  cardState,
  selectedOptionId,
  onConfirm,
  onEdit,
}: StepCardProps) {
  const titleId = useId()
  const descId = useId()
  const options = step.getOptions(state)
  const selectedOption = options.find(o => o.id === selectedOptionId)

  // -- Collapsed (not yet active) ---------------------------------------
  if (cardState === 'collapsed') {
    return (
      <button
        // Collapsed = disabled (per §3.2 "not yet active"). The
        // button is still in the tab order so screen readers
        // announce it, but it's not interactive. Using
        // aria-disabled rather than the `disabled` attribute so
        // the visual style isn't greyed-out by the browser
        // (the explicit `opacity-60` is the canonical collapsed
        // look).
        aria-disabled="true"
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-left transition-colors',
          'opacity-60 hover:opacity-90'
        )}
        data-testid={`step-card-${step.id}-collapsed`}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-foreground/50"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="truncate text-sm font-semibold text-foreground/70"
            id={titleId}
          >
            {step.title}
          </span>
          {step.description ? (
            <span
              className="line-clamp-1 text-[11px] leading-snug text-foreground/50"
              id={descId}
            >
              {step.description}
            </span>
          ) : null}
        </span>
      </button>
    )
  }

  // -- Collapsed with selection (done) ----------------------------------
  if (cardState === 'collapsed-with-selection') {
    return (
      <button
        aria-label={`${step.title}: ${selectedOption?.title ?? 'selected'}. Tap to re-edit.`}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-left transition-colors',
          'hover:border-success/50 hover:bg-success/15'
        )}
        data-testid={`step-card-${step.id}-collapsed-with-selection`}
        onClick={() => {
          if (onEdit) onEdit()
        }}
        type="button"
      >
        <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-medium uppercase tracking-wider text-success/80">
            {step.title}
          </span>
          <span
            className="truncate text-sm font-semibold text-foreground"
            data-testid={`step-card-${step.id}-selection`}
          >
            {selectedOption?.title ?? 'Selected'}
          </span>
        </span>
        <Pencil
          aria-hidden="true"
          className="size-3.5 shrink-0 text-foreground/50 transition-colors group-hover:text-foreground/80"
        />
      </button>
    )
  }

  // -- Active (the option carousel + Confirm CTA) -----------------------
  return (
    <div data-testid={`step-card-${step.id}-active`}>
      <GlassCard className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-accent"
            />
            <h3
              className="text-base font-semibold text-foreground"
              id={titleId}
            >
              {step.title}
            </h3>
          </div>
          {step.description ? (
            <p
              className="ml-6 text-xs leading-relaxed text-foreground/70"
              id={descId}
            >
              {step.description}
            </p>
          ) : null}
        </header>

        {/* Product-type step: render the 3D coverflow of 5 end-product
            category faces (Baked / Gummies / Capsules / Tincture /
            Salve) per the v2.2 mockup. "Baked" is the category for
            brownies / cookies / cakes / pancakes / muffins. The end
            product maps to a starting-material branch via
            `EndProductCoverflow`'s own table; the coverflow's onSelect
            callback fires with the branch id which the wizard's
            existing handler interprets correctly. */}
        {step.id === 'product-type' ? (
          <EndProductCoverflow
            initialId={
              (selectedOptionId as
                | 'baked'
                | 'gummies'
                | 'capsules'
                | 'tincture'
                | 'salve'
                | null) ?? undefined
            }
            onSelect={(_endProductId, branch) => onConfirm(branch)}
          />
        ) : options.length > 0 ? (
          <div
            aria-label={`${step.title} options`}
            className="flex gap-2 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin]"
            data-testid={`step-card-${step.id}-options`}
            role="radiogroup"
          >
            {options.map(option => (
              <div
                className="min-w-[180px] flex-1 [scroll-snap-align:start]"
                data-testid={`step-card-${step.id}-option-${option.id}`}
                key={option.id}
              >
                <OptionTile
                  isSelected={selectedOptionId === option.id}
                  onTap={() => onConfirm(option.id)}
                  option={option}
                />
                {option.tooltip ? (
                  <div className="mt-1.5">
                    <ProductTypeTooltip text={option.tooltip} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          // Empty options — the coming-soon placeholder. Render a
          // muted "no options yet" affordance so the user knows
          // the step is intentional, not broken.
          <div
            className="rounded-lg border border-dashed border-foreground/15 bg-foreground/5 px-3 py-4 text-center text-xs text-foreground/60"
            data-testid={`step-card-${step.id}-empty`}
          >
            Nothing to pick here yet.
          </div>
        )}

        {/* Confirm CTA — only when an option is selected. The CTA
            fires `onConfirm` with the selected option id. For the
            product-type step this also advances the wizard to step 1
            (handled in WizardScreen). */}
        {options.length > 0 && selectedOptionId ? (
          <div className="flex justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent/20 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/30"
              data-testid={`step-card-${step.id}-confirm`}
              onClick={() => onConfirm(selectedOptionId)}
              type="button"
            >
              Confirm
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}
      </GlassCard>
    </div>
  )
}

// Re-export the option type so test files don't need to import
// from the wizard/ path separately.
export type { WizardOption }
