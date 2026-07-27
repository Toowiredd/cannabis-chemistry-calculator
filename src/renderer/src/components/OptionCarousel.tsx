/**
 * OptionCarousel — the 3D carousel for the wizard's option
 * pickers (slides 2+).
 *
 * Slide 6 of v2.2 (2026-07-27): the wizard's option pickers
 * (Method, Container, Weight, Fat, Volume, Servings, Carrier,
 * Color, Application area, etc.) used to render as a flat
 * horizontal row of equally-weighted tiles. The user called
 * that out as inconsistent with the coverflow's carousel
 * treatment on slide 1 and asked for the SAME carousel
 * treatment on every step.
 *
 * Visual: the option tiles now sit in the same 3D perspective
 * carousel as the end-product coverflow. Center tile is fully
 * visible with the accent ring; side tiles are rotated around
 * the Y axis, dimmed, and pulled back. Click any tile → that
 * tile becomes the center AND onSelect fires (one-tap commit,
 * same as the coverflow). The wizard advances to the next
 * slide immediately — there is no separate "Confirm" CTA.
 *
 * Testids: each face keeps the canonical `option-tile-${id}`
 * testid so the existing WizardScreen / Stage2 tests don't
 * need to change.
 */
import { cn } from 'renderer/lib/utils'
import { Carousel } from './Carousel'
import type { WizardOption } from 'renderer/src/wizard/wizardTypes'

export interface OptionCarouselProps {
  options: readonly WizardOption[]
  /** The currently-selected option id, if any. The matching
   *  face is centered on mount; the user can still navigate
   *  to any other face. */
  selectedOptionId?: string | null
  onSelect: (optionId: string) => void
  /** aria-label for the radiogroup. */
  ariaLabel?: string
}

export function OptionCarousel({
  options,
  selectedOptionId,
  onSelect,
  ariaLabel,
}: OptionCarouselProps) {
  if (options.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-foreground/15 bg-foreground/5 px-3 py-4 text-center text-xs text-foreground/60"
        data-testid="step-card-options-empty"
      >
        Nothing to pick here yet.
      </div>
    )
  }

  const initialIndex = selectedOptionId
    ? Math.max(
        0,
        options.findIndex(o => o.id === selectedOptionId)
      )
    : 0

  return (
    <Carousel
      ariaLabel={ariaLabel}
      baseFaceHeight={180}
      baseFaceWidth={220}
      getItemAriaLabel={option => option.title}
      getItemTestId={option => `option-tile-${option.id}`}
      initialIndex={initialIndex}
      items={options}
      // Short option lists (3-4) shouldn't wrap — wrap
      // makes a 3-item carousel feel disorienting (click
      // the right end and you wrap back to the left).
      wrap={options.length >= 5}
      onSelect={option => onSelect(option.id)}
      renderItem={(option, isCenter) => {
        const Icon = option.icon
        return (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {Icon ? (
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0',
                      isCenter ? 'text-accent' : 'text-foreground/70'
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    'truncate text-sm font-semibold',
                    isCenter ? 'text-accent' : 'text-foreground'
                  )}
                >
                  {option.title}
                </span>
              </span>
              {option.badge ? (
                <span
                  className="shrink-0 rounded-full border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/70"
                  data-testid={`option-tile-${option.id}-badge`}
                >
                  {option.badge}
                </span>
              ) : null}
            </span>
            {option.subtitle ? (
              <span
                className={cn(
                  'line-clamp-3 text-[11px] leading-snug',
                  isCenter ? 'text-foreground/80' : 'text-foreground/70'
                )}
              >
                {option.subtitle}
              </span>
            ) : null}
          </>
        )
      }}
      // The option carousel's side faces need extra dimming
      // because the smaller face size makes the side content
      // more readable at low opacity. The 0.62 default in the
      // Carousel still works, but the side face gets a slight
      // hue shift toward foreground/60 to feel "off in the
      // distance" without losing legibility entirely.
      sideFaceClassName="opacity-85"
    />
  )
}
