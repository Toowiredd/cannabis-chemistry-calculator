import type { ReactNode } from 'react'

import { cn } from 'renderer/lib/utils'

import { OptionRow, type OptionRowProps } from './OptionRow'

/**
 * MultiSelectGroup — vertical or grid layout of `<OptionRow>`s with a
 * group label, fieldset/legend semantics, and a live "Selected: N" counter.
 *
 * The group itself is purely presentational: each option already knows
 * its own `selected` state and supplies its own `onToggle`. The group
 * does not own selection state — it just lays out rows and reports a
 * count.
 */
export interface MultiSelectGroupProps {
  /** Visible label rendered as a legend (accessible group name). */
  label: ReactNode
  options: OptionRowProps[]
  /** Optional helper text rendered under the legend. */
  hint?: string
  /**
   * Layout. Defaults to `'stack'` for wizard flows (one row per line).
   * `'grid'` lays options in a responsive 2-col grid up from `sm`.
   */
  layout?: 'stack' | 'grid'
  className?: string
  /** Override for the count label (rare). Defaults to "Selected: N". */
  counterLabel?: string
}

export function MultiSelectGroup({
  label,
  options,
  hint,
  layout = 'stack',
  className,
  counterLabel,
}: MultiSelectGroupProps) {
  const selectedCount = options.reduce(
    (n, option) => (option.selected ? n + 1 : n),
    0
  )
  const totalLabel =
    counterLabel ?? `Selected: ${selectedCount} of ${options.length}`

  return (
    <fieldset
      className={cn(
        'min-w-0 rounded-2xl border border-[var(--border)]',
        'bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)]',
        'p-3 sm:p-4',
        'flex flex-col gap-2.5',
        className
      )}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {label}
        </legend>
        <span
          aria-live="polite"
          className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]"
          data-testid="multi-select-count"
        >
          {totalLabel}
        </span>
      </div>

      {hint ? (
        <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>
      ) : null}

      <div
        className={cn(
          layout === 'stack'
            ? 'flex flex-col gap-2'
            : 'grid grid-cols-1 gap-2 sm:grid-cols-2'
        )}
      >
        {options.map(option => (
          <OptionRow key={option.id} {...option} />
        ))}
      </div>
    </fieldset>
  )
}
