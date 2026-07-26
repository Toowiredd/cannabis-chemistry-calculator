/**
 * OptionTile — a single option in a step's option carousel.
 *
 * Per the architecture doc §3.2: "Each tile is a 2-line summary
 * (name + 1 key attribute) with a tap target. **No sliders, no
 * inputs, no multi-field forms** in Stage 1."
 *
 * Visual: 2-line summary (title + subtitle), optional lucide icon
 * on the left, optional badge on the right. Selected state shows
 * an accent border + background. Hover state lifts the card.
 */
import { cn } from 'renderer/lib/utils'
import { Check } from 'lucide-react'
import type { WizardOption } from 'renderer/src/wizard/wizardTypes'

export interface OptionTileProps {
  option: WizardOption
  isSelected: boolean
  onTap: () => void
  /**
   * Override the data-testid on the rendered button. Defaults to
   * `option-tile-${option.id}`. Tests use this to assert
   * option-specific behaviour.
   */
  testId?: string
}

export function OptionTile({
  option,
  isSelected,
  onTap,
  testId,
}: OptionTileProps) {
  const Icon = option.icon
  const tileTestId = testId ?? `option-tile-${option.id}`
  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'group relative flex h-full min-h-[88px] min-w-[180px] flex-1 flex-col gap-1.5 rounded-xl border p-3 text-left transition-all duration-200',
        isSelected
          ? 'border-accent/60 bg-accent/15 shadow-[0_0_18px_-4px_rgba(34,211,238,0.45)]'
          : 'border-foreground/15 bg-foreground/5 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-foreground/10 hover:shadow-md'
      )}
      data-testid={tileTestId}
      onClick={onTap}
      type="button"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <Icon
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0',
                isSelected ? 'text-accent' : 'text-foreground/70'
              )}
            />
          ) : null}
          <span
            className={cn(
              'truncate text-sm font-semibold',
              isSelected ? 'text-accent' : 'text-foreground'
            )}
          >
            {option.title}
          </span>
        </span>
        {isSelected ? (
          <Check
            aria-hidden="true"
            className="size-4 shrink-0 text-accent"
            data-testid={`${tileTestId}-check`}
          />
        ) : option.badge ? (
          <span
            className="shrink-0 rounded-full border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/70"
            data-testid={`${tileTestId}-badge`}
          >
            {option.badge}
          </span>
        ) : null}
      </span>
      {option.subtitle ? (
        <span className="line-clamp-2 text-[11px] leading-snug text-foreground/70">
          {option.subtitle}
        </span>
      ) : null}
    </button>
  )
}
